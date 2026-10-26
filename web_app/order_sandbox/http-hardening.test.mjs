import test from 'node:test';
import assert from 'node:assert/strict';
import {requestLimit} from './request-limit.mjs';
import {intakeServer} from './http.mjs';
import {OrderWorkflow} from './workflow.mjs';
import {request} from 'node:http';

test('bounded limiter rejects floods and new clients at capacity then expires',()=>{
 let now=0;const admit=requestLimit({clock:()=>now,windowMs:1000,limit:2,maxClients:1});
 assert.equal(admit('a').allowed,true);assert.equal(admit('a').allowed,true);
 assert.equal(admit('a').allowed,false);assert.equal(admit('b').allowed,false);
 now=1000;assert.equal(admit('b').allowed,true);
 assert.throws(()=>requestLimit({limit:0}),/INVALID_RATE_CONFIG/);
});

test('HTTP preserves split Arabic UTF-8 and rejects malformed encoding before service call',async t=>{
 let received,calls=0;
 const server=intakeServer({quote:input=>{calls++;received=input;return {ok:true};}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
 const send=chunks=>new Promise((resolve,reject)=>{
  const req=request({host:'127.0.0.1',port:server.address().port,path:'/quotes',method:'POST',headers:{'Content-Type':'application/json'}},res=>{
   res.resume();res.on('end',()=>resolve(res.statusCode));
  });req.on('error',reject);
  let i=0;const write=()=>{if(i===chunks.length)return req.end();req.write(chunks[i++]);setTimeout(write,5);};write();
 });
 const value={name:'القصر العيني'},bytes=Buffer.from(JSON.stringify(value));
 assert.equal(await send(Array.from(bytes,b=>Buffer.from([b]))),201);
 assert.deepEqual(received,value);
 assert.equal(await send([Buffer.from([0x7b,0x22,0x78,0x22,0x3a,0x22,0xff,0x22,0x7d])]),400);
 assert.equal(calls,1);
});

test('HTTP limits concurrent requests despite forged proxy IP and recovers after window',async t=>{
 let now=0;const service=new OrderWorkflow(':memory:',[]);
 const server=intakeServer(service,{clock:()=>now,rateLimit:{limit:3,windowMs:1000}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));service.close();});
 const url='http://127.0.0.1:'+server.address().port;
 const replies=await Promise.all(Array.from({length:12},(_,i)=>fetch(url+'/staff/session',{headers:{'X-Forwarded-For':'192.0.2.'+i}})));
 assert.equal(replies.filter(r=>r.status===401).length,3);
 assert.equal(replies.filter(r=>r.status===429).length,9);
 assert.equal(replies.find(r=>r.status===429).headers.get('retry-after'),'1');
 now=1000;assert.equal((await fetch(url+'/staff/session')).status,401);
});

test('bridge credentials cannot call staff commands; malformed bodies and duplicate credentials fail closed',async t=>{
 const service=new OrderWorkflow(':memory:',[]);
 const staff={id:'TEST-BRIDGE',role:'bridge',token:'TEST-BRIDGE-'.repeat(4)};
 assert.throws(()=>intakeServer(service,{staffTokens:[staff,{...staff,role:'manager'}]}),/INVALID_STAFF_CONFIG/);
 const server=intakeServer(service,{staffTokens:[staff]});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));service.close();});
 const url='http://127.0.0.1:'+server.address().port;
 const headers={'Content-Type':'application/json',Authorization:'Bearer '+staff.token};
 assert.equal((await fetch(url+'/staff/commands',{method:'POST',headers,body:'{}'})).status,401);
 for(const body of ['null','[]','1','"text"'])assert.equal((await fetch(url+'/quotes',{method:'POST',headers,body})).status,400);
 assert.equal(service.accepting(),true);
});
