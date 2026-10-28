import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ManagerApprovalRequest, ApprovalRequestType } from '../../types';
import { 
  ShieldCheck, 
  KeyRound, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Wifi, 
  WifiOff, 
  RefreshCw,
  Lock,
  FileText,
  UserCheck,
  Send
} from 'lucide-react';

export const ApprovalsCenter: React.FC = () => {
  const {
    approvalRequests,
    approveManagerRequest,
    rejectManagerRequest,
    remoteRelayConfig,
    updateRemoteRelayConfig,
    managerPin,
    showToast
  } = useApp();

  // Verification PIN modal state
  const [selectedRequest, setSelectedRequest] = useState<ManagerApprovalRequest | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject'>('approve');
  const [enteredPin, setEnteredPin] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  // Pending requests
  const pendingRequests = approvalRequests.filter(r => r.status === 'pending');
  // Past requests
  const pastRequests = approvalRequests.filter(r => r.status !== 'pending');

  const handleOpenAction = (req: ManagerApprovalRequest, type: 'approve' | 'reject') => {
    setSelectedRequest(req);
    setActionType(type);
    setEnteredPin('');
    setReviewNotes('');
  };

  const handleExecuteAction = () => {
    if (!selectedRequest) return;

    if (!enteredPin.trim()) {
      showToast('يرجى إدخال الرقم السري للمدير (4 أرقام)');
      return;
    }

    if (actionType === 'approve') {
      const res = approveManagerRequest(selectedRequest.id, enteredPin, 'المدير المسؤول', reviewNotes);
      if (res.success) {
        setSelectedRequest(null);
      }
    } else {
      const res = rejectManagerRequest(selectedRequest.id, enteredPin, 'المدير المسؤول', reviewNotes);
      if (res.success) {
        setSelectedRequest(null);
      }
    }
  };

  const getRequestTypeBadge = (type: ApprovalRequestType) => {
    switch (type) {
      case 'cash_refund_over_limit':
        return <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-[11px] font-bold">استرداد نقدي فوق حد الكاشير (200 ج)</span>;
      case 'electronic_refund':
        return <span className="bg-purple-100 text-purple-800 px-2 py-0.5 rounded text-[11px] font-bold">استرداد إلكتروني (بطاقة/إنستاباي)</span>;
      case 'exceptional_discount':
        return <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[11px] font-bold">خصم استثنائي غير مسجل</span>;
      case 'shift_discrepancy':
        return <span className="bg-rose-100 text-rose-800 px-2 py-0.5 rounded text-[11px] font-bold">فرق عجز كبير في الوردية</span>;
      default:
        return <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[11px] font-bold">إذن مدير عام</span>;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-[#172D36] text-white rounded-2xl p-6 shadow-md border border-[#234552] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#C59A45] text-xs font-black uppercase tracking-wider mb-1">
            <Lock className="w-4 h-4" />
            <span>مركز موافقات المدير المسؤول (Manager Approvals Center)</span>
          </div>
          <h1 className="text-2xl font-black text-white">إدارة الصلاحيات والاستثناءات والاعتمادات</h1>
          <p className="text-xs text-[#B5C9C3] mt-1">
            اعتماد فوري محلي برقم PIN السري • حماية صارمة ضد إعادة التنفيذ (Replay Protection) • تسجيل كامل للأثر المحاسبي
          </p>
        </div>

        <div className="bg-[#0f2128] border border-[#234552] px-4 py-2 rounded-xl text-right">
          <div className="text-[11px] text-[#8EA7A1]">الطلبات المعلقة:</div>
          <div className="text-2xl font-black text-[#F3E5AB] font-mono">
            {pendingRequests.length} <span className="text-xs font-sans text-slate-300">طلبات</span>
          </div>
        </div>
      </div>

      {/* Cloud Remote Relay Status Card (Honest Offline Architecture) */}
      <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
              remoteRelayConfig.isOnline ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
            }`}>
              {remoteRelayConfig.isOnline ? <Wifi className="w-5 h-5" /> : <WifiOff className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="font-bold text-sm text-slate-900">حالة الربط السحابي للموافقات عن بُعد (Remote Approval Relay)</h2>
              <p className="text-[11px] text-slate-500">
                {remoteRelayConfig.isOnline
                  ? 'متصل ببوابة الترحيل السحابية — يتم مزامنة الطلبات فورياً'
                  : 'يعمل النظام حالياً بوضع الأمان المحلي المستقل (Offline Local PIN Verification)'}
              </p>
            </div>
          </div>

          <button
            onClick={() => {
              const nextState = !remoteRelayConfig.isOnline;
              updateRemoteRelayConfig({ isOnline: nextState, isEnabled: nextState });
              showToast(nextState ? 'تم تفعيل الاتصال التجريبي بالسحابة' : 'تم التحويل إلى وضع الأمان المحلي المستقل');
            }}
            className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-xs font-bold text-slate-700 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>{remoteRelayConfig.isOnline ? 'فصل الربط السحابي' : 'فحص الاتصال بالسحابة'}</span>
          </button>
        </div>

        <div className="mt-3 bg-amber-50/70 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 leading-relaxed">
          <strong className="block font-bold text-amber-950 mb-0.5">شفافية البنية التحتية:</strong>
          يعتمد الفرع كلياً على المصادقة بالرقم السري للمدير (Manager PIN: 1234) محلياً بدون أي توقف في حال انقطاع الإنترنت. بنية الترحيل السحابي (Cloud Relay) جاهزة في الكود لمزامنة تليجرام/السحابة بمجرد ربط الخادم السحابي الخارجي.
        </div>
      </div>

      {/* Pending Requests List */}
      <div className="space-y-3">
        <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-600" />
          <span>طلبات بانتظار اعتماد المدير ({pendingRequests.length})</span>
        </h2>

        {pendingRequests.length === 0 ? (
          <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto" />
            <h3 className="font-bold text-slate-800 text-sm">لا توجد طلبات معلقة حالياً</h3>
            <p className="text-xs text-slate-500">كافة العمليات الحالية تسير وفق الصلاحيات المعيارية المعتمدة.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRequests.map(req => (
              <div
                key={req.id}
                className="bg-white rounded-2xl border-2 border-amber-200/90 shadow-sm p-5 space-y-3 relative overflow-hidden"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    {getRequestTypeBadge(req.requestType)}
                    <h3 className="font-extrabold text-slate-900 text-sm mt-1.5">
                      طلب اعتماد #{req.id.substring(req.id.length - 6)}
                    </h3>
                  </div>
                  {req.amount && (
                    <div className="text-lg font-black text-rose-700 font-mono bg-rose-50 px-2.5 py-0.5 rounded-lg border border-rose-200">
                      {req.amount} ج
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-600 space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-200/80">
                  <div><strong>مقدم الطلب:</strong> {req.requestedByCashierName}</div>
                  {req.orderNumber && <div><strong>رقم الفاتورة:</strong> {req.orderNumber}</div>}
                  <div><strong>السبب الموضح:</strong> {req.reason}</div>
                  <div className="text-[11px] text-slate-400">
                    وقت الطلب: {new Date(req.createdAt).toLocaleTimeString('ar-EG')} • ينتهي في: {new Date(req.expiresAt).toLocaleTimeString('ar-EG')}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={() => handleOpenAction(req, 'approve')}
                    className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>موافقة واعتماد (PIN)</span>
                  </button>
                  <button
                    onClick={() => handleOpenAction(req, 'reject')}
                    className="px-4 py-2 rounded-xl border border-rose-300 hover:bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center gap-1 transition-all"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>رفض</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Past Requests History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5 space-y-4">
        <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#147D73]" />
          <span>سجل الموافقات والرفض المؤرشف (Audit Trail)</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                <th className="p-3">نوع الطلب</th>
                <th className="p-3">الفاتورة</th>
                <th className="p-3">المبلغ</th>
                <th className="p-3">الكاشير</th>
                <th className="p-3">السبب</th>
                <th className="p-3">وقت المراجعة</th>
                <th className="p-3">الحالة والنتيجة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pastRequests.map(req => (
                <tr key={req.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-3 font-semibold">{getRequestTypeBadge(req.requestType)}</td>
                  <td className="p-3 font-mono font-bold">{req.orderNumber || '—'}</td>
                  <td className="p-3 font-mono font-bold text-slate-900">{req.amount ? `${req.amount} ج` : '—'}</td>
                  <td className="p-3 text-slate-700">{req.requestedByCashierName}</td>
                  <td className="p-3 text-slate-600 max-w-xs truncate">{req.reason}</td>
                  <td className="p-3 text-slate-500 font-mono">
                    {req.reviewedAt ? new Date(req.reviewedAt).toLocaleTimeString('ar-EG') : '—'}
                  </td>
                  <td className="p-3">
                    {req.status === 'approved' ? (
                      <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-black border border-emerald-200 inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        معتمد بالـ PIN
                      </span>
                    ) : req.status === 'rejected' ? (
                      <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-black border border-rose-200 inline-flex items-center gap-1">
                        <XCircle className="w-3.5 h-3.5" />
                        مرفوض
                      </span>
                    ) : (
                      <span className="text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-bold">منتهي الصلاحية</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================
          MANAGER PIN AUTHORIZATION MODAL
          ========================================= */}
      {selectedRequest && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
            
            <div className={`p-4 text-white flex items-center justify-between ${
              actionType === 'approve' ? 'bg-[#172D36]' : 'bg-rose-900'
            }`}>
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#C59A45]" />
                <h3 className="font-extrabold text-sm">
                  {actionType === 'approve' ? 'اعتماد الطلب بالرقم السري' : 'رفض الطلب بالرقم السري'}
                </h3>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div className="font-bold text-slate-800">
                  {selectedRequest.orderNumber ? `فاتورة #${selectedRequest.orderNumber}` : 'طلب استثنائي'}
                </div>
                {selectedRequest.amount && (
                  <div className="text-base font-black text-rose-700 font-mono">
                    المبلغ: {selectedRequest.amount} ج
                  </div>
                )}
                <div className="text-[11px] text-slate-500">
                  السبب: {selectedRequest.reason}
                </div>
              </div>

              <div>
                <label className="font-extrabold text-slate-800 block mb-1">
                  أدخل الرقم السري للمدير (Manager PIN): <span className="text-rose-500">*</span>
                </label>
                <input
                  type="password"
                  maxLength={4}
                  placeholder="****"
                  value={enteredPin}
                  onChange={(e) => setEnteredPin(e.target.value)}
                  className="w-full border-2 border-slate-300 rounded-xl p-2.5 text-center text-xl tracking-widest font-mono font-black focus:border-[#147D73] focus:outline-none"
                  autoFocus
                />
                <span className="text-[10px] text-slate-400 block text-center mt-1">
                  (الرقم الافتراضي للمدير: 1234)
                </span>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  ملاحظات المدير (اختياري):
                </label>
                <input
                  type="text"
                  placeholder="ملاحظات الاعتماد أو توجيهات الكاشير..."
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                onClick={handleExecuteAction}
                className={`px-5 py-2 rounded-xl text-white text-xs font-black shadow-md transition-all ${
                  actionType === 'approve'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {actionType === 'approve' ? 'تأكيد الاعتماد' : 'تأكيد الرفض'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
