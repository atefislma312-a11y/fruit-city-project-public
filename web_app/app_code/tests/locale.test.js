import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {localizeProducts,localizeStory,translate} from '../src/locale.js';
import {orderText} from '../src/order.js';
const arabic=/[\u0600-\u06ff]/;
test('all catalog names, ingredients and sizes have English text without losing IDs or prices',()=>{
 const catalog=JSON.parse(fs.readFileSync(new URL('../../catalog/web_app_full_inventory.json',import.meta.url)));
 const base=catalog.sections.flatMap(section=>section.items.map(i=>({id:i.item_code||i.sku,english:i.item_name?.en||i.name_en,description:i.ingredients_raw||'فاكهة طازجة بالكيلو · يُؤكَّد السعر والتوافر مع المحل',sizes:i.available_sizes?Object.entries(i.available_sizes).filter(([,s])=>s.available).map(([id,s])=>({id,price:s.price_egp})):[{id:'kg',price:i.daily_price_egp}]})));
 const result=localizeProducts(base,'en');assert.equal(result.length,124);
 for(const [index,p] of result.entries()){assert.ok(p.name);assert.ok(!arabic.test(JSON.stringify(p)));assert.ok(!p.description.includes('unavailable'),p.id);assert.equal(p.id,base[index].id);assert.deepEqual(p.sizes.map(s=>s.price),base[index].sizes.map(s=>s.price));}
 assert.ok(!arabic.test(orderText([{id:result[0].id,size:result[0].sizes[0].id,quantity:2}],result,'delivery','Cairo','No sugar','en')));
});
test('all UI translation calls have an English translation',()=>{
 for(const file of ['main.jsx','ProductStory.jsx']){const source=fs.readFileSync(new URL('../src/'+file,import.meta.url),'utf8');for(const match of source.matchAll(/\bt\(['"]([^'"]+)['"]\)/g))assert.ok(!arabic.test(translate(match[1],'en')),match[1]);}
});
test('English story retains image, translates content and never falls back to Arabic',()=>{
 const records=JSON.parse(fs.readFileSync(new URL('../src/product-stories.json',import.meta.url)));
 for(const story of Object.values(records)){const en=localizeStory(story,'en');assert.equal(en.image,story.image);assert.ok(!arabic.test(en.title+en.paragraphs.join(' ')));assert.equal(localizeStory(story,'ar'),story);}
 assert.ok(!arabic.test(localizeStory({title:'قصة',paragraphs:['عربي'],image:'/stories/x.jpg'},'en').title));
});
