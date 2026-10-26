import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {writerLock} from './writer-lock.mjs';

test('second process cannot acquire writer lock; crash lock stays closed; orderly release allows reopen',()=>{
 const dir=fs.mkdtempSync(path.join(import.meta.dirname,'.writer-test-'));
 const file=path.join(dir,'isolated.db');let lock;
 const child=()=>spawnSync(process.execPath,['--input-type=module','-e',
  `import {writerLock} from ${JSON.stringify(new URL('./writer-lock.mjs',import.meta.url).href)};
   try{const lock=writerLock(process.argv[1]);lock.release();}catch(e){if(e.message==='DATABASE_WRITER_LOCKED')process.exit(23);throw e;}`,
  file],{encoding:'utf8'});
 try{
  lock=writerLock(file);assert.equal(child().status,23);
  lock.release();lock.release();assert.equal(child().status,0);
  fs.writeFileSync(file+'.writer-lock','');assert.equal(child().status,23);
 }finally{lock?.release();fs.rmSync(dir,{recursive:true,force:true});}
});
