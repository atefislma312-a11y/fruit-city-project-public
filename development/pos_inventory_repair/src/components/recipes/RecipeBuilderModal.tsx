import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, Recipe, RecipeIngredientItem, UnitType, RecipeMethod } from '../../types';
import { 
  calculateRecipeItemCost, 
  calculateBatchCost, 
  calculateRawCostPerLiter, 
  calculateServingBreakdown,
  roundMoney
} from '../../engine/costingEngine';
import { 
  X, 
  Plus, 
  Trash2, 
  AlertTriangle, 
  Check, 
  Sparkles, 
  Scale, 
  DollarSign, 
  Info,
  Flame
} from 'lucide-react';

export const RecipeBuilderModal: React.FC = () => {
  const { 
    isAddProductModalOpen, 
    setIsAddProductModalOpen, 
    ingredients, 
    ingredientsMap, 
    saveProduct,
    editingProduct,
    setEditingProduct,
    editingRecipe,
    setEditingRecipe
  } = useApp();

  // Basic Product Info
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [category, setCategory] = useState('عصائر طبيعية');
  
  // Recipe Details
  const [method, setMethod] = useState<RecipeMethod>('batch');
  const [batchYieldMl, setBatchYieldMl] = useState<number>(1000);
  const [ingredientsRows, setIngredientsRows] = useState<RecipeIngredientItem[]>([
    { ingredientId: ingredients[0]?.id || '', quantity: 1, unit: 'kg' }
  ]);
  
  // Packaging & Pricing
  const [price400ml, setPrice400ml] = useState<number>(40);
  const [price1L, setPrice1L] = useState<number>(70);
  const [packaging400ml, setPackaging400ml] = useState<number>(4);
  const [packaging1L, setPackaging1L] = useState<number>(6);
  
  // Status flags
  const [isComplete, setIsComplete] = useState<boolean>(true);
  const [incompleteReason, setIncompleteReason] = useState<string>('');
  const [safetyNotes, setSafetyNotes] = useState<string>('');
  const [marketingAlert, setMarketingAlert] = useState<string>('');

  // Load existing product & recipe when editing
  useEffect(() => {
    if (editingProduct) {
      setNameAr(editingProduct.nameAr);
      setNameEn(editingProduct.nameEn);
      setCategory(editingProduct.category);
      setPrice400ml(editingProduct.prices['400ml'] || 0);
      setPrice1L(editingProduct.prices['1L'] || 0);
      setPackaging400ml(editingProduct.packaging['400ml'] || 4);
      setPackaging1L(editingProduct.packaging['1L'] || 6);
      setIsComplete(editingProduct.isComplete);
      setIncompleteReason(editingProduct.incompleteNotes || '');

      if (editingRecipe) {
        setMethod(editingRecipe.method);
        setBatchYieldMl(editingRecipe.batchYieldMl || 1000);
        setIngredientsRows(editingRecipe.ingredients.length > 0 ? editingRecipe.ingredients : [
          { ingredientId: ingredients[0]?.id || '', quantity: 1, unit: 'kg' }
        ]);
        setSafetyNotes(editingRecipe.safetyNotes || '');
        setMarketingAlert(editingRecipe.marketingAlert || '');
      }
    } else {
      // Defaults for brand new drink
      setNameAr('');
      setNameEn('');
      setCategory('عصائر طبيعية');
      setMethod('batch');
      setBatchYieldMl(1000);
      setIngredientsRows([
        { ingredientId: ingredients[0]?.id || '', quantity: 1, unit: 'kg' }
      ]);
      setPrice400ml(40);
      setPrice1L(70);
      setPackaging400ml(4);
      setPackaging1L(6);
      setIsComplete(true);
      setIncompleteReason('');
      setSafetyNotes('');
      setMarketingAlert('');
    }
  }, [editingProduct, editingRecipe, ingredients]);

  // Sugar detector
  const hasAddedSugar = useMemo(() => {
    return ingredientsRows.some(row => {
      const ing = ingredientsMap[row.ingredientId];
      return ing && (ing.id.includes('sugar') || ing.nameAr.includes('سكر') || ing.category === 'سكريات ومحليات');
    });
  }, [ingredientsRows, ingredientsMap]);

  // Real-time batch calculation
  const calculatedBatch = useMemo(() => {
    let totalBatchCost = 0;
    const itemsCostList = ingredientsRows.map(row => {
      const ing = ingredientsMap[row.ingredientId];
      if (!ing) return { ...row, cost: 0, nameAr: '' };
      const cost = calculateRecipeItemCost(row.quantity, row.unit, ing);
      totalBatchCost += cost;
      return {
        ...row,
        cost,
        nameAr: ing.nameAr
      };
    });

    const rawCostPerLiter = method === 'batch' 
      ? calculateRawCostPerLiter(totalBatchCost, batchYieldMl)
      : totalBatchCost; // if per_serving

    // 400ml preview
    const preview400ml = calculateServingBreakdown({
      sizeLabel: '400ml',
      servingMl: 400,
      rawCostPerLiter: method === 'batch' ? rawCostPerLiter : 0,
      packagingCost: packaging400ml,
      sellingPrice: price400ml,
      isComplete,
      directServingRawCost: method === 'per_serving' ? totalBatchCost : undefined
    });

    // 1L preview
    const preview1L = calculateServingBreakdown({
      sizeLabel: '1L',
      servingMl: 1000,
      rawCostPerLiter: method === 'batch' ? rawCostPerLiter : 0,
      packagingCost: packaging1L,
      sellingPrice: price1L,
      isComplete,
      directServingRawCost: method === 'per_serving' ? roundMoney(totalBatchCost * 2.5) : undefined
    });

    return {
      totalBatchCost: roundMoney(totalBatchCost),
      rawCostPerLiter,
      itemsCostList,
      preview400ml,
      preview1L
    };
  }, [ingredientsRows, ingredientsMap, method, batchYieldMl, packaging400ml, price400ml, packaging1L, price1L, isComplete]);

  // Row manipulation
  const handleAddIngredientRow = () => {
    setIngredientsRows(prev => [
      ...prev,
      { ingredientId: ingredients[0]?.id || '', quantity: 1, unit: 'kg' }
    ]);
  };

  const handleRemoveIngredientRow = (index: number) => {
    setIngredientsRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpdateRow = (index: number, field: keyof RecipeIngredientItem, val: any) => {
    setIngredientsRows(prev => prev.map((row, i) => (i === index ? { ...row, [field]: val } : row)));
  };

  const handleClose = () => {
    setIsAddProductModalOpen(false);
    setEditingProduct(null);
    setEditingRecipe(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nameAr.trim()) return;

    const productId = editingProduct ? editingProduct.id : `prod_${Date.now()}`;
    const recipeId = editingRecipe ? editingRecipe.id : `rec_${Date.now()}`;

    const newRecipe: Recipe = {
      id: recipeId,
      productId,
      nameAr,
      method,
      ingredients: ingredientsRows,
      batchYieldMl: method === 'batch' ? Number(batchYieldMl) : 400,
      isComplete,
      incompleteReason: !isComplete ? incompleteReason || 'يحتاج قياسات تكميلية' : undefined,
      hasAddedSugar,
      marketingAlert: marketingAlert || (hasAddedSugar ? 'تحتوي على سكر مضاف — لا تعلن بدون سكر' : 'عصير طبيعي بدون سكر مضاف'),
      safetyNotes: safetyNotes || undefined,
      lastUpdated: new Date().toISOString().split('T')[0]
    };

    const newProduct: Product = {
      id: productId,
      nameAr,
      nameEn: nameEn || nameAr,
      category,
      recipeId,
      prices: {
        '400ml': Number(price400ml) || 0,
        '1L': Number(price1L) || 0
      },
      packaging: {
        '400ml': Number(packaging400ml) || 4,
        '1L': Number(packaging1L) || 6
      },
      servingMl: {
        '400ml': 400,
        '1L': 1000
      },
      isComplete,
      incompleteNotes: !isComplete ? incompleteReason : undefined,
      safetyNotice: safetyNotes || undefined
    };

    saveProduct(newProduct, newRecipe);
    handleClose();
  };

  if (!isAddProductModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl max-w-4xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8 max-h-[92vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between pb-5 border-b border-slate-100 mb-6">
          <div>
            <div className="text-xs font-bold text-[#147D73] mb-0.5">منشئ ومصمم الوصفات الذكي</div>
            <h2 className="text-2xl font-black text-[#172D36]">
              {editingProduct ? `تعديل مشروب: ${editingProduct.nameAr}` : 'إضافة مشروب جديد وحساب التكلفة'}
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <form onSubmit={handleSave} className="space-y-6">
          
          {/* Drink Basics */}
          <div className="bg-[#FAFBF9] p-5 rounded-2xl border border-slate-100">
            <h3 className="text-sm font-extrabold text-[#172D36] mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#C59A45]" />
              <span>البيانات الأساسية للمشروب</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المشروب بالعربية *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: كوكتيل فروت سيتي"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:border-[#147D73] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الاسم بالإنجليزية</label>
                <input
                  type="text"
                  placeholder="Fruit City Mix"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#147D73] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">التصنيف</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:border-[#147D73] focus:outline-none"
                >
                  <option value="عصائر طبيعية">عصائر طبيعية</option>
                  <option value="مشروبات تقليدية">مشروبات تقليدية</option>
                  <option value="مشروبات شعبية">مشروبات شعبية</option>
                  <option value="سموذي وميكسات">سموذي وميكسات</option>
                  <option value="إضافات وتشكيلات">إضافات وتشكيلات</option>
                </select>
              </div>
            </div>

            {/* Recipe Method & Yield */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-200/60">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">طريقة احتساب الوصفة</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setMethod('batch')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      method === 'batch'
                        ? 'bg-[#147D73] text-white border-[#147D73]'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    تشغيلة مجمعة (Batch)
                  </button>
                  <button
                    type="button"
                    onClick={() => setMethod('per_serving')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                      method === 'per_serving'
                        ? 'bg-[#147D73] text-white border-[#147D73]'
                        : 'bg-white text-slate-600 border-slate-200'
                    }`}
                  >
                    بالكوب الفردي (Per Serving)
                  </button>
                </div>
              </div>

              {method === 'batch' && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    عائد العصير الصافي المحضر (مليلتر) *
                  </label>
                  <input
                    type="number"
                    required
                    min="100"
                    step="50"
                    placeholder="مثال: 1800 مل للجوافة، 10000 للسوبيا"
                    value={batchYieldMl || ''}
                    onChange={(e) => setBatchYieldMl(parseFloat(e.target.value) || 0)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-bold focus:border-[#147D73] focus:outline-none"
                  />
                  <div className="text-[11px] text-slate-500 mt-1">
                    يعادل: {((batchYieldMl || 0) / 1000).toFixed(2)} لتر جاهز للتقديم
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Ingredient Rows */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-extrabold text-[#172D36] flex items-center gap-1.5">
                  <Scale className="w-4 h-4 text-[#147D73]" />
                  <span>مكونات الوصفة والكميات</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  أضف أي عدد من المكونات (فواكه، مياه، سكر، إضافات، ثلج) مع دعم أجزاء القطع (نصف/ربع)
                </p>
              </div>

              <button
                type="button"
                onClick={handleAddIngredientRow}
                className="inline-flex items-center gap-1.5 bg-[#147D73]/10 hover:bg-[#147D73] text-[#147D73] hover:text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة مكوّن</span>
              </button>
            </div>

            <div className="space-y-3">
              {ingredientsRows.map((row, index) => {
                const selectedIng = ingredientsMap[row.ingredientId];
                const rowCost = selectedIng ? calculateRecipeItemCost(row.quantity, row.unit, selectedIng) : 0;

                return (
                  <div 
                    key={index} 
                    className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-200/80"
                  >
                    {/* Ingredient Selector */}
                    <div className="flex-1">
                      <select
                        value={row.ingredientId}
                        onChange={(e) => handleUpdateRow(index, 'ingredientId', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-bold bg-white focus:outline-none focus:border-[#147D73]"
                      >
                        {ingredients.map(ing => (
                          <option key={ing.id} value={ing.id}>
                            {ing.nameAr} ({ing.currentPrice} ج / {ing.purchaseUnit})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Quantity */}
                    <div className="w-full sm:w-28">
                      <input
                        type="number"
                        step="0.05"
                        min="0.01"
                        value={row.quantity || ''}
                        onChange={(e) => handleUpdateRow(index, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs font-black text-center bg-white focus:outline-none focus:border-[#147D73]"
                        placeholder="الكمية"
                      />
                    </div>

                    {/* Unit */}
                    <div className="w-full sm:w-28">
                      <select
                        value={row.unit}
                        onChange={(e) => handleUpdateRow(index, 'unit', e.target.value as UnitType)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs bg-white focus:outline-none focus:border-[#147D73]"
                      >
                        <option value="kg">كيلوجرام (kg)</option>
                        <option value="g">جرام (g)</option>
                        <option value="l">لتر (l)</option>
                        <option value="ml">مليلتر (ml)</option>
                        <option value="piece">قطعة كاملة</option>
                        <option value="bundle">رابطة</option>
                      </select>
                    </div>

                    {/* Row Cost Preview */}
                    <div className="w-full sm:w-28 text-center sm:text-left font-black text-xs text-[#172D36]">
                      {rowCost.toFixed(2)} ج
                    </div>

                    {/* Delete Row */}
                    <button
                      type="button"
                      disabled={ingredientsRows.length <= 1}
                      onClick={() => handleRemoveIngredientRow(index)}
                      className="p-2 text-slate-400 hover:text-rose-600 disabled:opacity-30 rounded-lg hover:bg-white transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Added Sugar Alert */}
            {hasAddedSugar && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  <strong>تنبيه السكر المضاف:</strong> تم رصد سكر في هذه الوصفة. يُمنع قانونياً وتسويقياً وضع ملصق "خالٍ من السكر".
                </span>
              </div>
            )}
          </div>

          {/* Pricing & Packaging Inputs */}
          <div className="bg-[#FAFBF9] p-5 rounded-2xl border border-slate-200">
            <h3 className="text-sm font-extrabold text-[#172D36] mb-4 flex items-center gap-1.5">
              <DollarSign className="w-4 h-4 text-[#147D73]" />
              <span>أسعار البيع ومصاريف التعبئة والتغليف</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              
              {/* 400ml Inputs */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="font-extrabold text-[#147D73] text-sm border-b pb-2">
                  كوب 400 مل
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">سعر البيع المقترح (ج)</label>
                  <input
                    type="number"
                    step="1"
                    value={price400ml || ''}
                    onChange={(e) => setPrice400ml(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">تكلفة التعبئة (كوب + غطاء + شفاطة) (ج)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={packaging400ml || ''}
                    onChange={(e) => setPackaging400ml(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-sm"
                  />
                </div>
              </div>

              {/* 1L Inputs */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 space-y-3">
                <div className="font-extrabold text-[#172D36] text-sm border-b pb-2">
                  زجاجة 1 لتر
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">سعر البيع المقترح (ج)</label>
                  <input
                    type="number"
                    step="1"
                    value={price1L || ''}
                    onChange={(e) => setPrice1L(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">تكلفة التعبئة (زجاجة + غطاء + استيكر) (ج)</label>
                  <input
                    type="number"
                    step="0.5"
                    value={packaging1L || ''}
                    onChange={(e) => setPackaging1L(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 font-bold text-sm"
                  />
                </div>
              </div>

            </div>
          </div>

          {/* REAL-TIME COST & MARGIN PREVIEW (Crucial Requirement) */}
          <div className="bg-gradient-to-br from-[#172D36] to-[#0F2229] text-white p-5 rounded-2xl shadow-lg border border-[#2A4D5C]">
            <div className="flex items-center justify-between mb-4 border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-[#C59A45]" />
                <span className="font-black text-sm text-[#FAF6EE]">نتائج الحساب الفوري للأرباح والهوامش</span>
              </div>
              <span className="text-xs bg-[#147D73] px-3 py-1 rounded-full font-bold">
                حساب آلي فوري
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="text-[11px] text-slate-300">تكلفة التشغيلة الإجمالية</div>
                <div className="text-xl font-black text-white mt-1">
                  {calculatedBatch.totalBatchCost.toFixed(2)} ج
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="text-[11px] text-slate-300">تكلفة اللتر الخام</div>
                <div className="text-xl font-black text-white mt-1">
                  {calculatedBatch.rawCostPerLiter.toFixed(2)} ج/لتر
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="text-[11px] text-emerald-300">ربح الكوب 400 مل</div>
                <div className="text-xl font-black text-emerald-400 mt-1">
                  {calculatedBatch.preview400ml.contribution.toFixed(2)} ج
                </div>
                <div className="text-[10px] text-emerald-200 mt-0.5">
                  هامش: %{calculatedBatch.preview400ml.contributionMarginPercent}
                </div>
              </div>

              <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="text-[11px] text-emerald-300">ربح الزجاجة 1 لتر</div>
                <div className="text-xl font-black text-emerald-400 mt-1">
                  {calculatedBatch.preview1L.contribution.toFixed(2)} ج
                </div>
                <div className="text-[10px] text-emerald-200 mt-0.5">
                  هامش: %{calculatedBatch.preview1L.contributionMarginPercent}
                </div>
              </div>
            </div>
          </div>

          {/* Validation & Completion Status */}
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="isCompleteCheck"
                checked={isComplete}
                onChange={(e) => setIsComplete(e.target.checked)}
                className="w-4 h-4 accent-[#147D73] rounded"
              />
              <label htmlFor="isCompleteCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                الوصفة مكتملة ومقاسة معملياً ومعتمدة للتشغيل الفعلي
              </label>
            </div>

            {!isComplete && (
              <div>
                <label className="block text-xs font-bold text-amber-800 mb-1">
                  سبب عدم الاكتمال (سيظهر كشعار تحذيري على لوحة التحكم)
                </label>
                <input
                  type="text"
                  placeholder="مثال: كميات الأسانس غير مقاسة بدقة، أو صافي العصير لم يحدد"
                  value={incompleteReason}
                  onChange={(e) => setIncompleteReason(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-amber-300 text-xs text-amber-900 bg-amber-50/50"
                />
              </div>
            )}
          </div>

          {/* Submit Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-slate-100">
            <button
              type="submit"
              className="flex-1 bg-[#147D73] hover:bg-[#106961] text-white py-3 rounded-2xl font-black text-sm shadow-md transition-all"
            >
              حفظ المشروب والوصفة واعتماد التكاليف
            </button>
            <button
              type="button"
              onClick={handleClose}
              className="px-6 py-3 rounded-2xl border border-slate-300 text-slate-600 font-bold text-sm hover:bg-slate-100"
            >
              إلغاء
            </button>
          </div>

        </form>

      </div>
    </div>
  );
};
