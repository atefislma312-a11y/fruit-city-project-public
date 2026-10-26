import {PosOrderBridge} from './pos-bridge.mjs';
import {bridgeClient} from './bridge.mjs';

// Runs inside the cashier process using its existing writer and transaction queue.
export async function startPosWorker({writer,baseUrl,token,intervalMs=1000,onStatus=()=>{}}) {
 if(!Number.isSafeInteger(intervalMs)||intervalMs<100)throw Error('INVALID_POLL_INTERVAL');
 const receiver=new PosOrderBridge(writer);
 const tick=bridgeClient({baseUrl,token,receive:event=>receiver.receive(event)});
 await receiver.initialize();
 let stopped=false,timer,inFlight=Promise.resolve(),failures=0;
 const report=value=>{try{onStatus(value);}catch{/* Observability must not lose or duplicate orders. */}};
 const poll=async()=>{
  try{const result=await tick();failures=0;report({ok:true,delivered:result.delivered??0});}
  catch{failures++;report({ok:false,failures});}
  if(!stopped){timer=setTimeout(run,Math.min(30000,intervalMs*2**Math.min(failures,5)));timer.unref?.();}
 };
 const run=()=>{if(!stopped)inFlight=poll();};
 run();
 return {stop:async()=>{stopped=true;clearTimeout(timer);await inFlight;}};
}
