import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { ExpenseItem } from '../../types';
import { 
  Wallet, 
  Plus, 
  Edit2, 
  Trash2, 
  TrendingUp, 
  Building2, 
  Users, 
  Zap, 
  ShieldCheck, 
  Coffee,
  Check,
  X
} from 'lucide-react';

export const OperatingBudget: React.FC = () => {
  const { expenses, totalMonthlyExpenses, saveExpense, deleteExpense, calculatedProducts } = useApp();

  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState<Partial<ExpenseItem>>({
    nameAr: '',
    nameEn: '',
    monthlyAmount: 0,
    type: 'fixed',
    category: 'operations',
    notes: ''
  });

  // Calculate average contribution across 400ml servings
  const validProducts = calculatedProducts.filter(p => p.isComplete && p.breakdown400ml.sellingPrice > 0);
  const avgContributionPerCup = validProducts.length > 0
    ? validProducts.reduce((sum, p) => sum + p.breakdown400ml.contribution, 0) / validProducts.length
    : 20;

  // Break-even metrics
  const monthlyBreakEvenCups = Math.ceil(totalMonthlyExpenses / avgContributionPerCup);
  const dailyBreakEvenCups = Math.ceil(monthlyBreakEvenCups / 30);

  // Fixed vs Variable breakdown
  const fixedTotal = expenses
    .filter(e => e.type === 'fixed')
    .reduce((sum, e) => sum + e.monthlyAmount, 0);
  const mixedOrVariableTotal = totalMonthlyExpenses - fixedTotal;

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setFormData({
      id: `exp_${Date.now()}`,
      nameAr: '',
      nameEn: '',
      monthlyAmount: 0,
      type: 'fixed',
      category: 'operations',
      notes: ''
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (exp: ExpenseItem) => {
    setEditingExpense(exp);
    setFormData({ ...exp });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameAr) return;

    const expenseToSave: ExpenseItem = {
      id: formData.id || `exp_${Date.now()}`,
      nameAr: formData.nameAr,
      nameEn: formData.nameEn || '',
      monthlyAmount: Number(formData.monthlyAmount) || 0,
      type: formData.type || 'fixed',
      category: formData.category || 'operations',
      notes: formData.notes || ''
    };

    saveExpense(expenseToSave);
    setIsModalOpen(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-[#172D36]">المصروفات وميزانية التشغيل الشهرية</h2>
          <p className="text-xs text-slate-500 mt-1">
            خطة ميزانية إعادة الإطلاق الرسمية لفرع وسط البلد — القاهرة (المخطط: 61,050 ج شهرياً)
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 bg-[#147D73] hover:bg-[#106961] text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-md transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>إضافة بند مصروف جديد</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        
        {/* Total Budget */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-500 mb-1">إجمالي الميزانية الشهرية المخططة</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-[#172D36]">
              {new Intl.NumberFormat('en-US').format(totalMonthlyExpenses)}
            </span>
            <span className="text-base font-bold text-[#147D73]">جنيه / شهر</span>
          </div>
          <div className="mt-3 flex justify-between text-xs text-slate-600 border-t pt-2 border-slate-100">
            <span>مصاريف ثابتة: <strong className="text-slate-800">{new Intl.NumberFormat('ar-EG').format(fixedTotal)} ج</strong></span>
            <span>مختلطة / متغيرة: <strong className="text-slate-800">{new Intl.NumberFormat('ar-EG').format(mixedOrVariableTotal)} ج</strong></span>
          </div>
        </div>

        {/* Break-even point */}
        <div className="bg-gradient-to-br from-[#147D73] to-[#0E5C55] text-white rounded-2xl p-5 shadow-sm">
          <div className="text-xs font-bold text-teal-100 mb-1">نقطة التعادل لتغطية الميزانية</div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-black text-white">
              {new Intl.NumberFormat('ar-EG').format(monthlyBreakEvenCups)}
            </span>
            <span className="text-xs text-teal-100 font-medium">كوب 400 مل شهرياً</span>
          </div>
          <div className="mt-3 text-xs text-teal-100 border-t pt-2 border-white/20">
            معدل التعادل اليومي: <strong className="text-white text-sm">{dailyBreakEvenCups} كوب/يوم</strong> (بمتوسط مساهمة {avgContributionPerCup.toFixed(1)} ج/كوب)
          </div>
        </div>

        {/* Owner & Staff Allocation */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-500 mb-1">توزيع الرواتب والإدارة</div>
          <div className="text-3xl font-black text-[#172D36]">
            40,000 <span className="text-base font-bold text-[#147D73]">ج</span>
          </div>
          <div className="mt-3 text-xs text-slate-600 border-t pt-2 border-slate-100">
            تشمل <strong>30,000 ج</strong> مرتبات 4-5 عمال تشغيل + <strong>10,000 ج</strong> مخصص راتب صاحب المشروع
          </div>
        </div>

      </div>

      {/* Expenses Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h3 className="font-extrabold text-lg text-[#172D36]">جدول بنود ميزانية التشغيل</h3>
          <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full font-bold">
            16 بنداً معتمداً
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-sm">
            <thead>
              <tr className="bg-[#FAFBF9] border-b border-slate-200 text-xs font-bold text-slate-600">
                <th className="py-3 px-5">بند المصروف</th>
                <th className="py-3 px-4">المبلغ الشهري (ج)</th>
                <th className="py-3 px-4">نوع المصروف</th>
                <th className="py-3 px-4">التصنيف</th>
                <th className="py-3 px-4">ملاحظات</th>
                <th className="py-3 px-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3.5 px-5 font-bold text-slate-800">
                    <div>{exp.nameAr}</div>
                    <div className="text-[11px] text-slate-400 font-sans">{exp.nameEn}</div>
                  </td>
                  <td className="py-3.5 px-4 font-black text-[#172D36] text-base">
                    {new Intl.NumberFormat('ar-EG').format(exp.monthlyAmount)} ج
                  </td>
                  <td className="py-3.5 px-4">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-bold ${
                      exp.type === 'fixed' 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'bg-purple-50 text-purple-700'
                    }`}>
                      {exp.type === 'fixed' ? 'ثابت' : exp.type === 'variable' ? 'متغير' : 'مختلط'}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-600 font-medium">
                    {exp.category === 'rent' ? 'إيجار' :
                     exp.category === 'utilities' ? 'مرافق وخدمات' :
                     exp.category === 'salaries' ? 'رواتب' :
                     exp.category === 'marketing' ? 'تسويق' :
                     exp.category === 'fees' ? 'رسوم بنكية' : 'تشغيل'}
                  </td>
                  <td className="py-3.5 px-4 text-xs text-slate-500">
                    {exp.notes || '—'}
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => handleOpenEdit(exp)}
                        className="p-1.5 text-slate-400 hover:text-[#172D36] hover:bg-slate-100 rounded-lg transition-colors"
                        title="تعديل المبلغ"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteExpense(exp.id)}
                        className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        title="حذف البند"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-[#FAFBF9] border-t-2 border-slate-200 font-black text-slate-900">
                <td className="py-4 px-5 text-base">الإجمالي الشهري للمصروفات</td>
                <td className="py-4 px-4 text-xl text-[#147D73]" colSpan={5}>
                  {new Intl.NumberFormat('ar-EG').format(totalMonthlyExpenses)} جنيه مصري
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* EDIT / ADD MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-lg text-[#172D36]">
                {editingExpense ? 'تعديل بند المصروف' : 'إضافة بند مصروف جديد'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم البند بالعربية *</label>
                <input
                  type="text"
                  required
                  value={formData.nameAr || ''}
                  onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:border-[#147D73] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">المبلغ الشهري بالجنيه *</label>
                <input
                  type="number"
                  step="50"
                  required
                  value={formData.monthlyAmount || ''}
                  onChange={(e) => setFormData({ ...formData, monthlyAmount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 font-bold text-sm focus:border-[#147D73] focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">نوع المصروف</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:border-[#147D73] focus:outline-none"
                  >
                    <option value="fixed">ثابت (Fixed)</option>
                    <option value="variable">متغير (Variable)</option>
                    <option value="mixed">مختلط (Mixed)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:border-[#147D73] focus:outline-none"
                  >
                    <option value="rent">إيجار</option>
                    <option value="utilities">مرافق</option>
                    <option value="salaries">رواتب</option>
                    <option value="operations">تشغيل</option>
                    <option value="marketing">تسويق</option>
                    <option value="fees">رسوم</option>
                    <option value="other">أخرى</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات توضيحية</label>
                <textarea
                  rows={2}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:border-[#147D73] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 bg-[#147D73] hover:bg-[#106961] text-white py-2.5 rounded-xl font-bold text-sm shadow transition-all"
                >
                  حفظ البند
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-100"
                >
                  إلغاء
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
};
