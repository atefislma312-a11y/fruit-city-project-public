import test from 'node:test';
import assert from 'node:assert/strict';
import {startPosWorker} from './pos-worker.mjs';
import {posFixture} from './pos-fixture.mjs';
import {OrderWorkflow} from './workflow.mjs';
import {intakeServer} from './http.mjs';
import {pendingBridgeEvents} from './bridge.mjs';

test('cashier polling worker retries a failed writer without losing intake; stop drains work',async t=>{
 const pos=posFixture(),service=new OrderWorkflow(':memory:',[{sku:'PJ01',size:'bottle_500ml',posProductId:'TEST-P',posSizeId:'TEST-S',priceMinor:1250,available:true}]);
 const token='TEST-BRIDGE-'.repeat(4);
 const server=intakeServer(service,{staffTokens:[{id:'TEST-BRIDGE',role:'bridge',token}]});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let worker;
 t.after(async()=>{await worker?.stop();server.closeAllConnections();await new Promise(r=>server.close(r));service.close();pos.close();});
 const q=service.quote({items:[{sku:'PJ01',size:'bottle_500ml',quantity:1}],customer:{phone:'01000000000'},fulfillment:'pickup',paymentMethod:'cash'});
 service.confirm({key:'worker-order',quoteId:q.id,accessToken:q.accessToken,expectedTotalMinor:q.totalMinor});
 let calls=0,sawFailure=false,resolveDone;
 const done=new Promise(r=>resolveDone=r);
 const writer={...pos,transaction:fn=>{calls++;if(calls===2)return Promise.reject(Error('TEST_DISK_FAILURE'));return pos.transaction(fn);}};
 worker=await startPosWorker({writer,token,baseUrl:'http://127.0.0.1:'+server.address().port,intervalMs:100,onStatus:status=>{
  if(!status.ok){sawFailure=true;assert.equal(pendingBridgeEvents(service).length,1);}
  if(status.ok&&status.delivered===1)resolveDone();
 }});
 await Promise.race([done,new Promise((_,reject)=>{const timer=setTimeout(()=>reject(Error('WORKER_TIMEOUT')),3000);timer.unref();})]);
 await worker.stop();assert.equal(sawFailure,true);
 assert.equal(pendingBridgeEvents(service).length,0);
 assert.equal(pos.one('SELECT count(*) n FROM web_order_inbox').n,1);
 assert.equal(pos.one('SELECT count(*) n FROM orders').n,0);
});
