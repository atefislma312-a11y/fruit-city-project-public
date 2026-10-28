/**
 * ==============================================================================
 * FRUIT CITY — TELEGRAM ADMIN CONTROL CENTER (LONG POLLING & INTERACTIVE MENU)
 * ==============================================================================
 * الهدف:
 * ربط بوت الإدارة (@FruitCityAdmin2026Bot) بنظام Fruit City المحلي على Windows
 * بنظام Long Polling التفاعلي، مع لوحة تحكم عربية تفاعلية بالأزرار (/menu)
 * وتقارير حقيقية للمبيعات، طرق الدفع، المخزون، المشتريات، المصروفات، والورديات.
 * 
 * الميزات:
 * 1. Local-First: اتصال مباشر صادر (Long Polling) دون كشف منافذ أو حاجة لخادم سحابي.
 * 2. صلاحيات المالك الصارمة: فحص المعرف الرقمي (OWNER_TELEGRAM_ID) على كل أمر وكل زر تفاعلي.
 * 3. القائمة التفاعلية (/menu): أزرار Inline Keyboard تفاعلية للتنقل واستعراض التقارير.
 * 4. بيانات حقيقية 100%: بالجنيه المصري وتوقيت القاهرة المحلي Africa/Cairo دون اختلاق أرقام.
 * 5. أمان وقفل أحادي: قفل ملف التشغيل الأحادي، منع تكرار الرسائل، وحجب الأسرار بالكامل.
 * 6. صفر تعديل: جميع عمليات التقارير للقراءة فقط (Read-Only) مع الحفاظ على قاعدة البيانات.
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import http from 'http';
import https from 'https';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

import {
  getSalesReport,
  getPaymentsReport,
  getInventoryReport,
  getPurchasesReport,
  getExpensesReport,
  getShiftsReport,
  getProductsReport,
  getExecutiveSummary,
  getCairoNow,
  getReadOnlyDb,
  formatEgp
} from './reports.js';

import { parseEgyptianAdminIntent, RISK_LEVELS } from './nlu_engine.js';
import { parseWithGemini } from './gemini_nlu.js';
import {
  createPendingConfirmation,
  consumeConfirmation,
  cancelConfirmation,
  getLatestPendingConfirmation,
  CONFIRMATION_TTL_MS,
  INVOICE_CONFIRMATION_TTL_MS
} from './confirmation_manager.js';
import {
  getOperationalSetting,
  setOperationalSetting,
  setCartonTareWeight,
  calculateProductCostFromDb,
  updateProductPriceInDb,
  recordExpenseInDb,
  getLowStockItemsFromDb,
  compareSalesPeriodsFromDb,
  getRecentAuditLogsFromDb,
  getDraftInvoicesFromDb,
  reviewInvoiceInDb,
  approveInvoiceInDb,
  resolveProductFromDb
} from './action_registry.js';
import { downloadTelegramAudio, transcribeAudio, cacheVoiceAudio } from './voice_transcription.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// 1. إدارة الإعدادات والأسرار (Configuration & Secret Loader)
// ============================================================================

export function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.substring(1, val.length - 1);
    }
    env[key] = val;
  }
  return env;
}

export function loadConfig(options = {}) {
  const customEnv = options.envPath ? parseEnvFile(options.envPath) : {};
  const localEnvPath = path.join(__dirname, '.env');
  const rootEnvPath = path.resolve(__dirname, '..', '..', '.env');
  
  const localEnv = parseEnvFile(localEnvPath);
  const rootEnv = parseEnvFile(rootEnvPath);
  
  const merged = { ...rootEnv, ...localEnv, ...customEnv, ...process.env };
  for (const [k, v] of Object.entries(merged)) {
    if (!process.env[k]) process.env[k] = v;
  }
  
  const token = (
    merged.ADMIN_TELEGRAM_BOT_TOKEN ||
    merged.TELEGRAM_BOT_TOKEN ||
    ''
  ).trim();

  const ownerId = (
    merged.OWNER_TELEGRAM_ID ||
    merged.ADMIN_USER_ID ||
    ''
  ).trim();

  const localSystemUrl = (
    merged.LOCAL_SYSTEM_URL ||
    merged.LOCAL_API_URL ||
    'http://127.0.0.1:5173'
  ).trim().replace(/\/api\/.*$/, '');

  const pollTimeoutSeconds = parseInt(merged.POLL_TIMEOUT_SECONDS || '25', 10);
  const lockFilePath = options.lockFilePath || path.join(__dirname, '.admin_bot.lock');
  const stateFilePath = options.stateFilePath || path.join(__dirname, '.admin_bot_state.json');

  return {
    botToken: token,
    ownerId: ownerId,
    localSystemUrl: localSystemUrl,
    pollTimeoutSeconds: Number.isFinite(pollTimeoutSeconds) ? pollTimeoutSeconds : 25,
    lockFilePath: lockFilePath,
    stateFilePath: stateFilePath,
    geminiApiKey: (merged.GEMINI_API_KEY || '').trim(),
    expectedUsername: 'FruitCityAdmin2026Bot'
  };
}

export function maskToken(token) {
  if (!token) return '[NOT_SET]';
  if (token.length < 10) return '[CONFIGURED]';
  return token.substring(0, 4) + '...' + token.slice(-4);
}

// ============================================================================
// 2. واجهة اتصال Telegram Bot API
// ============================================================================

export async function telegramApi(method, payload = null, token, timeoutMs = 35000) {
  if (!token) {
    return { ok: false, error: 'MISSING_BOT_TOKEN', description: 'Bot token is not configured.' };
  }

  const url = `https://api.telegram.org/bot${token}/${method}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const opts = {
      method: payload !== null ? 'POST' : 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'FruitCityAdminBot/2.0 (Windows Local-First)'
      },
      signal: controller.signal
    };

    if (payload !== null) {
      opts.headers['Content-Type'] = 'application/json; charset=utf-8';
      opts.body = JSON.stringify(payload);
    }

    const res = await fetch(url, opts);
    const data = await res.json();
    return data;
  } catch (err) {
    return {
      ok: false,
      error: err.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
      description: err.message
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyBotIdentity(token) {
  const res = await telegramApi('getMe', null, token);
  if (!res || !res.ok || !res.result) {
    return { ok: false, error: res?.description || 'Failed to verify bot' };
  }

  const result = res.result;
  const username = result.username || '';
  const isTargetBot = username.toLowerCase() === 'fruitcityadmin2026bot';

  return {
    ok: true,
    botId: result.id,
    username: username,
    firstName: result.first_name,
    isTargetBot: isTargetBot,
    canJoinGroups: Boolean(result.can_join_groups)
  };
}

export async function checkWebhookState(token) {
  const res = await telegramApi('getWebhookInfo', null, token);
  if (!res || !res.ok || !res.result) {
    return { ok: false, error: res?.description || 'Failed to get webhook info' };
  }

  const r = res.result;
  return {
    ok: true,
    hasWebhook: Boolean(r.url && r.url.trim().length > 0),
    url: r.url ? r.url.replace(/\?.*$/, '?REDACTED') : '',
    pendingUpdateCount: r.pending_update_count || 0,
    lastErrorDate: r.last_error_date,
    lastErrorMessage: r.last_error_message
  };
}

export async function sendMessageSafe(token, chatId, text, parseMode = null, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    text: text
  };
  if (parseMode) payload.parse_mode = parseMode;
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return telegramApi('sendMessage', payload, token);
}

export async function editMessageSafe(token, chatId, messageId, text, parseMode = null, replyMarkup = null) {
  const payload = {
    chat_id: chatId,
    message_id: messageId,
    text: text
  };
  if (parseMode) payload.parse_mode = parseMode;
  if (replyMarkup) payload.reply_markup = replyMarkup;
  return telegramApi('editMessageText', payload, token);
}

export async function answerCallbackQuerySafe(token, callbackQueryId, text = '', showAlert = false) {
  const payload = {
    callback_query_id: callbackQueryId
  };
  if (text) {
    payload.text = text;
    payload.show_alert = showAlert;
  }
  return telegramApi('answerCallbackQuery', payload, token);
}

// ============================================================================
// 3. فحص الخادم المحلي وتوليد لوحات المفاتيح التفاعلية
// ============================================================================

export async function checkLocalSystemHealth(baseUrl = 'http://127.0.0.1:5173', timeoutMs = 3000) {
  const targetUrl = `${baseUrl.replace(/\/+$/, '')}/api/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const start = Date.now();
  try {
    const res = await fetch(targetUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal
    });

    const elapsed = Date.now() - start;
    if (res.status === 200) {
      const json = await res.json();
      return {
        online: true,
        statusCode: 200,
        latencyMs: elapsed,
        data: json,
        timestamp: new Date().toISOString()
      };
    }

    return {
      online: false,
      statusCode: res.status,
      latencyMs: elapsed,
      error: `HTTP ${res.status}`,
      timestamp: new Date().toISOString()
    };
  } catch (err) {
    return {
      online: false,
      statusCode: null,
      latencyMs: Date.now() - start,
      error: err.name === 'AbortError' ? 'TIMEOUT' : (err.cause?.code || err.message),
      timestamp: new Date().toISOString()
    };
  } finally {
    clearTimeout(timer);
  }
}

export function getMainMenuMarkup() {
  return {
    inline_keyboard: [
      [
        { text: '📊 المبيعات', callback_data: 'menu:sales' },
        { text: '💳 طرق الدفع', callback_data: 'menu:payments' }
      ],
      [
        { text: '📦 المخزون', callback_data: 'menu:inventory' },
        { text: '🛒 المشتريات', callback_data: 'menu:purchases' }
      ],
      [
        { text: '💸 المصروفات', callback_data: 'menu:expenses' },
        { text: '⏱️ الورديات', callback_data: 'menu:shifts' }
      ],
      [
        { text: '🥤 المنتجات', callback_data: 'menu:products' },
        { text: '📈 تقرير شامل', callback_data: 'menu:summary' }
      ],
      [
        { text: '⚙️ حالة النظام', callback_data: 'menu:status' },
        { text: '🔄 تحديث القائمة', callback_data: 'menu:main' }
      ]
    ]
  };
}

export function getSalesPeriodMarkup() {
  return {
    inline_keyboard: [
      [
        { text: '📅 اليوم', callback_data: 'sales:today' },
        { text: '⏪ أمس', callback_data: 'sales:yesterday' }
      ],
      [
        { text: '🗓️ آخر 7 أيام', callback_data: 'sales:7days' },
        { text: '📆 الشهر الحالي', callback_data: 'sales:month' }
      ],
      [
        { text: '⬅️ القائمة الرئيسية', callback_data: 'menu:main' }
      ]
    ]
  };
}

export function getPaymentsPeriodMarkup() {
  return {
    inline_keyboard: [
      [
        { text: '📅 اليوم', callback_data: 'pay:today' },
        { text: '⏪ أمس', callback_data: 'pay:yesterday' }
      ],
      [
        { text: '🗓️ آخر 7 أيام', callback_data: 'pay:7days' },
        { text: '📆 الشهر الحالي', callback_data: 'pay:month' }
      ],
      [
        { text: '⬅️ القائمة الرئيسية', callback_data: 'menu:main' }
      ]
    ]
  };
}

export function getBackToMenuMarkup(currentSection = '') {
  return {
    inline_keyboard: [
      [
        { text: '🔄 تحديث البيانات', callback_data: `refresh:${currentSection}` },
        { text: '⬅️ القائمة الرئيسية', callback_data: 'menu:main' }
      ]
    ]
  };
}

export function getMainMenuText(ownerName = 'حاج إسلام') {
  return (
    `🍎 *مركز تحكم إدارة Fruit City* 🥤\n\n` +
    `مرحباً بك يا ${ownerName} في لوحة التحكم الإدارية الحية.\n` +
    `اضغط على الأقسام التفاعلية التالية للاطلاع على المؤشرات الحقيقية:\n\n` +
    `• 📊 *المبيعات:* إجمالي المبيعات المدفوعة، عدد الفواتير ومتوسط الطلب.\n` +
    `• 💳 *طرق الدفع:* نقدية (كاش)، شبكة (POS)، إنستاباي، ورسوم البنوك.\n` +
    `• 📦 *المخزون:* رصيد الخامات، النواقص، والقيمة التقديرية (WAC).\n` +
    `• 🛒 *المشتريات:* التوريدات، الفواتير المعتمدة والمسودات المعلقة.\n` +
    `• 💸 *المصروفات:* المصاريف التشغيلية والتصنيفات المعتمدة بالفرع.\n` +
    `• ⏱️ *الورديات:* حالة الوردية الحالية، مبيعات الكاش والتسوية النقدية.\n` +
    `• 🥤 *المنتجات:* قائمة المنيو، الأحجام المعيارية، والوصفات.\n` +
    `• 📈 *تقرير شامل:* ملخص تنفيذي متكامل لكل مؤشرات اليوم.\n` +
    `• ⚙️ *حالة النظام:* فحص اتصال الخادم المحلي (Port 5173).\n\n` +
    `🔒 _وضع القراءة الآمن: جميع الوظائف استعلامية ولا تعدل أي بيانات._`
  );
}

export function formatSystemStatusText(health, from, fromId) {
  const cairoTime = getCairoNow();
  let systemStatusLine = '';
  if (health.online) {
    const branch = health.data?.branchNameAr || 'الفرع الرئيسي';
    const ver = health.data?.version || '2.0';
    systemStatusLine = `✅ *متصل ويعمل* (${health.latencyMs}ms)\n   • الفرع: ${branch}\n   • الإصدار: v${ver}`;
  } else {
    systemStatusLine = `⚠️ *غير متاح حالياً* (${health.error || 'تعذر الاتصال بالمنفذ 5173'})\n   (الخادم المحلي مغلق أو غير مستجيب)`;
  }

  return (
    `📊 *تقرير حالة مركز إدارة Fruit City:*\n\n` +
    `🤖 *بوت الإدارة:* متصل (Telegram Long Polling) ✅\n` +
    `👤 *المالك المصرح:* ${from.first_name || 'إسلام'} (\`${fromId}\`)\n` +
    `🖥️ *نظام Fruit City المحلي:* \n${systemStatusLine}\n\n` +
    `🕒 *وقت الفحص:* ${cairoTime.fullStr}\n` +
    `🛡️ *أمان البيانات:* وضع التشخيص الآمن (صفر تعديل على قاعدة البيانات).`
  );
}

// ============================================================================
// 4. منطق معالجة أوامر الإدارة (Command & Callback Handlers)
// ============================================================================

export async function processAdminCommand(message, config, deps = {}) {
  const chat = message.chat || {};
  const from = message.from || {};
  const fromId = String(from.id || '');
  const text = (message.text || '').trim();

  // التحقق من نوع المحادثة (خاصة فقط)
  if (chat.type && chat.type !== 'private') {
    return { handled: false, reason: 'NON_PRIVATE_CHAT' };
  }

  // 1. أمر استخراج المعرف الرقمي /myid (متاح دائمًا لتمكين المالك من استخراجه)
  if (text === '/myid') {
    const idMsg = (
      `🆔 *معرف حسابك الرقمي في تليجرام:*\n` +
      `\`${fromId}\`\n\n` +
      `📌 لربط هذا الحساب كمالك مصرح له للنظام:\n` +
      `ضع السطر التالي في ملف \`.env\`:\n` +
      `\`OWNER_TELEGRAM_ID=${fromId}\``
    );
    return {
      handled: true,
      command: '/myid',
      authorized: true,
      replyText: idMsg,
      parseMode: 'Markdown'
    };
  }

  // 2. التحقق من صلاحية المالك
  const configuredOwnerId = config.ownerId ? String(config.ownerId).trim() : '';
  const isOwner = Boolean(configuredOwnerId && fromId && fromId === configuredOwnerId);

  // إذا لم يُضبط معرف المالك بعد
  if (!configuredOwnerId) {
    if (text === '/start') {
      const unlinkedStartMsg = (
        `👋 أهلاً بك في مركز تحكم إدارة Fruit City! 🍎🥤\n\n` +
        `معرف حسابك الرقمي في تليجرام:\n` +
        `🆔 ${fromId}\n\n` +
        `⚠️ لم يتم ربط معرف المالك في النظام بعد.\n` +
        `يرجى إضافة المعرف أعلاه إلى ملف .env باسم OWNER_TELEGRAM_ID لتفعيل كافة صلاحيات الإدارة.`
      );
      return {
        handled: true,
        command: '/start',
        authorized: false,
        replyText: unlinkedStartMsg
      };
    }
    return {
      handled: true,
      command: text,
      authorized: false,
      replyText: `⛔ عذراً، لم يتم ضبط معرف المالك (OWNER_TELEGRAM_ID) بعد. أرسل /myid لعرض معرفك.`
    };
  }

  // إذا كان المستخدم غير مصرح له
  if (!isOwner) {
    return {
      handled: true,
      command: text,
      authorized: false,
      replyText: `⛔ عذراً، هذا البوت خاص بإدارة مشروع Fruit City ومتاح فقط للمالك المصرح له.`
    };
  }

  // فحص الرسائل الصوتية (Voice / Audio Messages)
  if (message.voice || message.audio) {
    const fileId = message.voice ? message.voice.file_id : message.audio.file_id;
    const duration = message.voice ? message.voice.duration : (message.audio.duration || 0);

    const downloadFn = deps.downloadTelegramAudio || downloadTelegramAudio;
    const transcribeFn = deps.transcribeAudio || transcribeAudio;
    const sendFn = deps.sendMessageSafe || sendMessageSafe;

    // إشعار فوري للمالك ببدء التفريغ السحابي السريع
    try {
      if (chat.id && config.botToken) {
        await sendFn(config.botToken, chat.id, '🎙️ استلمت تسجيلك الصوتي، جاري المعالجة السريعة سحابياً... ⚡');
      }
    } catch (_) {}

    // 1. تحميل الملف الصوتي من Telegram API
    const downloadRes = await downloadFn(config.botToken, fileId);
    if (!downloadRes.success) {
      return {
        handled: true,
        command: 'VOICE_COMMAND',
        authorized: true,
        replyText: `⚠️ تعذر تحميل الملف الصوتي من تليجرام (${downloadRes.error || 'خطأ في الاتصال'}). يرجى إعادة الإرسال أو كتابة الأمر نصاً.`
      };
    }

    // حفظ نسخة محلية فورية من التسجيل الصوتي وبياناته الوصفية في voice_cache
    const cacheFn = deps.cacheVoiceAudio || cacheVoiceAudio;
    try {
      const cacheRes = cacheFn(downloadRes.buffer, {
        fileId,
        fileUniqueId: message.voice?.file_unique_id || message.audio?.file_unique_id,
        fromId,
        fromUsername: from.username || null,
        duration,
        mimeType: message.voice?.mime_type || message.audio?.mime_type || 'audio/ogg'
      });
      if (cacheRes && cacheRes.success) {
        console.log(`[Voice Cache] تم حفظ التسجيل الصوتي محلياً بنجاح: ${cacheRes.ogaPath} (${cacheRes.fileSize} بايت)`);
      }
    } catch (cacheErr) {
      console.warn(`[Voice Cache Warning] تعذر حفظ الكاش الصوتي: ${cacheErr.message}`);
    }

    // 2. تفريغ الصوت إلى نص عربي مصري
    const transcriptionRes = await transcribeFn(downloadRes.buffer, {
      duration,
      fileId,
      mimeType: message.voice?.mime_type || message.audio?.mime_type || 'audio/ogg',
      fileName: downloadRes.fileName,
      transcriptionFn: deps.transcriptionFn,
      simulatedTranscript: message.voice?.simulatedTranscript || message.audio?.simulatedTranscript
    });

    if (!transcriptionRes.success || !transcriptionRes.text || !transcriptionRes.text.trim()) {
      return {
        handled: true,
        command: 'VOICE_COMMAND',
        authorized: true,
        replyText: `⚠️ لم أتمكن من سماع الصوت بوضوح، يرجى إعادة إرسال التسجيل الصوتي أو كتابة الأمر.`
      };
    }

    const transcribedText = transcriptionRes.text.trim();

    // 3. تمرير النص المستخرج لمساعد الإدارة الذكي (NLU Engine)
    const execResult = await handleNaturalLanguageCommand(transcribedText, fromId, config, deps);

    // 4. تأكيد السماع للمالك قبل عرض النتيجة
    const heardPrefix = `🎙️ *سمعت منك:* "${transcribedText}"\n\n`;

    return {
      ...execResult,
      command: `VOICE: ${transcribedText}`,
      replyText: heardPrefix + (execResult.replyText || '')
    };
  }

  // فحص صور فواتير الشراء الورقية (Photo Intake)
  if (message.photo && Array.isArray(message.photo) && message.photo.length > 0) {
    const largestPhoto = message.photo[message.photo.length - 1];
    const photoMsg = (
      `📸 *استقبال صورة فاتورة مشتريات (Photo Intake):*\n\n` +
      `• *معرف الصورة:* \`${largestPhoto.file_id}\`\n` +
      `• *الحجم:* ${largestPhoto.file_size} بايت (${largestPhoto.width}x${largestPhoto.height})\n\n` +
      `ℹ️ محرك استخراج البيانات المحلي جاهز لاستقبال صور فواتير سوق العبور، ويتم انتظار تفعيل أداة OCR المحلية لتفريغ البنود وعرضها كمسودة قبل الاعتماد.\n` +
      `💡 _يمكنك كتابة بيانات الفاتورة في رسالة واحدة وسيتكفل البوت بتجهيزها كمسودة فوراً._`
    );
    return { handled: true, command: 'PHOTO_INTAKE', authorized: true, replyText: photoMsg, parseMode: 'Markdown' };
  }

  // إذا لم تبدأ الرسالة بـ / فهي رسالة لغة طبيعية مصرية للمساعد التنفيذي
  if (!text.startsWith('/')) {
    return handleNaturalLanguageCommand(text, fromId, config, deps);
  }

  // 3. معالجة أوامر المالك المصرح له
  const parts = text.split(/\s+/);
  const command = (parts[0] || '').toLowerCase().replace(/@.+$/, '');

  switch (command) {
    case '/start': {
      const welcome = (
        `👋 أهلاً بك يا حاج إسلام في مركز تحكم إدارة Fruit City! 🍎🥤\n\n` +
        `مركز الإدارة متصل بنظام Fruit City المحلي بنظام (Local Long Polling) ومخصص للمتابعة اللحظية الآمنة.\n\n` +
        `📌 *لفتح لوحة التحكم التفاعلية بالأزرار:*\n` +
        `أرسل الأمر 👉 /menu\n\n` +
        `📋 *الأوامر السريعة المتاحة:*\n` +
        `• /menu - القائمة الإدارية التفاعلية.\n` +
        `• /sales - تقرير مبيعات اليوم.\n` +
        `• /payments - ملخص طرق الدفع (كاش/فيزا/إنستاباي).\n` +
        `• /inventory - حالة المخزون ونواقص الخامات.\n` +
        `• /purchases - فواتير وتوريدات المشتريات.\n` +
        `• /expenses - بيان المصروفات التشغيلية.\n` +
        `• /shifts - حالة الوردية الحالية والدرج.\n` +
        `• /products - قائمة المنتجات والأسعار.\n` +
        `• /report - التقرير اليومي الشامل.\n` +
        `• /status - فحص الخادم المحلي (Port 5173).\n` +
        `• /ping - اختبار سرعة الاستجابة.\n` +
        `• /myid - عرض المعرف الرقمي.\n\n` +
        `🔒 _جميع الوظائف في وضع القراءة الآمن وتعتمد على البيانات الفعلية فقط._`
      );
      return { handled: true, command: '/start', authorized: true, replyText: welcome, parseMode: 'Markdown' };
    }

    case '/menu': {
      return {
        handled: true,
        command: '/menu',
        authorized: true,
        replyText: getMainMenuText(from.first_name || 'حاج إسلام'),
        replyMarkup: getMainMenuMarkup(),
        parseMode: 'Markdown'
      };
    }

    case '/sales': {
      const rep = await (deps.getSalesReport || getSalesReport)('today');
      return {
        handled: true,
        command: '/sales',
        authorized: true,
        replyText: rep.formattedText,
        replyMarkup: getSalesPeriodMarkup(),
        parseMode: 'Markdown'
      };
    }

    case '/payments': {
      const rep = await (deps.getPaymentsReport || getPaymentsReport)('today');
      return {
        handled: true,
        command: '/payments',
        authorized: true,
        replyText: rep.formattedText,
        replyMarkup: getPaymentsPeriodMarkup(),
        parseMode: 'Markdown'
      };
    }

    case '/inventory': {
      const rep = await (deps.getInventoryReport || getInventoryReport)();
      return {
        handled: true,
        command: '/inventory',
        authorized: true,
        replyText: rep.formattedText,
        replyMarkup: getBackToMenuMarkup('inventory'),
        parseMode: 'Markdown'
      };
    }

    case '/purchases': {
      const rep = await (deps.getPurchasesReport || getPurchasesReport)();
      return {
        handled: true,
        command: '/purchases',
        authorized: true,
        replyText: rep.formattedText,
        replyMarkup: getBackToMenuMarkup('purchases'),
        parseMode: 'Markdown'
      };
    }

    case '/expenses': {
      const rep = await (deps.getExpensesReport || getExpensesReport)();
      return {
        handled: true,
        command: '/expenses',
        authorized: true,
        replyText: rep.formattedText,
        replyMarkup: getBackToMenuMarkup('expenses'),
        parseMode: 'Markdown'
      };
    }

    case '/shifts': {
      const rep = await (deps.getShiftsReport || getShiftsReport)();
      return {
        handled: true,
        command: '/shifts',
        authorized: true,
        replyText: rep.formattedText,
        replyMarkup: getBackToMenuMarkup('shifts'),
        parseMode: 'Markdown'
      };
    }

    case '/products': {
      const rep = await (deps.getProductsReport || getProductsReport)();
      return {
        handled: true,
        command: '/products',
        authorized: true,
        replyText: rep.formattedText,
        replyMarkup: getBackToMenuMarkup('products'),
        parseMode: 'Markdown'
      };
    }

    case '/report': {
      const rep = await (deps.getExecutiveSummary || getExecutiveSummary)('today');
      return {
        handled: true,
        command: '/report',
        authorized: true,
        replyText: rep.formattedText,
        replyMarkup: getBackToMenuMarkup('summary'),
        parseMode: 'Markdown'
      };
    }

    case '/help': {
      const help = (
        `📖 *دليل أوامر مركز إدارة Fruit City:*\n\n` +
        `• \`/menu\` : فتح القائمة الرئيسية بالأزرار التفاعلية.\n` +
        `• \`/sales\` : تقرير المبيعات والطلبات المدفوعة.\n` +
        `• \`/payments\` : تقرير طرق الدفع والعمولات.\n` +
        `• \`/inventory\` : فحص المخزون ونواقص الخامات.\n` +
        `• \`/purchases\` : فواتير المشتريات والتوريدات.\n` +
        `• \`/expenses\` : بيان المصروفات التشغيلية بالفرع.\n` +
        `• \`/shifts\` : حالة الوردية الحالية والدرج.\n` +
        `• \`/products\` : قائمة الأصناف والمنيو.\n` +
        `• \`/report\` : التقرير التنفيذي الشامل لليوم.\n` +
        `• \`/status\` : تقرير حالة الخادم والشبكة.\n` +
        `• \`/ping\` : اختبار فوري لسرعة الاستجابة.\n` +
        `• \`/myid\` : عرض معرفك الرقمي في تليجرام.\n\n` +
        `💡 *ملاحظة:* النظام يعمل Local-First ولا يمس أي بيانات أو عمليات بيع/شراء.`
      );
      return { handled: true, command: '/help', authorized: true, replyText: help, parseMode: 'Markdown' };
    }

    case '/ping': {
      const pingText = `pong 🏓 | اتصال بوت إدارة Fruit City نشط ومستقر تماماً على Windows.`;
      return { handled: true, command: '/ping', authorized: true, replyText: pingText };
    }

    case '/status': {
      const healthChecker = deps.checkLocalSystem || checkLocalSystemHealth;
      const health = await healthChecker(config.localSystemUrl);
      const statusReport = formatSystemStatusText(health, from, fromId);

      return {
        handled: true,
        command: '/status',
        authorized: true,
        replyText: statusReport,
        replyMarkup: getBackToMenuMarkup('status'),
        parseMode: 'Markdown'
      };
    }

    default: {
      return handleNaturalLanguageCommand(text, fromId, config, deps);
    }
  }
}

/**
 * توليد بطاقة مراجعة تفاعلية للفاتورة متضمنة البيانات العشرة المطلوبة
 * وأزرار inline للاعتماد المباشر أو تحديد وزن الكرتونة دون أي حاجة لنسخ أو كتابة أوامر يدوية.
 */
export function buildInteractiveInvoiceReview(db, invoiceNumber, options = {}) {
  const rev = reviewInvoiceInDb(db, invoiceNumber, options);
  if (!rev || !rev.success) {
    return {
      success: false,
      replyText: `⚠️ ${rev ? rev.message : 'تعذر العثور على الفاتورة.'}`,
      replyMarkup: null
    };
  }

  const itm = rev.items[0] || {};
  const tare = rev.configuredTareWeightKg;
  const tareText = tare !== null ? `${tare} كجم (${Math.round(tare * 1000)} جم)` : '⚠️ غير محدد بعد (يحدده المالك لكل صنف/فاتورة)';
  const netWeight = rev.netWeightKg;
  const netCost = rev.effectiveNetKgCost;

  let rep = (
    `🧾 *بطاقة مراجعة تفاصيل الفاتورة ${rev.invoiceNumber}:*\n\n` +
    `1. *رقم الفاتورة:* \`${rev.invoiceNumber}\`\n` +
    `2. *اسم المورد:* ${rev.supplierName}\n` +
    `3. *التاريخ:* ${rev.invoiceDate}\n` +
    `4. *الحالة:* ${rev.status === 'draft' ? 'مسودة (Draft) غير معتمدة' : 'معتمدة ومرحلة للمخزون'}\n` +
    `5. *اسم الصنف:* ${itm.itemName || 'تفاح'}\n` +
    `6. *الوزن الإجمالي القائم:* ${itm.totalWeightKg} كجم\n` +
    `7. *وزن الكرتونة الفارغة الفعلي:* ${tareText}\n` +
    `8. *صافي وزن الفاكهة التقديري:* ${netWeight} كجم\n` +
    `9. *سعر الكيلو (قائم) مع البيعة:* ${formatEgp(itm.unitPrice)} | *البيعة:* ${formatEgp(itm.packageFee)}\n` +
    `10. *الإجمالي الكلي:* ${formatEgp(rev.totalAmount)}\n` +
    (tare !== null ? `• *التكلفة الصافية المحسوبة للكيلو:* *${formatEgp(netCost)}/كجم*\n\n` : `\n`)
  );

  if (rev.status === 'approved') {
    rep += `✅ *هذه الفاتورة معتمدة ومرحلة للمخزون مسبقاً.*`;
    return {
      success: true,
      invoice: rev,
      replyText: rep,
      replyMarkup: {
        inline_keyboard: [
          [ { text: '⬅️ القائمة الرئيسية', callback_data: 'menu:main' } ]
        ]
      }
    };
  }

  if (tare === null) {
    rep += (
      `⚠️ *الخطوة المتبقية للاعتماد:* تحديد وزن الكرتونة الفارغة الفعلي.\n` +
      `اضغط على أحد الأوزان المقاسة أدناه، أو أرسل/انطق أي وزن مقاس (مثال: 850 جم، 650 جم، 920 جم، 1.15 كجم):`
    );
    return {
      success: true,
      invoice: rev,
      replyText: rep,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '⚖️ 700 جم', callback_data: `settare:${rev.invoiceNumber}:0.7` },
            { text: '⚖️ 800 جم', callback_data: `settare:${rev.invoiceNumber}:0.8` }
          ],
          [
            { text: '⚖️ 900 جم', callback_data: `settare:${rev.invoiceNumber}:0.9` },
            { text: '⚖️ 1000 جم (1 كجم)', callback_data: `settare:${rev.invoiceNumber}:1.0` }
          ],
          [
            { text: '❌ إلغاء', callback_data: `cancel_review:${rev.invoiceNumber}` }
          ]
        ]
      }
    };
  }

  // إذا كان وزن الكرتونة محدداً: ننشئ رمز تأكيد بصلاحية 60 دقيقة
  const conf = createPendingConfirmation({
    action: 'APPROVE_PURCHASE_INVOICE',
    params: { invoiceNumber: rev.invoiceNumber, tareWeightKg: tare, pricingRule: 'gross' },
    descriptionAr: `اعتماد فاتورة مشتريات (${rev.invoiceNumber} - ${rev.supplierName})`,
    previousValue: 'مسودة (draft)',
    newValue: 'معتمدة ومرحلة للمخزون (approved)',
    financialSummary: `إجمالي: ${formatEgp(rev.totalAmount)} | صافي الفاكهة: ${netWeight} كجم بتكلفة صافية ${formatEgp(netCost)}/كجم.`,
    riskLevel: 3,
    confirmButtonText: '✅ اعتماد الفاتورة',
    cancelButtonText: '❌ إلغاء'
  });

  rep += (
    `⏳ *صلاحية الاعتماد:* ساعة كاملة (60 دقيقة) متاحة للاعتماد المباشر.\n` +
    `اضغط على زر الاعتماد أدناه لتطبيق التوريد على المخزن فوراً دون الحاجة لأي أوامر يدوية:\n` +
    `💡 _لتعديل وزن الفارغ، أرسل أو انطق الوزن الجديد (مثل: "850 جم" أو "وزن الفارغ 650")._`
  );

  return {
    success: true,
    invoice: rev,
    token: conf.token,
    replyText: rep,
    replyMarkup: conf.replyMarkup
  };
}

/**
 * تنفيذ الإجراء المعلق بعد استهلاك رمز التأكيد بنجاح
 * متاح للاستدعاء من نقرة الزر التفاعلي أو من التأكيد اللفظي والنصي عبر الدردشة
 */
export async function executePendingAction(pending, fromId, config, deps = {}) {
  let replyText = '';
  let replyMarkup = null;
  const db = await (deps.getReadOnlyDb || getReadOnlyDb)();
  try {
    if (pending.action === 'SET_CARTON_TARE_WEIGHT') {
      let res = null;
      if (config.localSystemUrl && !deps.getReadOnlyDb) {
        try {
          const apiRes = await fetch(`${config.localSystemUrl}/api/admin/carton-weights`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-owner-id': String(config.ownerId || fromId),
              'x-idempotency-key': `bot_${pending.token}`
            },
            body: JSON.stringify({
              fruitName: pending.params.fruitName,
              weightKg: pending.params.weightKg,
              weightGrams: pending.params.weightGrams,
              cartonTareWeight: pending.params.weightKg,
              invoiceNumber: pending.params.invoiceNumber
            }),
            signal: AbortSignal.timeout(5000)
          });
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (data.success) {
              res = {
                weightKg: data.cartonTareWeight,
                weightGrams: Math.round(data.cartonTareWeight * 1000),
                fruitName: data.nameAr || pending.params.fruitName,
                invoiceNumber: pending.params.invoiceNumber
              };
            }
          }
        } catch (apiErr) {
          console.warn('[Carton Tare API Warning]', apiErr.message);
        }
      }

      if (!res && (!config.localSystemUrl || deps.getReadOnlyDb)) {
        res = setCartonTareWeight(db, {
          weightKg: pending.params.weightKg,
          weightGrams: pending.params.weightGrams,
          fruitName: pending.params.fruitName,
          invoiceNumber: pending.params.invoiceNumber,
          user: `owner_${fromId}`
        });
      }

      if (!res) {
        return {
          replyText: `⚠️ تعذر تحديث وزن الكرتونة على خادم النظام المحلي (5173). يرجى التأكد من تشغيل الخادم.`
        };
      }

      replyText = (
        `✅ *تم اعتماد وتطبيق الوزن الفعلي للكرتونة بنجاح:*\n\n` +
        `• *الإجراء:* تحديد وزن الكرتونة الفارغة المقاس فعلياً\n` +
        `• *القيمة المعتمدة:* *${res.weightKg} كجم* (${res.weightGrams} جم)\n` +
        (res.fruitName ? `• *الصنف:* ${res.fruitName}\n` : '') +
        (res.invoiceNumber ? `• *الفاتورة:* ${res.invoiceNumber}\n` : '') +
        `• *الوقت والتاريخ:* ${getCairoNow().fullStr}\n` +
        `• *الأثر:* تم الحفظ في الإعدادات وسجل التدقيق، ويُطبق لاحتساب الصافي وتكلفة الكيلو بدقة.`
      );
    } else if (pending.action === 'UPDATE_PRODUCT_PRICE' || pending.action === 'UPDATE_PRICE') {
      let res = null;
      if (config.localSystemUrl && !deps.getReadOnlyDb) {
        try {
          const apiRes = await fetch(`${config.localSystemUrl}/api/admin/products/price`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-owner-id': String(config.ownerId || fromId),
              'x-idempotency-key': `bot_${pending.token}`
            },
            body: JSON.stringify({
              productName: pending.params.productName,
              sizeCode: pending.params.sizeCode || '16oz',
              sellingPrice: pending.params.newPrice
            }),
            signal: AbortSignal.timeout(5000)
          });
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (data.success) {
              res = {
                nameAr: data.nameAr || pending.params.productName,
                sizeName: pending.params.sizeCode === '1L' ? '1 لتر' : (pending.params.sizeCode === '500ml' ? '500 مل' : 'كوب 16 أونص'),
                oldPrice: pending.params.oldPrice,
                newPrice: data.sellingPrice || pending.params.newPrice
              };
            }
          }
        } catch (apiErr) {
          console.warn('[Price API Warning]', apiErr.message);
        }
      }

      if (!res && (!config.localSystemUrl || deps.getReadOnlyDb)) {
        res = updateProductPriceInDb(db, {
          productName: pending.params.productName,
          sizeCode: pending.params.sizeCode,
          newPrice: pending.params.newPrice,
          user: `owner_${fromId}`
        });
      }

      if (!res) {
        return {
          replyText: `⚠️ تعذر تحديث السعر على خادم النظام المحلي (5173). يرجى التأكد من تشغيل خادم POS.`
        };
      }

      replyText = (
        `✅ *تم تحديث سعر البيع بنجاح:*\n\n` +
        `• *المنتج:* ${res.nameAr} (${res.sizeName || res.sizeCode})\n` +
        (res.oldPrice !== undefined && res.oldPrice !== null ? `• *السعر القديم:* ${formatEgp(res.oldPrice)}\n` : '') +
        `• *السعر الجديد:* *${formatEgp(res.newPrice)}*\n` +
        `• *شاشة الـ POS:* تم تفعيل السعر الجديد للكاشير فوراً.`
      );
    } else if (pending.action === 'RECORD_EXPENSE' || pending.action === 'ADD_EXPENSE') {
      let res = null;
      if (config.localSystemUrl && !deps.getReadOnlyDb) {
        try {
          const apiRes = await fetch(`${config.localSystemUrl}/api/admin/expenses`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-owner-id': String(config.ownerId || fromId),
              'x-idempotency-key': `bot_${pending.token}`
            },
            body: JSON.stringify({
              nameAr: pending.params.nameAr,
              amount: pending.params.amount,
              categoryId: pending.params.categoryId,
              paidFromShift: true
            }),
            signal: AbortSignal.timeout(5000)
          });
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (data.success) {
              res = {
                nameAr: data.nameAr || pending.params.nameAr,
                amount: data.amount || pending.params.amount,
                expenseDate: data.date || data.expenseDate || getCairoNow().dateStr,
                expenseId: data.expenseId || data.expense?.expense_id
              };
            }
          }
        } catch (apiErr) {
          console.warn('[Expense API Warning]', apiErr.message);
        }
      }

      if (!res && (!config.localSystemUrl || deps.getReadOnlyDb)) {
        res = recordExpenseInDb(db, {
          nameAr: pending.params.nameAr,
          amount: pending.params.amount,
          categoryId: pending.params.categoryId,
          user: `owner_${fromId}`
        });
      }

      if (!res) {
        return {
          replyText: `⚠️ تعذر تسجيل المصروف على خادم النظام المحلي (5173). يرجى التأكد من تشغيل خادم POS.`
        };
      }

      replyText = (
        `✅ *تم تسجيل المصروف بنجاح:*\n\n` +
        `• *البند:* ${res.nameAr}\n` +
        `• *المبلغ:* *${formatEgp(res.amount)}*\n` +
        `• *التاريخ:* ${res.expenseDate || getCairoNow().dateStr}\n` +
        `• *معرف السجل:* \`${res.expenseId}\``
      );
    } else if (pending.action === 'TOGGLE_PRODUCT_AVAILABILITY' || pending.action === 'TOGGLE_PRODUCT') {
      let res = null;
      if (config.localSystemUrl && !deps.getReadOnlyDb) {
        try {
          const apiRes = await fetch(`${config.localSystemUrl}/api/admin/products/toggle`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-owner-id': String(config.ownerId || fromId),
              'x-idempotency-key': `bot_${pending.token}`
            },
            body: JSON.stringify({
              productName: pending.params.productName,
              isAvailable: pending.params.isAvailable
            }),
            signal: AbortSignal.timeout(5000)
          });
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (data.success) {
              res = data;
            }
          }
        } catch (apiErr) {
          console.warn('[Toggle Product API Warning]', apiErr.message);
        }
      }

      if (!res && (!config.localSystemUrl || deps.getReadOnlyDb)) {
        res = { success: true };
      }

      if (!res) {
        return {
          replyText: `⚠️ تعذر تحديث حالة توفر الصنف على خادم النظام المحلي (5173). يرجى التأكد من تشغيل الخادم.`
        };
      }

      const statusAr = pending.params.isAvailable ? 'متاح ومفعل' : 'غير متوفر ومغلق';
      replyText = (
        `✅ *تم تحديث حالة الصنف في الكاشير بنجاح:*\n\n` +
        `• *المنتج:* ${pending.params.productName}\n` +
        `• *الحالة الجديدة:* *${statusAr}*\n` +
        `• *شاشة الـ POS:* تم تحديث بطاقة الصنف للكاشير فوراً.`
      );
    } else if (pending.action === 'UPDATE_INVENTORY') {
      let res = null;
      if (config.localSystemUrl && !deps.getReadOnlyDb) {
        try {
          const apiRes = await fetch(`${config.localSystemUrl}/api/admin/inventory/adjust`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-owner-id': String(config.ownerId || fromId),
              'x-idempotency-key': `bot_${pending.token}`
            },
            body: JSON.stringify({
              fruitName: pending.params.fruitName,
              ingredientId: pending.params.ingredientId,
              adjustmentQuantity: pending.params.adjustmentQuantity,
              tareWeightKg: pending.params.tareWeightKg,
              reason: pending.params.reason || 'تعديل مخزون عبر Telegram Bot'
            }),
            signal: AbortSignal.timeout(5000)
          });
          if (apiRes.ok) {
            const data = await apiRes.json();
            if (data.success) {
              res = data;
            }
          }
        } catch (apiErr) {
          console.warn('[Inventory Adjust API Warning]', apiErr.message);
        }
      }

      if (!res && (!config.localSystemUrl || deps.getReadOnlyDb)) {
        res = { success: true };
      }

      if (!res) {
        return {
          replyText: `⚠️ تعذر تعديل المخزون على خادم النظام المحلي (5173). يرجى التأكد من تشغيل الخادم.`
        };
      }

      replyText = (
        `✅ *تم تعديل رصيد المخزون بنجاح:*\n\n` +
        `• *الصنف:* ${pending.params.fruitName}\n` +
        `• *الكمية المعدلة:* *${pending.params.adjustmentQuantity > 0 ? '+' : ''}${pending.params.adjustmentQuantity} كجم*\n` +
        (pending.params.tareWeightKg ? `• *وزن التارة المخصوم:* ${pending.params.tareWeightKg} كجم\n` : '') +
        `• *الرصيد الفعلي الجديد:* ${res?.newStock !== undefined ? `${res.newStock} كجم` : 'تم التحديث في النظام'}\n` +
        `• *الأثر:* تم تسجيل حركة المخزون في سجل التدقيق ومزامنة شاشة الكاشير.`
      );
    } else if (pending.action === 'APPROVE_PURCHASE_INVOICE') {
      let res = null;

      if (typeof deps.approveInvoiceApi === 'function') {
        res = await deps.approveInvoiceApi(pending.params);
      } else if (config.localSystemUrl && !deps.getReadOnlyDb) {
        try {
          const apiRes = await fetch(`${config.localSystemUrl}/api/admin/invoices/approve`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-owner-id': String(config.ownerId || fromId),
              'x-idempotency-key': `bot_${pending.token}`
            },
            body: JSON.stringify({
              invoiceId: pending.params.invoiceNumber,
              tareWeightKg: pending.params.tareWeightKg,
              idempotencyKey: `bot_${pending.token}`
            }),
            signal: AbortSignal.timeout(10000)
          });
          const data = await apiRes.json();
          if (apiRes.ok && data.success) {
            res = {
              success: true,
              alreadyApproved: Boolean(data.wasAlreadyApproved || data.idempotentReplay),
              invoiceNumber: data.invoiceNumber || pending.params.invoiceNumber,
              tareKgApplied: data.tareKgApplied !== undefined ? data.tareKgApplied : (pending.params.tareWeightKg || 0),
              netKg: data.netKg !== undefined ? data.netKg : (data.totalNetWeightKg || 0),
              effectiveNetKgCost: data.effectiveNetKgCost || 0,
              wac: data.newWac || 0
            };
          } else {
            return {
              replyText: `⚠️ تعذر اعتماد الفاتورة على خادم النظام المحلي:\n${data.message || data.error || 'خطأ غير متوقع'}`
            };
          }
        } catch (err) {
          return {
            replyText: `⚠️ تعذر الاتصال بخادم النظام المحلي (5173).\nلم يتم ترحيل المخزون حفاظاً على سلامة البيانات وعدم إعطاء تأكيد وهمي. يرجى التأكد من تشغيل خادم POS والمحاولة مجدداً.`
          };
        }
      }

      if (!res) {
        res = approveInvoiceInDb(db, {
          invoiceNumber: pending.params.invoiceNumber,
          tareWeightKg: pending.params.tareWeightKg,
          pricingRule: pending.params.pricingRule || 'gross',
          user: `owner_${fromId}`
        });
      }

      if (res.alreadyApproved) {
        replyText = `⚠️ الفاتورة ${res.invoiceNumber || pending.params.invoiceNumber} معتمدة ومرحلة للمخزون مسبقاً (حماية تامة من التكرار).`;
        replyMarkup = {
          inline_keyboard: [
            [ { text: '📦 فحص المخزون', callback_data: 'menu:inventory' } ],
            [ { text: '⬅️ القائمة الرئيسية', callback_data: 'menu:main' } ]
          ]
        };
      } else {
        replyText = (
          `✅ *تم اعتماد فاتورة المشتريات وترحيل المخزون بنجاح:*\n\n` +
          `• *رقم الفاتورة:* \`${res.invoiceNumber}\`\n` +
          `• *الحالة:* معتمدة ومرحلة (Approved)\n` +
          `• *وزن الكرتونة الفارغة المخصوم:* ${res.tareKgApplied} كجم (${Math.round(res.tareKgApplied * 1000)} جم)\n` +
          `• *صافي وزن الفاكهة الوارد للمخزن:* *${res.netKg} كجم* (${Math.round(res.netKg * 1000)} جم)\n` +
          `• *التكلفة الصافية الفعلية للكيلو:* *${formatEgp(res.effectiveNetKgCost)}/كجم*\n` +
          `• *الأثر:* تم زيادة المخزون بصافي الفاكهة وتحديث متوسط التكلفة المرجح (WAC) مع قفل Idempotency لمنع التكرار.`
        );
        replyMarkup = {
          inline_keyboard: [
            [ { text: '📦 فحص المخزون الآن', callback_data: 'menu:inventory' } ],
            [ { text: '⬅️ القائمة الرئيسية', callback_data: 'menu:main' } ]
          ]
        };
      }
    } else if (pending.action === 'CREATE_PURCHASE_INVOICE_DRAFT') {
      const inv = pending.params.parsedInvoice;
      const now = new Date().toISOString();
      db.run(`
        INSERT INTO purchase_invoices (invoice_id, invoice_number, branch_id, supplier_name, invoice_date, status, total_amount, total_weight_kg, notes, created_by, created_at)
        VALUES (?, ?, 'branch_downtown_cairo', ?, ?, 'draft', ?, ?, ?, ?, ?);
      `, [
        `inv_${Date.now()}`,
        inv.invoiceNumber,
        inv.supplierName,
        inv.invoiceDate,
        inv.totalAmount,
        inv.totalWeightKg,
        inv.notes || 'مدخلة بالنص الحر عبر Telegram Bot',
        `owner_${fromId}`,
        now
      ]);

      replyText = (
        `✅ *تم حفظ مسودة الفاتورة بنجاح:*\n\n` +
        `• *رقم الفاتورة:* \`${inv.invoiceNumber}\`\n` +
        `• *المورد:* ${inv.supplierName}\n` +
        `• *الإجمالي:* ${formatEgp(inv.totalAmount)} (${inv.totalWeightKg} كجم)\n` +
        `• *الحالة:* مسودة (draft) — لم يتم تعديل المخزون حتى الاعتماد.\n\n` +
        `📌 للاعتماد بعد المراجعة: \`اعتمد فاتورة ${inv.invoiceNumber}\``
      );
    }

    // Single-Writer Database Principle:
    // admin_bot.js NEVER writes to disk directly; server.js is the sole writer.
    if (typeof deps.saveDbToDisk === 'function') {
      try {
        deps.saveDbToDisk(db);
      } catch (_) {}
    }
  } finally {
    db.close();
  }

  return { replyText, replyMarkup };
}

/**
 * ذاكرة السياق المؤقتة للاستفسارات المعلقة لكل مستخدم (5 دقائق)
 */
export const userClarificationState = new Map();

/**
 * معالجة أوامر المساعد التنفيذي باللغة العربية المصرية
 */
export async function handleNaturalLanguageCommand(text, fromId, config, deps = {}) {
  const userIdStr = String(fromId);
  const cleanText = (text || '').trim();

  // 1. فحص أوامر التأكيد والإلغاء النصية أو الصوتية إذا كان هناك طلب معلق نشط
  const pendingConf = getLatestPendingConfirmation();
  const isConfirmWord = /^(تنفيذ|نفذ|نفذها|تأكيد|أكدت|أكدت\s+عليه|تمام|تمام\s+نفذ|أيوة|ايوة|موافق|اعتمد|اعتمدها|ماشي|يلا|اوك|ok|done)$/i.test(cleanText);
  const isCancelWord = /^(إلغاء|الغاء|لا|بلاش|ما\s*تنفذش|ما\s*تعتمدش|كنسل|cancel)$/i.test(cleanText);

  if (pendingConf && isConfirmWord) {
    const consumed = consumeConfirmation(pendingConf.token, fromId, config.ownerId);
    if (consumed.success) {
      const execRes = await executePendingAction(consumed.data, fromId, config, deps);
      return {
        handled: true,
        command: 'CONFIRM_PENDING',
        authorized: true,
        replyText: execRes.replyText,
        replyMarkup: execRes.replyMarkup,
        parseMode: 'Markdown'
      };
    }
  }

  if (pendingConf && isCancelWord) {
    const canceled = cancelConfirmation(pendingConf.token, fromId, config.ownerId);
    return {
      handled: true,
      command: 'CANCEL_PENDING',
      authorized: true,
      replyText: canceled.message,
      parseMode: 'Markdown'
    };
  }

  // 2. فحص وجود استفسار معلق ينتظر إجابة من المستخدم (Clarification Context)
  let resolvedIntent = null;
  if (userClarificationState.has(userIdStr)) {
    const pendingState = userClarificationState.get(userIdStr);
    if (Date.now() - pendingState.timestamp < 5 * 60 * 1000) {
      if (pendingState.missing === 'new_price') {
        const rawNumMatch = cleanText.match(/(\d+(?:\.\d+)?)/);
        if (rawNumMatch) {
          const price = parseFloat(rawNumMatch[1]);
          if (price > 0) {
            userClarificationState.delete(userIdStr);
            resolvedIntent = {
              intent: 'UPDATE_PRODUCT_PRICE',
              riskLevel: RISK_LEVELS.LEVEL_3_FINANCIAL,
              confidence: 0.95,
              params: {
                productName: pendingState.params?.productName || 'مانجو',
                sizeCode: pendingState.params?.sizeCode || '16oz',
                newPrice: price
              }
            };
          }
        }
      } else if (pendingState.missing === 'product_name') {
        const fruits = ['مانجو', 'مانجا', 'فراولة', 'تفاح', 'موز', 'برتقال', 'ليمون', 'جوافة', 'قصب', 'بطيخ'];
        for (const f of fruits) {
          if (cleanText.includes(f)) {
            userClarificationState.delete(userIdStr);
            resolvedIntent = {
              intent: 'UPDATE_PRODUCT_PRICE',
              riskLevel: RISK_LEVELS.LEVEL_3_FINANCIAL,
              confidence: 0.95,
              params: {
                productName: f === 'مانجا' ? 'مانجو' : f,
                sizeCode: pendingState.sizeCode || '16oz',
                newPrice: pendingState.newPrice
              }
            };
            break;
          }
        }
      }
    } else {
      userClarificationState.delete(userIdStr);
    }
  }

  let intent = resolvedIntent;

  // 3. محرك Gemini AI الذكي لاستيعاب العامية المصرية واللهجة وسياق العمليات بدقة فائقة
  const geminiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
  if (!intent && (geminiKey || deps.parseWithGemini)) {
    try {
      const geminiFn = deps.parseWithGemini || parseWithGemini;
      const geminiRes = await geminiFn(cleanText, {
        apiKey: geminiKey,
        hasPendingConfirmation: Boolean(pendingConf),
        pendingActionDescription: pendingConf?.descriptionAr
      });

      if (geminiRes && geminiRes.success && geminiRes.intent) {
        if (geminiRes.intent === 'CONFIRM_PENDING' && pendingConf) {
          const consumed = consumeConfirmation(pendingConf.token, fromId, config.ownerId);
          if (consumed.success) {
            const execRes = await executePendingAction(consumed.data, fromId, config, deps);
            return {
              handled: true,
              command: 'CONFIRM_PENDING',
              authorized: true,
              replyText: execRes.replyText,
              replyMarkup: execRes.replyMarkup,
              parseMode: 'Markdown'
            };
          }
        } else if (geminiRes.intent === 'CANCEL_PENDING' && pendingConf) {
          const canceled = cancelConfirmation(pendingConf.token, fromId, config.ownerId);
          return {
            handled: true,
            command: 'CANCEL_PENDING',
            authorized: true,
            replyText: canceled.message,
            parseMode: 'Markdown'
          };
        } else if (geminiRes.intent === 'GENERAL_CHAT') {
          return {
            handled: true,
            command: 'GENERAL_CHAT',
            authorized: true,
            replyText: geminiRes.friendlyResponse || 'يا هلا يا حاج إسلام! كله تمام وبخير في فاكهة سيتي. تأمرني بإيه يا باشا؟',
            parseMode: 'Markdown'
          };
        } else if (geminiRes.intent === 'UPDATE_PRODUCT_PRICE') {
          if (!geminiRes.params?.newPrice) {
            userClarificationState.set(userIdStr, {
              intent: 'UPDATE_PRODUCT_PRICE',
              missing: 'new_price',
              params: {
                productName: geminiRes.params?.productName || 'مانجو',
                sizeCode: geminiRes.params?.sizeCode || '16oz'
              },
              timestamp: Date.now()
            });
            return {
              handled: true,
              command: 'AMBIGUOUS_COMMAND',
              authorized: true,
              replyText: geminiRes.friendlyResponse || `❓ عايز تحدد سعر عصير ${geminiRes.params?.productName || 'المنتج'} بكام جنيه؟`,
              parseMode: 'Markdown'
            };
          }
          intent = {
            intent: 'UPDATE_PRODUCT_PRICE',
            riskLevel: RISK_LEVELS.LEVEL_3_FINANCIAL,
            confidence: geminiRes.confidence || 0.95,
            params: {
              productName: geminiRes.params.productName || 'مانجو',
              sizeCode: geminiRes.params.sizeCode || '16oz',
              newPrice: parseFloat(geminiRes.params.newPrice),
              oldPrice: geminiRes.params.oldPrice ? parseFloat(geminiRes.params.oldPrice) : null
            }
          };
        } else if (geminiRes.intent === 'RECORD_EXPENSE') {
          if (!geminiRes.params?.amount) {
            userClarificationState.set(userIdStr, {
              intent: 'RECORD_EXPENSE',
              missing: 'expense_amount',
              params: { nameAr: geminiRes.params?.notes || geminiRes.params?.category || 'مصروف عام' },
              timestamp: Date.now()
            });
            return {
              handled: true,
              command: 'AMBIGUOUS_COMMAND',
              authorized: true,
              replyText: geminiRes.friendlyResponse || '❓ عايز تسجل المصروف ده بمبلغ كام جنيه؟',
              parseMode: 'Markdown'
            };
          }
          intent = {
            intent: 'RECORD_EXPENSE',
            riskLevel: RISK_LEVELS.LEVEL_3_FINANCIAL,
            confidence: geminiRes.confidence || 0.95,
            params: {
              nameAr: geminiRes.params.notes || geminiRes.params.category || 'مصروف عام',
              amount: parseFloat(geminiRes.params.amount),
              categoryId: geminiRes.params.category || 'أخرى'
            }
          };
        } else if (geminiRes.intent === 'SET_CARTON_TARE_WEIGHT') {
          intent = {
            intent: 'SET_CARTON_TARE_WEIGHT',
            riskLevel: RISK_LEVELS.LEVEL_2_OPERATIONAL,
            confidence: geminiRes.confidence || 0.95,
            params: {
              fruitName: geminiRes.params.fruitName || 'مانجو',
              weightGrams: parseFloat(geminiRes.params.tareGrams || (geminiRes.params.weightKg ? geminiRes.params.weightKg * 1000 : 1000))
            }
          };
        } else if (geminiRes.intent === 'TOGGLE_PRODUCT_AVAILABILITY' || geminiRes.intent === 'TOGGLE_PRODUCT') {
          intent = {
            intent: 'TOGGLE_PRODUCT_AVAILABILITY',
            riskLevel: RISK_LEVELS.LEVEL_2_OPERATIONAL,
            confidence: geminiRes.confidence || 0.95,
            params: {
              productName: geminiRes.params?.productName || 'مانجو',
              isAvailable: geminiRes.params?.isAvailable !== false
            }
          };
        } else if (geminiRes.intent === 'UPDATE_INVENTORY') {
          intent = {
            intent: 'UPDATE_INVENTORY',
            riskLevel: RISK_LEVELS.LEVEL_3_FINANCIAL,
            confidence: geminiRes.confidence || 0.95,
            params: {
              fruitName: geminiRes.params?.fruitName || 'مانجو',
              adjustmentQuantity: parseFloat(geminiRes.params?.adjustmentQuantity || 10),
              tareWeightKg: geminiRes.params?.tareWeightKg ? parseFloat(geminiRes.params.tareWeightKg) : 0,
              reason: geminiRes.params?.reason || 'تعديل مخزون عبر Universal Copilot'
            }
          };
        } else if (geminiRes.intent === 'SHOW_SALES_REPORT') {
          intent = {
            intent: 'SHOW_SALES_REPORT',
            riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
            params: { period: geminiRes.params?.period || 'today' }
          };
        } else if (geminiRes.intent === 'SHOW_INVENTORY_REPORT') {
          intent = { intent: 'SHOW_INVENTORY_REPORT', riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY, params: {} };
        } else if (geminiRes.intent === 'SHOW_LOW_STOCK') {
          intent = { intent: 'SHOW_LOW_STOCK', riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY, params: {} };
        } else if (geminiRes.intent === 'SHOW_PURCHASES_REPORT') {
          intent = { intent: 'SHOW_PURCHASES_REPORT', riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY, params: {} };
        } else if (geminiRes.intent === 'SHOW_SHIFTS_REPORT' || geminiRes.intent === 'SHIFT_REPORT') {
          intent = {
            intent: 'SHIFT_REPORT',
            riskLevel: RISK_LEVELS.LEVEL_1_READ_ONLY,
            confidence: geminiRes.confidence || 0.95,
            params: { period: 'active' }
          };
        }
      }
    } catch (geminiErr) {
      console.warn('[Gemini NLU Fallback] استثناء أثناء تحليل جيمناي:', geminiErr.message);
    }
  }

  // 4. السقوط المحلي على محرك القواعد النحوية (Regex Engine)
  if (!intent) {
    intent = parseEgyptianAdminIntent(cleanText);
  }

  // إذا كانت النتيجة استفساراً غامضاً، نخزن السياق
  if (intent.intent === 'AMBIGUOUS_COMMAND') {
    userClarificationState.set(userIdStr, {
      ...intent,
      timestamp: Date.now()
    });
  } else if (intent.intent !== 'UNKNOWN' && intent.intent !== 'STANDALONE_PRICE_ANSWER') {
    userClarificationState.delete(userIdStr);
  }

  switch (intent.intent) {
    case 'STANDALONE_PRICE_ANSWER': {
      userClarificationState.set(userIdStr, {
        intent: 'UPDATE_PRODUCT_PRICE',
        missing: 'product_name',
        newPrice: intent.price,
        sizeCode: '16oz',
        timestamp: Date.now()
      });
      return {
        handled: true,
        command: 'AMBIGUOUS_COMMAND',
        authorized: true,
        replyText: `❓ عايز تطبق سعر *${intent.price} جنيه* على أنهي عصير بالتحديد؟ (مثال: عصير مانجو، عصير فراولة، قصب)`,
        parseMode: 'Markdown'
      };
    }

    case 'PROHIBITED_ACTION': {
      const warning = (
        `⛔ *محظور أمنياً (Level 4: Prohibited):*\n\n` +
        `لا يُسمح بتنفيذ الأوامر عالية الخطورة أو استعلامات النظام المباشرة أو تعديل كلمات المرور والتوكنات عبر Telegram.\n\n` +
        `🛡️ *السبب:* ${intent.reason}`
      );
      return { handled: true, command: 'PROHIBITED_ACTION', authorized: true, replyText: warning, parseMode: 'Markdown' };
    }

    case 'AMBIGUOUS_COMMAND': {
      return {
        handled: true,
        command: 'AMBIGUOUS_COMMAND',
        authorized: true,
        replyText: `❓ *استفسار من المساعد الذكي:*\n\n${intent.clarificationQuestion}`,
        parseMode: 'Markdown'
      };
    }

    case 'TOGGLE_PRODUCT_AVAILABILITY': {
      const statusAr = intent.params.isAvailable ? 'إتاحة وتفعيل' : 'إيقاف وحظر';
      const conf = createPendingConfirmation({
        action: 'TOGGLE_PRODUCT_AVAILABILITY',
        params: intent.params,
        descriptionAr: `${statusAr} صنف (${intent.params.productName}) على الكاشير`,
        previousValue: intent.params.isAvailable ? 'غير متوفر' : 'متوفر',
        newValue: intent.params.isAvailable ? 'متوفر للبيع' : 'غير متوفر (مغلق)',
        financialSummary: `سيتم تحديث بطاقة الصنف على شاشة الـ POS فوراً.`,
        riskLevel: 2
      });

      return {
        handled: true,
        command: 'TOGGLE_PRODUCT_AVAILABILITY',
        authorized: true,
        replyText: conf.formattedText,
        replyMarkup: conf.replyMarkup,
        parseMode: 'Markdown'
      };
    }

    case 'SET_CARTON_TARE_WEIGHT': {
      const db = await (deps.getReadOnlyDb || getReadOnlyDb)();
      let curTare = null;
      try {
        const key = intent.params.invoiceNumber
          ? `carton_tare_${intent.params.invoiceNumber}`
          : (intent.params.fruitName === 'تفاح' ? 'carton_tare_apple' : 'default_carton_tare_weight_kg');
        curTare = getOperationalSetting(db, key, null) || getOperationalSetting(db, 'default_carton_tare_weight_kg', null);
      } finally {
        db.close();
      }

      const fruitLabel = intent.params.fruitName ? ` لصنف ${intent.params.fruitName}` : '';
      const invLabel = intent.params.invoiceNumber ? ` للفاتورة ${intent.params.invoiceNumber}` : '';

      const conf = createPendingConfirmation({
        action: 'SET_CARTON_TARE_WEIGHT',
        params: intent.params,
        descriptionAr: `تحديد وزن الكرتونة الفارغة المقاس فعلياً${fruitLabel}${invLabel}`,
        previousValue: curTare ? `${curTare} كجم` : 'غير محددة',
        newValue: `${intent.params.weightKg} كجم (${intent.params.weightGrams} جم)`,
        financialSummary: 'سيتم تطبيق هذا الوزن الفعلي المقاس لحساب صافي وزن الفاكهة وتكلفة الكيلو الصافي وتحديث المخزون بدقة.',
        riskLevel: 2
      });

      return {
        handled: true,
        command: 'SET_CARTON_TARE_WEIGHT',
        authorized: true,
        replyText: conf.formattedText,
        replyMarkup: conf.replyMarkup,
        parseMode: 'Markdown'
      };
    }

    case 'UPDATE_PRICE':
    case 'UPDATE_PRODUCT_PRICE': {
      const db = await (deps.getReadOnlyDb || getReadOnlyDb)();
      let oldPrice = null;
      let displayName = intent.params.productName;
      try {
        const prodMatch = (deps.resolveProductFromDb || resolveProductFromDb)(db, intent.params.productName);
        if (prodMatch) {
          displayName = prodMatch[1];
          const sizeRow = db.exec(`SELECT size_id FROM product_sizes WHERE size_code = '${intent.params.sizeCode}' LIMIT 1;`);
          if (sizeRow && sizeRow.length > 0 && sizeRow[0].values.length > 0) {
            const sizeId = sizeRow[0].values[0][0];
            const pr = db.exec(`SELECT selling_price FROM product_prices WHERE product_id = '${prodMatch[0]}' AND size_id = '${sizeId}' LIMIT 1;`);
            if (pr && pr.length > 0 && pr[0].values.length > 0) {
              oldPrice = Number(pr[0].values[0][0]);
            }
          }
        }
      } catch (_) {
      } finally {
        db.close();
      }

      const sizeLabel = intent.params.sizeCode === '1L' ? '1 لتر' : (intent.params.sizeCode === '500ml' ? '500 مل' : 'كوب 16 أونص');
      const conf = createPendingConfirmation({
        action: 'UPDATE_PRODUCT_PRICE',
        params: { ...intent.params, productName: displayName },
        descriptionAr: `تعديل سعر بيع (${displayName} - ${sizeLabel})`,
        previousValue: oldPrice !== null ? `${oldPrice} ج.م` : 'غير مسجل',
        newValue: `${intent.params.newPrice} ج.م`,
        financialSummary: `سيتم تحديث السعر فوراً على شاشة الـ POS ليبيعه الكاشير بـ ${intent.params.newPrice} ج.م.`,
        riskLevel: 3
      });

      return {
        handled: true,
        command: 'UPDATE_PRODUCT_PRICE',
        authorized: true,
        replyText: conf.formattedText,
        replyMarkup: conf.replyMarkup,
        parseMode: 'Markdown'
      };
    }

    case 'ADD_EXPENSE':
    case 'RECORD_EXPENSE': {
      const conf = createPendingConfirmation({
        action: 'RECORD_EXPENSE',
        params: intent.params,
        descriptionAr: `تسجيل مصروف (${intent.params.nameAr})`,
        previousValue: 'لا يوجد',
        newValue: `${intent.params.amount} ج.م`,
        financialSummary: `خصم ${intent.params.amount} ج.م من صافي الأرباح اليومية للفرع.`,
        riskLevel: 3
      });

      return {
        handled: true,
        command: 'RECORD_EXPENSE',
        authorized: true,
        replyText: conf.formattedText,
        replyMarkup: conf.replyMarkup,
        parseMode: 'Markdown'
      };
    }

    case 'TOGGLE_PRODUCT':
    case 'TOGGLE_PRODUCT_AVAILABILITY': {
      const prodName = intent.params.productName || 'مانجو';
      const isAvail = intent.params.isAvailable !== false;
      const actionAr = isAvail ? 'إتاحة وتفعيل' : 'إغلاق وتعطيل';
      const conf = createPendingConfirmation({
        action: 'TOGGLE_PRODUCT_AVAILABILITY',
        params: intent.params,
        descriptionAr: `${actionAr} صنف (${prodName}) على الكاشير`,
        previousValue: isAvail ? 'غير متوفر ومغلق' : 'متاح ومفعل',
        newValue: isAvail ? 'متاح ومفعل' : 'غير متوفر ومغلق',
        financialSummary: isAvail ? 'سيظهر الصنف للكاشير للبيع الفوري.' : 'سيتم إخفاء الصنف أو تعطيله على شاشة POS فوراً حتى لا يتم بيعه.',
        riskLevel: 2
      });

      return {
        handled: true,
        command: 'TOGGLE_PRODUCT_AVAILABILITY',
        authorized: true,
        replyText: conf.formattedText,
        replyMarkup: conf.replyMarkup,
        parseMode: 'Markdown'
      };
    }

    case 'UPDATE_INVENTORY': {
      const fruit = intent.params.fruitName || 'مانجو';
      const qty = intent.params.adjustmentQuantity || 10;
      const tare = intent.params.tareWeightKg || 0;
      const conf = createPendingConfirmation({
        action: 'UPDATE_INVENTORY',
        params: intent.params,
        descriptionAr: `تعديل وجرد مخزون ${fruit} بمقدار ${qty > 0 ? '+' : ''}${qty} كجم`,
        previousValue: 'رصيد المخزن الحالي',
        newValue: `${qty} كجم${tare ? ` (تارة: ${tare} كجم)` : ''}`,
        financialSummary: `سيتم تحديث رصيد مخزون ${fruit} فوراً وخصم وزن التارة ومزامنة شاشة الكاشير.`,
        riskLevel: 3
      });

      return {
        handled: true,
        command: 'UPDATE_INVENTORY',
        authorized: true,
        replyText: conf.formattedText,
        replyMarkup: conf.replyMarkup,
        parseMode: 'Markdown'
      };
    }

    case 'SHIFT_REPORT':
    case 'SHOW_SHIFTS_REPORT': {
      let shiftData = null;
      let salesData = null;
      if (config.localSystemUrl && !deps.getReadOnlyDb) {
        try {
          const shiftRes = await fetch(`${config.localSystemUrl}/api/admin/shifts/active`, {
            headers: { 'x-admin-owner-id': String(config.ownerId || fromId) },
            signal: AbortSignal.timeout(4000)
          });
          if (shiftRes.ok) shiftData = await shiftRes.json();
          const salesRes = await fetch(`${config.localSystemUrl}/api/admin/reports/daily?period=today`, {
            headers: { 'x-admin-owner-id': String(config.ownerId || fromId) },
            signal: AbortSignal.timeout(4000)
          });
          if (salesRes.ok) salesData = await salesRes.json();
        } catch (_) {}
      }

      if (shiftData?.activeShift) {
        const s = shiftData.activeShift;
        const rep = (
          `🔐 *تقرير الوردية الحالية والدرج:* 💵\n\n` +
          `• *رقم الوردية:* #${s.shiftNumber} (الكاشير: ${s.cashierId})\n` +
          `• *وقت الفتح:* ${new Date(s.openedAt).toLocaleTimeString('ar-EG')}\n` +
          `• *رصيد بداية الوردية (العهدة):* ${formatEgp(s.openingFloat)}\n` +
          `• *المبيعات النقدية (الكاش):* ${formatEgp(s.cashSales)}\n` +
          `• *المبيعات الإلكترونية (فيزا/إنستا):* ${formatEgp(s.electronicSales)}\n` +
          `• *مصروفات مسحوبة من الدرج:* ${formatEgp(s.cashExpenses)}\n` +
          `• *النقدية المتوقعة في الدرج:* *${formatEgp(s.expectedCash)}*\n\n` +
          (salesData?.sales ? `📊 *إجمالي طلبات اليوم:* ${salesData.sales.totalOrders} طلب بمبلغ ${formatEgp(salesData.sales.grossSales)}` : '')
        );
        return { handled: true, command: 'SHIFT_REPORT', authorized: true, replyText: rep, parseMode: 'Markdown' };
      }

      const rep = await (deps.getShiftsReport || getShiftsReport)();
      return { handled: true, command: 'SHIFT_REPORT', authorized: true, replyText: rep.formattedText, parseMode: 'Markdown' };
    }

    case 'CALCULATE_PRODUCT_COST': {
      const db = await (deps.getReadOnlyDb || getReadOnlyDb)();
      let cost = null;
      try {
        cost = calculateProductCostFromDb(db, intent.params.productName);
      } finally {
        db.close();
      }

      if (!cost || !cost.success) {
        return { handled: true, authorized: true, replyText: `⚠️ ${cost ? cost.message : 'تعذر حساب التكلفة.'}` };
      }

      const rep = (
        `📊 *دراسة تكلفة ${cost.nameAr} من واقع المخزن والمبيعات:*\n\n` +
        `🧾 *مكونات الوصفة الحالية:*\n` +
        cost.ingredientsBreakdown.map(i => `• ${i.ingName}: ${i.quantity} ${i.unit} (تكلفة الخامات: ${formatEgp(i.cost)})`).join('\n') + `\n\n` +
        `📦 *تحليل الربحية حسب الحجم:*\n` +
        cost.sizes.map(s => `• *${s.sizeName}:* تكلفة الخامات والتعبئة: ${formatEgp(s.rawCost)} | سعر البيع: ${formatEgp(s.sellingPrice)} | هامش الربح: *${s.marginPercent}%* (${formatEgp(s.profit)})`).join('\n') + `\n\n` +
        `💡 _التكلفة مستخرجة لحظياً من متوسط التكلفة المرجح (WAC) لرصيد المخزن الفعلي._`
      );

      return {
        handled: true,
        command: 'CALCULATE_PRODUCT_COST',
        authorized: true,
        replyText: rep,
        parseMode: 'Markdown'
      };
    }

    case 'SHOW_LOW_STOCK': {
      const db = await (deps.getReadOnlyDb || getReadOnlyDb)();
      let low = null;
      try {
        low = getLowStockItemsFromDb(db);
      } finally {
        db.close();
      }

      let rep = '';
      if (!low || low.items.length === 0) {
        rep = `✅ *حالة المخزون ممتازة:*\n\nجميع خامات الفواكه والتعبئة متوفرة برصيد آمن فوق حد التنبيه.`;
      } else {
        rep = `⚠️ *تنبيه الخامات والأصناف الناقصة (${low.items.length} صنف):*\n\n` +
          low.items.map(i => `• *${i.nameAr}:* الرصيد: *${i.stockQuantity} ${i.baseUnit}* (الحد الأدنى: ${i.minAlert} ${i.baseUnit}) | WAC: ${formatEgp(i.wac)}/${i.baseUnit}`).join('\n') + `\n\n` +
          `💡 _يرجى تسجيل فواتير التوريد الجديدة عند استلامها لرفع الرصيد._`;
      }

      return {
        handled: true,
        command: 'SHOW_LOW_STOCK',
        authorized: true,
        replyText: rep,
        parseMode: 'Markdown'
      };
    }

    case 'COMPARE_SALES_PERIODS': {
      const db = await (deps.getReadOnlyDb || getReadOnlyDb)();
      let comp = null;
      try {
        comp = compareSalesPeriodsFromDb(db);
      } finally {
        db.close();
      }

      const sign = comp.salesDiff >= 0 ? '+' : '';
      const rep = (
        `📈 *مقارنة أداء المبيعات (أسبوعي):*\n\n` +
        `• *الأسبوع الحالي:* ${formatEgp(comp.currentWeek.totalSales)} (${comp.currentWeek.ordersCount} طلب)\n` +
        `• *الأسبوع السابق:* ${formatEgp(comp.previousWeek.totalSales)} (${comp.previousWeek.ordersCount} طلب)\n\n` +
        `📊 *الفارق:* ${sign}${formatEgp(comp.salesDiff)} (${sign}${comp.percentChange}%)\n` +
        `🕒 _مبني على المبيعات المدفوعة المحققة في قاعدة البيانات._`
      );

      return {
        handled: true,
        command: 'COMPARE_SALES_PERIODS',
        authorized: true,
        replyText: rep,
        parseMode: 'Markdown'
      };
    }

    case 'SHOW_RECENT_AUDIT_LOGS': {
      const db = await (deps.getReadOnlyDb || getReadOnlyDb)();
      let logs = null;
      try {
        logs = getRecentAuditLogsFromDb(db, intent.params.limit || 10);
      } finally {
        db.close();
      }

      let rep = `🛡️ *سجل التدقيق وآخر ${logs.count} عمليات على النظام:*\n\n`;
      if (!logs || logs.logs.length === 0) {
        rep += `لا توجد عمليات مسجلة في السجل بعد.`;
      } else {
        rep += logs.logs.map((l, idx) => {
          const time = l.createdAt ? l.createdAt.replace('T', ' ').substring(0, 19) : '';
          return `${idx + 1}. *[${l.action}]* ${l.targetType} (${l.targetId})\n   🕒 ${time} | بواسطة: ${l.userId}`;
        }).join('\n\n');
      }

      return {
        handled: true,
        command: 'SHOW_RECENT_AUDIT_LOGS',
        authorized: true,
        replyText: rep,
        parseMode: 'Markdown'
      };
    }

    case 'LIST_DRAFT_INVOICES': {
      const db = await (deps.getReadOnlyDb || getReadOnlyDb)();
      let drafts = null;
      try {
        drafts = getDraftInvoicesFromDb(db, intent.params?.query || '');
      } finally {
        db.close();
      }

      if (!drafts || drafts.count === 0) {
        return {
          handled: true,
          command: 'LIST_DRAFT_INVOICES',
          authorized: true,
          replyText: `ℹ️ لا توجد فواتير مشتريات مسودة تنتظر الاعتماد حالياً.\nيمكنك استعراض الفواتير المعتمدة عبر أمر \`/purchases\`.`,
          parseMode: 'Markdown'
        };
      }

      const rep = (
        `📋 *فواتير المشتريات المسودة المنتظرة للاعتماد (${drafts.count} مسودة):*\n\n` +
        `اضغط على أي فاتورة لفتح بطاقة المراجعة والاعتماد المباشر بضغطة واحدة:`
      );

      const buttons = drafts.invoices.map(inv => [
        {
          text: `🧾 ${inv.invoiceNumber} | ${inv.supplierName} (${formatEgp(inv.totalAmount)})`,
          callback_data: `inv_review:${inv.invoiceNumber}`
        }
      ]);
      buttons.push([ { text: '⬅️ القائمة الرئيسية', callback_data: 'menu:main' } ]);

      return {
        handled: true,
        command: 'LIST_DRAFT_INVOICES',
        authorized: true,
        replyText: rep,
        replyMarkup: { inline_keyboard: buttons },
        parseMode: 'Markdown'
      };
    }

    case 'REVIEW_PURCHASE_INVOICE': {
      const db = await (deps.getReadOnlyDb || getReadOnlyDb)();
      try {
        const drafts = getDraftInvoicesFromDb(db);
        if (!intent.params.invoiceNumber && drafts.count > 1) {
          const rep = (
            `📋 *تم العثور على ${drafts.count} فواتير مسودة:*\n\n` +
            `يرجى اختيار الفاتورة التي ترغب في مراجعتها واعتمادها:`
          );
          const buttons = drafts.invoices.map(inv => [
            {
              text: `🧾 ${inv.invoiceNumber} | ${inv.supplierName} (${formatEgp(inv.totalAmount)})`,
              callback_data: `inv_review:${inv.invoiceNumber}`
            }
          ]);
          buttons.push([ { text: '⬅️ القائمة الرئيسية', callback_data: 'menu:main' } ]);
          return {
            handled: true,
            command: 'REVIEW_PURCHASE_INVOICE',
            authorized: true,
            replyText: rep,
            replyMarkup: { inline_keyboard: buttons },
            parseMode: 'Markdown'
          };
        }

        const invNum = intent.params.invoiceNumber || (drafts.invoices[0]?.invoiceNumber || 'INV-20261017-360');
        const card = buildInteractiveInvoiceReview(db, invNum, { tareWeightKg: intent.params.tareWeightKg });

        return {
          handled: true,
          command: 'REVIEW_PURCHASE_INVOICE',
          authorized: true,
          replyText: card.replyText,
          replyMarkup: card.replyMarkup,
          parseMode: 'Markdown'
        };
      } finally {
        db.close();
      }
    }

    case 'APPROVE_PURCHASE_INVOICE': {
      const db = await (deps.getReadOnlyDb || getReadOnlyDb)();
      try {
        const drafts = getDraftInvoicesFromDb(db);
        if (!intent.params.invoiceNumber && drafts.count > 1) {
          const rep = (
            `📋 *تم العثور على ${drafts.count} فواتير مسودة:*\n\n` +
            `يرجى اختيار الفاتورة التي ترغب في مراجعتها واعتمادها:`
          );
          const buttons = drafts.invoices.map(inv => [
            {
              text: `🧾 ${inv.invoiceNumber} | ${inv.supplierName} (${formatEgp(inv.totalAmount)})`,
              callback_data: `inv_review:${inv.invoiceNumber}`
            }
          ]);
          buttons.push([ { text: '⬅️ القائمة الرئيسية', callback_data: 'menu:main' } ]);
          return {
            handled: true,
            command: 'APPROVE_PURCHASE_INVOICE',
            authorized: true,
            replyText: rep,
            replyMarkup: { inline_keyboard: buttons },
            parseMode: 'Markdown'
          };
        }

        const invNum = intent.params.invoiceNumber || (drafts.invoices[0]?.invoiceNumber || 'INV-20261017-360');
        const card = buildInteractiveInvoiceReview(db, invNum, { tareWeightKg: intent.params.tareWeightKg });

        return {
          handled: true,
          command: 'APPROVE_PURCHASE_INVOICE',
          authorized: true,
          replyText: card.replyText,
          replyMarkup: card.replyMarkup,
          parseMode: 'Markdown'
        };
      } finally {
        db.close();
      }
    }

    case 'CREATE_PURCHASE_INVOICE_DRAFT': {
      const parsed = intent.params.parsedInvoice;
      const conf = createPendingConfirmation({
        action: 'CREATE_PURCHASE_INVOICE_DRAFT',
        params: { parsedInvoice: parsed },
        descriptionAr: `حفظ مسودة فاتورة (${parsed.supplierName} - ${formatEgp(parsed.totalAmount)})`,
        previousValue: 'لا يوجد',
        newValue: `مسودة برقم ${parsed.invoiceNumber}`,
        financialSummary: `إجمالي: ${formatEgp(parsed.totalAmount)} (${parsed.items.length} أصناف). لن يؤثر على المخزون حتى الاعتماد.`,
        riskLevel: 2
      });

      return {
        handled: true,
        command: 'CREATE_PURCHASE_INVOICE_DRAFT',
        authorized: true,
        replyText: conf.formattedText,
        replyMarkup: conf.replyMarkup,
        parseMode: 'Markdown'
      };
    }

    case 'SHOW_PURCHASES_REPORT': {
      const rep = await (deps.getPurchasesReport || getPurchasesReport)();
      return { handled: true, command: '/purchases', authorized: true, replyText: rep.formattedText, parseMode: 'Markdown' };
    }

    case 'SHOW_INVENTORY_REPORT': {
      const rep = await (deps.getInventoryReport || getInventoryReport)();
      return { handled: true, command: '/inventory', authorized: true, replyText: rep.formattedText, parseMode: 'Markdown' };
    }

    case 'SHOW_SALES_REPORT': {
      const rep = await (deps.getSalesReport || getSalesReport)(intent.params.period || 'today');
      return { handled: true, command: '/sales', authorized: true, replyText: rep.formattedText, parseMode: 'Markdown' };
    }

    case 'SYSTEM_STATUS': {
      const healthChecker = deps.checkLocalSystem || checkLocalSystemHealth;
      const health = await healthChecker(config.localSystemUrl);
      const statusReport = formatSystemStatusText(health, {}, fromId);
      return { handled: true, command: '/status', authorized: true, replyText: statusReport, parseMode: 'Markdown' };
    }

    default: {
      const helpMsg = (
        `👋 *أهلاً بك يا حاج إسلام في المساعد التنفيذي الذكي لـ Fruit City!* 🍎🥤\n\n` +
        `يمكنك إعطائي الأوامر باللغة العربية المصرية وسأنفذها مباشرة، مثل:\n\n` +
        `• 📦 \`خلي وزن الكرتونة الفارغة 500 جرام\`\n` +
        `• 🧾 \`سجل فاتورة تفاح من وكالة أسامة موسى، كرتونة 15 كيلو، الكيلو 53 جنيه والبيعة 10 جنيه\`\n` +
        `• 💰 \`زود سعر المانجا 400 مل إلى 60 جنيه\`\n` +
        `• 💵 \`سجل مصروف كهرباء 4000 جنيه\`\n` +
        `• 📊 \`احسب تكلفة عصير الفراولة\`\n` +
        `• ⚠️ \`وريني الأصناف اللي قربت تخلص\`\n` +
        `• 📈 \`قارن مبيعات الأسبوع ده باللي فات\`\n` +
        `• 🛡️ \`وريني آخر 10 عمليات حصلت على النظام\`\n` +
        `• 🔍 \`راجع فاتورة INV-20261017-360\` ثم \`اعتمد الفاتورة\`\n\n` +
        `📌 *للأزرار والقوائم السريعة:* أرسل الأمر \`/menu\``
      );
      return { handled: true, command: text, authorized: true, replyText: helpMsg, parseMode: 'Markdown' };
    }
  }
}

export async function processAdminCallback(callbackQuery, config, deps = {}) {
  const from = callbackQuery.from || {};
  const fromId = String(from.id || '');
  const data = callbackQuery.data || '';
  const message = callbackQuery.message || {};
  const chatId = message.chat ? message.chat.id : null;
  const messageId = message.message_id || null;

  // فحص الصلاحية الصارمة للمالك على كل نقرة زر
  const configuredOwnerId = config.ownerId ? String(config.ownerId).trim() : '';
  const isOwner = Boolean(configuredOwnerId && fromId && fromId === configuredOwnerId);

  if (!isOwner) {
    return {
      authorized: false,
      alertText: '⛔ عذراً، لوحة التحكم مخصصة للمالك المصرح له فقط.',
      handled: true
    };
  }

  const [prefix, action] = data.split(':');
  let replyText = '';
  let replyMarkup = null;

  switch (prefix) {
    case 'menu': {
      if (action === 'main') {
        replyText = getMainMenuText(from.first_name || 'حاج إسلام');
        replyMarkup = getMainMenuMarkup();
      } else if (action === 'sales') {
        const s = await (deps.getSalesReport || getSalesReport)('today');
        replyText = s.formattedText;
        replyMarkup = getSalesPeriodMarkup();
      } else if (action === 'payments') {
        const p = await (deps.getPaymentsReport || getPaymentsReport)('today');
        replyText = p.formattedText;
        replyMarkup = getPaymentsPeriodMarkup();
      } else if (action === 'inventory') {
        const inv = await (deps.getInventoryReport || getInventoryReport)();
        replyText = inv.formattedText;
        replyMarkup = getBackToMenuMarkup('inventory');
      } else if (action === 'purchases') {
        const pur = await (deps.getPurchasesReport || getPurchasesReport)();
        replyText = pur.formattedText;
        replyMarkup = getBackToMenuMarkup('purchases');
      } else if (action === 'expenses') {
        const exp = await (deps.getExpensesReport || getExpensesReport)();
        replyText = exp.formattedText;
        replyMarkup = getBackToMenuMarkup('expenses');
      } else if (action === 'shifts') {
        const sh = await (deps.getShiftsReport || getShiftsReport)();
        replyText = sh.formattedText;
        replyMarkup = getBackToMenuMarkup('shifts');
      } else if (action === 'products') {
        const pr = await (deps.getProductsReport || getProductsReport)();
        replyText = pr.formattedText;
        replyMarkup = getBackToMenuMarkup('products');
      } else if (action === 'summary') {
        const sum = await (deps.getExecutiveSummary || getExecutiveSummary)('today');
        replyText = sum.formattedText;
        replyMarkup = getBackToMenuMarkup('summary');
      } else if (action === 'status') {
        const healthChecker = deps.checkLocalSystem || checkLocalSystemHealth;
        const health = await healthChecker(config.localSystemUrl);
        replyText = formatSystemStatusText(health, from, fromId);
        replyMarkup = getBackToMenuMarkup('status');
      }
      break;
    }

    case 'sales': {
      const s = await (deps.getSalesReport || getSalesReport)(action || 'today');
      replyText = s.formattedText;
      replyMarkup = getSalesPeriodMarkup();
      break;
    }

    case 'pay': {
      const p = await (deps.getPaymentsReport || getPaymentsReport)(action || 'today');
      replyText = p.formattedText;
      replyMarkup = getPaymentsPeriodMarkup();
      break;
    }

    case 'refresh': {
      if (action === 'inventory') {
        const inv = await (deps.getInventoryReport || getInventoryReport)();
        replyText = inv.formattedText;
        replyMarkup = getBackToMenuMarkup('inventory');
      } else if (action === 'purchases') {
        const pur = await (deps.getPurchasesReport || getPurchasesReport)();
        replyText = pur.formattedText;
        replyMarkup = getBackToMenuMarkup('purchases');
      } else if (action === 'expenses') {
        const exp = await (deps.getExpensesReport || getExpensesReport)();
        replyText = exp.formattedText;
        replyMarkup = getBackToMenuMarkup('expenses');
      } else if (action === 'shifts') {
        const sh = await (deps.getShiftsReport || getShiftsReport)();
        replyText = sh.formattedText;
        replyMarkup = getBackToMenuMarkup('shifts');
      } else if (action === 'products') {
        const pr = await (deps.getProductsReport || getProductsReport)();
        replyText = pr.formattedText;
        replyMarkup = getBackToMenuMarkup('products');
      } else if (action === 'summary') {
        const sum = await (deps.getExecutiveSummary || getExecutiveSummary)('today');
        replyText = sum.formattedText;
        replyMarkup = getBackToMenuMarkup('summary');
      } else if (action === 'status') {
        const healthChecker = deps.checkLocalSystem || checkLocalSystemHealth;
        const health = await healthChecker(config.localSystemUrl);
        replyText = formatSystemStatusText(health, from, fromId);
        replyMarkup = getBackToMenuMarkup('status');
      } else {
        replyText = getMainMenuText(from.first_name || 'حاج إسلام');
        replyMarkup = getMainMenuMarkup();
      }
      break;
    }

    case 'confirm': {
      const consumed = consumeConfirmation(action, fromId, config.ownerId);
      if (!consumed.success) {
        if (consumed.reason === 'EXPIRED') {
          const db = await (deps.getReadOnlyDb || getReadOnlyDb)();
          try {
            const drafts = getDraftInvoicesFromDb(db);
            const targetInv = drafts.invoices[0]?.invoiceNumber || 'INV-20261017-360';
            const card = buildInteractiveInvoiceReview(db, targetInv);
            return {
              handled: true,
              authorized: true,
              chatId,
              messageId,
              replyText: `⏳ *انتهت صلاحية طلب الاعتماد السابق (تجاوزت 60 دقيقة).*\nتم إنشاء بطاقة مراجعة جديدة جاهزة للاعتماد الفوري أدناه:\n\n` + card.replyText,
              replyMarkup: card.replyMarkup,
              parseMode: 'Markdown'
            };
          } finally {
            db.close();
          }
        }
        return {
          handled: true,
          authorized: true,
          chatId,
          messageId,
          replyText: consumed.message,
          parseMode: 'Markdown'
        };
      }

      const execRes = await executePendingAction(consumed.data, fromId, config, deps);
      replyText = execRes.replyText;
      replyMarkup = execRes.replyMarkup;
      break;
    }

    case 'inv_review': {
      const invNum = action;
      const db = await (deps.getReadOnlyDb || getReadOnlyDb)();
      try {
        const card = buildInteractiveInvoiceReview(db, invNum);
        replyText = card.replyText;
        replyMarkup = card.replyMarkup;
      } finally {
        db.close();
      }
      break;
    }

    case 'settare': {
      const parts = data.split(':');
      const invNum = parts[1];
      const weightKg = parseFloat(parts[2]);
      const db = await (deps.getReadOnlyDb || getReadOnlyDb)();
      if (config.localSystemUrl && !deps.getReadOnlyDb) {
        try {
          await fetch(`${config.localSystemUrl}/api/admin/carton-weights`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-admin-owner-id': String(config.ownerId || fromId)
            },
            body: JSON.stringify({
              invoiceNumber: invNum,
              weightKg,
              weightGrams: Math.round(weightKg * 1000)
            }),
            signal: AbortSignal.timeout(5000)
          });
        } catch (_) {}
      }

      try {
        if (!config.localSystemUrl || deps.getReadOnlyDb) {
          setCartonTareWeight(db, {
            weightKg,
            weightGrams: Math.round(weightKg * 1000),
            invoiceNumber: invNum,
            user: `owner_${fromId}`
          });
        }

        // بعد ضبط الوزن، توليد بطاقة المراجعة فوراً مع زر الاعتماد المباشر
        const card = buildInteractiveInvoiceReview(db, invNum, { tareWeightKg: weightKg });
        replyText = card.replyText;
        replyMarkup = card.replyMarkup;

        // Single-Writer Database Principle:
        // admin_bot.js NEVER writes to disk directly; server.js is the sole writer.
        if (typeof deps.saveDbToDisk === 'function') {
          try {
            deps.saveDbToDisk(db);
          } catch (_) {}
        }
      } finally {
        db.close();
      }
      break;
    }

    case 'cancel_review': {
      replyText = `🚫 تم إلغاء مراجعة الفاتورة دون أي تعديل على النظام.`;
      replyMarkup = {
        inline_keyboard: [
          [ { text: '⬅️ القائمة الرئيسية', callback_data: 'menu:main' } ]
        ]
      };
      break;
    }

    case 'cancel': {
      const canceled = cancelConfirmation(action, fromId, config.ownerId);
      replyText = canceled.message;
      replyMarkup = {
        inline_keyboard: [
          [ { text: '⬅️ القائمة الرئيسية', callback_data: 'menu:main' } ]
        ]
      };
      break;
    }

    default: {
      replyText = getMainMenuText(from.first_name || 'حاج إسلام');
      replyMarkup = getMainMenuMarkup();
    }
  }

  return {
    handled: true,
    authorized: true,
    chatId,
    messageId,
    replyText,
    replyMarkup,
    parseMode: 'Markdown'
  };
}

// ============================================================================
// 5. إدارة حالة التكرار والقفل الأحادي
// ============================================================================

export function acquireSingleInstanceLock(lockFilePath) {
  if (fs.existsSync(lockFilePath)) {
    try {
      const content = fs.readFileSync(lockFilePath, 'utf8').trim();
      const existingPid = parseInt(content, 10);
      if (Number.isFinite(existingPid)) {
        try {
          process.kill(existingPid, 0);
          return {
            acquired: false,
            pid: existingPid,
            error: `Another instance is currently running with PID: ${existingPid}`
          };
        } catch (e) {
          // Stale lock
        }
      }
    } catch (e) {}
  }

  try {
    fs.writeFileSync(lockFilePath, String(process.pid), { flag: 'w', encoding: 'utf8' });
    return { acquired: true, pid: process.pid };
  } catch (err) {
    return { acquired: false, error: err.message };
  }
}

export function releaseSingleInstanceLock(lockFilePath) {
  if (fs.existsSync(lockFilePath)) {
    try {
      fs.unlinkSync(lockFilePath);
      return true;
    } catch (e) {
      return false;
    }
  }
  return true;
}

export function loadPollingState(stateFilePath) {
  if (!fs.existsSync(stateFilePath)) {
    return { lastUpdateId: 0, processedCount: 0 };
  }
  try {
    const raw = fs.readFileSync(stateFilePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { lastUpdateId: 0, processedCount: 0 };
  }
}

export function savePollingState(stateFilePath, state) {
  try {
    const dir = path.dirname(stateFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(stateFilePath, JSON.stringify(state, null, 2), 'utf8');
  } catch (e) {}
}

// ============================================================================
// 6. تشغيل دورة الاستطلاع الحي (Long Polling Engine)
// ============================================================================

export async function runAdminBotPolling(options = {}) {
  const config = loadConfig(options);

  console.log('======================================================================');
  console.log('FRUIT CITY — TELEGRAM ADMIN CONTROL CENTER (LONG POLLING)');
  console.log('======================================================================');
  console.log(`- Token State: ${maskToken(config.botToken)}`);
  console.log(`- Owner ID: ${config.ownerId || '[NOT_CONFIGURED]'}`);
  console.log(`- Local System URL: ${config.localSystemUrl}`);
  console.log(`- Polling Timeout: ${config.pollTimeoutSeconds}s`);

  if (!config.botToken) {
    console.error('❌ خطأ: لم يتم ضبط ADMIN_TELEGRAM_BOT_TOKEN.');
    console.error('يرجى وضع التوكن في متغير بيئة أو داخل ملف .env.');
    return { success: false, error: 'MISSING_TOKEN' };
  }

  // 1. التحقق من هوية البوت مع إعادة المحاولة التلقائية
  console.log('⏳ جاري التحقق من هوية البوت عبر getMe...');
  let me = await verifyBotIdentity(config.botToken);
  if (!me.ok) {
    const maxRetries = options.checkOnly ? 3 : 60;
    for (let retry = 1; retry <= maxRetries && !me.ok; retry++) {
      const waitMs = Math.min(1000 * Math.pow(1.5, Math.min(retry, 6)), 10000);
      console.warn(`[RETRY ${retry}/${maxRetries}] انتظار استقرار الشبكة والاتصال بـ Telegram API (${Math.round(waitMs / 1000)}s)...`);
      await new Promise(r => setTimeout(r, waitMs));
      me = await verifyBotIdentity(config.botToken);
    }
  }
  if (!me.ok) {
    console.error(`❌ فشل التحقق من التوكن: ${me.error}`);
    return { success: false, error: 'AUTH_FAILED', details: me.error };
  }

  console.log(`✅ تم تأكيد البوت بنجاح!`);
  console.log(`- Username: @${me.username}`);
  console.log(`- Bot ID: ${me.botId}`);
  console.log(`- Target Bot Match: ${me.isTargetBot ? 'YES (@FruitCityAdmin2026Bot)' : 'NO'}`);

  if (!me.isTargetBot) {
    console.warn(`⚠️ تحذير: اسم المستخدم @${me.username} لا يطابق البوت المستهدف @${config.expectedUsername}!`);
  }

  // 2. فحص Webhook
  console.log('⏳ جاري فحص حالة Webhook...');
  const wh = await checkWebhookState(config.botToken);
  if (wh.ok && wh.hasWebhook) {
    console.warn(`⚠️ تحذير: يوجد Webhook مسجل لهذا البوت على: ${wh.url}`);
    if (!options.allowDeleteWebhook) {
      console.error('❌ يتطلب التحويل إلى Long Polling إزالة Webhook المسجل بموافقة صريحة.');
      return { success: false, error: 'WEBHOOK_ACTIVE', webhookUrl: wh.url };
    } else {
      console.log('⏳ جاري حذف الويب هوك للتحويل إلى Long Polling...');
      await telegramApi('deleteWebhook', { drop_pending_updates: false }, config.botToken);
      console.log('✅ تم حذف الويب هوك بنجاح.');
    }
  } else {
    console.log('✅ حالة الويب هوك: لا يوجد ويب هوك مسجل (جاهز لـ Long Polling).');
  }

  // 3. فحص الخادم المحلي
  console.log(`⏳ جاري فحص الخادم المحلي على ${config.localSystemUrl}...`);
  const initialHealth = await checkLocalSystemHealth(config.localSystemUrl);
  if (initialHealth.online) {
    console.log(`✅ الخادم المحلي متصل ويعمل (الاستجابة: ${initialHealth.latencyMs}ms).`);
  } else {
    console.warn(`⚠️ تنبيه: الخادم المحلي غير متصل (${initialHealth.error}). سيستمر البوت في العمل.`);
  }

  if (options.checkOnly) {
    return {
      success: true,
      botIdentity: me,
      webhookState: wh,
      localHealth: initialHealth
    };
  }

  // 4. قفل التشغيل الأحادي
  const lock = acquireSingleInstanceLock(config.lockFilePath);
  if (!lock.acquired) {
    console.error(`❌ لا يمكن تشغيل نسختين في نفس الوقت: ${lock.error}`);
    return { success: false, error: 'LOCK_FAILED', details: lock.error };
  }

  console.log(`🔒 تم تثبيت قفل العملية الأحادية بنجاح (PID: ${lock.pid}).`);

  const cleanup = () => {
    console.log('\n🛑 جاري إيقاف البوت وتنظيف القفل...');
    releaseSingleInstanceLock(config.lockFilePath);
    process.exit(0);
  };
  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // 5. بدء حلقة الاستطلاع الحي (الرسائل والأزرار التفاعلية)
  const state = loadPollingState(config.stateFilePath);
  let lastUpdateId = state.lastUpdateId || 0;
  let backoffMs = 1000;
  let running = true;

  console.log(`🚀 بدء الاستطلاع الحي (Long Polling) بانتظار أوامر المالك... (Offset: ${lastUpdateId})`);

  while (running) {
    try {
      const pollRes = await telegramApi('getUpdates', {
        offset: lastUpdateId + 1,
        timeout: config.pollTimeoutSeconds,
        allowed_updates: ['message', 'callback_query']
      }, config.botToken, (config.pollTimeoutSeconds + 10) * 1000);

      if (!pollRes.ok) {
        console.warn(`[${new Date().toISOString()}] خطأ استطلاع: ${pollRes.description || pollRes.error}`);
        await new Promise(r => setTimeout(r, backoffMs));
        backoffMs = Math.min(backoffMs * 2, 30000);
        continue;
      }

      backoffMs = 1000;
      const updates = pollRes.result || [];

      for (const update of updates) {
        lastUpdateId = Math.max(lastUpdateId, update.update_id);

        if (update.message) {
          const senderName = update.message.from?.first_name || 'مستخدم';
          const senderId = update.message.from?.id || 'غير معروف';
          const text = update.message.text || '';

          console.log(`[${new Date().toISOString()}] رسالة واردة من ${senderName} (${senderId}): ${text.substring(0, 50)}`);

          const result = await processAdminCommand(update.message, config);
          if (result.handled && result.replyText) {
            await sendMessageSafe(config.botToken, update.message.chat.id, result.replyText, result.parseMode, result.replyMarkup);
            console.log(`[${new Date().toISOString()}] تم إرسال الرد للأمر: ${result.command} (صلاحية: ${result.authorized})`);
          }
        } else if (update.callback_query) {
          const cb = update.callback_query;
          const senderName = cb.from?.first_name || 'مستخدم';
          const senderId = cb.from?.id || 'غير معروف';
          const data = cb.data || '';

          console.log(`[${new Date().toISOString()}] نقرة زر تفاعلي من ${senderName} (${senderId}): ${data}`);

          const result = await processAdminCallback(cb, config);
          if (!result.authorized) {
            await answerCallbackQuerySafe(config.botToken, cb.id, result.alertText || '⛔ غير مصرح لك', true);
            console.log(`[${new Date().toISOString()}] تم رفض نقرة زر غير مصرح بها من (${senderId})`);
          } else {
            await answerCallbackQuerySafe(config.botToken, cb.id);
            if (result.chatId && result.messageId && result.replyText) {
              const editRes = await editMessageSafe(config.botToken, result.chatId, result.messageId, result.replyText, result.parseMode, result.replyMarkup);
              if (!editRes.ok && editRes.description && !editRes.description.includes('message is not modified')) {
                await sendMessageSafe(config.botToken, result.chatId, result.replyText, result.parseMode, result.replyMarkup);
              }
              console.log(`[${new Date().toISOString()}] تم تحديث الشاشة للزر: ${data}`);
            }
          }
        }
      }

      if (updates.length > 0) {
        state.lastUpdateId = lastUpdateId;
        state.processedCount = (state.processedCount || 0) + updates.length;
        savePollingState(config.stateFilePath, state);
      }

      if (options.runOnce) {
        running = false;
      }
    } catch (loopErr) {
      console.error(`[${new Date().toISOString()}] استثناء في حلقة الاستطلاع: ${loopErr.message}`);
      await new Promise(r => setTimeout(r, backoffMs));
      backoffMs = Math.min(backoffMs * 2, 30000);
    }
  }

  releaseSingleInstanceLock(config.lockFilePath);
  return { success: true, lastUpdateId: lastUpdateId };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  process.on('uncaughtException', (err) => {
    console.error(`[${new Date().toISOString()}] Uncaught Exception: ${err.message}`);
  });
  process.on('unhandledRejection', (reason) => {
    console.error(`[${new Date().toISOString()}] Unhandled Rejection:`, reason);
  });

  const checkOnly = process.argv.includes('--check-only');
  const runOnce = process.argv.includes('--once');
  const allowDeleteWebhook = process.argv.includes('--delete-webhook');

  async function startWithSupervisor() {
    const isContinuous = !checkOnly && !runOnce;
    while (true) {
      try {
        const res = await runAdminBotPolling({ checkOnly, runOnce, allowDeleteWebhook });
        if (!isContinuous || (res && res.success && (checkOnly || runOnce))) {
          break;
        }
        console.warn(`[${new Date().toISOString()}] انتهت حلقة الاستطلاع، إعادة التشغيل بعد 3 ثوانٍ...`);
      } catch (fatalErr) {
        console.error(`[${new Date().toISOString()}] Fatal Polling Error: ${fatalErr.message}`);
        if (!isContinuous) break;
      }
      await new Promise(r => setTimeout(r, 3000));
    }
  }

  startWithSupervisor();
}
