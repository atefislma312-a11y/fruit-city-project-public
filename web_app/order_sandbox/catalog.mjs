// Exact codes only: never infer identity from a name or substitute serving volumes.
export const sizes = Object.freeze({cup_16oz:['16oz',473],bottle_500ml:['500ml',500],bottle_1l:['1L',1000],'400ml':['400ml',400]});
export function reconcile(menu, pos) {
  return menu.sections.flatMap(s=>s.items).map(item=>{
    const sku=item.item_code||item.sku;
    const matches=pos.products.filter(p=>p.product_code===sku);
    const product=matches.length===1?matches[0]:null;
    return {sku,posProductId:product?.product_id??null,
      reason:matches.length>1?'AMBIGUOUS_PRODUCT':!product?'PRODUCT_NOT_MAPPED':product.is_active!==1?'INACTIVE_PRODUCT':null,
      variants:Object.keys(item.available_sizes||{kg:{}}).map(size=>{
        const spec=sizes[size];
        const candidates=spec?pos.sizes.filter(s=>s.size_code===spec[0]&&s.volume_ml===spec[1]):[];
        return {size,posSizeId:candidates.length===1?candidates[0].size_id:null,
          enabled:item.available_sizes?.[size]?.available===true,
          reason:size==='kg'?'WEIGHT_SPEC_REQUIRED':candidates.length!==1?'SIZE_NOT_MAPPED':null};
      })};
  });
}
// Prices and availability come exclusively from a branch-specific approved feed.
export function approvedVariants(mapping, feed, now=Date.now()) {
  if(!feed?.approval?.by||!feed.approval.reference||!feed.branchId||!Number.isFinite(feed.expiresAt)||feed.expiresAt<=now) return [];
  const result=[];
  for(const p of mapping) for(const v of p.variants) {
    if(p.reason||v.reason||!v.enabled) continue;
    const prices=feed.prices.filter(r=>r.productId===p.posProductId&&r.sizeId===v.posSizeId&&r.branchId===feed.branchId);
    if(prices.length!==1) continue;
    const price=prices[0];
    if(price.available!==true||!Number.isSafeInteger(price.priceMinor)||price.priceMinor<=0) continue;
    result.push({sku:p.sku,size:v.size,posProductId:p.posProductId,posSizeId:v.posSizeId,available:true,priceMinor:price.priceMinor});
  }
  return result;
}
