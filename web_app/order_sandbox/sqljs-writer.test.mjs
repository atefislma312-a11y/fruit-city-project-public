import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {atomicSave,sqljsWriter} from './sqljs-writer.mjs';
import {posFixture} from './pos-fixture.mjs';
import {PosOrderBridge} from './pos-bridge.mjs';
import {OrderWorkflow} from './workflow.mjs';
import {pendingBridgeEvents,acknowledgeBridgeEvent} from './bridge.mjs';

test('real SQL.js bridge with failed disk commit never ACKs or deducts twice after restart',{skip:!process.env.FC_SQLJS_MODULE},async()=>{
 const {default:init}=await import(pathToFileURL(process.env.FC_SQLJS_MODULE));const SQL=await init();
 const dir=fs.mkdtempSync(path.join(import.meta.dirname,'.writer-test-')),filename=path.join(dir,'isolated.db');
 const seed=posFixture(filename);seed.close();
 let fail=false;
 const options={SQL,filename,branchId:'TEST-BRANCH',save:(file,bytes)=>{if(fail)throw Error('DISK_FULL');atomicSave(file,bytes);}};
 let writer=sqljsWriter(options),receiver=new PosOrderBridge(writer);
 const service=new OrderWorkflow(':memory:',[{sku:'PJ01',size:'bottle_500ml',posProductId:'TEST-P',posSizeId:'TEST-S',priceMinor:1250,available:true}],{preparationApproved:true});
 const actor={id:'TEST-MANAGER',role:'manager'},bridge={id:'TEST-BRIDGE',role:'bridge'};
 const flush=async()=>{for(const event of pendingBridgeEvents(service))acknowledgeBridgeEvent(service,bridge,await receiver.receive(event));};
 try{
  await receiver.initialize();
  const quote=service.quote({items:[{sku:'PJ01',size:'bottle_500ml',quantity:2}],customer:{phone:'01000000000'},fulfillment:'pickup',paymentMethod:'cash'});
  let order=service.confirm({key:'sqljs-order-key',quoteId:quote.id,accessToken:quote.accessToken,expectedTotalMinor:quote.totalMinor});await flush();
  order=service.command(actor,{key:'sqljs-accept-key',orderId:order.id,revision:order.revision??0,status:'accepted',action:'status'});await flush();
  service.command(actor,{key:'sqljs-prepare-key',orderId:order.id,revision:order.revision??0,action:'prepare'});
  const before=fs.readFileSync(filename);fail=true;await assert.rejects(flush(),/DISK_FULL/);
  assert.deepEqual(fs.readFileSync(filename),before);
  assert.equal(writer.one('SELECT stock_quantity AS n FROM branch_inventory').n,1000);
  assert.equal(service.inbox()[0].status,'accepted');assert.equal(pendingBridgeEvents(service).length,1);
  fail=false;const event=pendingBridgeEvents(service)[0],receipt=await receiver.receive(event);
  // Lose the ACK, close the actual SQL.js writer, reopen its durable file and retry.
  await writer.close();writer=sqljsWriter(options);receiver=new PosOrderBridge(writer);await receiver.initialize();
  assert.deepEqual(await receiver.receive(event),receipt);await flush();
  assert.equal(writer.one('SELECT stock_quantity AS n FROM branch_inventory').n,600);
  assert.equal(writer.one('SELECT count(*) AS n FROM inventory_movements').n,1);
  assert.equal(service.inbox()[0].status,'preparing');
 }finally{service.close();await writer.close();fs.rmSync(dir,{recursive:true,force:true});}
});

test('SQL.js disk failures roll back memory, preserve disk and permit exactly-once retry', {skip:!process.env.FC_SQLJS_MODULE},async()=>{
 const {default:init}=await import(pathToFileURL(process.env.FC_SQLJS_MODULE));
 const SQL=await init();
 const dir=fs.mkdtempSync(path.join(import.meta.dirname,'.writer-test-'));
 const filename=path.join(dir,'isolated.db');
 let failure=null;
 const save=(file,bytes)=>atomicSave(file,bytes,new Proxy(fs,{get(target,key){
  if(key===failure)return()=>{throw new Error('Injected '+key);};return target[key];
 }}));
 let writer=sqljsWriter({SQL,filename,branchId:'TEST',save});
 try {
  await writer.transaction(()=>writer.run('CREATE TABLE receipts(id TEXT PRIMARY KEY, amount INTEGER)'));
  for(const operation of ['writeFileSync','fsyncSync','renameSync']){
   const before=fs.readFileSync(filename);failure=operation;
   await assert.rejects(writer.transaction(()=>writer.run('INSERT INTO receipts VALUES (?,?)',[operation,1])),/Injected/);
   assert.deepEqual(fs.readFileSync(filename),before);
   assert.equal(writer.one('SELECT count(*) AS n FROM receipts').n,0);
   assert.deepEqual(fs.readdirSync(dir),['isolated.db','isolated.db.writer-lock']);
  }
  failure=null;
  await Promise.all(Array.from({length:20},()=>writer.transaction(()=>writer.run('INSERT OR IGNORE INTO receipts VALUES (?,?)',['one',1]))));
  assert.equal(writer.one('SELECT count(*) AS n FROM receipts').n,1);
  await assert.rejects(writer.transaction(()=>{writer.run("INSERT INTO receipts VALUES ('rollback',2)");throw new Error('SQL failure');}),/SQL failure/);
  await assert.rejects(writer.transaction(async()=>{}),/Synchronous/);
  assert.equal(writer.one('PRAGMA foreign_keys').foreign_keys,1);
  await writer.close();writer=sqljsWriter({SQL,filename,branchId:'TEST'});
  assert.deepEqual(writer.all('SELECT * FROM receipts'),[{id:'one',amount:1}]);
  assert.throws(()=>writer.run('DELETE FROM receipts'),/transaction/);
  const pending=writer.transaction(()=>writer.run("INSERT INTO receipts VALUES ('queued-before-close',3)"));
  const closing=writer.close();
  await assert.rejects(writer.transaction(()=>{}),/Writer closed/);
  await pending;await closing;await writer.close();
  writer=sqljsWriter({SQL,filename,branchId:'TEST'});
  assert.equal(writer.one('SELECT count(*) AS n FROM receipts').n,2);
 }finally{await writer.close();fs.rmSync(dir,{recursive:true,force:true});}
});
