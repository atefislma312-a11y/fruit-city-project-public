import React from 'react';
import { useApp } from '../../context/AppContext';
import { PosOrder, PreparationStatus } from '../../types';
import { X, Printer, CheckCircle, Clock, ChefHat } from 'lucide-react';
import { formatWorkerPreparationTicket } from '../../engine/posEngine';

interface PreparationTicketModalProps {
  order: PosOrder;
  onClose: () => void;
}

export const PreparationTicketModal: React.FC<PreparationTicketModalProps> = ({ order, onClose }) => {
  const { updatePreparationStatus } = useApp();

  const handlePrint = () => {
    window.print();
  };

  const formattedTicket = formatWorkerPreparationTicket(order);

  const getPrepStatusBadge = (status: PreparationStatus) => {
    switch (status) {
      case 'queued':
        return <span className="bg-amber-100 text-amber-800 px-2 py-0.5 rounded text-xs font-bold">في طابور التجهيز</span>;
      case 'preparing':
        return <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-xs font-bold">جاري التحضير الآن</span>;
      case 'ready':
        return <span className="bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded text-xs font-bold">جاهز للاستلام</span>;
      case 'delivered':
        return <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-bold">تم التسليم</span>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        
        {/* Modal Top Bar */}
        <div className="bg-[#172D36] text-white p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChefHat className="w-5 h-5 text-[#C59A45]" />
            <span className="font-bold text-sm">تذكرة تجهيز المطبخ (80mm)</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status & Quick Action Bar */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-semibold">الحالة:</span>
            {getPrepStatusBadge(order.preparationStatus)}
          </div>

          <div className="flex items-center gap-1.5">
            {order.preparationStatus === 'queued' && (
              <button
                onClick={() => updatePreparationStatus(order.id, 'preparing')}
                className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md text-xs font-bold transition-colors"
              >
                بدء التحضير
              </button>
            )}
            {order.preparationStatus === 'preparing' && (
              <button
                onClick={() => updatePreparationStatus(order.id, 'ready')}
                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold transition-colors"
              >
                جاهز للاستلام
              </button>
            )}
            {order.preparationStatus === 'ready' && (
              <button
                onClick={() => updatePreparationStatus(order.id, 'delivered')}
                className="px-2.5 py-1 bg-slate-700 hover:bg-slate-800 text-white rounded-md text-xs font-bold transition-colors"
              >
                تم التسليم
              </button>
            )}
          </div>
        </div>

        {/* 80mm Thermal Ticket Simulation (STRICTLY NO PRICES FOR WORKER) */}
        <div className="p-6 bg-slate-100 flex justify-center max-h-[460px] overflow-y-auto">
          <div 
            id="worker-80mm-ticket"
            className="w-[80mm] max-w-[300px] bg-white p-4 shadow-md border border-slate-300 font-mono text-slate-900 text-xs rounded leading-relaxed select-text print:shadow-none print:border-none print:w-[80mm]"
          >
            {/* Ticket Header */}
            <div className="text-center border-b-2 border-dashed border-slate-400 pb-3 mb-3">
              <div className="text-base font-black tracking-wider uppercase font-sans">FRUIT CITY</div>
              <div className="text-[10px] text-slate-600 font-bold">تذكرة تجهيز البار والمطبخ</div>
              <div className="text-[10px] text-slate-500 font-bold">فرع 64 شارع القصر العيني (أمام روزا يوسف)</div>
              
              <div className="mt-2 text-xl font-black bg-slate-100 py-1 rounded border border-slate-300">
                {order.orderNumber}
              </div>
              <div className="text-xs font-bold text-slate-800 mt-1">
                نوع الطلب: {
                  order.orderType === 'delivery' ? '🛵 دليفري (توصيل)' : '🛍️ تيك أواي (سفري)'
                }
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })} • الكاشير: {order.cashierName}
              </div>
            </div>

            {/* Ticket Items List - NO PRICES! */}
            <div className="space-y-3 pb-3 border-b-2 border-dashed border-slate-400">
              {order.items.map((item, idx) => {
                const sizeLabel = item.servingSize === '16oz' ? 'كوب 16 أونص' :
                  item.servingSize === '500ml' ? 'إزازة 500 مل' :
                  item.servingSize === '1L' ? 'إزازة 1 لتر' : 'كوب 16 أونص';
                return (
                  <div key={item.id} className="border-b border-slate-100 pb-2 last:border-none">
                    <div className="flex items-start justify-between font-bold text-sm">
                      <span className="text-slate-900">{idx + 1}. {item.productNameAr}</span>
                      <span className="bg-slate-900 text-white px-1.5 py-0.2 rounded text-xs">×{item.quantity}</span>
                    </div>

                    {/* Serving Size */}
                    <div className="text-xs font-semibold text-slate-700 mt-0.5">
                      الحجم: <strong className="underline">{sizeLabel}</strong>
                    </div>

                  {/* Modifiers highlighted for kitchen worker */}
                  <div className="bg-slate-50 p-1.5 rounded mt-1 text-[11px] space-y-0.5 border border-slate-200">
                    <div>
                      السكر: <strong className="text-slate-900">{
                        item.modifiers.sugarLevel === 'standard' ? 'مظبوط' :
                        item.modifiers.sugarLevel === 'low' ? 'خفيف' :
                        item.modifiers.sugarLevel === 'extra' ? 'زيادة' : 'بدون سكر (طبيعي)'
                      }</strong>
                    </div>
                    <div>
                      الثلج: <strong className="text-slate-900">{
                        item.modifiers.iceLevel === 'standard' ? 'قياسي' :
                        item.modifiers.iceLevel === 'light' ? 'خفيف' :
                        item.modifiers.iceLevel === 'extra' ? 'زيادة' : 'بدون ثلج'
                      }</strong>
                    </div>
                    {item.modifiers.extraNotes && (
                      <div className="text-amber-800 font-bold">
                        تنبيه: {item.modifiers.extraNotes}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            </div>

            {/* Delivery Note if applicable */}
            {order.orderType === 'delivery' && (
              <div className="py-2 border-b-2 border-dashed border-slate-400 text-[10px]">
                <div className="font-bold">عميل التوصيل: {order.customerName || 'غير مسجل'}</div>
                <div>الهاتف: {order.customerPhone || '—'}</div>
                <div>العنوان: {order.deliveryAddress || '—'}</div>
              </div>
            )}

            {/* Ticket Footer */}
            <div className="text-center pt-3 text-[10px] text-slate-500">
              <div>*** تنبيه الجودة ***</div>
              <div>يرجى الالتزام بمعايير الوصفة المعيارية ونظافة الخلاطات</div>
            </div>

          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            * تم حجب الأسعار عن تذكرة المطبخ وفقاً لسياسة التشغيل.
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
            >
              إغلاق
            </button>
            <button
              onClick={handlePrint}
              className="px-4 py-1.5 bg-[#147D73] hover:bg-[#0E5C55] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>طباعة التذكرة</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
