import dictionary from './translations.json' with {type:'json'};
import french from './french.json' with {type:'json'};
import {frenchIngredients,frenchCategories,frenchSizes} from './french-catalog.js';
export function translate(value,lang){const en=dictionary[value]??value;return lang==='fr'?(french[en]??en):lang==='en'?en:value;}
const ingredients=Object.fromEntries([
['مانجا','Mango'],['جوافة','Guava'],['فراولة','Strawberry'],['برتقال','Orange'],['رمان','Pomegranate'],['ليمون','Lemon'],['بطيخ','Watermelon'],['كيوي','Kiwi'],['تفاح','Apple'],['أناناس','Pineapple'],['عنب','Grape'],['كنتالوب','Cantaloupe'],['جريب فروت','Grapefruit'],['خوخ','Peach'],['مشمش','Apricot'],['كمثرى','Pear'],['يوسفي','Mandarin'],['برقوق','Plum'],['قصب','Sugarcane'],['كركديه','Hibiscus'],['تمر هندي','Tamarind'],['خليط السوبيا','Sobia mix'],['دوم','Doum'],['خروب','Carob'],['بلح','Dates'],['لبن','Milk'],['موز','Banana'],['زنجبيل','Ginger'],['نعناع','Mint'],['باشن فروت','Passion fruit'],['زبادي','Yogurt'],['عصير تفاح','Apple juice'],['عصير فاكهة','Fruit juice'],['بلوبيري','Blueberry'],['راسبيري','Raspberry'],['أفوكادو','Avocado'],['آيس كريم فانيليا','Vanilla ice cream'],['آيس كريم','Ice cream'],['شوكولاتة','Chocolate'],['بسكويت أوريو','Oreo biscuits'],['كراميل','Caramel'],['بسكويت لوتس','Lotus biscuits'],['فستق','Pistachio'],['توت','Berries'],['قرفة','Cinnamon'],['عسل','Honey'],['تين','Fig'],['بنجر','Beetroot'],['جزر','Carrot'],['جرجير','Rocket'],['تفاح أخضر','Green apple'],['خيار','Cucumber'],['بقدونس','Parsley'],['كرفس','Celery'],['فواكه موسمية طازجة مشكلة مقطعة','Mixed fresh seasonal cut fruit'],['فاكهة طازجة بالكيلو · يُؤكَّد السعر والتوافر مع المحل','Fresh fruit by the kilogram · Confirm price and availability with the shop']]);
const sizes={cup_16oz:'16 oz cup',bottle_500ml:'500 ml bottle',bottle_1l:'1 litre bottle',kg:'Kilogram'};
const categoryNames=['Pure Juices','Egyptian Heritage','Signature Blends','Velvet Smoothies','Milkshakes','Yogurt Creations','Sports Collection','Garden Fusion','Cut Fruits & Bowls','Fruit by the Kilogram'];
export function localizeCategories(items,lang){return lang==='ar'?items:items.map(c=>({...c,name:(lang==='fr'?frenchCategories:categoryNames)[Number(c.id)-1]}));}
export function localizeProducts(items,lang){return lang==='ar'?items:items.map(p=>{
 const parts=p.description.split(' + ').map(s=>ingredients[s]??'Ingredient translation unavailable');
 const description=parts.map(s=>lang==='fr'?(frenchIngredients[s]??'Traduction indisponible'):s).join(' + ');
 // Preserve signature blend names; translate descriptive fruit, dairy and heritage names.
 const name=lang==='fr'?(frenchIngredients[p.english]??(['01','02','05','06','09','10'].includes(p.category)?(p.category==='05'?'Milk-shake · ':p.category==='06'?'Yaourt · ':'')+description:p.english)):p.english;
 return {...p,name,description,sizes:p.sizes.map(s=>({...s,name:(lang==='fr'?frenchSizes:sizes)[s.id]??'Format indisponible'}))};});}
export function localizeStory(story,lang){
 if(!story||lang==='ar')return story;
 const en=story[lang];
 if(en&&typeof en.title==='string'&&en.title.trim()&&Array.isArray(en.paragraphs)&&en.paragraphs.length&&en.paragraphs.every(p=>typeof p==='string'&&p.trim())&&!/[\u0600-\u06ff]/.test([en.title,...en.paragraphs].join(' ')))return {...story,title:en.title,paragraphs:en.paragraphs};
 return {...story,title:lang==='fr'?'L’histoire de votre jus':'The story behind your juice',paragraphs:[lang==='fr'?'La version française de cette histoire sera bientôt disponible.':'The English version of this story is coming soon.']};
}
