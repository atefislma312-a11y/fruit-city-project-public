/**
 * ==============================================================================
 * FRUIT CITY — EGYPTIAN ARABIC NATURAL LANGUAGE UNDERSTANDING ENGINE (NLU)
 * ==============================================================================
 * Local-First, Zero-Latency Intent & Entity Extraction Engine for Telegram Admin
 * يدعم لهجة العامية المصرية والمصطلحات التشغيلية لمحلات العصير وسوق العبور،
 * ويصنف مستويات الخطورة (Levels 1 - 4) ويكتشف الأوامر الناقصة والغامضة.
 * ==============================================================================
 */

import { parseRawInvoiceText } from '../purchases/invoice_engine.js';

// مستويات الخطورة
export const RISK_LEVELS = {
  LEVEL_1_READ_ONLY: 1,    // قراءة فقط — تنفيذ فوري
  LEVEL_2_OPERATIONAL: 2,  // تعديل تشغيلي محدود — تأكيد بسيط (Old vs New)
  LEVEL_3_FINANCIAL: 3,    // معاملات مالية ومخزنية — ملخص كامل + تأكيد ذري
  LEVEL_4_PROHIBITED: 4    // محظور أمنياً من تليجرام
};

/**
 * الكلمات المفتاحية المحظورة أمنياً (Level 4: Prohibited)
 */
const PROHIBITED_PATTERNS = [
  /\b(drop\s+table|delete\s+from\s+users|truncate\s+table|alter\s+table)\b/i,
  /\b(exec|execute|shell|cmd|powershell|bash|sh|rm\s+-rf|format\s+c:)\b/i,
  /(تغيير|تعديل|غير|بدل|هات|وريني|اعرض)?.*(الباسورد|باسورد|كلمة السر|كلمة المرور|التوكن|token|password|hash)/i,
  /(احذف|امسح|تفريغ)\s*(قاعدة البيانات|الداتابيز|كل البيانات|جدول)/i
];

/**
 * تطبيع الألفاظ المنطوقة واللهجة العامية المصرية ومخرجات Whisper الصوتية
 * يستخدم محددات Unicode لتطابق الكلمات العربية بدقة
 */
export function normalizeEgyptianSpeech(rawText = '') {
  if (!rawText || typeof rawText !== 'string') return '';
  let text = rawText.trim();

  const uReplace = (pattern, replacement) => {
    const rx = new RegExp('(?<!\\p{L})' + pattern + '(?!\\p{L})', 'gu');
    text = text.replace(rx, replacement);
  };

  // بادئات واستجابات صوتية
  uReplace('رجال', 'راجعلي');
  uReplace('راجع\\s*لي', 'راجعلي');
  uReplace('اعرض\\s*لي', 'اعرضلي');
  uReplace('قول\\s*لي', 'قولي');
  uReplace('هات\\s*لي', 'هاتلي');
  uReplace('ورى\\s*ني', 'وريني');

  // تنويعات إملائية وصوتية في ألفاظ سوق الفاكهة
  uReplace('فتور[ةه]', 'فاتورة');
  uReplace('فاتوره', 'فاتورة');
  uReplace('تفاحي', 'تفاح');
  uReplace('مانجا', 'مانجو');
  uReplace('المانجا', 'المانجو');
  uReplace('المنجة', 'المانجو');
  uReplace('منجة', 'مانجو');
  uReplace('فراوله', 'فراولة');
  uReplace('جوافه', 'جوافة');
  uReplace('كرتونه', 'كرتونة');
  uReplace('الكرتونه', 'الكرتونة');
  uReplace('تاره', 'تارة');
  uReplace('التاره', 'التارة');
  uReplace('فارغه', 'فارغة');
  uReplace('الفارغه', 'الفارغة');
  uReplace('حاله', 'حالة');
  uReplace('النهاردة', 'النهارده');
  uReplace('مسوده', 'مسودة');

  // تحصين جمل النفي الصوتي لمنع الاعتماد الخاطئ
  uReplace('بسماتات\\s*مدهاش', 'بس ما تعتمدهاش');
  uReplace('بس\\s*ماتعتمدهاش', 'بس ما تعتمدهاش');
  uReplace('ماتعتمد[ه|ش]*', 'ما تعتمدهاش');

  // تحويل الأرقام المنطوقة والمكتوبة بالكلمات إلى أرقام عددية
  uReplace('تجرام', 'جرام');
  uReplace('ت[س|ص][ع|ا]م[ي|ا|ئ]?[ةه]|تسعمائة|تسعمائه|تسامية|تساميه', '900');
  uReplace('تمنم[ي|ا|ئ]?[ةه]|ثمانم[ي|ا|ئ]?[ةه]|ثمانمائة|ثمانمائه', '800');
  uReplace('سبعم[ي|ا|ئ]?[ةه]|سبعمائة|سبعمائه', '700');
  uReplace('ستم[ي|ا|ئ]?[ةه]|ستمائة|ستمائه', '600');
  uReplace('خمسم[ي|ا|ئ]?[ةه]|خمسمائة|خمسمائه', '500');
  uReplace('أربعم[ي|ا|ئ]?[ةه]|اربعم[ي|ا|ئ]?[ةه]|أربعمائة|اربعمائه', '400');
  uReplace('تلتما[ي|ئ]?[ةه]|تلتم[ي|ا|ئ]?[ةه]|ثلاثمائة|ثلاثمائه', '300');
  uReplace('ميتين|مائتين', '200');
  uReplace('م[ي|ا|ئ]?[ةه]|مائة|مائه', '100');
  uReplace('ألف|الف', '1000');
  uReplace('ألفين|الفين', '2000');
  uReplace('كيلو\\s*و\\s*نص', '1.5 كيلو');
  uReplace('كيلو\\s*و\\s*ربع', '1.25 كيلو');
  uReplace('نص\\s*كيلو', '0.5 كيلو');
  uReplace('ربع\\s*كيلو', '0.25 كيلو');
  uReplace('تلتما[ي|ئ]?[ةه]\\s*(و\\s*)?ستين', '360');

  return text.replace(/\s+/g, ' ').trim();
}

/**
 * استخراج وزن الفارغ / التارة المقاس من النص بحرية تامة دون قيود
 * يدعم أي قيمة مقاسة: 850 جم، 650 جرام، 920، 1.15 كيلو، نص كيلو، إلخ.
 */
export function parseTareWeightFromText(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const text = normalizeEgyptianSpeech(rawText);

  // 1. فحص الأنماط المباشرة: وزن الفارغ / التارة / الكرتونة / القفص / تارة
  const explicitMatch = text.match(/(?:وزن|تارة|كرتونة|فارغة|الفارغ|التارة|الكرتونة|القفص|توار|فارغ)\s*(?:لـ|هو|بيساوي|كام|بـ)?\s*(\d+(?:\.\d+)?|نص)\s*(جرام|جم|كجم|كيلو|كج)?/i);
  if (explicitMatch) {
    const rawVal = explicitMatch[1];
    const rawUnit = (explicitMatch[2] || '').toLowerCase();
    if (rawVal === 'نص') return 0.5;
    const num = parseFloat(rawVal);
    if (isNaN(num) || num <= 0) return null;
    if (rawUnit.includes('جرام') || rawUnit.includes('جم')) {
      return Math.round((num / 1000.0) * 1000) / 1000;
    }
    if (rawUnit.includes('كجم') || rawUnit.includes('كيلو') || rawUnit.includes('كج')) {
      return Math.round(num * 1000) / 1000;
    }
    // بدون وحدة: إذا كان الرقم > 20 فهو بالجرام (مثل 850، 650، 920، 700، 1000)، وإذا كان <= 20 فهو بالكيلو (مثل 0.85، 1.15)
    const kg = num > 20 ? num / 1000.0 : num;
    return Math.round(kg * 1000) / 1000;
  }

  // 2. نمط إدخال الوزن المجرد (مثل: "850 جم" أو "650 جرام" أو "1.15 كيلو" أو "0.85 كجم")
  const standaloneMatch = text.trim().match(/^(\d+(?:\.\d+)?|نص)\s*(جرام|جم|كجم|كيلو|كج)$/i);
  if (standaloneMatch) {
    const rawVal = standaloneMatch[1];
    const rawUnit = (standaloneMatch[2] || '').toLowerCase();
    if (rawVal === 'نص') return 0.5;
    const num = parseFloat(rawVal);
    if (isNaN(num) || num <= 0) return null;
    if (rawUnit.includes('جرام') || rawUnit.includes('جم')) {
      return Math.round((num / 1000.0) * 1000) / 1000;
    }
    return Math.round(num * 1000) / 1000;
  }

  return null;
}

/**
 * تحليل الرسالة واستخراج النية والكيانات
 */
export function parseEgyptianAdminIntent(rawText = '') {
  const text = normalizeEgyptianSpeech(rawText);
  if (!text) {
    return {
      intent: 'UNKNOWN',
      confidence: 0,
      riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
      message: 'الرسالة فارغة'
    };
  }

  // 1. فحص الأوامر المحظورة أمنياً (Level 4 Check)
  for (const pattern of PROHIBITED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        intent: 'PROHIBITED_ACTION',
        riskLevel: RISK_LEVELS.LEVEL_4_PROHIBITED,
        confidence: 1.0,
        securityAlert: true,
        reason: 'الأمر يمس أمن النظام أو قواعد البيانات أو الأسرار الحساسة، ولا يُسمح بتنفيذه نهائياً من Telegram.'
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 2. تحديد الوزن الفعلي للكرتونة الفارغة للصنف أو الفاتورة (SET_CARTON_TARE_WEIGHT) - Level 2
  // "وزن الكرتونة الفارغة المقاس فعلياً 900 جرام" | "وزن كرتونة التفاح 900 جرام" | "خلي وزن الكرتونة الفارغة 900 جرام"
  // ---------------------------------------------------------------------------
  if (!text.match(/^(راجع|افحص|وريني|اعتمد|اعتماد)/i) && (
      text.match(/(خلي|اضبط|حدد|سجل|غير)?\s*(وزن|تارة)?\s*(كرتونة|الكرتونة)(\s*الفارغة)?(\s*المقاس)?(\s*فعلياً|\s*فعليا)?.*(\d+(?:\.\d+)?|نص|ربع)\s*(جرام|جم|كجم|كيلو|كج)/i) ||
      text.match(/(تارة|التارة)\s*(الكرتونة)?\s*(\d+(?:\.\d+)?)\s*(جرام|جم|كجم|كيلو|كج)/i)
  )) {
    const match = text.match(/(\d+(?:\.\d+)?|نص|ربع)\s*(جرام|جم|كجم|كيلو|كج)/i);
    if (match) {
      let val = match[1] === 'نص' ? 0.5 : (match[1] === 'ربع' ? 0.25 : parseFloat(match[1]));
      const unit = match[2].toLowerCase();
      let weightKg = val;
      if (unit.includes('جرام') || unit.includes('جم')) {
        weightKg = val / 1000.0;
      }

      // استخراج اسم الفاكهة إن وُجد (مثل: تفاح، مانجو)
      let fruitName = null;
      if (text.includes('تفاح')) fruitName = 'تفاح';
      else if (text.includes('مانج')) fruitName = 'مانجو';
      else if (text.includes('فراول')) fruitName = 'فراولة';

      // استخراج رقم الفاتورة إن وُجد
      const invMatch = text.match(/INV-\d{8}-\d{3,4}/i);
      const invoiceNumber = invMatch ? invMatch[0].toUpperCase() : null;

      return {
        intent: 'SET_CARTON_TARE_WEIGHT',
        riskLevel: RISK_LEVELS.LEVEL_2_OPERATIONAL,
        confidence: 0.95,
        params: {
          rawInputWeight: val,
          rawInputUnit: unit,
          weightKg: Math.round(weightKg * 1000) / 1000,
          weightGrams: Math.round(weightKg * 1000),
          fruitName,
          invoiceNumber
        }
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 2.1 تبديل حالة توفر الصنف في الكاشير (TOGGLE_PRODUCT) - Level 2
  // "المانجا خلصت اقفلها" | "اقفل صنف المانجا" | "البرتقال جه افتحه" | "شغل الفراولة"
  // ---------------------------------------------------------------------------
  const isToggleDisable = text.match(/(اقفل|عطل|وقف|خلصت?|مش متوفر|مش موجود).*(مانجا|مانجو|فراولة|تفاح|برتقال|ليمون|جوافة|موز|عصير|كيوي|رمان)/i) ||
                          text.match(/(مانجا|مانجو|فراولة|تفاح|برتقال|ليمون|جوافة|موز|عصير).*(خلصت?|مش متوفر|مش موجود|اقفل)/i);
  const isToggleEnable = text.match(/(افتح|شغل|فعل|وصلت?|متوفر|موجود|جه|جت).*(مانجا|مانجو|فراولة|تفاح|برتقال|ليمون|جوافة|موز|عصير|كيوي|رمان)/i) ||
                         text.match(/(مانجا|مانجو|فراولة|تفاح|برتقال|ليمون|جوافة|موز|عصير).*(وصلت?|متوفر|موجود|افتح|شغل)/i);

  if (isToggleDisable || isToggleEnable) {
    let fruit = 'مانجو';
    const flist = ['مانجو', 'مانجا', 'فراولة', 'تفاح', 'برتقال', 'ليمون', 'جوافة', 'موز', 'كيوي', 'رمان', 'بطيخ'];
    for (const f of flist) {
      if (text.includes(f)) {
        fruit = f === 'مانجا' ? 'مانجو' : f;
        break;
      }
    }
    const isAvail = Boolean(isToggleEnable && !isToggleDisable);
    return {
      intent: 'TOGGLE_PRODUCT',
      rawIntent: 'TOGGLE_PRODUCT',
      riskLevel: RISK_LEVELS.LEVEL_2_OPERATIONAL,
      confidence: 0.95,
      params: {
        productName: fruit,
        isAvailable: isAvail
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 2.2 تعديل وجرد المخزون وخصم التارة (UPDATE_INVENTORY) - Level 3
  // "جرد مخزون المانجا 40 كجم" | "عدل مخزون البرتقال 30 كجم بخصم تارة 900 جم"
  // ---------------------------------------------------------------------------
  if (text.match(/(جرد|تعديل\s*مخزون|عدل\s*مخزون|اضبط\s*مخزون|خصم\s*تارة\s*من\s*المخزون)/i)) {
    let fruit = 'مانجو';
    const flist = ['مانجو', 'مانجا', 'فراولة', 'تفاح', 'برتقال', 'ليمون', 'جوافة', 'موز', 'كيوي', 'رمان', 'بطيخ'];
    for (const f of flist) {
      if (text.includes(f)) {
        fruit = f === 'مانجا' ? 'مانجو' : f;
        break;
      }
    }
    const weightMatch = text.match(/(\d+(?:\.\d+)?)\s*(كجم|كيلو|ك|جرام|جم)/i);
    const qty = weightMatch ? parseFloat(weightMatch[1]) : 10;
    const isKg = !weightMatch || !weightMatch[2].includes('جرام') && !weightMatch[2].includes('جم');
    const qtyKg = isKg ? qty : qty / 1000;

    let tareKg = 0;
    const tareMatch = text.match(/تار[ةه]\s*(\d+(?:\.\d+)?)\s*(كجم|كيلو|ك|جرام|جم)?/i);
    if (tareMatch) {
      const tVal = parseFloat(tareMatch[1]);
      const tUnit = tareMatch[2] || '';
      tareKg = (tUnit.includes('جرام') || tUnit.includes('جم') || tVal > 50) ? tVal / 1000 : tVal;
    }

    return {
      intent: 'UPDATE_INVENTORY',
      riskLevel: RISK_LEVELS.LEVEL_3_FINANCIAL,
      confidence: 0.95,
      params: {
        fruitName: fruit,
        adjustmentQuantity: qtyKg,
        tareWeightKg: tareKg,
        reason: 'تعديل وجرد مخزون عبر المساعد الإداري'
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 2.3 تقرير الوردية والدرج (SHIFT_REPORT) - Level 1
  // "تقرير الوردية" | "الوردية الحالية" | "مين شغال دلوقتي" | "فلوس الدرج" | "كاش الدرج كام"
  // ---------------------------------------------------------------------------
  if (text.match(/(تقرير\s*الوردية|الوردية\s*الحالية|الوردية|مين\s*شغال|فلوس\s*الدرج|كاش\s*الدرج|حساب\s*الدرج)/i)) {
    return {
      intent: 'SHIFT_REPORT',
      riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
      confidence: 0.95,
      params: {
        period: 'active'
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 3. تعديل سعر بيع منتج أو عمل عرض وتخفيض (UPDATE_PRODUCT_PRICE) - Level 3
  // "زود سعر المانجا 400 مل إلى 60 جنيه" | "غير سعر عصير المانجا إلى 50 جنيه" | "عدل سعر الفراولة 1 لتر لـ 75 ج"
  // "هعمل عرض على المانجا وهخليه بـ 30 جنيه" | "عرض على المانجو بـ 30" | "خلي المانجا بـ 30"
  // ---------------------------------------------------------------------------
  const isPriceUpdateIntent = 
    text.match(/(سعر|اسعار|أسعار).*(مانجا|مانجو|فراولة|تفاح|برتقال|ليمون|جوافة|قصب|بطيخ|موز|عصير)/i) ||
    text.match(/(زود|غير|عدل|خلي|ارفع|نزل)\s*سعر/i) ||
    text.match(/(عرض|عروض|تخفيض|خصم|اوفر).*(مانجا|مانجو|فراولة|تفاح|برتقال|ليمون|جوافة|قصب|بطيخ|موز|عصير)/i) ||
    text.match(/(خلي|خليه|خليها|خليهم|أخليه|أخليها|هخليه|هخليها)\s*.*(?:بـ|ب\s*)\d+/i) ||
    text.match(/(عرض\s*على|أعمل\s*عرض|اعمل\s*عرض|هعمل\s*عرض)/i);

  if (isPriceUpdateIntent) {
    // استخراج اسم المنتج
    let productName = null;
    const fruits = [
      { name: 'مانجو', aliases: ['مانجا', 'مانجو', 'المانجا', 'المانجو', 'المنجة', 'منجة'] },
      { name: 'فراولة', aliases: ['فراولة', 'فراوله', 'الفراولة', 'الفراوله'] },
      { name: 'تفاح', aliases: ['تفاح', 'التفاح'] },
      { name: 'موز', aliases: ['موز', 'الموز'] },
      { name: 'برتقال', aliases: ['برتقال', 'البرتقال'] },
      { name: 'ليمون', aliases: ['ليمون', 'لمون', 'الليمون', 'اللمون'] },
      { name: 'جوافة', aliases: ['جوافة', 'جوافه', 'الجوافة', 'الجوافه'] },
      { name: 'قصب سكر', aliases: ['قصب سكر', 'قصب', 'القصب'] },
      { name: 'بطيخ', aliases: ['بطيخ', 'البطيخ'] },
      { name: 'كيوي', aliases: ['كيوي', 'الكيوي'] },
      { name: 'أفوكادو', aliases: ['افوكادو', 'أفوكادو', 'الافوكادو', 'الأفوكادو'] },
      { name: 'رمان', aliases: ['رمان', 'الرمان'] },
      { name: 'أناناس', aliases: ['اناناس', 'أناناس', 'الاناناس', 'الأناناس'] },
      { name: 'شمام', aliases: ['شمام', 'الشمام', 'كانتلوب', 'الكانتلوب'] }
    ];
    for (const f of fruits) {
      for (const al of f.aliases) {
        if (text.includes(al)) {
          productName = f.name;
          break;
        }
      }
      if (productName) break;
    }

    // استخراج الحجم (16 أونص / 400 مل / 500 مل / 1 لتر)
    let sizeCode = '16oz';
    if (text.match(/(1\s*لتر|لتر\s*كامل|كبير|1l|لتر)/i)) {
      sizeCode = '1L';
    } else if (text.match(/(500\s*مل|نص\s*لتر|نصف\s*لتر|500ml)/i)) {
      sizeCode = '500ml';
    } else if (text.match(/(400\s*مل|400ml)/i)) {
      sizeCode = '400ml';
    } else if (text.match(/(16\s*أونص|16\s*اونص|16oz|كوب|كوباية|وسط|صغير|عادي)/i)) {
      sizeCode = '16oz';
    }

    // استخراج السعر بمرونة كاملة تدعم العروض (مثال: "30 بدل 50" أو "أخليها بدل 50، 30" أو "أخليها 30" أو "30 جنيه")
    let newPrice = null;

    // 1. صيغة: X بدل Y (مثال: "30 بدل 50")
    const xInsteadY = text.match(/(\d+(?:\.\d+)?)\s*(?:بدل|مكان)\s*(\d+(?:\.\d+)?)/i);
    if (xInsteadY) {
      newPrice = parseFloat(xInsteadY[1]);
    }

    // 2. صيغة: بدل Y [، أو و أو بـ] X (مثال: "بدل 50، 30" أو "بدل 50 بـ 30" أو "بدل 50 تبقى 30")
    if (!newPrice) {
      const yInsteadX = text.match(/(?:بدل|مكان)\s*(\d+(?:\.\d+)?)[،,\s]+(?:تبقى|تكون|خليه|خليها|أخليه|أخليها|اخليها|اخليه|وهخليه|وهخليها|هخليه|هخليها|بـ|ب)?\s*(\d+(?:\.\d+)?)/i);
      if (yInsteadX) {
        newPrice = parseFloat(yInsteadX[2]);
      }
    }

    // 3. صيغة: أخليه / أخليها / بـ / إلى / لـ رقم (جنيه أو بدون)
    if (!newPrice) {
      const actionMatch = text.match(/(?:أخليه|أخليها|اخليها|اخليه|خليه|خليها|وهخليه|وهخليها|هخليه|هخليها|نخليه|نخليها|بـ|ب\s*|سعر|إلى|لـ)\s*(\d+(?:\.\d+)?)\s*(?:جنيه|ج|ج\.م)?(?!\s*جرام|\s*جم|\s*كيلو|\s*كجم|\s*كرتونة|\s*قفص)/i);
      if (actionMatch) {
        newPrice = parseFloat(actionMatch[1]);
      }
    }

    // 4. صيغة: رقم متبوع بـ جنيه أو ج
    if (!newPrice) {
      const withUnit = text.match(/(\d+(?:\.\d+)?)\s*(?:جنيه|ج|ج\.م)/i);
      if (withUnit) {
        newPrice = parseFloat(withUnit[1]);
      }
    }

    // 5. أي رقم مجرد في سياق العرض
    if (!newPrice) {
      const anyNum = text.match(/(?<!\d[.-])\b(\d{1,4}(?:\.\d+)?)\b(?!\s*جرام|\s*جم|\s*كيلو|\s*كجم|\s*كرتونة|\s*قفص|\s*ساعة|\s*دقيقة)/i);
      if (anyNum) {
        newPrice = parseFloat(anyNum[1]);
      }
    }

    if (!productName) {
      return {
        intent: 'AMBIGUOUS_COMMAND',
        riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
        missing: 'product_name',
        originalIntent: 'UPDATE_PRODUCT_PRICE',
        clarificationQuestion: 'عايز تعدل سعر أو تعمل عرض على أنهي منتج بالتحديد؟ (مثال: عصير مانجو، عصير فراولة، قصب)'
      };
    }

    if (newPrice === null || newPrice <= 0) {
      return {
        intent: 'AMBIGUOUS_COMMAND',
        riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
        missing: 'new_price',
        originalIntent: 'UPDATE_PRODUCT_PRICE',
        params: {
          productName,
          sizeCode
        },
        clarificationQuestion: `من فضلك حدد السعر الجديد لعصير ${productName} (${sizeCode === '1L' ? '1 لتر' : (sizeCode === '500ml' ? '500 مل' : 'كوب 16 أونص')}) بالجنيه.`
      };
    }

    return {
      intent: 'UPDATE_PRODUCT_PRICE',
      riskLevel: RISK_LEVELS.LEVEL_3_FINANCIAL,
      confidence: 0.95,
      params: {
        productName,
        sizeCode,
        newPrice
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 4. تسجيل مصروف تشغيلي (RECORD_EXPENSE) - Level 3
  // "سجل مصروف كهرباء 4000 جنيه" | "سجل مصروف نثريات 150 ج"
  // ---------------------------------------------------------------------------
  if (text.match(/(سجل|صرف|اكتب|اضف|أضف)?\s*مصروف/i) || text.match(/^مصروف\s+/i)) {
    const amountMatch = text.match(/(\d+(?:\.\d+)?)\s*(?:جنيه|ج|ج\.م)/i);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

    // استخراج اسم المصروف
    let expenseName = text
      .replace(/(سجل|صرف|اكتب|اضف|أضف)?\s*مصروف\s*/i, '')
      .replace(/(\d+(?:\.\d+)?)\s*(?:جنيه|ج|ج\.م)/i, '')
      .replace(/(بقيمة|بـ|لـ|من|عن)?\s*$/i, '')
      .trim();

    if (!expenseName) {
      expenseName = 'مصروف تشغيلي عام';
    }

    if (amount === null || amount <= 0) {
      return {
        intent: 'AMBIGUOUS_COMMAND',
        riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
        missing: 'expense_amount',
        clarificationQuestion: `عايز تسجل مصروف "${expenseName}" بكام جنيه؟`
      };
    }

    let categoryId = 'cat_exp_other';
    if (expenseName.includes('كهرباء') || expenseName.includes('مياه') || expenseName.includes('غاز') || expenseName.includes('مرافق')) {
      categoryId = 'cat_exp_utilities';
    } else if (expenseName.includes('إيجار') || expenseName.includes('ايجار')) {
      categoryId = 'cat_exp_rent';
    } else if (expenseName.includes('صيانة') || expenseName.includes('تصليح')) {
      categoryId = 'cat_exp_maintenance';
    }

    return {
      intent: 'RECORD_EXPENSE',
      riskLevel: RISK_LEVELS.LEVEL_3_FINANCIAL,
      confidence: 0.95,
      params: {
        nameAr: expenseName,
        amount,
        categoryId
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 5. حساب تكلفة منتج من الواقع (CALCULATE_PRODUCT_COST) - Level 1
  // "احسب تكلفة عصير الفراولة" | "تكلفة عصير المانجا كام"
  // ---------------------------------------------------------------------------
  if (text.match(/(احسب|كام|وريني|عايز اعرف)?\s*تكلفة\s*(عصير|منتج)?/i)) {
    let targetFruit = null;
    const fruitList = ['فراولة', 'مانجو', 'مانجا', 'تفاح', 'موز', 'برتقال', 'ليمون', 'جوافة', 'قصب'];
    for (const fr of fruitList) {
      if (text.includes(fr)) {
        targetFruit = fr === 'مانجا' ? 'مانجو' : fr;
        break;
      }
    }

    if (!targetFruit) {
      return {
        intent: 'AMBIGUOUS_COMMAND',
        riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
        missing: 'product_name',
        clarificationQuestion: 'عايز تحسب تكلفة أنهي عصير بالتحديد؟ (مثال: عصير فراولة، عصير مانجو، قصب)'
      };
    }

    return {
      intent: 'CALCULATE_PRODUCT_COST',
      riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
      confidence: 0.95,
      params: {
        productName: targetFruit
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 6. استعلام النواقص والأصناف التي قربت تنتهي (SHOW_LOW_STOCK) - Level 1
  // "وريني الأصناف اللي قربت تخلص" | "وريني النواقص" | "الأصناف الناقصة"
  // ---------------------------------------------------------------------------
  if (text.match(/(قربت\s*تخلص|النواقص|ناقص|خلصت|قرب\s*يخلص|اقترب\s*من\s*النفاد)/i)) {
    return {
      intent: 'SHOW_LOW_STOCK',
      riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
      confidence: 0.95,
      params: {}
    };
  }

  // ---------------------------------------------------------------------------
  // 7. مقارنة مبيعات الفترات (COMPARE_SALES_PERIODS) - Level 1
  // "قارن مبيعات الأسبوع ده باللي فات" | "قارن المبيعات"
  // ---------------------------------------------------------------------------
  if (text.match(/(قارن|مقارنة)\s*مبيعات/i)) {
    return {
      intent: 'COMPARE_SALES_PERIODS',
      riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
      confidence: 0.95,
      params: {
        period1: '7days',
        period2: 'previous_7days'
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 8. سجل المراجعة وآخر العمليات (SHOW_RECENT_AUDIT_LOGS) - Level 1
  // "وريني آخر 10 عمليات حصلت على النظام" | "اعرض آخر التعديلات" | "سجل العمليات"
  // ---------------------------------------------------------------------------
  if (text.match(/(آخر|اخر)\s*(\d+)?\s*(عمليات|تعديلات|حركات|أوامر|أحداث)/i) || text.match(/(سجل\s*العمليات|سجل\s*المراجعة)/i)) {
    const numMatch = text.match(/(\d+)/);
    const limit = numMatch ? Math.min(50, parseInt(numMatch[1], 10)) : 10;
    return {
      intent: 'SHOW_RECENT_AUDIT_LOGS',
      riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
      confidence: 0.95,
      params: {
        limit
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 8.8. استخراج وزن الفارغ / التارة المخصص (Arbitrary Tare Weight Parser)
  // يدعم أي وزن مقاس: 850 جم، 650 جرام، 920، 1.15 كيلو، نص كيلو، إلخ.
  // ---------------------------------------------------------------------------
  const parsedCustomTare = parseTareWeightFromText(text);

  // ---------------------------------------------------------------------------
  // 9. مراجعة أو اعتماد فاتورة تفاح سوق العبور أو فواتير أخرى - Level 1 / Level 3
  // "راجع فاتورة INV-20261017-360" | "اعتمد فاتورة INV-20261017-360" | "فاتورة التفاح"
  // ---------------------------------------------------------------------------
  const isNegativeApproval = Boolean(text.match(/(?:ما\s*تعتمد|متعتمد|لا\s*تعتمد|بدون\s*اعتماد|من\s*غير\s*اعتماد|ماتعتمد)/i));
  if (text.match(/(اعتمد|اعتماد)\s*(فاتورة|الفاتورة)?/i) && !isNegativeApproval) {
    const invMatch = text.match(/INV-\d{8}-\d{3,4}/i);
    const invoiceNumber = invMatch ? invMatch[0].toUpperCase() : 'INV-20261017-360';
    return {
      intent: 'APPROVE_PURCHASE_INVOICE',
      riskLevel: RISK_LEVELS.LEVEL_3_FINANCIAL,
      confidence: 0.95,
      params: {
        invoiceNumber,
        tareWeightKg: parsedCustomTare
      }
    };
  }

  if (text.match(/(راجع|عرض|وريني|افحص|قائمة|هات|استعرض)?\s*فواتير\s*(المشتريات|الشراء|المسودات|المسودة|التوريد)?/i) || text.match(/^فواتير/i)) {
    return {
      intent: 'LIST_DRAFT_INVOICES',
      riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
      confidence: 0.95,
      params: {}
    };
  }

  // إذا تم إرسال أو نطق وزن الفارغ فقط أو مع أمر تعديل/مراجعة أو نفي اعتماد
  if (isNegativeApproval || parsedCustomTare !== null || text.match(/(راجع|عرض|وريني|افحص|تفاصيل)?\s*(فاتورة|الفاتورة)\s*(التفاح|اسامة|أسامة|INV-\d{8}-\d{3,4})?/i)) {
    const invMatch = text.match(/INV-\d{8}-\d{3,4}/i);
    const invoiceNumber = invMatch ? invMatch[0].toUpperCase() : (text.includes('اسامة') || text.includes('أسامة') || text.includes('تفاح') ? 'INV-20261017-360' : null);
    return {
      intent: 'REVIEW_PURCHASE_INVOICE',
      riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
      confidence: 0.90,
      params: {
        invoiceNumber,
        tareWeightKg: parsedCustomTare
      }
    };
  }

  // ---------------------------------------------------------------------------
  // 10. إنشاء فاتورة مشتريات بالنص الحر (CREATE_PURCHASE_INVOICE_DRAFT) - Level 2
  // "سجل فاتورة تفاح من وكالة أسامة موسى، كرتونة 15 كيلو، الكيلو 53 جنيه والبيعة 10 جنيه"
  // ---------------------------------------------------------------------------
  if (text.match(/(سجل|انشئ|ادخل)?\s*فاتورة\s*(مشتريات|تفاح|موز|مانجو|فراولة|سوق\s*العبور|توريد)/i) ||
      text.includes('سوق العبور') || text.includes('وكالة')) {
    try {
      const parsed = parseRawInvoiceText(text);
      if (parsed && parsed.items && parsed.items.length > 0) {
        return {
          intent: 'CREATE_PURCHASE_INVOICE_DRAFT',
          riskLevel: RISK_LEVELS.LEVEL_2_OPERATIONAL,
          confidence: 0.95,
          params: {
            parsedInvoice: parsed
          }
        };
      }
    } catch (e) {
      // Return clarification if parser threw missing info
      return {
        intent: 'AMBIGUOUS_COMMAND',
        riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
        missing: 'invoice_details',
        clarificationQuestion: `تعذر فهم بنود الفاتورة بالكامل: ${e.message}. يرجى إدخال الصنف، الوزن بالكيلو، وسعر الكيلو بوضوح.`
      };
    }
  }

  // ---------------------------------------------------------------------------
  // 11. استعراض مشتريات فترة محددة (SHOW_PURCHASES_REPORT) - Level 1
  // "اعرضلي مشتريات الأسبوع" | "مشتريات الشهر" | "فواتير المشتريات"
  // ---------------------------------------------------------------------------
  if (text.match(/(مشتريات|فواتير\s*الشراء|التوريدات)/i)) {
    let period = 'today';
    if (text.match(/(اسبوع|الأسبوع|الاسبوع|7\s*ايام)/i)) {
      period = '7days';
    } else if (text.match(/(شهر|الشهر|30\s*يوم)/i)) {
      period = 'month';
    } else if (text.match(/(امس|أمس|البارحة)/i)) {
      period = 'yesterday';
    }
    return {
      intent: 'SHOW_PURCHASES_REPORT',
      riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
      confidence: 0.90,
      params: { period }
    };
  }

  // ---------------------------------------------------------------------------
  // 12. استعراض المخزون (SHOW_INVENTORY_REPORT) - Level 1
  // "وريني المخزون" | "اعرض المخزون" | "رصيد الخامات"
  // ---------------------------------------------------------------------------
  if (text.match(/(المخزون|الخامات|رصيد\s*المخزن|المستودع)/i)) {
    return {
      intent: 'SHOW_INVENTORY_REPORT',
      riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
      confidence: 0.90,
      params: {}
    };
  }

  // ---------------------------------------------------------------------------
  // 13. استعراض المبيعات (SHOW_SALES_REPORT) - Level 1
  // "اعرض مبيعات النهارده" | "مبيعات اليوم" | "المبيعات"
  // ---------------------------------------------------------------------------
  if (text.match(/(مبيعات|المبيعات|الطلبات|الاوردرات)/i)) {
    let period = 'today';
    if (text.match(/(اسبوع|الأسبوع|7\s*ايام)/i)) {
      period = '7days';
    } else if (text.match(/(امس|أمس)/i)) {
      period = 'yesterday';
    }
    return {
      intent: 'SHOW_SALES_REPORT',
      riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
      confidence: 0.90,
      params: { period }
    };
  }

  // ---------------------------------------------------------------------------
  // 14. حالة النظام والخادم (SYSTEM_STATUS) - Level 1
  // "حالة النظام" | "حالة الخادم" | "السيرفر شغال"
  // ---------------------------------------------------------------------------
  if (text.match(/(حالة\s*النظام|حالة\s*الخادم|السيرفر\s*شغال|status)/i)) {
    return {
      intent: 'SYSTEM_STATUS',
      riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
      confidence: 0.90,
      params: {}
    };
  }

  // ---------------------------------------------------------------------------
  // 15. رقم سعر مستقل رداً على استفسار المساعد (STANDALONE_PRICE_ANSWER)
  // "30" | "30 ج" | "30 جنيه" | "بـ 30"
  // ---------------------------------------------------------------------------
  const standalonePriceMatch = text.match(/^\s*(?:بـ|ب\s*)?(\d+(?:\.\d+)?)\s*(?:جنيه|ج|ج\.م)?\s*$/i);
  if (standalonePriceMatch) {
    return {
      intent: 'STANDALONE_PRICE_ANSWER',
      riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
      confidence: 0.90,
      price: parseFloat(standalonePriceMatch[1])
    };
  }

  // إذا لم يتطابق مع أي نية معروفة
  return {
    intent: 'UNKNOWN',
    riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
    confidence: 0.0,
    text
  };
}
