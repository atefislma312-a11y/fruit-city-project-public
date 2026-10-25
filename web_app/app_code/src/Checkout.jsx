import React,{useState,useEffect} from 'react';
const labels={pending_store_acceptance:'بانتظار قبول المحل',accepted:'مقبول',preparing:'قيد التحضير',ready:'جاهز',handed_off:'تم التسليم',completed:'مكتمل',rejected:'مرفوض',cancelled:'ملغي'};
export async function request(path,body,token){
 const res=await fetch('/api'+path,{method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await res.json();if(!res.ok)throw Error(data.error||'تعذر الاتصال');return data;
}
const errors={UNKNOWN_VARIANT:'الصنف أو الحجم غير متاح للشراء حاليًا.',QUOTE_CHANGED:'السعر أو التوافر اتغير؛ اطلب عرض سعر جديد.',QUOTE_EXPIRED:'انتهت صلاحية السعر؛ اطلب عرضًا جديدًا.',STORE_CLOSED:'المحل موقف استقبال الطلبات حاليًا.',DELIVERY_NOT_CONFIGURED:'التوصيل لم يتفعل بعد.'};
export function Checkout({cart}){
 const [quote,setQuote]=useState(null),[order,setOrder]=useState(()=>{try{return JSON.parse(sessionStorage.getItem('fc-test-order'))}catch{return null}}),[pending,setPending]=useState(null),[method,setMethod]=useState('cash'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const signature=JSON.stringify(cart);
 useEffect(()=>{let saved=null;try{saved=JSON.parse(sessionStorage.getItem('fc-test-pending'))}catch{}if(saved?.signature===signature&&saved?.method===method){setQuote(saved.quote);setPending(saved.pending);}else{setQuote(null);setPending(null);}},[signature,method]);
 async function run(action){setBusy(true);setError('');try{await action();}catch(e){setError(errors[e.message]||'تعذر إكمال العملية: '+e.message);}finally{setBusy(false);}}
 async function getQuote(){const q=await request('/quotes',{items:cart.map(r=>({sku:r.id,size:r.size,quantity:r.quantity})),fulfillment:'pickup',paymentMethod:method});const p={key:crypto.randomUUID(),quoteId:q.id,accessToken:q.accessToken,expectedTotalMinor:q.totalMinor};sessionStorage.setItem('fc-test-pending',JSON.stringify({signature,method,quote:q,pending:p}));setQuote(q);setPending(p);}
 async function confirm(){const o=await request('/orders',pending);setOrder(o);sessionStorage.setItem('fc-test-order',JSON.stringify(o));}
 return <section><p className="notice">بيئة اختبار فقط — الأسعار تجريبية ولا تمثل أسعار المحل. الاستلام من المحل فقط.</p>
 <label>طريقة الدفع<select value={method} disabled={busy} onChange={e=>setMethod(e.target.value)}><option value="cash">نقدي عند الاستلام</option><option value="instapay_manual">إنستا باي — مراجعة يدوية</option></select></label>
 <button type="button" disabled={busy||!cart.length} onClick={()=>run(getQuote)}>اعرض السعر النهائي</button>
 {quote&&<div><p>الإجمالي: {(quote.totalMinor/100).toFixed(2)} جنيه — استلام من المحل</p><p>صلاحية السعر حتى {new Date(quote.expiresAt).toLocaleTimeString('ar-EG')}</p><button type="button" disabled={busy} onClick={()=>run(confirm)}>أوافق على السعر وأؤكد الطلب التجريبي</button><p>لو الشبكة فصلت، أعد التأكيد بنفس الزر؛ مش هننشئ طلبًا ثانيًا.</p></div>}
 {order&&<div role="status"><p>رقم الطلب: {order.id}</p><p>{labels[order.status]||order.status}</p><button type="button" disabled={busy} onClick={()=>run(async()=>setOrder(await request('/orders/'+order.id,null,order.accessToken)))}>تحديث حالة الطلب</button></div>}
 {error&&<p role="alert">{error}</p>}</section>;
}
export function StaffInbox(){
 const [token,setToken]=useState(''),[orders,setOrders]=useState([]),[error,setError]=useState('');
 async function load(){try{setError('');setOrders((await request('/staff/orders',null,token)).orders);}catch(e){setOrders([]);setError(e.message);}}
 async function change(o,status){try{const reason=['rejected','cancelled'].includes(status)?window.prompt('سبب الرفض أو الإلغاء'):undefined;if(reason===null)return;
 await request('/staff/commands',{key:crypto.randomUUID(),orderId:o.id,revision:o.revision??0,action:'status',status,reason},token);await load();}catch(e){setError(e.message);}}
 const next={pending_store_acceptance:['accepted','rejected','cancelled'],accepted:['cancelled'],preparing:['ready','cancelled'],ready:['handed_off','cancelled'],handed_off:['completed']};
 return <main dir="rtl"><h1>صندوق الطلبات — تطوير فقط</h1><label>رمز دخول الموظف<input type="password" autoComplete="off" value={token} onChange={e=>{setToken(e.target.value);setOrders([]);}}/></label><button onClick={load}>تحديث الطلبات</button><p role="alert">{error}</p>
 {orders.map(o=><article key={o.id}><h2>{o.id}</h2><p>{labels[o.status]} — {(o.totalMinor/100).toFixed(2)} جنيه — {o.paymentStatus}</p><ul>{o.lines.map((l,i)=><li key={i}>{l.sku} / {l.size} × {l.quantity}</li>)}</ul>{(next[o.status]||[]).map(status=><button key={status} onClick={()=>change(o,status)}>{labels[status]}</button>)}{o.preparationPending&&<p>بانتظار إقرار المخزون</p>}</article>)}</main>;
}
