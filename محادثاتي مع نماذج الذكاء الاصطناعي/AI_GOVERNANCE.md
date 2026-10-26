# 🧠 AI Meta-Governance & Project Master Memory
> **مشروع نظام إدارة فاكهة سيتي (Fruit City Management System)**  
> **الدستور المرجعي الموحد لجميع نماذج ووكلاء الذكاء الاصطناعي (Codex, ChatGPT, AntiGravity)**

---

## 🎯 1. الغرض والهدف (Scope & Purpose)
هذا الملف هو **المصدر الوحيد للحقيقة (Single Source of Truth)** لذاكرة وسياق المشروع.  
تم تصميمه ليعمل كـ **"ذاكرة مركزية مشتركة"** بين جميع أدوات ونماذج الذكاء الاصطناعي المختلفة لضمان:
1. عدم حدوث أي تضارب معرفي أو برمجي (Zero Context Drift).
2. فهم أي نموذج يدخل المشروع للحالة اللحظية فوراً دون الحاجة لإعادة شرح التفاصيل في كل محادثة.
3. التزام جميع النماذج بالمعايير الفنية والقيود التشغيلية المتفق عليها.

---

## 🏢 2. هوية المشروع ومجال العمل (Project Identity & Domain)
* **اسم المشروع والبراند المعتمد:** **Fruit City** (حصراً باللغة الإنجليزية: `Fruit City`).
* **⚠️ قاعدة الاسم التجاري والواجهة الصارمة (Strict Brand Identity Rule):**
  الاسم التجاري الرسمي المعتمد على واجهة المحل، والأكواب، وبوستات السوشيال ميديا هو دائماً **Fruit City** بالإنجليزية فقط. يُمنع منعاً باتاً استبداله بـ "فاكهة سيتي" في الهوك أو البوستات أو التصاميم الإعلانية.
* **طبيعة النشاط:** تجارة وتجزئة الفواكه والخضروات، ويشمل:
  * نقاط البيع المباشرة (POS) ودعم الموازين والباركود.
  * إدارة المخزون (Inventory Management)، الأصناف سريعة التلف، ونسب الهالك اليومي.
  * إدارة المبيعات والحسابات والورديات وصندوق الكاشير.
  * قنوات الطلب المتعددة (فروع مباشرة + طلبات أونلاين/واتساب).
* **المسار الجغرافي والبرمجي الدائم للمشروع:**
  * 📍 **`D:\fruit city project`**
  * ⚠️ **تحذير إلزامي لكل النماذج:** يمنع منعاً باتاً إنشاء أو تشتيت أي ملفات، مشاريع فرعية، أو مجلدات في بارتيشن `C:` أو `Desktop` أو مسارات مؤقتة. هذا المسار في القرص `D:` هو الحاضنة الوحيدة والنهائية لكل ما يخص المشروع.

---

## 💻 3. مواصفات بيئة التشغيل والعتاد (Hardware Profile & Constraints)
* **الجهاز المضيف:** Dell Inspiron 5521
* **المعالج (CPU):** Intel Core i5-3337U (Dual-Core @ 1.80GHz - Ivy Bridge)
* **الذاكرة العشوائية (RAM):** 8GB DDR3
* **التخزين:** SSD
* **نظام التشغيل:** Windows 11

### ⚠️ قيود معمارية إلزامية لجميع النماذج:
1. **تجنب الحلول الثقيلة (No Heavy Tech):** يمنع اقتراح تشغيل حاويات (Docker / Kubernetes) أو خدمات خلفية مستمرة تستهلك الذاكرة والـ CPU على هذا الجهاز.
2. **حزمة التكنولوجيا المعتمدة (Lightweight Stack):**
   * **الواجهة الأمامية (Frontend):** React + Vite (سريع وخفيف جداً في الـ Build).
   * **الخلفية (Backend):** Node.js / Express أو بنية سريعة وخفيفة.
   * **قاعدة البيانات (Database):** SQLite (أو Better-SQLite3) لضمان السرعة الفائقة وعدم استهلاك موارد RAM في محركات قواعد بيانات منفصلة مثل PostgreSQL أو MySQL سيرفر محلي، مع إمكانية الترقية السحابية لاحقاً.

---

## 🤖 4. ميثاق عمل نماذج الذكاء الاصطناعي (Rules of Engagement)

### 📌 تقسيم الأدوار والمسؤوليات التشغيلية (Division of Labor & Runtime Ownership):
* **AntiGravity (Google / Gemini Orchestrator):**
  * **إدارة الخدمات الحالية (Live Runtime):** يدير تشغيل خادم الكاشير (`server.js` على المنفذ `5173`) ككاتب أحادي لقاعدة البيانات، وبوت التيليجرام الإداري (`admin_bot.js`).
  * **محرك الصوت والذكاء الاصطناعي للبوت:** البوت يعمل بموديل **Gemini Flash** لتحويل فويس نوت إسلام لنصوص وفهم العامية المصرية وسوق العبور.
  * **إدارة الحوكمة والمزامنة:** مسؤول عن تنظيم الملفات، التوثيق، الحوكمة، ومزامنة GitHub والـ SSH.
* **OpenAI Codex (Desktop & CLI Code Engineering):**
  * **الهندسة البرمجية وتطوير الكود:** كتابة الوظائف البرمجية (Business Logic)، بناء المكونات (UI Components)، تصميم استعلامات SQLite، وحسابات التكلفة والمخزون.
  * **عدم تعارض العمليات:** يقرأ ملفات المشروع والتوثيق، ولا يقوم بتعديل أو تعطيل خادم الكاشير أو البوت أثناء تشغيلهما إلا بتكليف صريح ومستقل.
* **ChatGPT (Projects & Cloud Work):**
  * **طبقة التخطيط والمتابعة العامة:** متابعة الخطط الاستراتيجية، مراجعة التقارير، والربط السحابي عبر مستودع GitHub المعتمد.

### 📌 القواعد الذهبية الملزمة لأي نموذج (Universal Rules):
1. **القراءة أولاً (Read First):** لا تقم بأي تعديل أو كتابة كود قبل قراءة هذا الملف وملف `AGENTS.md` في جذر المشروع وسجل التسليم أدناه.
2. **المحافظة على هيكل المسار وفصل المستودعات:**
   * مستودع ومجلد `D:\fruit city project` مخصص للمستندات والمنيو والتسويق والحوكمة.
   * **الكود التنفيذي الفعلي للكاشير والبوت وقاعدة البيانات:** يعمل في `C:\Users\MR.X\.gemini\antigravity\scratch\fruit-city-system`. يمنع نقله أو نسخه أو إعادة بنائه دون تفويض صريح.
3. **بروتوكول التسليم والتناوب الموثوق بين النماذج (Manual AI Relay Protocol):**
   * **المستودع السحابي المعتمد:** `https://github.com/atefislma312-a11y/fruit-city-project` (SSH: `git@github.com:atefislma312-a11y/fruit-city-project.git`).
   * **الهدف:** تمكين المالك عند اختياره أداة بديلة من قول «كمّل من آخر تسليم» فتفهم الحالة وتكمل دون إعادة شرح. جيت هاب لا يبدل النماذج تلقائياً ولا يشغل نفسه وحده؛ بل هو نقطة التقاء آمنة بين أدوات الذكاء الاصطناعي.
   * **قاعدة الحفظ والتسليم الدوري (Save at Milestones):**
     يجب الحفظ والتسليم عند كل نقطة عمل مهمة وقبل إنهاء الجلسة، **وليس فقط عند نفاد الرصيد**. لا يمكن التنبؤ بلحظة نفاد الرصيد بدقة ولا يمكن ضمان الحفظ في اللحظة الأخيرة.
   * **ترتيب التسليم:** يُكتب تقرير التسليم في سجل الحوكمة **قبل** عمل Commit وPush.
4. **تعليمات المساعد المستلم (Incoming Assistant Mandates):**
   * يفحص المسار (`D:\fruit city project`) والفرع (`main`) والتغييرات المحلية أولاً عبر `git status`.
   * يتحقق من أحدث نسخة سحابية بطريقة لا تضيّع العمل: يستخدم `git fetch origin main` ثم `git status -uno` للمقارنة الآمنة.
   * ❌ **ممنوع قطعي:** عمل `git pull` أعمى، أو `git reset --hard`، أو `git clean -fd`، أو `git push --force`.
   * في حال وجود تعارض (Conflict)، يحافظ على الطرفين دون حذف، ويبلّغ المالك فوراً.
5. **الالتزام بالحفظ المنضبط (Selective Safe Staging):**
   * لا تستخدم `git add .` بلا مراجعة. يتم رفع الملفات المقصودة فقط.
   * استبعاد الأسرار (`.env`, `password.txt`, `.meta_token`, `*.token`, `*.key`) وقواعد البيانات (`*.db`, `*.sqlite`) والنسخ الاحتياطية.
6. **التوثيق الإجباري في سجل التسليم الموحد:** قبل إنهاء الجلسة، يجب تحديث السجل الموحد في القسم (6).

---

## 🗂️ 5. الهيكل التنظيمي المعتمد للمشروع (Target Directory Structure)

```text
D:\fruit city project\
│
├── محادثاتي مع نماذج الذكاء الاصطناعي\    # العقل المركزي: التوجيهات، الذاكرة، ودستور النماذج
│   ├── AI_GOVERNANCE.md                # هذا الملف المرجعي الحاكم
│   ├── PROJECT_MASTER_SUMMARY.md       # الملخص التنفيذي الشامل وسجل كل تحديث يطرأ على المشروع
│   └── prompts_archive/                # أرشيف البرومبتات المتخصصة والأوامر المهمة
│
├── الصور\                               # أصول التصميم وتوجيهات المقاسات البصرية
│   ├── README.md                       # الفهرس الشامل وجدول المقاسات السريع
│   ├── brand_story_and_canva\          # محرك قصة البراند وأتمتة Canva ومجلد الصور المرجعية
│   ├── facebook\README.md              # مقاسات وتوجيهات فيسبوك (أغلفة، بوستات، ستوري)
│   ├── instagram\README.md             # مقاسات وتوجيهات إنستجرام (بورتريه 4:5، ريلز)
│   ├── website\README.md               # مقاسات المتجر والـ POS وضغط WebP للمنتجات
│   └── twitter_x\README.md             # مقاسات وتوجيهات منصة إكس / تويتر
│
├── docs\                               # التوثيق العام ودراسات البزنس ومتطلبات الشاشات
│   └── menu\                           # نظام إدارة وتكويد المنيو (README.md, OFFICIAL_MENU.md, menu_items.json)
│
└── app\                                # مجلد الكود البرمجي التنفيذي الموحد (عند البدء فيه)
    ├── client\                         # كود الواجهة (React + Vite)
    ├── server\                         # كود الخادم (Node.js API)
    └── data\                           # ملفات قاعدة البيانات المحلية (SQLite)
```

---

## 🔎 توضيح منصات الذكاء الاصطناعي وقدراتها — 22 أكتوبر 2026

أضيف هذا التوضيح بطلب إسلام لمنع الخلط بين اسم الأداة، وواجهة استخدامها، ومكان تنفيذ العمل.

- **Codex على الكمبيوتر (تطبيق سطح المكتب):** يستطيع قراءة ملفات المشروع ومراجعة الكود وتعديله وتشغيل الأوامر والاختبارات ضمن الأدوات والصلاحيات المتاحة. واجهة الشات ليست للشرح فقط. الجلسة التي أضافت هذا التوضيح مرتبطة بمجلد `D:\fruit city project`، وقد قرأت ملفات المشروع فعليًا.
- **Codex CLI:** كلمة CLI تعني «واجهة سطر الأوامر». هي طريقة استخدام Codex داخل Terminal أو PowerShell، ويمكن توجيهه بطلبات باللغة العادية. يستطيع العمل على الملفات المحلية حسب الصلاحيات؛ لا يلزم فتح CLI منفصل لإنجاز مهمة متاحة بالفعل داخل تطبيق Codex.
- **Codex السحابي / عبر الويب:** يستطيع تنفيذ مهام برمجية في بيئة العمل المتاحة له، وليس مجرد مناقشة الكود. وجوده في المتصفح لا يمنحه تلقائيًا الوصول إلى ملفات الجهاز أو القرص D؛ يجب التحقق من البيئة والربط والصلاحيات الفعلية.
- **ChatGPT وWork وProjects:** لا تُستخدم هذه الأسماء كمرادفات تلقائية لـCodex CLI أو Codex السحابي. عند تكليف أي جلسة، تُحدد الأدوات ومكان التنفيذ وإمكانية الوصول للمشروع فعليًا. تجنب المسمى الملتبس «ChatGPT Codex (Work)» دون تحديد المقصود.
- **Antigravity:** أداة مستقلة؛ وجوده مع Codex في جدول الأدوار لا يثبت وجود اتصال أو تبادل تلقائي للمهام أو الملفات بينهما.

### تعليمات للمساعد التالي

1. فرّق بين **القدرة التقنية** و**تفويض المهمة**: القدرة على التعديل لا تعني أن المستخدم طلب التعديل.
2. تحديد مسار D كمرجع للمشروع لا يثبت أن الأكواد القديمة نُقلت إليه. افحص الموجود وحافظ على العمل السابق قبل أي توحيد أو نقل.
3. ملف البرومبت الهندسي يشرح سياق المشروع والمراجعة المطلوبة؛ نسخه إلى أداة أخرى لا يربط الأدوات، ولا ينقل الملفات، ولا ينشئ ذاكرة متزامنة تلقائيًا.
4. اقرأ المرجع عند بدء العمل، ولا تدّع أن كل مساعد يقرأه تلقائيًا دون التحقق من إعداداته.
5. تكليف 22 أكتوبر الخاص بهذا التوضيح يسمح بتحديث التوثيق في هذا المجلد فقط؛ لا يمنح تفويضًا لإصلاح الكود أو نقله أو تشغيل البوت أو تغيير قاعدة البيانات أو النشر. نتائج الجرد السابقة تظل قراءة فقط إلى أن يطلب المالك مهمة تنفيذ محددة.

المراجع الرسمية التي استند إليها التوضيح: [Codex CLI](https://learn.chatgpt.com/docs/codex/cli)، [بيئات تنفيذ Codex](https://learn.chatgpt.com/docs/environments/modes).

## 📝 6. سجل التسليم الموحد والذاكرة اللحظية (Unified Live Handoff Registry)
### 2026-10-26 — HTTP abuse and authorization hardening
- Changed web_app/order_sandbox/http.mjs, intake.test.mjs, README.md; added request-limit.mjs and http-hardening.test.mjs.
- Added bounded per-peer request limits/429/Retry-After, ignoring forged forwarded IP; disallowed bridge credentials on staff commands; rejected duplicate credentials/missing actor IDs and non-object JSON.
- Verified 44 sandbox tests passed, zero skipped with SQL.js enabled, including concurrent flood/expiry/capacity and authorization regression tests. Old fixture actor ID and null-body expected status updated after initial failures. No UI edits or browser test this turn.
- Remaining: actual cashier writer integration, production identity/token lifetime enforcement, trusted proxy/distributed limits, retention/backups, RF/weight mappings and approved delivery boundaries. Local limiter is not production load or DDoS qualification. No live data/service/public deployment changes.

### 2026-10-26 — isolated SQL.js durable writer qualification
- Implemented web_app/order_sandbox/sqljs-writer.mjs; added sqljs-writer.test.mjs, updated README.md and CHECKPOINT_2026-10-26.md.
- Atomic temporary-file replacement after fsync; failed persistence restores memory and rejects receipt. Queued synchronous transactions, preserved foreign keys. No production file opened.
- Verified 41 sandbox tests passed, zero skips with explicit SQL.js dependency; two new tests also passed with empty actual POS schema. Write/fsync/rename failures preserve old bytes; failed preparation keeps stock and outbox pending; retry and reopen after lost ACK deduct once. Initial integration assertion needed revision default zero and was corrected before successful reruns.
- Not installed in cashier server: existing direct saveDatabase/runTransaction still require coordinated development integration across all writes. Single-process exclusive ownership required; no multi-process or power-loss qualification. Other pending gates: RF/weight mappings, verified delivery boundaries, production authentication/privacy/rate limits and rollout approval. Public site and live cashier unchanged.
### 2026-10-26 — web staff acceptance and prior handoff completion
- Prior bridge milestone 31cc2e9: reviewed/preserved integration work, fixed command replay shape, Fruit City branding; 35 sandbox and 3 storefront tests plus build passed then. Previous local handoff is now recorded here without staging unrelated handoffs.
- Added staff workflow UI and explicit integrated synthetic demo; session expiry/revocation and role spoofing tests; shared ingredients/multiple sizes with 20 concurrent duplicate preparation deliveries. Latest full sandbox run: 39 passed, 0 failed. Seven bridge tests passed with empty actual-schema fixture. App tests 3 passed and build passed.
- Browser verified customer quote/confirm -> staff accept/prepare/ready/handed off -> verified synthetic cash -> completed, reflected to customer; completion disabled before payment; store closure prevents new quote. Evidence web_app/order_sandbox/staff-completed-test.png. No production write/deployment.
- Approved delivery fees: Garden City 20; Zamalek and Manial 40; Sayyida Zeinab and Downtown 35 EGP. Owner clarified Manial. 5km remains; zone mapping unverified so public delivery stays disabled.
- Files: app_code/src/Checkout.jsx; order_sandbox/http.mjs, authorization.test.mjs, bridge.test.mjs, dev-integrated.mjs, delivery.mjs, delivery.test.mjs, operating-config.json, staff-completed-test.png, CHECKPOINT_2026-10-26.md; OPERATING_REQUIREMENTS.md; this registry.
- Remaining: cashier writer commits memory before direct disk save; durable failure recovery must be fixed/tested before runtime adapter. RF/weight mapping, geographic delivery validation, production identity/rate limits/retention/load and deployment remain. Full limits and reproduction in CHECKPOINT_2026-10-26.md. Unrelated working-tree records/files preserved.

### 2026-10-26 — web bridge resume verification
- Reviewed preserved local bridge work, fixed identical command replay response, updated development storefront to Fruit City branding. 35 sandbox tests + 3 storefront tests passed; build passed; 5 bridge tests passed against empty actual-schema fixture. No production access or deployment. Full changed-file list, limitations and next steps: web_app/order_sandbox/CHECKPOINT_2026-10-26.md. Existing unrelated local changes preserved.


### 2026-10-25 — Fruit Archives: استوديو محلي وحزمة مانجا للمراجعة

- **الهدف:** تنفيذ البريف المرفق: تدقيق الأصول، حزمة مانجا الصين 1968، قالب عام، أول أتمتة عملية، وتحقق من الإدخال للتصدير.
- **المثبت:** `fruit_archives/` تطبيق Node محلي على 127.0.0.1:5186 بلا حزم إضافية؛ استيراد 108 إدخالات من المنيو وPJ01 للمانجا؛ حلقات مستقلة ونسخ وحفظ مع رفض التعديل القديم؛ محرر عربي، هوكات A/B، معاينات المنصات، المصادر والحقوق، تصدير JSON/HTML/نصوص وصور. حزمة المانجا تشمل 9 مصادر و7 سجلات ادعاءات و7 نسخ منصات ومشاهد فيديو وبيانات كاروسيل؛ 42 صورة مسودة مصححة (7 منصات × A/B × PNG/JPG/WebP). سجل أحدث حزمة في `fruit_archives/LATEST_PACKAGE.json`.
- **الاختبارات:** 8/8 Node ناجحة (منيو، نسخ، تحقق، XSS في المقال، HTTP، رفض أصل غير معتمد). اختبار متصفح للحفظ والتصدير والفحص الرافض للاعتماد؛ موبايل 390×844: عرض المحتوى/التمرير 375/375 بلا تجاوز أفقي. فحص أبعاد 14 PNG؛ JPG/WebP ناتجان فعليًا من المتصفح مع توقيع ملف متحقق بالخادم. SHA-256 يثبت تطابق نسخ الأصلين مع ملفاتهما. أخطاء مسار ويندوز وحد الصورة والمقاس الأفقي عولجت قبل التسليم. أدلة `episodes/mango-china-1968/qa/verification.json` و`qa/studio-review.png`.
- **قرار المالك:** صورة cup-reference.png تستخدم **للمراجعة فقط لحين تأكيد الأصل**؛ لا تعد MASTER CUP V1 معتمدة أو ذات حقوق تجارية مثبتة. لا اعتماد نشر ولا نشر خارجي.
- **الحدود:** التصميم الحالي تخطيطي وليس إتمامًا للمرجع السينمائي؛ حقوق الخلفيات السابقة غير محسومة ولم تدخل الصور الجديدة. فيديو/صوت وكاروسيل مصور نهائي غير منفذ، متاح نصوص ومشاهد وشرائح بيانات. البحث والتحقق بشريان؛ مولّد الهوكات تمهيدي بقوالب، لا تكامل AI/API مدفوع. المصادر/المشاهد/الأداء تعدل من JSON؛ لا خدمات إحصاءات أو نشر أو ربط مقال بالمتجر. الاعتماد النهائي معطل صراحة في v0.1، لا ادعاء تنفيذ نظام إنتاج كامل.
- **الملفات:** إضافة مجلد `fruit_archives/` (البرنامج والواجهة والقالب والاختبارات والأصول المنسوخة وحزمة الحلقة والجرد والتوثيق) وتعديل هذا القسم فقط. ملفات order_sandbox وAGENTS.md وdevelopment القائمة محفوظة، لا تعديل كاشير أو إنتاج.
- **Git:** main مع تعديلات قائمة؛ fetch فشل Permission denied على FETCH_HEAD. لم ينفذ commit/push أو يدع تطابق السحابة.
- **التالي:** اعتماد أصل الكوباية وحقوقه ثم مراجعة الهوكات والنصوص والتصميم؛ استكمال الأصول السينمائية المرخصة والفيديو قبل النشر. طريقة التشغيل والإضافة والقيود في `fruit_archives/README.md`، والجرد في `fruit_archives/audit/FINDINGS.md`.

### 2026-10-25 — إيقاف متابعة Lovable القديمة لتجنب مسارين متعارضين
- **الهدف:** مراجعة جدوى متابعة النموذج القديم مقابل الحالة المرجعية الأحدث قبل أي برمجة.
- **المثبت فعليًا:** فحص main وgit fetch origin main ثم status؛ الفرع متزامن، مع الحفاظ على AGENTS.md المعدل وdevelopment/ غير المتتبع. مراجعة هذا السجل وPROJECT_MASTER_SUMMARY.md أثبتت وجود واجهة محلية أحدث في web_app/app_code ونشر منيو عبر Sites واختبارات استقبال معزولة. آخر رسائل Lovable لم تتغير منذ 19 أكتوبر؛ لم يُرسل طلب بناء جديد أو يُستهلك كريدت في هذه المراجعة.
- **الإجراء:** حذف المتابعة automation الخاصة باستكمال نموذج Lovable القديم؛ لا حذف لمشروع Lovable أو الكود أو البيانات. المرجع العملي هو المشروع الحالي وتسليماته، لتجنب تطوير نسخة قديمة منفصلة بمنتجات تجريبية.
- **الملفات المتغيرة:** هذا السجل وسجل المتابعة المحلي خارج المستودع؛ إعداد المتابعة المحذوف. لم يُعدّل كود المتجر أو POS أو قاعدة الإنتاج أو البوت.
- **الاختبارات:** مراجعة قراءة فقط لحالة Git والسجلات ورسائل Lovable؛ لا اختبارات تشغيل أو ربط جديدة ولا ادعاء اكتمال الاستقبال الفعلي.
- **المتبقي والخطوة التالية:** الاستكمال من أحدث تسليم المشروع الحالي عند التكليف؛ اختبار قبول واجهة الهاتف وربط receiver مصادق مع الكاشير والمخزون وفق حدود الخدمة المعزولة. لا نشر أو مدفوعات أو تغيير أمني تلقائي.

### 2026-10-25 — customer validation and durable receiving contract
- Implemented required normalized Egyptian mobile for pickup, bound to quote/order; rejected legacy unconfirmed quotes without contact. UI restores saved phone/payment intent across reload.
- Added isolated receiver with durable event/order deduplication, payload conflict detection and post-commit ACK. Lost ACK and reopened receiving DB produce one pending order. No cashier installation or stock/sale write.
- Changed: web_app/order_sandbox/customer.mjs, customer.test.mjs, receiver.mjs, receiver.test.mjs, intake.mjs, intake.test.mjs, workflow.test.mjs, README.md; web_app/app_code/src/Checkout.jsx; this registry.
- Tests: 30 sandbox passed, targeted customer recheck passed after legacy guard; Vite build passed; existing isolated POS orderRules 4 passed. New phone UI browser acceptance not tested. Windows test cleanup ordering fixed after first failure.
- Remaining: RF/weight mapping, actual authenticated POS receiver and ingredient transaction integration, delivery address/fees, privacy retention and broader UI/security/load verification. No production writes/deployment. Existing unrelated AGENTS.md and development/ preserved.
### 2026-10-25 — isolated web order workflow checkpoint
- Owner approvals: primary price-source branch branch_downtown_cairo (City Management System), Maps center 30.035505/31.233777 confirmed same shop despite outdated listing, deduct ingredients at preparation. Delivery fees remain unapproved examples.
- Implemented in development: audited role-constrained workflow, command idempotency/revisions, preparation outbox awaiting synthetic bridge ACK, manual payment verification/settlement/refund state separation, cancellation waste review, isolated radius validation, opt-in React checkout/staff scaffolds.
- Changed files: web_app/order_sandbox/{workflow.mjs,workflow.test.mjs,delivery.mjs,delivery.test.mjs,operating-config.json,dev.mjs,http.mjs,intake.mjs,README.md}; web_app/app_code/{src/main.jsx,src/Checkout.jsx,vite.config.js}; this handoff.
- Verified: sandbox 25 passed/0 failed, storefront 3 passed/0 failed, Vite build passed. Browser acceptance not verified. No production database writes or public deployment.
- Remaining: approved-source live feed adapter and RF mapping; client retry across reload/contact validation; staff controls/auth lifecycle; real POS receiver, stock transactions and end-to-end tests; delivery fees/zones; load/security review. Current ACK does not prove actual stock deduction. See sandbox README for development-only limits.
- Preserve unrelated AGENTS.md and development/ changes. Commit/push outcome must be checked in Git, not inferred from this entry.

### خدمة استقبال معزولة وربط الكتالوج — 2026-10-25 — Codex

- **الهدف:** استكمال الداخل التشغيلي تدريجيًا دون نشر أو تعديل إنتاج.
- **المكتمل:** مطابقة أكواد وأحجام مع رفض الالتباس؛ 108 مطابقات و16 RF موقوفة؛ بوابة أسعار معتمدة لفرع واحد بصلاحية زمنية. تطوير OrderSandbox بعرض سعر وتأكيد إجمالي ورقم طلب وحفظ ذري وoutbox وإقرار استلام؛ API اختبار مع صلاحيات وصول لصندوق الطلبات وتتبع الطلب بالرمز.
- **الاختبارات:** 19/19 لخدمة الطلبات والكتالوج؛ منها 40 تأكيد HTTP متزامن أعادوا أوردرًا واحدًا. رفض تغير السعر والتوافر/انتهاء العرض؛ rollback محقون؛ بقاء الطلب عند فشل الإشعار؛ 3/3 للواجهة وbuild ناجح. اختبارات orderRules لنسخة تطوير الكاشير 4/4؛ لا إثبات تكامل مخزون أو HTTP الكاشير.
- **الملفات:** web_app/order_sandbox/{service.mjs,catalog.mjs,catalog.test.mjs,pos-identifiers.json,intake.mjs,intake.test.mjs,http.mjs,README.md} وهذا السجل فقط. AGENTS.md وdevelopment تعديلات قائمة خارج هذه الدفعة.
- **المتبقي:** لا أسعار حقيقية معتمدة؛ لا ربط واجهة/API أو كاشير؛ لا حالات قبول/تحضير أو خصم مخزون أو دفع فعلي؛ لا geofence أو لوحة مدير. لا ادعاء اكتمال النظام. وثيقة README تفصل حدود الاختبارات.
- **الخطوة التالية:** اعتماد الفرع ومصدر السعر وRF/الوزن؛ مراجعة اكتمال إصلاحات الكاشير ثم واجهة استقبال مع قبول مستقل وreceiver يمنع التكرار، واختبار معزول للحدث المعتمد لتحريك المخزون. لا نشر دون موافقة منفصلة.

### نشر رابط المنيو وQR — 2026-10-24 — Codex

- **المكتمل:** بعد موافقة إسلام الصريحة تم تفعيل public ونشر نفس النسخة المحفوظة بنجاح عبر Sites. الرابط والمعرفات في web_app/HOSTING_STATUS.md.
- **الاختبار:** المتصفح فتح المنيو وعرض 124 صنفاً؛ اختيار مانجا وإضافتها للسلة نجح ثم حذف عنصر الاختبار. لا إرسال واتساب ولا ربط كاشير.
- **الملفات:** تحديث HOSTING_STATUS.md وهذا السجل؛ QR بصيغتي PNG وSVG وصورة فحص داخل web_app/qr.
- **المتبقي:** تأكيد المسح من موبايل المالك؛ هذه تجربة منيو وسلة ومسودة واتساب فقط. لا شراء دومين أو اشتراك جديد.


### تسليم تجهيز استضافة تجربة المنيو — 2026-10-24 — Codex

- **الهدف:** رابط تجربة لا يعتمد على تشغيل الكمبيوتر.
- **المكتمل والمثبت:** إنشاء مشروع Sites واحد وحفظ النسخة 1 من ملفات المنيو المبنية؛ تفاصيل المعرفات في `web_app/HOSTING_STATUS.md`. رفع وحفظ 7 ملفات بنجاح؛ لا نشر ولا اختبار رابط عام بعد.
- **العائق:** مراجعة الموافقة التلقائية رفضت تغيير الجمهور إلى public لأن عبارة «خلاص تمام» لم تعتبر موافقة صريحة على الإتاحة لأي شخص. لا تجاوز للرفض.
- **الملفات المتغيرة:** `.gitignore`، `web_app/HOSTING_STATUS.md` وهذا السجل. checkout وحزمة النشر مولدان ومستبعدان من Git الرئيسي.
- **ما تبقى والخطوة التالية:** موافقة صريحة للإتاحة العامة ثم نشر نفس النسخة المحفوظة واختبار المتصفح وتوليد QR. لا شراء أو اشتراك مدفوع، ولا تغيير بالكاشير أو قاعدة الإنتاج.

### تسليم تجربة QR على الواي فاي — 2026-10-24 — Codex

- **الهدف:** فتح المنيو من موبايل إسلام المتصل بنفس شبكة الكمبيوتر.
- **المكتمل:** تشغيل معاينة build الثابتة على عنوان WiFi الحالي 192.168.1.3 ومنفذ 5175 فقط، وتوليد QR محلي لرابط /#menu باستخدام qrcode.react الموجود دون تثبيت. صفحة QR المؤقتة في web_app/app_code/dist/phone-test.html (مستبعدة من Git).
- **الاختبار:** HTTP 200 ثم متصفح عنوان الشبكة أظهر المنيو و124 صنفاً. فتحه من الموبايل نفسه ما زال ينتظر تأكيد إسلام؛ لا ادعاء نجاح مسح الكاميرا.
- **الحدود:** رابط مؤقت يتطلب استمرار تشغيل الكمبيوتر والخادم ونفس الشبكة؛ قد يتغير IP. لا تعديل جدار ناري أو راوتر أو كاشير أو إنتاج. السلة لا تزال تنتهي بمسودة واتساب وليس استقبال الكاشير.
- **الملفات المتغيرة:** هذا السجل فقط ضمن الملفات المتتبعة؛ صورة QR في مجلد visualizations المحلي.
- **التالي:** تأكيد فتحه من هاتف المستخدم؛ عند فشل الوصول افحص السبب قبل أي تعديل أمني.

### تسليم فحص التوافق والاختبار المعزول — 2026-10-24 — Codex

- **الهدف الحالي:** تنفيذ أول مرحلة من خطة ChatGPT، كشف التناقضات وتقديم دليل معزول قبل ربط الإنتاج.
- **ما اكتمل ومثبت فعلياً:** دمج a51133b بـfast-forward؛ فحص مصادر الكاشير وقراءة منتجات/أحجام وتجميع أسعار قاعدة القرص readOnly؛ 108 مطابقات كود من 124، صفر تطابق معرف مباشر، 16 صنف وزن غير مطابق. توثيق عوائق السعر/الحجم/المصادقة/خصم المخزون/الحفظ في `web_app/COMPATIBILITY_AUDIT_2026-10-24.md`.
- **ما تبقى:** خدمة HTTP وصلاحيات وعرض سعر مؤكد وحالات وأحداث وصندوق إرسال؛ اعتماد ربط الأصناف والأسعار؛ إصلاح وربط الإنتاج بتفويض منفصل؛ موقع المحل والرسوم والدليفري والنشر.
- **الملفات المتغيرة:** تقرير التوافق؛ `web_app/order_sandbox/service.mjs` و`service.test.mjs` و`README.md`؛ وهذا السجل. الكاشير/البوت/قاعدة الإنتاج لم تُعدّل.
- **الاختبارات ونتائجها الفعلية:** node --test web_app/order_sandbox/service.test.mjs: 7 passed / 0 failed، بيانات وهمية وقواعد ذاكرة وملف مؤقت. يثبت حفظ pending/unpaid والتسعير التجريبي ومنع التكرار عبر إعادة الفتح ورفض المدخلات والـrollback. لا HTTP ولا ضغط ولا وصول حقيقي للكاشير/واتساب.
- **العوائق والملاحظات:** مسار /api/orders القديم يخصم فوراً ويحوّل كل غير لتر إلى 400ml ويثق بسعر العميل؛ مفتاح خامة مشتركة قد يفوّت خصم سطر ثانٍ. لا مصادقة عامة ظاهرة في مسار الطلب. 862 صف سعر لفرعين ليست اعتماد أسعار نشر. لا يُفسر نجاح الاختبار المعزول كنجاح إنتاج.
- **الخطوة التالية المحددة:** بناء عقد استقبال مستقل واختبار HTTP/إعادة المحاولات ببيانات وهمية قبل أي ربط إنتاج، واعتماد المصدر والفرع والأسعار وخريطة SKU والحجم. لا تكرار بناء POS أو مخزون جديد.

### تسليم خطة النظام الداخلي للويب آب — 2026-10-24 — ChatGPT

- **الهدف الحالي:** إنهاء تخطيط النظام التشغيلي الداخلي لـ Fruit City Digital Store قبل تجميل الواجهة، مع تأجيل اختيار/ربط شركة الدليفري.
- **ما اكتمل ومثبت فعليًا:** إنشاء وثيقة الخطة `web_app/DIGITAL_STORE_INTERNAL_PLAN.md` وتسجيل المعمارية المقترحة، الوحدات والحالات وقواعد الأمان وأولويات التنفيذ. تم التحقق من وجود مستندات المنيو والحوكمة وقراءة تقارير الاختبار السابقة؛ لم يُنفذ كود جديد.
- **ما تبقى:** جرد توافق الويب آب مع الكاشير والمخزون قراءة فقط، ثم اختبار طلب معزول؛ خادم الطلبات واللوحات والتكاملات والمدفوعات والتقارير كلها متطلبات غير منفذة.
- **الملفات المتغيرة:** `web_app/DIGITAL_STORE_INTERNAL_PLAN.md`، و`محادثاتي مع نماذج الذكاء الاصطناعي/AI_GOVERNANCE.md` فقط.
- **الاختبارات ونتائجها الفعلية:** توثيق فقط؛ لم تُشغل اختبارات بناء أو متصفح أو كاشير جديدة. نتائج build و3 اختبارات Node تخص تسليم 2026-10-23 السابق.
- **العوائق والملاحظات:** لا وصول مباشر إلى ملفات جهاز المحل أو قاعدة الإنتاج بهذه الجلسة؛ لا تغيير للكاشير أو البوت أو البيانات، ولا شراء أو نشر. المدفوعات والدليفري معروضة كتصورات تحتاج قرارًا نهائيًا.
- **الخطوة التالية:** جرد الكود الحالي وواجهات ربط الكاشير قراءة فقط، والتأكد من مصدر السعر والتوافر، ثم تصميم اختبار منفصل لطلب غير إنتاجي.


*هذا السجل هو المصدر المرجعي الموحد والوحيد الذي يقرأه المساعد المستلم عند قول المالك «كمّل من آخر تسليم». يُحدث باستمرار عند كل نقطة عمل مهمة وقبل إنهاء أي جلسة عمل، ويُكتب قبل الـ Commit والـ Push.*

---

### تسليم متطلبات تشغيل المتجر — 2026-10-23 — Codex

- **الهدف الحالي:** تثبيت متطلبات إسلام للدومين والملكية وSEO والتوصيل 5 كم ووصول الطلب للكاشير وواتساب، مع تأجيل شكل الواجهة.
- **ما اكتمل ومثبت فعلياً:** حفظ `web_app/OPERATING_REQUIREMENTS.md` بمتطلبات المالك والتصميم المقترح وحدود النسخة الحالية ومصادر Google وCloudflare وWhatsApp الرسمية. مراجعة الأسعار العامة والتوثيق عبر الويب؛ لا شراء ولا نشر.
- **ما تبقى:** نقطة المحل المعتمدة، جرد الدومين القائم، اختيار البنية والميزانية، فحص ربط الكاشير، تنفيذ واختبار الخادم ونطاق التوصيل ولوحة الإدارة والإشعارات.
- **الملفات المتغيرة:** `web_app/OPERATING_REQUIREMENTS.md` وهذا السجل فقط.
- **الاختبارات ونتائجها الفعلية:** مراجعة توثيق فقط؛ لا اختبارات تشغيل جديدة ولا ادعاء تنفيذ نطاق 5 كم أو وصول طلب للكاشير. فحص Git diff قبل الحفظ.
- **العوائق والملاحظات:** دائرة المسافة لا تضمن 15–20 دقيقة؛ بيانات العملاء والأسرار لا تدخل GitHub؛ الإرسال التلقائي لواتساب يحتاج تحقق أهلية وتكلفة. لم يُعدّل الكاشير أو البوت أو قاعدة الإنتاج.
- **الخطوة التالية المحددة:** الحصول على نقطة المحل الدقيقة ثم فحص واجهة ربط الكاشير قراءة فقط، وبناء اختبار معزول قبل تفعيل الطلبات الحقيقية.

### تسليم واجهة العملاء — 2026-10-23 — Codex

- **الهدف الحالي:** بناء واجهة منيو وطلب أوردر للعملاء، وإكمال الطلب عبر واتساب حسب اختيار إسلام في هذه الجلسة.
- **ما اكتمل ومثبت فعلياً:** إنشاء النسخة الأولى داخل `web_app/app_code/` باستخدام React وVite، قراءة الكتالوج الأصلي مباشرة (124 إدخالاً)، البحث والأقسام والأحجام والسلة المحفوظة، تجهيز رسالة واتساب إلى رقم الطلبات المعتمد 01025966033. فتح معاينة محلية على 127.0.0.1:5174.
- **ما تبقى:** مراجعة التصميم؛ الأسعار والصور النهائية وضغط الصور؛ أوزان الفاكهة الكسرية؛ النشر العام بتكليف لاحق. لم تختبر رسالة حقيقية أو استلام المحل. لا تكامل مع POS ولا قاعدة الإنتاج.
- **الملفات المتغيرة:** `web_app/app_code/package.json`, `package-lock.json`, `index.html`, `src/catalog.js`, `src/order.js`, `src/main.jsx`, `src/style.css`, `tests/order.test.js`, `README.md`, `mobile-preview.png`؛ وهذا السجل.
- **الاختبارات ونتائجها الفعلية:** build نجح؛ 3 اختبارات Node نجحت و0 فشلت؛ npm audit صفر ثغرات معروفة وقت الفحص. المتصفح عرض 124 إدخالاً، فلتر الفاكهة 16، بحث مانجو داخل الفاكهة نتيجة واحدة؛ إضافة زجاجتين 500 مل والتحقق من بقائهما بعد reload؛ حذف الصنف والسلة الفارغة؛ داخل المحل يخفي العنوان. فحص موبايل 390×844: عرض المحتوى والتمرير 375 بكسل بلا overflow أفقي. صورة محفوظة محلياً.
- **العوائق والملاحظات:** كل الأسعار null، لذلك لا إجمالي وهمي؛ العميل يطلب تأكيد السعر والتوافر. الصور الحالية كبيرة ومعظم الأصناف تستخدم رموزاً مؤقتة. Git fetch تعطل أولاً بسبب صلاحيات .git ثم نجح بالصلاحية المصرح بها. حالة commit/push تُثبت بنتيجة Git بعد كتابة هذا السجل.
- **الخطوة التالية المحددة:** مراجعة إسلام للنسخة المحلية ثم تنفيذ ملاحظاته؛ استكمال الأسعار والصور قبل النشر. الإبقاء على الكتالوج والكاشير وقاعدة الإنتاج الأصلية دون تعديل.

### 📋 تسليم سابق (Previous Handoff Record) — 2026-10-23

* **الهدف الحالي (Current Objective):**
  إعداد منظومة تسليم موثوقة لمشروع Fruit City بين أدوات الذكاء الاصطناعي (Codex, Antigravity, Claude, ChatGPT)، مع ربط مستودع GitHub، وضبط إرشادات المساعدين، وتأمين سكريبت المزامنة، وتوثيق مواقع الكود والأسرار بدقة.

* **ما اكتمل ومثبت فعلياً (Completed & Verified):**
  1. إنشاء ملف التوجيه الموحد للمساعدين `D:\fruit city project\AGENTS.md` متضمناً بروتوكولات المساعد المستلم والمساعد المسلِّم وضوابط الأمان.
  2. إنشاء مدخل تعليمات Antigravity في `.gemini/rules/AGENTS.md` يربط مباشرة بدستور الحوكمة والتسليم دون المساس بأي إعداد موجود.
  3. إصلاح وتأمين سكريبت `تحديث_جيت_هاب.bat` (ونسخة سطح المكتب):
     - فحص مسار Git والتحقق الصارم من وجود الأداة قبل أي أمر.
     - استبدال `git add .` العشوائي بإضافة انتقائية للملفات المصرح برفعها فقط.
     - استبعاد وتجريد فوري لأي أسرار أو قواعد بيانات (`password.txt`, `.meta_token`, `*.db`, `*.sqlite`, `*.env`).
     - التحقق من نتائج الأوامر عبر `%ERRORLEVEL%` والتوقف عند الفشل دون إعلان نجاح كاذب.
     - فحص التعديلات غير المرفوعة (`git rev-list`) وتفادي تشغيل Push بلا داعٍ.
  4. تحديث وتوسيع `.gitignore` الشامل لمنع تسريب قواعد البيانات والتوكنات والمفاتيح وملفات الـ OS.
  5. فحص موقع الكود التنفيذي والتحقق من عدم وجود كود الـ POS/Server/Bot داخل مستودع D:، وتوثيق مكانه الفعلي في `C:\Users\MR.X\.gemini\antigravity\scratch\fruit-city-system`.
  6. فحص سجلات الأمان واكتشاف وجود توكن Meta مسجل سابقاً في تاريخ المستودع بملف `docs/security/.meta_token` وعنوان `DIGITAL_ASSETS_VAULT.md`، واستبعادهما من أي Stage مستقبلي مع الإبلاغ عنهما.

* **ما تبقى (Remaining):**
  1. نقل وتوحيد الكود التنفيذي (POS, Server, Telegram Bot, DB) إلى مستودع D: داخل مجلد `app/` عندما يصدر تكليف صريح ومستقل من المالك.
  2. تنظيف وتطهير تاريخ Git من التوكنات السابقة إذا رغب المالك في ذلك لاحقاً.
  3. اختبار انتقال حي فعلي بتشغيل نموذج خارجي (مثل Codex في جلسة جديدة) لقراءة السجل واستكمال مهمة برمجية.

* **الملفات المتغيرة في هذه المهمة (Changed Files):**
  - `D:\fruit city project\AGENTS.md` (جديد)
  - `D:\fruit city project\.gemini\rules\AGENTS.md` (جديد)
  - `D:\fruit city project\.gitignore` (محدث ومشدد)
  - `D:\fruit city project\تحديث_جيت_هاب.bat` (محدث ومحصن)
  - `C:\Users\MR.X\Desktop\تحديث_جيت_هاب_فاكهة_سيتي.bat` (محدث ومحصن)
  - `D:\fruit city project\محادثاتي مع نماذج الذكاء الاصطناعي\AI_GOVERNANCE.md` (محدث)
  - `D:\fruit city project\محادثاتي مع نماذج الذكاء الاصطناعي\PROJECT_MASTER_SUMMARY.md` (محدث)

* **الاختبارات ونتائجها الفعلية (Tests & Actual Results):**
  - ✅ **اختبار قراءة مسار التعليمات والتسليم:** تم بنجاح؛ الملف `AGENTS.md` قابل للوصول من جذر المشروع ويربط بروابط صحيحة إلى `AI_GOVERNANCE.md` و `PROJECT_MASTER_SUMMARY.md`.
  - ✅ **اختبار سكريبت الحفظ عند عدم وجود تغييرات:** تم تشغيل واختبار منطق السكريبت وتأكيد أنه يكتشف عدم وجود تغييرات ويعرض رسالة واضحة ولا ينفذ Push كاذب.
  - ✅ **اختبار استبعاد الأسرار:** تم اختبار أمر `git reset HEAD` للملفات الحساسة والتأكد من عدم قدرة السكريبت على إدراج `password.txt` أو `.meta_token`.
  - ⚠️ **اختبار الانتقال الحي بين نموذجين (Model-to-Model Handover Test):** لم يتم اختباره بعد عملياً؛ الإعدادات والبروتوكول جاهزة بنسبة 100%، لكن لم تفتح جلسة Codex جديدة بعد لتأكيد استلام الراية ذاتياً.

* **العوائق والملاحظات الأمنية (Blockers & Security Findings):**
  - **ملاحظة أمنية مثبتة:** تم رصد قيمة توكن Meta في `docs/security/.meta_token` وعنوان `DIGITAL_ASSETS_VAULT.md`؛ لم يتم كشف القيمة ولم يتم تعديلها أو حذفها التزاماً بنطاق الصلاحيات، ولكن تم تحصين `.gitignore` وسكريبت الرفع لضمان عدم رفعها أو مساسها مستقبلاً.
  - **المستودع خالي من الكود البرمجي:** كود نقاط البيع والبوت يعمل في مسار C: المؤقت، ومستودع D: يحتوي التوثيق والمنيو فقط.

* **الخطوة التالية المحددة للمساعد القادم (Next Step):**
  1. اقرأ هذا السجل وملف `AGENTS.md`.
  2. نفّذ `git fetch origin main` ثم `git status -uno` للتحقق من سلامة المجلد المحلي دون مساس بأي تعديلات.
  3. استشر المالك في رغبته ببدء نقل وتوحيد كود الـ POS والبوت من `C:\Users\MR.X\.gemini\antigravity\scratch\fruit-city-system` إلى `D:\fruit city project\app\` كخطوة تالية مستقلة.

---

### 🗄️ الأرشيف التاريخي للجلسات السابقة (Handoff History Archive)

| التاريخ | النموذج القائم بالعمل | ما تم تنفيذه وإنجازه في هذه الجلسة | الخطوة القادمة المطلوبة من النموذج التالي |
| :--- | :--- | :--- | :--- |
| **2026-10-23** | **AntiGravity & إسلام** | 1. تأسيس وربط مستودع GitHub الخاص رسمياً: `atefislma312-a11y/fruit-city-project`.<br>2. تفعيل مصادقة الـ SSH المشفرة باللابتوب ورفع كامل ملفات المشروع الحالية (75 ملفاً).<br>3. تثبيت وضبط برنامج GitHub Desktop على جهاز إسلام وربطه بالمجلد `D:\fruit city project`. | استكمال إعداد منظومة تسليم موثوقة وآمنة وتوثيق موقع الكود التنفيذي. |
| **2026-10-22** | **Codex بطلب إسلام** | إضافة توضيح الفرق بين Codex على الكمبيوتر وCLI والسحابة وChatGPT/Work، وحدود الوصول والتفويض؛ تحديث توثيق فقط. | قراءة توضيح المنصات أعلاه، وتحديد المهمة والبيئة والصلاحيات قبل التنفيذ. لا نقل أو إصلاح للكود بموجب هذا التحديث. |
| **2026-10-21** | **AntiGravity & إسلام** | 1. توحيد المسار الأساسي في `D:\fruit city project`.<br>2. ترقية وهيكلة منظومة التسويق الشاملة (`التسويق والسوشيال ميديا`).<br>3. تأسيس قسم خرائط جوجل والظهور المحلي (`google_maps\`).<br>4. تأسيس سجل الأمان وحصر الأصول الرقمية (`docs\security\DIGITAL_ASSETS_VAULT.md`).<br>5. تحديث السجل المركزي `PROJECT_MASTER_SUMMARY.md`. | البدء في هيكلة منطق الحسابات والمخزون في مجلد `app\`. |

---

> **إلى النموذج القادم (To Next Model / Codex):**  
> مرحباً بك في مشروع Fruit City! يرجى اتباع التعليمات المذكورة أعلاه بدقة، والحفاظ على مسار القرص `D:`، والالتزام بالحلول البرمجية الخفيفة، وتحديث جدول التسليم قبل إنهاء عملك.

### 2026-10-25 — resume follow-up evidence
- Added web_app/order_sandbox/pos-feed.mjs and pos-feed.test.mjs; local POS opened read-only. Approved branch returned 322 price/size variants for 108 products; production DB SHA-256 unchanged before/after. No prices or customer records exported to Git.
- Fixed matching-cart confirmation intent retention across reload in Checkout.jsx. Browser synthetic mango quote/confirm/reload/reconfirm returned the same order ID, pending store acceptance. Evidence: web_app/order_sandbox/checkout-test.png.
- 27 sandbox tests passed and app build passed. Existing 3 storefront tests had passed at prior checkpoint. Feed remains disconnected from public/demo launcher; 16 RF mappings, contact validation, real cashier receiver/inventory integration, delivery tariff and full auth/load validation remain incomplete.

### تسليم تصميم China 1968 — 2026-10-25
- فحص ZIP من 14 طبقة وإنشاء معاينة PNG وSVG ومحرر أحداث HTML وORA في مجلد الجلسة 2026-10-25/referenced-chatgpt-conversation-this-is-an-2/outputs.
- الشعار محفوظ؛ اختبار منطقة الشعار المعتمة: صفر بكسل متغير. لا توليد صور تاريخية. المعاينة مراجعة فقط؛ حقوق صورة الحرس الأحمر وأصل الخريطة والخشب وصورة الحدث نفسه غير محسومة. التفاصيل داخل READ-ME-AR.md.
- فشل fetch بسبب Permission denied على FETCH_HEAD؛ لم يحدث رفع أو تغيير لأعمال التطبيق السابقة. الخطوة التالية: حسم الأصول والحقوق قبل اعتماد نسخة نشر.

### مراجعة حزمة Fruit Archives China 1968 — 2026-10-25 — Codex
- الهدف: فحص ZIP المرفوع ومقارنة معاينته بصورة الكوب المرجعية، دون تعديل الأصول.
- المثبت: استرجاع مرفقات المحادثة؛ سلامة CRC للحزمة وORA؛ 7 ملفات بالحزمة، 12 طبقة ORA و11 صورة مضمنة SVG. تطابق صور SVG مع طبقات ORA؛ PNG مطابق mergedimage. إعادة تركيب ORA بفارق قنوات أقصاه 2/255. طبقة الكوب مطابقة للقالب السابق؛ منطقة داخل الشعار x590:880 y1640:1910 تطابقت مع PNG، وليس ذلك إثبات تطابق شامل مع JPG المرجعي.
- العيوب: event-template.html يفشل تحليل JavaScript بسبب أسطر فعلية داخل نصوص join/split؛ عدم هروب مدخلات النص؛ بيانات الإسناد والسياق ثابتة؛ حواف قص الكوب وبقايا الخلفية تحتاج معالجة بقناع مستقل.
- المصادر: تأكيد قصة أغسطس 1968 بمتحف Cooper Hewitt، وترخيص وصاحب صورة المانجو من Commons. صفحة الحرس الأحمر تعرض ترشيح حذف لعدم إثبات الوضع الأمريكي؛ صفحة قص ماو تنبه لحذف المصدر. الخريطة والخشب وربط كل طبقة بالأصل غير محسوم.
- الملفات المتغيرة: نسخ فحص داخل work ومعاينة PNG وصورة مرجعية داخل outputs بمجلد هذه المحادثة، وهذا السجل فقط؛ لا تعديل ZIP أو صور الأرشيف.
- حدود التحقق: لم يُختبر تفاعل متصفح أو فتح Krita/GIMP؛ فشل التحليل يمنع اعتبار المحرر صالحًا. Git على main مع تغييرات سابقة؛ fetch فشل Permission denied على FETCH_HEAD؛ لم يحدث commit أو push.
- التالي: إصلاح المحرر في نسخة منفصلة، تحسين قناع الكوب، تكبير النصوص، واستكمال سجل مصدر وحقوق لكل أصل قبل النشر.
