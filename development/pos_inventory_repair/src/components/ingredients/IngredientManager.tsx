import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Ingredient, IngredientCategory, UnitType } from '../../types';
import { 
  Plus, 
  Search, 
  Edit2, 
  TrendingUp, 
  Trash2, 
  Calendar, 
  Layers, 
  Check, 
  X,
  History
} from 'lucide-react';

export const IngredientManager: React.FC = () => {
  const { ingredients, updateIngredientPrice, saveIngredient, deleteIngredient } = useApp();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('الكل');
  
  // Modal states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPriceModalOpen, setIsPriceModalOpen] = useState(false);
  const [activeIngredient, setActiveIngredient] = useState<Ingredient | null>(null);

  // Quick price update fields
  const [newPriceInput, setNewPriceInput] = useState<number>(0);
  const [priceNoteInput, setPriceNoteInput] = useState<string>('');

  // Full ingredient form state
  const [formData, setFormData] = useState<Partial<Ingredient>>({
    nameAr: '',
    nameEn: '',
    category: 'فواكه طازجة',
    purchaseUnit: 'kg',
    packageSize: 1,
    currentPrice: 0,
    baseUnit: 'g',
    supplier: '',
    usableYieldPercent: 100,
    wastePercentage: 0,
    isMeasured: true,
    notes: ''
  });

  const categories: string[] = ['الكل', 'فواكه طازجة', 'ألبان وكريمات', 'سكريات ومحليات', 'نكهات ومواد مضافة', 'تعبئة وتغليف', 'أخرى'];

  const filteredIngredients = ingredients.filter(ing => {
    const matchesSearch = ing.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ing.nameEn.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (ing.supplier && ing.supplier.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'الكل' || ing.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleOpenNewIngredient = () => {
    setActiveIngredient(null);
    setFormData({
      id: `ing_${Date.now()}`,
      nameAr: '',
      nameEn: '',
      category: 'فواكه طازجة',
      purchaseUnit: 'kg',
      packageSize: 1,
      currentPrice: 0,
      baseUnit: 'g',
      supplier: '',
      usableYieldPercent: 100,
      wastePercentage: 0,
      isMeasured: true,
      priceHistory: [{ date: new Date().toISOString().split('T')[0], price: 0, note: 'سعر افتتاحي' }],
      lastUpdated: new Date().toISOString().split('T')[0],
      notes: ''
    });
    setIsEditModalOpen(true);
  };

  const handleOpenEditIngredient = (ing: Ingredient) => {
    setActiveIngredient(ing);
    setFormData({ ...ing });
    setIsEditModalOpen(true);
  };

  const handleOpenQuickPrice = (ing: Ingredient) => {
    setActiveIngredient(ing);
    setNewPriceInput(ing.currentPrice);
    setPriceNoteInput('');
    setIsPriceModalOpen(true);
  };

  const handleSaveQuickPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeIngredient || newPriceInput <= 0) return;
    updateIngredientPrice(activeIngredient.id, newPriceInput, priceNoteInput || 'تحديث سعر السوق');
    setIsPriceModalOpen(false);
  };

  const handleSaveFullIngredient = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nameAr || (formData.currentPrice ?? 0) < 0) return;

    const baseUnit: 'g' | 'ml' | 'piece' = 
      formData.purchaseUnit === 'kg' || formData.purchaseUnit === 'g' ? 'g' :
      formData.purchaseUnit === 'l' || formData.purchaseUnit === 'ml' ? 'ml' : 'piece';

    const yieldPercent = Number(formData.usableYieldPercent) || 100;
    const wastePercent = 100 - yieldPercent;

    const ingredientToSave: Ingredient = {
      id: formData.id || `ing_${Date.now()}`,
      nameAr: formData.nameAr || '',
      nameEn: formData.nameEn || '',
      category: (formData.category as IngredientCategory) || 'أخرى',
      purchaseUnit: (formData.purchaseUnit as UnitType) || 'kg',
      packageSize: Number(formData.packageSize) || 1,
      currentPrice: Number(formData.currentPrice) || 0,
      pricePerBaseUnit: 0, // computed by context
      baseUnit,
      supplier: formData.supplier || '',
      lastUpdated: new Date().toISOString().split('T')[0],
      priceHistory: activeIngredient 
        ? (activeIngredient.currentPrice !== formData.currentPrice 
            ? [{ date: new Date().toISOString().split('T')[0], price: Number(formData.currentPrice), note: 'تعديل السعر' }, ...activeIngredient.priceHistory]
            : activeIngredient.priceHistory)
        : [{ date: new Date().toISOString().split('T')[0], price: Number(formData.currentPrice), note: 'إدخال أولي' }],
      usableYieldPercent: yieldPercent,
      wastePercentage: wastePercent,
      isMeasured: Boolean(formData.isMeasured),
      notes: formData.notes || ''
    };

    saveIngredient(ingredientToSave);
    setIsEditModalOpen(false);
  };

  return (
    <div className="space-y-6">
      
      {/* Header and Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-2xl font-black text-[#172D36]">قاعدة بيانات الخامات والمشتريات</h2>
          <p className="text-xs text-slate-500 mt-1">
            تحديث أي سعر خامة هنا يحدث تلقائياً تكاليف وهوامش أرباح كافة الوصفات المرتبطة بها
          </p>
        </div>

        <button
          onClick={handleOpenNewIngredient}
          className="inline-flex items-center gap-2 bg-[#147D73] hover:bg-[#106961] text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-md transition-all"
        >
          <Plus className="w-5 h-5" />
          <span>إضافة خامة جديدة</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="بحث باسم الخامة، المورد، أو الفئة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-10 pl-4 py-2 rounded-lg border border-slate-200 focus:outline-none focus:ring-2 focus:ring-[#147D73]/20 focus:border-[#147D73] text-sm"
          />
        </div>

        {/* Categories Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-colors ${
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

      {/* Ingredients Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredIngredients.map(ing => (
          <div
            key={ing.id}
            className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
          >
            <div>
              {/* Top Row: Name and Category */}
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <h3 className="font-black text-lg text-[#172D36]">{ing.nameAr}</h3>
                  <div className="text-xs text-slate-400 font-sans">{ing.nameEn}</div>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                  {ing.category}
                </span>
              </div>

              {/* Price Row */}
              <div className="my-3 p-3 bg-[#FAFBF9] rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-slate-500 font-medium">سعر الشراء الحالي</div>
                  <div className="text-xl font-black text-[#172D36]">
                    {ing.currentPrice} <span className="text-sm font-bold text-[#147D73]">ج</span>
                    <span className="text-xs font-normal text-slate-500 mr-1">/ {ing.purchaseUnit}</span>
                  </div>
                </div>

                <div className="text-left">
                  <div className="text-[11px] text-slate-500 font-medium">تكلفة الوحدة الصافية</div>
                  <div className="text-sm font-extrabold text-slate-700 font-mono">
                    {ing.pricePerBaseUnit.toFixed(4)} ج / {ing.baseUnit}
                  </div>
                </div>
              </div>

              {/* Yield & Peeling Info */}
              <div className="space-y-1.5 text-xs text-slate-600 mb-4">
                <div className="flex justify-between">
                  <span>نسبة الهدر والتقشير:</span>
                  <span className={`font-bold ${ing.wastePercentage > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
                    %{ing.wastePercentage} (صافي صالح: %{ing.usableYieldPercent})
                  </span>
                </div>
                {ing.supplier && (
                  <div className="flex justify-between">
                    <span>المورد:</span>
                    <span className="font-semibold text-slate-800">{ing.supplier}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>آخر تحديث:</span>
                  <span className="text-slate-500">{ing.lastUpdated}</span>
                </div>
              </div>

              {ing.notes && (
                <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded-lg border border-slate-100 mb-4">
                  {ing.notes}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
              <button
                onClick={() => handleOpenQuickPrice(ing)}
                className="flex-1 inline-flex items-center justify-center gap-1.5 bg-[#147D73]/10 hover:bg-[#147D73] text-[#147D73] hover:text-white py-2 px-3 rounded-lg text-xs font-extrabold transition-all"
              >
                <TrendingUp className="w-3.5 h-3.5" />
                <span>تحديث السعر</span>
              </button>

              <button
                onClick={() => handleOpenEditIngredient(ing)}
                className="p-2 text-slate-500 hover:text-[#172D36] hover:bg-slate-100 rounded-lg transition-colors"
                title="تعديل البيانات الكاملة"
              >
                <Edit2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => deleteIngredient(ing.id)}
                className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                title="حذف الخامة"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

          </div>
        ))}
      </div>

      {/* QUICK PRICE UPDATE MODAL */}
      {isPriceModalOpen && activeIngredient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-lg text-[#172D36]">
                تحديث سعر: {activeIngredient.nameAr}
              </h3>
              <button 
                onClick={() => setIsPriceModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickPrice} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  السعر الجديد ({activeIngredient.purchaseUnit}) بالجنيه
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={newPriceInput || ''}
                  onChange={(e) => setNewPriceInput(parseFloat(e.target.value) || 0)}
                  className="w-full px-4 py-2.5 rounded-lg border border-slate-300 font-black text-lg focus:ring-2 focus:ring-[#147D73] focus:outline-none"
                />
                <div className="text-[11px] text-slate-500 mt-1">
                  السعر السابق: {activeIngredient.currentPrice} ج
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  ملاحظة التحديث (اختياري)
                </label>
                <input
                  type="text"
                  placeholder="مثال: ارتفاع سعر سوق العبور اليوم"
                  value={priceNoteInput}
                  onChange={(e) => setPriceNoteInput(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:border-[#147D73]"
                />
              </div>

              {/* Price History Preview */}
              {activeIngredient.priceHistory.length > 0 && (
                <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-100 max-h-36 overflow-y-auto">
                  <div className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1">
                    <History className="w-3.5 h-3.5 text-[#147D73]" />
                    <span>سجل الأسعار السابقة</span>
                  </div>
                  <div className="space-y-1.5 text-xs text-slate-600">
                    {activeIngredient.priceHistory.map((item, idx) => (
                      <div key={idx} className="flex justify-between items-center py-0.5 border-b border-slate-100 last:border-none">
                        <span>{item.date}</span>
                        <span className="font-bold text-slate-800">{item.price} ج</span>
                        <span className="text-slate-400 text-[10px]">{item.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 bg-[#147D73] hover:bg-[#106961] text-white py-2.5 rounded-xl font-bold text-sm shadow transition-all"
                >
                  حفظ وتحديث كل الوصفات
                </button>
                <button
                  type="button"
                  onClick={() => setIsPriceModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-100"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FULL INGREDIENT EDIT / CREATE MODAL */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-4">
              <h3 className="font-extrabold text-xl text-[#172D36]">
                {activeIngredient ? 'تعديل بيانات الخامة' : 'إضافة خامة جديدة للنظام'}
              </h3>
              <button 
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveFullIngredient} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم بالعربية *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: مانجو عويس"
                    value={formData.nameAr || ''}
                    onChange={(e) => setFormData({ ...formData, nameAr: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:border-[#147D73] focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">الاسم بالإنجليزية</label>
                  <input
                    type="text"
                    placeholder="e.g. Mango"
                    value={formData.nameEn || ''}
                    onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:border-[#147D73] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as IngredientCategory })}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:border-[#147D73] focus:outline-none"
                  >
                    {categories.filter(c => c !== 'الكل').map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">المورد</label>
                  <input
                    type="text"
                    placeholder="مثال: سوق العبور / تاجر جملة"
                    value={formData.supplier || ''}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:border-[#147D73] focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">وحدة الشراء</label>
                  <select
                    value={formData.purchaseUnit}
                    onChange={(e) => setFormData({ ...formData, purchaseUnit: e.target.value as UnitType })}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:border-[#147D73] focus:outline-none"
                  >
                    <option value="kg">كيلوجرام (kg)</option>
                    <option value="g">جرام (g)</option>
                    <option value="l">لتر (l)</option>
                    <option value="ml">مليلتر (ml)</option>
                    <option value="bundle">رابطة / حزمة (bundle)</option>
                    <option value="box">صندوق / كرتونة (box)</option>
                    <option value="bag">شيكارة / كيس (bag)</option>
                    <option value="piece">قطعة (piece)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">عدد القطع بالعبوة</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.packageSize || 1}
                    onChange={(e) => setFormData({ ...formData, packageSize: parseFloat(e.target.value) || 1 })}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:border-[#147D73] focus:outline-none"
                  />
                  <span className="text-[10px] text-slate-400">مثال: الرابطة بها 8 عيدان قصب</span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">سعر الشراء بالجنيه *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.currentPrice || ''}
                    onChange={(e) => setFormData({ ...formData, currentPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm font-bold focus:border-[#147D73] focus:outline-none"
                  />
                </div>
              </div>

              {/* Usable Yield & Peeling Loss */}
              <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/60">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-amber-900">
                    نسبة الصافي الصالح للأكل بعد التقشير والهدر (%)
                  </label>
                  <span className="text-xs font-black text-amber-900">
                    %{formData.usableYieldPercent || 100}
                  </span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={formData.usableYieldPercent || 100}
                  onChange={(e) => {
                    const y = parseInt(e.target.value);
                    setFormData({ 
                      ...formData, 
                      usableYieldPercent: y,
                      wastePercentage: 100 - y
                    });
                  }}
                  className="w-full accent-[#147D73]"
                />
                <div className="flex justify-between text-[11px] text-amber-800 mt-1">
                  <span>نسبة الهدر: %{100 - (formData.usableYieldPercent || 100)}</span>
                  <span>(تعديل التكلفة الصافية للجرام تلقائياً)</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">ملاحظات التشغيل والقياس</label>
                <textarea
                  rows={2}
                  placeholder="ملاحظات فنية أو قياسات معملية..."
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-lg border border-slate-300 text-sm focus:border-[#147D73] focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  className="flex-1 bg-[#147D73] hover:bg-[#106961] text-white py-2.5 rounded-xl font-bold text-sm shadow transition-all"
                >
                  حفظ بيانات الخامة
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
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
