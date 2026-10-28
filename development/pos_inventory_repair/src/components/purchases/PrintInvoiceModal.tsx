import React from 'react';
import { PurchaseInvoice } from '../../types';
import { Printer, X, CheckCircle2, AlertTriangle, Sparkles } from 'lucide-react';

interface PrintInvoiceModalProps {
  invoice: PurchaseInvoice | null;
  onClose: () => void;
}

export const PrintInvoiceModal: React.FC<PrintInvoiceModalProps> = ({ invoice, onClose }) => {
  if (!invoice) return null;

  const handlePrint = () => {
    window.print();
  };

  const getPricingMethodLabel = (method: string) => {
    switch (method) {
      case 'by_weight':
        return 'بالوزن الإجمالي (كجم)';
      case 'by_package':
        return 'بالعبوة / الكرتونة';
      case 'by_piece':
        return 'بالقطعة / الرابطة';
      default:
        return 'بالوزن';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-3xl w-full shadow-2xl border border-slate-200 overflow-hidden text-right flex flex-col max-h-[90vh]">
        
        {/* Modal Header Controls (Hidden during print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-[#147D73] hover:bg-[#0f635b] text-white font-bold rounded-lg shadow-sm transition"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة الفاتورة</span>
            </button>
            <span className="text-xs text-slate-300">
              (متوافق مع طابعات A4 وطابعات الفواتير)
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Invoice Sheet */}
        <div id="printable-invoice" className="p-8 overflow-y-auto print:p-0 flex-1 bg-white">
          
          {/* Brand & Invoice Header */}
          <div className="border-b-2 border-slate-800 pb-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-lg bg-[#172D36] flex items-center justify-center text-white">
                    <Sparkles className="w-4 h-4 text-[#C59A45]" />
                  </div>
                  <h1 className="text-2xl font-black text-[#172D36] tracking-wide">
                    FRUIT CITY — فروت سيتي
                  </h1>
                </div>
                <p className="text-xs text-slate-500 font-semibold">
                  إدارة التكاليف والمشتريات المركزية — وسط البلد، القاهرة
                </p>
                <p className="text-xs text-slate-500">
                  سجل تجاري وبطاقة ضريبية معتمدة
                </p>
              </div>

              <div className="text-left">
                <div className="text-xs uppercase font-extrabold text-slate-400">فاتورة مشتريات توريد</div>
                <div className="text-xl font-mono font-bold text-[#147D73] dir-ltr">{invoice.invoiceNumber}</div>
                <div className="text-xs text-slate-600 mt-1">تاريخ الشراء: <strong className="font-mono">{invoice.invoiceDate}</strong></div>
                <div className="mt-2">
                  {invoice.status === 'approved' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-emerald-300">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      معتمدة ومرحلة للمخزون
                    </span>
                  )}
                  {invoice.status === 'draft' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full border border-amber-300">
                      مسودة غير معتمدة
                    </span>
                  )}
                  {invoice.status === 'reversed' && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-rose-300">
                      <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                      معكوسة (ملغاة)
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Supplier & Details Info */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 text-sm">
            <div>
              <span className="text-xs text-slate-500 block">المورد / التاجر:</span>
              <strong className="text-base text-slate-800">{invoice.supplierName || 'تاجر جملة سوق الخضار'}</strong>
            </div>
            <div>
              <span className="text-xs text-slate-500 block">تاريخ الإدخال في النظام:</span>
              <span className="text-slate-700 font-mono text-xs">{invoice.createdAt ? new Date(invoice.createdAt).toLocaleString('ar-EG') : invoice.invoiceDate}</span>
            </div>
            {invoice.notes && (
              <div className="col-span-2 border-t border-slate-200/80 pt-2 mt-1">
                <span className="text-xs text-slate-500 block">ملاحظات التوريد:</span>
                <span className="text-slate-700 text-xs">{invoice.notes}</span>
              </div>
            )}
            {invoice.status === 'reversed' && invoice.reversalReason && (
              <div className="col-span-2 bg-rose-50 p-2.5 rounded-lg border border-rose-200 text-rose-800 text-xs">
                <strong>سبب عكس وإلغاء الفاتورة:</strong> {invoice.reversalReason}
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="mb-6 overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-right text-xs">
              <thead className="bg-[#172D36] text-white">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">اسم الصنف والخامة</th>
                  <th className="py-2.5 px-3">طريقة الشراء</th>
                  <th className="py-2.5 px-3 text-center">العبوات / الأقفاص</th>
                  <th className="py-2.5 px-3 text-center">الوزن الإجمالي (كجم)</th>
                  <th className="py-2.5 px-3 text-center">سعر الوحدة</th>
                  <th className="py-2.5 px-3 text-left">الإجمالي (ج.م)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {invoice.items.map((item, index) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-mono text-slate-400">{index + 1}</td>
                    <td className="py-2.5 px-3 font-bold text-slate-800">
                      {item.ingredientNameAr}
                      {item.weightUnknown && (
                        <span className="mr-2 text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          الوزن غير مقاس
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {getPricingMethodLabel(item.pricingMethod)}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {item.packageCount ? `${item.packageCount} ${item.packageUnitName || 'عبوة'}` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-semibold">
                      {item.totalWeightKg ? `${item.totalWeightKg} كجم` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono">
                      {item.unitPrice.toFixed(2)} ج.م
                    </td>
                    <td className="py-2.5 px-3 text-left font-mono font-bold text-[#147D73]">
                      {item.totalCost.toFixed(2)} ج.م
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals & Financial Summary */}
          <div className="flex justify-end mb-8">
            <div className="w-72 bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
              <div className="flex justify-between items-center text-slate-600">
                <span>عدد الأصناف:</span>
                <span className="font-mono font-bold text-slate-800">{invoice.items.length} أصناف</span>
              </div>
              {invoice.totalWeightKg !== undefined && invoice.totalWeightKg > 0 && (
                <div className="flex justify-between items-center text-slate-600">
                  <span>إجمالي الوزن الصافي:</span>
                  <span className="font-mono font-bold text-slate-800">{invoice.totalWeightKg.toFixed(2)} كجم</span>
                </div>
              )}
              <div className="border-t border-slate-300 pt-2 flex justify-between items-center text-sm font-extrabold text-[#172D36]">
                <span>إجمالي الفاتورة:</span>
                <span className="text-base text-[#147D73] font-mono">{invoice.totalAmount.toFixed(2)} ج.م</span>
              </div>
            </div>
          </div>

          {/* Footer Signatures */}
          <div className="border-t border-slate-300 pt-6 mt-8 grid grid-cols-2 text-center text-xs text-slate-500">
            <div>
              <p className="font-semibold text-slate-700 mb-8">توقيع المستلم / مسؤول المشتريات</p>
              <div className="border-b border-dashed border-slate-300 w-44 mx-auto"></div>
            </div>
            <div>
              <p className="font-semibold text-slate-700 mb-8">اعتماد الإدارة / صاحب المحل</p>
              <div className="border-b border-dashed border-slate-300 w-44 mx-auto"></div>
            </div>
          </div>

          <div className="text-center text-[10px] text-slate-400 mt-6 print:block">
            طبعت هذه الفاتورة من نظام Fruit City Management System — downtown Cairo
          </div>

        </div>

      </div>
    </div>
  );
};
