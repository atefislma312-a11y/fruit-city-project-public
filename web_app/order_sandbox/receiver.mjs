import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
// Isolated durable receiving contract. Not a sale and never an inventory write.
export class OrderReceiver {
 constructor(path,branchId){
  if(!branchId)throw Error('INVALID_BRANCH');this.branchId=branchId;
  this.db=new DatabaseSync(path);this.db.exec('PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS received_orders(event_id TEXT PRIMARY KEY,order_id TEXT UNIQUE NOT NULL,fingerprint TEXT NOT NULL,snapshot TEXT NOT NULL,received_at TEXT NOT NULL)');
 }
 receive(event){
  const o=event?.order;
  if(typeof event?.eventId!=='string'||!event.eventId||typeof o?.id!=='string'||!o.id||o.branchId!==this.branchId||o.status!=='pending_store_acceptance'||o.paymentStatus!=='unpaid'||o.accessToken!==undefined)throw Error('INVALID_ENVELOPE');
  const snapshot=JSON.stringify(o),fingerprint=createHash('sha256').update(snapshot).digest('hex');
  this.db.exec('BEGIN IMMEDIATE');
  try{
   const prior=this.db.prepare('SELECT * FROM received_orders WHERE event_id=? OR order_id=?').all(event.eventId,o.id);
   if(prior.length){if(prior.length!==1||prior[0].event_id!==event.eventId||prior[0].order_id!==o.id||prior[0].fingerprint!==fingerprint)throw Error('IDEMPOTENCY_CONFLICT');}
   else this.db.prepare('INSERT INTO received_orders VALUES (?,?,?,?,?)').run(event.eventId,o.id,fingerprint,snapshot,new Date().toISOString());
   this.db.exec('COMMIT');return {eventId:event.eventId,orderId:o.id};
  }catch(e){if(this.db.isTransaction)this.db.exec('ROLLBACK');throw e;}
 }
 count(){return this.db.prepare('SELECT count(*) n FROM received_orders').get().n;}
 close(){this.db.close();}
}
