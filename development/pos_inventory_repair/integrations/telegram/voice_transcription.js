/**
 * ==============================================================================
 * FRUIT CITY — TELEGRAM VOICE TRANSCRIPTION & AUDIO INTAKE
 * ==============================================================================
 * وحدة استقبال وتفريغ الرسائل الصوتية (Voice / Audio) باللهجة المصرية.
 * 
 * الميزات:
 * 1. تحميل الملف الصوتي الآمن عبر Telegram Bot API (getFile + download).
 * 2. الحفظ والنسخ الاحتياطي الفوري في الذاكرة المحلية (voice_cache).
 * 3. الفصل التام بين طبقة استقبال الصوت (Intake)، التفريغ (STT)، وفهم النوايا (NLU).
 * 4. دعم محولات التفريغ المحلية والمجانية مع قواميس خاصة بمصطلحات سوق الفاكهة.
 * 5. حماية تامة ضد الضوضاء والأصوات غير الواضحة مع التوجيه الآمن للمالك.
 * 6. توافق كامل مع اختبارات الوحدة والتشغيل الميداني الحي.
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { normalizeEgyptianSpeech } from './nlu_engine.js';

const execFileAsync = promisify(execFile);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * حفظ الملف الصوتي محلياً في voice_cache مع بياناته الوصفية
 */
export function cacheVoiceAudio(buffer, metadata = {}, baseDir = null) {
  try {
    const targetDir = baseDir || path.resolve(__dirname, 'voice_cache');
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const safeFileId = (metadata.fileId || `voice_${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
    const ogaPath = path.join(targetDir, `${safeFileId}.oga`);
    const jsonPath = path.join(targetDir, `${safeFileId}.json`);

    fs.writeFileSync(ogaPath, buffer);
    const metaPayload = {
      fileId: metadata.fileId || null,
      fileUniqueId: metadata.fileUniqueId || null,
      fromId: metadata.fromId || null,
      fromUsername: metadata.fromUsername || null,
      duration: metadata.duration || 0,
      mimeType: metadata.mimeType || 'audio/ogg',
      fileSize: buffer.length,
      cachedAt: new Date().toISOString()
    };
    fs.writeFileSync(jsonPath, JSON.stringify(metaPayload, null, 2), 'utf-8');

    return {
      success: true,
      ogaPath,
      jsonPath,
      fileSize: buffer.length
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * تحميل الملف الصوتي من تليجرام باستخدام file_id
 */
export async function downloadTelegramAudio(token, fileId, options = {}) {
  if (!token) {
    return { success: false, error: 'MISSING_BOT_TOKEN' };
  }
  if (!fileId) {
    return { success: false, error: 'MISSING_FILE_ID' };
  }

  const getFileUrl = `https://api.telegram.org/bot${token}/getFile?file_id=${encodeURIComponent(fileId)}`;
  
  try {
    const res = await fetch(getFileUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(options.timeoutMs || 25000)
    });

    const data = await res.json();
    if (!data || !data.ok || !data.result || !data.result.file_path) {
      return {
        success: false,
        error: data?.description || 'Could not resolve file path from Telegram'
      };
    }

    const filePath = data.result.file_path;
    const downloadUrl = `https://api.telegram.org/file/bot${token}/${filePath}`;

    const downloadRes = await fetch(downloadUrl, {
      signal: AbortSignal.timeout(options.timeoutMs || 30000)
    });

    if (!downloadRes.ok) {
      return {
        success: false,
        error: `HTTP ${downloadRes.status} during audio download`
      };
    }

    const arrayBuffer = await downloadRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      success: true,
      buffer,
      filePath,
      fileName: path.basename(filePath),
      fileSize: buffer.length
    };
  } catch (err) {
    return {
      success: false,
      error: err.name === 'TimeoutError' ? 'DOWNLOAD_TIMEOUT' : (err.message || 'Network error')
    };
  }
}

/**
 * تحديد مسارات الأدوات المحلية للتفريغ الصوتي (whisper-cli, model, ffmpeg)
 */
export function resolveOfflineSttTools(options = {}) {
  const possibleBaseDirs = [
    path.resolve(__dirname, '../../tools/stt'),
    'C:\\Users\\MR.X\\Documents\\ChatGPT\\fruit city\\tools\\stt',
    'C:\\Users\\MR.X\\.gemini\\antigravity\\scratch\\fruit-city-system\\tools\\stt'
  ];

  let whisperExe = options.whisperExe || process.env.WHISPER_CLI_PATH || null;
  let modelPath = options.modelPath || process.env.WHISPER_MODEL_PATH || null;
  let ffmpegExe = options.ffmpegExe || process.env.FFMPEG_PATH || null;

  for (const base of possibleBaseDirs) {
    if (!whisperExe) {
      const candidate = path.join(base, 'whisper.cpp', 'bin', 'Release', 'whisper-cli.exe');
      if (fs.existsSync(candidate)) whisperExe = candidate;
    }
    if (!modelPath) {
      const candidate = path.join(base, 'whisper.cpp', 'models', 'ggml-tiny.bin');
      if (fs.existsSync(candidate)) modelPath = candidate;
    }
    if (!ffmpegExe) {
      const candidate = path.join(base, 'ffmpeg', 'bin', 'ffmpeg.exe');
      if (fs.existsSync(candidate)) ffmpegExe = candidate;
    }
  }

  // فحص حزمة winget لـ ffmpeg كمسار إضافي
  if (!ffmpegExe) {
    const wingetDir = 'C:\\Users\\MR.X\\AppData\\Local\\Microsoft\\WinGet\\Packages';
    if (fs.existsSync(wingetDir)) {
      try {
        const files = fs.readdirSync(wingetDir);
        for (const f of files) {
          if (f.startsWith('Gyan.FFmpeg')) {
            const cand = path.join(wingetDir, f, 'ffmpeg-9.0.2-full_build', 'bin', 'ffmpeg.exe');
            if (fs.existsSync(cand)) {
              ffmpegExe = cand;
              break;
            }
          }
        }
      } catch (_) {}
    }
  }

  const isComplete = Boolean(whisperExe && fs.existsSync(whisperExe) &&
                             modelPath && fs.existsSync(modelPath) &&
                             ffmpegExe && fs.existsSync(ffmpegExe));

  return {
    isAvailable: isComplete,
    whisperExe: whisperExe && fs.existsSync(whisperExe) ? whisperExe : null,
    modelPath: modelPath && fs.existsSync(modelPath) ? modelPath : null,
    ffmpegExe: ffmpegExe && fs.existsSync(ffmpegExe) ? ffmpegExe : null
  };
}

/**
 * تفريغ الصوت محلياً بالكامل باستخدام whisper.cpp و FFmpeg (صفر تكلفة، أوفلاين 100%)
 */
export async function transcribeOfflineWhisper(audioBuffer, options = {}) {
  const tools = resolveOfflineSttTools(options);
  if (!tools.isAvailable) {
    return {
      success: false,
      error: 'OFFLINE_STT_TOOLS_UNAVAILABLE',
      message: 'أدوات التفريغ الأوفلاين (whisper.cpp / ffmpeg) غير متوفرة على الجهاز.'
    };
  }

  const cacheDir = options.cacheDir || path.resolve(__dirname, 'voice_cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const randId = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  const ext = (options.mimeType || '').includes('wav') ? 'wav' : 'oga';
  const tempInputPath = path.join(cacheDir, `stt_in_${randId}.${ext}`);
  const tempWavPath = path.join(cacheDir, `stt_proc_${randId}.16k.wav`);

  const startTime = Date.now();
  try {
    fs.writeFileSync(tempInputPath, audioBuffer);

    // 1. تحويل المقطع الصوتي إلى 16kHz mono 16-bit PCM WAV بواسطة FFmpeg
    await execFileAsync(tools.ffmpegExe, [
      '-y',
      '-i', tempInputPath,
      '-ar', '16000',
      '-ac', '1',
      '-c:a', 'pcm_s16le',
      tempWavPath
    ], {
      timeout: 25000,
      windowsHide: true
    });

    if (!fs.existsSync(tempWavPath) || fs.statSync(tempWavPath).size < 100) {
      throw new Error('فشل توليد ملف WAV المعياري بتردد 16kHz.');
    }

    // 2. تشغيل whisper-cli مع تحديد نواتين (-t 2) لعدم الضغط على الكاشير
    const whisperDir = path.dirname(tools.whisperExe);
    const ffmpegDir = path.dirname(tools.ffmpegExe);
    const threads = String(options.threads || 2);

    const initialPrompt = options.prompt || 'فاتورة مشتريات سوق العبور تفاح موز كرتونة فارغ تارة اعتماد مبيعات مخزون تقرير مصروف';
    const whisperArgs = [
      '-m', tools.modelPath,
      '-f', tempWavPath,
      '-l', 'ar',
      '-t', threads,
      '-nt',
      '--prompt', initialPrompt
    ];

    const { stdout, stderr } = await execFileAsync(tools.whisperExe, whisperArgs, {
      cwd: whisperDir,
      env: {
        ...process.env,
        PATH: `${whisperDir};${ffmpegDir};${process.env.PATH || ''}`
      },
      timeout: options.timeoutMs || 90000,
      windowsHide: true,
      maxBuffer: 10 * 1024 * 1024
    });

    const rawTranscript = (stdout || '').trim();
    const normalizedText = normalizeEgyptianSpeech(rawTranscript);
    const elapsedMs = Date.now() - startTime;

    if (!normalizedText) {
      return {
        success: false,
        error: 'UNCLEAR_AUDIO',
        message: '⚠️ لم أتمكن من سماع الصوت بوضوح، يرجى إعادة إرسال التسجيل الصوتي أو كتابة الأمر.',
        rawText: rawTranscript,
        elapsedMs
      };
    }

    return {
      success: true,
      text: normalizedText,
      rawText: rawTranscript,
      engine: 'whisper.cpp-offline',
      threads: parseInt(threads, 10),
      elapsedMs
    };
  } catch (err) {
    return {
      success: false,
      error: err.message,
      message: '⚠️ تعذر تفريغ الصوت محلياً على الجهاز.',
      elapsedMs: Date.now() - startTime
    };
  } finally {
    // تنظيف الملفات المؤقتة
    try {
      if (fs.existsSync(tempInputPath)) fs.unlinkSync(tempInputPath);
    } catch (_) {}
    try {
      if (fs.existsSync(tempWavPath)) fs.unlinkSync(tempWavPath);
    } catch (_) {}
  }
}

/**
 * تفريغ الصوت إلى نص عربي مصري (Speech-to-Text)
 * يعتمد على:
 * 1. دالة تفريغ محقونة (Dependency Injection / Test Hook)
 * 2. المحاكاة المباشرة للاختبارات (simulatedTranscript)
 * 3. المحرك الأوفلاين المحلي المجاني 100% (whisper.cpp + FFmpeg)
 * 4. خادم تفريغ محلي اختياري (Local HTTP Whisper/Vosk/Sherpa endpoint عبر LOCAL_STT_URL)
 * 5. واجهة Google Gemini API (عبر HTTPS المباشر بدون مكتبات ثنائية، عند تفعيلها بموافقة المالك)
 * 6. السقوط الآمن في حال عدم وضوح الصوت أو غياب المحرك النشط
 */
export async function transcribeAudio(audioBuffer, options = {}) {
  // 1. فحص سلامة الملف الصوتي
  if (!audioBuffer || !Buffer.isBuffer(audioBuffer) || audioBuffer.length < 100) {
    return {
      success: false,
      error: 'AUDIO_TOO_SHORT_OR_CORRUPT',
      message: '⚠️ لم أتمكن من سماع الصوت بوضوح، يرجى إعادة إرسال التسجيل الصوتي أو كتابة الأمر.'
    };
  }

  // 2. إذا تم تمرير دالة تفريغ مخصصة (Dependency Injection / Test Hook)
  if (typeof options.transcriptionFn === 'function') {
    try {
      const res = await options.transcriptionFn(audioBuffer, options);
      if (typeof res === 'string' && res.trim()) {
        return { success: true, text: res.trim() };
      }
      if (res && res.success && res.text) {
        return res;
      }
      return {
        success: false,
        error: 'UNCLEAR_AUDIO',
        message: '⚠️ لم أتمكن من سماع الصوت بوضوح، يرجى إعادة إرسال التسجيل الصوتي أو كتابة الأمر.'
      };
    } catch (e) {
      return {
        success: false,
        error: e.message,
        message: '⚠️ لم أتمكن من سماع الصوت بوضوح، يرجى إعادة إرسال التسجيل الصوتي أو كتابة الأمر.'
      };
    }
  }

  // 3. إذا كان المقطع الصوتي يحمل نصاً محاكياً مسبقاً (Unit Testing Hook)
  if (options.simulatedTranscript) {
    return { success: true, text: options.simulatedTranscript.trim() };
  }

  // 4. السحابي السريع: استدعاء Google Gemini Flash (صفر استهلاك بروسيسور اللابتوب وسرعة 1-2 ثانية)
  const geminiApiKey = options.geminiApiKey || process.env.GEMINI_API_KEY;
  if (geminiApiKey) {
    const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.5-flash', 'gemini-flash-lite-latest'];
    const base64Audio = audioBuffer.toString('base64');
    const mimeType = options.mimeType || 'audio/ogg';
    const promptText = (
      'أنت مفرغ صوتي خبير لنظام Fruit City لإدارة محلات الفاكهة وسوق العبور في مصر. ' +
      'المتحدث هو صاحب المحل (الحاج إسلام). ' +
      'فرغ هذا المقطع الصوتي بدقة بالعامية المصرية وبنفس الكلمات المنطوقة بدقة بدون أي مقدمات أو شروحات. ' +
      'المصطلحات المحتملة: كرتونة، قفص، قفاصة، فارغ، توار، تارة، بيعة، تفاح، موز، فراولة، مانجو، مانجا، بلدي، سكري، عويس، مشتريات، فاتورة، اعتماد، مصروف، مبيعات، سعر، عرض، جنيه، 16 أونص، 500 مل، لتر.'
    );

    for (const model of candidateModels) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
        const gRes = await fetch(geminiUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: promptText },
                {
                  inlineData: {
                    mimeType: mimeType,
                    data: base64Audio
                  }
                }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 250
            }
          }),
          signal: AbortSignal.timeout(model.includes('lite') ? 7000 : 10000)
        });

        if (gRes.ok) {
          const gData = await gRes.json();
          const cand = gData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (cand && cand.trim()) {
            return {
              success: true,
              text: cand.trim(),
              source: `gemini_cloud_${model}`
            };
          }
        } else {
          console.warn(`[Cloud STT] الموديل ${model} أرجع كود ${gRes.status}`);
        }
      } catch (e) {
        console.warn(`[Cloud STT Warning] فشل الموديل ${model}:`, e.message);
      }
    }

    // حماية الجهاز من البطء: إذا وُجد مفتاح كحماية للابتوب لا ننفذ whisper.cpp الثقيل إلا إذا طُلب صراحة
    if (!options.enableLocalWhisper) {
      return {
        success: false,
        error: 'CLOUD_STT_UNAVAILABLE',
        message: '⚠️ تعذر تفريغ الصوت سحابياً في الوقت الحالي. تم إيقاف المعالجة المحلية لحماية جهاز الكاشير من البطء.'
      };
    }
  }

  // 5. محرك التفريغ الأوفلاين عبر whisper.cpp + FFmpeg (خيار احتياطي فقط عند انقطاع الإنترنت)
  if (!options.disableOffline) {
    const offlineTools = resolveOfflineSttTools(options);
    if (offlineTools.isAvailable) {
      const offlineRes = await transcribeOfflineWhisper(audioBuffer, options);
      if (offlineRes.success) {
        return offlineRes;
      }
    }
  }

  // 5. فحص وجود نقطة استدعاء محلية للـ STT عبر متغيرات البيئة (Local Whisper Endpoint)
  const localSttUrl = options.localSttUrl || process.env.LOCAL_STT_URL || process.env.LOCAL_STT_ENDPOINT;
  if (localSttUrl) {
    try {
      const res = await fetch(localSttUrl, {
        method: 'POST',
        headers: {
          'Content-Type': options.mimeType || 'audio/ogg',
          'Accept': 'application/json'
        },
        body: audioBuffer,
        signal: AbortSignal.timeout(options.timeoutMs || 15000)
      });

      if (res.ok) {
        const data = await res.json();
        const text = (data.text || data.transcript || '').trim();
        if (text) {
          return { success: true, text, source: 'local_endpoint' };
        }
      }
    } catch (e) {
      // السقوط الآمن في حال تعثر الخادم المحلي
    }
  }

  // 6. في حال عدم التعرف أو تعذر المعالجة، الرد الآمن دون تنفيذ أي إجراء مع توفير معلومات تشخيصية
  return {
    success: false,
    error: 'AUDIO_UNCLEAR',
    code: 'STT_ENGINE_OFFLINE',
    message: '⚠️ لم أتمكن من سماع الصوت بوضوح، يرجى إعادة إرسال التسجيل الصوتي أو كتابة الأمر.',
    diagnostics: {
      fileSize: audioBuffer.length,
      mimeType: options.mimeType || 'audio/ogg',
      hasLocalStt: Boolean(localSttUrl),
      hasGeminiKey: Boolean(geminiApiKey)
    }
  };
}
