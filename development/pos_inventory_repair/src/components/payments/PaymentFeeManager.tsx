import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PaymentFeeRule, SettlementBatch } from '../../types';
import { 
  CreditCard, 
  Plus, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  TrendingUp, 
  Trash2, 
  DollarSign, 
  Percent, 
  Sparkles,
  UploadCloud,
  FileText
} from 'lucide-react';
import { roundMoney } from '../../engine/costingEngine';
import { comparePaymentFeesToBudget, PROVISIONAL_MONTHLY_PAYMENT_FEE_BUDGET } from '../../engine/paymentFeeEngine';

export const PaymentFeeManager: React.FC = () => {
  const {
    paymentFeeRules,
    savePaymentFeeRule,
    deletePaymentFeeRule,
    payments,
    settlementBatches,
    importSettlementBatch,
    showToast
  } = useApp();

  // Add rule modal
  const [isRuleModalOpen, setIsRuleModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<Partial<PaymentFeeRule>>({
    providerName: 'Banque Misr Terminal',
    paymentMethod: 'card',
    feePercent: 1.5,
    fixedFee: 0,
    contractualTaxPercent: 14,
    monthlyServiceFee: 150,
    effectiveStartDate: new Date().toISOString().split('T')[0],
    roundingRule: 'round_2_decimals',
    active: true,
    version: 1
  });

  // CSV Import modal
  const [isCsvModalOpen, setIsCsvModalOpen] = useState(false);
  const [csvProviderName, setCsvProviderName] = useState('Banque Misr');
  const [csvContent, setCsvContent] = useState(`Transaction Reference,Date,Gross Amount,Fee,Net Settlement
APP-087431,2026-10-12,75.00,1.13,73.87
RRN-94812,2026-10-12,120.00,1.80,118.20
BM-REF-109,2026-10-12,250.00,3.75,246.25`);

  // Current month's fee vs provisional budget calculation
  const electronicPayments = payments.filter(p => (p.method === 'card' || p.method === 'instapay') && p.status === 'verified');
  const totalElectronicGross = roundMoney(electronicPayments.reduce((s, p) => s + p.amount, 0));
  const totalActualFees = roundMoney(electronicPayments.reduce((s, p) => s + (p.feeSnapshot?.expectedFeeAmount || 0), 0));
  const budgetComparison = comparePaymentFeesToBudget(totalActualFees);

  const handleSaveRule = () => {
    if (!editingRule.providerName?.trim()) {
      showToast('يجب إدخال اسم مزود الخدمة أو البنك');
      return;
    }

    const newRule: PaymentFeeRule = {
      id: editingRule.id || `rule_${Date.now()}`,
      providerName: editingRule.providerName,
      paymentMethod: editingRule.paymentMethod || 'card',
      feePercent: Number(editingRule.feePercent) || 0,
      fixedFee: Number(editingRule.fixedFee) || 0,
      contractualTaxPercent: Number(editingRule.contractualTaxPercent) || 0,
      monthlyServiceFee: Number(editingRule.monthlyServiceFee) || 0,
      effectiveStartDate: editingRule.effectiveStartDate || new Date().toISOString().split('T')[0],
      roundingRule: 'round_2_decimals',
      active: editingRule.active ?? true,
      version: (editingRule.version || 0) + 1
    };

    savePaymentFeeRule(newRule);
    setIsRuleModalOpen(false);
  };

  const handleImportCsv = () => {
    if (!csvContent.trim()) {
      showToast('يرجى لصق بيانات كشف التسوية أو تحميل الملف');
      return;
    }

    const res = importSettlementBatch(csvContent, csvProviderName);
    if (res.success) {
      setIsCsvModalOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner */}
      <div className="bg-[#172D36] text-white rounded-2xl p-6 shadow-md border border-[#234552] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[#C59A45] text-xs font-black uppercase tracking-wider mb-1">
            <CreditCard className="w-4 h-4" />
            <span>رسوم وتسويات المدفوعات الإلكترونية (Payment Fees & Settlement)</span>
          </div>
          <h1 className="text-2xl font-black text-white">إدارة عمولات نقاط البيع والربط المحاسبي</h1>
          <p className="text-xs text-[#B5C9C3] mt-1">
            توثيق قواعد رسوم البنوك والماكينات • مقارنة المخصص التقديري (1,200 ج شهرياً) • استيراد ومطابقة كشوف التسوية البنكية
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsCsvModalOpen(true)}
            className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs flex items-center gap-2 transition-colors border border-white/10"
          >
            <UploadCloud className="w-4 h-4" />
            <span>استيراد كشف تسوية CSV</span>
          </button>
          <button
            onClick={() => {
              setEditingRule({
                providerName: 'Banque Misr Terminal',
                paymentMethod: 'card',
                feePercent: 1.5,
                fixedFee: 0,
                contractualTaxPercent: 14,
                monthlyServiceFee: 150,
                effectiveStartDate: new Date().toISOString().split('T')[0],
                roundingRule: 'round_2_decimals',
                active: true,
                version: 1
              });
              setIsRuleModalOpen(true);
            }}
            className="px-4 py-2.5 rounded-xl bg-[#147D73] hover:bg-[#0E5C55] text-white font-black text-xs flex items-center gap-2 shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>إضافة قاعدة رسوم جديدة</span>
          </button>
        </div>
      </div>

      {/* KPI Cards: Budget vs Actual Payment Fees */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm">
          <div className="text-xs text-slate-500 font-bold mb-1">مخصص الرسوم بالميزانية التشغيلية:</div>
          <div className="text-2xl font-black text-[#172D36] font-mono">
            {PROVISIONAL_MONTHLY_PAYMENT_FEE_BUDGET} <span className="text-xs font-sans text-slate-400">ج / شهر</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">ضمن ميزانية الـ 61,050 ج المعتمدة</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm">
          <div className="text-xs text-slate-500 font-bold mb-1">إجمالي المبيعات الإلكترونية للشهر:</div>
          <div className="text-2xl font-black text-blue-700 font-mono">
            {totalElectronicGross} <span className="text-xs font-sans text-slate-400">ج.م</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">بطاقات بنكية + إنستاباي</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm">
          <div className="text-xs text-slate-500 font-bold mb-1">الرسوم البنكية الفعلية المحتسبة:</div>
          <div className="text-2xl font-black text-purple-700 font-mono">
            {budgetComparison.actualTotalFees} <span className="text-xs font-sans text-slate-400">ج.م</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1">عمولات مقتطعة من البنك</div>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-sm">
          <div className="text-xs text-slate-500 font-bold mb-1">حالة مقارنة الميزانية (وفر / عجز):</div>
          <div className={`text-2xl font-black font-mono ${
            budgetComparison.status === 'within_budget' ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {budgetComparison.status === 'within_budget' ? `+${Math.abs(budgetComparison.variance)}` : `-${budgetComparison.variance}`} <span className="text-xs font-sans text-slate-400">ج.م</span>
          </div>
          <div className="text-[11px] font-bold mt-1">
            {budgetComparison.status === 'within_budget' ? (
              <span className="text-emerald-700">وفر مالي تحت سقف الميزانية</span>
            ) : (
              <span className="text-rose-700">تجاوز المخصص التقديري</span>
            )}
          </div>
        </div>

      </div>

      {/* Accounting Notice Card */}
      <div className="bg-teal-50/70 border border-teal-200/80 rounded-2xl p-4 text-xs text-teal-950 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <strong className="block font-bold mb-0.5">قاعدة التوجيه المحاسبي لرسوم الدفع الإلكتروني:</strong>
          تُقارن الرسوم البنكية الفعلية دورياً مع المخصص التقديري المعتمد (1,200 ج شهرياً) لقياس التكلفة التشغيلية الحقيقية لخدمات الدفع. <u>يُمنع تكرار تسجيل الرسوم كمصروف مزدوج</u>؛ حيث تُقتطع مباشرة من صافي التسوية الواردة للحساب البنكي. وفي حال عدم تعريف قاعدة رسوم لمزود معين تظهر القيمة كـ (غير محددة) ولا تُفترض صفراً.
        </div>
      </div>

      {/* Payment Fee Rules Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <Percent className="w-5 h-5 text-[#147D73]" />
            <span>قواعد وعمولات مزودي الدفع المعتمدة</span>
          </h2>
          <span className="text-xs text-slate-500">
            عدد القواعد المعرفة: {paymentFeeRules.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-slate-50 border-y border-slate-200 text-slate-600 font-bold">
                <th className="p-3">مزود الخدمة</th>
                <th className="p-3">طريقة الدفع</th>
                <th className="p-3">نسبة العمولة (%)</th>
                <th className="p-3">عمولة ثابتة</th>
                <th className="p-3">ضريبة القيمة المضافة (VAT)</th>
                <th className="p-3">إيجار الماكينة الشهري</th>
                <th className="p-3">تاريخ السريان</th>
                <th className="p-3">الحالة</th>
                <th className="p-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paymentFeeRules.map(rule => (
                <tr key={rule.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="p-3 font-bold text-slate-900">{rule.providerName}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      rule.paymentMethod === 'card' ? 'bg-blue-50 text-blue-800' : 'bg-purple-50 text-purple-800'
                    }`}>
                      {rule.paymentMethod === 'card' ? 'بطاقة بنكية / فيزا' : 'إنستاباي (InstaPay)'}
                    </span>
                  </td>
                  <td className="p-3 font-mono font-bold">{rule.feePercent}%</td>
                  <td className="p-3 font-mono">{rule.fixedFee > 0 ? `${rule.fixedFee} ج` : '—'}</td>
                  <td className="p-3 font-mono">{rule.contractualTaxPercent ? `${rule.contractualTaxPercent}%` : '—'}</td>
                  <td className="p-3 font-mono">{rule.monthlyServiceFee ? `${rule.monthlyServiceFee} ج` : '—'}</td>
                  <td className="p-3 font-mono text-slate-500">{rule.effectiveStartDate}</td>
                  <td className="p-3">
                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded text-[11px] font-bold border border-emerald-200">
                      نشطة
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => deletePaymentFeeRule(rule.id)}
                      className="text-rose-500 hover:text-rose-700 p-1"
                      title="حذف القاعدة"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Settlement Batches History Table */}
      {settlementBatches.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/90 p-5 space-y-4">
          <h2 className="font-extrabold text-base text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
            <span>كشوف التسوية البنكية المستوردة (Reconciliation Batches)</span>
          </h2>

          <div className="space-y-4">
            {settlementBatches.map(batch => (
              <div key={batch.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <div>
                    <span className="font-mono font-black text-slate-900 text-sm">{batch.batchReference}</span>
                    <span className="text-xs text-slate-500 mr-2">المزود: {batch.providerName} • السجلات: {batch.recordsCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono">الإجمالي: <strong>{batch.totalGross} ج</strong></span>
                    <span className="text-xs font-mono text-purple-700">الرسوم: <strong>{batch.totalFees} ج</strong></span>
                    <span className="text-xs font-mono text-emerald-700 font-bold">الصافي: <strong>{batch.totalNet} ج</strong></span>
                  </div>
                </div>

                <div className="overflow-x-auto max-h-48">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="text-slate-500 font-bold">
                        <th className="p-1.5">المرجع</th>
                        <th className="p-1.5">التاريخ</th>
                        <th className="p-1.5">المبلغ الأصلي</th>
                        <th className="p-1.5">العمولة</th>
                        <th className="p-1.5">صافي التحويل</th>
                        <th className="p-1.5">حالة المطابقة</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {batch.rows.map((row, idx) => (
                        <tr key={idx}>
                          <td className="p-1.5 font-mono">{row.transactionReference}</td>
                          <td className="p-1.5 font-mono text-slate-500">{row.transactionDate}</td>
                          <td className="p-1.5 font-mono">{row.grossAmount} ج</td>
                          <td className="p-1.5 font-mono text-purple-700">{row.deductedFee} ج</td>
                          <td className="p-1.5 font-mono font-bold text-emerald-800">{row.netSettlement} ج</td>
                          <td className="p-1.5">
                            {row.status === 'matched' ? (
                              <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.2 rounded text-[10px]">
                                متطابق
                              </span>
                            ) : (
                              <span className="text-amber-700 font-bold bg-amber-50 px-1.5 py-0.2 rounded text-[10px]">
                                {row.notes || 'غير متطابق'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================
          ADD RULE MODAL
          ========================================= */}
      {isRuleModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
            <div className="bg-[#172D36] text-white p-4 flex items-center justify-between">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <Percent className="w-4 h-4 text-[#C59A45]" />
                <span>إضافة قاعدة رسوم بنكية جديدة</span>
              </h3>
              <button onClick={() => setIsRuleModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">اسم البنك / مزود الخدمة: *</label>
                <input
                  type="text"
                  placeholder="مثال: Banque Misr Terminal, Fawry, Paymob..."
                  value={editingRule.providerName || ''}
                  onChange={(e) => setEditingRule({ ...editingRule, providerName: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">طريقة الدفع:</label>
                  <select
                    value={editingRule.paymentMethod || 'card'}
                    onChange={(e: any) => setEditingRule({ ...editingRule, paymentMethod: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg p-2 bg-white"
                  >
                    <option value="card">بطاقة بنكية (فيزا)</option>
                    <option value="instapay">إنستاباي (InstaPay)</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">نسبة العمولة (%):</label>
                  <input
                    type="number"
                    step={0.1}
                    value={editingRule.feePercent || 0}
                    onChange={(e) => setEditingRule({ ...editingRule, feePercent: Number(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-bold text-slate-700 block mb-1">عمولة ثابتة لكل عملية (ج):</label>
                  <input
                    type="number"
                    step={0.5}
                    value={editingRule.fixedFee || 0}
                    onChange={(e) => setEditingRule({ ...editingRule, fixedFee: Number(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono font-bold"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-700 block mb-1">ضريبة القيمة المضافة على العمولة (%):</label>
                  <input
                    type="number"
                    value={editingRule.contractualTaxPercent || 0}
                    onChange={(e) => setEditingRule({ ...editingRule, contractualTaxPercent: Number(e.target.value) || 0 })}
                    className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">الإيجار الشهري للماكينة (ج.م):</label>
                <input
                  type="number"
                  value={editingRule.monthlyServiceFee || 0}
                  onChange={(e) => setEditingRule({ ...editingRule, monthlyServiceFee: Number(e.target.value) || 0 })}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono"
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setIsRuleModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                onClick={handleSaveRule}
                className="px-5 py-2 bg-[#147D73] hover:bg-[#0E5C55] text-white rounded-xl text-xs font-black shadow-md"
              >
                حفظ القاعدة
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================
          CSV SETTLEMENT IMPORT MODAL
          ========================================= */}
      {isCsvModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
            <div className="bg-[#172D36] text-white p-4 flex items-center justify-between">
              <h3 className="font-extrabold text-sm flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-[#C59A45]" />
                <span>استيراد كشف تسوية بنكي (Settlement CSV)</span>
              </h3>
              <button onClick={() => setIsCsvModalOpen(false)} className="text-slate-400 hover:text-white">✕</button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="font-bold text-slate-700 block mb-1">اسم البنك / ماكينة التسوية:</label>
                <input
                  type="text"
                  value={csvProviderName}
                  onChange={(e) => setCsvProviderName(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="font-bold text-slate-700 block mb-1">بيانات الكشف بتنسيق CSV:</label>
                <textarea
                  rows={6}
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg p-2 font-mono text-[11px] leading-relaxed"
                />
                <span className="text-[10px] text-slate-400 block mt-1">
                  * الأعمدة المطلوبة: Transaction Reference, Date, Gross Amount, Fee, Net Settlement
                </span>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setIsCsvModalOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100"
              >
                إلغاء
              </button>
              <button
                onClick={handleImportCsv}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>مطابقة واعتماد الكشف</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
