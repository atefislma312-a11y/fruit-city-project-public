import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {pendingBridgeEvents,acknowledgeBridgeEvent} from './bridge.mjs';
import {requestLimit} from './request-limit.mjs';
const equal=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function intakeServer(service,{staffTokens=[],allowedOrigin=null,clock=Date.now,rateLimit={}}={}) {
 for(const s of staffTokens) if(typeof s.token!=='string'||s.token.length<32||!['cashier','manager','bridge'].includes(s.role)) throw Error('INVALID_STAFF_CONFIG');
 if(new Set(staffTokens.map(s=>s.token)).size!==staffTokens.length||staffTokens.some(s=>typeof s.id!=='string'||!s.id.trim()))throw Error('INVALID_STAFF_CONFIG');
 const admit=requestLimit({...rateLimit,clock});
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  try {
   const budget=admit(req.socket.remoteAddress??'unknown');
   if(!budget.allowed){res.setHeader('Retry-After',String(budget.retryAfter));return reply(429,{error:'RATE_LIMITED'});}
   // Local test API: no cross-origin browser access or cookies.
   if(req.headers.origin&&req.headers.origin!==allowedOrigin) return reply(403,{error:'ORIGIN_NOT_ALLOWED'});
   const path=req.url?.split('?')[0];
   const staff=staffTokens.find(s=>s.revoked!==true&&(s.expiresAt===undefined||(Number.isFinite(s.expiresAt)&&s.expiresAt>clock()))&&equal(req.headers.authorization||'','Bearer '+s.token));
   if(path?.startsWith('/bridge/')&&staff?.role!=='bridge')return reply(403,{error:'FORBIDDEN'});
   if(req.method==='GET'&&path==='/bridge/events')return reply(200,{events:pendingBridgeEvents(service)});
   if(req.method==='GET'&&path==='/staff/session'){
    if(!staff||staff.role==='bridge')return reply(401,{error:'UNAUTHORIZED'});
    return reply(200,{id:staff.id,role:staff.role,accepting:service.accepting()});
   }
   if(req.method==='GET'&&path==='/staff/orders') {
    if(!staff||staff.role==='bridge') return reply(401,{error:'UNAUTHORIZED'});
    return reply(200,{orders:service.inbox()});
   }
   if(path==='/staff/commands'&&(!staff||staff.role==='bridge')) return reply(401,{error:'UNAUTHORIZED'});
   if(req.method==='GET'&&path?.startsWith('/orders/')) return reply(200,service.get(path.slice(8),(req.headers.authorization||'').replace(/^Bearer /,'')));
   if(req.method!=='POST'||!['/quotes','/orders','/staff/commands','/bridge/ack'].includes(path)) return reply(404,{error:'NOT_FOUND'});
   if(req.headers['content-type']!=='application/json') return reply(415,{error:'JSON_REQUIRED'});
   let body='',length=0;
   for await(const chunk of req){length+=chunk.length;if(length>16384){reply(413,{error:'BODY_TOO_LARGE'});return;}body+=chunk;}
   let input;try{input=JSON.parse(body);}catch{return reply(400,{error:'INVALID_JSON'});}
   if(!input||typeof input!=='object'||Array.isArray(input))return reply(400,{error:'INVALID_BODY'});
   const result=path==='/bridge/ack'?acknowledgeBridgeEvent(service,staff,input):path==='/quotes'?service.quote(input):path==='/staff/commands'?service.command({id:staff.id,role:staff.role},input):service.confirm(input);
   reply(result.replayed?200:201,result);
  } catch(e) {
   const code=e.message;
   const expected=/^(INVALID_|UNKNOWN_|UNAVAILABLE|AMBIGUOUS_|PRICE_|MAPPING_|QUOTE_|TOTAL_|IDEMPOTENCY_|DELIVERY_|FORBIDDEN|ORDER_NOT_FOUND|STORE_CLOSED|REVISION_|PREPARATION_|PAYMENT_REQUIRED)/.test(code);
   reply(code==='FORBIDDEN'?403:expected?409:500,{error:expected?code:'INTERNAL_ERROR'});
  }
 });
 server.requestTimeout=10000;server.headersTimeout=5000;
 return server;
}
