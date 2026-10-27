import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createServer} from 'node:http';
import {posSessions,cashierRouteAllowed} from './pos-sessions.mjs';
import {requestLimit} from './request-limit.mjs';

test('actual development cashier route requires session and denies cross-origin and wrong-role access',
 {skip:!process.env.FC_POS_RUNTIME},async t=>{
 const root=path.resolve(process.env.FC_POS_RUNTIME);
 assert.equal(root,path.resolve(import.meta.dirname,'../../development/pos_inventory_repair'));
 const source=fs.readFileSync(path.join(root,'server.js'),'utf8');
 const start=source.indexOf('const cashierSessions=');
 const end=source.indexOf('// 5. SERVER CREATION',start);
 assert.ok(start>0&&end>start);
 const user={user_id:'TEST',role_id:'role_cashier',is_active:1,password_hash:'SYNTHETIC',username:'test'};
 const context=vm.createContext({posSessions,cashierRouteAllowed,requestLimit,URL,process:{env:{}},console,
  syncDatabaseWithDisk:()=>{},queryOne:()=>user,queryAll:()=>[{permission_code:'pos:create_order'}],
  checkIsFirstRun:()=>false,verifyArgon2id:async password=>password==='TEST-PASSWORD',
  parseJsonBody:async req=>{let body='';for await(const c of req)body+=c;return JSON.parse(body);},
  sendJson:(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(body));}
 });
 vm.runInContext(source.slice(start,end),context);
 const server=createServer((req,res)=>{context.handleApiRequest(req,res,{}).catch(()=>{res.writeHead(500);res.end();});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));});
 const base='http://127.0.0.1:'+server.address().port;
 const login=password=>fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'test',password})});
 assert.equal((await fetch(base+'/api/state')).status,401);
 assert.equal((await login('WRONG')).status,401);
 const logged=await login('TEST-PASSWORD');assert.equal(logged.status,200);
 const cookie=logged.headers.get('set-cookie').split(';')[0];
 assert.equal((await fetch(base+'/api/admin/report',{headers:{Cookie:cookie}})).status,403);
 assert.equal((await fetch(base+'/api/state',{headers:{Cookie:cookie}})).status,403);
 assert.equal((await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie,Origin:'https://untrusted.example'}})).status,403);
 assert.equal((await fetch(base+'/api/auth/logout',{method:'POST',headers:{Cookie:cookie}})).status,200);
 assert.equal((await fetch(base+'/api/state',{headers:{Cookie:cookie}})).status,401);
});
