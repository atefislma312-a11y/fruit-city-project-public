export const WHATSAPP_NUMBER='201025966033';
export function restoreCart(raw,products){
  try { const value=JSON.parse(raw); if(!Array.isArray(value))return [];return value.filter(row=>row&&products.some(p=>p.id===row.id&&p.sizes.some(s=>s.id===row.size))&&Number.isInteger(row.quantity)&&row.quantity>0&&row.quantity<=99).slice(0,124); }catch{return [];}
}
export function orderText(cart,products,mode,address,notes){
  const lines=cart.map(row=>{const p=products.find(p=>p.id===row.id);const s=p.sizes.find(s=>s.id===row.size);return `• ${p.name} — ${s.name} × ${row.quantity}`;});
  return ['أهلاً Fruit City، عايز أطلب:',...lines,`طريقة الطلب: ${mode==='delivery'?'توصيل للمنزل':'طلب داخل المحل'}`,mode==='delivery'?`العنوان: ${address.trim()}`:'',notes.trim()?`ملاحظات: ${notes.trim()}`:'','برجاء تأكيد الأسعار والتوافر'+(mode==='delivery'?' ورسوم التوصيل':'')+' والإجمالي قبل اعتماد الطلب.'].filter(Boolean).join('\n');
}
