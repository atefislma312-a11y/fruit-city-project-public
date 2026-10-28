import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import initSqlJs from 'sql.js';
import { saveDatabaseAtomic, recoverOnStartup } from '../durable-commit.mjs';

const SQL = await initSqlJs();

test('atomic write: .tmp متبقي بعد crash بيتشال، الأصل سليم', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-'));
  const dbPath = path.join(dir, 'pos.db');

  const db = new SQL.Database();
  db.run('CREATE TABLE t(x INTEGER); INSERT INTO t VALUES (1);');
  saveDatabaseAtomic(db, dbPath);

  // محاكاة crash: نكتب .tmp يدوياً
  fs.writeFileSync(dbPath + '.tmp', 'partial-garbage');
  recoverOnStartup(dbPath);

  assert.equal(fs.existsSync(dbPath + '.tmp'), false, '.tmp لازم يتشال');
  assert.ok(fs.existsSync(dbPath), 'الأصل لازم يفضل موجود');
});

test('atomic write: لو الأصل ضاع، .bak بيرجّعه', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-'));
  const dbPath = path.join(dir, 'pos.db');
  const db = new SQL.Database();
  db.run('CREATE TABLE t(x INTEGER);');
  saveDatabaseAtomic(db, dbPath);          // v1
  db.run('INSERT INTO t VALUES (2);');
  saveDatabaseAtomic(db, dbPath);          // v2 → .bak = v1
  fs.unlinkSync(dbPath);                    // محاكاة ضياع
  recoverOnStartup(dbPath);
  assert.ok(fs.existsSync(dbPath), 'لازم يترجع من .bak');
});

test('PRAGMA foreign_keys بتفضل شغالة بعد الحفظ', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fc-'));
  const dbPath = path.join(dir, 'pos.db');
  const db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON;');
  db.run('CREATE TABLE a(id INTEGER PRIMARY KEY); CREATE TABLE b(a_id INTEGER REFERENCES a(id));');
  saveDatabaseAtomic(db, dbPath, () => db.run('PRAGMA foreign_keys = ON;'));
  const res = db.exec('PRAGMA foreign_keys;');
  assert.equal(res[0].values[0][0], 1);
});
