// In-process abuse guard. Proxy headers are deliberately not trusted.
export function requestLimit({windowMs=60000,limit=600,maxClients=4096,clock=Date.now}={}) {
 for(const value of [windowMs,limit,maxClients])if(!Number.isSafeInteger(value)||value<1)throw Error('INVALID_RATE_CONFIG');
 const clients=new Map();
 return address=>{
  const now=clock();
  for(const [key,value] of clients)if(value.until<=now)clients.delete(key);
  let entry=clients.get(address);
  if(!entry){
   if(clients.size>=maxClients)return {allowed:false,retryAfter:Math.max(1,Math.ceil(windowMs/1000))};
   entry={count:0,until:now+windowMs};clients.set(address,entry);
  }
  return {allowed:++entry.count<=limit,retryAfter:Math.max(1,Math.ceil((entry.until-now)/1000))};
 };
}
