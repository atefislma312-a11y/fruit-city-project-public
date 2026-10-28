import React, { useState } from 'react';
import { useApp, CalculatedProductItem } from '../../context/AppContext';
import { 
  ChevronDown, 
  ChevronUp, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles, 
  Flame, 
  Eye, 
  Edit3
} from 'lucide-react';

export const ProfitabilityTable: React.FC = () => {
  const { calculatedProducts, setEditingProduct, setEditingRecipe, setIsAddProductModalOpen } = useApp();
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedProductId(prev => (prev === id ? null : id));
  };

  const handleEdit = (item: CalculatedProductItem) => {
    setEditingProduct(item.product);
    if (item.recipe) {
      setEditingRecipe(item.recipe);
    }
    setIsAddProductModalOpen(true);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden mb-8">
      
      {/* Table Section Header matching photo */}
      <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-extrabold text-[#172D36]">
            أرباح المنتجات قبل التشغيل
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            جدول تفصيلي لهامش المساهمة المباشر لكل كوب 400 مل وزجاجة 1 لتر بعد خصم تكلفة الخامة والتعبئة
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
            إجمالي: {calculatedProducts.length} منتجات
          </span>
        </div>
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-right border-collapse">
          <thead>
            <tr className="bg-[#FAFBF9] border-b border-slate-200 text-xs font-bold text-slate-600">
              <th className="py-4 px-5">المنتج</th>
              <th className="py-4 px-4">سعر 400 مل</th>
              <th className="py-4 px-4">تكلفة 400 مل</th>
              <th className="py-4 px-4 text-emerald-800 bg-emerald-50/40">ربح 400 مل</th>
              <th className="py-4 px-4">سعر 1 لتر</th>
              <th className="py-4 px-4">تكلفة 1 لتر</th>
              <th className="py-4 px-4 text-emerald-800 bg-emerald-50/40">ربح 1 لتر</th>
              <th className="py-4 px-4">هامش المساهمة</th>
              <th className="py-4 px-4">حالة الوصفة</th>
              <th className="py-4 px-4 text-center">تفاصيل</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-sm">
            {calculatedProducts.map((item) => {
              const isExpanded = expandedProductId === item.product.id;
              const hasSugar = item.recipe?.hasAddedSugar;

              return (
                <React.Fragment key={item.product.id}>
                  <tr 
                    className={`hover:bg-slate-50/80 transition-colors ${
                      !item.isComplete ? 'bg-amber-50/30' : ''
                    }`}
                  >
                    {/* Product Name */}
                    <td className="py-4 px-5">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-[#172D36] text-base">
                          {item.product.nameAr}
                        </span>
                        {hasSugar && (
                          <span 
                            title="تحتوي على سكر مضاف"
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800"
                          >
                            <Flame className="w-3 h-3 ml-0.5" /> سكر مضاف
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 font-sans">
                        {item.product.nameEn}
                      </div>
                    </td>

                    {/* 400ml Price */}
                    <td className="py-4 px-4 font-bold text-slate-700">
                      {item.breakdown400ml.sellingPrice > 0 ? (
                        <span>{item.breakdown400ml.sellingPrice.toFixed(2)} ج</span>
                      ) : (
                        <span className="text-slate-400 text-xs">غير محدد</span>
                      )}
                    </td>

                    {/* 400ml Direct Cost */}
                    <td className="py-4 px-4 font-medium text-slate-600">
                      {item.breakdown400ml.directVariableCost > 0 ? (
                        <span>{item.breakdown400ml.directVariableCost.toFixed(2)} ج</span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* 400ml Contribution (Matches Photo: e.g. 24.25 ج مانجو / 19.60 ج فراولة) */}
                    <td className="py-4 px-4 font-black text-emerald-700 bg-emerald-50/40">
                      {item.breakdown400ml.sellingPrice > 0 ? (
                        <span className="text-base font-extrabold">
                          {item.breakdown400ml.contribution.toFixed(2)} ج
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* 1L Price */}
                    <td className="py-4 px-4 font-bold text-slate-700">
                      {item.breakdown1L.sellingPrice > 0 ? (
                        <span>{item.breakdown1L.sellingPrice.toFixed(2)} ج</span>
                      ) : (
                        <span className="text-slate-400 text-xs">غير محدد</span>
                      )}
                    </td>

                    {/* 1L Cost */}
                    <td className="py-4 px-4 font-medium text-slate-600">
                      {item.breakdown1L.directVariableCost > 0 ? (
                        <span>{item.breakdown1L.directVariableCost.toFixed(2)} ج</span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* 1L Contribution (Matches Photo: e.g. 29.63 ج مانجو / 23.00 ج فراولة) */}
                    <td className="py-4 px-4 font-black text-emerald-700 bg-emerald-50/40">
                      {item.breakdown1L.sellingPrice > 0 ? (
                        <span className="text-base font-extrabold">
                          {item.breakdown1L.contribution.toFixed(2)} ج
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Contribution Margin % */}
                    <td className="py-4 px-4">
                      {item.breakdown400ml.sellingPrice > 0 ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                          item.breakdown400ml.contributionMarginPercent >= 50
                            ? 'bg-teal-50 text-[#147D73]'
                            : 'bg-amber-50 text-amber-700'
                        }`}>
                          %{item.breakdown400ml.contributionMarginPercent}
                        </span>
                      ) : (
                        <span className="text-slate-400 text-xs">—</span>
                      )}
                    </td>

                    {/* Status Badge */}
                    <td className="py-4 px-4">
                      {item.isComplete ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>معتمدة</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                          <span>قيد الاستكمال</span>
                        </span>
                      )}
                    </td>

                    {/* Actions / Details */}
                    <td className="py-4 px-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => toggleExpand(item.product.id)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#147D73] hover:bg-slate-100 transition-colors"
                          title="عرض تفاصيل التكلفة"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleEdit(item)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-[#172D36] hover:bg-slate-100 transition-colors"
                          title="تعديل المشروب والوصفة"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded Cost Breakdown Row */}
                  {isExpanded && (
                    <tr className="bg-slate-50/90 border-y border-slate-200">
                      <td colSpan={10} className="p-5">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
                          
                          {/* Recipe & Batch Details */}
                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <h4 className="font-extrabold text-[#172D36] mb-2 flex items-center gap-1.5">
                              <Sparkles className="w-4 h-4 text-[#C59A45]" />
                              <span>بيانات التشغيلة (Batch)</span>
                            </h4>
                            {item.recipe ? (
                              <div className="space-y-1.5 text-slate-600">
                                <div><span className="font-semibold">نوع الوصفة:</span> {item.recipe.method === 'batch' ? 'تشغيلة مجمعة' : 'بالكوب الفردي'}</div>
                                {item.recipe.method === 'batch' && (
                                  <>
                                    <div><span className="font-semibold">حجم التشغيلة:</span> {item.recipe.batchYieldMl} مل ({(item.recipe.batchYieldMl / 1000).toFixed(1)} لتر)</div>
                                    <div><span className="font-semibold">تكلفة التشغيلة:</span> {item.batchCost.toFixed(2)} ج</div>
                                    <div><span className="font-semibold">تكلفة اللتر الخام:</span> {item.rawCostPerLiter.toFixed(2)} ج/لتر</div>
                                  </>
                                )}
                                {item.recipe.marketingAlert && (
                                  <div className="p-2 bg-amber-50 text-amber-800 rounded border border-amber-200 mt-2 font-medium">
                                    تنبيه تسويقي: {item.recipe.marketingAlert}
                                  </div>
                                )}
                                {item.recipe.safetyNotes && (
                                  <div className="p-2 bg-rose-50 text-rose-800 rounded border border-rose-200 mt-2 font-medium">
                                    {item.recipe.safetyNotes}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="text-slate-400">لا توجد وصفة مدخلة</div>
                            )}
                          </div>

                          {/* 400ml Deep Breakdown */}
                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <h4 className="font-extrabold text-[#147D73] mb-2">تفاصيل كوب 400 مل</h4>
                            <div className="space-y-1 text-slate-600">
                              <div className="flex justify-between">
                                <span>تكلفة الخامة النقية:</span>
                                <span className="font-bold">{item.breakdown400ml.rawMaterialCost.toFixed(2)} ج</span>
                              </div>
                              <div className="flex justify-between">
                                <span>تكلفة الكوب والغطاء والشفاطة:</span>
                                <span className="font-bold">{item.breakdown400ml.packagingCost.toFixed(2)} ج</span>
                              </div>
                              <div className="flex justify-between border-t pt-1 border-slate-100 font-extrabold text-slate-800">
                                <span>إجمالي التكلفة المتغيرة:</span>
                                <span>{item.breakdown400ml.directVariableCost.toFixed(2)} ج</span>
                              </div>
                              <div className="flex justify-between text-emerald-700 font-black pt-1">
                                <span>هامش المساهمة (الربح):</span>
                                <span>{item.breakdown400ml.contribution.toFixed(2)} ج</span>
                              </div>
                              <div className="mt-3 p-2 bg-slate-50 rounded text-[11px] text-slate-500">
                                <div>سعر مقترح لهامش 60%: <span className="font-bold text-slate-700">{item.breakdown400ml.targetPriceAt60PercentMargin.toFixed(2)} ج</span></div>
                                <div>سعر مقترح لهامش 70%: <span className="font-bold text-slate-700">{item.breakdown400ml.targetPriceAt70PercentMargin.toFixed(2)} ج</span></div>
                              </div>
                            </div>
                          </div>

                          {/* 1L Deep Breakdown */}
                          <div className="bg-white p-4 rounded-xl border border-slate-200">
                            <h4 className="font-extrabold text-[#172D36] mb-2">تفاصيل زجاجة 1 لتر</h4>
                            <div className="space-y-1 text-slate-600">
                              <div className="flex justify-between">
                                <span>تكلفة العصير الخام (1 لتر):</span>
                                <span className="font-bold">{item.breakdown1L.rawMaterialCost.toFixed(2)} ج</span>
                              </div>
                              <div className="flex justify-between">
                                <span>تكلفة الزجاجة والغطاء والاستيكر:</span>
                                <span className="font-bold">{item.breakdown1L.packagingCost.toFixed(2)} ج</span>
                              </div>
                              <div className="flex justify-between border-t pt-1 border-slate-100 font-extrabold text-slate-800">
                                <span>إجمالي التكلفة المتغيرة:</span>
                                <span>{item.breakdown1L.directVariableCost.toFixed(2)} ج</span>
                              </div>
                              <div className="flex justify-between text-emerald-700 font-black pt-1">
                                <span>هامش المساهمة (الربح):</span>
                                <span>{item.breakdown1L.contribution.toFixed(2)} ج</span>
                              </div>
                              <div className="mt-3 p-2 bg-slate-50 rounded text-[11px] text-slate-500">
                                <div>سعر مقترح لهامش 60%: <span className="font-bold text-slate-700">{item.breakdown1L.targetPriceAt60PercentMargin.toFixed(2)} ج</span></div>
                                <div>سعر مقترح لهامش 70%: <span className="font-bold text-slate-700">{item.breakdown1L.targetPriceAt70PercentMargin.toFixed(2)} ج</span></div>
                              </div>
                            </div>
                          </div>

                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
};
