import {randomBytes,createHash} from 'node:crypto';

// Local cashier sessions. Only the server retains identity; browser input cannot
// supply a role. Restart invalidates all sessions deliberately.
export function posSessions({lookupUser,clock=Date.now,ttlMs=8*60*60*1000,maxSessions=1000}={}) {
 if(typeof lookupUser!=='function'||!Number.isSafeInteger(ttlMs)||ttlMs<1||!Number.isSafeInteger(maxSessions)||maxSessions<1)throw Error('INVALID_SESSION_CONFIG');
 const sessions=new Map();
 const digest=value=>createHash('sha256').update(value).digest('hex');
 const prune=()=>{for(const [key,s] of sessions)if(s.expiresAt<=clock())sessions.delete(key);};
 const token=req=>{
  const values=(req.headers.cookie??'').split(';').map(x=>x.trim()).filter(x=>x.startsWith('fc_pos_session='));
  if(values.length!==1)return null;
  const value=values[0].slice('fc_pos_session='.length);
  return /^[a-f0-9]{64}$/.test(value)?value:null;
 };
 const revoke=req=>{const value=token(req);if(value)sessions.delete(digest(value));};
 return {
  issue(req,res,userId){
   prune();revoke(req);
   if(sessions.size>=maxSessions)throw Error('SESSION_CAPACITY');
   const value=randomBytes(32).toString('hex');
   sessions.set(digest(value),{userId,expiresAt:clock()+ttlMs});
   res.setHeader('Set-Cookie',`fc_pos_session=${value}; Path=/api; HttpOnly; SameSite=Strict; Max-Age=${Math.ceil(ttlMs/1000)}${req.socket?.encrypted?'; Secure':''}`);
  },
  authenticate(req){
   prune();const value=token(req);if(!value)return null;
   const session=sessions.get(digest(value));if(!session)return null;
   const user=lookupUser(session.userId);
   if(!user||user.is_active!==1){sessions.delete(digest(value));return null;}
   return user;
  },
  logout(req,res){revoke(req);res.setHeader('Set-Cookie','fc_pos_session=; Path=/api; HttpOnly; SameSite=Strict; Max-Age=0');}
 };
}

export function cashierRouteAllowed(user,route,permissions=[]) {
 if(!user)return false;
 if(user.role_id==='role_owner')return true;
 if(route.startsWith('/api/admin/')||route==='/api/ingest/invoice')return false;
 const permission={
  '/api/orders':'pos:create_order','/api/payments':'pos:create_order',
  '/api/shifts/open':'pos:create_order','/api/shifts/close':'shifts:close',
  '/api/ingredients':'inventory:adjust','/api/invoices':'purchase:approve',
  '/api/invoices/parse':'purchase:create_draft'
 }[route];
 // Full state contains operational and financial information; restricted until
 // role-specific state projections are implemented in the existing cashier.
 if(route==='/api/state')return permissions.includes('reports:view');
 if(route==='/api/auth/logout'||route==='/api/auth/session')return true;
 return !!permission&&permissions.includes(permission);
}
