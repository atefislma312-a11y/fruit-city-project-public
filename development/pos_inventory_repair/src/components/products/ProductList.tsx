import React, { useState } from 'react';
import { useApp, CalculatedProductItem } from '../../context/AppContext';
import { 
  Plus, 
  Search, 
  Edit3, 
  Copy, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  Flame, 
  Eye, 
  Sparkles,
  DollarSign
} from 'lucide-react';

export const ProductList: React.FC = () => {
  const { 
    calculatedProducts, 
    setIsAddProductModalOpen, 
    setEditingProduct, 
    setEditingRecipe, 
    duplicateRecipe, 
    deleteProduct 
  } = useApp();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('الكل');

  const categories = ['الكل', 'عصائر طبيعية', 'مشروبات تقليدية', 'مشروبات شعبية', 'سموذي وميكسات'];

  const filteredProducts = calculatedProducts.filter(item => {
    const matchesSearch = item.product.nameAr.includes(search) || 
                          item.product.nameEn.toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory === 'الكل' || item.product.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleEdit = (item: CalculatedProductItem) => {
    setEditingProduct(item.product);
    if (item.recipe) {
      setEditingRecipe(item.recipe);
    }
    setIsAddProductModalOpen(true);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-[#172D36]">كتالوج المشروبات والمنتجات</h2>
          <p className="text-xs text-slate-500 mt-1">
            إدارة كافة مشروبات قائمة فروت سيتي ومتابعة تكلفة الحجمين (400 مل و 1 لتر)
          </p>
        </div>

        <button
          onClick={() => {
            setEditingProduct(null);
            setEditingRecipe(null);
            setIsAddProductModalOpen(true);
          }}
          className="inline-flex items-center gap-2 bg-[#147D73] hover:bg-[#106961] text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-md transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>إضافة مشروب جديد</span>
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث عن مشروب..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pr-10 pl-4 py-2 rounded-lg border border-slate-200 text-sm focus:outline-none focus:border-[#147D73]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors whitespace-nowrap ${
                selectedCategory === cat
                  ? 'bg-[#172D36] text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Product Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredProducts.map(item => {
          const hasSugar = item.recipe?.hasAddedSugar;

          return (
            <div
              key={item.product.id}
              className={`bg-white rounded-2xl border p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between ${
                !item.isComplete ? 'border-amber-200 bg-amber-50/10' : 'border-slate-200'
              }`}
            >
              <div>
                {/* Title & Badges */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <h3 className="font-black text-xl text-[#172D36]">{item.product.nameAr}</h3>
                    <div className="text-xs text-slate-400 font-sans">{item.product.nameEn}</div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {item.isComplete ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <CheckCircle2 className="w-3 h-3" /> معتمدة
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                        <AlertTriangle className="w-3 h-3" /> قيد القياس
                      </span>
                    )}

                    {hasSugar && (
                      <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-900 border border-amber-200">
                        <Flame className="w-2.5 h-2.5 text-amber-600" /> سكر مضاف
                      </span>
                    )}
                  </div>
                </div>

                {/* 400ml Pricing Box */}
                <div className="mb-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center text-xs font-bold text-[#147D73] mb-1">
                    <span>حجم 400 مل</span>
                    <span>سعر البيع: {item.breakdown400ml.sellingPrice > 0 ? `${item.breakdown400ml.sellingPrice} ج` : 'غير محدد'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mt-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">التكلفة المباشرة:</span>
                      <span className="font-bold">{item.breakdown400ml.directVariableCost.toFixed(2)} ج</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">هامش المساهمة (الربح):</span>
                      <span className="font-black text-emerald-700 text-sm">{item.breakdown400ml.contribution.toFixed(2)} ج</span>
                    </div>
                  </div>
                </div>

                {/* 1 Liter Pricing Box */}
                <div className="mb-4 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex justify-between items-center text-xs font-bold text-[#172D36] mb-1">
                    <span>حجم 1 لتر</span>
                    <span>سعر البيع: {item.breakdown1L.sellingPrice > 0 ? `${item.breakdown1L.sellingPrice} ج` : 'غير محدد'}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 mt-2">
                    <div>
                      <span className="text-[10px] text-slate-400 block">التكلفة المباشرة:</span>
                      <span className="font-bold">{item.breakdown1L.directVariableCost.toFixed(2)} ج</span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">هامش المساهمة (الربح):</span>
                      <span className="font-black text-emerald-700 text-sm">{item.breakdown1L.contribution.toFixed(2)} ج</span>
                    </div>
                  </div>
                </div>

                {item.product.incompleteNotes && (
                  <div className="text-[11px] text-amber-800 bg-amber-50 p-2 rounded-lg border border-amber-200 mb-3">
                    {item.product.incompleteNotes}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                <button
                  onClick={() => handleEdit(item)}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#172D36] hover:bg-[#203F4B] text-white py-2 px-3 rounded-lg text-xs font-bold transition-all"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>تعديل الوصفة والتسعير</span>
                </button>

                {item.recipe && (
                  <button
                    onClick={() => duplicateRecipe(item.recipe!.id)}
                    className="p-2 text-slate-500 hover:text-[#147D73] hover:bg-slate-100 rounded-lg transition-colors"
                    title="تكرار الوصفة لإنشاء مشروب مشتق"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                )}

                <button
                  onClick={() => deleteProduct(item.product.id)}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                  title="حذف المشروب"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

            </div>
          );
        })}
      </div>

    </div>
  );
};
