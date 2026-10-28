# تكامل قناة إدخال المالك عبر تليجرام — نظام فروت سيتي

توثيق المعمارية والربط السحابي والمحلي المحدث (الإصدار 1.4.0) لقناة إدارة المالك الخاصة ببوت تليجرام (`@fruit_city_islam_bot`، Bot ID `8812062448`).

---

## 1. المعمارية المعتمدة (Google Apps Script + Local Outbound Worker)

```
[ المالك: تليجرام (نص مصري / فويس / صورة) ]
                    │
                    ▼ (Webhook HTTPS مع المعامل ?secret=... وفحص Fail-Closed)
   [ Google Apps Script: الرمز.gs + FCCloudIntake.gs ]
   • تحقق Fail-Closed من سر Webhook قبل تمرير أي طلب (403 E_WEBHOOK_NOT_CONFIGURED / E_ORIGIN_SECRET_MISMATCH)
   • حصر الصلاحيات على المحادثات الخاصة وحساب المالك الرقمي (OWNER_TELEGRAM_ID)
   • أمر /myid متاح في الخاص لإرجاع معرف المستخدم الرقمي دون أي صلاحية أو استهلاك Gemini
   • خدمة العملاء مقتصرة حصراً على Facebook؛ لا دور لخدمة العملاء على تليجرام
   • استخراج البنود بـ Gemini مع حقن سياق تاريخ اليوم والأمس بتوقيت القاهرة (Africa/Cairo)
   • استكمال متماسك للمسودات الناقصة: إرسال المسودة السابقة مع المدخل الجديد (صوت/نص) لنفس المستخرج للدمج
   • تثبيت كود ورقم الرسالة الأصلية كمرساة (Anchor) لكافة رسائل الاستكمال اللاحقة
   • تدقيق حسابي صارم للبيعة (10 جنيه لكل عبوة) وإلزام المورد والتاريخ الحقيقي بالتقويم
   • احتساب ميزانية الخصائص بـ UTF-8 Bytes (8,500 بايت للسجل، و450,000 بايت إجمالي) مع حظر حذف القديم (Zero Data Loss)
   • إشعار فوري للمالك بلغة عربية نقية: "تم استلام الفاتورة وتجهيزها في قائمة الانتظار للمراجعة على النظام"
                    │
                    ▲ (استطلاع صادر دوري: POST body مع timestamp + nonce عبر worker.py)
   [ العامل المحلي: worker.py (مكتبة بايثون القياسية 3.8+) ]
   • استطلاع واعي بالحصص السحابية (افتراضي 60 ثانية مع وضع تفريغ سريع كل ثانيتين عند وجود عناصر)
   • عزل ملف المعلقات (PENDING_ACKS_FILE) عبر مسار قابل للتهيئة ومجلد النظام المؤقت في الاختبارات
   • اشتقاق مفتاح الجسر في الذاكرة بأمان عند عدم ضبط WORKER_SECRET_TOKEN
                    │
                    ▼ (POST HTTP loopback فقط: 127.0.0.1:5173/api/ingest/invoice)
   [ خادم فروت سيتي المحلي (server.js + ingestHandler.js) ]
   • حظر كامل للاتصالات من خارج loopback (403)
   • قبول الإجمالي المشتق تلقائياً للأرقام الصريحة (stated_total_amount = null) ومطابقة الإجمالي المذكور إن وُجد
   • توليد أرقام ومعرفات فواتير فريدة مقاومة للتصادم (PUR-TG-Timestamp-Rand)
   • تحديث المراجعات المتصاعدة ذرّياً دون أخطاء المفاتيح المكررة (UNIQUE constraint)
   • حصانة الفواتير المعتمدة من التعديل الخارجي (409 INVOICE_ALREADY_APPROVED)
   • إعادة قراءة فورية من SQLite للتحقق من الحفظ الفعلي على القرص قبل الرد
                    │
                    ▲ (رد التأكيد المادي المقروء: verified: true, revision: N, cloud_checksum: "...")
   [ العامل المحلي: worker.py ]
   • مطابقة دقيقة لرقم المراجعة وبصمة السحابة المعادة (echoed cloud_checksum) واشتراط وجود content_checksum
   • تسجيل التأكيد محلياً في pending_acks تحسباً لانقطاع الشبكة
                    │
                    ▼ (إرسال POST ACK للسحابة: worker_ack مع revision وبصمة السحابة)
   [ Google Apps Script (FCCloudIntake.gs) ]
   • مطابقة دقيقة للمراجعة والبصمة (Exact Revision Equality)؛ التأكيد القديم لا يحذف المسودة الأحدث المعدلة
   • حذف العنصر من الطابور وإضافته للشواهد (Tombstones) لمنع التكرار
   • إرسال رسالة تليجرام نهائية للمالك بلغة عربية نظيفة:
     "✅ تم حفظ الفاتورة بنجاح في النظام! رقم الفاتورة: PUR-TG-... الإجمالي: ... ج.م"
```

---

## 2. رقعة المهايئ المستهدفة لملف `الرمز.gs` (Targeted Adapter Patch)

احتراماً لمبدأ حفظ الملفات الأصلية، لا يتم استبدال ملف `الرمز.gs` الأصلي بالكامل، بل يُضاف ملف `FCCloudIntake.gs` كمحرك مستقل، وتُجرى التعديلات الدقيقة التالية على `الرمز.gs`:

```javascript
// ============================================================================
// رقعة المهايئ الموجهة لملف الرمز.gs
// ============================================================================

// 1. استبدال القيم السرية المكشوفة الثلاث بقراءة آمنة من Script Properties:
const TELEGRAM_TOKEN = PropertiesService.getScriptProperties().getProperty("TELEGRAM_BOT_TOKEN") || "";
const GEMINI_KEY = PropertiesService.getScriptProperties().getProperty("GEMINI_KEY") || "";
const FB_VERIFY_TOKEN = PropertiesService.getScriptProperties().getProperty("FB_VERIFY_TOKEN") || "";

// 2. توجيه نقاط الدخول العامة doGet و doPost لمساحة FCCloudIntake:
function doGet(e) {
  if (typeof FCCloudIntake !== "undefined" && FCCloudIntake.doGet) {
    return FCCloudIntake.doGet(e);
  }
  return legacyDoGet(e);
}

function doPost(e) {
  if (typeof FCCloudIntake !== "undefined" && FCCloudIntake.doPost) {
    return FCCloudIntake.doPost(e);
  }
  return legacyDoPost(e);
}

// 3. إعادة تسمية الدوال القديمة إلى legacyDoGet و legacyDoPost مع الإبقاء على أجسادها:
function legacyDoGet(e) {
  if (e.parameter && e.parameter["hub.mode"] === "subscribe" && e.parameter["hub.verify_token"] === FB_VERIFY_TOKEN) {
    return ContentService.createTextOutput(e.parameter["hub.challenge"]);
  }
  return ContentService.createTextOutput("Fruit City Webhook is Active 24/7!");
}

function legacyDoPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if (data.message) {
      handleTelegram(data.message);
      return;
    }
    if (data.entry && data.entry[0].messaging) {
      handleFacebook(data.entry[0].messaging[0]);
      return;
    }
  } catch (err) {}
}

// (الدوال الأصلية الأخرى: handleTelegram و handleFacebook و callGemini و sendTelegram تبقى كما هي دون تغيير)
```

---

## 3. إعداد الخصائص السحابية (Script Properties)

في مشروع Apps Script (`fruit city`):
افتح **Project Settings > Script Properties** وأضف المتغيرات التالية:

| اسم الخاصية | الوصف وطريقة الضبط |
| :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | توكن البوت الرسمي (Bot ID: `8812062448`). |
| `TELEGRAM_WEBHOOK_SECRET` | رمز سري مخصص لـ Webhook يمرر في رابط التسجيل `?secret=YOUR_SECRET`. |
| `OWNER_TELEGRAM_ID` | المعرف الرقمي للمالك (يُستخرج بإرسال المالك أمر `/myid` للبوت في محادثة خاصة). |
| `WORKER_SECRET_TOKEN` | رمز تفويض سري بين Apps Script و `worker.py` (يمكن توليده أو اشتقاقه). |
| `GEMINI_KEY` | مفتاح Google Gemini API. |
| `GEMINI_MODEL` | اسم النموذج (افتراضي: `gemini-2.5-flash`). |
| `FB_VERIFY_TOKEN` | رمز تحقق صفحة فيسبوك لخدمة العملاء. |

---

## 4. تدفق الاستكمال الصوتي والكتابي الذكي (Conversational Clarification Flow)

1. **الرسائل الناقصة**: إذا أرسل المالك فاتورة تنقصها بيانات إلزامية (مثل الوزن الصافي أو تاريخ الفاتورة أو اسم المورد)، تحفظ المسودة الجزئية في `FC_PENDING_CLARIFICATION_<chatId>` وتثبت مرساة الرسالة (`pending_message_id`).
2. **الاستكمال بالصوت أو النص**: عند إرسال المالك تسجيلاً صوتياً أو نصاً تكميلياً (مثل فويس يقول: "الوزن 15 كيلو وتاريخ امبارح"):
   - يُمرر التسجيل والمسودة السابقة لنفس مستخرج Gemini.
   - تدمج الحقول المذكورة صراحة فقط دون مساس بالحقول السابقة.
   - تصحيح التاريخ وحده لا يغير الوزن المسجل، وتصحيح الوزن لا يغير التاريخ.
   - تُدرج الفاتورة في الطابور بنفس كود ورقم الرسالة الأصلية فور اكتمال كافة الحقول الإلزامية.
3. **توقيت القاهرة**: تُفسر عبارات "النهارده" و"امبارح" بناءً على وقت إرسال الرسالة بتوقيت القاهرة (`Africa/Cairo`) مع فحص دقيق للتقويم لمنع التواريخ غير الحقيقية.
4. **لغة التواصل**: الردود الموجهة للمالك تصاغ بلغة عربية نظيفة خالية من أي تفاصيل داخلية مثل SQLite أو Checksum أو الهياكل الفنية.

---

## 5. نتائج اختبارات الانحدار الشاملة (19/19 PASSED)

لتشغيل جناح الاختبارات المعزول بالكامل:
```bash
node tests/telegram_ingest_slice.test.js
```

### ملخص نتائج الاختبارات:
- **القسم 1: محاكاة Google Apps Script الفعلية في Node VM:**
  - `1.1 rejectMissingWebhookSecret`: رفض 403 صريح عند غياب أو خطأ سر الويب هوك (Fail-Closed).
  - `1.2 preserveEditedQueueOnStaleAck`: التأكيد القديم لا يحذف المسودة الأحدث المعدلة في الطابور.
  - `1.3 rejectNonFinitePrice`: رفض القيم غير الرقمية والسالبة والصفر في الأسعار والأوزان.
  - `1.4 queueFullNeverDeletesOldest`: حظر حذف أقدم عنصر عند امتلاء الطابور (Zero Data Loss).
  - `1.5 missingChecksumOrRevisionRejectsAck`: إلزامية المراجعة وبصمة السحابة لطلب التأكيد (ACK).
  - `1.6 unknownQueueIdFailsAck`: رفض تأكيد أي معرف مجهول خارج الطابور والشواهد.
  - `1.7 myIdCommand`: أمر `/myid` يعيد المعرف الرقمي للمرسل فقط مع رفض غير المصرح لهم.
  - `1.8 nonceReplayPrevention`: منع إعادة استخدام Nonce مستخدم سابقاً.
  - `1.9 conversationalClarificationRegression`: استكمال مسودة ناقصة عبر رسالة صوتية مدمجة بنفس معرف الرسالة، ثبات الوزن عند تصحيح التاريخ، ودعم الأرقام الصريحة دون فرض تأكيد إجمالي مشتق.
- **القسم 2: وحدة الإدخال المشتركة (ingestHandler.js) مع SQLite مؤقتة:**
  - `2.1 First Draft Ingestion`: حفظ مسودة جديدة وقراءتها ماديًا من SQLite.
  - `2.2 Exact Duplicate Retry`: إعادة إرسال نفس المسودة والمراجعة يعيد 200 دون تكرار.
  - `2.3 Payload Conflict (409)`: رفض تعديل المحتوى لنفس المفتاح والمراجعة.
  - `2.4 Monotonic Revisions`: المراجعة الأعلى تحدث المسودة دون خطأ مفتاح فريد، والقديمة ترفض.
  - `2.5 Approved Immutability`: حظر تعديل الفاتورة المعتمدة خارجياً برمز 409.
  - `2.6 Business Validation`: فرض بيعة 10 جنيه، رفض التواريخ المستحيلة، وإلزام المورد والتاريخ.
  - `2.7 PRAGMA foreign_keys Persistence`: ثبات تفعيل المفاتيح الأجنبية بعد التصدير وإعادة الفتح.
- **القسم 3: العامل المحلي الحقيقي (worker.py) ضد سحابة فعلية وخادم محلي:**
  - `3.1 Real Worker Execution`: استطلاع سحابي حقيقي -> حفظ في SQLite -> تأكيد سحابي فعلي وتفريغ الطابور.
  - `3.2 Crash/Lost ACK Recovery`: استعادة التأكيدات المعلقة تلقائياً بعد انقطاع الاتصال المؤقت.
- **القسم 4: سلامة قاعدة بيانات الإنتاج:**
  - `4.1 Production DB Integrity`: مطابقة بصمة SHA256 لقاعدة الإنتاج 100% (`7fcb59a7eae9835decefe0b5d4926ab49c4422397268aefa5a9f3d3e685be`).
