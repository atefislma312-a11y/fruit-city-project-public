import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrderSandbox } from './service.mjs';

// Fictional products/prices. Never read, import, launch or connect to the production app.
const catalog = () => [{sku:'TEST-JUICE',size:'bottle_500ml',posProductId:'TEST-POS',posSizeId:'TEST-500',available:true,priceMinor:1250}];
const request = () => ({key:'test-order-001',items:[{sku:'TEST-JUICE',size:'bottle_500ml',quantity:2}]});
function fixture(t, variants=catalog()) { const s=new OrderSandbox(':memory:',variants);t.after(()=>s.close());return s; }

test('creates one pending unpaid order with server-calculated price and exact variant',t=>{
  const s=fixture(t);const input=request();input.items[0].unitPriceMinor=1;
  const result=s.submit(input);assert.equal(result.totalMinor,2500);assert.equal(result.status,'pending_store_acceptance');
  assert.equal(result.paymentStatus,'unpaid');assert.equal(result.lines[0].posSizeId,'TEST-500');assert.equal(s.count(),1);
});
test('lost response and repeated submission return the same durable order after reopening',()=>{
  const directory=mkdtempSync(join(tmpdir(),'fruit-city-order-proof-'));const file=join(directory,'test.db');
  let s;
  try {s=new OrderSandbox(file,catalog());const first=s.submit(request());s.close();s=undefined;
    s=new OrderSandbox(file,catalog());const retry=s.submit(request());assert.equal(retry.id,first.id);assert.equal(retry.replayed,true);assert.equal(s.count(),1);
  } finally {s?.close();unlinkSync(file);rmdirSync(directory);}
});
test('same key with changed quantity is rejected without a duplicate',t=>{
  const s=fixture(t);s.submit(request());const changed=request();changed.items[0].quantity=3;
  assert.throws(()=>s.submit(changed),/IDEMPOTENCY_CONFLICT/);assert.equal(s.count(),1);
});
test('retry retains original price snapshot after catalog price changes',t=>{
  const variants=catalog();const s=fixture(t,variants);s.submit(request());variants[0].priceMinor=2000;
  assert.equal(s.submit(request()).totalMinor,2500);assert.equal(s.submit({...request(),key:'test-order-002'}).totalMinor,4000);
});
test('unknown SKU or size, unavailable and unpriced variants fail closed',t=>{
  const variants=catalog();const s=fixture(t,variants);
  const unknown=request();unknown.items[0].size='1L';assert.throws(()=>s.submit(unknown),/UNKNOWN_VARIANT/);
  variants[0].available=false;assert.throws(()=>s.submit(request()),/UNAVAILABLE/);
  variants[0].available=true;variants[0].priceMinor=null;assert.throws(()=>s.submit(request()),/PRICE_UNCONFIRMED/);assert.equal(s.count(),0);
});
test('invalid quantities and missing mapping never create orders',t=>{
  const variants=catalog();const s=fixture(t,variants);
  for(const quantity of [0,-1,1.5,100,NaN,'2']) {const bad=request();bad.items[0].quantity=quantity;assert.throws(()=>s.submit(bad),/INVALID_QUANTITY/);}
  variants[0].posSizeId=null;assert.throws(()=>s.submit(request()),/MAPPING_UNCONFIRMED/);assert.equal(s.count(),0);
});
test('invalid later line rolls back the entire request',t=>{
  const s=fixture(t);const input=request();input.items.push({sku:'MISSING',size:'kg',quantity:1});
  assert.throws(()=>s.submit(input),/UNKNOWN_VARIANT/);assert.equal(s.count(),0);
});
