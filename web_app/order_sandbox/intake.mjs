import {randomUUID,createHash,timingSafeEqual} from 'node:crypto';
import {OrderSandbox} from './service.mjs';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const token=()=>randomUUID()+randomUUID();
const same=(a,b)=>typeof a==='string'&&typeof b==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));

// Isolated intake extension. No imports, network calls or writes to the POS.
export class OrderIntake extends OrderSandbox {
 constructor(database,catalog,{clock=Date.now,quoteTtlMs=300000,branchId='TEST-BRANCH'}={}) {
  super(database,catalog);this.clock=clock;this.quoteTtlMs=quoteTtlMs;this.branchId=branchId;
  this.db.exec(`CREATE TABLE IF NOT EXISTS intake_quotes(id TEXT PRIMARY KEY,snapshot TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS intake_confirmations(request_key TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,quote_id TEXT UNIQUE NOT NULL,order_id TEXT UNIQUE NOT NULL);
   CREATE TABLE IF NOT EXISTS intake_outbox(id TEXT PRIMARY KEY,order_id TEXT NOT NULL,kind TEXT NOT NULL,payload TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,acked INTEGER NOT NULL DEFAULT 0);
   CREATE TABLE IF NOT EXISTS intake_events(id TEXT PRIMARY KEY,order_id TEXT NOT NULL,actor TEXT NOT NULL,event TEXT NOT NULL,created_at TEXT NOT NULL);`);
 }
 quote(input) {
  // Delivery cannot silently proceed without approved coordinates and fees.
  if(input?.fulfillment!=='pickup') throw Error('DELIVERY_NOT_CONFIGURED');
  if(!['cash','instapay_manual'].includes(input.paymentMethod)) throw Error('INVALID_PAYMENT_METHOD');
  const lines=this.price(input.items);
  const quote={id:randomUUID(),accessToken:token(),branchId:this.branchId,currency:'EGP',
   lines,totalMinor:lines.reduce((n,l)=>n+l.totalMinor,0),fulfillment:'pickup',paymentMethod:input.paymentMethod,
   createdAt:new Date(this.clock()).toISOString(),expiresAt:this.clock()+this.quoteTtlMs};
  this.db.prepare('INSERT INTO intake_quotes VALUES (?,?)').run(quote.id,JSON.stringify(quote));return quote;
 }
 confirm(input) {
  if(!input||typeof input.key!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(input.key)) throw Error('INVALID_KEY');
  if(typeof input.quoteId!=='string'||typeof input.accessToken!=='string'||!Number.isSafeInteger(input.expectedTotalMinor)) throw Error('INVALID_CONFIRMATION');
  const row=this.db.prepare('SELECT snapshot FROM intake_quotes WHERE id=?').get(input.quoteId);
  if(!row) throw Error('QUOTE_NOT_FOUND');
  const quote=JSON.parse(row.snapshot);
  if(!same(input.accessToken,quote.accessToken)) throw Error('FORBIDDEN');
  const fingerprint=hash({quoteId:input.quoteId,total:input.expectedTotalMinor});
  this.db.exec('BEGIN IMMEDIATE');
  try {
   const replay=this.db.prepare('SELECT * FROM intake_confirmations WHERE request_key=?').get(input.key);
   if(replay) {
    if(replay.fingerprint!==fingerprint) throw Error('IDEMPOTENCY_CONFLICT');
    const order=this.get(replay.order_id,quote.accessToken);this.db.exec('COMMIT');return {...order,replayed:true};
   }
   if(this.db.prepare('SELECT 1 FROM intake_confirmations WHERE quote_id=?').get(quote.id)) throw Error('QUOTE_ALREADY_CONFIRMED');
   if(quote.expiresAt<=this.clock()) throw Error('QUOTE_EXPIRED');
   if(input.expectedTotalMinor!==quote.totalMinor) throw Error('TOTAL_MISMATCH');
   // A catalog change requires a fresh quote and explicit customer confirmation.
   const lines=this.price(quote.lines.map(l=>({sku:l.sku,size:l.size,quantity:l.quantity})));
   if(hash(lines)!==hash(quote.lines)) throw Error('QUOTE_CHANGED');
   const order={id:randomUUID(),source:'web',branchId:quote.branchId,status:'pending_store_acceptance',paymentStatus:'unpaid',settlementStatus:'unsettled',
    paymentMethod:quote.paymentMethod,fulfillment:quote.fulfillment,currency:quote.currency,lines:quote.lines,totalMinor:quote.totalMinor,
    createdAt:new Date(this.clock()).toISOString(),accessToken:quote.accessToken};
   this.db.prepare('INSERT INTO incoming_orders VALUES (?,?,?,?)').run(order.id,input.key,fingerprint,JSON.stringify(order));
   this.db.prepare('INSERT INTO intake_confirmations VALUES (?,?,?,?)').run(input.key,fingerprint,quote.id,order.id);
   this.db.prepare('INSERT INTO intake_events VALUES (?,?,?,?,?)').run(randomUUID(),order.id,'customer','submitted',order.createdAt);
   // Outbox is saved atomically. A failed notification cannot erase the order.
   const {accessToken,...safeOrder}=order;
   this.db.prepare('INSERT INTO intake_outbox(id,order_id,kind,payload) VALUES (?,?,?,?)').run(randomUUID(),order.id,'incoming_order',JSON.stringify(safeOrder));
   this.db.exec('COMMIT');return {...order,replayed:false};
  }catch(e){if(this.db.isTransaction)this.db.exec('ROLLBACK');throw e;}
 }
 get(id,accessToken) {
  const row=this.db.prepare('SELECT snapshot FROM incoming_orders WHERE id=?').get(id);
  if(!row) throw Error('ORDER_NOT_FOUND');const order=JSON.parse(row.snapshot);
  if(!same(accessToken,order.accessToken)) throw Error('FORBIDDEN');return order;
 }
 inbox(){return this.db.prepare('SELECT snapshot FROM incoming_orders ORDER BY rowid DESC LIMIT 100').all().map(r=>{const {accessToken,...o}=JSON.parse(r.snapshot);return o;});}
 // Caller supplies an isolated receiver; no production URL or background worker.
 async deliver(send) {
  const pending=this.db.prepare("SELECT * FROM intake_outbox WHERE acked=0 AND kind='incoming_order' ORDER BY rowid LIMIT 100").all();
  for(const e of pending){
   this.db.prepare('UPDATE intake_outbox SET attempts=attempts+1 WHERE id=?').run(e.id);
   try {const ack=await send({eventId:e.id,order:JSON.parse(e.payload)});
    if(ack?.eventId===e.id&&ack?.orderId===e.order_id) this.db.prepare('UPDATE intake_outbox SET acked=1 WHERE id=?').run(e.id);
   }catch{/* Retain event for an explicit later retry. */}
  }
 }
}
