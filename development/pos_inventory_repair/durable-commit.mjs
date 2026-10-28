// durable-commit.mjs — Atomic Durable Commit Contract لـ sql.js
// يضمن: All-or-Nothing لكل معاملة، حماية من فساد الملف، Recovery عند الإقلاع.
import fs from 'node:fs';
import path from 'node:path';

const TMP_SUFFIX = '.tmp';
const BAK_SUFFIX = '.bak';
const JOURNAL_SUFFIX = '.journal';

/**
 * يكتب buffer في ملف بشكل ذري:
 * 1) يكتب في .tmp
 * 2) fsyncSync على الـ fd (ينزل على القرص فعلاً)
 * 3) renameSync الذري (على نفس الـ filesystem)
 * 4) fsyncSync على directory عشان الـ rename نفسه ينزل
 */
export function atomicWriteFileSync(filePath, buffer) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const tmpPath = filePath + TMP_SUFFIX;
  const fd = fs.openSync(tmpPath, 'w');
  try {
    fs.writeSync(fd, buffer, 0, buffer.length, 0);
    fs.fsyncSync(fd); // ✅ البيانات على القرص
  } finally {
    fs.closeSync(fd);
  }

  // على Windows، renameSync بيستبدل الملف الهدف بشكل ذري لو كان موجود
  fs.renameSync(tmpPath, filePath);

  // fsync على الـ directory عشان الـ rename metadata تنزل (مهم على Linux/macOS، على Windows no-op آمن)
  try {
    const dirFd = fs.openSync(dir, 'r');
    try { fs.fsyncSync(dirFd); } finally { fs.closeSync(dirFd); }
  } catch (_) { /* Windows: open(dir) ممكن يفشل، مش مشكلة */ }
}

/**
 * recovery عند الإقلاع:
 * - لو فيه .tmp متبقي → معناه الكتابة اتقطعت → امسحه (الأصل سليم).
 * - لو الأصل مش موجود بس .bak موجود → رجّع .bak.
 * - لو .journal موجود (اختياري لمستقبل) → امسحه.
 */
export function recoverOnStartup(dbPath) {
  const tmpPath = dbPath + TMP_SUFFIX;
  const bakPath = dbPath + BAK_SUFFIX;
  const journalPath = dbPath + JOURNAL_SUFFIX;

  if (fs.existsSync(tmpPath)) {
    try { fs.unlinkSync(tmpPath); console.warn('[durable] removed stale .tmp (interrupted write)'); }
    catch (e) { console.error('[durable] failed to remove .tmp:', e.message); }
  }
  if (fs.existsSync(journalPath)) {
    try { fs.unlinkSync(journalPath); console.warn('[durable] removed stale .journal'); }
    catch (e) { console.error('[durable] failed to remove .journal:', e.message); }
  }
  if (!fs.existsSync(dbPath) && fs.existsSync(bakPath)) {
    try { fs.copyFileSync(bakPath, dbPath); console.warn('[durable] restored DB from .bak'); }
    catch (e) { console.error('[durable] failed to restore from .bak:', e.message); }
  }
}

/**
 * يحفظ قاعدة بيانات sql.js بشكل ذري + يحتفظ بـ .bak للنسخة السابقة.
 * @param {object} DB - instance من sql.js
 * @param {string} dbPath
 * @param {() => void} [postExportFixups] - لإعادة تفعيل PRAGMA foreign_keys إلخ
 */
export function saveDatabaseAtomic(DB, dbPath, postExportFixups) {
  const data = DB.export();
  if (typeof postExportFixups === 'function') postExportFixups(); // ✅ PRAGMA foreign_keys = ON
  const buf = Buffer.from(data);

  // احتفظ بالنسخة القديمة كـ .bak قبل الاستبدال (سريع ورخيص)
  if (fs.existsSync(dbPath)) {
    try { fs.copyFileSync(dbPath, dbPath + BAK_SUFFIX); } catch (_) { /* مش حرج */ }
  }

  atomicWriteFileSync(dbPath, buf);
}
