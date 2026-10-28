import React from 'react';
import { useApp } from '../../context/AppContext';
import { PosOrder, PaymentRecord } from '../../types';
import { X, Printer, CheckCircle2, Sparkles } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const FRUIT_STORY_SLUGS: Record<string, string> = {
  'مانجو': 'mango',
  'مانجا': 'mango',
  'برتقال': 'orange',
  'فراولة': 'strawberry',
  'تفاح': 'apple',
  'قصب': 'sugarcane',
  'ليمون': 'lemon',
  'موز': 'banana',
  'جوافة': 'guava',
  'رمان': 'pomegranate',
  'بطيخ': 'watermelon',
  'كيوي': 'kiwi',
  'أفوكادو': 'avocado',
  'افوكادو': 'avocado',
  'أناناس': 'pineapple',
  'اناناس': 'pineapple',
  'عنب': 'grapes',
  'توت': 'berry',
  'خوخ': 'peach',
  'كانتلوب': 'cantaloupe'
};

function getPrimaryFruitSlug(order: PosOrder): string {
  if (!order.items || order.items.length === 0) return 'fresh-juice';
  for (const item of order.items) {
    const name = item.productNameAr || '';
    for (const [fruit, slug] of Object.entries(FRUIT_STORY_SLUGS)) {
      if (name.includes(fruit)) return slug;
    }
  }
  return 'fresh-juice';
}

interface CustomerReceiptModalProps {
  order: PosOrder;
  payment?: PaymentRecord;
  onClose: () => void;
}

export const CustomerReceiptModal: React.FC<CustomerReceiptModalProps> = ({ order, payment, onClose }) => {
  const { payments } = useApp();

  // Find payment if not passed
  const orderPayment = payment || payments.find(p => p.orderId === order.id);
  const fruitSlug = getPrimaryFruitSlug(order);
  const storyUrl = `https://fruitcity.eg/story?item=${encodeURIComponent(fruitSlug)}`;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
        
        {/* Top Action Bar */}
        <div className="bg-[#172D36] text-white p-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="font-bold text-sm">فاتورة العميل الرقمية</span>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Container */}
        <div className="p-6 bg-slate-100 flex justify-center max-h-[500px] overflow-y-auto">
          <div
            id="customer-receipt"
            className="w-full max-w-[280px] bg-white p-4 shadow-sm border border-slate-200 font-mono text-xs text-slate-800 rounded leading-relaxed select-text"
          >
            {/* Header */}
            <div className="text-center border-b border-dashed border-slate-300 pb-3 mb-2.5">
              <div className="text-xl font-black tracking-wider text-slate-900 font-sans">FRUIT CITY</div>
              <div className="text-[11px] font-bold text-teal-800 tracking-wide">FRESH JUICE & FRUIT BAR</div>
              <div className="text-[10px] text-slate-800 mt-1 font-bold">64 شارع القصر العيني (أمام روزا يوسف) — القاهرة</div>
              <div className="text-[9px] text-slate-500 font-sans">64 Kasr Al-Ainy St. (Opp. Rose Al-Yousef)</div>
              <div className="text-[10px] text-slate-700 font-sans font-bold">هاتف وواتساب: 01025966033</div>
              
              <div className="mt-2 text-xs font-bold text-slate-900">
                فاتورة ضريبية مبسطة #{order.orderNumber}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                {new Date(order.paidAt || order.createdAt).toLocaleString('ar-EG')}
              </div>
              <div className="text-[10px] text-slate-500 font-bold">
                الكاشير: {order.cashierName} • {
                  order.orderType === 'delivery' ? '🛵 دليفري (توصيل منزلي)' : '🛍️ تيك أواي (سفري)'
                }
              </div>
            </div>

            {/* Items Table */}
            <div className="space-y-2 border-b border-dashed border-slate-300 pb-3">
              {order.items.map((item) => {
                const sizeLabel = item.servingSize === '16oz' ? '16 أونص' :
                  item.servingSize === '500ml' ? '500 مل' :
                  item.servingSize === '1L' ? '1 لتر' : '16 أونص';
                return (
                  <div key={item.id} className="text-xs">
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>{item.productNameAr} ({sizeLabel})</span>
                      <span>{item.totalPrice} ج</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500">
                      <span>{item.quantity} × {item.unitPrice} ج</span>
                      <span>
                        {item.modifiers.sugarLevel === 'standard' ? 'سكر مظبوط' :
                         item.modifiers.sugarLevel === 'low' ? 'سكر خفيف' :
                         item.modifiers.sugarLevel === 'extra' ? 'سكر زيادة' : 'بدون سكر'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="space-y-1 py-2.5 border-b border-dashed border-slate-300 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>المجموع الفرعي:</span>
                <span>{order.subtotal} ج</span>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-rose-600 font-bold">
                  <span>الخصم المطبق:</span>
                  <span>-{order.discountAmount} ج</span>
                </div>
              )}
              {order.deliveryFee > 0 && (
                <div className="flex justify-between text-amber-700">
                  <span>خدمة التوصيل:</span>
                  <span>+{order.deliveryFee} ج</span>
                </div>
              )}
              <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-200">
                <span>الإجمالي المدفوع:</span>
                <span>{order.totalAmount} ج.م</span>
              </div>
            </div>

            {/* Payment Details */}
            {orderPayment && (
              <div className="py-2.5 border-b border-dashed border-slate-300 text-[10px] text-slate-600 space-y-0.5">
                <div className="flex justify-between font-bold text-slate-800">
                  <span>طريقة الدفع:</span>
                  <span>
                    {orderPayment.method === 'cash' ? 'نقدي (كاش)' :
                     orderPayment.method === 'instapay' ? 'إنستاباي (InstaPay)' : 'بطاقة بنكية (فيزا)'}
                  </span>
                </div>
                {orderPayment.method === 'cash' && orderPayment.amountTendered !== undefined && (
                  <>
                    <div className="flex justify-between">
                      <span>المدفوع نقداً:</span>
                      <span>{orderPayment.amountTendered} ج</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-700">
                      <span>الباقي للعميل:</span>
                      <span>{orderPayment.changeDue || 0} ج</span>
                    </div>
                  </>
                )}
                {orderPayment.method === 'instapay' && orderPayment.instapayReference && (
                  <div className="flex justify-between font-mono">
                    <span>مرجع التحويل:</span>
                    <span>{orderPayment.instapayReference}</span>
                  </div>
                )}
                {orderPayment.method === 'card' && orderPayment.cardTransactionReference && (
                  <div className="flex justify-between font-mono">
                    <span>رقم تفويض البطاقة:</span>
                    <span>{orderPayment.cardTransactionReference}</span>
                  </div>
                )}
              </div>
            )}

            {/* Fruit Story QR Code - Thermal Print Crisp Vector SVG */}
            <div className="mt-3 p-2 bg-slate-50 border border-slate-200 rounded text-center space-y-1 print:border-black print:p-1">
              <div className="text-[9px] font-black text-slate-800 uppercase tracking-wider font-sans">
                Scan for Fruit Story & Benefits 🥭✨
              </div>
              <div className="text-[9px] font-bold text-teal-800 print:text-black">
                امسح واعرف حكاية وفوائد عصيرك
              </div>
              <div className="flex justify-center py-1">
                <div className="p-1 bg-white border border-slate-300 rounded inline-block print:border-none print:p-0">
                  <QRCodeSVG
                    value={storyUrl}
                    size={72}
                    level="M"
                    includeMargin={false}
                    className="mx-auto"
                  />
                </div>
              </div>
              <div className="text-[8px] text-slate-500 font-mono tracking-wider font-bold">
                fruitcity.eg/story?item={fruitSlug}
              </div>
            </div>

            {/* Receipt Footer */}
            <div className="text-center pt-3 text-[10px] text-slate-500 space-y-1">
              <div className="font-bold text-teal-800 font-sans tracking-wide">FRUIT CITY — شكراً لزيارتكم</div>
              <div>نسعد بخدمتكم دائماً • انتعاش طبيعي 100%</div>
              <div className="text-[9px] text-slate-400">نظام إدارة ومبيعات Fruit City v2.3</div>
            </div>

          </div>
        </div>

        {/* Modal Buttons */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100"
          >
            إغلاق
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-1.5 bg-[#147D73] hover:bg-[#0E5C55] text-white rounded-lg text-xs font-bold flex items-center gap-1.5 shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>طباعة الإيصال</span>
          </button>
        </div>

      </div>
    </div>
  );
};
