import React, { useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { generateSQLiteScript } from '../../data/storage';
import { 
  Download, 
  Upload, 
  Database, 
  RotateCcw, 
  ShieldCheck, 
  Smartphone, 
  QrCode, 
  Cloud, 
  CheckCircle2, 
  FileCode,
  Store,
  Layers
} from 'lucide-react';

export const SettingsView: React.FC = () => {
  const { 
    ingredients, 
    recipes, 
    products, 
    expenses, 
    invoices,
    orders,
    payments,
    cashierAccounts,
    shifts,
    paymentFeeRules,
    promotions,
    refunds,
    drinkWastes,
    approvalRequests,
    managerPin,
    exportBackup, 
    importBackup, 
    resetToDefaults, 
    showToast 
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        importBackup(content);
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleExportSQLite = () => {
    const sql = generateSQLiteScript({ 
      ingredients, 
      recipes, 
      products, 
      expenses, 
      invoices,
      orders,
      payments,
      cashierAccounts,
      shifts,
      paymentFeeRules,
      promotions,
      refunds,
      drinkWastes,
      approvalRequests,
      managerPin
    });
    const blob = new Blob([sql], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fruit_city_database_${new Date().toISOString().split('T')[0]}.sql`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('تم تصدير ملف سكريبت SQLite بنجاح');
  };

  return (
    <div className="space-y-8">
      
      {/* Title */}
      <div className="pb-4 border-b border-slate-200">
        <h2 className="text-2xl font-black text-[#172D36]">الإعدادات والنسخ الاحتياطي وخريطة المستقبل</h2>
        <p className="text-xs text-slate-500 mt-1">
          إدارة حفظ واسترجاع بيانات المحل دون اتصال بالإنترنت، ووثائق التوسع المستقبلي
        </p>
      </div>

      {/* Backup and Restore Box */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <h3 className="text-lg font-black text-[#172D36] mb-2 flex items-center gap-2">
          <Database className="w-5 h-5 text-[#147D73]" />
          <span>النسخ الاحتياطي وتصدير قاعدة البيانات (Offline Persistence)</span>
        </h3>
        <p className="text-xs text-slate-500 mb-6">
          يحفظ النظام كافة التعديلات في متصفح وجهاز الكاشير فورياً. يمكنك تنزيل نسخة احتياطية مشفرة ونقلها لأي جهاز آخر بأمان تام.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          
          {/* Download JSON Backup */}
          <button
            onClick={exportBackup}
            className="flex items-center justify-center gap-2.5 bg-[#147D73] hover:bg-[#106961] text-white p-4 rounded-xl font-bold text-sm shadow transition-all"
          >
            <Download className="w-5 h-5" />
            <span>تنزيل نسخة احتياطية (JSON)</span>
          </button>

          {/* Import Backup */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 p-4 rounded-xl font-bold text-sm transition-all border border-slate-300"
          >
            <Upload className="w-5 h-5 text-slate-600" />
            <span>استعادة نسخة احتياطية</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Export SQLite SQL */}
          <button
            onClick={handleExportSQLite}
            className="flex items-center justify-center gap-2.5 bg-[#172D36] hover:bg-[#203F4B] text-white p-4 rounded-xl font-bold text-sm shadow transition-all"
          >
            <FileCode className="w-5 h-5 text-[#C59A45]" />
            <span>تصدير قاعدة بيانات (SQLite DDL)</span>
          </button>

        </div>

        {/* Factory Reset */}
        <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="text-sm font-bold text-rose-800">إعادة ضبط المصنع واسترجاع وصفات البداية</div>
            <div className="text-xs text-slate-400">
              سيتم إعادة كافة الخامات والمنتجات والميزانية إلى الحالة الأولية المعتمدة لـ Fruit City
            </div>
          </div>

          {showResetConfirm ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  resetToDefaults();
                  setShowResetConfirm(false);
                }}
                className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg text-xs font-bold"
              >
                تأكيد إعادة الضبط
              </button>
              <button
                onClick={() => setShowResetConfirm(false)}
                className="bg-slate-200 text-slate-700 px-3 py-2 rounded-lg text-xs font-bold"
              >
                إلغاء
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowResetConfirm(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-rose-600 hover:text-rose-700 border border-rose-200 hover:bg-rose-50 px-4 py-2 rounded-lg transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>إعادة ضبط النظام</span>
            </button>
          )}
        </div>

      </div>

      {/* Future Roadmap & Architecture Document */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <Layers className="w-5 h-5 text-[#147D73]" />
          <h3 className="text-lg font-black text-[#172D36]">
            خريطة التطوير المعمارية للوحدات المستقبلية (Future Roadmap)
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-6">
          تم تصميم هيكل بيانات Fruit City Management System ليكون جاهزاً بالكامل للربط المستقبلي مع الأنظمة التالية:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-sm">
          
          {/* POS Cashier */}
          <div className="p-4 rounded-xl border border-slate-200 bg-[#FAFBF9]">
            <div className="flex items-center gap-2 font-black text-[#172D36] mb-2">
              <Store className="w-4 h-4 text-[#147D73]" />
              <span>1. كاشير ونقاط البيع السريعة (POS)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              شاشة لمس سريعة لطلب المشروبات وخصم المواد الخام من المخزن آلياً لكل كوب 400 مل أو زجاجة 1 لتر مباعة، مع طباعة الفواتير الحرارية (Receipts) ودعم طرق الدفع النقدي والإلكتروني (InstaPay / بطاقات).
            </p>
          </div>

          {/* QR Code Digital Menu */}
          <div className="p-4 rounded-xl border border-slate-200 bg-[#FAFBF9]">
            <div className="flex items-center gap-2 font-black text-[#172D36] mb-2">
              <QrCode className="w-4 h-4 text-[#C59A45]" />
              <span>2. منيو إلكتروني ذكي برمز الاستجابة (QR Menu)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              رابط وقائمة تفاعلية بالهوية البصرية لفروت سيتي تُعرض على هواتف الزبائن في وسط البلد لعرض المشروبات الطازجة ومكوناتها الطبيعية بشفافية تامة دون إظهار بيانات التكلفة الداخلية.
            </p>
          </div>

          {/* WhatsApp & Online Ordering */}
          <div className="p-4 rounded-xl border border-slate-200 bg-[#FAFBF9]">
            <div className="flex items-center gap-2 font-black text-[#172D36] mb-2">
              <Smartphone className="w-4 h-4 text-emerald-600" />
              <span>3. طلبات واتساب والأونلاين (WhatsApp Orders)</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              توليد رسائل طلب منسقة تلقائياً تُرسل إلى رقم واتساب المحل مع تفاصيل الحجم (400 مل / 1 لتر)، نسبة السكر المطلوبة، والإضافات، لتسريع خدمة عملاء الدليفري والتيك أواي.
            </p>
          </div>

          {/* Hybrid Cloud Sync Architecture */}
          <div className="p-4 rounded-xl border border-slate-200 bg-[#FAFBF9]">
            <div className="flex items-center gap-2 font-black text-[#172D36] mb-2">
              <Cloud className="w-4 h-4 text-blue-600" />
              <span>4. المزامنة السحابية الهجينة والفروع المتعددة</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              معمارية Local-First تعتمد على معرفات فريدة عالمياً (UUIDv4) لكل حركة أو تحديث سعر، ومزامنة في الخلفية عبر HTTPS WebSocket مع خوارزمية حل التعارضات (Last-Write-Wins / CRDT) لضمان العمل التام عند انقطاع الإنترنت.
            </p>
          </div>

        </div>
      </div>

    </div>
  );
};
