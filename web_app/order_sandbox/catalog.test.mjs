import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {reconcile,approvedVariants,sizes} from './catalog.mjs';
const read=p=>JSON.parse(readFileSync(new URL(p,import.meta.url)));
const menu=read('../catalog/web_app_full_inventory.json'),pos=read('./pos-identifiers.json');
test('all 124 codes accounted for; 108 exact identities, 16 RF blocked',()=>{
 const rows=reconcile(menu,pos);assert.equal(rows.length,124);assert.equal(rows.filter(r=>!r.reason).length,108);
 const blocked=rows.filter(r=>r.reason);assert.equal(blocked.length,16);assert.ok(blocked.every(r=>r.sku.startsWith('RF-')&&r.posProductId===null));
 for(const row of rows.filter(r=>!r.reason)) assert.equal(pos.products.find(p=>p.product_id===row.posProductId).product_code,row.sku);
});
test('400ml and 16oz remain distinct; altered size metadata fails closed',()=>{
 assert.equal(sizes.cup_16oz[1],473);assert.equal(sizes['400ml'][1],400);
 const changed=structuredClone(pos);changed.sizes.find(s=>s.size_code==='16oz').volume_ml=400;
 assert.ok(reconcile(menu,changed).flatMap(r=>r.variants).filter(v=>v.size==='cup_16oz').every(v=>v.posSizeId===null));
});
test('ambiguous and inactive products never resolve as purchasable',()=>{
 const duplicate=structuredClone(pos);duplicate.products.push({...pos.products[1]});
 assert.equal(reconcile(menu,duplicate).find(r=>r.sku===pos.products[1].product_code).reason,'AMBIGUOUS_PRODUCT');
 const inactive=structuredClone(pos);inactive.products[1].is_active=0;
 assert.equal(reconcile(menu,inactive).find(r=>r.sku===pos.products[1].product_code).reason,'INACTIVE_PRODUCT');
});
test('unapproved, expired, missing, duplicate, unavailable prices cannot enable sales',()=>{
 const mapping=[{sku:'TEST',posProductId:'P',reason:null,variants:[{size:'bottle_500ml',posSizeId:'S',enabled:true,reason:null}]}];
 const feed={approval:{by:'TEST-OWNER',reference:'FIXTURE-ONLY'},branchId:'TEST-BRANCH',expiresAt:1000,prices:[{productId:'P',sizeId:'S',branchId:'TEST-BRANCH',available:true,priceMinor:1234}]};
 assert.equal(approvedVariants(mapping,feed,100).length,1);
 assert.deepEqual(approvedVariants(mapping,{...feed,approval:null},100),[]);
 assert.deepEqual(approvedVariants(mapping,feed,1001),[]);
 for(const prices of [[],[...feed.prices,...feed.prices],[{...feed.prices[0],available:false}],[{...feed.prices[0],priceMinor:null}],[{...feed.prices[0],branchId:'OTHER'}]]) assert.deepEqual(approvedVariants(mapping,{...feed,prices},100),[]);
});
