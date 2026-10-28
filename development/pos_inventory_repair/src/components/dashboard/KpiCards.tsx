import React from 'react';
import { useApp } from '../../context/AppContext';
import { Coffee, Coins, TrendingUp, AlertTriangle } from 'lucide-react';

export const KpiCards: React.FC = () => {
  const { 
    products, 
    totalMonthlyExpenses, 
    averageContributionMargin, 
    incompleteRecipesCount,
    setActiveTab
  } = useApp();

  const formattedExpenses = new Intl.NumberFormat('en-US').format(totalMonthlyExpenses);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      
      {/* 1. المنتجات المسجلة (Matches Screenshot: 10) */}
      <div 
        onClick={() => setActiveTab('products')}
        className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500">المنتجات المسجلة</span>
          <div className="w-9 h-9 rounded-xl bg-teal-50 flex items-center justify-center text-[#147D73] group-hover:bg-[#147D73] group-hover:text-white transition-colors">
            <Coffee className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-black text-[#172D36]">
            {products.length}
          </div>
          <span className="text-xs font-medium text-slate-500">مشروب</span>
        </div>
        <div className="mt-2 text-xs text-slate-500 font-medium flex items-center gap-1.5">
          <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
          <span>منها {products.length - incompleteRecipesCount} وصفات معتمدة</span>
        </div>
      </div>

      {/* 2. ميزانية التشغيل (Matches Screenshot: 61,050 ج المخططة شهرياً) */}
      <div 
        onClick={() => setActiveTab('expenses')}
        className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500">ميزانية التشغيل</span>
          <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center text-[#C59A45] group-hover:bg-[#C59A45] group-hover:text-white transition-colors">
            <Coins className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline gap-1.5">
          <div className="text-3xl font-black text-[#172D36]">
            {formattedExpenses}
          </div>
          <span className="text-base font-bold text-[#147D73]">ج</span>
        </div>
        <div className="mt-2 text-xs text-slate-500 font-medium">
          المخططة شهرياً (تشمل 10,000 ج راتب الإدارة)
        </div>
      </div>

      {/* 3. متوسط هامش المساهمة */}
      <div 
        onClick={() => setActiveTab('reports')}
        className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500">متوسط هامش المساهمة</span>
          <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
            <TrendingUp className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline gap-1">
          <div className="text-3xl font-black text-[#172D36]">
            %{averageContributionMargin}
          </div>
        </div>
        <div className="mt-2 text-xs text-emerald-700 font-medium">
          نسبة الربح المباشر قبل خصم المصاريف الثابتة
        </div>
      </div>

      {/* 4. وصفات تحتاج استكمال */}
      <div 
        onClick={() => setActiveTab('recipes')}
        className={`bg-white rounded-2xl p-5 border shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group ${
          incompleteRecipesCount > 0 ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200/80'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-semibold text-slate-500">وصفات تحتاج استكمال</span>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-colors ${
            incompleteRecipesCount > 0 
              ? 'bg-amber-100 text-amber-700 group-hover:bg-amber-600 group-hover:text-white' 
              : 'bg-slate-100 text-slate-500'
          }`}>
            <AlertTriangle className="w-5 h-5" />
          </div>
        </div>
        <div className="flex items-baseline gap-2">
          <div className={`text-3xl font-black ${incompleteRecipesCount > 0 ? 'text-amber-700' : 'text-slate-700'}`}>
            {incompleteRecipesCount}
          </div>
          <span className="text-xs font-medium text-slate-500">وصفات قيد القياس</span>
        </div>
        <div className="mt-2 text-xs text-amber-800 font-medium">
          {incompleteRecipesCount > 0 ? 'تتطلب قياسات معملية واعتماد' : 'كافة الوصفات معتمدة'}
        </div>
      </div>

    </div>
  );
};
