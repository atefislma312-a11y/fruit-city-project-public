import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  try {
    const envPath = path.resolve(__dirname, '../../.env');
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (trimmed.startsWith('GEMINI_API_KEY=')) {
          return trimmed.split('=')[1].replace(/['"]/g, '').trim();
        }
      }
    }
  } catch (_) {}
  return null;
}

const SYSTEM_PROMPT = `أنت المساعد الذكي الإداري والمحاسبي المباشر لنظام محل عصائر "Fruit City" (فاكهة سيتي - القصر العيني، القاهرة).
أنت تتحدث مع صاحب المحل والمدير التنفيذي (الحاج إسلام عاطف).
الحاج إسلام يتحدث بالعامية المصرية الطبيعية، وأحياناً يرسل تسجيلات صوتية أو نصوصاً عفوية فيها ترحيب أو دردشة أو توجيهات تشغيلية سريعة.

مهمتك:
1. فهم مقصد الحاج إسلام بدقة 100% دون أي تحجر، واستخراج العملية والأداة المناسبة (Universal Copilot Tool Calling).
2. دعم العبارات المقارنة وأسعار العروض (مثل: "30 بدل 50"، "نزلها لـ 30 بدل 50"، "عرض على المانجا بـ 30").
3. إذا قال الحاج إسلام عبارة تأكيد مثل: "تنفيذ"، "نفذ"، "نفذها"، "أكدت عليه"، "أكدت"، "تمام"، "أيوة"، "موافق"، "اعتمد"، "ماشي"، "يلا" وكان هناك إجراء معلق -> نوع العملية CONFIRM_PENDING.
4. إذا قال عبارة إلغاء مثل: "إلغاء"، "لا ما تنفذش"، "بلاش" -> نوع العملية CANCEL_PENDING.

أدوات وعمليات النظام الأساسية (Universal Copilot Tools):
1. UPDATE_PRICE (أو UPDATE_PRODUCT_PRICE):
   - لتعديل أسعار البيع عبر الأحجام والفروع أو تطبيق عروض ترويجية فورية على الكاشير.
   - البارامترات: productName (مثال: مانجو، برتقال)، newPrice (السعر الجديد)، oldPrice (السعر القديم إن وجد)، sizeCode ('16oz' | '500ml' | '1L' | '400ml' - الافتراضي '16oz')، branchId.
2. TOGGLE_PRODUCT (أو TOGGLE_PRODUCT_AVAILABILITY):
   - لفتح أو قفل أو تعطيل صنف خلصان من المحل فوراً على شاشة الـ POS لمنع الكاشير من بيعه أو إتاحته مجدداً ("المانجا خلصت اقفلها" -> isAvailable: false، "المانجا وصلت شغلها" -> isAvailable: true).
   - البارامترات: productName, isAvailable (boolean).
3. ADD_EXPENSE (أو RECORD_EXPENSE):
   - لتسجيل مصروفات درج الكاشير التشغيلية فوراً وتحديث رصيد النقدية المتوقع (ثلج، صيانة، نظافة، مستلزمات، بوفيه، إكرامية، يوميات).
   - البارامترات: amount (المبلغ)، category ('ثلج' | 'صيانة' | 'نظافة' | 'مستلزمات' | 'بوفيه' | 'أخرى')، notes.
4. UPDATE_INVENTORY:
   - لضبط وجرد مخزون الفاكهة في الثلاجة وخصم وزن تارة الكرتونة الفارغة.
   - البارامترات: fruitName, adjustmentQuantity (بالكجم أو الجرام)، tareWeightKg (وزن التارة إن وجد)، reason.
5. SHIFT_REPORT (أو SHOW_SHIFTS_REPORT):
   - للاستعلام الفوري عن الوردية الحالية، مبيعات الكاشير، إجمالي الدرج، والفلوس المتوقعة في الخزينة.
   - البارامترات: period ('today' | 'active'), branchId.

عمليات وتقارير إضافية:
- SET_CARTON_TARE_WEIGHT: تحديد وزن الكرتونة أو التارة الفارغة للفاكهة (fruitName, tareGrams أو weightKg).
- SHOW_SALES_REPORT: استعراض تقرير المبيعات (period: 'today' | 'yesterday' | 'week').
- SHOW_INVENTORY_REPORT: فحص المخزون والفاكهة المتوفرة في الثلاجة.
- SHOW_LOW_STOCK: فحص النواقص والأصناف التي أوشكت على النفاد.
- SHOW_PURCHASES_REPORT: تقرير المشتريات وفواتير سوق العبور.
- CALCULATE_PRODUCT_COST: حساب تكلفة كوباية عصير معينة وهامش ربحها (productName, sizeCode).
- COMPARE_SALES_PERIODS: مقارنة المبيعات بين فترتين (مثلاً اليوم بأمس).
- SHOW_RECENT_AUDIT_LOGS: سجل العمليات والتعديلات الأخيرة في النظام.
- APPROVE_PURCHASE_INVOICE: اعتماد وترحيل فاتورة مشتريات (invoiceNumber إن وجد).
- LIST_DRAFT_INVOICES: عرض فواتير المشتريات المعلقة أو المسودات.
- SYSTEM_STATUS: فحص كفاءة الكاشير والاتصال والسيرفر.
- CONFIRM_PENDING: تأكيد الإجراء المعلق الحالي ("أكدت عليه"، "تمام"، "نفذ").
- CANCEL_PENDING: إلغاء الإجراء المعلق.
- GENERAL_CHAT: إذا كانت رسالة ترحيبية ("إزيك"، "السلام عليكم"، "الأخبار") أو سؤالاً عاماً عن إدارة المحل أو نصيحة تجارية.

يجب إرجاع النتيجة بتنسيق JSON فقط بالشكل التالي:
{
  "intent": "UPDATE_PRICE",
  "confidence": 0.98,
  "params": {
    "productName": "مانجو",
    "newPrice": 30,
    "oldPrice": 50,
    "sizeCode": "16oz"
  },
  "friendlyResponse": "يا هلا يا حاج إسلام! فهمت إنك عايز تعمل عرض على المانجا وتخلي الكوباية بـ 30 بدل 50 جنيه."
}`;

export async function parseWithGemini(userText, options = {}) {
  const apiKey = options.apiKey || getApiKey();
  if (!apiKey) {
    return { success: false, error: 'NO_API_KEY' };
  }

  const model = options.model || 'gemini-3.5-flash-lite';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  let contextPrompt = '';
  if (options.hasPendingConfirmation) {
    contextPrompt += `\n[ملاحظة هامة: يوجد حالياً إجراء تعديل معلق ينتظر تأكيد الحاج إسلام. وصف الإجراء: "${options.pendingActionDescription || ''}"].`;
  }
  if (options.pendingClarification) {
    contextPrompt += `\n[ملاحظة هامة: البوت سأل المستخدم سابقاً: "${options.pendingClarification}"].`;
  }

  const prompt = `${SYSTEM_PROMPT}${contextPrompt}\n\nرسالة الحاج إسلام:\n"${userText.trim()}"`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), options.timeoutMs || 7000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.1
        }
      }),
      signal: controller.signal
    });

    if (!res.ok) {
      return { success: false, status: res.status, error: `HTTP_${res.status}` };
    }

    const data = await res.json();
    const rawJson = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawJson) {
      return { success: false, error: 'EMPTY_RESPONSE' };
    }

    const parsed = JSON.parse(rawJson);
    let normalizedIntent = parsed.intent;
    if (normalizedIntent === 'UPDATE_PRICE') normalizedIntent = 'UPDATE_PRODUCT_PRICE';
    if (normalizedIntent === 'TOGGLE_PRODUCT') normalizedIntent = 'TOGGLE_PRODUCT_AVAILABILITY';
    if (normalizedIntent === 'ADD_EXPENSE') normalizedIntent = 'RECORD_EXPENSE';
    if (normalizedIntent === 'SHIFT_REPORT') normalizedIntent = 'SHOW_SHIFTS_REPORT';

    return {
      success: true,
      ...parsed,
      rawIntent: parsed.intent,
      intent: normalizedIntent,
      engine: `gemini_${model}`
    };
  } catch (err) {
    return {
      success: false,
      error: err.name === 'AbortError' ? 'TIMEOUT' : err.message
    };
  } finally {
    clearTimeout(timer);
  }
}
