import catalog from '../../catalog/web_app_full_inventory.json';
export const categories = [...catalog.sections[0].categories.map(c=>({id:c.id,name:c.name_ar})),{id:'10',name:'فواكه بالكيلو'}];
export const products = catalog.sections.flatMap(section=>section.items.map(item=>({
  id:item.item_code||item.sku, name:item.item_name?.ar||item.name_ar, english:item.item_name?.en||item.name_en,
  category:item.category_id||section.category_id, description:item.ingredients_raw||'فاكهة طازجة بالكيلو · يُؤكَّد السعر والتوافر مع المحل',
  sizes:item.available_sizes?Object.entries(item.available_sizes).filter(([,s])=>s.available).map(([id,s])=>({id,name:s.size_name_ar,price:s.price_egp})): [{id:'kg',name:'كيلو',price:item.daily_price_egp}],
})));
