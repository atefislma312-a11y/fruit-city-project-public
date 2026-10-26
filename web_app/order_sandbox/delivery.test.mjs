import test from 'node:test';import assert from 'node:assert/strict';import {distanceMeters,validateDelivery} from './delivery.mjs';
test('5km boundary and missing location fail closed without made-up fees',()=>{
 const center={lat:0,lng:0},c={center,ownerConfirmedSameShop:true,radiusMeters:5000,feesApproved:false};
 assert.equal(distanceMeters(center,center),0);
 assert.throws(()=>validateDelivery(null,c),/LOCATION_REQUIRED/);
 assert.throws(()=>validateDelivery({lat:0.05,lng:0},c),/OUTSIDE_RADIUS/);
 assert.throws(()=>validateDelivery({lat:0.04,lng:0},c),/FEE_UNCONFIRMED/);
 assert.throws(()=>distanceMeters(center,{lat:NaN,lng:0}),/LOCATION_REQUIRED/);
});

test('owner tariffs use integer piastres; unknown zone and missing approval fail closed',async()=>{
 const {approvedDeliveryFee}=await import('./delivery.mjs');
 const {readFileSync}=await import('node:fs');const config=JSON.parse(readFileSync(new URL('./operating-config.json',import.meta.url))).delivery;
 assert.deepEqual(['garden_city','zamalek','manial','sayyida_zeinab','downtown'].map(z=>approvedDeliveryFee(z,config)),[2000,4000,4000,3500,3500]);
 assert.throws(()=>approvedDeliveryFee('__proto__',config),/UNSUPPORTED/);
 assert.throws(()=>approvedDeliveryFee('garden_city',{...config,feesApproved:false}),/UNCONFIRMED/);
 assert.throws(()=>validateDelivery(config.center,config),/ZONE_MAPPING_REQUIRED/);
});
