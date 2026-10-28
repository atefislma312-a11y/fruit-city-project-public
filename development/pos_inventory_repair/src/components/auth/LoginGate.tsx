import React, {useEffect, useState} from 'react';
import {ApiClient} from '../../services/apiClient';

export function LoginGate({children}:{children:React.ReactNode}) {
 const [status,setStatus]=useState<'checking'|'login'|'ready'>('checking');
 const [firstRun,setFirstRun]=useState(false),[username,setUsername]=useState(''),[password,setPassword]=useState('');
 const [error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{
  let active=true;
  const check=async()=>{try{
   const res=await fetch('/api/auth/session',{cache:'no-store'});
   if(!active)return;
   if(res.ok){setStatus('ready');return;}
   if(res.status!==401)throw Error();
   const health=await ApiClient.getHealth();if(active){setFirstRun(!!health?.isFirstRun);setStatus('login');}
  }catch{if(active){setError('تعذر الاتصال بالخادم. حاول مرة أخرى.');setStatus('login');}}};
  void check();return()=>{active=false;};
 },[]);
 useEffect(()=>{
  if(status!=='ready')return;
  let active=true;
  const check=async()=>{try{
   const res=await fetch('/api/auth/session',{cache:'no-store'});
   if(active&&res.status===401){setStatus('login');setPassword('');setError('انتهت الجلسة. سجّل الدخول من جديد.');}
  }catch{/* A transient outage does not grant a new session. */}};
  const timer=window.setInterval(check,15000);window.addEventListener('focus',check);
  return()=>{active=false;window.clearInterval(timer);window.removeEventListener('focus',check);};
 },[status]);
 const submit=async(e:React.FormEvent)=>{e.preventDefault();if(busy)return;setBusy(true);setError('');try{
  const result=firstRun?await ApiClient.setupOwner({fullNameAr:username,username,password}):await ApiClient.login(username,password);
  if(!result.success){setError(result.message||'تعذر تسجيل الدخول. راجع البيانات.');return;}
  setPassword('');setStatus('ready');
 }catch{setError('تعذر الاتصال بالخادم. حاول مرة أخرى.');}finally{setBusy(false);}};
 const logout=async()=>{if(busy)return;setBusy(true);try{
  const res=await fetch('/api/auth/logout',{method:'POST'});if(!res.ok&&res.status!==401)throw Error();
  setStatus('login');setPassword('');setFirstRun(false);
 }catch{setError('تعذر تسجيل الخروج. حاول مرة أخرى.');}finally{setBusy(false);}};
 if(status==='checking')return <p dir="rtl" className="p-8">جارٍ التحقق من الدخول…</p>;
 if(status==='ready')return <><div dir="rtl" className="p-2 bg-white"><button onClick={logout} disabled={busy}>تسجيل الخروج</button>{error&&<p role="alert">{error}</p>}</div>{children}</>;
 return <main dir="rtl" className="min-h-screen grid place-items-center bg-slate-100"><form onSubmit={submit} className="bg-white p-8 rounded-xl space-y-4 w-full max-w-sm">
  <h1 className="text-xl font-bold">Fruit City — {firstRun?'تأسيس حساب المالك':'تسجيل الدخول'}</h1>
  <label className="block">اسم المستخدم<input className="block border p-2 w-full" autoComplete="username" value={username} onChange={e=>setUsername(e.target.value)} required /></label>
  <label className="block">كلمة المرور<input className="block border p-2 w-full" type="password" autoComplete={firstRun?'new-password':'current-password'} value={password} onChange={e=>setPassword(e.target.value)} required minLength={firstRun?8:1}/></label>
  {error&&<p role="alert">{error}</p>}<button className="bg-green-800 text-white p-2 rounded w-full" disabled={busy}>{busy?'جارٍ التحقق…':'دخول'}</button>
 </form></main>;
}
