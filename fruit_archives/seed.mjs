import fs from 'node:fs';
import path from 'node:path';
import {ROOT,PROJECT,createEpisode,saveEpisode,buildPackage,hash} from './core.mjs';
const base=path.join(ROOT,'episodes');
const id='mango-china-1968';
if(fs.existsSync(path.join(base,id,'episode.json')))throw Error('الحلقة موجودة؛ seed لا يكتب فوقها');
const e=createEpisode({id,menuItemId:'PJ01',eventTitle:'ملف المانجا — الصين 1968',country:'الصين',year:'1968'});
e.summary='هدية دبلوماسية من المانجا تتحول إلى رمز سياسي خلال الثورة الثقافية في الصين.';
e.story=`مانجا دخلت السياسة… من غير ما تترشح!

إحنا لما تجيلنا مانجا بنسأل: استوت؟ في الصين سنة 1968، الحكاية خدت سكة تانية خالص. في أغسطس، وزير خارجية باكستان قدّم مانجا هدية لماو تسي تونغ. وماو مرّرها لفرق عمال كانت موجودة في جامعة تسينغهوا. [C1، C2]

الهدية وصلت في لحظة سياسية حساسة، بعد صراعات بين مجموعات الحرس الأحمر. ومن هنا الفاكهة بقت رمزًا للاهتمام بالعمال وإبراز دورهم في المرحلة الجديدة. يعني المانجا دخلت ومعاها رسالة… بس مش كارت «بالهنا والشفا». دي قفشة على الموقف، مش نص تاريخي. [C3]

وبدل ما يكون السؤال «ناكلها إمتى؟»، بقى فيه اهتمام بالحفاظ عليها. بعض الثمار اتغطت بالشمع أو اتحفظت بالفورمالدهيد. واضح إن خطة التخزين دي مش بتاعة درج الفاكهة! والفورمالدهيد هنا مادة حفظ تاريخية، مش اقتراح للأكل طبعًا. [C4]

والموضوع خرج من حدود الهدية: المانجا ظهرت في الدعاية، وعلى قطع تذكارية، وفي احتفالات وموكب اليوم الوطني سنة 1968. أرشيف الملصقات بيحتفظ كمان بملصق من أبريل 1969 فيه ناس شايلة طبق مانجا. [C5، C6]

المفارقة مضحكة، لكن الفترة نفسها شهدت عنفًا وقمعًا؛ الضحك هنا على تضخيم رمز سياسي، مش على الناس اللي عاشت الظروف دي. ومش كل تفاصيل الحكاية متفق عليها: عدد الثمار واسم الوزير مختلفان بين بعض المصادر، عشان كده ما حددناش عددًا، واستخدمنا صفته الرسمية. [C7]

وعشان محدش يفهمنا غلط: دي حكاية المانجا في الصين، مش تاريخ وصفة Fruit City. عندنا المانجا موجودة في المنيو باسمها وكودها PJ01. الحكاية للتذوق… والعصير للشرب.

Fruit City — كل عصير وراه حكاية.`;
const source=(id,url,title,author,publisher,date,sourceType,notes='')=>({id,url,title,author,publisher,date,sourceType,notes,verificationStatus:'verified',checkedAt:'2026-10-25',access:'web page read/search extract; no image license inferred'});
e.sources=[
source('S1','https://www.cooperhewitt.org/2018/06/13/gift-basket/','Gift Basket','Rachel Ward Sepielli','Cooper Hewitt / Smithsonian','2018-06-13','secondary-museum','يدعم الهدية والعمال وتسينغهوا والحفظ. حقوق النص ليست ترخيص صور.'),
source('S2','https://china.usc.edu/event/creating-and-discarding-symbols-case-mao-zedongs-golden-mangoes','Creating and Discarding Symbols','Alfreda Murck (speaker)','USC US-China Institute','2014-09-22','secondary-academic-event','ملخص محاضرة؛ ليس تسجيلًا أو نص كتاب كامل.'),
source('S3','https://chineseposters.net/posters/e13-594','Closely follow the great leader Chairman Mao and forge ahead courageously!','Chen Qiang; Shen Zhaorong; Shen Shaolun','Chinese Posters / Landsberger collection','1969-04','primary-object-catalog','قطعة دعاية 1969؛ ليست صورة تسليم الهدية في 1968. لا نعيد نشر الصورة.'),
source('S4','https://daily.jstor.org/when-maos-mango-mania-took-over-china/','When Mao’s Mango Mania Took Over China','Christin Bohnke','JSTOR Daily','2026-02-04','secondary-research-journalism','يدعم موكب اليوم الوطني؛ يستند إلى بحث Murck 2007، ليست كل المصادر مستقلة عنه.'),
source('S5','https://chineseposters.net/themes/mao-mangoes',"Chairman Mao’s Mangoes",null,'Chinese Posters',null,'secondary-archive','يذكر سبع ثمار؛ لا نعتمد عددًا نهائيًا.'),
source('S6','https://www.dawn.com/news/1426521','Mangoes for Mao','A Correspondent','Dawn','2018-08-12','primary-report-reprint','إعادة نشر خبر 1968، يشير إلى Mian Arshad Husain. اقتباسات النص غير مستخدمة.'),
source('S7','https://www.mango.org/blog/mango-mania-of-china/','Mango Mania of China',null,'National Mango Board',null,'secondary-industry','مراجعة تعارض فقط: يسمي Pirzada ويذكر نحو 40؛ لا يعتمد في نص الحلقة.'),
source('S8','https://ed.ted.com/lessons/mao-zedong-s-infamous-mango-cult-vivian-jiang',"Mao Zedong’s infamous mango cult",'Vivian Jiang','TED-Ed','2023-01','secondary-educational','تمت قراءة مقدمة الدرس فقط، لا ادعاء مشاهدة الفيديو كاملًا.'),
source('S9','https://www.si.edu/object/maos-golden-mangoes-and-cultural-revolution-alfreda-murck-ed%3Asiris_sil_1010092',"Mao’s golden mangoes and the Cultural Revolution",'Alfreda Murck (editor)','Smithsonian Libraries and Archives','2013','bibliographic-catalog','تم التحقق من فهرس الكتاب لا قراءة صفحاته الـ247؛ CC0 يخص metadata فقط.')];
e.claims=[
['C1','هدية من المانجا وصلت لماو من وزير خارجية باكستان في أغسطس 1968.',['S1','S2'],'high'],
['C2','مرّر ماو الهدية لفرق العمال المرتبطة بجامعة تسينغهوا.',['S1','S2'],'high'],
['C3','تحولت المانجا إلى رمز سياسي لدور العمال ضمن تحول موازين القوة.',['S1','S2'],'high'],
['C4','حُفظت بعض الثمار بالشمع أو الفورمالدهيد.',['S1'],'medium-high'],
['C5','ظهرت المانجا في الدعاية والقطع التذكارية؛ ملصق أبريل 1969 شاهد بصري.',['S3','S5'],'high'],
['C6','شاركت رموز المانجا في موكب اليوم الوطني في بكين سنة 1968.',['S4'],'medium-high'],
['C7','تختلف بعض المصادر في عدد الثمار واسم الوزير؛ يستبعد النص هذين التفصيلين.',['S5','S6','S7'],'high']
].map(([id,statement,sourceIds,confidence])=>({id,episodeId:e.id,statement,sourceIds,confidence,verificationStatus:'verified',notes:'مراجعة مصادر منشورة؛ ليس إثباتًا لكل تفاصيل روايات شهود العيان.'}));
e.hooks=[{text:'مانجا دخلت السياسة… من غير ما تترشح!',claimIds:['C3'],kind:'editorial-joke'},{text:'ليه حفظوا المانجا بدل ما ياكلوها؟',claimIds:['C4'],kind:'question'},{text:'إزاي المانجا وصلت لموكب في الصين؟',claimIds:['C6'],kind:'question'}];
e.selectedHook=0;e.alternateHook=1;e.hookReason='قصير وبيفتح فضول، والقفشة واضحة من غير ادعاء إن ثمرة واحدة سببت موكبًا. البديل يختبر فضول طريقة الحفظ.';
e.design.palette=['#3c1821','#bb8935'];
fs.mkdirSync(path.join(ROOT,'assets'),{recursive:true});
const originals=[['cup-reference.png','2026-10-25/referenced-chatgpt-conversation-this-is-an-3/outputs/cup-reference.png'],['china-1968-reference.png','2026-10-25/referenced-chatgpt-conversation-this-is-an-3/outputs/China-1968-review.png']];
for(const [name,rel]of originals)fs.copyFileSync(path.join(PROJECT,rel),path.join(ROOT,'assets',name),fs.constants.COPYFILE_EXCL);
e.assets=originals.map(([name,rel],i)=>({id:i?'reference-art':'master-cup-candidate',filePath:'assets/'+name,type:i?'reference-design':'product-photo',dimensions:i?[1440,2560]:[1229,1536],owner:null,license:null,attribution:i?'راجع سجل الأصول التاريخي':'Fruit City — أصل قيد التأكيد',authenticity:i?'mixed-era-composite':'product-reference-unconfirmed',source:rel,date:null,rightsStatus:'needs-review',commercialUse:false,ownerApproved:false,usedInExport:!i,sha256:hash(fs.readFileSync(path.join(ROOT,'assets',name))),modifications:'نسخ مطابق دون تعديل؛ تغيير الحجم للعرض فقط',notes:i?'مرجع بصري فقط؛ خلفية فترات مختلفة، ليس توثيقًا لتسليم المانجا. حقوق عدة طبقات غير محسومة.':'المالك قرر في هذه المحادثة استخدامه للمراجعة فقط لحين تأكيد الأصل.'}));
e.design.productAssetId='master-cup-candidate';e.design.referenceAssetId='reference-art';e.fruit.productImages=['master-cup-candidate'];e.fruit.brandAssets=['master-cup-candidate'];
const copy={
 facebook:'مانجا دخلت السياسة… من غير ما تترشح! 🥭\n\nفي الصين سنة 1968، هدية مانجا لماو وصلت لفرق العمال في جامعة تسينغهوا. ومن هدية، الفاكهة اتحولت لرمز سياسي. بعض الثمار اتحفظت بالشمع أو الفورمالدهيد، ورموز المانجا ظهرت في الدعاية والاحتفالات.\n\nإحنا بنفكر نلحق ناكلها قبل ما تستوي زيادة… هناك كانوا بيفكروا يحافظوا عليها! المفارقة في الرمز، مش سخرية من الناس أو معاناتهم.\n\nلو فتحت أرشيف فاكهة تانية، تختار إيه؟',
 instagram:'مانجا… بس الملف مش وصفة عصير 🥭\nهدية في أغسطس 1968، وبعدها رمز سياسي وحكاية حفظ غريبة. اقلب الشرائح وشوف الفاكهة خدت إيه من التاريخ.\nاحفظ الحلقة لو بتحب الحكايات اللي مستخبية في التفاصيل.',
 pinterest:'اكتشف قصة المانجا في الصين سنة 1968: من هدية دبلوماسية إلى رمز سياسي، ضمن سلسلة أرشيف الفواكه من Fruit City. قصة تاريخية موثقة ومراجع للقراءة. رابط المقال يضاف بعد نشره.',
 tiktok:'استنى… المانجا دي دخلت السياسة! هدية لماو سنة 1968، اتنقلت لعمال في تسينغهوا. بعدها بقت رمزًا، واتحفظت بعض الثمار بالشمع أو الفورمالدهيد. إحنا عايزين نلحق الموسم… دي لحقت موكب! مش وصفة عصير؛ حكاية رمز سياسي. تختار نفتح ملف أنهي فاكهة بعد كده؟',
 'instagram-reels':'مانجا تتحفظ بدل ما تتاكل؟! في الصين سنة 1968، الهدية بقت رمزًا سياسيًا. ومن طرق الحفاظ على بعض الثمار: الشمع والفورمالدهيد. الحكاية دي للأرشيف… مش للمطبخ. احفظ الريل وارجع للمصادر في الحلقة.',
 'facebook-reels':'تفتكر المانجا ممكن تدخل التاريخ من أوسع باب؟ سنة 1968 هدية وصلت لماو، ومنه لفرق العمال. ظهرت بعدها في الدعاية والاحتفالات. الفاكهة كانت شايلة معنى سياسي أكبر من حجمها. مين صاحبك اللي يحب الحكاية دي؟',
 webapp:e.story};
e.platformContent.forEach(c=>{c.imageHook=e.hooks[0].text;c.caption=copy[c.platform];c.description=c.platform==='pinterest'?'تاريخ المانجا، الصين 1968، ماو، هدية باكستان، أرشيف الفواكه':e.summary;c.cta=c.platform==='facebook'?'تحب الحلقة الجاية عن فاكهة إيه؟':c.platform==='instagram'?'احفظ الحلقة وشاركها مع صاحبك الفضولي.':c.platform==='pinterest'?'اقرأ المصادر؛ رابط المقال ينتظر النشر.':'Fruit City — كل عصير وراه حكاية.';c.claimIds=c.platform==='webapp'?e.claims.map(x=>x.id):['C1','C2','C3','C4'];c.approvalStatus='needs-review';c.seo={title:e.eventTitle,description:e.summary,canonicalUrl:null,menuItemIds:['PJ01'],relatedEpisodeIds:[]};if(c.platform.includes('reels')||c.platform==='tiktok')c.scenes=[{seconds:'0–2',onScreen:c.platform==='instagram-reels'?e.hooks[1].text:e.hooks[0].text,visual:'المنتج الأصلي بعد اعتماد الأصل؛ حاليًا معاينة',audio:'صوت أصلي؛ لا موسيقى غير مرخصة'},{seconds:'2–10',onScreen:'أغسطس 1968 — هدية من باكستان',visual:'بطاقة زمنية مصممة وليست صورة تاريخية',claimIds:['C1']},{seconds:'10–20',onScreen:'الهدية توصل لفرق العمال',visual:'نصوص ورسوم زمنية؛ لا لقطات مزيفة',claimIds:['C2','C3']},{seconds:'20–30',onScreen:c.platform==='tiktok'?'فاكهة… في موكب؟':'اتحفظت بدل ما تتاكل',visual:'بطاقة معلومة ومصدر',claimIds:c.platform==='tiktok'?['C6']:['C4']},{seconds:'30–38',onScreen:c.cta,visual:'الكوباية الأصلية بعد الاعتماد',audio:'Fruit City — كل عصير وراه حكاية.'}];});
e.platformContent.find(c=>c.platform==='instagram').slides=[{hook:e.hooks[0].text,text:'افتح ملف الصين 1968',claimIds:['C3']},{hook:'الهدية راحت لمين؟',text:'لماو، وبعده فرق العمال في تسينغهوا',claimIds:['C1','C2']},{hook:'اتحفظت… بدل ما تتاكل؟',text:'بعض الثمار حُفظت بالشمع أو الفورمالدهيد',claimIds:['C4']},{hook:'الفاكهة بقت رمز',text:'الدعاية والقطع التذكارية تحمل صورتها',claimIds:['C5']},{hook:'أنهي فاكهة نفتح ملفها؟',text:'Fruit City — كل عصير وراه حكاية. المصادر في ملف الحلقة.',claimIds:[]}];
e.editorialStatus='needs-review';e.visualStatus='blocked';e.stages={...e.stages,event:'approved',research:'needs-review',claims:'needs-review',story:'needs-review',hooks:'needs-review','hook-selection':'needs-review',design:'needs-review',product:'blocked',platforms:'needs-review',qa:'needs-review',approval:'blocked',export:'blocked',reproduction:'approved',performance:'draft'};
const saved=saveEpisode(base,e,0);
for(const [name,value]of Object.entries(buildPackage(saved))){if(name==='episode.json')continue;const file=path.join(base,id,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,typeof value==='string'?value:JSON.stringify(value,null,2));}
fs.mkdirSync(path.join(ROOT,'templates'),{recursive:true});fs.writeFileSync(path.join(ROOT,'templates','episode-template.json'),JSON.stringify({schemaVersion:1,description:'createEpisode يستورد الصنف من المنيو؛ لا اسم فاكهة أو حدث ثابت',input:{id:'unique-event-id',menuItemId:'EXISTING_MENU_ID',eventTitle:'REQUIRED',country:'REQUIRED',year:'REQUIRED'},stages:Object.fromEntries(Object.keys(e.stages).map(s=>[s,'draft'])),variables:['fruit','event','country','year','claims','sources','palette','assets','hooks','platformContent'],renderer:'public/render.js',exporter:'core.mjs#buildPackage'},null,2));
console.log('Created mango episode and review assets; no publication approval.');

