import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,unlinkSync,rmdirSync} from 'node:fs';
import {join} from 'node:path';
import {OrderIntake} from './intake.mjs';
import {intakeServer} from './http.mjs';
const catalog=()=>[{sku:'TEST-JUICE',size:'bottle_500ml',posProductId:'TEST-P',posSizeId:'TEST-S',priceMinor:1250,available:true}];
const input=()=>({items:[{sku:'TEST-JUICE',size:'bottle_500ml',quantity:2,priceMinor:1}],customer:{phone:'01000000000'},fulfillment:'pickup',paymentMethod:'cash'});
const confirm=q=>({key:'test-confirm-001',quoteId:q.id,accessToken:q.accessToken,expectedTotalMinor:q.totalMinor});
function fixture(t){const c=catalog();let now=1000;const s=new OrderIntake(':memory:',c,{clock:()=>now});t.after(()=>s.close());return {s,c,setTime:v=>now=v};}
test('server quote requires explicit total and saves pending unpaid once',t=>{
 const {s}=fixture(t),q=s.quote(input());assert.equal(q.totalMinor,2500);assert.equal(s.count(),0);
 assert.throws(()=>s.confirm({...confirm(q),expectedTotalMinor:1}),/TOTAL_MISMATCH/);
 const o=s.confirm(confirm(q));assert.equal(o.status,'pending_store_acceptance');assert.equal(o.paymentStatus,'unpaid');assert.equal(o.settlementStatus,'unsettled');
 assert.equal(s.confirm(confirm(q)).id,o.id);assert.equal(s.count(),1);
 assert.throws(()=>s.confirm({...confirm(q),key:'different-key'}),/QUOTE_ALREADY_CONFIRMED/);
 assert.throws(()=>s.confirm({...confirm(q),expectedTotalMinor:1}),/IDEMPOTENCY_CONFLICT/);
});
test('stale price, unavailable variant and expiry require new customer quote',t=>{
 const {s,c,setTime}=fixture(t);const q=s.quote(input());c[0].priceMinor++;
 assert.throws(()=>s.confirm(confirm(q)),/QUOTE_CHANGED/);c[0].priceMinor--;c[0].available=false;
 assert.throws(()=>s.confirm(confirm(q)),/UNAVAILABLE/);c[0].available=true;setTime(q.expiresAt);
 assert.throws(()=>s.confirm(confirm(q)),/QUOTE_EXPIRED/);assert.equal(s.count(),0);
});
test('refresh catalog on confirmation; expired approval and Unicode tokens fail closed',t=>{
 let available=catalog();const s=new OrderIntake(':memory:',()=>available);t.after(()=>s.close());const q=s.quote(input());
 assert.throws(()=>s.confirm({...confirm(q),accessToken:'é'.repeat(q.accessToken.length)}),/FORBIDDEN/);
 available=[];assert.throws(()=>s.confirm(confirm(q)),/UNKNOWN_VARIANT/);assert.equal(s.count(),0);
});
test('no delivery assumptions, no payment from method choice, no partial quote',t=>{
 const {s}=fixture(t);assert.throws(()=>s.quote({...input(),fulfillment:'delivery'}),/DELIVERY_NOT_CONFIGURED/);
 const q=s.quote({...input(),paymentMethod:'instapay_manual'});assert.equal(s.confirm(confirm(q)).paymentStatus,'unpaid');
 assert.throws(()=>s.quote({...input(),items:[...input().items,{sku:'MISSING',size:'kg',quantity:1}]}),/UNKNOWN_VARIANT/);
 assert.equal(s.db.prepare('SELECT count(*) n FROM intake_quotes').get().n,1);
});
test('outbox failure retains order; wrong ACK cannot clear event; retries use same id',async t=>{
 const {s}=fixture(t);s.confirm(confirm(s.quote(input())));await s.deliver(async()=>{throw Error('offline');});
 await s.deliver(async()=>({eventId:'wrong',orderId:'wrong'}));assert.equal(s.count(),1);
 let calls=0;await s.deliver(async e=>{calls++;assert.equal(e.order.accessToken,undefined);return {eventId:e.eventId,orderId:e.order.id};});
 await s.deliver(async()=>{calls++;});assert.equal(calls,1);
 assert.equal(s.db.prepare('SELECT attempts FROM intake_outbox').get().attempts,3);
});
test('transaction failure leaves no order, confirmation or event',t=>{
 const {s}=fixture(t);const q=s.quote(input());s.db.exec("CREATE TRIGGER fail_outbox BEFORE INSERT ON intake_outbox BEGIN SELECT RAISE(ABORT,'TEST_FAIL'); END;");
 assert.throws(()=>s.confirm(confirm(q)),/TEST_FAIL/);assert.equal(s.count(),0);
 for(const table of ['intake_confirmations','intake_events','intake_outbox']) assert.equal(s.db.prepare(`SELECT count(*) n FROM ${table}`).get().n,0);
});
test('durable order and outbox survive process connection restart',()=>{
 const dir=mkdtempSync(new URL('./test-data-',import.meta.url));const file=join(dir,'isolated.db');let s;
 try{s=new OrderIntake(file,catalog());const q=s.quote(input());const o=s.confirm(confirm(q));s.close();s=new OrderIntake(file,catalog());
 assert.equal(s.confirm(confirm(q)).id,o.id);assert.equal(s.db.prepare('SELECT count(*) n FROM intake_outbox WHERE acked=0').get().n,1);
 }finally{s?.close();unlinkSync(file);rmdirSync(dir);}
});
test('HTTP: 40 concurrent retries yield one order; anonymous admin and order access blocked',async t=>{
 const {s}=fixture(t);const staff='test-staff-token-'.repeat(3);const server=intakeServer(s,{staffTokens:[{id:'TEST-CASHIER',token:staff,role:'cashier'}]});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>new Promise(r=>server.close(r)));
 const base='http://127.0.0.1:'+server.address().port;
 const post=(path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const q=await (await post('/quotes',input())).json();
 const results=await Promise.all(Array.from({length:40},()=>post('/orders',confirm(q)).then(async r=>({status:r.status,body:await r.json()}))));
 assert.ok(results.every(r=>[200,201].includes(r.status)));assert.equal(new Set(results.map(r=>r.body.id)).size,1);assert.equal(s.count(),1);
 const id=results[0].body.id;assert.equal((await fetch(base+'/staff/orders')).status,401);
 assert.equal((await fetch(base+'/orders/'+id)).status,403);
 assert.equal((await fetch(base+'/orders/'+id,{headers:{Authorization:'Bearer '+q.accessToken}})).status,200);
 const inbox=await (await fetch(base+'/staff/orders',{headers:{Authorization:'Bearer '+staff}})).json();assert.equal(inbox.orders.length,1);assert.equal(inbox.orders[0].accessToken,undefined);
 assert.equal((await fetch(base+'/staff/orders',{headers:{Authorization:'Bearer '+staff,Origin:'https://untrusted.example'}})).status,403);
 assert.equal((await post('/quotes',null)).status,400);
});
