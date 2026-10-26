// Entirely synthetic loopback demo: both order and POS databases are in memory.
import {OrderWorkflow} from './workflow.mjs';
import {intakeServer} from './http.mjs';
import {PosOrderBridge} from './pos-bridge.mjs';
import {posFixture} from './pos-fixture.mjs';
import {pendingBridgeEvents,acknowledgeBridgeEvent} from './bridge.mjs';
if(process.env.FC_DEMO!=='1'||process.env.FC_TEST_SCHEMA)throw Error('SYNTHETIC_DEMO_REQUIRED');
const token=process.env.FC_TEST_STAFF_TOKEN;
if(!token||token.length<32)throw Error('EXPLICIT_TEST_TOKEN_REQUIRED');
const pos=posFixture(),receiver=new PosOrderBridge(pos);await receiver.initialize();
const service=new OrderWorkflow(':memory:',[{sku:'PJ01',size:'bottle_500ml',posProductId:'TEST-P',posSizeId:'TEST-S',priceMinor:1250,available:true}],{preparationApproved:true});
const server=intakeServer(service,{staffTokens:[{id:'TEST-MANAGER',role:'manager',token}],allowedOrigin:'http://127.0.0.1:5176'});
let running=false;
const timer=setInterval(async()=>{if(running)return;running=true;try{for(const event of pendingBridgeEvents(service)){const receipt=await receiver.receive(event);acknowledgeBridgeEvent(service,{id:'TEST-BRIDGE',role:'bridge'},receipt);}}catch{/* Keep pending. UI shows incomplete synchronization. */}finally{running=false;}},300);
server.listen(5180,'127.0.0.1',()=>console.log('Synthetic integrated demo on loopback 5180; mango 500ml only.'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>{clearInterval(timer);server.close(()=>{service.close();pos.close();process.exit(0);});});
