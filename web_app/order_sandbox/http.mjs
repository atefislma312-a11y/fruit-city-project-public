import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
const equal=(a,b)=>typeof a==='string'&&Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function intakeServer(service,{staffTokens=[]}={}) {
 for(const s of staffTokens) if(typeof s.token!=='string'||s.token.length<32||!['cashier','manager'].includes(s.role)) throw Error('INVALID_STAFF_CONFIG');
 const server=createServer(async(req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  try {
   // Local test API: no cross-origin browser access or cookies.
   if(req.headers.origin) return reply(403,{error:'ORIGIN_NOT_ALLOWED'});
   const path=req.url?.split('?')[0];
   if(req.method==='GET'&&path==='/staff/orders') {
    const auth=req.headers.authorization||'';
    if(!staffTokens.some(s=>equal(auth,'Bearer '+s.token))) return reply(401,{error:'UNAUTHORIZED'});
    return reply(200,{orders:service.inbox()});
   }
   if(req.method==='GET'&&path?.startsWith('/orders/')) return reply(200,service.get(path.slice(8),(req.headers.authorization||'').replace(/^Bearer /,'')));
   if(req.method!=='POST'||!['/quotes','/orders'].includes(path)) return reply(404,{error:'NOT_FOUND'});
   if(req.headers['content-type']!=='application/json') return reply(415,{error:'JSON_REQUIRED'});
   let body='',length=0;
   for await(const chunk of req){length+=chunk.length;if(length>16384){reply(413,{error:'BODY_TOO_LARGE'});return;}body+=chunk;}
   let input;try{input=JSON.parse(body);}catch{return reply(400,{error:'INVALID_JSON'});}
   const result=path==='/quotes'?service.quote(input):service.confirm(input);
   reply(result.replayed?200:201,result);
  } catch(e) {
   const code=e.message;
   const expected=/^(INVALID_|UNKNOWN_|UNAVAILABLE|AMBIGUOUS_|PRICE_|MAPPING_|QUOTE_|TOTAL_|IDEMPOTENCY_|DELIVERY_|FORBIDDEN|ORDER_NOT_FOUND)/.test(code);
   reply(code==='FORBIDDEN'?403:expected?409:500,{error:expected?code:'INTERNAL_ERROR'});
  }
 });
 server.requestTimeout=10000;server.headersTimeout=5000;
 return server;
}
