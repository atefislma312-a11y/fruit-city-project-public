import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreCart,orderText,WHATSAPP_NUMBER} from '../src/order.js';
const products=[{id:'PJ01',name:'مانجا',sizes:[{id:'cup',name:'كوب 16 أونص',price:null}]}];
test('reject malformed, stale, negative and fractional persisted cart entries',()=>{assert.deepEqual(restoreCart('bad',products),[]);assert.deepEqual(restoreCart(JSON.stringify([{id:'removed',size:'cup',quantity:1},{id:'PJ01',size:'cup',quantity:-2},{id:'PJ01',size:'cup',quantity:1.5},{id:'PJ01',size:'cup',quantity:2}]),products),[{id:'PJ01',size:'cup',quantity:2}])});
test('order contains exact variant and quantity and explicitly requires price confirmation',()=>{const text=orderText([{id:'PJ01',size:'cup',quantity:2}],products,'delivery','القاهرة شارع المثال 1','بدون سكر');assert.match(text,/كوب 16 أونص × 2/);assert.match(text,/رسوم التوصيل/);assert.match(text,/قبل اعتماد الطلب/);assert.match(text,/بدون سكر/);assert.match(text,/القاهرة شارع المثال 1/);assert.equal(WHATSAPP_NUMBER,'201025966033')});
test('in-store orders omit delivery address and delivery charges',()=>{const text=orderText([{id:'PJ01',size:'cup',quantity:1}],products,'store','private address','');assert.ok(!text.includes('private address'));assert.ok(!text.includes('رسوم التوصيل'));assert.match(text,/داخل المحل/)});
