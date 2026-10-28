import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentMethodType } from '../../types';
import { 
  X, 
  RotateCcw, 
  AlertTriangle, 
  ShieldCheck, 
  KeyRound, 
  CheckCircle2, 
  Search,
  CupSoda
} from 'lucide-react';
import { roundMoney } from '../../engine/costingEngine';

interface RefundModalProps {
  onClose: () => void;
}

export const RefundModal: React.FC<RefundModalProps> = ({ onClose }) => {
  const { orders, refunds, processRefund, showToast } = useApp();

  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundMethod, setRefundMethod] = useState<PaymentMethodType>('cash');
  const [reason, setReason] = useState<string>('');
  const [isDrinkWaste, setIsDrinkWaste] = useState<boolean>(true);
  const [wasteNotes, setWasteNotes] = useState<string>('');

  // Only paid or partial orders that are not fully refunded
  const refundableOrders = orders.filter(
    o => (o.paymentStatus === 'paid' || o.paymentStatus === 'partial') &&
         (o.totalRefundedAmount < o.totalAmount)
  );

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  // Remaining refundable for this order
  const priorRefundsForOrder = refunds
    .filter(r => r.orderId === selectedOrderId && r.status === 'completed')
    .reduce((sum, r) => sum + r.amount, 0);

  const maxRefundable = selectedOrder
    ? roundMoney(Math.max(0, selectedOrder.totalAmount - priorRefundsForOrder))
    : 0;

  // Real-time rule preview
  const cumulativeIfProcessed = roundMoney(priorRefundsForOrder + refundAmount);
  const isCash = refundMethod === 'cash';
  const requiresManager = !isCash || cumulativeIfProcessed > 200;

  const handleOrderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const id = e.target.value;
    setSelectedOrderId(id);
    const ord = orders.find(o => o.id === id);
    if (ord) {
      const prior = refunds
        .filter(r => r.orderId === id && r.status === 'completed')
        .reduce((sum, r) => sum + r.amount, 0);
      const rem = roundMoney(Math.max(0, ord.totalAmount - prior));
      setRefundAmount(rem);
    } else {
      setRefundAmount(0);
    }
  };

  const handleSubmitRefund = () => {
    if (!selectedOrderId) {
      showToast('يرجى اختيار الطلب المراد استرداده');
      return;
    }

    if (refundAmount <= 0) {
      showToast('مبلغ الاسترداد يجب أن يكون أكبر من صفر');
      return;
    }

    if (refundAmount > maxRefundable) {
      showToast(`المبلغ يتجاوز الرصيد المتبقي للطلب (${maxRefundable} ج)`);
      return;
    }

    if (!reason.trim()) {
      showToast('يجب إدخال سبب الاسترداد بشكل إلزامي');
      return;
    }

    const res = processRefund({
      orderId: selectedOrderId,
      amount: refundAmount,
      method: refundMethod,
      reason,
      isPreparedDrinkWaste: isDrinkWaste,
      wasteNotes
    });

    if (res.success || res.requiresApproval) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-[#172D36] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-5 h-5 text-rose-400" />
            <h2 className="font-extrabold text-base">تسجيل طلب استرداد مالي / مرتجع</h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4 max-h-[520px] overflow-y-auto text-xs">
          
          {/* Order Selector */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              اختر الطلب الأصلي المسدد: <span className="text-rose-500">*</span>
            </label>
            <select
              value={selectedOrderId}
              onChange={handleOrderChange}
              className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-medium"
            >
              <option value="">-- اختر من فواتير المبيعات المسددة --</option>
              {refundableOrders.map(o => (
                <option key={o.id} value={o.id}>
                  {o.orderNumber} ({o.items.map(it => it.productNameAr).join(', ')}) — الإجمالي: {o.totalAmount} ج
                </option>
              ))}
            </select>
            {selectedOrder && (
              <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500 bg-slate-50 p-1.5 rounded">
                <span>إجمالي الطلب: <strong>{selectedOrder.totalAmount} ج</strong></span>
                <span>المسترد سابقاً: <strong>{priorRefundsForOrder} ج</strong></span>
                <span className="text-emerald-700 font-bold">المتبقي للاسترداد: <strong>{maxRefundable} ج</strong></span>
              </div>
            )}
          </div>

          {/* Refund Amount & Method */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-bold text-slate-700 block mb-1">
                المبلغ المراد استرداده (ج.م): <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min={1}
                max={maxRefundable}
                value={refundAmount}
                onChange={(e) => setRefundAmount(Number(e.target.value) || 0)}
                className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="font-bold text-slate-700 block mb-1">
                طريقة رد المبلغ:
              </label>
              <select
                value={refundMethod}
                onChange={(e: any) => setRefundMethod(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-2 bg-white font-medium"
              >
                <option value="cash">نقدي من الدرج (Cash)</option>
                <option value="instapay">تحويل إنستاباي (InstaPay)</option>
                <option value="card">عكس عملية بطاقة (Card)</option>
              </select>
            </div>
          </div>

          {/* Real-time Policy Rule Checker */}
          <div className={`p-3 rounded-xl border flex items-start gap-2.5 ${
            requiresManager
              ? 'bg-amber-50 border-amber-300 text-amber-900'
              : 'bg-emerald-50 border-emerald-300 text-emerald-900'
          }`}>
            {requiresManager ? (
              <KeyRound className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            ) : (
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            )}
            <div>
              <strong className="block font-bold">
                {requiresManager
                  ? 'يتطلب اعتماد المدير المسؤول (Manager Approval Required)'
                  : 'مسموح للكاشير بالصرف المباشر (Within Cashier Limit)'}
              </strong>
              <div className="text-[11px] leading-relaxed mt-0.5">
                {requiresManager ? (
                  !isCash
                    ? 'الاسترداد عبر البطاقات البنكية أو إنستاباي يتطلب موافقة المدير بالرقم السري إجبارياً.'
                    : `المبلغ التراكمي (${cumulativeIfProcessed} ج) يتجاوز الحد المسموح للكاشير (200 ج). سيتم تحويل الطلب تلقائياً لمركز الموافقات.`
                ) : (
                  `الاسترداد النقدي (${cumulativeIfProcessed} ج) ضمن الحد المسموح للكاشير (أقل من 200 ج) وسيتم خصمه فوراً من الدرج.`
                )}
              </div>
            </div>
          </div>

          {/* Mandatory Reason */}
          <div>
            <label className="font-bold text-slate-700 block mb-1">
              سبب الاسترداد التفصيلي: <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              placeholder="مثال: خطأ في إعداد المشروب، العميل رفض استلام الصنف، سكر زائد..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-slate-800"
            />
          </div>

          {/* Drink Waste Checkbox */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-bold text-slate-800">
              <input
                type="checkbox"
                checked={isDrinkWaste}
                onChange={(e) => setIsDrinkWaste(e.target.checked)}
                className="rounded border-slate-300 text-[#147D73] focus:ring-[#147D73] w-4 h-4"
              />
              <div className="flex items-center gap-1.5">
                <CupSoda className="w-4 h-4 text-[#147D73]" />
                <span>المشروب تم تجهيزه بالفعل ويُعتبر هالكاً (تسجيل خسارة هدر مشروبات)</span>
              </div>
            </label>
            {isDrinkWaste && (
              <input
                type="text"
                placeholder="ملاحظات الهدر التالف (مثل: تم سكب العصير في الحوض لعدم مطابقته للمواصفات)"
                value={wasteNotes}
                onChange={(e) => setWasteNotes(e.target.value)}
                className="w-full border border-slate-300 rounded-lg p-1.5 text-xs bg-white"
              />
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            إلغاء
          </button>
          <button
            onClick={handleSubmitRefund}
            className={`px-5 py-2 rounded-xl text-white text-xs font-black flex items-center gap-1.5 shadow-sm transition-all ${
              requiresManager
                ? 'bg-amber-600 hover:bg-amber-700'
                : 'bg-rose-600 hover:bg-rose-700'
            }`}
          >
            {requiresManager ? <KeyRound className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
            <span>{requiresManager ? 'إرسال طلب موافقة للمدير' : 'تنفيذ الاسترداد وخصم الدرج'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
