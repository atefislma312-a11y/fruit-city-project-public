import React from 'react';
import { useApp } from '../../context/AppContext';
import { PlusCircle } from 'lucide-react';

export const SubHeader: React.FC = () => {
  const { setIsAddProductModalOpen } = useApp();

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-6 pt-2 border-b border-slate-200 mb-6 gap-4">
      {/* Title & Subtitle (Right side in RTL) */}
      <div>
        <div className="text-xs sm:text-sm font-semibold text-[#147D73] tracking-wide mb-1">
          لوحة إدارة التكلفة والأرباح
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#172D36] tracking-tight">
          نظرة عامة على المنتجات
        </h1>
      </div>

      {/* Action Button: + إضافة مشروب (Left side in RTL) */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setIsAddProductModalOpen(true)}
          className="inline-flex items-center gap-2 bg-[#147D73] hover:bg-[#106961] active:bg-[#0c534d] text-white px-5 py-2.5 rounded-full font-bold text-sm shadow-md hover:shadow-lg transition-all duration-150 ring-2 ring-[#147D73]/20"
        >
          <PlusCircle className="w-5 h-5 text-white" />
          <span>إضافة مشروب جديد</span>
        </button>
      </div>
    </div>
  );
};
