import React,{useState,useEffect,useRef} from 'react';
const labels={pending_store_acceptance:'بانتظار قبول المحل',accepted:'مقبول',preparing:'قيد التحضير',ready:'جاهز',handed_off:'تم التسليم',completed:'مكتمل',rejected:'مرفوض',cancelled:'ملغي'};
export async function request(path,body,token){
 const res=await fetch('/api'+path,{signal:AbortSignal.timeout(10000),method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await res.json();if(!res.ok){const e=Error(data.error||'تعذر الاتصال');e.status=res.status;throw e;}return data;
}
const errors={INVALID_CUSTOMER_PHONE:'اكتب رقم موبايل مصري صحيح للتواصل معاك.',UNKNOWN_VARIANT:'الصنف أو الحجم غير متاح للشراء حاليًا.',QUOTE_CHANGED:'السعر أو التوافر اتغير؛ اطلب عرض سعر جديد.',QUOTE_EXPIRED:'انتهت صلاحية السعر؛ اطلب عرضًا جديدًا.',STORE_CLOSED:'المحل موقف استقبال الطلبات حاليًا.',DELIVERY_NOT_CONFIGURED:'التوصيل لم يتفعل بعد.'};
function savedIntent(){try{return JSON.parse(sessionStorage.getItem('fc-test-pending'))||{}}catch{return {}}}
export function Checkout({cart}){
 const [quote,setQuote]=useState(null),[order,setOrder]=useState(()=>{try{return JSON.parse(sessionStorage.getItem('fc-test-order'))}catch{return null}}),[pending,setPending]=useState(null),[method,setMethod]=useState(()=>savedIntent().method||'cash'),[phone,setPhone]=useState(()=>savedIntent().phone||''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const signature=JSON.stringify({cart,phone});
 useEffect(()=>{let saved=null;try{saved=JSON.parse(sessionStorage.getItem('fc-test-pending'))}catch{}if(saved?.signature===signature&&saved?.method===method){setQuote(saved.quote);setPending(saved.pending);}else{setQuote(null);setPending(null);}},[signature,method]);
 async function run(action){setBusy(true);setError('');try{await action();}catch(e){setError(errors[e.message]||'تعذر إكمال العملية: '+e.message);}finally{setBusy(false);}}
 async function getQuote(){const q=await request('/quotes',{items:cart.map(r=>({sku:r.id,size:r.size,quantity:r.quantity})),customer:{phone},fulfillment:'pickup',paymentMethod:method});const p={key:crypto.randomUUID(),quoteId:q.id,accessToken:q.accessToken,expectedTotalMinor:q.totalMinor};sessionStorage.setItem('fc-test-pending',JSON.stringify({signature,method,phone,quote:q,pending:p}));setQuote(q);setPending(p);}
 async function confirm(){const o=await request('/orders',pending);setOrder(o);sessionStorage.setItem('fc-test-order',JSON.stringify(o));}
 return <section><p className="notice">بيئة اختبار فقط — الأسعار تجريبية ولا تمثل أسعار المحل. الاستلام من المحل فقط.</p>
 <label>رقم الموبايل<input type="tel" inputMode="tel" autoComplete="tel" maxLength="20" value={phone} disabled={busy} onChange={e=>setPhone(e.target.value)}/></label><label>طريقة الدفع<select value={method} disabled={busy} onChange={e=>setMethod(e.target.value)}><option value="cash">نقدي عند الاستلام</option><option value="instapay_manual">إنستا باي — مراجعة يدوية</option></select></label>
 <button type="button" disabled={busy||!cart.length} onClick={()=>run(getQuote)}>اعرض السعر النهائي</button>
 {quote&&<div><p>الإجمالي: {(quote.totalMinor/100).toFixed(2)} جنيه — استلام من المحل</p><p>صلاحية السعر حتى {new Date(quote.expiresAt).toLocaleTimeString('ar-EG')}</p><button type="button" disabled={busy} onClick={()=>run(confirm)}>أوافق على السعر وأؤكد الطلب التجريبي</button><p>لو الشبكة فصلت، أعد التأكيد بنفس الزر؛ مش هننشئ طلبًا ثانيًا.</p></div>}
 {order&&<div role="status"><p>رقم الطلب: {order.id}</p><p>{labels[order.status]||order.status}</p><button type="button" disabled={busy} onClick={()=>run(async()=>setOrder(await request('/orders/'+order.id,null,order.accessToken)))}>تحديث حالة الطلب</button></div>}
 {error&&<p role="alert">{error}</p>}</section>;
}
export function StaffInbox(){
 const [token,setToken]=useState(''),[orders,setOrders]=useState([]),[session,setSession]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[reason,setReason]=useState(''),[reference,setReference]=useState(''),[verified,setVerified]=useState(false),[retry,setRetry]=useState(null);
 const lock=useRef(false);
 async function refresh(){const identity=await request('/staff/session',null,token);const data=await request('/staff/orders',null,token);setSession(identity);setOrders(data.orders);}
 async function run(fn){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{await fn();}catch(e){if(e.status===401)logout();setError(errors[e.message]||e.message);}finally{lock.current=false;setBusy(false);}}
 function logout(){setToken('');setOrders([]);setSession(null);setRetry(null);setReference('');setVerified(false);setReason('');setError('');}
 async function send(command){setRetry(command);await request('/staff/commands',command,token);setRetry(null);setVerified(false);setReference('');await refresh();}
 function action(o,kind,extra={}){return run(()=>send({key:crypto.randomUUID(),orderId:o?.id,revision:o?.revision??0,action:kind,...extra}));}
 const manager=session?.role==='manager';
 const next={pending_store_acceptance:['accepted','rejected','cancelled'],accepted:['cancelled'],preparing:['ready',...(manager?['cancelled']:[])],ready:['handed_off',...(manager?['cancelled']:[])],handed_off:['completed']};
 const financial=(o,kind)=>action(o,kind,{verified,reference,amountMinor:o.totalMinor});
 return <main dir="rtl"><h1>Fruit City — صندوق الطلبات التجريبي</h1><p>بيانات اختبار فقط. التحقق من التحويل يتم من حساب المحل، وليس من صورة إيصال.</p>
 {!session&&<><label>رمز دخول الموظف<input type="password" autoComplete="off" value={token} disabled={busy} onChange={e=>setToken(e.target.value)}/></label><button disabled={busy||!token} onClick={()=>run(refresh)}>دخول</button></>}
 {session&&<><p>الموظف: {session.id} — {session.role==='manager'?'مدير':'كاشير'}</p><button disabled={busy} onClick={()=>run(refresh)}>تحديث الطلبات</button><button disabled={busy} onClick={logout}>خروج ومسح بيانات الجلسة</button>
 {manager&&<button disabled={busy||!!retry} onClick={()=>action(null,'intake',{accepting:!session.accepting})}>{session.accepting?'إيقاف استقبال الطلبات':'فتح استقبال الطلبات'}</button>}
 <p>{session.accepting?'استقبال الطلبات مفتوح':'استقبال الطلبات متوقف'}</p>
 <label>سبب الرفض أو الإلغاء<input maxLength="500" value={reason} onChange={e=>setReason(e.target.value)}/></label>
 <label>مرجع التحصيل أو الاسترداد<input maxLength="100" value={reference} onChange={e=>{setReference(e.target.value);setVerified(false);}}/></label>
 <label><input type="checkbox" checked={verified} onChange={e=>setVerified(e.target.checked)}/>تحققت من استلام أو رد المبلغ كاملًا للعملية المطلوبة</label>
 {retry&&<p>نتيجة آخر إجراء غير مؤكدة. <button disabled={busy} onClick={()=>run(()=>send(retry))}>أعد نفس الإجراء بأمان</button><button disabled={busy} onClick={()=>run(async()=>{await refresh();setRetry(null);})}>راجع الحالة الحالية</button></p>}
 {orders.map(o=><article key={o.id}><h2>{o.id}</h2><p>{labels[o.status]} — {(o.totalMinor/100).toFixed(2)} جنيه</p><p>هاتف العميل: {o.customer?.phone} — الدفع: {o.paymentMethod} / {o.paymentStatus} — التسوية: {o.settlementStatus}</p><p>{o.posSyncPending?'في انتظار مزامنة الكاشير':'تمت مزامنة الأحداث المرسلة'}</p><ul>{o.lines.map((l,i)=><li key={i}>{l.sku} / {l.size} × {l.quantity}</li>)}</ul>
 {(next[o.status]||[]).map(status=><button key={status} disabled={busy||!!retry||o.preparationPending||(['rejected','cancelled'].includes(status)&&!reason.trim())||(status==='completed'&&o.paymentStatus!=='paid')} onClick={()=>action(o,'status',{status,...(['rejected','cancelled'].includes(status)?{reason}:{})})}>{labels[status]}</button>)}
 {o.status==='accepted'&&!o.preparationPending&&<button disabled={busy||!!retry||(o.paymentMethod==='instapay_manual'&&o.paymentStatus!=='paid')} onClick={()=>action(o,'prepare')}>بدء التحضير وطلب خصم الخامات</button>}
 {o.preparationPending&&<p>بانتظار تأكيد خصم الخامات؛ لا تبدأ التحضير بعد.</p>}
 {o.wasteReviewRequired&&<p>يلزم مراجعة الهالك؛ الخامات لم ترجع تلقائيًا.</p>}
 {o.paymentStatus==='unpaid'&&!['cancelled','rejected','completed'].includes(o.status)&&(o.paymentMethod==='cash'||manager)&&<button disabled={busy||!!retry||!verified||!reference.trim()} onClick={()=>financial(o,'payment')}>تسجيل استلام المبلغ كاملًا</button>}
 {manager&&o.paymentStatus==='paid'&&o.settlementStatus!=='settled'&&<button disabled={busy||!!retry||!verified||!reference.trim()} onClick={()=>financial(o,'settle')}>تأكيد التسوية</button>}
 {manager&&o.paymentStatus==='refund_pending'&&<button disabled={busy||!!retry||!verified||!reference.trim()} onClick={()=>financial(o,'refund')}>تسجيل رد المبلغ كاملًا</button>}
 </article>)}</>}
 {error&&<p role="alert">{error}</p>}</main>;
}