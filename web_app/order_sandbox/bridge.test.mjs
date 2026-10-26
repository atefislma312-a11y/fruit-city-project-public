import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {OrderWorkflow} from './workflow.mjs';
import {intakeServer} from './http.mjs';
import {bridgeClient,pendingBridgeEvents} from './bridge.mjs';
import {PosOrderBridge} from './pos-bridge.mjs';
import {posFixture} from './pos-fixture.mjs';

const manager={id:'TEST-MANAGER',role:'manager'},token='TEST-BRIDGE-'.repeat(4);
async function setup(t,path,cleanup=()=>{}){
 const pos=posFixture(path),receiver=new PosOrderBridge(pos);await receiver.initialize();
 const service=new OrderWorkflow(':memory:',[{sku:'PJ01',size:'bottle_500ml',posProductId:'TEST-P',posSizeId:'TEST-S',priceMinor:1250,available:true}],{preparationApproved:true});
 const server=intakeServer(service,{staffTokens:[{...manager,token:'TEST-MANAGER-'.repeat(4)},{id:'TEST-BRIDGE',role:'bridge',token}]});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const baseUrl='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));service.close();pos.close();cleanup();});
 let seq=0;
 const create=()=>{const q=service.quote({items:[{sku:'PJ01',size:'bottle_500ml',quantity:2}],customer:{phone:'01000000000'},fulfillment:'pickup',paymentMethod:'cash'});return service.confirm({key:'order-key-'+(++seq),quoteId:q.id,accessToken:q.accessToken,expectedTotalMinor:q.totalMinor});};
 const command=(o,action,extra={})=>service.command(manager,{key:'command-key-'+(++seq),orderId:o.id,revision:o.revision??0,action,...extra});
 const tick=bridgeClient({baseUrl,token,receive:e=>receiver.receive(e)});
 return {pos,receiver,service,server,baseUrl,create,command,tick};
}
test('HTTP bridge: receive, accept, prepare, cash payment and completion affect POS exactly once',async t=>{
 const f=await setup(t);let o=f.create();await f.tick();assert.equal(f.pos.one('SELECT count(*) n FROM orders').n,0);
 o=f.command(o,'status',{status:'accepted'});await f.tick();assert.equal(f.pos.one('SELECT stock_quantity n FROM branch_inventory').n,1000);
 o=f.command(o,'prepare');await f.tick();await f.tick();o=f.service.inbox()[0];assert.equal(o.status,'preparing');
 assert.equal(f.pos.one('SELECT stock_quantity n FROM branch_inventory').n,600);assert.equal(f.pos.one('SELECT count(*) n FROM inventory_movements').n,1);
 o=f.command(o,'status',{status:'ready'});o=f.command(o,'status',{status:'handed_off'});
 o=f.command(o,'payment',{verified:true,reference:'TEST-CASH-RECEIPT',amountMinor:2500});o=f.command(o,'status',{status:'completed'});
 await f.tick();await f.tick();assert.equal(f.pos.one('SELECT order_status s FROM orders').s,'completed');
 assert.equal(f.pos.one('SELECT count(*) n FROM payment_records').n,1);assert.equal(f.pos.one('SELECT cash_sales n FROM cashier_shifts').n,25);
 assert.equal(pendingBridgeEvents(f.service).length,0);
 assert.equal((await fetch(f.baseUrl+'/bridge/events')).status,403);
 assert.equal((await fetch(f.baseUrl+'/bridge/events',{headers:{Authorization:'Bearer '+'TEST-MANAGER-'.repeat(4)}})).status,403);
});
test('lost preparation ACK and reopened POS never deduct stock twice',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'fc-bridge-'));
 const f=await setup(t,join(dir,'test.db'),()=>rmSync(dir,{recursive:true,force:true}));let o=f.create();await f.tick();o=f.command(o,'status',{status:'accepted'});await f.tick();f.command(o,'prepare');
 const event=pendingBridgeEvents(f.service)[0];const receipt=await f.receiver.receive(event);
 // A second independent connection models a new receiver process after the ACK was lost.
 const reopened=posFixture(join(dir,'test.db'));try{const receiver=new PosOrderBridge(reopened);await receiver.initialize();
  assert.deepEqual(await receiver.receive(event),receipt);
  await bridgeClient({baseUrl:f.baseUrl,token,receive:e=>receiver.receive(e)})();
  assert.equal(reopened.one('SELECT stock_quantity n FROM branch_inventory').n,600);
 }finally{reopened.close();}
 assert.equal(f.service.inbox()[0].status,'preparing');
});
test('insufficient stock, missing recipe and injected SQL failure retain event with atomic rollback',async t=>{
 const f=await setup(t);let o=f.create();await f.tick();o=f.command(o,'status',{status:'accepted'});await f.tick();f.command(o,'prepare');
 f.pos.run('UPDATE recipes SET is_complete=0');await assert.rejects(f.tick(),/RECIPE_NOT_READY/);
 f.pos.run('UPDATE recipes SET is_complete=1');f.pos.run('UPDATE branch_inventory SET stock_quantity=1');await assert.rejects(f.tick(),/INSUFFICIENT_STOCK/);
 f.pos.run('UPDATE branch_inventory SET stock_quantity=1000');f.pos.db.exec("CREATE TRIGGER fail_receipt BEFORE INSERT ON web_bridge_receipts BEGIN SELECT RAISE(ABORT,'TEST_FAIL'); END");
 await assert.rejects(f.tick(),/TEST_FAIL/);assert.equal(f.pos.one('SELECT stock_quantity n FROM branch_inventory').n,1000);
 assert.equal(f.pos.one('SELECT count(*) n FROM inventory_movements').n,0);assert.equal(f.service.inbox()[0].preparationPending,true);
 f.pos.db.exec('DROP TRIGGER fail_receipt');await f.tick();assert.equal(f.pos.one('SELECT stock_quantity n FROM branch_inventory').n,600);
});
test('prepared cancellation and cash refund preserve stock, record waste review and refund once',async t=>{
 const f=await setup(t);let o=f.create();await f.tick();o=f.command(o,'status',{status:'accepted'});await f.tick();f.command(o,'prepare');await f.tick();await f.tick();o=f.service.inbox()[0];
 o=f.command(o,'payment',{verified:true,reference:'TEST-CASH',amountMinor:2500});await f.tick();
 o=f.command(o,'status',{status:'cancelled',reason:'TEST CUSTOMER CANCELLED'});o=f.command(o,'refund',{verified:true,reference:'TEST REFUND',amountMinor:2500});
 await f.tick();await f.tick();assert.equal(f.pos.one('SELECT stock_quantity n FROM branch_inventory').n,600);
 assert.equal(f.pos.one('SELECT count(*) n FROM refund_records').n,1);assert.equal(f.pos.one('SELECT expected_cash n FROM cashier_shifts').n,0);
 assert.equal(JSON.parse(f.pos.one('SELECT snapshot FROM web_order_inbox').snapshot).wasteReviewRequired,true);
});
test('closed cash shift blocks accounting and preserves pending bridge work',async t=>{
 const f=await setup(t);let o=f.create();await f.tick();o=f.command(o,'status',{status:'accepted'});await f.tick();
 f.pos.run("UPDATE cashier_shifts SET status='closed'");f.command(o,'payment',{verified:true,reference:'TEST',amountMinor:2500});
 await assert.rejects(f.tick(),/OPEN_CASHIER_SHIFT_REQUIRED/);assert.equal(f.pos.one('SELECT count(*) n FROM payment_records').n,0);assert.equal(pendingBridgeEvents(f.service).length,1);
});

test('concurrent delivery of one preparation deducts shared ingredient across sizes once',async t=>{
 const f=await setup(t);
 f.pos.run(process.env.FC_TEST_SCHEMA?"INSERT INTO product_sizes(size_id,size_code,name_ar,volume_ml) VALUES ('TEST-L','1L','TEST',1000)":"INSERT INTO product_sizes(size_id,size_code,volume_ml) VALUES ('TEST-L','1L',1000)");
 f.service.catalogSource.push({sku:'PJ01',size:'bottle_1l',posProductId:'TEST-P',posSizeId:'TEST-L',priceMinor:2000,available:true});
 const q=f.service.quote({items:[{sku:'PJ01',size:'bottle_500ml',quantity:2},{sku:'PJ01',size:'bottle_1l',quantity:1}],customer:{phone:'01000000000'},fulfillment:'pickup',paymentMethod:'cash'});
 let o=f.service.confirm({key:'shared-ingredient-order',quoteId:q.id,accessToken:q.accessToken,expectedTotalMinor:4500});await f.tick();o=f.command(o,'status',{status:'accepted'});await f.tick();f.command(o,'prepare');
 const event=pendingBridgeEvents(f.service)[0];const results=await Promise.all(Array.from({length:20},()=>f.receiver.receive(event)));
 assert.ok(results.every(r=>r.receiptId===results[0].receiptId));assert.equal(f.pos.one('SELECT stock_quantity n FROM branch_inventory').n,200);
 assert.equal(f.pos.one('SELECT count(*) n FROM inventory_movements').n,1);await f.tick();assert.equal(f.service.inbox()[0].status,'preparing');
});

test('competing preparations cannot oversell shared ingredient',async t=>{
 const f=await setup(t);f.pos.run('UPDATE branch_inventory SET stock_quantity=600');
 for(let i=0;i<2;i++){let o=f.create();await f.tick();o=f.command(o,'status',{status:'accepted'});await f.tick();f.command(o,'prepare');if(i===0){const event=pendingBridgeEvents(f.service)[0];await f.receiver.receive(event);await f.tick();}}
 await assert.rejects(f.tick(),/INSUFFICIENT_STOCK/);assert.equal(f.pos.one('SELECT stock_quantity n FROM branch_inventory').n,200);assert.equal(f.pos.one('SELECT count(*) n FROM inventory_movements').n,1);
});
