// POS pulls from the intake service; the shop does not need an inbound Internet port.
import {createHash} from 'node:crypto';

export function pendingBridgeEvents(service) {
 return service.db.prepare('SELECT id,kind,payload FROM intake_outbox WHERE acked=0 ORDER BY rowid LIMIT 100').all()
  .map(row=>({eventId:row.id,kind:row.kind,order:JSON.parse(row.payload)}));
}

export function acknowledgeBridgeEvent(service,actor,input) {
 if(actor?.role!=='bridge')throw Error('FORBIDDEN');
 const row=service.db.prepare('SELECT * FROM intake_outbox WHERE id=?').get(input?.eventId??'');
 if(!row||row.order_id!==input.orderId)throw Error('INVALID_ACK');
 if(row.acked)return {eventId:row.id,orderId:row.order_id,acknowledged:true};
 if(row.kind==='prepare_inventory') {
  const order=JSON.parse(service.db.prepare('SELECT snapshot FROM incoming_orders WHERE id=?').get(row.order_id).snapshot);
  service.command(actor,{key:'ack-'+row.id,orderId:row.order_id,revision:order.revision??0,
   action:'inventory_ack',commandId:row.id,receiptId:input.receiptId});
 }else service.db.prepare('UPDATE intake_outbox SET acked=1 WHERE id=?').run(row.id);
 return {eventId:row.id,orderId:row.order_id,acknowledged:true};
}

export function bridgeClient({baseUrl,token,receive,fetchImpl=fetch}) {
 const url=new URL(baseUrl);
 if(url.username||url.password||url.search||url.hash||!(url.protocol==='https:'||(url.protocol==='http:'&&['127.0.0.1','[::1]'].includes(url.hostname))))throw Error('INVALID_BRIDGE_URL');
 if(typeof token!=='string'||token.length<32)throw Error('INVALID_BRIDGE_TOKEN');
 let running=false;
 const request=async(path,body)=>{
  const response=await fetchImpl(baseUrl.replace(/\/$/,'')+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(10000),
   headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw Error('BRIDGE_HTTP_'+response.status);
  return response.json();
 };
 return async function tick() {
  if(running)return {busy:true};running=true;
  try {
   const {events}=await request('/bridge/events');let delivered=0;
   if(!Array.isArray(events))throw Error('INVALID_BRIDGE_RESPONSE');
   // Stop on the first failure: a preparation may never overtake its intake event.
   for(const event of events){const receipt=await receive(event);
    if(receipt?.eventId!==event.eventId||receipt?.orderId!==event.order.id)throw Error('INVALID_BRIDGE_RECEIPT');
    await request('/bridge/ack',receipt);delivered++;
   }
   return {delivered};
  }finally{running=false;}
 };
}

export const eventFingerprint=event=>createHash('sha256').update(JSON.stringify(event)).digest('hex');
