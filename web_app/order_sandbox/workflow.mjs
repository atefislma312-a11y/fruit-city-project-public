import {randomUUID} from 'node:crypto';
import {OrderIntake} from './intake.mjs';
const terminal=new Set(['completed','rejected','cancelled']);
const transitions={pending_store_acceptance:['accepted','rejected','cancelled'],accepted:['cancelled'],preparing:['ready','cancelled'],ready:['handed_off','cancelled'],handed_off:['completed']};
export class OrderWorkflow extends OrderIntake {
 constructor(database,catalog,options={}) {
  super(database,catalog,options);this.preparationApproved=options.preparationApproved===true;
  this.db.exec(`CREATE TABLE IF NOT EXISTS workflow_commands(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,result TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS workflow_payment_refs(reference TEXT PRIMARY KEY,order_id TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS workflow_settings(id INTEGER PRIMARY KEY CHECK(id=1),accepting INTEGER NOT NULL);
   INSERT OR IGNORE INTO workflow_settings VALUES(1,1);`);
 }
 quote(input){if(!this.accepting())throw Error('STORE_CLOSED');return super.quote(input);}
 confirm(input){
  // Allow retries of saved orders even when the shop has since closed.
  if(!this.accepting()&&!this.db.prepare('SELECT 1 FROM intake_confirmations WHERE request_key=?').get(input?.key??''))throw Error('STORE_CLOSED');
  return super.confirm(input);
 }
 accepting(){return this.db.prepare('SELECT accepting FROM workflow_settings WHERE id=1').get().accepting===1;}
 command(actor,input) {
  if(!actor?.id||!['manager','cashier','bridge'].includes(actor.role))throw Error('FORBIDDEN');
  if(!input||typeof input.key!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(input.key))throw Error('INVALID_KEY');
  const fingerprint=JSON.stringify({actor,input});
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const prior=this.db.prepare('SELECT * FROM workflow_commands WHERE id=?').get(input.key);
   if(prior){if(prior.fingerprint!==fingerprint)throw Error('IDEMPOTENCY_CONFLICT');this.db.exec('COMMIT');return JSON.parse(prior.result);}
   const row=this.db.prepare('SELECT snapshot FROM incoming_orders WHERE id=?').get(input.orderId??'');
   const order=row?JSON.parse(row.snapshot):null;
   const now=new Date(this.clock()).toISOString();
   if(input.action==='intake'){
    if(actor.role!=='manager')throw Error('FORBIDDEN');
    if(typeof input.accepting!=='boolean')throw Error('INVALID_SETTING');
    this.db.prepare('UPDATE workflow_settings SET accepting=? WHERE id=1').run(Number(input.accepting));
   }else{
    if(!order)throw Error('ORDER_NOT_FOUND');
    if(input.revision!==(order.revision??0))throw Error('REVISION_CONFLICT');
    if(input.action==='status'){
     if(actor.role==='bridge')throw Error('FORBIDDEN');
     if(!transitions[order.status]?.includes(input.status))throw Error('INVALID_TRANSITION');
     if(['cancelled','rejected'].includes(input.status)&&(!input.reason||typeof input.reason!=='string'||input.reason.length>500))throw Error('INVALID_REASON');
     if(order.preparationPending)throw Error('PREPARATION_PENDING');
     if(input.status==='cancelled'&&['preparing','ready'].includes(order.status)){
      if(actor.role!=='manager')throw Error('FORBIDDEN');
      order.wasteReviewRequired=true; // Never restore ingredients after preparation.
     }
     if(input.status==='completed'&&order.paymentStatus!=='paid')throw Error('PAYMENT_REQUIRED');
     if(['rejected','cancelled'].includes(input.status)&&order.paymentStatus==='paid')order.paymentStatus='refund_pending';
     order.status=input.status;
    }else if(input.action==='prepare'){
     if(actor.role==='bridge')throw Error('FORBIDDEN');
     if(!this.preparationApproved)throw Error('PREPARATION_POLICY_REQUIRED');
     if(order.status!=='accepted'||order.preparationPending)throw Error('INVALID_TRANSITION');
     if(order.paymentMethod==='instapay_manual'&&order.paymentStatus!=='paid')throw Error('PAYMENT_REQUIRED');
     order.preparationPending=true;order.preparationCommandId=randomUUID();
     const {accessToken,...payload}=order;
     this.db.prepare('INSERT INTO intake_outbox(id,order_id,kind,payload) VALUES (?,?,?,?)').run(order.preparationCommandId,order.id,'prepare_inventory',JSON.stringify(payload));
    }else if(input.action==='inventory_ack'){
     if(actor.role!=='bridge')throw Error('FORBIDDEN');
     if(!order.preparationPending||order.status!=='accepted'||input.commandId!==order.preparationCommandId)throw Error('INVALID_ACK');
     if(typeof input.receiptId!=='string'||input.receiptId.length<8||input.receiptId.length>100)throw Error('INVALID_ACK');
     order.inventoryReceiptId=input.receiptId;order.preparationPending=false;order.status='preparing';
     this.db.prepare('UPDATE intake_outbox SET acked=1 WHERE id=?').run(input.commandId);
    }else if(input.action==='payment'){
     if(actor.role==='bridge'||terminal.has(order.status)||order.paymentStatus!=='unpaid')throw Error('INVALID_PAYMENT_STATE');
     if(input.amountMinor!==order.totalMinor||input.verified!==true||typeof input.reference!=='string'||!input.reference.trim()||input.reference.length>100)throw Error('INVALID_PAYMENT_VERIFICATION');
     if(order.paymentMethod==='instapay_manual'&&actor.role!=='manager')throw Error('FORBIDDEN');
     if(order.paymentMethod==='instapay_manual'){
      if(this.db.prepare('SELECT 1 FROM workflow_payment_refs WHERE reference=?').get(input.reference.trim()))throw Error('INVALID_DUPLICATE_PAYMENT');
      this.db.prepare('INSERT INTO workflow_payment_refs VALUES (?,?)').run(input.reference.trim(),order.id);
     }
     order.paymentStatus='paid';order.payment={verifiedBy:actor.id,at:now,reference:input.reference,amountMinor:input.amountMinor};
    }else if(input.action==='settle'){
     if(actor.role!=='manager')throw Error('FORBIDDEN');
     if(order.paymentStatus!=='paid'||input.verified!==true||!input.reference||typeof input.reference!=='string'||input.reference.length>100)throw Error('INVALID_SETTLEMENT');
     order.settlementStatus='settled';order.settlement={by:actor.id,at:now,reference:input.reference};
    }else if(input.action==='refund'){
     if(actor.role!=='manager')throw Error('FORBIDDEN');
     if(order.paymentStatus!=='refund_pending'||input.verified!==true||input.amountMinor!==order.totalMinor||typeof input.reference!=='string'||!input.reference.trim())throw Error('INVALID_REFUND');
     order.paymentStatus='refunded';order.settlementStatus='refund_review';order.refund={by:actor.id,at:now,reference:input.reference,amountMinor:input.amountMinor};
    }else throw Error('INVALID_ACTION');
    order.revision=(order.revision??0)+1;
    order.lastAction={action:input.action,by:actor.id,at:now,reason:input.reason??null};
    this.db.prepare('UPDATE incoming_orders SET snapshot=? WHERE id=?').run(JSON.stringify(order),order.id);
    if(input.action!=='prepare'){
     const {accessToken,...payload}=order;
     this.db.prepare('INSERT INTO intake_outbox(id,order_id,kind,payload) VALUES (?,?,?,?)').run(randomUUID(),order.id,'order_update',JSON.stringify(payload));
    }
   }
   this.db.prepare('INSERT INTO intake_events VALUES (?,?,?,?,?)').run(randomUUID(),order?.id??'store',actor.id,JSON.stringify({action:input.action,status:input.status,reason:input.reason,role:actor.role}),now);
   const {accessToken,...safeOrder}=order??{};const result=order?safeOrder:{accepting:this.accepting()};
   this.db.prepare('INSERT INTO workflow_commands VALUES (?,?,?)').run(input.key,fingerprint,JSON.stringify(result));
   this.db.exec('COMMIT');return result;
  }catch(e){if(this.db.isTransaction)this.db.exec('ROLLBACK');throw e;}
 }
}
