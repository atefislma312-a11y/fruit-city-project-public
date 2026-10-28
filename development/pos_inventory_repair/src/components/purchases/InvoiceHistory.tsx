import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { PurchaseInvoice, InvoiceStatus } from '../../types';
import * as XLSX from 'xlsx';
import { 
  Search, 
  Filter, 
  Printer, 
  Edit3, 
  RotateCcw, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Eye, 
  Calendar, 
  Building2, 
  Scale, 
  Coins,
  X,
  FileSpreadsheet
} from 'lucide-react';

interface InvoiceHistoryProps {
  onSelectInvoice: (invoice: PurchaseInvoice) => void;
}

export const InvoiceHistory: React.FC<InvoiceHistoryProps> = ({ onSelectInvoice }) => {
  const { invoices, reverseInvoice, deleteInvoice, setPrintingInvoice, showToast } = useApp();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Reversal Modal State
  const [reversalModalInvoice, setReversalModalInvoice] = useState<PurchaseInvoice | null>(null);
  const [reversalReasonInput, setReversalReasonInput] = useState<string>('خطأ في إدخال أوزان البضاعة من السوق');

  const filteredInvoices = invoices.filter(inv => {
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inv.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (inv.notes && inv.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      inv.items.some(itm => itm.ingredientNameAr.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesStatus = statusFilter === 'all' || inv.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const totalApprovedAmount = invoices
    .filter(inv => inv.status === 'approved')
    .reduce((sum, inv) => sum + inv.totalAmount, 0);

  const totalDraftCount = invoices.filter(inv => inv.status === 'draft').length;
  const totalApprovedCount = invoices.filter(inv => inv.status === 'approved').length;

  const handleOpenReverseModal = (inv: PurchaseInvoice) => {
    setReversalModalInvoice(inv);
    setReversalReasonInput('خطأ في إدخال أوزان البضاعة من السوق');
  };

  const handleConfirmReversal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reversalModalInvoice) return;
    if (!reversalReasonInput.trim()) {
      showToast('يجب كتابة سبب عكس الفاتورة لتوثيق سجل التدقيق');
      return;
    }

    const res = reverseInvoice(reversalModalInvoice.id, reversalReasonInput.trim());
    if (res.success) {
      setReversalModalInvoice(null);
    }
  };

  const handleDeleteDraft = (inv: PurchaseInvoice) => {
    if (inv.status !== 'draft') {
      showToast('لا يمكن حذف الفواتير المعتمدة؛ يمكنك عكسها لإلغاء أثرها المخزني.');
      return;
    }
    if (window.confirm(`هل أنت متأكد من حذف مسودة الفاتورة #${inv.invoiceNumber}؟`)) {
      deleteInvoice(inv.id);
    }
  };

  const handleExportInvoiceExcel = (inv: PurchaseInvoice) => {
    const rows = [
      ['FRUIT CITY MANAGEMENT SYSTEM — فاتورة مشتريات توريد'],
      ['فرع وسط البلد — القاهرة'],
      [''],
      ['رقم الفاتورة:', inv.invoiceNumber, 'تاريخ الشراء:', inv.invoiceDate],
      ['المورد / التاجر:', inv.supplierName, 'الحالة:', inv.status === 'approved' ? 'معتمدة' : (inv.status === 'draft' ? 'مسودة' : 'معكوسة')],
      ['ملاحظات التوريد:', inv.notes || '—'],
      [''],
      [
        'م',
        'اسم الصنف / الخامة',
        'طريقة الشراء',
        'العبوات',
        'الوزن الإجمالي (كجم)',
        'سعر الوحدة (ج.م)',
        'إجمالي الصنف (ج.م)'
      ],
      ...inv.items.map((itm, idx) => [
        idx + 1,
        itm.ingredientNameAr,
        itm.pricingMethod === 'by_weight' ? 'بالوزن الإجمالي' : (itm.pricingMethod === 'by_package' ? 'بالعبوة' : 'بالقطعة'),
        itm.packageCount ? `${itm.packageCount} ${itm.packageUnitName || 'عبوة'}` : '—',
        itm.totalWeightKg ? `${itm.totalWeightKg} كجم` : '—',
        itm.unitPrice,
        itm.totalCost
      ]),
      [''],
      ['', '', '', 'إجمالي عدد الأصناف:', inv.items.length],
      ['', '', '', 'إجمالي الوزن الصافي (كجم):', inv.totalWeightKg || 0],
      ['', '', '', 'إجمالي الفاتورة المطلوب (ج.م):', inv.totalAmount]
    ];

    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'فاتورة مشتريات');
    XLSX.writeFile(wb, `فاتورة_${inv.invoiceNumber}.xlsx`);
    showToast(`تم تصدير ملف الإكسيل (${inv.invoiceNumber}.xlsx) بنجاح`);
  };

  return (
    <div className="space-y-6">
      
      {/* KPI Overview Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold block">إجمالي مشتريات السوق المعتمدة</span>
            <div className="text-xl font-black font-mono text-[#172D36] mt-1">
              {totalApprovedAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} <span className="text-xs font-sans text-[#147D73]">ج.م</span>
            </div>
            <span className="text-[11px] text-slate-400">{totalApprovedCount} فواتير معتمدة ومرحلة</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
            <Coins className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold block">المسودات المعلقة</span>
            <div className="text-xl font-black font-mono text-amber-700 mt-1">
              {totalDraftCount} <span className="text-xs font-sans text-slate-500">مسودة</span>
            </div>
            <span className="text-[11px] text-slate-400">تحتاج مراجعة أو اعتماد</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex items-center justify-between">
          <div>
            <span className="text-xs text-slate-500 font-semibold block">إجمالي فواتير النظام</span>
            <div className="text-xl font-black font-mono text-[#147D73] mt-1">
              {invoices.length} <span className="text-xs font-sans text-slate-500">فاتورة</span>
            </div>
            <span className="text-[11px] text-slate-400">سجل محاسبي كامل ومحمي</span>
          </div>
          <div className="w-12 h-12 rounded-xl bg-slate-100 text-[#172D36] flex items-center justify-center">
            <Scale className="w-6 h-6" />
          </div>
        </div>

      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="بحث برقم الفاتورة، اسم المورد، الصنف (موز، فراولة...)"
            className="w-full pr-10 pl-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-[#147D73]"
          />
        </div>

        {/* Status Filter Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { id: 'all', label: 'كافة الفواتير' },
            { id: 'approved', label: 'المعتمدة' },
            { id: 'draft', label: 'المسودات' },
            { id: 'reversed', label: 'المعكوسة' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                statusFilter === tab.id
                  ? 'bg-[#172D36] text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

      </div>

      {/* Invoices List Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            <Building2 className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="text-base font-bold text-slate-700">لا توجد فواتير مطابقة لبحثك</h4>
            <p className="text-xs text-slate-400 mt-1">
              يمكنك كتابة اسم تاجر آخر أو إنشاء فاتورة مشتريات جديدة من التبويب أعلاه.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50/80 text-slate-700 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">رقم الفاتورة</th>
                  <th className="py-3.5 px-4">التاريخ</th>
                  <th className="py-3.5 px-4">المورد / التاجر</th>
                  <th className="py-3.5 px-4">الأصناف الموردة</th>
                  <th className="py-3.5 px-4 text-center">إجمالي الوزن (كجم)</th>
                  <th className="py-3.5 px-4 text-left">إجمالي الفاتورة</th>
                  <th className="py-3.5 px-4 text-center">الحالة</th>
                  <th className="py-3.5 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/60 transition">
                    
                    {/* Invoice Number */}
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-800 text-sm">
                        {inv.invoiceNumber}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        {inv.items.length} أصناف
                      </div>
                    </td>

                    {/* Date */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1.5 text-slate-700 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{inv.invoiceDate}</span>
                      </div>
                    </td>

                    {/* Supplier */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-800">
                        {inv.supplierName}
                      </div>
                      {inv.notes && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[200px]">
                          {inv.notes}
                        </div>
                      )}
                    </td>

                    {/* Items chips */}
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {inv.items.slice(0, 3).map((item, idx) => (
                          <span
                            key={idx}
                            className="inline-block bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium"
                          >
                            {item.ingredientNameAr}
                          </span>
                        ))}
                        {inv.items.length > 3 && (
                          <span className="inline-block text-slate-400 text-[10px]">
                            +{inv.items.length - 3} أخرى
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Total Weight */}
                    <td className="py-3.5 px-4 text-center font-mono font-bold text-slate-700">
                      {inv.totalWeightKg ? `${inv.totalWeightKg.toFixed(1)} كجم` : '—'}
                    </td>

                    {/* Total Amount */}
                    <td className="py-3.5 px-4 text-left font-mono font-black text-sm text-[#147D73]">
                      {inv.totalAmount.toFixed(2)} <span className="text-[10px] font-sans font-normal text-slate-500">ج.م</span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4 text-center">
                      {inv.status === 'approved' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          معتمدة
                        </span>
                      )}
                      {inv.status === 'draft' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                          <AlertCircle className="w-3 h-3 text-amber-600" />
                          مسودة
                        </span>
                      )}
                      {inv.status === 'reversed' && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-800 bg-rose-50 px-2.5 py-1 rounded-full border border-rose-200" title={inv.reversalReason}>
                          <RotateCcw className="w-3 h-3 text-rose-600" />
                          معكوسة
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        
                        {/* View / Edit */}
                        <button
                          onClick={() => onSelectInvoice(inv)}
                          className="p-1.5 text-slate-600 hover:text-[#147D73] hover:bg-slate-100 rounded-lg transition"
                          title={inv.status === 'draft' ? 'تعديل المسودة واعتمادها' : 'عرض تفاصيل الفاتورة'}
                        >
                          {inv.status === 'draft' ? <Edit3 className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>

                        {/* Print */}
                        <button
                          onClick={() => setPrintingInvoice(inv)}
                          className="p-1.5 text-slate-600 hover:text-[#C59A45] hover:bg-slate-100 rounded-lg transition"
                          title="طباعة الفاتورة"
                        >
                          <Printer className="w-4 h-4" />
                        </button>

                        {/* Export Excel */}
                        <button
                          onClick={() => handleExportInvoiceExcel(inv)}
                          className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition"
                          title="تنزيل الفاتورة كملف Excel (.xlsx)"
                        >
                          <FileSpreadsheet className="w-4 h-4" />
                        </button>

                        {/* Reverse (Only if approved) */}
                        {inv.status === 'approved' && (
                          <button
                            onClick={() => handleOpenReverseModal(inv)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="عكس الفاتورة (إلغاء الأثر المخزني وتوثيق السبب)"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}

                        {/* Delete (Only if draft) */}
                        {inv.status === 'draft' && (
                          <button
                            onClick={() => handleDeleteDraft(inv)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                            title="حذف المسودة"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}

                      </div>
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reversal Audit Prompt Modal */}
      {reversalModalInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 overflow-hidden text-right">
            
            <div className="p-5 bg-rose-50 border-b border-rose-100 flex items-center justify-between">
              <div className="flex items-center gap-2 text-rose-800">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                <h3 className="font-black text-base">
                  عكس وإلغاء فاتورة مشتريات معتمدة
                </h3>
              </div>
              <button
                onClick={() => setReversalModalInvoice(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReversal} className="p-6 space-y-4 text-xs">
              
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div>رقم الفاتورة: <strong className="font-mono text-slate-800">{reversalModalInvoice.invoiceNumber}</strong></div>
                <div>المورد: <strong className="text-slate-800">{reversalModalInvoice.supplierName}</strong></div>
                <div>إجمالي المبلغ: <strong className="font-mono text-[#147D73]">{reversalModalInvoice.totalAmount.toFixed(2)} ج.م</strong></div>
              </div>

              <div className="text-slate-600 leading-relaxed">
                <strong>ماذا يحدث عند عكس الفاتورة؟</strong>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-500">
                  <li>سيتم خصم الكميات الموردة في هذه الفاتورة من رصيد مخزون الخامات.</li>
                  <li>لن يتم حذف الفاتورة بالكامل، بل ستتحول لحالة <span className="text-rose-700 font-bold">معكوسة</span> للحفاظ على سجل التدقيق المحاسبي.</li>
                  <li>سيتم توثيق سبب العكس في تاريخ وحركات أسعار الخامات.</li>
                </ul>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1.5">
                  سبب عكس الفاتورة (مطلوب لتوثيق السجل المحاسبي):
                </label>
                <textarea
                  rows={3}
                  value={reversalReasonInput}
                  onChange={e => setReversalReasonInput(e.target.value)}
                  placeholder="اكتب سبب العكس (مثال: خطأ في وزن السباطة، إرجاع بضاعة تالفة للوكالة)..."
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500 text-xs"
                  required
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setReversalModalInvoice(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl"
                >
                  إلغاء التراجع
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl shadow-sm"
                >
                  تأكيد عكس الفاتورة وخصم المخزون
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
};
