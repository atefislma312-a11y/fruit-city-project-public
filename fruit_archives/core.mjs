import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const ROOT=path.dirname(fileURLToPath(import.meta.url));
export const PROJECT=path.resolve(ROOT,'..');
export const PLATFORMS=['facebook','instagram','pinterest','tiktok','instagram-reels','facebook-reels','webapp'];
export const STAGES=['menu','event','research','claims','story','hooks','hook-selection','design','product','platforms','qa','approval','export','reproduction','performance'];
export const SIZES={facebook:[1080,1080],instagram:[1080,1350],pinterest:[1000,1500],tiktok:[1080,1920],'instagram-reels':[1080,1920],'facebook-reels':[1080,1920],webapp:[1200,630]};
export const slug=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{1,79}$/.test(v);
export const hash=v=>crypto.createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
export function menu(){return JSON.parse(fs.readFileSync(path.join(PROJECT,'docs/menu/menu_items.json'),'utf8')).items.map(i=>({id:i.item_code,ar:i.item_name.ar,en:i.item_name.en,ingredients:i.ingredients}));}
export function createEpisode({id,menuItemId,eventTitle,country,year}){
  if(!slug(id))throw Error('معرف الحلقة: حروف إنجليزية صغيرة وأرقام وشرطة، من 2 إلى 80 حرفًا');
  const item=menu().find(i=>i.id===menuItemId);if(!item)throw Error('الصنف غير موجود في المنيو الحقيقي');
  if(!eventTitle?.trim()||!country?.trim()||!String(year).trim())throw Error('اسم الحدث والبلد والسنة مطلوبة');
  return {schemaVersion:1,id,revision:0,fruit:{id:menuItemId.toLowerCase(),arabicName:item.ar,englishName:item.en,actualMenuItemIds:[menuItemId],productImages:[],brandAssets:[]},eventTitle,country,year:String(year),summary:'',story:'',editorialStatus:'draft',visualStatus:'blocked',publicationStatus:'blocked',stages:Object.fromEntries(STAGES.map(s=>[s,s==='menu'?'approved':'draft'])),sources:[],claims:[],assets:[],hooks:[{text:`إيه حكاية ${item.ar}؟`,claimIds:[]},{text:`${item.ar}… وراها إيه؟`,claimIds:[]},{text:`افتح ملف ${item.ar}`,claimIds:[]}],selectedHook:0,alternateHook:1,hookReason:'اقتراحات تمهيدية بلا ادعاء تاريخي، تُراجع بعد البحث',design:{palette:['#231c27','#d9c18c'],template:'archive-v1',productAssetId:null,referenceAssetId:null},platformContent:PLATFORMS.map(platform=>({episodeId:id,platform,imageHook:'',caption:'',title:eventTitle,description:'',cta:'Fruit City — كل عصير وراه حكاية.',hashtags:['FruitCity','أرشيف_الفواكه'],seo:{title:eventTitle,description:'',canonicalUrl:null},approvalStatus:'draft',claimIds:[],scenes:[],slides:[]})),exports:[],performance:[],history:[],approval:null};
}
export function validate(e){
 const errors=[]; const need=(ok,msg)=>{if(!ok)errors.push(msg);};
 need(e&&slug(e.id),'معرف الحلقة غير صالح');if(!e||typeof e!=='object')return errors;
 for(const key of ['eventTitle','country','year'])need(typeof e[key]==='string'&&e[key].trim().length>0&&e[key].length<500,`حقل ${key} مطلوب`);
 need(Array.isArray(e.fruit?.actualMenuItemIds)&&e.fruit.actualMenuItemIds.length>0&&e.fruit.actualMenuItemIds.every(id=>menu().some(i=>i.id===id)),'أكواد منيو غير صالحة');
 for(const key of ['sources','claims','assets','hooks','platformContent','performance'])need(Array.isArray(e[key]),`قائمة ${key} مطلوبة`);
 if(errors.length)return errors;
 need(e.hooks.length===3&&e.hooks.every(h=>typeof h.text==='string'&&h.text.trim()&&h.text.length<=100),'يلزم 3 هوكات غير فارغة بطول أقصى 100 حرف');
 need(Number.isInteger(e.selectedHook)&&e.hooks[e.selectedHook]&&Number.isInteger(e.alternateHook)&&e.hooks[e.alternateHook]&&e.selectedHook!==e.alternateHook,'اختيار الهوك الأساسي والبديل غير صالح');
 need(e.design?.palette?.length===2&&e.design.palette.every(c=>/^#[0-9a-f]{6}$/i.test(c)),'ألوان القالب غير صالحة');
 for(const list of [e.sources,e.claims,e.assets])need(list.every(x=>x.id&&typeof x.id==='string')&&new Set(list.map(x=>x.id)).size===list.length,'معرفات مفقودة أو مكررة');
 for(const s of e.sources){try{need(['https:','http:'].includes(new URL(s.url).protocol),'رابط مصدر غير آمن');}catch{errors.push('رابط مصدر غير صالح');}}
 for(const c of e.claims)need(typeof c.statement==='string'&&Array.isArray(c.sourceIds)&&c.sourceIds.every(id=>e.sources.some(s=>s.id===id)),'ادعاء بمصدر مفقود');
 for(const a of e.assets)need(typeof a.filePath==='string'&&/^assets\/[a-zA-Z0-9_.-]+\.(png|jpg|jpeg|webp)$/.test(a.filePath),'مسار أصل غير آمن');
 need(e.platformContent.length===PLATFORMS.length&&PLATFORMS.every(p=>e.platformContent.filter(c=>c.platform===p).length===1),'يجب وجود سجل واحد لكل منصة');
 for(const c of e.platformContent)need(typeof c.caption==='string'&&typeof c.imageHook==='string'&&c.caption.length<20000&&c.imageHook.length<=100,'نص منصة غير صالح');
 const states=['draft','needs-review','approved','blocked'];
 need(STAGES.every(s=>states.includes(e.stages?.[s])),'حالة مرحلة غير صالحة');
 need([e.editorialStatus,e.visualStatus,e.publicationStatus].every(s=>states.includes(s)),'حالة الحلقة غير صالحة');
 for(const c of e.platformContent)need(states.includes(c.approvalStatus)&&Array.isArray(c.claimIds)&&c.claimIds.every(id=>e.claims.some(x=>x.id===id)),'حالة منصة أو مرجع ادعاء غير صالح');
 return errors;
}
export function blockers(e){
 const b=[...validate(e)];if(b.length)return b;
 if(!e.story?.trim()||!e.summary?.trim())b.push('القصة والملخص ناقصان');
 if(!e.claims.length||e.claims.some(c=>c.verificationStatus!=='verified'||!c.sourceIds.length))b.push('الادعاءات تحتاج تحققًا');
 if(e.sources.some(s=>s.verificationStatus!=='verified'||!s.title||!s.publisher||!s.sourceType))b.push('المصادر الأساسية تحتاج مراجعة');
 if(!e.hookReason?.trim())b.push('سبب اختيار الهوك ناقص');
 const cup=e.assets.find(a=>a.id===e.design.productAssetId);
 if(!cup||cup.authenticity!=='real-product'||!cup.ownerApproved)b.push('أصل الكوباية غير مؤكد من المالك');
 for(const a of e.assets.filter(a=>a.usedInExport))if(a.rightsStatus!=='approved'||!a.license||!a.owner||!a.attribution||!a.commercialUse||!a.source)b.push(`حقوق الأصل تحتاج اعتماد: ${a.id}`);
 if(e.platformContent.some(c=>!c.caption.trim()||!c.imageHook.trim()||c.approvalStatus!=='approved'))b.push('نصوص المنصات أو الهوكات غير معتمدة');
 if(e.editorialStatus!=='approved'||e.visualStatus!=='approved')b.push('المراجعة التحريرية والبصرية غير مكتملة');
 return [...new Set(b)];
}
export function saveEpisode(base,e,expected){
 const problems=validate(e);if(problems.length)throw Error(problems.join('؛ '));
 const dir=path.join(base,e.id);fs.mkdirSync(dir,{recursive:true});const file=path.join(dir,'episode.json');
 const old=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
 if(old&&expected!==old.revision)throw Error('تغيرت النسخة: أعد تحميل الحلقة قبل الحفظ');
 if(!old&&expected!==0)throw Error('حلقة جديدة بنسخة غير صالحة');
 const next=structuredClone(e);next.revision=(old?.revision||0)+1;next.approval=null;next.publicationStatus='blocked';
 next.history=[...(old?.history||[]),{revision:next.revision,timestamp:new Date().toISOString(),action:old?'save':'create'}];
 if(old){fs.mkdirSync(path.join(dir,'versions'),{recursive:true});fs.writeFileSync(path.join(dir,'versions',`v${old.revision}.json`),JSON.stringify(old,null,2),{flag:'wx'});}
 const tmp=file+'.tmp';fs.writeFileSync(tmp,JSON.stringify(next,null,2));fs.renameSync(tmp,file);return next;
}
export const escapeHtml=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function buildPackage(e){
 const qa={status:'draft',blockers:blockers(e),generatedAt:new Date().toISOString(),missing:['الفيديو المنفذ والتعليق الصوتي','اعتماد المالك للحقوق والتصميم'],note:'هذه حزمة مراجعة؛ لا اعتماد نشر تلقائي'};
 const files={'episode.json':e,'research/claims.json':e.claims,'research/review.json':qa,'sources/sources.json':e.sources,'assets/manifest.json':e.assets,'design/design.json':{...e.design,hooks:e.hooks,selectedHook:e.selectedHook,alternateHook:e.alternateHook},'qa/report.json':qa,'copy/master-story.md':e.story,'README.md':`# ${e.eventTitle}\n\nحزمة مسودة للمراجعة، النسخة ${e.revision}.\n\n${qa.blockers.map(x=>'- '+x).join('\n')}\n\nراجع sources وresearch. ملفات الفيديو نصوص ومشاهد فقط وليست فيديو منفذًا.\n`};
 for(const c of e.platformContent){files[`copy/${c.platform}.json`]=c;files[`exports/${c.platform.includes('reels')?'reels':c.platform}/${c.platform}-copy.md`]=`# ${c.title}\n\n${c.imageHook}\n\n${c.caption}\n\n${c.cta}\n\n${c.hashtags.map(t=>'#'+t).join(' ')}`;}
 files['webapp/article.html']=`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(e.eventTitle)}</title><style>body{max-width:760px;margin:40px auto;padding:24px;font:20px/1.9 Arial;background:#fcf5e8;color:#241c18}a{color:#803319}</style><p>مسودة للمراجعة — أرشيف الفواكه</p><h1>${escapeHtml(e.eventTitle)}</h1>${e.story.split('\n\n').map(p=>`<p>${escapeHtml(p)}</p>`).join('')}<h2>المصادر</h2><ul>${e.sources.map(s=>`<li><a href="${escapeHtml(s.url)}">${escapeHtml(s.title)}</a> — ${escapeHtml(s.publisher)}</li>`).join('')}</ul><p>الصنف المرتبط: ${escapeHtml(e.fruit.actualMenuItemIds.join(', '))}</p><a href="../../../../web_app/app_code/">ملفات المتجر المحلي (ليست رابط نشر)</a><p>حلقات أخرى: تُضاف عند وجود حلقة موثقة لنفس الفاكهة.</p></html>`;
 return files;
}
export function exportPackage(base,e){
 const files=buildPackage(e), dir=path.join(base,e.id,'exports',`draft-v${e.revision}-${crypto.randomUUID().slice(0,8)}`);fs.mkdirSync(dir,{recursive:true});
 for(const [name,value]of Object.entries(files)){const dest=path.join(dir,name);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,typeof value==='string'?value:JSON.stringify(value,null,2));}
 for(const asset of e.assets){const from=path.join(ROOT,asset.filePath);if(fs.existsSync(from))fs.copyFileSync(from,path.join(dir,asset.filePath));}
 for(const platform of PLATFORMS){const from=path.join(base,e.id,'exports',platform);if(fs.existsSync(from)){const latest=new Map();for(const name of fs.readdirSync(from).filter(n=>/\.(png|jpg|webp)\.json$/.test(n))){const r=JSON.parse(fs.readFileSync(path.join(from,name),'utf8')),key=r.variant+':'+r.format;if(!latest.has(key)||latest.get(key).r.timestamp<r.timestamp)latest.set(key,{name,r});}for(const {name}of latest.values()){const to=path.join(dir,'exports',platform);fs.mkdirSync(to,{recursive:true});for(const n of [name,name.slice(0,-5)])fs.copyFileSync(path.join(from,n),path.join(to,n));}}}
 fs.copyFileSync(path.join(ROOT,'public','render.js'),path.join(dir,'design','render.js'));
 fs.writeFileSync(path.join(dir,'design','REPRODUCE.md'),'استخدم episode.json مع render.js داخل استوديو Fruit Archives؛ assets نسخ مطابقة. الصور تحمل مسودة مراجعة دائمًا. المقاسات قوالب مشروع وليست ضمانًا لكل موضع إعلان.');
 return {directory:dir,files:Object.keys(files),qa:files['qa/report.json']};
}
