/**
 * ==============================================================================
 * FRUIT CITY — ADMIN BOT SETUP HELPER (UTF-8 NATIVE)
 * ==============================================================================
 * يساعد في إعداد وحفظ توكن البوت @FruitCityAdmin2026Bot محلياً بأمان،
 * مع التحقق الفوري من هوية البوت وفحص الويب هوك وكتابة ملف .env في المسارين.
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';
import { verifyBotIdentity, checkWebhookState, telegramApi, maskToken } from './admin_bot.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SCRATCH_ENV = path.resolve(__dirname, '..', '..', '.env');
const DOC_ENV = path.resolve('C:\\Users\\MR.X\\Documents\\ChatGPT\\fruit city\\.env');

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, answer => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

export async function setupBot(tokenInput, ownerIdInput = '', deleteWebhookIfActive = false) {
  let token = (tokenInput || '').trim();
  let ownerId = (ownerIdInput || '').trim();

  if (!token) {
    console.log('======================================================================');
    console.log('FRUIT CITY — إعداد بوت الإدارة (@FruitCityAdmin2026Bot)');
    console.log('======================================================================\n');
    token = await prompt('📌 أدخل Token البوت المستخرج من BotFather: ');
  }

  if (!token) {
    console.error('❌ خطأ: لم يتم إدخال التوكن. تم إلغاء العملية.');
    return { success: false, error: 'NO_TOKEN' };
  }

  console.log(`\n⏳ جاري التحقق من التوكن مع خوادم Telegram (${maskToken(token)})...`);
  const me = await verifyBotIdentity(token);

  if (!me.ok) {
    console.error(`❌ التوكن غير صالح! رد تليجرام: ${me.error}`);
    return { success: false, error: 'INVALID_TOKEN', details: me.error };
  }

  console.log(`✅ تم التحقق من البوت بنجاح!`);
  console.log(`- Username: @${me.username}`);
  console.log(`- Bot ID: ${me.botId}`);
  console.log(`- Target Bot Match: ${me.isTargetBot ? 'نعم (@FruitCityAdmin2026Bot) ✅' : '⚠️ غير متطابق!'}`);

  if (!me.isTargetBot) {
    console.warn(`\n⚠️ تحذير: التوكن يخص @${me.username} وليس @FruitCityAdmin2026Bot المطلوب.`);
  }

  // فحص Webhook
  console.log('⏳ جاري فحص حالة Webhook...');
  const wh = await checkWebhookState(token);
  if (wh.ok && wh.hasWebhook) {
    console.warn(`⚠️ يوجد Webhook مسجل لهذا البوت على: ${wh.url}`);
    if (deleteWebhookIfActive) {
      console.log('⏳ جاري حذف Webhook لتمكين Long Polling...');
      await telegramApi('deleteWebhook', { drop_pending_updates: false }, token);
      console.log('✅ تم حذف Webhook بنجاح.');
    } else {
      console.log('💡 ملاحظة: لبدء Long Polling يلزم حذف الويب هوك القديم.');
    }
  } else {
    console.log('✅ حالة الويب هوك: لا يوجد ويب هوك مسجل (جاهز لـ Long Polling).');
  }

  if (!ownerId && process.stdin.isTTY) {
    ownerId = await prompt('\n📌 أدخل معرف حسابك الرقمي على تليجرام OWNER_TELEGRAM_ID (اختياري - اضغط Enter للتخطي): ');
  }

  // محتوى .env
  const envContent = [
    '# Fruit City Admin Bot Local Configuration',
    `ADMIN_TELEGRAM_BOT_TOKEN=${token}`,
    `OWNER_TELEGRAM_ID=${ownerId}`,
    'LOCAL_SYSTEM_URL=http://127.0.0.1:5173',
    'POLL_TIMEOUT_SECONDS=25',
    ''
  ].join('\n');

  // الحفظ في المسارين
  try {
    fs.writeFileSync(SCRATCH_ENV, envContent, 'utf8');
    console.log(`✅ تم حفظ الإعدادات في: ${SCRATCH_ENV}`);
  } catch (e) {
    console.error(`خطأ في حفظ ${SCRATCH_ENV}: ${e.message}`);
  }

  try {
    const docDir = path.dirname(DOC_ENV);
    if (fs.existsSync(docDir)) {
      fs.writeFileSync(DOC_ENV, envContent, 'utf8');
      console.log(`✅ تم حفظ الإعدادات في: ${DOC_ENV}`);
    }
  } catch (e) {
    console.error(`خطأ في حفظ ${DOC_ENV}: ${e.message}`);
  }

  console.log('\n======================================================================');
  console.log('🎉 اكتمل إعداد بوت الإدارة بنجاح!');
  console.log('يمكنك الآن تشغيل البوت عبر: run_admin_bot.bat أو node integrations/telegram/admin_bot.js');
  console.log('======================================================================');

  return {
    success: true,
    botIdentity: me,
    webhookState: wh
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  const tokenArgIdx = process.argv.indexOf('--token');
  const ownerArgIdx = process.argv.indexOf('--owner-id');
  const deleteWh = process.argv.includes('--delete-webhook');

  const tokenVal = tokenArgIdx !== -1 ? process.argv[tokenArgIdx + 1] : '';
  const ownerVal = ownerArgIdx !== -1 ? process.argv[ownerArgIdx + 1] : '';

  setupBot(tokenVal, ownerVal, deleteWh);
}
