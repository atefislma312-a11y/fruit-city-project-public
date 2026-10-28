import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { 
  PurchaseInvoice, 
  PurchaseInvoiceItem, 
  PurchasePricingMethod,
  IngredientCategory 
} from '../../types';
import { 
  calculatePurchaseItemTotal, 
  calculateEffectiveKgPrice, 
  calculateInvoiceTotals 
} from '../../engine/purchaseEngine';
import * as XLSX from 'xlsx';
import { 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2, 
  Printer, 
  RotateCcw, 
  HelpCircle, 
  AlertCircle,
  Package,
  Scale,
  Sparkles,
  Info,
  FileSpreadsheet
} from 'lucide-react';

interface InvoiceEditorProps {
  initialInvoice?: PurchaseInvoice | null;
  onSaved?: (savedInvoice: PurchaseInvoice) => void;
}

export const InvoiceEditor: React.FC<InvoiceEditorProps> = ({ initialInvoice, onSaved }) => {
  const { 
    ingredients, 
    saveInvoice, 
    approveInvoice, 
    setPrintingInvoice, 
    showToast 
  } = useApp();

  const generateDefaultInvoiceNumber = () => {
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(100 + Math.random() * 900);
    return `INV-${todayStr}-${randomSuffix}`;
  };

  const createBlankItem = (): PurchaseInvoiceItem => {
    const firstFruit = ingredients.find(i => i.category === 'فواكه طازجة') || ingredients[0];
    return {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      ingredientId: firstFruit ? firstFruit.id : 'custom',
      ingredientNameAr: firstFruit ? firstFruit.nameAr : 'صنف جديد',
      ingredientCategory: firstFruit ? firstFruit.category : 'فواكه طازجة',
      pricingMethod: 'by_weight',
      packageCount: 1,
      packageUnitName: 'قفص',
      totalWeightKg: 10,
      unitPrice: 25,
      packageFee: 0,
      totalCost: 250,
      weightUnknown: false,
      notes: ''
    };
  };

  const [invoiceId, setInvoiceId] = useState<string>(initialInvoice?.id || `inv_${Date.now()}`);
  const [invoiceNumber, setInvoiceNumber] = useState<string>(initialInvoice?.invoiceNumber || generateDefaultInvoiceNumber());
  const [invoiceDate, setInvoiceDate] = useState<string>(initialInvoice?.invoiceDate || new Date().toISOString().split('T')[0]);
  const [supplierName, setSupplierName] = useState<string>(initialInvoice?.supplierName || 'سوق العبور / روض الفرج');
  const [notes, setNotes] = useState<string>(initialInvoice?.notes || '');
  const [status, setStatus] = useState<'draft' | 'approved' | 'reversed'>(initialInvoice?.status || 'draft');
  const [items, setItems] = useState<PurchaseInvoiceItem[]>(
    initialInvoice && initialInvoice.items.length > 0 
      ? initialInvoice.items 
      : [createBlankItem()]
  );

  const [validationError, setValidationError] = useState<string | null>(null);

  // Sync when initialInvoice prop changes
  useEffect(() => {
    if (initialInvoice) {
      setInvoiceId(initialInvoice.id);
      setInvoiceNumber(initialInvoice.invoiceNumber);
      setInvoiceDate(initialInvoice.invoiceDate);
      setSupplierName(initialInvoice.supplierName);
      setNotes(initialInvoice.notes || '');
      setStatus(initialInvoice.status);
      setItems(initialInvoice.items);
    }
  }, [initialInvoice]);

  // Recalculate invoice totals reactively
  const invoiceTotals = calculateInvoiceTotals(items);

  // Handle changing an item attribute
  const updateItem = (index: number, updates: Partial<PurchaseInvoiceItem>) => {
    setItems(prev => {
      const copy = [...prev];
      const target = { ...copy[index], ...updates };

      // Handle ingredient selection change
      if (updates.ingredientId && updates.ingredientId !== 'custom') {
        const found = ingredients.find(i => i.id === updates.ingredientId);
        if (found) {
          target.ingredientNameAr = found.nameAr;
          target.ingredientCategory = found.category;
          // default pricing unit based on ingredient unit
          if (found.purchaseUnit === 'piece' || found.purchaseUnit === 'bundle') {
            target.pricingMethod = 'by_piece';
            target.packageUnitName = found.purchaseUnit === 'bundle' ? 'رابطة' : 'قطعة';
          } else if (found.purchaseUnit === 'box' || found.purchaseUnit === 'bag') {
            target.pricingMethod = 'by_package';
            target.packageUnitName = found.purchaseUnit === 'box' ? 'كرتونة' : 'شيكارة';
          } else {
            target.pricingMethod = 'by_weight';
          }
        }
      } else if (updates.ingredientId === 'custom' || target.ingredientId === 'custom') {
        if (updates.ingredientNameAr !== undefined) {
          target.customIngredientName = updates.ingredientNameAr;
        }
        if (target.notes === 'سباطتين وزن إجمالي 90 كجم بسعر 30 ج للكيلو') {
          target.notes = '';
        }
      }

      // If method is changed to by_package without weight, mark weightUnknown
      if (updates.pricingMethod === 'by_package') {
        if (!target.totalWeightKg || target.totalWeightKg <= 0) {
          target.weightUnknown = true;
        }
      } else if (updates.pricingMethod === 'by_weight') {
        target.weightUnknown = false;
      }

      // If user inputs totalWeightKg, weight is known
      if (updates.totalWeightKg !== undefined && updates.totalWeightKg > 0) {
        target.weightUnknown = false;
      }

      // Recalculate line total cost using business logic
      target.totalCost = calculatePurchaseItemTotal(target);
      target.effectiveKgPrice = calculateEffectiveKgPrice(target) || undefined;

      copy[index] = target;
      return copy;
    });
  };

  const handleAddItem = () => {
    setItems(prev => [...prev, createBlankItem()]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      showToast('يجب أن تحتوي الفاتورة على صنف واحد على الأقل');
      return;
    }
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleResetForm = () => {
    setInvoiceId(`inv_${Date.now()}`);
    setInvoiceNumber(generateDefaultInvoiceNumber());
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setSupplierName('سوق العبور / روض الفرج');
    setNotes('');
    setStatus('draft');
    setItems([createBlankItem()]);
    setValidationError(null);
    showToast('تم فتح فاتورة مشتريات فارغة جديدة');
  };

  const validateInvoice = (): boolean => {
    setValidationError(null);
    if (!supplierName.trim()) {
      setValidationError('برجاء كتابة اسم المورد أو تاجر الجملة');
      return false;
    }
    if (!invoiceDate) {
      setValidationError('برجاء تحديد تاريخ الفاتورة');
      return false;
    }
    if (items.length === 0) {
      setValidationError('يجب إضافة صنف واحد على الأقل في الفاتورة');
      return false;
    }
    for (let i = 0; i < items.length; i++) {
      const itm = items[i];
      if (!itm.ingredientNameAr.trim()) {
        setValidationError(`الصنف رقم ${i + 1}: برجاء اختيار أو كتابة اسم الصنف`);
        return false;
      }
      if (itm.unitPrice <= 0) {
        setValidationError(`الصنف "${itm.ingredientNameAr}": يجب إدخال سعر وحدة أكبر من الصفر`);
        return false;
      }
      if (itm.pricingMethod === 'by_weight' && (!itm.totalWeightKg || itm.totalWeightKg <= 0)) {
        setValidationError(`الصنف "${itm.ingredientNameAr}": طريقة الشراء بالوزن تتطلب إدخال الوزن الإجمالي بالكيلو`);
        return false;
      }
      if ((itm.pricingMethod === 'by_package' || itm.pricingMethod === 'by_piece') && (!itm.packageCount || itm.packageCount <= 0)) {
        setValidationError(`الصنف "${itm.ingredientNameAr}": يجب إدخال عدد العبوات أو القطع`);
        return false;
      }
    }
    return true;
  };

  const buildInvoicePayload = (newStatus: 'draft' | 'approved' | 'reversed'): PurchaseInvoice => {
    return {
      id: invoiceId,
      invoiceNumber,
      invoiceDate,
      supplierName: supplierName.trim(),
      status: newStatus,
      items: items.map(itm => ({
        ...itm,
        totalCost: calculatePurchaseItemTotal(itm),
        effectiveKgPrice: calculateEffectiveKgPrice(itm) || undefined
      })),
      totalAmount: invoiceTotals.totalAmount,
      totalWeightKg: invoiceTotals.totalWeightKg,
      notes: notes.trim(),
      createdAt: initialInvoice?.createdAt || new Date().toISOString(),
      approvedAt: newStatus === 'approved' ? new Date().toISOString() : undefined
    };
  };

  // 1. Save as Draft (No inventory / cost change)
  const handleSaveDraft = () => {
    if (!validateInvoice()) return;
    const invoice = buildInvoicePayload('draft');
    saveInvoice(invoice);
    setStatus('draft');
    if (onSaved) onSaved(invoice);
  };

  // 2. Approve Invoice (Updates Inventory + WAC Costs + Linked Recipes)
  const handleApprove = () => {
    if (!validateInvoice()) return;
    
    // Call approve action with full invoice payload directly
    const invoice = buildInvoicePayload('draft');
    const res = approveInvoice(invoice);
    if (res.success) {
      setStatus('approved');
      if (onSaved) onSaved({ ...invoice, status: 'approved' });
    } else {
      setValidationError(res.message);
    }
  };

  // 3. Print current invoice
  const handlePrint = () => {
    const currentInvoice = buildInvoicePayload(status);
    setPrintingInvoice(currentInvoice);
  };

  // 4. Export current invoice to real Excel .xlsx file
  const handleExportExcel = () => {
    const currentInvoice = buildInvoicePayload(status);
    const rows = [
      ['FRUIT CITY MANAGEMENT SYSTEM — فاتورة مشتريات توريد'],
      ['فرع وسط البلد — القاهرة'],
      [''],
      ['رقم الفاتورة:', currentInvoice.invoiceNumber, 'تاريخ الشراء:', currentInvoice.invoiceDate],
      ['المورد / التاجر:', currentInvoice.supplierName, 'الحالة:', currentInvoice.status === 'approved' ? 'معتمدة' : (currentInvoice.status === 'draft' ? 'مسودة' : 'معكوسة')],
      ['ملاحظات التوريد:', currentInvoice.notes || '—'],
      [''],
      [
        'م',
        'اسم الصنف / الخامة',
        'طريقة الشراء',
        'العبوات',
        'الوزن الإجمالي (كجم)',
        'سعر الوحدة (ج.م)',
        'إجمالي الصنف (ج.م)',
        'تكلفة الكيلو الفعلية'
      ],
      ...currentInvoice.items.map((itm, idx) => [
        idx + 1,
        itm.ingredientNameAr,
        itm.pricingMethod === 'by_weight' ? 'بالوزن الإجمالي' : (itm.pricingMethod === 'by_package' ? 'بالعبوة' : 'بالقطعة'),
        itm.packageCount ? `${itm.packageCount} ${itm.packageUnitName || 'عبوة'}` : '—',
        itm.totalWeightKg ? `${itm.totalWeightKg} كجم` : '—',
        itm.unitPrice,
        itm.totalCost,
        calculateEffectiveKgPrice(itm) !== null ? `${calculateEffectiveKgPrice(itm)} ج/كجم` : 'غير محدد'
      ]),
      [''],
      ['', '', '', '', 'إجمالي عدد الأصناف:', currentInvoice.items.length],
      ['', '', '', '', 'إجمالي الوزن الصافي (كجم):', currentInvoice.totalWeightKg || 0],
      ['', '', '', '', 'إجمالي الفاتورة المطلوب (ج.م):', currentInvoice.totalAmount]
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'فاتورة مشتريات');
    XLSX.writeFile(wb, `فاتورة_مشتريات_${currentInvoice.invoiceNumber}.xlsx`);
    showToast(`تم تصدير ملف الإكسيل (${currentInvoice.invoiceNumber}.xlsx) وتنزيله بنجاح`);
  };

  // Load realistic wholesale market demo invoice (Populates table on screen)
  const handleLoadMarketExample = () => {
    setSupplierName('معلم عبده — وكالة الفاكهة (سوق العبور)');
    setNotes('طلبية الجملة الصباحية الأسبوعية — استلام فرع وسط البلد');
    setItems([
      {
        id: `demo_1_${Date.now()}`,
        ingredientId: 'ing_banana',
        ingredientNameAr: 'موز بلدي',
        ingredientCategory: 'فواكه طازجة',
        pricingMethod: 'by_weight',
        packageCount: 2,
        packageUnitName: 'سباطة',
        totalWeightKg: 90,
        unitPrice: 30,
        totalCost: 2700,
        weightUnknown: false,
        notes: 'سباطتين بإجمالي وزن 90 كجم بسعر 30 ج للكيلو'
      },
      {
        id: `demo_2_${Date.now()}`,
        ingredientId: 'ing_strawberry',
        ingredientNameAr: 'فراولة بلدي طازجة',
        ingredientCategory: 'فواكه طازجة',
        pricingMethod: 'by_weight',
        packageCount: 5,
        packageUnitName: 'قفص',
        totalWeightKg: 40,
        unitPrice: 50,
        totalCost: 2000,
        weightUnknown: false,
        notes: '5 أقفاص وزن إجمالي 40 كجم بسعر 50 ج/كجم'
      },
      {
        id: `demo_3_${Date.now()}`,
        ingredientId: 'ing_cane',
        ingredientNameAr: 'قصب سكر صعيدي',
        ingredientCategory: 'فواكه طازجة',
        pricingMethod: 'by_piece',
        packageCount: 4,
        packageUnitName: 'رابطة',
        totalWeightKg: 0,
        unitPrice: 85,
        totalCost: 340,
        weightUnknown: true,
        notes: '4 روابط قصب بسعر 85 ج للرابطة'
      },
      {
        id: `demo_4_${Date.now()}`,
        ingredientId: 'ing_milk_powder',
        ingredientNameAr: 'حليب بودرة نيوزيلندي',
        ingredientCategory: 'ألبان وكريمات',
        pricingMethod: 'by_package',
        packageCount: 1,
        packageUnitName: 'شيكارة',
        totalWeightKg: 25,
        unitPrice: 3500,
        totalCost: 3500,
        weightUnknown: false,
        notes: 'شيكارة 25 كجم مغلقة'
      }
    ]);
    showToast('تم تحميل نموذج فاتورة توريد واقعية من سوق الجملة');
  };

  const isApproved = status === 'approved';
  const isReversed = status === 'reversed';

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Quick Controls */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#147D73]/10 flex items-center justify-center text-[#147D73]">
                <Scale className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-[#172D36]">
                  فاتورة مشتريات توريد جديدة
                </h2>
                <p className="text-xs text-slate-500 font-medium">
                  تسجيل مشتريات سوق الجملة، حساب أوزان السبايط والأقفاص، وتحديث تكاليف الخامات آلياً
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleLoadMarketExample}
              disabled={isApproved}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-800 text-xs font-bold rounded-xl border border-amber-200 transition disabled:opacity-50"
              title="تعبئة الفاتورة الحالية على الشاشة بنموذج واقعي من سوق العبور"
            >
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>تعبئة نموذج سوق العبور (على الشاشة)</span>
            </button>

            <button
              onClick={handleExportExcel}
              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold rounded-xl border border-emerald-200 transition shadow-sm"
              title="تنزيل الفاتورة الحالية كملف Excel (.xlsx) على جهازك"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
              <span>تصدير إكسيل (Excel)</span>
            </button>

            <button
              onClick={handleResetForm}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>فاتورة جديدة</span>
            </button>

            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              <Printer className="w-4 h-4 text-[#C59A45]" />
              <span>طباعة</span>
            </button>
          </div>
        </div>

        {/* Status Alert Banner */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500">حالة الفاتورة:</span>
            {status === 'draft' && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 px-3 py-1 rounded-full border border-amber-300">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                مسودة (لم يتم ترحيلها للمخزون بعد)
              </span>
            )}
            {status === 'approved' && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-3 py-1 rounded-full border border-emerald-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                معتمدة (تم تحديث المخزون ومتوسط تكلفة الخامات المرجح)
              </span>
            )}
            {status === 'reversed' && (
              <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-800 bg-rose-100 px-3 py-1 rounded-full border border-rose-300">
                <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
                معكوسة (تم إلغاء أثرها المخزني)
              </span>
            )}
          </div>

          <div className="text-xs text-slate-500">
            رقم الفاتورة: <span className="font-mono font-bold text-slate-800">{invoiceNumber}</span>
          </div>
        </div>
      </div>

      {/* Invoice Meta Form */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80">
        <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-[#147D73]" />
          <span>بيانات المورد وتاريخ الشراء</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              اسم المورد / تاجر الجملة <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={supplierName}
              disabled={isApproved}
              onChange={e => setSupplierName(e.target.value)}
              placeholder="مثال: المعلم صبحي — وكالة الموز"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#147D73] disabled:opacity-60 font-medium"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              تاريخ الفاتورة <span className="text-rose-500">*</span>
            </label>
            <input
              type="date"
              value={invoiceDate}
              disabled={isApproved}
              onChange={e => setInvoiceDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#147D73] disabled:opacity-60 font-mono"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              ملاحظات التوريد أو السوق
            </label>
            <input
              type="text"
              value={notes}
              disabled={isApproved}
              onChange={e => setNotes(e.target.value)}
              placeholder="مثال: قطفة أولى، سداد نقدي من العهدة"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#147D73] disabled:opacity-60 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Validation Message if any */}
      {validationError && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-bold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Items Table Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        
        <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">
              بنود وأصناف الفاتورة ({items.length} صنف)
            </h3>
            <span className="text-xs text-slate-500 font-normal hidden sm:inline">
              — ادخل وزن أو عدد الصنف وسعر الوحدة، وسيقوم النظام بحساب الإجمالي آلياً
            </span>
          </div>

          {!isApproved && (
            <button
              onClick={handleAddItem}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-[#147D73] hover:bg-[#0f635b] text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة صنف</span>
            </button>
          )}
        </div>

        {/* Calculation Rule Notice */}
        <div className="bg-[#FAF6EE] px-4 sm:px-6 py-2.5 border-b border-amber-200/60 text-xs text-amber-900 flex items-center gap-2 font-medium">
          <Info className="w-4 h-4 text-[#C59A45] shrink-0" />
          <span>
            <strong>قاعدة الحساب للوزن الإجمالي:</strong> عند شراء سباطتين موز بوزن إجمالي 90 كجم بسعر 30 ج للكيلو، يكون الإجمالي <strong>90 × 30 = 2700 ج.م</strong>. (الوزن المدخل هو الوزن الإجمالي الصافي ولا يتم ضربه في عدد السبايط مرة ثانية).
          </span>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-3 w-10 text-center">#</th>
                <th className="py-3 px-3 min-w-[200px]">اسم الصنف / الخامة</th>
                <th className="py-3 px-3 min-w-[150px]">طريقة الشراء</th>
                <th className="py-3 px-3 min-w-[130px]">عدد العبوات والنوع</th>
                <th className="py-3 px-3 min-w-[120px]">الوزن الإجمالي (كجم)</th>
                <th className="py-3 px-3 min-w-[110px]">سعر الوحدة (ج.م)</th>
                <th className="py-3 px-3 min-w-[100px]">البيعة (ج/عبوة)</th>
                <th className="py-3 px-3 min-w-[110px]">الإجمالي (ج.م)</th>
                <th className="py-3 px-3 min-w-[130px]">تكلفة الكيلو الفعلية</th>
                {!isApproved && <th className="py-3 px-3 w-12 text-center">حذف</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, index) => {
                const effectiveKg = calculateEffectiveKgPrice(item);
                
                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition">
                    
                    {/* Index */}
                    <td className="py-3 px-3 text-center font-mono text-slate-400">
                      {index + 1}
                    </td>

                    {/* Ingredient selection */}
                    <td className="py-3 px-3">
                      {isApproved ? (
                        <div className="font-bold text-slate-800 text-sm">
                          {item.ingredientNameAr}
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <select
                            value={item.ingredientId}
                            onChange={e => updateItem(index, { ingredientId: e.target.value })}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#147D73]"
                          >
                            <optgroup label="الخامات المسجلة بالنظام">
                              {ingredients.map(ing => (
                                <option key={ing.id} value={ing.id}>
                                  {ing.nameAr} ({ing.category})
                                </option>
                              ))}
                            </optgroup>
                            <option value="custom">+ صنف / خامة جديدة</option>
                          </select>
                          
                          {item.ingredientId === 'custom' && (
                            <input
                              type="text"
                              value={item.ingredientNameAr}
                              onChange={e => updateItem(index, { ingredientNameAr: e.target.value })}
                              placeholder="اكتب اسم الصنف الجديد..."
                              className="w-full px-2.5 py-1 bg-amber-50/50 border border-amber-300 rounded-lg text-xs focus:outline-none"
                            />
                          )}
                        </div>
                      )}
                    </td>

                    {/* Pricing Method */}
                    <td className="py-3 px-3">
                      {isApproved ? (
                        <span className="text-slate-700">
                          {item.pricingMethod === 'by_weight' && 'بالوزن الإجمالي'}
                          {item.pricingMethod === 'by_package' && 'بالعبوة / الكرتونة'}
                          {item.pricingMethod === 'by_piece' && 'بالقطعة / الرابطة'}
                        </span>
                      ) : (
                        <select
                          value={item.pricingMethod}
                          onChange={e => updateItem(index, { pricingMethod: e.target.value as PurchasePricingMethod })}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#147D73]"
                        >
                          <option value="by_weight">بالوزن الإجمالي (كجم)</option>
                          <option value="by_package">بالعبوة / الكرتونة</option>
                          <option value="by_piece">بالقطعة / الرابطة</option>
                        </select>
                      )}
                    </td>

                    {/* Package Count & Unit Name */}
                    <td className="py-3 px-3">
                      {isApproved ? (
                        <div className="font-mono text-slate-700">
                          {item.packageCount || 1} {item.packageUnitName || 'عبوة'}
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number"
                            min="1"
                            step="1"
                            value={item.packageCount ?? 1}
                            onChange={e => updateItem(index, { packageCount: Math.max(1, parseInt(e.target.value) || 1) })}
                            className="w-16 px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#147D73]"
                          />
                          <select
                            value={item.packageUnitName || 'قفص'}
                            onChange={e => updateItem(index, { packageUnitName: e.target.value })}
                            className="px-2 py-1.5 bg-white border border-slate-200 rounded-lg text-xs focus:outline-none"
                          >
                            <option value="سباطة">سباطة</option>
                            <option value="قفص">قفص</option>
                            <option value="كرتونة">كرتونة</option>
                            <option value="شيكارة">شيكارة</option>
                            <option value="رابطة">رابطة</option>
                            <option value="برميل">برميل</option>
                            <option value="عبوة">عبوة</option>
                            <option value="قطعة">قطعة</option>
                          </select>
                        </div>
                      )}
                    </td>

                    {/* Total Net Weight in Kg */}
                    <td className="py-3 px-3">
                      {isApproved ? (
                        <span className="font-mono font-bold text-slate-800">
                          {item.totalWeightKg ? `${item.totalWeightKg} كجم` : '—'}
                        </span>
                      ) : (
                        <div className="relative">
                          <input
                            type="number"
                            step="0.1"
                            min="0"
                            placeholder={item.pricingMethod === 'by_weight' ? 'مطلوب (كجم)' : 'اختياري'}
                            value={item.totalWeightKg ?? ''}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              updateItem(index, { totalWeightKg: isNaN(val) ? 0 : val });
                            }}
                            className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#147D73] ${
                              item.pricingMethod === 'by_weight' && (!item.totalWeightKg || item.totalWeightKg <= 0)
                                ? 'border-rose-300 bg-rose-50/30'
                                : 'border-slate-200'
                            }`}
                          />
                        </div>
                      )}
                    </td>

                    {/* Unit Price (Price per kg / package / piece) */}
                    <td className="py-3 px-3">
                      {isApproved ? (
                        <span className="font-mono font-bold text-slate-800">
                          {item.unitPrice.toFixed(2)} ج.م
                        </span>
                      ) : (
                        <div className="relative">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            value={item.unitPrice || ''}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              updateItem(index, { unitPrice: isNaN(val) ? 0 : val });
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#147D73]"
                          />
                        </div>
                      )}
                    </td>

                    {/* Market Fee (البيعة للعبوة) */}
                    <td className="py-3 px-3">
                      {isApproved ? (
                        <span className="font-mono text-slate-700">
                          {item.packageFee ? `${item.packageFee} ج` : '—'}
                        </span>
                      ) : (
                        <div className="relative">
                          <input
                            type="number"
                            step="1"
                            min="0"
                            placeholder="0"
                            value={item.packageFee ?? ''}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              updateItem(index, { packageFee: isNaN(val) ? 0 : val });
                            }}
                            className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#147D73]"
                            title="البيعة للعبوة الواحدة (مثلاً 10 جنيه لكل كرتونة)"
                          />
                        </div>
                      )}
                    </td>

                    {/* Line Total Cost */}
                    <td className="py-3 px-3">
                      <div className="font-mono font-black text-sm text-[#147D73]">
                        {item.totalCost.toFixed(2)} <span className="text-[10px] font-sans font-normal text-slate-500">ج.م</span>
                      </div>
                    </td>

                    {/* Effective Kg Price Indicator */}
                    <td className="py-3 px-3">
                      {effectiveKg !== null ? (
                        <span className="inline-flex items-center gap-1 font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                          <strong>{effectiveKg.toFixed(2)}</strong> ج/كجم
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200" title="كرتونة أو عبوة بسعر مقطوع دون وزن مقاس">
                          غير محدد (دون وزن)
                        </span>
                      )}
                    </td>

                    {/* Remove row */}
                    {!isApproved && (
                      <td className="py-3 px-3 text-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition"
                          title="حذف هذا الصنف"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    )}

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Invoice Summary Footer */}
        <div className="p-4 sm:p-6 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
          
          <div className="flex items-center gap-6 text-xs text-slate-600">
            <div>
              <span>إجمالي عدد الأصناف: </span>
              <strong className="font-mono text-slate-800 text-sm">{items.length}</strong>
            </div>
            {invoiceTotals.totalWeightKg > 0 && (
              <div>
                <span>إجمالي الوزن الصافي: </span>
                <strong className="font-mono text-slate-800 text-sm">{invoiceTotals.totalWeightKg.toFixed(1)} كجم</strong>
              </div>
            )}
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-slate-500 font-semibold block">إجمالي الفاتورة المطلوب:</span>
              <div className="text-2xl font-black font-mono text-[#172D36]">
                {invoiceTotals.totalAmount.toFixed(2)} <span className="text-sm font-sans font-bold text-[#147D73]">جنيه مصري</span>
              </div>
            </div>
          </div>

        </div>

      </div>

      {/* Action Buttons Bar */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 flex flex-col sm:flex-row items-center justify-between gap-4">
        
        <div className="text-xs text-slate-500 flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            {isApproved
              ? 'تم اعتماد هذه الفاتورة مسبقاً وتحديث المخزون ومتوسط التكلفة المرجح. لحذف الأثر يرجى استخدام خاصية العكس من سجل الفواتير.'
              : 'حفظ كمسودة لا يغير المخزون ولا التكاليف. عند النقر على "اعتماد الفاتورة" يتم تحديث رصيد المخزون، ومتوسط التكلفة المرجح، وتكاليف مشروبات المنيو فورياً.'}
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!isApproved && (
            <>
              <button
                type="button"
                onClick={handleSaveDraft}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-sm transition"
              >
                <Save className="w-4 h-4" />
                <span>حفظ كمسودة</span>
              </button>

              <button
                type="button"
                onClick={handleApprove}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-[#147D73] hover:bg-[#0f635b] text-white font-bold rounded-xl text-sm shadow-md hover:shadow-lg transition ring-2 ring-[#147D73]/30"
              >
                <CheckCircle2 className="w-4 h-4 text-[#C59A45]" />
                <span>اعتماد الفاتورة وترحيل المخزون</span>
              </button>
            </>
          )}

          {isApproved && (
            <button
              type="button"
              onClick={handlePrint}
              className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-6 py-2.5 bg-[#172D36] hover:bg-[#203F4B] text-white font-bold rounded-xl text-sm transition"
            >
              <Printer className="w-4 h-4 text-[#C59A45]" />
              <span>طباعة الفاتورة المعتمدة</span>
            </button>
          )}
        </div>

      </div>

    </div>
  );
};
