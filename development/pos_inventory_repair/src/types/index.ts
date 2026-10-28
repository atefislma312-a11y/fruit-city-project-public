export type UnitType = 'kg' | 'g' | 'l' | 'ml' | 'piece' | 'box' | 'bag' | 'bundle';

export type IngredientCategory = 
  | 'فواكه طازجة'      // Fresh Fruit
  | 'ألبان وكريمات'    // Dairy & Creams
  | 'سكريات ومحليات'   // Sugars & Sweeteners
  | 'نكهات ومواد مضافة' // Flavors & Additives
  | 'تعبئة وتغليف'     // Packaging
  | 'أخرى';            // Others

export interface PriceHistory {
  date: string;
  price: number;
  note?: string;
}

export interface Ingredient {
  id: string;
  nameAr: string;
  nameEn: string;
  category: IngredientCategory;
  purchaseUnit: UnitType; // e.g. kg, bundle, liter, box
  packageSize: number;    // e.g. 1 (kg), 8 (pieces in bundle), etc.
  currentPrice: number;   // EGP per package/purchase unit
  pricePerBaseUnit: number; // calculated EGP per gram, ml, or piece
  baseUnit: 'g' | 'ml' | 'piece'; // base unit for recipes
  supplier?: string;
  lastUpdated: string;
  priceHistory: PriceHistory[];
  usableYieldPercent: number; // e.g. 100% or 60% for unpeeled fruit
  wastePercentage: number;    // 100 - usableYieldPercent
  stockQuantity?: number;     // future-ready
  lowStockThreshold?: number; // future-ready
  isMeasured: boolean;        // whether usable weight has been verified
  notes?: string;
}

export type RecipeMethod = 'per_serving' | 'batch';

export interface RecipeIngredientItem {
  ingredientId: string;
  quantity: number;           // in specified unit
  unit: UnitType;             // g, kg, ml, l, piece, half_piece, quarter_piece
  notes?: string;
}

export interface Recipe {
  id: string;
  productId: string;
  nameAr: string;
  method: RecipeMethod;
  ingredients: RecipeIngredientItem[];
  // For batch recipes:
  batchYieldMl: number;       // e.g. 1800 ml, 10000 ml
  batchYieldServings?: number;
  // Preparation notes
  iceWaterNotes?: string;
  isComplete: boolean;        // false if unmeasured ingredients exist
  incompleteReason?: string;
  safetyNotes?: string;       // e.g. check food coloring dosage
  hasAddedSugar: boolean;
  marketingAlert?: string;
  lastUpdated: string;
}

export interface ServingCostBreakdown {
  size: '400ml' | '1L' | string;
  sizeMl: number;
  rawMaterialCost: number;     // EGP
  packagingCost: number;       // EGP
  directVariableCost: number;  // EGP (raw + packaging + direct)
  sellingPrice: number;        // EGP
  contribution: number;        // EGP (sellingPrice - directVariableCost)
  contributionMarginPercent: number; // (contribution / sellingPrice) * 100
  targetPriceAt60PercentMargin: number;
  targetPriceAt70PercentMargin: number;
  isComplete: boolean;
  notes?: string;
}

export type ServingSize = '16oz' | '500ml' | '1L' | '400ml';

export interface Product {
  id: string;
  nameAr: string;
  nameEn: string;
  category: string;
  recipeId: string;
  prices: {
    '16oz'?: number;
    '500ml'?: number;
    '1L'?: number;
    '400ml'?: number;
    [size: string]: number | undefined;
  };
  packaging: {
    '16oz'?: number;
    '500ml'?: number;
    '1L'?: number;
    '400ml'?: number;
    [size: string]: number | undefined;
  };
  servingMl: {
    '16oz'?: number;
    '500ml'?: number;
    '1L'?: number;
    '400ml'?: number;
    [size: string]: number | undefined;
  };
  isComplete: boolean;
  isAvailable?: boolean;
  incompleteNotes?: string;
  safetyNotice?: string;
}

export interface ExpenseItem {
  id: string;
  nameAr: string;
  nameEn: string;
  monthlyAmount: number; // EGP
  type: 'fixed' | 'variable' | 'mixed';
  category: 'rent' | 'utilities' | 'salaries' | 'operations' | 'marketing' | 'fees' | 'other';
  notes?: string;
}

export interface MonthlyBudget {
  expenses: ExpenseItem[];
  totalPlannedMonthly: number;
  ownerSalary: number;
  plannedFoodWastePercent: number; // unknown / estimate
}

export type PurchasePricingMethod = 'by_weight' | 'by_package' | 'by_piece';

export interface PurchaseInvoiceItem {
  id: string;
  ingredientId: string;
  ingredientNameAr: string;
  ingredientCategory: IngredientCategory;
  pricingMethod: PurchasePricingMethod;
  packageCount?: number; // e.g. 2 bunches, 5 boxes
  packageUnitName?: string; // e.g. 'سباطة', 'كرتونة', 'قفص', 'شيكارة', 'رابطة'
  totalWeightKg?: number; // Total net weight in kg (e.g. 90 kg total for both bunches)
  unitPrice: number; // price per kg (if by_weight), or price per package, or price per piece
  packageFee?: number; // البيعة للعبوة الواحدة (ج.م/عبوة) - تدخل في الإجمالي مرة واحدة (البيعة × عدد العبوات)
  totalCost: number; // line item total
  effectiveKgPrice?: number; // تكلفة الكيلو الفعلية بعد حساب البيعة
  unitsPerKg?: number; // عدد الوحدات في الكيلو
  totalUnits?: number; // إجمالي عدد الحبات/الوحدات
  packageGrossWeight?: number; // وزن الطرد/الكرتونة/السباطة القائم (متغير لكل عبوة)
  weightBeforePeeling?: number; // الوزن قبل التقشير والتجهيز
  weightAfterPeeling?: number; // الوزن الصافي بعد التقشير والتجهيز (الصافي القابل للاستخدام)
  wastePercent?: number; // نسبة هالك التقشير والتجهيز %
  effectiveNetKgCost?: number; // تكلفة الكيلو الصافي الجاهز للاستخدام بعد استبعاد هالك التقشير
  prepNotes?: string; // ملاحظات التجهيز وفرز الجودة
  weightUnknown?: boolean; // if package price is fixed but weight is unmeasured
  customIngredientName?: string; // اسم الصنف الحر في حال كان الصنف مخصصاً
  notes?: string;
}

export type InvoiceStatus = 'draft' | 'approved' | 'reversed';

export interface PurchaseInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string; // YYYY-MM-DD
  supplierName: string;
  status: InvoiceStatus;
  items: PurchaseInvoiceItem[];
  totalAmount: number;
  totalWeightKg?: number;
  notes?: string;
  createdAt: string;
  approvedAt?: string;
  reversedAt?: string;
  reversalReason?: string;
}

// ==========================================
// POS, ORDERS & PREPARATION TYPES
// ==========================================

export type OrderType = 'dine_in' | 'takeaway' | 'delivery';
export type OrderStatus = 'draft' | 'pending' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'partial' | 'paid' | 'refunded' | 'failed';
export type PreparationStatus = 'queued' | 'preparing' | 'ready' | 'delivered' | 'suspended';

export type SugarLevel = 'standard' | 'low' | 'sugar_free' | 'extra';
export type IceLevel = 'standard' | 'light' | 'no_ice' | 'extra';

export interface OrderItemModifier {
  sugarLevel: SugarLevel;
  iceLevel: IceLevel;
  extraNotes?: string;
}

export interface PosOrderItem {
  id: string;
  productId: string;
  productNameAr: string;
  recipeId?: string;
  servingSize: ServingSize;
  unitPrice: number;
  quantity: number;
  modifiers: OrderItemModifier;
  totalPrice: number;
  isPrepared?: boolean;
}

export interface PosOrder {
  id: string;
  orderNumber: string; // e.g. ORD-101
  orderType: OrderType;
  items: PosOrderItem[];
  subtotal: number;
  discountAmount: number;
  promotionId?: string;
  promotionNameAr?: string;
  deliveryFee: number;
  totalAmount: number;
  orderStatus: OrderStatus;
  paymentStatus: PaymentStatus;
  preparationStatus: PreparationStatus;
  cashierId: string;
  cashierName: string;
  shiftId: string;
  customerName?: string;
  customerPhone?: string;
  deliveryAddress?: string;
  notes?: string;
  createdAt: string;
  paidAt?: string;
  preparedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
  totalRefundedAmount: number;
}

// ==========================================
// PAYMENT METHODS & PROVIDER TYPES
// ==========================================

export type PaymentMethodType = 'cash' | 'instapay' | 'card';

export interface PaymentFeeSnapshot {
  ruleId?: string;
  providerName: string;
  feePercent: number;
  fixedFee: number;
  expectedFeeAmount: number;
  expectedNetSettlement: number;
  actualNetSettlement?: number;
  settlementDate?: string;
  reconciliationStatus: 'unreconciled' | 'matched' | 'discrepancy';
  discrepancyNotes?: string;
}

export interface PaymentRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  amount: number;
  method: PaymentMethodType;
  status: 'verified' | 'pending' | 'refunded' | 'rejected';
  timestamp: string;
  cashierId: string;
  cashierShiftId: string;
  // Cash details
  amountTendered?: number;
  changeDue?: number;
  amountReceived?: number;
  // InstaPay details
  instapayReference?: string;
  verificationMethod?: 'merchant_app' | 'bank_sms' | 'manual_review';
  verificationTimestamp?: string;
  verifiedByEmployeeId?: string;
  evidenceAttachmentUrl?: string;
  evidenceAttachmentName?: string;
  // Card details
  terminalId?: string;
  cardTransactionReference?: string;
  cardType?: 'visa' | 'mastercard' | 'other';
  authorizationCode?: string;
  // Electronic Payment Fee snapshot
  feeSnapshot?: PaymentFeeSnapshot;
}

// ==========================================
// ELECTRONIC PAYMENT FEES CONFIGURATION
// ==========================================

export interface PaymentFeeRule {
  id: string;
  providerName: string; // e.g. 'Fawry', 'Paymob', 'Banque Misr Terminal', 'NBE Terminal'
  paymentMethod: 'card' | 'instapay';
  feePercent: number; // e.g. 1.5
  fixedFee: number; // e.g. 2.0 EGP
  minFee?: number;
  maxFee?: number;
  contractualTaxPercent?: number; // e.g. 14% VAT on fee
  monthlyServiceFee?: number; // e.g. 150 EGP monthly rental
  effectiveStartDate: string;
  effectiveEndDate?: string;
  roundingRule: 'round_2_decimals' | 'ceil_piastre';
  active: boolean;
  version: number;
}

export interface SettlementImportRow {
  transactionReference: string;
  transactionDate: string;
  grossAmount: number;
  deductedFee: number;
  netSettlement: number;
  status: 'matched' | 'unmatched' | 'discrepancy';
  matchedPaymentId?: string;
  notes?: string;
}

export interface SettlementBatch {
  id: string;
  batchReference: string;
  providerName: string;
  importDate: string;
  recordsCount: number;
  totalGross: number;
  totalFees: number;
  totalNet: number;
  status: 'imported' | 'reconciled' | 'discrepancy_detected';
  rows: SettlementImportRow[];
}

// ==========================================
// CASHIER ACCOUNTS & SHIFT MANAGEMENT
// ==========================================

export interface CashierAccount {
  id: string;
  nameAr: string;
  username: string;
  role: 'cashier' | 'shift_supervisor' | 'manager';
  pinCode: string; // 4-digit PIN
  active: boolean;
}

export interface CashierShift {
  id: string;
  shiftNumber: number;
  cashierId: string;
  cashierName: string;
  startTime: string;
  endTime?: string;
  status: 'open' | 'handover_pending' | 'closed';
  openingFloat: number; // Fixed EGP 500
  cashReceived: number;
  cashDeposits: number;
  cashRefunds: number;
  cashExpenses: number;
  cashWithdrawals: number;
  expectedCash: number;
  actualCashCounted?: number;
  discrepancy?: number; // actual - expected (negative = shortage, positive = surplus)
  reconciliationNotes?: string;
  handoverCashierId?: string;
  handoverCashierName?: string;
  handoverConfirmedAt?: string;
  closedAt?: string;
}

// ==========================================
// REFUNDS, CANCELLATIONS & WASTE
// ==========================================

export interface RefundRecord {
  id: string;
  orderId: string;
  orderNumber: string;
  originalPaymentId?: string;
  amount: number;
  method: PaymentMethodType;
  reason: string;
  cashierId: string;
  cashierName: string;
  shiftId: string;
  timestamp: string;
  requiresManagerApproval: boolean;
  approvalRequestId?: string;
  status: 'completed' | 'pending_approval' | 'rejected';
  isPreparedDrinkWaste: boolean;
  wasteNotes?: string;
}

export interface DrinkWasteEntry {
  id: string;
  orderId: string;
  orderNumber: string;
  productId: string;
  productNameAr: string;
  recipeId?: string;
  servingSize: ServingSize;
  quantity: number;
  estimatedCostLoss: number;
  reason: string;
  loggedAt: string;
  cashierId: string;
}

// ==========================================
// PROMOTIONS, DISCOUNTS & COMBOS
// ==========================================

export interface Promotion {
  id: string;
  nameAr: string;
  type: 'percentage' | 'fixed_amount' | 'bundle' | 'combo';
  value: number; // e.g. 10% or 20 EGP
  applicableProductIds: string[];
  minOrderAmount?: number;
  requiresManagerApproval: boolean;
  active: boolean;
  startDate?: string;
  endDate?: string;
  notes?: string;
}

// ==========================================
// MANAGER APPROVALS ("مركز موافقات المدير")
// ==========================================

export type ApprovalRequestType =
  | 'cash_refund_over_limit'  // Cash refund > 200 EGP
  | 'electronic_refund'       // Any card or InstaPay refund
  | 'exceptional_discount'    // Manual/special unapproved discount
  | 'price_override'          // Manual product price override
  | 'shift_discrepancy'       // Cash discrepancy during handover
  | 'float_adjustment'        // Float below EGP 500
  | 'post_payment_cancellation';

export type ApprovalRequestStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface ManagerApprovalRequest {
  id: string;
  requestType: ApprovalRequestType;
  orderId?: string;
  orderNumber?: string;
  shiftId?: string;
  requestedByCashierId: string;
  requestedByCashierName: string;
  amount?: number;
  reason: string;
  evidenceNotes?: string;
  evidenceAttachmentUrl?: string;
  status: ApprovalRequestStatus;
  createdAt: string;
  expiresAt: string; // e.g. 15 minutes validity
  reviewedAt?: string;
  reviewedByManagerId?: string;
  reviewedByManagerName?: string;
  reviewNotes?: string;
  // Security replay protection
  isApplied: boolean;
  executionToken?: string;
  appliedAt?: string;
}

// Remote Cloud Relay Status
export interface RemoteApprovalRelayConfig {
  isEnabled: boolean;
  relayEndpointUrl: string;
  lastHeartbeat?: string;
  isOnline: boolean;
  pendingSyncCount: number;
}

