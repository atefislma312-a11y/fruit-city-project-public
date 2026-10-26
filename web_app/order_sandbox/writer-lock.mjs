import fs from 'node:fs';
import path from 'node:path';

// Cooperative exclusion only: every writer must use this protocol. Never reclaim
// an existing lock automatically, even after a crash or PID reuse.
export function writerLock(filename) {
 const resolved=path.join(fs.realpathSync(path.dirname(filename)),path.basename(filename));
 if(fs.existsSync(resolved)&&fs.lstatSync(resolved).isSymbolicLink())throw Error('DATABASE_SYMLINK_NOT_ALLOWED');
 const lock=resolved+'.writer-lock';
 let fd;
 try{fd=fs.openSync(lock,'wx',0o600);}catch(error){if(error.code==='EEXIST')throw Error('DATABASE_WRITER_LOCKED');throw error;}
 let released=false;
 return {filename:resolved,release(){
  if(released)return;
  fs.closeSync(fd);fs.unlinkSync(lock);released=true;
 }};
}
