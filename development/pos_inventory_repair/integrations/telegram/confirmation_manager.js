/**
 * ==============================================================================
 * FRUIT CITY — TELEGRAM CONFIRMATION & IDEMPOTENCY MANAGER
 * ==============================================================================
 * يدير طلبات التأكيد للمستويين 2 و 3 عبر رموز تشفيرية أحادية الاستخدام
 * مع التحقق من هوية المالك، مهلة 5 دقائق، ومنع النقر المزدوج أو التكرار.
 * ==============================================================================
 */

import crypto from 'crypto';

// خريطة حفظ طلبات التأكيد المعلقة في الذاكرة
const pendingConfirmations = new Map();

// مهلة صلاحية التأكيد العامة (5 دقائق)
export const CONFIRMATION_TTL_MS = 5 * 60 * 1000;

// مهلة صلاحية اعتماد فواتير المشتريات (ساعة كاملة / 60 دقيقة)
export const INVOICE_CONFIRMATION_TTL_MS = 60 * 60 * 1000;

/**
 * إنشاء طلب تأكيد جديد
 */
export function createPendingConfirmation(data = {}) {
  const token = `conf_${crypto.randomBytes(6).toString('hex')}`;
  const now = Date.now();
  const defaultTtl = data.action === 'APPROVE_PURCHASE_INVOICE'
    ? INVOICE_CONFIRMATION_TTL_MS
    : CONFIRMATION_TTL_MS;
  const expiresAt = data.expiresAt || (now + (data.ttlMs !== undefined ? data.ttlMs : defaultTtl));

  const entry = {
    token,
    action: data.action,
    params: data.params || {},
    descriptionAr: data.descriptionAr || 'إجراء إداري',
    previousValue: data.previousValue !== undefined ? data.previousValue : null,
    newValue: data.newValue !== undefined ? data.newValue : null,
    financialSummary: data.financialSummary || null,
    riskLevel: data.riskLevel || 2,
    createdAt: now,
    expiresAt
  };

  pendingConfirmations.set(token, entry);

  // تنسيق نص رسالة التأكيد
  let text = `⚠️ *تأكيد مطلوب من المالك — ${entry.descriptionAr}*\n\n`;

  if (entry.previousValue !== null || entry.newValue !== null) {
    if (entry.previousValue !== null) {
      text += `• *القيمة السابقة:* ${entry.previousValue}\n`;
    }
    if (entry.newValue !== null) {
      text += `• *القيمة الجديدة المقترحة:* ${entry.newValue}\n`;
    }
    text += `\n`;
  }

  if (entry.financialSummary) {
    text += `💰 *الأثر المالي:* ${entry.financialSummary}\n\n`;
  }

  const durationMinutes = Math.round((expiresAt - now) / 60000);
  const durationText = durationMinutes >= 60 ? 'ساعة كاملة (60 دقيقة)' : `${durationMinutes} دقائق`;

  text += `⏳ *المهلة الزمنية:* ${durationText} للاعتماد قبل الإلغاء التلقائي.\n\n`;
  text += `هل تؤكد تنفيذ هذا الإجراء وتطبيقه على النظام الآن؟\n`;
  text += `👇 *اضغط على الزر أدناه أو رد بـ "أكدت عليه" لتطبيق التعديل فوراً على الكاشير.*`;

  const confirmButtonText = data.confirmButtonText || (data.action === 'APPROVE_PURCHASE_INVOICE' ? '✅ اعتماد الفاتورة' : '✅ تأكيد وتنفيذ');
  const cancelButtonText = data.cancelButtonText || '❌ إلغاء';

  const replyMarkup = {
    inline_keyboard: [
      [
        { text: confirmButtonText, callback_data: `confirm:${token}` },
        { text: cancelButtonText, callback_data: `cancel:${token}` }
      ]
    ]
  };

  return {
    token,
    expiresAt,
    formattedText: text,
    replyMarkup
  };
}

/**
 * استهلاك رمز التأكيد وتنفيذه بأمان ذري أحادي (Single-Use Idempotent Consumption)
 */
export function consumeConfirmation(token, fromId, ownerId) {
  // فحص هوية المالك
  if (String(fromId) !== String(ownerId)) {
    return {
      success: false,
      reason: 'UNAUTHORIZED',
      message: '⛔ عذراً، لا يمكن تنفيذ هذا التأكيد إلا من حساب المالك المصرح له.'
    };
  }

  if (!pendingConfirmations.has(token)) {
    return {
      success: false,
      reason: 'ALREADY_CONSUMED_OR_NOT_FOUND',
      message: '⚠️ هذا الطلب تم تنفيذه مسبقاً أو غير موجود في النظام (حماية تامة من التكرار).'
    };
  }

  const entry = pendingConfirmations.get(token);

  // التحقق من انتهاء الصلاحية
  if (Date.now() > entry.expiresAt) {
    const limitText = entry.action === 'APPROVE_PURCHASE_INVOICE' ? 'مهلة الساعة' : 'مهلة الـ 5 دقائق';
    pendingConfirmations.delete(token);
    return {
      success: false,
      reason: 'EXPIRED',
      message: `⏰ انتهت صلاحية طلب التأكيد (تجاوزت ${limitText}). يرجى إعادة إرسال الأمر من جديد.`
    };
  }

  // حذف فوري للرمز لمنع تكرار النقر في نفس اللحظة
  pendingConfirmations.delete(token);

  return {
    success: true,
    data: entry
  };
}

/**
 * إلغاء طلب التأكيد صراحة
 */
export function cancelConfirmation(token, fromId, ownerId) {
  if (String(fromId) !== String(ownerId)) {
    return {
      success: false,
      message: '⛔ غير مصرح.'
    };
  }

  if (pendingConfirmations.has(token)) {
    const entry = pendingConfirmations.get(token);
    pendingConfirmations.delete(token);
    return {
      success: true,
      message: `🚫 تم إلغاء طلب: *${entry.descriptionAr}* بنجاح دون أي تعديل على النظام.`
    };
  }

  return {
    success: true,
    message: 'ℹ️ الطلب غير موجود أو تم إلغاؤه مسبقاً.'
  };
}

/**
 * استرجاع أحدث طلب تأكيد معلق نشط (لم تنتهِ صلاحيته)
 */
export function getLatestPendingConfirmation() {
  const now = Date.now();
  let latest = null;
  for (const [token, entry] of pendingConfirmations.entries()) {
    if (now <= entry.expiresAt) {
      if (!latest || entry.createdAt > latest.createdAt) {
        latest = entry;
      }
    }
  }
  return latest;
}

/**
 * تنظيف الطلبات المنتهية تلقائياً
 */
export function cleanupExpiredConfirmations() {
  const now = Date.now();
  for (const [token, entry] of pendingConfirmations.entries()) {
    if (now > entry.expiresAt) {
      pendingConfirmations.delete(token);
    }
  }
}
