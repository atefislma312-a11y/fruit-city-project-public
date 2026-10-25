import test from 'node:test';
import assert from 'node:assert/strict';
import {OrderWorkflow} from './workflow.mjs';
const cashier={id:'TEST-CASHIER',role:'cashier'},manager={id:'TEST-MANAGER',role:'manager'},bridge={id:'TEST-BRIDGE',role:'bridge'};
function setup(t,approved=true){const s=new OrderWorkflow(':memory:',[{sku:'TEST',size:'500ml',posProductId:'TEST-P',posSizeId:'TEST-S',priceMinor:1000,available:true}],{preparationApproved:approved});t.after(()=>s.close());let seq=0;
 const create=(method='cash')=>{const q=s.quote({items:[{sku:'TEST',size:'500ml',quantity:1}],customer:{phone:'01000000000'},fulfillment:'pickup',paymentMethod:method});return s.confirm({key:'order-key-'+(++seq),quoteId:q.id,accessToken:q.accessToken,expectedTotalMinor:1000});};
 const command=(o,action,extra={},actor=cashier)=>s.command(actor,{key:'command-key-'+(++seq),orderId:o?.id,revision:o?.revision??0,action,...extra});return {s,create,command};}
test('full lifecycle waits for inventory ACK and payment before completion',t=>{
 const {s,create,command}=setup(t);let o=create();assert.throws(()=>command(o,'status',{status:'ready'}),/INVALID_TRANSITION/);
 o=command(o,'status',{status:'accepted'});o=command(o,'prepare');assert.equal(o.status,'accepted');assert.equal(o.preparationPending,true);
 assert.throws(()=>command(o,'inventory_ack',{commandId:o.preparationCommandId,receiptId:'TEST-RECEIPT'}),/FORBIDDEN/);
 o=command(o,'inventory_ack',{commandId:o.preparationCommandId,receiptId:'TEST-RECEIPT'},bridge);
 assert.equal(o.status,'preparing');o=command(o,'status',{status:'ready'});o=command(o,'status',{status:'handed_off'});
 assert.throws(()=>command(o,'status',{status:'completed'}),/PAYMENT_REQUIRED/);
 o=command(o,'payment',{verified:true,amountMinor:1000,reference:'TEST-CASH'});o=command(o,'status',{status:'completed'});
 assert.equal(o.status,'completed');assert.equal(o.settlementStatus,'unsettled');assert.ok(s.db.prepare('SELECT count(*) n FROM intake_events').get().n>=7);
});
test('InstaPay needs manager verification; reused transfer is rejected',t=>{
 const {create,command}=setup(t);let o=create('instapay_manual');o=command(o,'status',{status:'accepted'});
 assert.throws(()=>command(o,'prepare'),/PAYMENT_REQUIRED/);
 assert.throws(()=>command(o,'payment',{verified:true,amountMinor:1000,reference:'TEST-TRANSFER'}),/FORBIDDEN/);
 assert.throws(()=>command(o,'payment',{verified:false,amountMinor:1000,reference:'TEST-TRANSFER'},manager),/INVALID_PAYMENT/);
 o=command(o,'payment',{verified:true,amountMinor:1000,reference:'TEST-TRANSFER'},manager);let other=create('instapay_manual');
 assert.throws(()=>command(other,'payment',{verified:true,amountMinor:1000,reference:'TEST-TRANSFER'},manager),/INVALID_DUPLICATE_PAYMENT/);
 o=command(o,'settle',{verified:true,reference:'TEST-BANK'},manager);assert.equal(o.settlementStatus,'settled');
});
test('prepared cancellation requires manager, records waste and refund without stock restoration',t=>{
 const {create,command}=setup(t);let o=create();o=command(o,'status',{status:'accepted'});o=command(o,'prepare');
 o=command(o,'inventory_ack',{commandId:o.preparationCommandId,receiptId:'TEST-RECEIPT'},bridge);
 o=command(o,'payment',{verified:true,amountMinor:1000,reference:'TEST-CASH'});
 assert.throws(()=>command(o,'status',{status:'cancelled',reason:'TEST'}),/FORBIDDEN/);
 o=command(o,'status',{status:'cancelled',reason:'TEST'},manager);assert.equal(o.wasteReviewRequired,true);assert.equal(o.paymentStatus,'refund_pending');
 o=command(o,'refund',{verified:true,amountMinor:1000,reference:'TEST-REFUND'},manager);assert.equal(o.paymentStatus,'refunded');
});
test('command retry idempotent; stale revision rejected; close intake manager-only',t=>{
 const {s,create,command}=setup(t);const o=create();const cmd={key:'same-command-key',orderId:o.id,revision:0,action:'status',status:'accepted'};
 assert.deepEqual(s.command(cashier,cmd),s.command(cashier,cmd));assert.throws(()=>command(o,'status',{status:'rejected',reason:'TEST'}),/REVISION_CONFLICT/);
 assert.throws(()=>command(null,'intake',{accepting:false}),/FORBIDDEN/);command(null,'intake',{accepting:false},manager);
 assert.throws(()=>create(),/STORE_CLOSED/);
});
test('preparation unavailable until policy approval and cannot cancel pending stock command',t=>{
 const {create,command}=setup(t,false);let o=create();o=command(o,'status',{status:'accepted'});assert.throws(()=>command(o,'prepare'),/PREPARATION_POLICY_REQUIRED/);
 const enabled=setup(t);let pending=enabled.create();pending=enabled.command(pending,'status',{status:'accepted'});pending=enabled.command(pending,'prepare');
 assert.throws(()=>enabled.command(pending,'status',{status:'cancelled',reason:'TEST'},manager),/PREPARATION_/);
});
