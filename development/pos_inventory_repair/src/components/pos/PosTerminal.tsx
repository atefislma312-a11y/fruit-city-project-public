import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Product, OrderType, SugarLevel, IceLevel, OrderItemModifier, PosOrderItem } from '../../types';
import { 
  ShoppingBag, 
  Plus, 
  Minus, 
  Trash2, 
  CreditCard, 
  FileText, 
  Clock, 
  UserCheck, 
  AlertCircle, 
  Search, 
  Coffee, 
  Sparkles,
  Tag,
  Truck,
  RotateCcw,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Percent
} from 'lucide-react';
import { PaymentModal } from './PaymentModal';
import { PreparationTicketModal } from './PreparationTicketModal';
import { CustomerReceiptModal } from './CustomerReceiptModal';
import { RefundModal } from './RefundModal';

export const PosTerminal: React.FC = () => {
  const {
    products,
    recipesMap,
    activeOrder,
    setActiveOrder,
    createNewOrder,
    addItemToOrder,
    updateOrderItemQuantity,
    removeOrderItem,
    updateOrderModifiers,
    setOrderType,
    applyOrderDiscount,
    setDeliveryDetails,
    cancelOrder,
    saveCurrentOrderAsDraft,
    currentCashier,
    currentShift,
    cashierAccounts,
    setCurrentCashierId,
    setTicketModalOrder,
    orders,
    promotions,
    showToast
  } = useApp();

  // Filter & search states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Modals state
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isTicketOpen, setIsTicketOpen] = useState(false);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [isRefundOpen, setIsRefundOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  const [cancellationReason, setCancellationReason] = useState('');

  // Modifier modal for specific item
  const [editingModifierItem, setEditingModifierItem] = useState<PosOrderItem | null>(null);

  // Initialize order if null
  const currentOrder = useMemo(() => {
    if (activeOrder) return activeOrder;
    return null;
  }, [activeOrder]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    products.forEach(p => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [products]);

  // Filtered products
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchQuery = !searchQuery || 
        p.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.nameEn.toLowerCase().includes(searchQuery.toLowerCase());
      return matchCat && matchQuery;
    });
  }, [products, selectedCategory, searchQuery]);

  // Active cashier switcher
  const handleCashierSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setCurrentCashierId(e.target.value);
    showToast(`تم التبديل إلى الكاشير: ${cashierAccounts.find(c => c.id === e.target.value)?.nameAr}`);
  };

  const handleStartNewOrder = (type: OrderType = 'takeaway') => {
    createNewOrder(type);
  };

  const handleOpenModifiers = (item: PosOrderItem) => {
    setEditingModifierItem(item);
  };

  const handleSaveModifiers = (mods: OrderItemModifier) => {
    if (editingModifierItem) {
      updateOrderModifiers(editingModifierItem.id, mods);
      setEditingModifierItem(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top POS Status Bar */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200/90 p-4 flex flex-col md:flex-row items-center justify-between gap-4">
        
        {/* Cashier and Shift info */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="w-10 h-10 rounded-lg bg-[#147D73]/10 border border-[#147D73]/20 flex items-center justify-center text-[#147D73]">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">الكاشير النشط:</span>
              <select
                value={currentCashier.id}
                onChange={handleCashierSwitch}
                aria-label="اختيار الكاشير النشط"
                className="text-sm font-bold text-[#172D36] bg-slate-50 border border-slate-300 rounded px-2 py-0.5 focus:ring-1 focus:ring-[#147D73]"
              >
                {cashierAccounts.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nameAr} ({c.role === 'manager' ? 'مدير' : 'كاشير'})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>الوردية: {currentShift ? `#${currentShift.shiftNumber} (مفتوحة)` : 'لا توجد وردية مفتوحة'}</span>
              <span>•</span>
              <span className="text-emerald-700 font-medium">العهدة: 500 ج</span>
              <span>•</span>
              <span className="text-blue-700 font-medium">نقدية الدرج: {currentShift?.expectedCash || 500} ج</span>
            </div>
          </div>
        </div>

        {/* Quick order actions */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            onClick={() => setIsRefundOpen(true)}
            className="px-3 py-1.5 rounded-lg border border-rose-300 text-rose-700 hover:bg-rose-50 text-xs font-bold flex items-center gap-1.5 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>طلب استرداد / مرتجع</span>
          </button>

          {!currentOrder ? (
            <button
              onClick={() => handleStartNewOrder('takeaway')}
              className="px-4 py-2 rounded-lg bg-[#147D73] hover:bg-[#0E5C55] text-white text-sm font-bold flex items-center gap-2 shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>فتح طلب جديد</span>
            </button>
          ) : (
            <button
              onClick={saveCurrentOrderAsDraft}
              className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>حفظ كمسودة مؤقتة</span>
            </button>
          )}
        </div>

      </div>

      {/* Main Grid: Left Cart (40%) / Right Catalog (60%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* =========================================
            LEFT COLUMN: CART & CHECKOUT (5 cols)
            ========================================= */}
        <div className="lg:col-span-5 flex flex-col space-y-4">
          
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/90 overflow-hidden flex flex-col min-h-[580px]">
            
            {/* Cart Header */}
            <div className="bg-[#172D36] text-white p-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-[#C59A45]" />
                <span className="font-bold text-sm tracking-wide">
                  {currentOrder ? `طلب ${currentOrder.orderNumber}` : 'سلة الطلب'}
                </span>
              </div>

              {currentOrder && (
                <div className="flex items-center gap-1 bg-[#234552] p-1 rounded-lg">
                  <button
                    onClick={() => setOrderType('takeaway')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                      currentOrder.orderType === 'takeaway' || currentOrder.orderType === 'dine_in' ? 'bg-[#147D73] text-white shadow-sm' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    🛍️ تيك أواي
                  </button>
                  <button
                    onClick={() => setOrderType('delivery')}
                    className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                      currentOrder.orderType === 'delivery' ? 'bg-[#147D73] text-white shadow-sm' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    🛵 دليفري
                  </button>
                </div>
              )}
            </div>

            {/* Delivery Fields if OrderType === 'delivery' */}
            {currentOrder && currentOrder.orderType === 'delivery' && (
              <div className="bg-amber-50/70 border-b border-amber-200/80 p-3 text-xs space-y-2">
                <div className="flex items-center gap-1.5 font-bold text-amber-900">
                  <Truck className="w-3.5 h-3.5 text-amber-700" />
                  <span>بيانات التوصيل (خدمة التوصيل: 20 ج)</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="اسم العميل"
                    value={currentOrder.customerName || ''}
                    onChange={(e) => setDeliveryDetails(e.target.value, currentOrder.customerPhone || '', currentOrder.deliveryAddress || '')}
                    className="border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#147D73]"
                  />
                  <input
                    type="text"
                    placeholder="رقم الهاتف"
                    value={currentOrder.customerPhone || ''}
                    onChange={(e) => setDeliveryDetails(currentOrder.customerName || '', e.target.value, currentOrder.deliveryAddress || '')}
                    className="border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#147D73]"
                  />
                </div>
                <input
                  type="text"
                  placeholder="عنوان التوصيل بالتفصيل (وسط البلد / عابدين / التحرير)"
                  value={currentOrder.deliveryAddress || ''}
                  onChange={(e) => setDeliveryDetails(currentOrder.customerName || '', currentOrder.customerPhone || '', e.target.value)}
                  className="w-full border border-slate-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-[#147D73]"
                />
              </div>
            )}

            {/* Cart Items List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2.5 max-h-[340px]">
              {!currentOrder || currentOrder.items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8 text-slate-400 space-y-3">
                  <Coffee className="w-12 h-12 text-slate-300 stroke-[1.5]" />
                  <p className="text-sm font-medium text-slate-500">لا توجد منتجات مضافة في الطلب الحالي</p>
                  <p className="text-xs text-slate-400">اختر من قائمة المشروبات على اليسار لإضافتها فوراً</p>
                  {!currentOrder && (
                    <button
                      onClick={() => handleStartNewOrder('takeaway')}
                      className="mt-2 px-3.5 py-1.5 bg-[#147D73] text-white rounded-lg text-xs font-bold"
                    >
                      بدء طلب جديد
                    </button>
                  )}
                </div>
              ) : (
                currentOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/70 hover:bg-slate-50 flex items-start justify-between gap-2 transition-all"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 text-sm truncate">{item.productNameAr}</span>
                        <span className={`px-1.5 py-0.2 rounded text-[10px] font-black ${
                          item.servingSize === '1L' ? 'bg-amber-100 text-amber-800' :
                          item.servingSize === '500ml' ? 'bg-blue-100 text-blue-800' :
                          'bg-teal-100 text-teal-800'
                        }`}>
                          {item.servingSize === '16oz' ? '16 أونص' :
                           item.servingSize === '500ml' ? '500 مل' :
                           item.servingSize === '1L' ? '1 لتر' : '16 أونص'}
                        </span>
                      </div>

                      {/* Modifiers tags & button */}
                      <div className="flex flex-wrap items-center gap-1 mt-1 text-[11px] text-slate-600">
                        <button
                          onClick={() => handleOpenModifiers(item)}
                          className="text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 hover:bg-teal-100 font-semibold"
                        >
                          تعديل السكر والثلج: {
                            item.modifiers.sugarLevel === 'standard' ? 'سكر مظبوط' :
                            item.modifiers.sugarLevel === 'low' ? 'سكر خفيف' :
                            item.modifiers.sugarLevel === 'extra' ? 'سكر زيادة' : 'بدون سكر'
                          } • {
                            item.modifiers.iceLevel === 'standard' ? 'ثلج عادي' :
                            item.modifiers.iceLevel === 'light' ? 'ثلج قليل' :
                            item.modifiers.iceLevel === 'extra' ? 'ثلج زيادة' : 'بدون ثلج'
                          }
                        </button>
                        {item.modifiers.extraNotes && (
                          <span className="text-[10px] text-slate-500 italic truncate max-w-[150px]">
                            ({item.modifiers.extraNotes})
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 mt-1 font-mono">
                        {item.unitPrice} ج × {item.quantity} = <strong className="text-slate-800 font-bold">{item.totalPrice} ج</strong>
                      </div>
                    </div>

                    {/* Quantity controls */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => updateOrderItemQuantity(item.id, item.quantity - 1)}
                        className="w-6 h-6 rounded bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="w-6 text-center text-xs font-bold font-mono">{item.quantity}</span>
                      <button
                        onClick={() => updateOrderItemQuantity(item.id, item.quantity + 1)}
                        className="w-6 h-6 rounded bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeOrderItem(item.id)}
                        className="w-6 h-6 rounded text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors mr-1"
                        title="حذف الصنف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Cart Footer & Totals */}
            {currentOrder && currentOrder.items.length > 0 && (
              <div className="border-t border-slate-200 bg-slate-50/90 p-3.5 space-y-2.5 mt-auto">
                
                {/* Promotions / Discount Row */}
                <div className="flex items-center justify-between text-xs text-slate-600">
                  <div className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#147D73]" />
                    <span>خصم / عرض ترويجي:</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={currentOrder.promotionId || ''}
                      onChange={(e) => {
                        const promo = promotions.find(p => p.id === e.target.value);
                        if (promo) {
                          const disc = promo.type === 'percentage' 
                            ? (currentOrder.subtotal * (promo.value / 100))
                            : promo.value;
                          applyOrderDiscount(disc, promo.id, promo.nameAr);
                        } else {
                          applyOrderDiscount(0);
                        }
                      }}
                      className="border border-slate-300 rounded px-1.5 py-0.5 text-xs bg-white"
                    >
                      <option value="">بدون خصم</option>
                      {promotions.filter(p => p.active).map(p => (
                        <option key={p.id} value={p.id}>{p.nameAr} ({p.value}{p.type === 'percentage' ? '%' : ' ج'})</option>
                      ))}
                    </select>
                    {currentOrder.discountAmount > 0 && (
                      <span className="font-bold text-rose-600 font-mono">-{currentOrder.discountAmount} ج</span>
                    )}
                  </div>
                </div>

                {/* Subtotal & Delivery */}
                <div className="space-y-1 text-xs text-slate-500 border-t border-slate-200/60 pt-2">
                  <div className="flex justify-between">
                    <span>المجموع الفرعي للأصناف:</span>
                    <span className="font-mono">{currentOrder.subtotal} ج</span>
                  </div>
                  {currentOrder.orderType === 'delivery' && (
                    <div className="flex justify-between text-amber-800">
                      <span>رسوم التوصيل:</span>
                      <span className="font-mono">+{currentOrder.deliveryFee} ج</span>
                    </div>
                  )}
                </div>

                {/* Grand Total */}
                <div className="flex items-center justify-between bg-[#172D36] text-white p-3 rounded-lg shadow-sm">
                  <span className="font-bold text-sm">الإجمالي النهائي:</span>
                  <div className="text-xl font-black text-[#F3E5AB] font-mono">
                    {currentOrder.totalAmount} <span className="text-xs font-sans text-slate-300">ج.م</span>
                  </div>
                </div>

                {/* Bottom Checkout Action Buttons */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => setIsPaymentOpen(true)}
                    className="col-span-2 py-3 rounded-lg bg-[#147D73] hover:bg-[#0E5C55] text-white font-black text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>تحصيل وسداد الفاتورة</span>
                  </button>

                  <button
                    onClick={() => {
                      setTicketModalOrder(currentOrder);
                      setIsTicketOpen(true);
                    }}
                    className="py-2 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-slate-600" />
                    <span>تذكرة المطبخ (80mm)</span>
                  </button>

                  <button
                    onClick={() => setIsCancelConfirmOpen(true)}
                    className="py-2 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-700 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>إلغاء الطلب</span>
                  </button>
                </div>

              </div>
            )}

          </div>

        </div>

        {/* =========================================
            RIGHT COLUMN: PRODUCT CATALOG (7 cols)
            ========================================= */}
        <div className="lg:col-span-7 space-y-4">
          
          {/* Search & Categories Bar */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-200/90 p-3.5 space-y-3">
            
            {/* Search Input */}
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث عن مشروب بالاسم العربي أو الإنجليزي..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#147D73]"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-3" />
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                  selectedCategory === 'all'
                    ? 'bg-[#172D36] text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                الكل ({products.length})
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                    selectedCategory === cat
                      ? 'bg-[#147D73] text-white shadow-sm'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

          </div>

          {/* Product Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {filteredProducts.map((product) => {
              const recipe = recipesMap[product.recipeId];
              const isOutOfStock = product.isAvailable === false;
              return (
                <div
                  key={product.id}
                  className={`bg-white rounded-xl border p-3.5 flex flex-col justify-between transition-all group ${
                    isOutOfStock
                      ? 'border-rose-200/90 bg-rose-50/20 opacity-70'
                      : 'border-slate-200/90 hover:shadow-md hover:border-[#147D73]/40'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                        {product.category || 'عصائر'}
                      </span>
                      {isOutOfStock ? (
                        <span className="text-[10px] font-bold text-rose-600 bg-rose-100 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                          <XCircle className="w-2.5 h-2.5" /> غير متوفر
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-slate-400">
                          {recipe?.batchYieldMl ? `${recipe.batchYieldMl}ml` : ''}
                        </span>
                      )}
                    </div>

                    <h3 className={`font-extrabold text-sm mt-1.5 leading-snug transition-colors ${
                      isOutOfStock ? 'text-slate-500 line-through' : 'text-slate-900 group-hover:text-[#147D73]'
                    }`}>
                      {product.nameAr}
                    </h3>
                    <p className="text-[11px] text-slate-400 font-sans tracking-wide">
                      {product.nameEn}
                    </p>
                  </div>

                  {/* Pricing and Quick Add Buttons */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 space-y-1.5">
                    
                    {/* 16oz Cup button */}
                    {(product.prices['16oz'] || product.prices['400ml']) ? (
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold text-slate-600">كوب 16oz:</span>
                        <button
                          disabled={isOutOfStock}
                          onClick={() => addItemToOrder(product, '16oz')}
                          className={`px-2 py-0.5 rounded-md border text-xs font-black font-mono flex items-center gap-1 transition-all ${
                            isOutOfStock
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-teal-50 hover:bg-[#147D73] text-[#147D73] hover:text-white border-teal-200 hover:border-[#147D73]'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>{product.prices['16oz'] || product.prices['400ml']} ج</span>
                        </button>
                      </div>
                    ) : null}

                    {/* 500ml Bottle button */}
                    {product.prices['500ml'] ? (
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold text-slate-600">إزازة 500ml:</span>
                        <button
                          disabled={isOutOfStock}
                          onClick={() => addItemToOrder(product, '500ml')}
                          className={`px-2 py-0.5 rounded-md border text-xs font-black font-mono flex items-center gap-1 transition-all ${
                            isOutOfStock
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-blue-50 hover:bg-blue-600 text-blue-800 hover:text-white border-blue-200 hover:border-blue-600'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>{product.prices['500ml']} ج</span>
                        </button>
                      </div>
                    ) : null}

                    {/* 1L Bottle button */}
                    {product.prices['1L'] ? (
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold text-slate-600">إزازة 1 لتر:</span>
                        <button
                          disabled={isOutOfStock}
                          onClick={() => addItemToOrder(product, '1L')}
                          className={`px-2 py-0.5 rounded-md border text-xs font-black font-mono flex items-center gap-1 transition-all ${
                            isOutOfStock
                              ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                              : 'bg-amber-50 hover:bg-amber-600 text-amber-800 hover:text-white border-amber-200 hover:border-amber-600'
                          }`}
                        >
                          <Plus className="w-3 h-3" />
                          <span>{product.prices['1L']} ج</span>
                        </button>
                      </div>
                    ) : null}

                  </div>
                </div>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <div className="bg-white rounded-xl p-12 text-center text-slate-500 border border-slate-200">
              <Search className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="font-bold text-sm">لم يتم العثور على مشروبات مطابقة للبحث</p>
            </div>
          )}

        </div>

      </div>

      {/* =========================================
          MODALS & SUB-COMPONENTS
          ========================================= */}

      {/* Payment Modal */}
      {isPaymentOpen && currentOrder && (
        <PaymentModal
          order={currentOrder}
          onClose={() => setIsPaymentOpen(false)}
        />
      )}

      {/* Preparation Ticket Modal (Kitchen Worker 80mm ticket with NO customer prices) */}
      {isTicketOpen && currentOrder && (
        <PreparationTicketModal
          order={currentOrder}
          onClose={() => setIsTicketOpen(false)}
        />
      )}

      {/* Customer Receipt Modal */}
      {isReceiptOpen && currentOrder && (
        <CustomerReceiptModal
          order={currentOrder}
          onClose={() => setIsReceiptOpen(false)}
        />
      )}

      {/* Refund Modal */}
      {isRefundOpen && (
        <RefundModal
          onClose={() => setIsRefundOpen(false)}
        />
      )}

      {/* Order Item Modifiers Editor Modal */}
      {editingModifierItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-5 space-y-4 border border-slate-200">
            <h3 className="font-bold text-slate-900 text-base border-b pb-2 flex items-center justify-between">
              <span>تخصيص: {editingModifierItem.productNameAr}</span>
              <span className="text-xs bg-teal-50 text-teal-800 px-2 py-0.5 rounded font-mono">
                {editingModifierItem.servingSize}
              </span>
            </h3>

            {/* Sugar Level */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">مستوى السكر:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'standard', label: 'مظبوط (قياسي)' },
                  { id: 'low', label: 'خفيف (سكر قليل)' },
                  { id: 'sugar_free', label: 'بدون سكر (دايت/طبيعي)' },
                  { id: 'extra', label: 'زيادة (سكر مضاعف)' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setEditingModifierItem({
                      ...editingModifierItem,
                      modifiers: { ...editingModifierItem.modifiers, sugarLevel: opt.id as SugarLevel }
                    })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                      editingModifierItem.modifiers.sugarLevel === opt.id
                        ? 'bg-[#147D73] text-white border-[#147D73]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Ice Level */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">مستوى الثلج:</label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { id: 'standard', label: 'قياسي (معتدل)' },
                  { id: 'light', label: 'خفيف (ثلج قليل)' },
                  { id: 'no_ice', label: 'بدون ثلج' },
                  { id: 'extra', label: 'زيادة (كولد إكسترا)' }
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setEditingModifierItem({
                      ...editingModifierItem,
                      modifiers: { ...editingModifierItem.modifiers, iceLevel: opt.id as IceLevel }
                    })}
                    className={`py-1.5 px-2 rounded-lg text-xs font-semibold border transition-all ${
                      editingModifierItem.modifiers.iceLevel === opt.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">ملاحظات إضافية للمطبخ:</label>
              <input
                type="text"
                placeholder="مثال: بدون نعناع / كوب ورقي / تيك أواي سريع"
                value={editingModifierItem.modifiers.extraNotes || ''}
                onChange={(e) => setEditingModifierItem({
                  ...editingModifierItem,
                  modifiers: { ...editingModifierItem.modifiers, extraNotes: e.target.value }
                })}
                className="w-full border border-slate-300 rounded-lg p-2 text-xs"
              />
            </div>

            {/* Save Button */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => handleSaveModifiers(editingModifierItem.modifiers)}
                className="flex-1 bg-[#147D73] text-white py-2 rounded-lg text-xs font-bold hover:bg-[#0E5C55]"
              >
                تطبيق التعديلات
              </button>
              <button
                onClick={() => setEditingModifierItem(null)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-600 hover:bg-slate-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Order Confirmation Modal */}
      {isCancelConfirmOpen && currentOrder && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-5 space-y-4 border border-rose-200">
            <div className="flex items-center gap-2 text-rose-600 font-bold">
              <AlertCircle className="w-5 h-5" />
              <span>تأكيد إلغاء الطلب #{currentOrder.orderNumber}</span>
            </div>

            <p className="text-xs text-slate-600">
              يجب كتابة سبب الإلغاء لتوثيق السجل والتحقق مما إذا كان هناك مشروب تم إعداده بالفعل لاحتساب تكلفة الهدر.
            </p>

            <textarea
              rows={2}
              placeholder="سبب الإلغاء (مثال: تراجع العميل، خطأ في اختيار الصنف...)"
              value={cancellationReason}
              onChange={(e) => setCancellationReason(e.target.value)}
              className="w-full border border-slate-300 rounded-lg p-2 text-xs focus:ring-1 focus:ring-rose-500"
            />

            <div className="flex gap-2">
              <button
                disabled={!cancellationReason.trim()}
                onClick={() => {
                  cancelOrder(currentOrder.id, cancellationReason);
                  setIsCancelConfirmOpen(false);
                  setCancellationReason('');
                }}
                className="flex-1 bg-rose-600 disabled:opacity-50 text-white py-2 rounded-lg text-xs font-bold hover:bg-rose-700"
              >
                تأكيد الإلغاء
              </button>
              <button
                onClick={() => setIsCancelConfirmOpen(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs text-slate-600"
              >
                تراجع
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
