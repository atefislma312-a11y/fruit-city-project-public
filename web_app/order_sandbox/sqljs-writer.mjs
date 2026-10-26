// Exclusive, single-process writer for isolated POS adapter qualification.
// Never opens a database implicitly; caller supplies SQL.js and an explicit path.
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {writerLock} from './writer-lock.mjs';

export function atomicSave(filename, bytes, io=fs) {
 const temporary=path.join(path.dirname(filename),`.${path.basename(filename)}.${randomUUID()}.tmp`);
 let fd;
 try {
  fd=io.openSync(temporary,'wx',0o600);
  io.writeFileSync(fd,bytes);
  io.fsyncSync(fd);
  io.closeSync(fd); fd=undefined;
  io.renameSync(temporary,filename); // Commit point: no fallible work afterward.
 } catch(error) {
  if(fd!==undefined)try{io.closeSync(fd);}catch{}
  try{io.unlinkSync(temporary);}catch{}
  throw error;
 }
}

export function sqljsWriter({SQL,filename,branchId,save=atomicSave}) {
 if(!path.isAbsolute(filename)||!branchId)throw new Error('Explicit absolute database path and branch required');
 const lock=writerLock(filename);filename=lock.filename;
 let db;
 try{db=fs.existsSync(filename)?new SQL.Database(fs.readFileSync(filename)):new SQL.Database();db.run('PRAGMA foreign_keys=ON');}
 catch(error){try{db?.close();}finally{lock.release();}throw error;}
 let queue=Promise.resolve(),active=false,closed=false,closing=false,closePromise;
 const assertOpen=()=>{if(closed)throw new Error('Writer closed');};
 const snapshot=()=>{try{return db.export();}finally{db.run('PRAGMA foreign_keys=ON');}};
 const all=(sql,args=[])=>{assertOpen();const stmt=db.prepare(sql);try{stmt.bind(args);const rows=[];while(stmt.step())rows.push(stmt.getAsObject());return rows;}finally{stmt.free();}};
 const run=(sql,args=[])=>{assertOpen();if(!active)throw new Error('Write requires transaction');db.run(sql,args);};
 const transaction=callback=>{
  if(closing||closed)return Promise.reject(new Error('Writer closed'));
  const next=queue.then(()=>{
   assertOpen();
   // Bridge mutations must be synchronous: async work could escape rollback.
   if(callback.constructor.name==='AsyncFunction')throw new Error('Synchronous transaction required');
   const before=snapshot();
   active=true;
   try {
    db.run('BEGIN');
    const result=callback();
    if(result&&typeof result.then==='function')throw new Error('Synchronous transaction required');
    db.run('COMMIT');
    save(filename,snapshot());
    return result;
   } catch(error) {
    db.close(); db=new SQL.Database(before); db.run('PRAGMA foreign_keys=ON');
    throw error;
   } finally {active=false;}
  });
  queue=next.catch(()=>{});
  return next;
 };
 return {branchId,all,one:(sql,args)=>all(sql,args)[0]??null,run,transaction,
  close:()=>{
   if(closePromise)return closePromise;
   closing=true;
   closePromise=queue.then(()=>{db.close();closed=true;lock.release();});
   return closePromise;
  }};
}
