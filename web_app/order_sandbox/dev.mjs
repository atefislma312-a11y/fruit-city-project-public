// Explicit demo only. This launcher never loads the POS or real prices.
import {OrderWorkflow} from './workflow.mjs';
import {intakeServer} from './http.mjs';
if(process.env.FC_DEMO!=='1')throw Error('Set FC_DEMO=1 for synthetic data only');
const catalog=['cup_16oz','bottle_500ml','bottle_1l'].map(size=>({sku:'PJ01',size,posProductId:'TEST-P',posSizeId:'TEST-'+size,priceMinor:1250,available:true}));
const service=new OrderWorkflow(':memory:',catalog,{preparationApproved:true});
const staffTokens=process.env.FC_TEST_STAFF_TOKEN?[{id:'TEST-MANAGER',role:'manager',token:process.env.FC_TEST_STAFF_TOKEN}]:[];
const server=intakeServer(service,{staffTokens,allowedOrigin:'http://127.0.0.1:5176'});
server.listen(5180,'127.0.0.1',()=>console.log('Synthetic API ready on loopback 5180; no POS connected.'));
for(const event of ['SIGINT','SIGTERM'])process.on(event,()=>server.close(()=>{service.close();process.exit(0);}));
