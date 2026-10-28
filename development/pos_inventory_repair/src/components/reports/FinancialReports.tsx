import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  BarChart3, 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Calculator, 
  Award, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';

export const FinancialReports: React.FC = () => {
  const { calculatedProducts, totalMonthlyExpenses } = useApp();

  // Simulated sales volume for each product (cups of 400ml / bottles of 1L per month)
  const [salesVolumes, setSalesVolumes] = useState<Record<string, { '400ml': number; '1L': number }>>(() => {
    const initial: Record<string, { '400ml': number; '1L': number }> = {};
    calculatedProducts.forEach(p => {
      // sensible starter estimation: 250 cups 400ml, 50 bottles 1L
      initial[p.product.id] = { '400ml': 250, '1L': 50 };
    });
    return initial;
  });

  const handleVolumeChange = (productId: string, size: '400ml' | '1L', val: number) => {
    setSalesVolumes(prev => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || { '400ml': 0, '1L': 0 }),
        [size]: Math.max(0, val)
      }
    }));
  };

  // Calculations for projection
  let totalProjectedRevenue = 0;
  let totalProjectedDirectCost = 0;
  let totalProjectedContribution = 0;
  let totalCupsSold = 0;

  calculatedProducts.forEach(item => {
    const vol = salesVolumes[item.product.id] || { '400ml': 0, '1L': 0 };
    
    // 400ml
    const rev400 = vol['400ml'] * item.breakdown400ml.sellingPrice;
    const cost400 = vol['400ml'] * item.breakdown400ml.directVariableCost;
    const cont400 = vol['400ml'] * item.breakdown400ml.contribution;

    // 1L
    const rev1L = vol['1L'] * item.breakdown1L.sellingPrice;
    const cost1L = vol['1L'] * item.breakdown1L.directVariableCost;
    const cont1L = vol['1L'] * item.breakdown1L.contribution;

    totalProjectedRevenue += rev400 + rev1L;
    totalProjectedDirectCost += cost400 + cost1L;
    totalProjectedContribution += cont400 + cont1L;
    totalCupsSold += vol['400ml'] + vol['1L'];
  });

  const netOperatingProfit = totalProjectedContribution - totalMonthlyExpenses;
  const overallContributionMarginPercent = totalProjectedRevenue > 0
    ? Math.round((totalProjectedContribution / totalProjectedRevenue) * 100)
    : 0;

  // Sorting products by contribution margin
  const sortedByMargin = [...calculatedProducts]
    .filter(p => p.isComplete && p.breakdown400ml.sellingPrice > 0)
    .sort((a, b) => b.breakdown400ml.contributionMarginPercent - a.breakdown400ml.contributionMarginPercent);

  const highestMarginProducts = sortedByMargin.slice(0, 3);
  const lowestMarginProducts = [...sortedByMargin].reverse().slice(0, 3);

  return (
    <div className="space-y-8">
      
      {/* Title */}
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-2xl font-black text-[#172D36]">التقارير المالية ومحاكي الأرباح التشغيلية</h2>
        <p className="text-xs text-slate-500 mt-1">
          محاكاة تقديرية للمبيعات المتوقعة لتحديد صافي الربح التشغيلي بعد خصم تكلفة الخامات والتعبئة والمصروفات الثابتة
        </p>
      </div>

      {/* Projection KPI Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-500 mb-1">إجمالي المبيعات المقدرة</div>
          <div className="text-2xl font-black text-[#172D36]">
            {new Intl.NumberFormat('ar-EG').format(Math.round(totalProjectedRevenue))} <span className="text-sm font-bold text-[#147D73]">ج</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            بإجمالي {totalCupsSold} عبوة شهرياً
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-500 mb-1">إجمالي تكاليف الخامات والتعبئة</div>
          <div className="text-2xl font-black text-rose-700">
            {new Intl.NumberFormat('ar-EG').format(Math.round(totalProjectedDirectCost))} <span className="text-sm font-bold">ج</span>
          </div>
          <div className="text-[11px] text-slate-400 mt-1 font-medium">
            تكاليف مباشرة متغيرة
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="text-xs font-bold text-slate-500 mb-1">إجمالي هامش المساهمة المباشر</div>
          <div className="text-2xl font-black text-[#147D73]">
            {new Intl.NumberFormat('ar-EG').format(Math.round(totalProjectedContribution))} <span className="text-sm font-bold">ج</span>
          </div>
          <div className="text-[11px] text-[#147D73] mt-1 font-bold">
            متوسط الهامش: %{overallContributionMarginPercent}
          </div>
        </div>

        <div className={`p-5 rounded-2xl border shadow-sm ${
          netOperatingProfit >= 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-950' : 'bg-rose-50 border-rose-200 text-rose-950'
        }`}>
          <div className="text-xs font-bold text-slate-600 mb-1">صافي النتيجة التشغيلية المتوقعة</div>
          <div className={`text-2xl font-black ${netOperatingProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {new Intl.NumberFormat('ar-EG').format(Math.round(netOperatingProfit))} <span className="text-sm font-bold">ج</span>
          </div>
          <div className="text-[11px] text-slate-600 mt-1">
            بعد خصم الميزانية الشهرية ({new Intl.NumberFormat('ar-EG').format(totalMonthlyExpenses)} ج)
          </div>
        </div>

      </div>

      {/* Top and Bottom Products Analysis */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Highest Margin */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-emerald-700 font-extrabold text-base">
            <Award className="w-5 h-5 text-emerald-600" />
            <span>أعلى المنتجات في هامش المساهمة (%)</span>
          </div>

          <div className="space-y-3">
            {highestMarginProducts.map((item, idx) => (
              <div key={item.product.id} className="flex items-center justify-between p-3 bg-emerald-50/50 rounded-xl border border-emerald-100">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{item.product.nameAr}</div>
                    <div className="text-xs text-slate-500">سعر 400 مل: {item.breakdown400ml.sellingPrice} ج — تكلفة: {item.breakdown400ml.directVariableCost.toFixed(2)} ج</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-black text-emerald-700">%{item.breakdown400ml.contributionMarginPercent}</div>
                  <div className="text-xs font-bold text-slate-600">{item.breakdown400ml.contribution.toFixed(2)} ج ربح/كوب</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Lowest Margin / Needs attention */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-amber-800 font-extrabold text-base">
            <AlertCircle className="w-5 h-5 text-amber-600" />
            <span>منتجات تتطلب مراقبة تكلفة المواد الخام</span>
          </div>

          <div className="space-y-3">
            {lowestMarginProducts.map((item, idx) => (
              <div key={item.product.id} className="flex items-center justify-between p-3 bg-amber-50/40 rounded-xl border border-amber-100">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-amber-600 text-white font-black text-xs flex items-center justify-center">
                    {idx + 1}
                  </span>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{item.product.nameAr}</div>
                    <div className="text-xs text-slate-500">سعر 400 مل: {item.breakdown400ml.sellingPrice} ج — تكلفة: {item.breakdown400ml.directVariableCost.toFixed(2)} ج</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-base font-black text-amber-800">%{item.breakdown400ml.contributionMarginPercent}</div>
                  <div className="text-xs font-bold text-slate-600">{item.breakdown400ml.contribution.toFixed(2)} ج ربح/كوب</div>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* Interactive Sales Simulator Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
          <div>
            <h3 className="font-black text-lg text-[#172D36]">محاكي أعداد المبيعات الشهرية للمشروبات</h3>
            <p className="text-xs text-slate-400">
              عدّل كمية الأكواب والزجاجات المتوقع بيعها شهرياً لرؤية تأثيرها الفوري على الأرباح
            </p>
          </div>
          <button
            onClick={() => {
              const resetVol: Record<string, { '400ml': number; '1L': number }> = {};
              calculatedProducts.forEach(p => {
                resetVol[p.product.id] = { '400ml': 300, '1L': 60 };
              });
              setSalesVolumes(resetVol);
            }}
            className="text-xs font-bold text-[#147D73] hover:underline"
          >
            تعبئة نموذج افتراضي (300 كوب / 60 زجاجة)
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right border-collapse text-sm">
            <thead>
              <tr className="bg-[#FAFBF9] border-b border-slate-200 text-xs font-bold text-slate-600">
                <th className="py-3 px-5">المشروب</th>
                <th className="py-3 px-4">ربح الكوب 400 مل</th>
                <th className="py-3 px-4">عدد الأكواب 400 مل المتوقعة</th>
                <th className="py-3 px-4">ربح الزجاجة 1 لتر</th>
                <th className="py-3 px-4">عدد زجاجات 1 لتر المتوقعة</th>
                <th className="py-3 px-4 text-emerald-800 bg-emerald-50/40">إجمالي ربح الصنف (ج)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {calculatedProducts.map(item => {
                const vol = salesVolumes[item.product.id] || { '400ml': 0, '1L': 0 };
                const totalItemContribution = 
                  (vol['400ml'] * item.breakdown400ml.contribution) +
                  (vol['1L'] * item.breakdown1L.contribution);

                return (
                  <tr key={item.product.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-5 font-bold text-slate-800">
                      {item.product.nameAr}
                    </td>
                    <td className="py-3 px-4 font-extrabold text-emerald-700">
                      {item.breakdown400ml.contribution.toFixed(2)} ج
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={vol['400ml']}
                        onChange={(e) => handleVolumeChange(item.product.id, '400ml', parseInt(e.target.value) || 0)}
                        className="w-24 px-2 py-1 rounded border border-slate-300 font-bold text-center text-xs"
                      />
                    </td>
                    <td className="py-3 px-4 font-extrabold text-emerald-700">
                      {item.breakdown1L.contribution.toFixed(2)} ج
                    </td>
                    <td className="py-3 px-4">
                      <input
                        type="number"
                        min="0"
                        step="5"
                        value={vol['1L']}
                        onChange={(e) => handleVolumeChange(item.product.id, '1L', parseInt(e.target.value) || 0)}
                        className="w-24 px-2 py-1 rounded border border-slate-300 font-bold text-center text-xs"
                      />
                    </td>
                    <td className="py-3 px-4 font-black text-emerald-700 text-base bg-emerald-50/40">
                      {new Intl.NumberFormat('ar-EG').format(Math.round(totalItemContribution))} ج
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};
