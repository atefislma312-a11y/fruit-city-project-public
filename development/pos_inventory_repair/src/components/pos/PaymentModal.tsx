import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PosOrder, PaymentMethodType } from '../../types';
import { 
  X, 
  Banknote, 
  Smartphone, 
  CreditCard, 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert,
  ArrowRight
} from 'lucide-react';
import { roundMoney } from '../../engine/costingEngine';

interface PaymentModalProps {
  order: PosOrder;
  onClose: () => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({ order, onClose }) => {
  const { processOrderPayment, paymentFeeRules, showToast } = useApp();

  const [method, setMethod] = useState<PaymentMethodType>('cash');

  // Cash state
  const [amountTendered, setAmountTendered] = useState<number>(order.totalAmount);

  // InstaPay state
  const [instapayRef, setInstapayRef] = useState('');
  const [instapayVerification, setInstapayVerification] = useState<'merchant_app' | 'bank_sms' | 'manual_review'>('merchant_app');
  const [instapayEvidenceName, setInstapayEvidenceName] = useState('');

  // Card state
  const [terminalId, setTerminalId] = useState('BM-POS-01 (Banque Misr)');
  const [cardRef, setCardRef] = useState('');
  const [cardType, setCardType] = useState<'visa' | 'mastercard' | 'other'>('visa');

  // Change calculation
  const changeDue = Math.max(0, roundMoney(amountTendered - order.totalAmount));
  const isCashInsufficient = method === 'cash' && amountTendered < order.totalAmount;

  // Submit payment
  const handleConfirmPayment = () => {
    if (method === 'cash' && isCashInsufficient) {
      showToast('المبلغ المدفوع نقداً أقل من إجمالي الطلب');
      return;
    }

    if (method === 'instapay' && !instapayRef.trim()) {
      showToast('يجب إدخال الرقم المرجعي لتحويل إنستاباي لتوثيق السجل المالي');
      return;
    }

    if (method === 'card' && !cardRef.trim()) {
      showToast('يجب إدخال رقم تفويض الماكينة أو مرجع العملية من الإيصال');
      return;
    }

    const res = processOrderPayment({
      orderId: order.id,
      amount: order.totalAmount,
      method,
      tendered: method === 'cash' ? amountTendered : undefined,
      instapayRef: method === 'instapay' ? instapayRef : undefined,
      instapayVerification: method === 'instapay' ? instapayVerification : undefined,
      instapayEvidenceName: method === 'instapay' ? instapayEvidenceName : undefined,
      terminalId: method === 'card' ? terminalId : undefined,
      cardRef: method === 'card' ? cardRef : undefined,
      cardType: method === 'card' ? cardType : undefined
    });

    if (res.success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-150">
        
        {/* Header */}
        <div className="bg-[#172D36] text-white p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#147D73] flex items-center justify-center text-white">
              <CreditCard className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-base">تحصيل وسداد الطلب #{order.orderNumber}</h2>
              <p className="text-xs text-[#B5C9C3]">
                {order.orderType === 'dine_in' ? 'داخل المحل' : order.orderType === 'takeaway' ? 'تيك أواي' : 'دليفري'} • عدد الأصناف: {order.items.length}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Amount Banner */}
        <div className="bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 border-b border-teal-100 p-4 text-center">
          <div className="text-xs text-slate-500 font-semibold mb-0.5">المبلغ المطلوب سداده:</div>
          <div className="text-3xl font-black text-[#172D36] font-mono tracking-tight">
            {order.totalAmount} <span className="text-sm font-sans font-bold text-[#147D73]">جنيه مصري</span>
          </div>
        </div>

        {/* Payment Method Selector Tabs */}
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-2">
            
            <button
              onClick={() => setMethod('cash')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                method === 'cash'
                  ? 'border-[#147D73] bg-teal-50/70 text-[#147D73] ring-2 ring-[#147D73]/20 font-black'
                  : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Banknote className="w-5 h-5" />
              <span className="text-xs font-bold">نقدي (كاش)</span>
            </button>

            <button
              onClick={() => setMethod('instapay')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                method === 'instapay'
                  ? 'border-purple-600 bg-purple-50/70 text-purple-700 ring-2 ring-purple-600/20 font-black'
                  : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Smartphone className="w-5 h-5" />
              <span className="text-xs font-bold">إنستاباي (InstaPay)</span>
            </button>

            <button
              onClick={() => setMethod('card')}
              className={`p-3 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all ${
                method === 'card'
                  ? 'border-blue-600 bg-blue-50/70 text-blue-700 ring-2 ring-blue-600/20 font-black'
                  : 'border-slate-200 bg-slate-50/50 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <CreditCard className="w-5 h-5" />
              <span className="text-xs font-bold">فيزا / ماكينة POS</span>
            </button>

          </div>

          {/* =========================================
              METHOD A: CASH DETAILS
              ========================================= */}
          {method === 'cash' && (
            <div className="bg-slate-50 border border-slate-200/90 rounded-xl p-3.5 space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  المبلغ المستلم من العميل (ج.م):
                </label>
                <input
                  type="number"
                  min={0}
                  step={5}
                  value={amountTendered}
                  onChange={(e) => setAmountTendered(Number(e.target.value) || 0)}
                  className="w-full border border-slate-300 rounded-lg p-2.5 text-base font-bold font-mono text-slate-900 bg-white focus:ring-2 focus:ring-[#147D73]"
                />
              </div>

              {/* Quick denominations */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400">فئات سريعة:</span>
                {[order.totalAmount, 50, 100, 200, 500].filter(val => val >= order.totalAmount).slice(0, 4).map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setAmountTendered(val)}
                    className="px-2 py-1 rounded bg-white border border-slate-200 text-xs font-mono font-bold text-slate-700 hover:bg-slate-100"
                  >
                    {val} ج
                  </button>
                ))}
              </div>

              {/* Change calculation */}
              <div className={`p-2.5 rounded-lg flex items-center justify-between text-xs font-bold ${
                isCashInsufficient
                  ? 'bg-rose-50 text-rose-700 border border-rose-200'
                  : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              }`}>
                <span>{isCashInsufficient ? 'المبلغ غير كافٍ!' : 'المتبقي للعميل (الباقي):'}</span>
                <span className="text-base font-mono font-black">
                  {isCashInsufficient ? `متبقي ${(order.totalAmount - amountTendered).toFixed(2)} ج` : `${changeDue} ج`}
                </span>
              </div>
            </div>
          )}

          {/* =========================================
              METHOD B: INSTAPAY DETAILS
              ========================================= */}
          {method === 'instapay' && (
            <div className="bg-purple-50/50 border border-purple-200/80 rounded-xl p-3.5 space-y-3 text-xs">
              
              {/* Security Warning */}
              <div className="bg-amber-50 border border-amber-300 rounded-lg p-2.5 flex items-start gap-2 text-amber-900">
                <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <strong className="block text-amber-950 font-bold mb-0.5">تنبيه أمني مشدد:</strong>
                  لقطة شاشة هاتف العميل (Screenshot) وحدها <u>ليست دليلاً كافياً</u> للاعتماد. يجب التحقق الفعلي من وصول الإشعار في تطبيق التاجر أو رسالة البنك.
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  الرقم المرجعي للتحويل (Reference / Tx ID): <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: IP-20261012-9842"
                  value={instapayRef}
                  onChange={(e) => setInstapayRef(e.target.value)}
                  className="w-full border border-purple-200 rounded-lg p-2 text-xs font-mono font-bold bg-white focus:ring-1 focus:ring-purple-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    طريقة التحقق المتبعة:
                  </label>
                  <select
                    value={instapayVerification}
                    onChange={(e: any) => setInstapayVerification(e.target.value)}
                    className="w-full border border-purple-200 rounded-lg p-1.5 text-xs bg-white"
                  >
                    <option value="merchant_app">إشعار تطبيق التاجر</option>
                    <option value="bank_sms">رسالة البنك SMS</option>
                    <option value="manual_review">تدقيق كشف الحساب الفوري</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    ملاحظة / اسم صاحب الحساب:
                  </label>
                  <input
                    type="text"
                    placeholder="اسم المحول كما ظهر في الإشعار"
                    value={instapayEvidenceName}
                    onChange={(e) => setInstapayEvidenceName(e.target.value)}
                    className="w-full border border-purple-200 rounded-lg p-1.5 text-xs bg-white"
                  />
                </div>
              </div>

            </div>
          )}

          {/* =========================================
              METHOD C: CARD / POS TERMINAL DETAILS
              ========================================= */}
          {method === 'card' && (
            <div className="bg-blue-50/50 border border-blue-200/80 rounded-xl p-3.5 space-y-3 text-xs">
              
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    ماكينة الدفع (Terminal):
                  </label>
                  <select
                    value={terminalId}
                    onChange={(e) => setTerminalId(e.target.value)}
                    className="w-full border border-blue-200 rounded-lg p-1.5 text-xs bg-white"
                  >
                    <option value="BM-POS-01 (Banque Misr)">بنك مصر (BM-POS-01)</option>
                    <option value="FW-POS-02 (Fawry)">فوري بلس (FW-POS-02)</option>
                    <option value="PAYMOB-01">بيموب (Paymob Terminal)</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-700 block mb-1">
                    نوع البطاقة:
                  </label>
                  <select
                    value={cardType}
                    onChange={(e: any) => setCardType(e.target.value)}
                    className="w-full border border-blue-200 rounded-lg p-1.5 text-xs bg-white"
                  >
                    <option value="visa">فيزا (Visa)</option>
                    <option value="mastercard">ماستركارد (Mastercard)</option>
                    <option value="other">ميزة / أخرى (Meeza)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  رقم تفويض الماكينة / المرجع من الإيصال الورقي: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="مثال: APP-087431 أو RRN-94812"
                  value={cardRef}
                  onChange={(e) => setCardRef(e.target.value)}
                  className="w-full border border-blue-200 rounded-lg p-2 text-xs font-mono font-bold bg-white focus:ring-1 focus:ring-blue-600"
                />
              </div>

              <div className="bg-blue-100/50 rounded-lg p-2 text-[11px] text-blue-900 flex items-center justify-between">
                <span>الرسوم التقديرية للبنك (1.5%):</span>
                <span className="font-mono font-bold">~{(order.totalAmount * 0.015).toFixed(2)} ج</span>
              </div>

            </div>
          )}

        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors"
          >
            إلغاء
          </button>
          <button
            disabled={isCashInsufficient}
            onClick={handleConfirmPayment}
            className="px-6 py-2.5 rounded-xl bg-[#147D73] hover:bg-[#0E5C55] disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 shadow-md transition-all"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>تأكيد السداد وطباعة الفاتورة</span>
          </button>
        </div>

      </div>
    </div>
  );
};
