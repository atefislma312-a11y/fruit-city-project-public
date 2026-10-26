import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {pathToFileURL} from 'node:url';
import {posFixture} from './pos-fixture.mjs';
import {PosOrderBridge} from './pos-bridge.mjs';
import {OrderWorkflow} from './workflow.mjs';
import {pendingBridgeEvents,acknowledgeBridgeEvent} from './bridge.mjs';

// Execute the real development server's database functions only. Never import
// the server entrypoint: that would open its configured database and listener.
test('development cashier functions persist bridge preparation once and restore memory on disk failure',
 {skip:!process.env.FC_SQLJS_MODULE||!process.env.FC_POS_RUNTIME},async()=>{
 const root=path.resolve(process.env.FC_POS_RUNTIME);
 assert.equal(root,path.resolve(import.meta.dirname,'../../development/pos_inventory_repair'));
 const source=fs.readFileSync(path.join(root,'server.js'),'utf8');
 const start=source.indexOf('function saveDatabase()');
 const end=source.indexOf('// ---------------------------------------------------------------------------',start);
 assert.ok(start>0&&end>start);
 assert.equal((source.match(/(?<!await )runTransaction\(\(\) =>/g)||[]).length,0,'all request transactions must be awaited');
 const {default:init}=await import(pathToFileURL(process.env.FC_SQLJS_MODULE));const SQL=await init();
 const {saveDatabaseAtomic}=await import(pathToFileURL(path.join(root,'durable-commit.mjs')));
 const dir=fs.mkdtempSync(path.join(import.meta.dirname,'.writer-test-')),file=path.join(dir,'isolated.db');
 const seed=posFixture(file);seed.close();
 let fail=false;
 const context=vm.createContext({DB:new SQL.Database(fs.readFileSync(file)),SQL_MODULE:SQL,DB_PATH:file,fs,dbLastMtime:0,console,
  saveDatabaseAtomic:(...args)=>{if(fail)throw Error('DISK_FULL');return saveDatabaseAtomic(...args);}});
 vm.runInContext(source.slice(start,end),context);
 const writer={branchId:'TEST-BRANCH',transaction:context.runTransaction,run:context.runSql,one:context.queryOne,all:context.queryAll};
 let receiver=new PosOrderBridge(writer);
 const service=new OrderWorkflow(':memory:',[{sku:'PJ01',size:'bottle_500ml',posProductId:'TEST-P',posSizeId:'TEST-S',priceMinor:1250,available:true}],{preparationApproved:true});
 const actor={id:'TEST-MANAGER',role:'manager'},bridge={id:'TEST-BRIDGE',role:'bridge'};
 const flush=async()=>{for(const e of pendingBridgeEvents(service))acknowledgeBridgeEvent(service,bridge,await receiver.receive(e));};
 try{
  await receiver.initialize();
  const q=service.quote({items:[{sku:'PJ01',size:'bottle_500ml',quantity:2}],customer:{phone:'01000000000'},fulfillment:'pickup',paymentMethod:'cash'});
  let o=service.confirm({key:'runtime-order',quoteId:q.id,accessToken:q.accessToken,expectedTotalMinor:q.totalMinor});await flush();
  o=service.command(actor,{key:'runtime-accept',orderId:o.id,revision:o.revision??0,action:'status',status:'accepted'});await flush();
  service.command(actor,{key:'runtime-prepare',orderId:o.id,revision:o.revision,action:'prepare'});
  const before=fs.readFileSync(file);fail=true;
  await assert.rejects(flush(),/DISK_FULL/);
  assert.deepEqual(fs.readFileSync(file),before);
  assert.equal(writer.one('SELECT stock_quantity n FROM branch_inventory').n,1000);
  assert.equal(service.inbox()[0].status,'accepted');
  assert.throws(()=>writer.run('UPDATE branch_inventory SET stock_quantity=1'),/DISK_FULL/);
  assert.equal(writer.one('SELECT stock_quantity n FROM branch_inventory').n,1000);
  fail=false;const e=pendingBridgeEvents(service)[0],receipt=await receiver.receive(e);
  context.DB.close();context.DB=new SQL.Database(fs.readFileSync(file));
  receiver=new PosOrderBridge(writer);await receiver.initialize();
  assert.deepEqual(await receiver.receive(e),receipt);await flush();
  assert.equal(writer.one('SELECT stock_quantity n FROM branch_inventory').n,600);
  assert.equal(writer.one('SELECT count(*) n FROM inventory_movements').n,1);
  assert.equal(service.inbox()[0].status,'preparing');
  await assert.rejects(writer.transaction(async()=>{}),/SYNCHRONOUS/);
 }finally{service.close();context.DB.close();fs.rmSync(dir,{recursive:true,force:true});}
});
