import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { CashierShift } from '../../types';
import { 
  Clock, 
  UserCheck, 
  Banknote, 
  ArrowLeftRight, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  ShieldCheck, 
  Coins, 
  Sparkles,
  RotateCcw,
  Plus
} from 'lucide-react';
import { roundMoney } from '../../engine/costingEngine';
import { aggregateShiftPayments, STANDARD_SHIFT_FLOAT_EGP } from '../../engine/shiftEngine';

export const ShiftManager: React.FC = () => {
  const {
    shifts,
    currentShift,
    currentCashier,
    cashierAccounts,
    payments,
    refunds,
    openNewShift,
    handoverShift,
    showToast
  } = useApp();

  // Handover modal state
  const [isHandoverOpen, setIsHandoverOpen] = useState(false);
  const [nextCashierId, setNextCashierId] = useState<string>(
    cashierAccounts.find(c => c.id !== currentCashier.id)?.id || cashierAccounts[0]?.id || ''
  );
  const [handoverNotes, setHandoverNotes] = useState('');
  const [withdrawalAmount, setWithdrawalAmount] = useState<number>(0);

  // Cash denomination counter
  const [counts, setCounts] = useState<{ [key: string]: number }>({
    '200': 0,
    '100': 0,
    '50': 0,
    '20': 0,
    '10': 0,
    '5': 0,
    'coins': 0
  });

  // Calculate actual total from denominations
  const totalCountedCash = roundMoney(
    (counts['200'] * 200) +
    (counts['100'] * 100) +
    (counts['50'] * 50) +
    (counts['20'] * 20) +
    (counts['10'] * 10) +
    (counts['5'] * 5) +
    (Number(counts['coins']) || 0)
  );

  const activeShift = currentShift || shifts.find(s => s.status === 'open');

  // Breakdown of payments for active shift
  const shiftPayments = activeShift 
    ? aggregateShiftPayments(payments.filter(p => p.cashierShiftId === activeShift.id))
    : {
      totalGrossSales: 0,
      cashReceived: 0,
      instapayReceived: 0,
      cardReceived: 0,
      electronicTotal: 0
    };

  // Expected drawer cash
  const expectedCash = activeShift ? activeShift.expectedCash : 500;
  const discrepancy = roundMoney(totalCountedCash - expectedCash);

  const handleDenominationChange = (denom: string, val: number) => {
    setCounts(prev => ({ ...prev, [denom]: Math.max(0, val) }));
  };

  const handleConfirmHandover = () => {
    if (!activeShift) return;

    if (!nextCashierId) {
      showToast('يرجى اختيار الكاشير المستلم للوردية التالية');
      return;
    }

    const res = handoverShift({
      shiftId: activeShift.id,
      nextCashierId,
      actualCashCounted: totalCountedCash,
      withdrawalAmount,
      notes: handoverNotes
    });

    if (res.success) {
      setIsHandoverOpen(false);
      // Reset counter
      setCounts({ '200': 0, '100': 0, '50': 0, '20': 0, '10': 0, '5': 0, 'coins': 0 });
      setWithdrawalAmount(0);
      setHandoverNotes('');
    }
  };

  const handleStartShift = () => {
    openNewShift(currentCashier.id, STANDARD_SHIFT_FLOAT_EGP);
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-[#172D36] text-white rounded-2xl p-6 shadow-md border border-[#234552] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#C59A45] text-xs font-black uppercase tracking-wider mb-1">
            <Clock className="w-4 h-4" />
            <span>إدارة الورديات وجرد الخزينة (Shift & Cash Drawer)</span>
          </div>
          <h1 className="text-2xl font-black text-white">تسليم واستلام ورديات الكاشير</h1>
          <p className="text-xs text-[#B5C9C3] mt-1">
            عهدة نقدية افتتاحية قياسية (500 ج) • معادلة جرد الدرج الصارمة • عزل كامل لمدفوعات الفيزا وإنستاباي
          </p>
        </div>

        {activeShift ? (
          <button
            onClick={() => {
              const other = cashierAccounts.find(c => c.id !== activeShift.cashierId);
              if (other) setNextCashierId(other.id);
              setIsHandoverOpen(true);
            }}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-black text-sm flex items-center gap-2 shadow-lg transition-all"
          >
            <ArrowLeftRight className="w-4 h-4" />
            <span>تسليم الوردية وإجراء الجرد الفعلي</span>
          </button>
        ) : (
          <button
            onClick={handleStartShift}
            className="px-5 py-2.5 rounded-xl bg-[#147D73] hover:bg-[#0E5C55] text-white font-black text-sm flex items-center gap-2 shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>فتح وردية جديدة (عهدة 500 ج)</span>
          </button>
        )}
      </div>

      {/* Active Shift Details Card */}
      {activeShift ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 overflow-hidden">
          
          <div className="bg-slate-50 border-b border-slate-200 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#147D73] text-white flex items-center justify-center font-black text-base shadow-sm">
                #{activeShift.shiftNumber}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-extrabold text-base text-slate-900">الوردية الحالية المفتوحة</h2>
                  <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[11px] font-black px-2 py-0.5 rounded-full">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    نشطة الآن
                  </span>
                </div>
                <div className="text-xs text-slate-500 mt-0.5">
                  الكاشير المسؤول: <strong className="text-slate-800">{activeShift.cashierName}</strong> • بدأت في: {new Date(activeShift.startTime).toLocaleTimeString('ar-EG')}
                </div>
              </div>
            </div>

            <div className="text-left bg-white px-4 py-2 rounded-xl border border-slate-200">
              <div className="text-[11px] text-slate-500">الرصيد النقدي المتوقع بالدرج:</div>
              <div className="text-2xl font-black text-[#172D36] font-mono">
                {activeShift.expectedCash} <span className="text-xs font-sans text-[#147D73]">ج.م</span>
              </div>
            </div>
          </div>

          {/* Cash Drawer Reconciliation Equation Display */}
          <div className="p-5">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              معادلة احتساب نقدية الدرج الفعلية (Cash Drawer Balance Formula):
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              
              <div className="bg-teal-50/60 border border-teal-200 rounded-xl p-3 text-center">
                <span className="text-[11px] text-teal-800 font-bold block mb-1">العهدة الافتتاحية (+)</span>
                <span className="text-base font-black text-teal-900 font-mono">{activeShift.openingFloat} ج</span>
              </div>

              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3 text-center">
                <span className="text-[11px] text-emerald-800 font-bold block mb-1">المبيعات النقدية (+)</span>
                <span className="text-base font-black text-emerald-900 font-mono">+{activeShift.cashReceived} ج</span>
              </div>

              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-3 text-center">
                <span className="text-[11px] text-blue-800 font-bold block mb-1">إيداعات نقدية (+)</span>
                <span className="text-base font-black text-blue-900 font-mono">+{activeShift.cashDeposits} ج</span>
              </div>

              <div className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 text-center">
                <span className="text-[11px] text-rose-800 font-bold block mb-1">المرتجعات النقدية (-)</span>
                <span className="text-base font-black text-rose-900 font-mono">-{activeShift.cashRefunds} ج</span>
              </div>

              <div className="bg-amber-50/60 border border-amber-200 rounded-xl p-3 text-center">
                <span className="text-[11px] text-amber-800 font-bold block mb-1">مصروفات نثرية (-)</span>
                <span className="text-base font-black text-amber-900 font-mono">-{activeShift.cashExpenses} ج</span>
              </div>

              <div className="bg-slate-100 border border-slate-300 rounded-xl p-3 text-center">
                <span className="text-[11px] text-slate-800 font-bold block mb-1">مسحوبات المالك (-)</span>
                <span className="text-base font-black text-slate-900 font-mono">-{activeShift.cashWithdrawals} ج</span>
              </div>

            </div>

            {/* Non-Cash / Electronic Isolation Notice */}
            <div className="mt-5 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  <span>المتحصلات الإلكترونية المستبعدة من الدرج (Bank Accounts Isolation):</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  هذه المبالغ مسددة مباشرة في الحسابات البنكية ولا تدخل في نقدية الدرج لحماية دقة الجرد.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="bg-purple-100/70 border border-purple-200 px-3 py-1.5 rounded-lg text-xs">
                  <span className="text-purple-900 font-bold">إنستاباي: </span>
                  <span className="font-mono font-black text-purple-950">{shiftPayments.instapayReceived} ج</span>
                </div>
                <div className="bg-blue-100/70 border border-blue-200 px-3 py-1.5 rounded-lg text-xs">
                  <span className="text-blue-900 font-bold">فيزا / ماكينة POS: </span>
                  <span className="font-mono font-black text-blue-950">{shiftPayments.cardReceived} ج</span>
                </div>
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 space-y-3">
          <Clock className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="font-bold text-base text-slate-700">لا توجد وردية مفتوحة حالياً</h3>
          <p className="text-xs text-slate-500">ابدأ بفتح وردية جديدة للبدء في تسجيل عمليات البيع</p>
          <button
            onClick={handleStartShift}
            className="px-4 py-2 bg-[#147D73] text-white rounded-lg text-xs font-bold inline-flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>فتح وردية جديدة للكاشير الحالي</span>
          </button>
        </div>
      )}

      {/* Shifts History Log */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5 space-y-4">
        <h3 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#147D73]" />
          <span>سجل الورديات السابقة وإغلاقات الدرج</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                <th className="p-3">رقم الوردية</th>
                <th className="p-3">الكاشير</th>
                <th className="p-3">وقت البدء</th>
                <th className="p-3">وقت الإغلاق</th>
                <th className="p-3">العهدة</th>
                <th className="p-3">المبيعات النقدية</th>
                <th className="p-3">المتوقع بالدرج</th>
                <th className="p-3">المعدود فعلياً</th>
                <th className="p-3">نتيجة الجرد</th>
                <th className="p-3">الحالة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shifts.map((s) => {
                const disc = s.discrepancy || 0;
                return (
                  <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="p-3 font-mono font-bold text-slate-900">#{s.shiftNumber}</td>
                    <td className="p-3 font-bold text-slate-800">{s.cashierName}</td>
                    <td className="p-3 text-slate-500 font-mono">{new Date(s.startTime).toLocaleTimeString('ar-EG')}</td>
                    <td className="p-3 text-slate-500 font-mono">
                      {s.endTime ? new Date(s.endTime).toLocaleTimeString('ar-EG') : 'مفتوحة حالياً'}
                    </td>
                    <td className="p-3 font-mono">{s.openingFloat} ج</td>
                    <td className="p-3 font-mono text-emerald-700 font-bold">+{s.cashReceived} ج</td>
                    <td className="p-3 font-mono font-bold">{s.expectedCash} ج</td>
                    <td className="p-3 font-mono font-bold text-slate-900">
                      {s.actualCashCounted !== undefined ? `${s.actualCashCounted} ج` : '—'}
                    </td>
                    <td className="p-3">
                      {s.status === 'closed' ? (
                        disc === 0 ? (
                          <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-bold border border-emerald-200">
                            مطابقة تامة
                          </span>
                        ) : disc > 0 ? (
                          <span className="text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-bold border border-blue-200">
                            زيادة +{disc} ج
                          </span>
                        ) : (
                          <span className="text-rose-700 bg-rose-50 px-2 py-0.5 rounded font-bold border border-rose-200">
                            عجز {disc} ج
                          </span>
                        )
                      ) : (
                        <span className="text-slate-400">قيد التشغيل</span>
                      )}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                        s.status === 'open'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {s.status === 'open' ? 'مفتوحة' : 'مغلقة ومسلمة'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================
          HANDOVER CASH COUNTING MODAL
          ========================================= */}
      {isHandoverOpen && activeShift && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
            
            {/* Header */}
            <div className="bg-[#172D36] text-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="w-5 h-5 text-[#C59A45]" />
                <h2 className="font-extrabold text-base">تسليم الوردية والجرد الفعلي للخزينة</h2>
              </div>
              <button onClick={() => setIsHandoverOpen(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4 text-xs flex-1">
              
              {/* Shift info summary */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                <div>
                  <div className="font-bold text-slate-800">الوردية #{activeShift.shiftNumber} — {activeShift.cashierName}</div>
                  <div className="text-[11px] text-slate-500">العهدة الافتتاحية: {activeShift.openingFloat} ج • النقدية المتوقعة بالمعادلة: {activeShift.expectedCash} ج</div>
                </div>
                <div className="text-right">
                  <div className="text-[10px] text-slate-400 font-semibold">المطلوب تواجده بالدرج:</div>
                  <div className="text-lg font-black text-[#147D73] font-mono">{activeShift.expectedCash} ج</div>
                </div>
              </div>

              {/* Physical Cash Denomination Counting Sheet */}
              <div className="space-y-2">
                <label className="font-extrabold text-slate-800 block text-xs">
                  حاسبة الفئات النقدية الفعلية بالدرج (Denomination Counting Sheet):
                </label>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: '200', label: 'فئة 200 جنيه' },
                    { id: '100', label: 'فئة 100 جنيه' },
                    { id: '50', label: 'فئة 50 جنيه' },
                    { id: '20', label: 'فئة 20 جنيه' },
                    { id: '10', label: 'فئة 10 جنيه' },
                    { id: '5', label: 'فئة 5 جنيه' }
                  ].map(denom => (
                    <div key={denom.id} className="bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-bold text-slate-700">{denom.label}</span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          ={(counts[denom.id] * Number(denom.id))} ج
                        </span>
                      </div>
                      <input
                        type="number"
                        min={0}
                        placeholder="عدد الأوراق"
                        value={counts[denom.id] || ''}
                        onChange={(e) => handleDenominationChange(denom.id, Number(e.target.value) || 0)}
                        className="w-full border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold bg-white text-center"
                      />
                    </div>
                  ))}
                </div>

                {/* Loose coins */}
                <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-700">فكة نقدية ومعدنية أخرى (بالجنيه):</span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    placeholder="القيمة بالجنية"
                    value={counts['coins'] || ''}
                    onChange={(e) => handleDenominationChange('coins', Number(e.target.value) || 0)}
                    className="w-32 border border-slate-300 rounded px-2 py-1 text-xs font-mono font-bold bg-white text-center"
                  />
                </div>
              </div>

              {/* Total Counted vs Expected Reconciliation Result */}
              <div className={`p-4 rounded-xl border flex items-center justify-between ${
                discrepancy === 0
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                  : discrepancy > 0
                    ? 'bg-blue-50 border-blue-300 text-blue-900'
                    : 'bg-rose-50 border-rose-300 text-rose-900'
              }`}>
                <div>
                  <div className="text-xs font-semibold">إجمالي النقدية المعدودة فعلياً:</div>
                  <div className="text-xl font-black font-mono">{totalCountedCash} ج.م</div>
                </div>

                <div className="text-left">
                  <div className="text-xs font-semibold">نتيجة الجرد:</div>
                  <div className="text-base font-black">
                    {discrepancy === 0
                      ? 'مطابقة تامة 100%'
                      : discrepancy > 0
                        ? `زيادة بالخزينة (+${discrepancy} ج)`
                        : `عجز بالخزينة (${discrepancy} ج)`}
                  </div>
                </div>
              </div>

              {/* Next Cashier Selection */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  اختر الكاشير المستلم للوردية التالية: <span className="text-rose-500">*</span>
                </label>
                <select
                  value={nextCashierId}
                  onChange={(e) => setNextCashierId(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 bg-white text-slate-800 font-semibold"
                >
                  {cashierAccounts.map(c => (
                    <option key={c.id} value={c.id}>{c.nameAr} ({c.role === 'manager' ? 'مدير' : 'كاشير'})</option>
                  ))}
                </select>
                <div className="text-[11px] text-slate-500 mt-1">
                  * سيتم تلقائياً ترحيل عهدة بداية جديدة بمبلغ 500 ج للكاشير المستلم لتبدأ ورديته فوراً.
                </div>
              </div>

              {/* Owner withdrawal if any */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  مبلغ مسحوبات المالك / التوريد للخزنة الرئيسية (اختياري):
                </label>
                <input
                  type="number"
                  min={0}
                  value={withdrawalAmount || ''}
                  onChange={(e) => setWithdrawalAmount(Number(e.target.value) || 0)}
                  placeholder="0 ج"
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="font-bold text-slate-700 block mb-1">
                  ملاحظات الاستلام والتسليم:
                </label>
                <input
                  type="text"
                  placeholder="أي ملاحظات حول نظافة المكان، الفكة، أو أسباب العجز/الزيادة..."
                  value={handoverNotes}
                  onChange={(e) => setHandoverNotes(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setIsHandoverOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                onClick={handleConfirmHandover}
                className="px-6 py-2 bg-[#147D73] hover:bg-[#0E5C55] text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>اعتماد التسليم وإغلاق الوردية</span>
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
