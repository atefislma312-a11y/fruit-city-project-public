import {randomUUID} from 'node:crypto';
import {sizes} from './catalog.mjs';
import {customerDetails} from './customer.mjs';
import {eventFingerprint} from './bridge.mjs';

// Executes INSIDE the POS writer, through its transaction queue. Never opens a POS file.
// transaction(callback) must resolve only after durable persistence, and roll back on failure.
export class PosOrderBridge {
 constructor({branchId,transaction,one,all,run,instapayFeeMinor}) {
  if(!branchId||![transaction,one,all,run].every(v=>typeof v==='function'))throw Error('INVALID_POS_ADAPTER');
  Object.assign(this,{branchId,transaction,one,all,run,instapayFeeMinor});
 }
 async initialize(){await this.transaction(()=>{
  this.run('CREATE TABLE IF NOT EXISTS web_bridge_receipts(event_id TEXT PRIMARY KEY,order_id TEXT NOT NULL,fingerprint TEXT NOT NULL,receipt TEXT NOT NULL)');
  this.run('CREATE TABLE IF NOT EXISTS web_order_inbox(order_id TEXT PRIMARY KEY,identity TEXT NOT NULL,snapshot TEXT NOT NULL,revision INTEGER NOT NULL,prepared_receipt TEXT)');
 });}
 validate(event){
  const o=event?.order;
  if(!event||typeof event.eventId!=='string'||event.eventId.length>100||!event.eventId||!['incoming_order','order_update','prepare_inventory'].includes(event.kind))throw Error('INVALID_ENVELOPE');
  if(!o||typeof o.id!=='string'||!o.id||o.id.length>50||o.branchId!==this.branchId||o.source!=='web'||o.currency!=='EGP'||o.accessToken!==undefined||o.fulfillment!=='pickup'||!['cash','instapay_manual'].includes(o.paymentMethod))throw Error('INVALID_ENVELOPE');
  customerDetails(o.customer);
  if(!Array.isArray(o.lines)||!o.lines.length||o.lines.length>100)throw Error('INVALID_ITEMS');
  let total=0;
  for(const l of o.lines){
   if(!l||typeof l.sku!=='string'||!l.posProductId||!l.posSizeId||!sizes[l.size]||!Number.isSafeInteger(l.quantity)||l.quantity<1||l.quantity>99||!Number.isSafeInteger(l.unitPriceMinor)||l.unitPriceMinor<=0||l.totalMinor!==l.quantity*l.unitPriceMinor)throw Error('INVALID_LINE');
   total+=l.totalMinor;
  }
  if(!Number.isSafeInteger(total)||total!==o.totalMinor)throw Error('INVALID_TOTAL');
  return JSON.stringify({id:o.id,branchId:o.branchId,lines:o.lines,totalMinor:o.totalMinor,customer:o.customer,fulfillment:o.fulfillment,paymentMethod:o.paymentMethod});
 }
 async receive(event){
  const identity=this.validate(event),o=event.order,fingerprint=eventFingerprint(event);
  return this.transaction(()=>{
   const prior=this.one('SELECT * FROM web_bridge_receipts WHERE event_id=?',[event.eventId]);
   if(prior){if(prior.fingerprint!==fingerprint)throw Error('IDEMPOTENCY_CONFLICT');return JSON.parse(prior.receipt);}
   const inbox=this.one('SELECT * FROM web_order_inbox WHERE order_id=?',[o.id]);
   if(event.kind==='incoming_order'){
    if(inbox||o.status!=='pending_store_acceptance'||o.paymentStatus!=='unpaid')throw Error('INVALID_INCOMING_ORDER');
    this.run('INSERT INTO web_order_inbox(order_id,identity,snapshot,revision) VALUES (?,?,?,0)',[o.id,identity,JSON.stringify(o)]);
   }else{
    if(!inbox||inbox.identity!==identity)throw Error('INVALID_ORDER_IDENTITY');
    if(event.kind==='prepare_inventory'){
     if(o.status!=='accepted'||!o.preparationPending||o.preparationCommandId!==event.eventId||inbox.prepared_receipt)throw Error('INVALID_PREPARATION');
     if(JSON.parse(inbox.snapshot).status!=='accepted')throw Error('INVALID_TRANSITION');
     this.prepare(o,event.eventId);
    }else {
     if(!Number.isSafeInteger(o.revision)||o.revision<=inbox.revision)throw Error('REVISION_CONFLICT');
     if(['preparing','ready','handed_off','completed'].includes(o.status)&&!inbox.prepared_receipt)throw Error('PREPARATION_REQUIRED');
     this.update(o);
     this.run('UPDATE web_order_inbox SET snapshot=?,revision=? WHERE order_id=?',[JSON.stringify(o),o.revision,o.id]);
    }
   }
   const receipt={eventId:event.eventId,orderId:o.id,...(event.kind==='prepare_inventory'?{receiptId:'web-stock-'+event.eventId}:{})};
   this.run('INSERT INTO web_bridge_receipts VALUES (?,?,?,?)',[event.eventId,o.id,fingerprint,JSON.stringify(receipt)]);
   return receipt;
  });
 }
 ensureOrder(o){
  const old=this.one('SELECT * FROM orders WHERE order_id=?',[o.id]);
  if(old){if(old.idempotency_key!=='web-'+o.id||old.branch_id!==this.branchId)throw Error('IDEMPOTENCY_CONFLICT');return;}
  const actor=o.lastAction?.by||o.payment?.verifiedBy;
  if(!actor)throw Error('INVALID_ACTOR');
  this.run(`INSERT INTO orders(order_id,order_number,branch_id,order_source,order_type,order_status,payment_status,preparation_status,subtotal,total_amount,cashier_id,customer_phone,idempotency_key,created_at)
   VALUES (?,?,?,'website','takeaway','pending','pending','queued',?,?,?,?,?,?)`,
   [o.id,'WEB-'+o.id,this.branchId,o.totalMinor/100,o.totalMinor/100,actor,o.customer.phone,'web-'+o.id,o.createdAt]);
  for(const l of o.lines){
   const p=this.one('SELECT product_code,is_active FROM products WHERE product_id=?',[l.posProductId]);
   const size=this.one('SELECT size_code,volume_ml FROM product_sizes WHERE size_id=?',[l.posSizeId]);
   if(p?.product_code!==l.sku||p.is_active!==1||size?.size_code!==sizes[l.size][0]||size.volume_ml!==sizes[l.size][1])throw Error('MAPPING_UNCONFIRMED');
   this.run('INSERT INTO order_items(order_item_id,order_id,product_id,size_id,unit_price,quantity,total_price) VALUES (?,?,?,?,?,?,?)',
    [randomUUID(),o.id,l.posProductId,l.posSizeId,l.unitPriceMinor/100,l.quantity,l.totalMinor/100]);
  }
 }
 prepare(o,eventId){
  this.ensureOrder(o);
  if(o.paymentMethod==='instapay_manual'&&o.paymentStatus!=='paid')throw Error('PAYMENT_REQUIRED');
  const needs=new Map();
  for(const l of o.lines){
   const recipes=this.all("SELECT * FROM recipes WHERE product_id=? AND status='active'",[l.posProductId]);
   if(recipes.length!==1||recipes[0].is_complete!==1||recipes[0].yield_unit!=='ml')throw Error('RECIPE_NOT_READY');
   const r=recipes[0],yieldMl=Number(r.batch_yield_ml);
   if(!Number.isFinite(yieldMl)||yieldMl<=0)throw Error('INVALID_RECIPE_YIELD');
   const rows=this.all('SELECT ri.*,i.base_unit,i.status FROM recipe_ingredients ri JOIN ingredients i ON i.ingredient_id=ri.ingredient_id WHERE ri.recipe_id=?',[r.recipe_id]);
   if(!rows.length)throw Error('RECIPE_NOT_READY');
   for(const item of rows){
    if(item.unit!==item.base_unit||item.status!=='active')throw Error('INGREDIENT_UNIT_MISMATCH');
    const amount=Number(item.quantity)*sizes[l.size][1]/yieldMl*l.quantity;
    if(!Number.isFinite(amount)||amount<=0)throw Error('INVALID_RECIPE_QUANTITY');
    const previous=needs.get(item.ingredient_id);
    if(previous&&previous.unit!==item.unit)throw Error('INGREDIENT_UNIT_MISMATCH');
    needs.set(item.ingredient_id,{quantity:(previous?.quantity??0)+amount,unit:item.unit});
   }
   this.run('UPDATE order_items SET recipe_id=? WHERE order_id=? AND product_id=? AND size_id=?',[r.recipe_id,o.id,l.posProductId,l.posSizeId]);
  }
  let cost=0;const now=new Date().toISOString();
  for(const [id,need] of needs){
   const stock=this.one('SELECT * FROM branch_inventory WHERE branch_id=? AND ingredient_id=?',[this.branchId,id]);
   const quantity=Number(stock?.stock_quantity),unitCost=Number(stock?.weighted_average_cost);
   if(!stock||!Number.isFinite(quantity)||quantity<need.quantity)throw Error('INSUFFICIENT_STOCK');
   if(!Number.isFinite(unitCost)||unitCost<0)throw Error('INVALID_INVENTORY_COST');
   const balance=quantity-need.quantity;cost+=need.quantity*unitCost;
   this.run('UPDATE branch_inventory SET stock_quantity=?,updated_at=? WHERE branch_id=? AND ingredient_id=?',[balance,now,this.branchId,id]);
   this.run(`INSERT INTO inventory_movements(movement_id,branch_id,ingredient_id,movement_type,quantity,unit,unit_cost,total_cost,balance_after,reference_type,reference_id,user_id,idempotency_key,created_at)
    VALUES (?,?,?,'sale_deduction',?,?,?,?,?,'order',?,?,?,?)`,
    [randomUUID(),this.branchId,id,-need.quantity,need.unit,unitCost,need.quantity*unitCost,balance,o.id,'web-bridge','web-'+o.id+'-'+id,now]);
  }
  this.run("UPDATE orders SET preparation_status='preparing',cost_snapshot=? WHERE order_id=?",[cost,o.id]);
  this.run('UPDATE order_items SET is_prepared=1 WHERE order_id=?',[o.id]);
  this.run('UPDATE web_order_inbox SET prepared_receipt=? WHERE order_id=?',['web-stock-'+eventId,o.id]);
 }
 shift(actor){
  const shifts=this.all("SELECT shift_id FROM cashier_shifts WHERE branch_id=? AND cashier_id=? AND status='open'",[this.branchId,actor]);
  if(shifts.length!==1)throw Error('OPEN_CASHIER_SHIFT_REQUIRED');return shifts[0].shift_id;
 }
 payment(o){
  const key='web-payment-'+o.id;
  if(this.one('SELECT 1 FROM payment_records WHERE idempotency_key=?',[key]))return;
  const p=o.payment;
  if(!p?.verifiedBy||p.amountMinor!==o.totalMinor)throw Error('INVALID_PAYMENT_VERIFICATION');
  const shiftId=this.shift(p.verifiedBy),method=o.paymentMethod==='cash'?'cash':'instapay';
  const fee=method==='cash'?0:this.instapayFeeMinor?.(o);
  if(!Number.isSafeInteger(fee)||fee<0||fee>o.totalMinor)throw Error('PAYMENT_FEE_POLICY_REQUIRED');
  const amount=o.totalMinor/100;
  this.run(`INSERT INTO payment_records(payment_id,order_id,shift_id,payment_method,gross_amount,fee_amount,net_amount,reference_number,payment_status,cashier_id,idempotency_key,created_at)
   VALUES (?,?,?,?,?,?,?,?,'verified',?,?,?)`,[randomUUID(),o.id,shiftId,method,amount,fee/100,amount-fee/100,p.reference,p.verifiedBy,key,p.at]);
  if(method==='cash')this.run('UPDATE cashier_shifts SET cash_sales=cash_sales+?,expected_cash=expected_cash+? WHERE shift_id=?',[amount,amount,shiftId]);
  else this.run('UPDATE cashier_shifts SET electronic_sales=electronic_sales+? WHERE shift_id=?',[amount,shiftId]);
  this.run("UPDATE orders SET payment_status='paid',shift_id=?,paid_at=? WHERE order_id=?",[shiftId,p.at,o.id]);
 }
 refund(o){
  if(this.one('SELECT 1 FROM refund_records WHERE refund_id=?',['web-refund-'+o.id]))return;
  const payment=this.one('SELECT * FROM payment_records WHERE idempotency_key=?',['web-payment-'+o.id]);
  if(!payment||!o.refund?.by||o.refund.amountMinor!==o.totalMinor)throw Error('INVALID_REFUND');
  const shiftId=this.shift(o.refund.by),amount=o.totalMinor/100;
  this.run(`INSERT INTO refund_records(refund_id,order_id,payment_id,shift_id,amount,method,reason,approved_by,restock_inventory,created_at) VALUES (?,?,?,?,?,?,?,?,0,?)`,
   ['web-refund-'+o.id,o.id,payment.payment_id,shiftId,amount,payment.payment_method,o.refund.reference,o.refund.by,o.refund.at]);
  if(payment.payment_method==='cash')this.run('UPDATE cashier_shifts SET cash_refunds=cash_refunds+?,expected_cash=expected_cash-? WHERE shift_id=?',[amount,amount,shiftId]);
  this.run("UPDATE payment_records SET payment_status='refunded' WHERE payment_id=?",[payment.payment_id]);
  this.run("UPDATE orders SET payment_status='refunded',order_status='refunded' WHERE order_id=?",[o.id]);
 }
 update(o){
  if(!['pending_store_acceptance','accepted','preparing','ready','handed_off','completed','rejected','cancelled'].includes(o.status))throw Error('INVALID_TRANSITION');
  const exists=this.one('SELECT order_id FROM orders WHERE order_id=?',[o.id]);
  if(!exists&&['rejected','cancelled'].includes(o.status)&&!o.payment)return;
  this.ensureOrder(o);
  if(o.payment)this.payment(o);
  if(o.paymentStatus==='refunded')this.refund(o);
  const status=o.paymentStatus==='refunded'?'refunded':['cancelled','rejected'].includes(o.status)?'cancelled':o.status==='completed'?'completed':'pending';
  const prep={preparing:'preparing',ready:'ready',handed_off:'delivered',completed:'delivered',cancelled:'suspended',rejected:'suspended'}[o.status]||'queued';
  this.run('UPDATE orders SET order_status=?,preparation_status=? WHERE order_id=?',[status,prep,o.id]);
  this.run('INSERT INTO order_status_history(history_id,order_id,new_status,status_type,changed_by,changed_at,notes) VALUES (?,?,?,?,?,?,?)',
   [randomUUID(),o.id,status,'order',o.lastAction?.by||'web-bridge',o.lastAction?.at||new Date().toISOString(),JSON.stringify({webStatus:o.status,wasteReviewRequired:o.wasteReviewRequired===true})]);
 }
}
