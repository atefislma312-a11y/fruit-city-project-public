export function distanceMeters(a,b){
 for(const p of [a,b])if(!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lng)||Math.abs(p.lat)>90||Math.abs(p.lng)>180)throw Error('DELIVERY_LOCATION_REQUIRED');
 const rad=n=>n*Math.PI/180;
 const h=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lng-a.lng)/2)**2;
 return 6371000*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
export function validateDelivery(point,config){
 if(!config?.ownerConfirmedSameShop)throw Error('DELIVERY_NOT_CONFIGURED');
 const distance=distanceMeters(config.center,point);
 if(distance>config.radiusMeters)throw Error('DELIVERY_OUTSIDE_RADIUS');
 if(config.feesApproved!==true)throw Error('DELIVERY_FEE_UNCONFIRMED');
 // No client-selected zone name or unverified fee accepted.
 throw Error('DELIVERY_ZONE_MAPPING_REQUIRED');
}

// Trusted server-side zone result only; never accept the browser's chosen zone as proof.
export function approvedDeliveryFee(zoneId,config){
 if(config?.feesApproved!==true)throw Error('DELIVERY_FEE_UNCONFIRMED');
 const fee=Object.hasOwn(config.feesMinor??{},zoneId)?config.feesMinor[zoneId]:undefined;
 if(!Number.isSafeInteger(fee)||fee<0)throw Error('DELIVERY_ZONE_UNSUPPORTED');
 return fee;
}
