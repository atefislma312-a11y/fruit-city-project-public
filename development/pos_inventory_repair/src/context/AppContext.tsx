import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { 
  Ingredient, 
  Product, 
  Recipe, 
  ExpenseItem, 
  ServingCostBreakdown,
  ServingSize,
  PurchaseInvoice, 
  PurchaseInvoiceItem,
  PosOrder,
  PosOrderItem,
  OrderType,
  OrderStatus,
  PaymentStatus,
  PreparationStatus,
  OrderItemModifier,
  PaymentMethodType,
  PaymentRecord,
  PaymentFeeSnapshot,
  PaymentFeeRule,
  SettlementBatch,
  SettlementImportRow,
  CashierAccount,
  CashierShift,
  RefundRecord,
  DrinkWasteEntry,
  Promotion,
  ManagerApprovalRequest,
  ApprovalRequestType,
  RemoteApprovalRelayConfig
} from '../types';
import { 
  loadAppState, 
  saveAppState, 
  downloadBackupFile, 
  parseAndValidateBackup, 
  resetAppStateToDefaults,
  resetAppStateToCleanProduction
} from '../data/storage';
import { ApiClient } from '../services/apiClient';
import {
  calculateBatchCost,
  calculateRawCostPerLiter,
  calculateServingBreakdown,
  calculateBaseUnitCost,
  roundMoney
} from '../engine/costingEngine';
import {
  calculateWeightedAverageCost
} from '../engine/purchaseEngine';
import {
  calculateOrderItemTotal,
  calculateOrderTotals,
  calculateOrderIngredientDeductions,
  calculateDrinkWaste,
  formatWorkerPreparationTicket
} from '../engine/posEngine';
import {
  calculateExpectedDrawerCash,
  reconcileShiftHandover,
  aggregateShiftPayments,
  STANDARD_SHIFT_FLOAT_EGP
} from '../engine/shiftEngine';
import {
  findApplicableFeeRule,
  calculatePaymentFeeSnapshot,
  comparePaymentFeesToBudget,
  parseSettlementCsv,
  matchSettlementWithPayments,
  PROVISIONAL_MONTHLY_PAYMENT_FEE_BUDGET
} from '../engine/paymentFeeEngine';
import {
  evaluateRefundEligibility,
  createManagerApprovalRequest,
  validateAndApplyApproval,
  CASHIER_CASH_REFUND_LIMIT_EGP
} from '../engine/approvalEngine';

export type NavigationTab = 
  | 'dashboard'   // الرئيسية
  | 'pos'         // نقطة البيع (الكاشير)
  | 'shifts'      // الورديات وإغلاق الدرج
  | 'approvals'   // مركز موافقات المدير
  | 'payment_fees'// رسوم وتسويات المدفوعات
  | 'products'    // المنتجات
  | 'ingredients' // الخامات
  | 'purchases'   // المشتريات
  | 'recipes'     // الوصفات
  | 'reports'     // التقارير
  | 'expenses'    // المصروفات
  | 'settings';   // الإعدادات

export interface CalculatedProductItem {
  product: Product;
  recipe?: Recipe;
  batchCost: number;
  rawCostPerLiter: number;
  breakdown400ml: ServingCostBreakdown;
  breakdown1L: ServingCostBreakdown;
  isComplete: boolean;
  statusText: string;
}

interface AppContextType {
  activeTab: NavigationTab;
  setActiveTab: (tab: NavigationTab) => void;
  // Core State
  ingredients: Ingredient[];
  recipes: Recipe[];
  products: Product[];
  expenses: ExpenseItem[];
  invoices: PurchaseInvoice[];
  orders: PosOrder[];
  payments: PaymentRecord[];
  cashierAccounts: CashierAccount[];
  shifts: CashierShift[];
  paymentFeeRules: PaymentFeeRule[];
  promotions: Promotion[];
  refunds: RefundRecord[];
  drinkWastes: DrinkWasteEntry[];
  approvalRequests: ManagerApprovalRequest[];
  managerPin: string;
  // Computed lookup maps
  ingredientsMap: Record<string, Ingredient>;
  recipesMap: Record<string, Recipe>;
  invoicesMap: Record<string, PurchaseInvoice>;
  ordersMap: Record<string, PosOrder>;
  cashiersMap: Record<string, CashierAccount>;
  calculatedProducts: CalculatedProductItem[];
  // POS & Cashier Active State
  currentCashierId: string;
  setCurrentCashierId: (id: string) => void;
  currentCashier: CashierAccount;
  currentShift: CashierShift | undefined;
  activeOrder: PosOrder | null;
  setActiveOrder: (order: PosOrder | null) => void;
  // Modals & UI triggers
  isAddProductModalOpen: boolean;
  setIsAddProductModalOpen: (open: boolean) => void;
  quickPriceModalIngredient: Ingredient | null;
  setQuickPriceModalIngredient: (ing: Ingredient | null) => void;
  editingProduct: Product | null;
  setEditingProduct: (prod: Product | null) => void;
  editingRecipe: Recipe | null;
  setEditingRecipe: (rec: Recipe | null) => void;
  editingInvoice: PurchaseInvoice | null;
  setEditingInvoice: (inv: PurchaseInvoice | null) => void;
  printingInvoice: PurchaseInvoice | null;
  setPrintingInvoice: (inv: PurchaseInvoice | null) => void;
  ticketModalOrder: PosOrder | null;
  setTicketModalOrder: (order: PosOrder | null) => void;
  receiptModalData: { order: PosOrder; payment?: PaymentRecord } | null;
  setReceiptModalData: (data: { order: PosOrder; payment?: PaymentRecord } | null) => void;
  isPaymentModalOpen: boolean;
  setIsPaymentModalOpen: (open: boolean) => void;
  // Calculations
  totalMonthlyExpenses: number;
  averageContributionMargin: number;
  incompleteRecipesCount: number;
  // Ingredient actions
  updateIngredientPrice: (id: string, newPrice: number, note?: string) => void;
  saveIngredient: (ingredient: Ingredient) => void;
  deleteIngredient: (id: string) => void;
  // Recipe actions
  saveRecipe: (recipe: Recipe) => void;
  deleteRecipe: (id: string) => void;
  duplicateRecipe: (id: string) => void;
  // Product actions
  saveProduct: (product: Product, recipe?: Recipe) => void;
  deleteProduct: (id: string) => void;
  // Expense actions
  saveExpense: (expense: ExpenseItem) => void;
  deleteExpense: (id: string) => void;
  // Purchase Invoice actions
  saveInvoice: (invoice: PurchaseInvoice) => void;
  approveInvoice: (invoiceOrId: string | PurchaseInvoice) => { success: boolean; message: string };
  reverseInvoice: (invoiceId: string, reason: string) => { success: boolean; message: string };
  deleteInvoice: (invoiceId: string) => { success: boolean; message: string };
  // POS & Order Actions
  createNewOrder: (orderType?: OrderType) => PosOrder;
  addItemToOrder: (product: Product, servingSize: ServingSize, modifiers?: Partial<OrderItemModifier>) => void;
  updateOrderItemQuantity: (itemId: string, newQuantity: number) => void;
  removeOrderItem: (itemId: string) => void;
  updateOrderModifiers: (itemId: string, modifiers: OrderItemModifier) => void;
  setOrderType: (orderType: OrderType) => void;
  applyOrderDiscount: (discountAmount: number, promotionId?: string, promotionNameAr?: string) => void;
  setDeliveryDetails: (customerName: string, customerPhone: string, deliveryAddress: string, deliveryFee?: number) => void;
  saveCurrentOrderAsDraft: () => void;
  completeOrderWithoutPayment: (orderId: string) => { success: boolean; message: string };
  processOrderPayment: (params: {
    orderId: string;
    amount: number;
    method: PaymentMethodType;
    tendered?: number;
    instapayRef?: string;
    instapayVerification?: 'merchant_app' | 'bank_sms' | 'manual_review';
    instapayEvidenceName?: string;
    terminalId?: string;
    cardRef?: string;
    cardType?: 'visa' | 'mastercard' | 'other';
  }) => { success: boolean; payment?: PaymentRecord; order?: PosOrder; message: string };
  cancelOrder: (orderId: string, reason: string) => { success: boolean; message: string };
  updatePreparationStatus: (orderId: string, prepStatus: PreparationStatus) => void;
  // Refund Actions
  processRefund: (params: {
    orderId: string;
    amount: number;
    method: PaymentMethodType;
    reason: string;
    isPreparedDrinkWaste?: boolean;
    wasteNotes?: string;
  }) => { success: boolean; requiresApproval: boolean; approvalRequest?: ManagerApprovalRequest; refund?: RefundRecord; message: string };
  // Shift & Cashier Actions
  openNewShift: (cashierId: string, openingFloat?: number) => { success: boolean; shift?: CashierShift; message: string };
  handoverShift: (params: {
    shiftId: string;
    nextCashierId: string;
    actualCashCounted: number;
    withdrawalAmount?: number;
    notes?: string;
  }) => { success: boolean; discrepancy: number; message: string };
  // Manager Approval Actions
  approveManagerRequest: (requestId: string, pin: string, managerName?: string, notes?: string) => { success: boolean; message: string };
  rejectManagerRequest: (requestId: string, pin: string, managerName?: string, notes?: string) => { success: boolean; message: string };
  // Fee Rules & Settlement Actions
  savePaymentFeeRule: (rule: PaymentFeeRule) => void;
  deletePaymentFeeRule: (ruleId: string) => void;
  settlementBatches: SettlementBatch[];
  importSettlementBatch: (csvText: string, providerName: string) => { success: boolean; batch?: SettlementBatch; matchedCount: number; discrepancyCount: number; message: string };
  // Remote Relay Status
  remoteRelayConfig: RemoteApprovalRelayConfig;
  updateRemoteRelayConfig: (updates: Partial<RemoteApprovalRelayConfig>) => void;
  // Storage & System Actions
  exportBackup: () => void;
  importBackup: (jsonContent: string) => boolean;
  resetToDefaults: () => void;
  resetToCleanProduction: () => void;
  toastMessage: string | null;
  showToast: (msg: string) => void;
  // Backend & SQLite Integration
  isApiConnected: boolean;
  isFirstRun: boolean;
  isFirstRunModalOpen: boolean;
  setIsFirstRunModalOpen: (open: boolean) => void;
  isOnboardingModalOpen: boolean;
  setIsOnboardingModalOpen: (open: boolean) => void;
  refreshStateFromDb: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTab] = useState<NavigationTab>('pos');
  const [state, setState] = useState(() => loadAppState());
  const [currentCashierId, setCurrentCashierId] = useState<string>('csh_01'); // Default Ahmed

  // Backend & SQLite Integration State
  const [isApiConnected, setIsApiConnected] = useState<boolean>(false);
  const [isFirstRun, setIsFirstRun] = useState<boolean>(false);
  const [isFirstRunModalOpen, setIsFirstRunModalOpen] = useState<boolean>(false);
  const [isOnboardingModalOpen, setIsOnboardingModalOpen] = useState<boolean>(false);

  // Modals & UI triggers
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false);
  const [quickPriceModalIngredient, setQuickPriceModalIngredient] = useState<Ingredient | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<PurchaseInvoice | null>(null);
  const [printingInvoice, setPrintingInvoice] = useState<PurchaseInvoice | null>(null);

  // POS active state
  const [activeOrder, setActiveOrder] = useState<PosOrder | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [ticketModalOrder, setTicketModalOrder] = useState<PosOrder | null>(null);
  const [receiptModalData, setReceiptModalData] = useState<{ order: PosOrder; payment?: PaymentRecord } | null>(null);

  // Settlement Batches
  const [settlementBatches, setSettlementBatches] = useState<SettlementBatch[]>([]);

  // Remote Relay Config
  const [remoteRelayConfig, setRemoteRelayConfig] = useState<RemoteApprovalRelayConfig>({
    isEnabled: false,
    relayEndpointUrl: 'https://api.fruitcity.internal/remote-relay',
    isOnline: false,
    pendingSyncCount: 0
  });

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-persist on state change
  useEffect(() => {
    saveAppState(state);
  }, [state]);

  const refreshStateFromDb = async () => {
    try {
      const health = await ApiClient.getHealth();
      if (health) {
        setIsApiConnected(true);
        setIsFirstRun(health.isFirstRun);
        if (health.isFirstRun) {
          setIsFirstRunModalOpen(true);
        }
        const dbState = await ApiClient.getState();
        if (dbState) {
          setState(prev => ({
            ...prev,
            ingredients: dbState.ingredients || [],
            products: dbState.products || [],
            recipes: dbState.recipes || [],
            invoices: dbState.invoices || [],
            orders: dbState.orders || [],
            payments: dbState.payments || [],
            shifts: dbState.shifts || [],
            paymentFeeRules: dbState.feeRules && dbState.feeRules.length > 0 ? dbState.feeRules : prev.paymentFeeRules
          }));
        }
      } else {
        setIsApiConnected(false);
      }
    } catch (err) {
      console.warn('API health check error:', err);
      setIsApiConnected(false);
    }
  };

  // Check SQLite Backend on mount and auto-sync every 4 seconds + window focus
  useEffect(() => {
    refreshStateFromDb();
    const interval = setInterval(() => {
      refreshStateFromDb();
    }, 4000);

    const onFocus = () => {
      refreshStateFromDb();
    };
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Maps for fast O(1) lookup
  const ingredientsMap = useMemo(() => {
    const map: Record<string, Ingredient> = {};
    for (const ing of state.ingredients) {
      map[ing.id] = ing;
    }
    return map;
  }, [state.ingredients]);

  const recipesMap = useMemo(() => {
    const map: Record<string, Recipe> = {};
    for (const rec of state.recipes) {
      map[rec.id] = rec;
    }
    return map;
  }, [state.recipes]);

  const invoicesMap = useMemo(() => {
    const map: Record<string, PurchaseInvoice> = {};
    for (const inv of state.invoices || []) {
      map[inv.id] = inv;
    }
    return map;
  }, [state.invoices]);

  const ordersMap = useMemo(() => {
    const map: Record<string, PosOrder> = {};
    for (const ord of state.orders || []) {
      map[ord.id] = ord;
    }
    return map;
  }, [state.orders]);

  const cashiersMap = useMemo(() => {
    const map: Record<string, CashierAccount> = {};
    for (const c of state.cashierAccounts || []) {
      map[c.id] = c;
    }
    return map;
  }, [state.cashierAccounts]);

  const currentCashier = useMemo<CashierAccount>(() => {
    return cashiersMap[currentCashierId] || state.cashierAccounts[0] || {
      id: 'csh_01',
      nameAr: 'أحمد محمود',
      username: 'ahmed',
      role: 'cashier',
      pinCode: '1111',
      active: true
    };
  }, [cashiersMap, currentCashierId, state.cashierAccounts]);

  const currentShift = useMemo<CashierShift | undefined>(() => {
    const myOpenShift = (state.shifts || []).find(s => s.status === 'open' && s.cashierId === currentCashierId);
    if (myOpenShift) return myOpenShift;
    return (state.shifts || []).find(s => s.status === 'open');
  }, [state.shifts, currentCashierId]);

  // Master calculation of all products and recipes
  const calculatedProducts = useMemo<CalculatedProductItem[]>(() => {
    return state.products.map(product => {
      const recipe = recipesMap[product.recipeId];
      let batchCost = 0;
      let rawCostPerLiter = 0;
      let isComplete = product.isComplete;
      let statusText = isComplete ? 'وصفة مكتملة' : 'تحتاج استكمال';

      if (recipe) {
        if (!recipe.isComplete) {
          isComplete = false;
          statusText = recipe.incompleteReason || 'بيانات غير مكتملة';
        }

        const batchCalc = calculateBatchCost(recipe, ingredientsMap);
        batchCost = batchCalc.totalCost;

        if (recipe.method === 'per_serving') {
          rawCostPerLiter = 0;
        } else {
          rawCostPerLiter = calculateRawCostPerLiter(batchCost, recipe.batchYieldMl);
        }
      } else {
        isComplete = false;
        statusText = 'لا توجد وصفة مرتبطة';
      }

      let breakdown400ml: ServingCostBreakdown;
      let breakdown1L: ServingCostBreakdown;

      if (recipe && recipe.method === 'per_serving') {
        const directCost = batchCost;
        breakdown400ml = calculateServingBreakdown({
          sizeLabel: '400ml',
          servingMl: 400,
          rawCostPerLiter: 0,
          packagingCost: product.packaging['400ml'] || 0,
          sellingPrice: product.prices['400ml'] || 0,
          isComplete,
          directServingRawCost: directCost
        });

        breakdown1L = calculateServingBreakdown({
          sizeLabel: '1L',
          servingMl: 1000,
          rawCostPerLiter: 0,
          packagingCost: product.packaging['1L'] || 0,
          sellingPrice: product.prices['1L'] || 0,
          isComplete: false,
          directServingRawCost: roundMoney(directCost * 2.5),
          notes: 'عائد العصير الصافي غير مقاس مخبرياً'
        });
      } else {
        breakdown400ml = calculateServingBreakdown({
          sizeLabel: '400ml',
          servingMl: product.servingMl['400ml'] || 400,
          rawCostPerLiter,
          packagingCost: product.packaging['400ml'] || 0,
          sellingPrice: product.prices['400ml'] || 0,
          isComplete
        });

        breakdown1L = calculateServingBreakdown({
          sizeLabel: '1L',
          servingMl: product.servingMl['1L'] || 1000,
          rawCostPerLiter,
          packagingCost: product.packaging['1L'] || 0,
          sellingPrice: product.prices['1L'] || 0,
          isComplete
        });
      }

      return {
        product,
        recipe,
        batchCost,
        rawCostPerLiter,
        breakdown400ml,
        breakdown1L,
        isComplete,
        statusText
      };
    });
  }, [state.products, state.recipes, recipesMap, ingredientsMap]);

  const totalMonthlyExpenses = useMemo(() => {
    return state.expenses.reduce((sum, exp) => sum + exp.monthlyAmount, 0);
  }, [state.expenses]);

  const averageContributionMargin = useMemo(() => {
    const valid = calculatedProducts.filter(p => p.isComplete && p.breakdown400ml.sellingPrice > 0);
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, p) => acc + p.breakdown400ml.contributionMarginPercent, 0);
    return roundMoney(sum / valid.length);
  }, [calculatedProducts]);

  const incompleteRecipesCount = useMemo(() => {
    return calculatedProducts.filter(p => !p.isComplete).length;
  }, [calculatedProducts]);

  // INGREDIENT ACTIONS
  const updateIngredientPrice = (id: string, newPrice: number, note?: string) => {
    setState(prev => {
      const today = new Date().toISOString().split('T')[0];
      const updatedIngredients = prev.ingredients.map(ing => {
        if (ing.id !== id) return ing;
        const newHistory = [
          { date: today, price: newPrice, note: note || 'تحديث يدوي للسعر' },
          ...ing.priceHistory
        ];
        const tempIng = { ...ing, currentPrice: newPrice };
        return {
          ...ing,
          currentPrice: newPrice,
          pricePerBaseUnit: calculateBaseUnitCost(tempIng),
          lastUpdated: today,
          priceHistory: newHistory
        };
      });
      return { ...prev, ingredients: updatedIngredients };
    });
    showToast(`تم تحديث سعر الخامة بنجاح وتحديث الوصفات تلقائياً`);
  };

  const saveIngredient = (ingredient: Ingredient) => {
    setState(prev => {
      const exists = prev.ingredients.some(i => i.id === ingredient.id);
      let updatedIngredients: Ingredient[];
      if (exists) {
        updatedIngredients = prev.ingredients.map(i => i.id === ingredient.id ? ingredient : i);
      } else {
        updatedIngredients = [...prev.ingredients, ingredient];
      }
      return { ...prev, ingredients: updatedIngredients };
    });
    ApiClient.saveIngredient(ingredient).catch(err => console.warn('SQLite ingredient sync error:', err));
    showToast(`تم حفظ بيانات الخامة [${ingredient.nameAr}] بنجاح`);
  };

  const deleteIngredient = (id: string) => {
    const isUsed = state.recipes.some(r => r.ingredients.some(it => it.ingredientId === id));
    if (isUsed) {
      showToast(`لا يمكن حذف هذه الخامة لأنها مستخدمة داخل وصفات مسجلة`);
      return;
    }
    setState(prev => ({
      ...prev,
      ingredients: prev.ingredients.filter(i => i.id !== id)
    }));
    showToast(`تم حذف الخامة`);
  };

  // RECIPE ACTIONS
  const saveRecipe = (recipe: Recipe) => {
    setState(prev => {
      const exists = prev.recipes.some(r => r.id === recipe.id);
      let updatedRecipes: Recipe[];
      if (exists) {
        updatedRecipes = prev.recipes.map(r => r.id === recipe.id ? recipe : r);
      } else {
        updatedRecipes = [...prev.recipes, recipe];
      }
      const updatedProducts = prev.products.map(p => {
        if (p.recipeId === recipe.id) {
          return { ...p, isComplete: recipe.isComplete };
        }
        return p;
      });
      return { ...prev, recipes: updatedRecipes, products: updatedProducts };
    });
    showToast(`تم حفظ الوصفة وتحديث تكاليف المنتجات`);
  };

  const deleteRecipe = (id: string) => {
    const isUsed = state.products.some(p => p.recipeId === id);
    if (isUsed) {
      showToast(`لا يمكن حذف هذه الوصفة لأنها مرتبطة بمنتج في المنيو`);
      return;
    }
    setState(prev => ({
      ...prev,
      recipes: prev.recipes.filter(r => r.id !== id)
    }));
    showToast(`تم حذف الوصفة`);
  };

  const duplicateRecipe = (id: string) => {
    const source = recipesMap[id];
    if (!source) return;
    const newRecipe: Recipe = {
      ...source,
      id: `rec_${Date.now()}`,
      nameAr: `${source.nameAr} (نسخة جديدة)`,
      lastUpdated: new Date().toISOString().split('T')[0]
    };
    saveRecipe(newRecipe);
    showToast(`تم نسخ الوصفة بنجاح، يمكنك تعديلها الآن`);
  };

  // PRODUCT ACTIONS
  const saveProduct = (product: Product, recipe?: Recipe) => {
    setState(prev => {
      let updatedRecipes = [...prev.recipes];
      if (recipe) {
        const rIndex = updatedRecipes.findIndex(r => r.id === recipe.id);
        if (rIndex >= 0) {
          updatedRecipes[rIndex] = recipe;
        } else {
          updatedRecipes.push(recipe);
        }
      }
      const pIndex = prev.products.findIndex(p => p.id === product.id);
      let updatedProducts = [...prev.products];
      if (pIndex >= 0) {
        updatedProducts[pIndex] = product;
      } else {
        updatedProducts.push(product);
      }
      return { ...prev, products: updatedProducts, recipes: updatedRecipes };
    });
    showToast(`تم حفظ المنتج [${product.nameAr}] بنجاح`);
  };

  const deleteProduct = (id: string) => {
    setState(prev => ({
      ...prev,
      products: prev.products.filter(p => p.id !== id)
    }));
    showToast(`تم حذف المنتج من المنيو`);
  };

  // EXPENSE ACTIONS
  const saveExpense = (expense: ExpenseItem) => {
    setState(prev => {
      const exists = prev.expenses.some(e => e.id === expense.id);
      let updatedExpenses: ExpenseItem[];
      if (exists) {
        updatedExpenses = prev.expenses.map(e => e.id === expense.id ? expense : e);
      } else {
        updatedExpenses = [...prev.expenses, expense];
      }
      return { ...prev, expenses: updatedExpenses };
    });
    showToast(`تم حفظ بند المصروف`);
  };

  const deleteExpense = (id: string) => {
    setState(prev => ({
      ...prev,
      expenses: prev.expenses.filter(e => e.id !== id)
    }));
    showToast(`تم حذف البند`);
  };

  // PURCHASE INVOICE ACTIONS
  const saveInvoice = (invoice: PurchaseInvoice) => {
    let resolvedInvoice = { ...invoice };
    setState(prev => {
      const existingInvoices = prev.invoices || [];
      const index = existingInvoices.findIndex(
        inv => inv.id === invoice.id || (Boolean(invoice.invoiceNumber) && inv.invoiceNumber === invoice.invoiceNumber)
      );
      let updatedInvoices: PurchaseInvoice[];
      if (index >= 0) {
        resolvedInvoice = { ...invoice, id: existingInvoices[index].id };
        updatedInvoices = [...existingInvoices];
        updatedInvoices[index] = resolvedInvoice;
      } else {
        updatedInvoices = [resolvedInvoice, ...existingInvoices];
      }
      return { ...prev, invoices: updatedInvoices };
    });
    ApiClient.saveInvoice(resolvedInvoice).catch(err => console.warn('SQLite invoice sync error:', err));
    showToast(`تم حفظ فاتورة المشتريات #${resolvedInvoice.invoiceNumber}`);
  };

  const approveInvoice = (invoiceOrId: string | PurchaseInvoice): { success: boolean; message: string } => {
    let result = { success: false, message: '' };
    setState(prev => {
      const existingInvoices = prev.invoices || [];
      const targetInvoice = typeof invoiceOrId === 'string'
        ? existingInvoices.find(inv => inv.id === invoiceOrId)
        : invoiceOrId;

      if (!targetInvoice) {
        result = { success: false, message: 'لم يتم العثور على الفاتورة المطلوبة' };
        return prev;
      }

      if (targetInvoice.status === 'approved') {
        result = { success: false, message: 'هذه الفاتورة معتمدة ومرحّلة بالفعل إلى المخزون' };
        return prev;
      }

      const today = new Date().toISOString().split('T')[0];
      const updatedIngredients = [...prev.ingredients];

      for (const item of targetInvoice.items) {
        const ingIndex = updatedIngredients.findIndex(i => i.id === item.ingredientId);
        if (ingIndex === -1) continue;

        const currentIng = updatedIngredients[ingIndex];
        const currentStock = currentIng.stockQuantity || 0;
        const currentUnitCost = currentIng.currentPrice;

        let addedStockQuantity = 0;
        const incomingUnitCost = item.unitPrice;

        if (item.pricingMethod === 'by_weight') {
          addedStockQuantity = Number(item.totalWeightKg) || 0;
        } else {
          addedStockQuantity = Number(item.packageCount) || 1;
        }

        const newCalculatedPrice = calculateWeightedAverageCost({
          currentStock,
          currentPrice: currentUnitCost,
          incomingQuantity: addedStockQuantity,
          incomingPrice: incomingUnitCost
        });

        const newStockQuantity = roundMoney(currentStock + addedStockQuantity);

        const priceHistoryEntry = {
          date: today,
          price: incomingUnitCost,
          note: `فاتورة مشتريات #${targetInvoice.invoiceNumber} - مورد: ${targetInvoice.supplierName} (متوسط موزون: ${newCalculatedPrice} ج)`
        };

        const tempUpdatedIng = { ...currentIng, currentPrice: newCalculatedPrice };
        const modifiedIng: Ingredient = {
          ...currentIng,
          currentPrice: newCalculatedPrice,
          pricePerBaseUnit: calculateBaseUnitCost(tempUpdatedIng),
          stockQuantity: newStockQuantity,
          lastUpdated: today,
          priceHistory: [priceHistoryEntry, ...currentIng.priceHistory]
        };

        updatedIngredients[ingIndex] = modifiedIng;
      }

      const approvedInvoice: PurchaseInvoice = {
        ...targetInvoice,
        status: 'approved',
        approvedAt: new Date().toISOString()
      };

      const updatedInvoices = existingInvoices.map(inv =>
        inv.id === targetInvoice.id ? approvedInvoice : inv
      );

      if (!existingInvoices.some(inv => inv.id === targetInvoice.id)) {
        updatedInvoices.unshift(approvedInvoice);
      }

      result = {
        success: true,
        message: `تم اعتماد الفاتورة #${targetInvoice.invoiceNumber} وتحديث أرصدة المخزون وحساب المتوسط الموزون للخامات`
      };

      return {
        ...prev,
        ingredients: updatedIngredients,
        invoices: updatedInvoices
      };
    });

    if (result.success) {
      const target = state.invoices.find(inv => typeof invoiceOrId === 'string' ? inv.id === invoiceOrId : inv.id === invoiceOrId.id);
      if (target) {
        ApiClient.saveInvoice({ ...target, status: 'approved' }).catch(err => console.warn('SQLite approve sync error:', err));
      }
      showToast(result.message);
    }
    return result;
  };

  const reverseInvoice = (invoiceId: string, reason: string): { success: boolean; message: string } => {
    let result = { success: false, message: '' };
    setState(prev => {
      const existingInvoices = prev.invoices || [];
      const targetInvoice = existingInvoices.find(inv => inv.id === invoiceId);

      if (!targetInvoice) {
        result = { success: false, message: 'لم يتم العثور على الفاتورة' };
        return prev;
      }

      if (targetInvoice.status !== 'approved') {
        result = { success: false, message: 'يمكن فقط عكس الفواتير المعتمدة' };
        return prev;
      }

      const today = new Date().toISOString().split('T')[0];
      const updatedIngredients = [...prev.ingredients];

      for (const item of targetInvoice.items) {
        const ingIndex = updatedIngredients.findIndex(i => i.id === item.ingredientId);
        if (ingIndex === -1) continue;

        const currentIng = updatedIngredients[ingIndex];
        const currentStock = currentIng.stockQuantity || 0;

        let quantityToDeduct = 0;
        if (item.pricingMethod === 'by_weight') {
          quantityToDeduct = Number(item.totalWeightKg) || 0;
        } else {
          quantityToDeduct = Number(item.packageCount) || 1;
        }

        const newStock = Math.max(0, roundMoney(currentStock - quantityToDeduct));
        const priceHistoryEntry = {
          date: today,
          price: currentIng.currentPrice,
          note: `عكس فاتورة مشتريات #${targetInvoice.invoiceNumber} - السبب: ${reason || 'تصحيح أخطاء'}`
        };

        const modifiedIng: Ingredient = {
          ...currentIng,
          stockQuantity: newStock,
          lastUpdated: today,
          priceHistory: [priceHistoryEntry, ...currentIng.priceHistory]
        };

        updatedIngredients[ingIndex] = modifiedIng;
      }

      const reversedInvoice: PurchaseInvoice = {
        ...targetInvoice,
        status: 'reversed',
        reversedAt: new Date().toISOString(),
        reversalReason: reason
      };

      const updatedInvoices = existingInvoices.map(inv =>
        inv.id === invoiceId ? reversedInvoice : inv
      );

      result = {
        success: true,
        message: `تم عكس الفاتورة #${targetInvoice.invoiceNumber} وخصم الكميات من المخزون`
      };

      return {
        ...prev,
        ingredients: updatedIngredients,
        invoices: updatedInvoices
      };
    });

    if (result.success) {
      showToast(result.message);
    }
    return result;
  };

  const deleteInvoice = (invoiceId: string): { success: boolean; message: string } => {
    let result = { success: false, message: '' };
    setState(prev => {
      const existingInvoices = prev.invoices || [];
      const targetInvoice = existingInvoices.find(inv => inv.id === invoiceId);

      if (!targetInvoice) {
        result = { success: false, message: 'لم يتم العثور على الفاتورة' };
        return prev;
      }

      if (targetInvoice.status === 'approved') {
        result = {
          success: false,
          message: 'لا يمكن حذف فاتورة معتمدة لحماية القيود المحاسبية. يمكنك عكس الفاتورة لإلغاء أثرها المخزني.'
        };
        return prev;
      }

      const updatedInvoices = existingInvoices.filter(inv => inv.id !== invoiceId);
      result = { success: true, message: `تم حذف مسودة الفاتورة #${targetInvoice.invoiceNumber}` };

      return { ...prev, invoices: updatedInvoices };
    });

    if (result.success) {
      showToast(result.message);
    }
    return result;
  };

  // ==========================================
  // POS & ORDER ENGINE OPERATIONS
  // ==========================================

  const createNewOrder = (orderType: OrderType = 'dine_in'): PosOrder => {
    const orderCount = (state.orders || []).length + 1;
    const orderNumber = `ORD-${String(orderCount).padStart(3, '0')}`;
    const newOrder: PosOrder = {
      id: `ord_${Date.now()}`,
      orderNumber,
      orderType,
      items: [],
      subtotal: 0,
      discountAmount: 0,
      deliveryFee: 0,
      totalAmount: 0,
      orderStatus: 'draft',
      paymentStatus: 'pending',
      preparationStatus: 'queued',
      cashierId: currentCashier.id,
      cashierName: currentCashier.nameAr,
      shiftId: currentShift ? currentShift.id : 'shift_01',
      totalRefundedAmount: 0,
      createdAt: new Date().toISOString()
    };
    setActiveOrder(newOrder);
    return newOrder;
  };

  const addItemToOrder = (
    product: Product,
    servingSize: ServingSize,
    modifiers?: Partial<OrderItemModifier>
  ) => {
    let current = activeOrder;
    if (!current) {
      current = createNewOrder('takeaway');
    }

    const price = product.prices[servingSize] || 0;
    const itemMods: OrderItemModifier = {
      sugarLevel: modifiers?.sugarLevel || 'standard',
      iceLevel: modifiers?.iceLevel || 'standard',
      extraNotes: modifiers?.extraNotes || ''
    };

    const existingIndex = current.items.findIndex(
      it => it.productId === product.id &&
            it.servingSize === servingSize &&
            it.modifiers.sugarLevel === itemMods.sugarLevel &&
            it.modifiers.iceLevel === itemMods.iceLevel &&
            it.modifiers.extraNotes === itemMods.extraNotes
    );

    let updatedItems: PosOrderItem[];
    if (existingIndex >= 0) {
      updatedItems = [...current.items];
      const existing = updatedItems[existingIndex];
      const newQty = existing.quantity + 1;
      updatedItems[existingIndex] = {
        ...existing,
        quantity: newQty,
        totalPrice: roundMoney(existing.unitPrice * newQty)
      };
    } else {
      const newItem: PosOrderItem = {
        id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        productId: product.id,
        productNameAr: product.nameAr,
        recipeId: product.recipeId,
        servingSize,
        unitPrice: price,
        quantity: 1,
        modifiers: itemMods,
        totalPrice: price
      };
      updatedItems = [...current.items, newItem];
    }

    const totals = calculateOrderTotals({
      items: updatedItems,
      discountAmount: current.discountAmount,
      deliveryFee: current.deliveryFee
    });

    const updatedOrder: PosOrder = {
      ...current,
      items: updatedItems,
      ...totals
    };

    setActiveOrder(updatedOrder);
  };

  const updateOrderItemQuantity = (itemId: string, newQuantity: number) => {
    if (!activeOrder) return;
    if (newQuantity <= 0) {
      removeOrderItem(itemId);
      return;
    }

    const updatedItems = activeOrder.items.map(it => {
      if (it.id !== itemId) return it;
      return {
        ...it,
        quantity: newQuantity,
        totalPrice: roundMoney(it.unitPrice * newQuantity)
      };
    });

    const totals = calculateOrderTotals({
      items: updatedItems,
      discountAmount: activeOrder.discountAmount,
      deliveryFee: activeOrder.deliveryFee
    });

    setActiveOrder({
      ...activeOrder,
      items: updatedItems,
      ...totals
    });
  };

  const removeOrderItem = (itemId: string) => {
    if (!activeOrder) return;
    const updatedItems = activeOrder.items.filter(it => it.id !== itemId);
    const totals = calculateOrderTotals({
      items: updatedItems,
      discountAmount: activeOrder.discountAmount,
      deliveryFee: activeOrder.deliveryFee
    });

    setActiveOrder({
      ...activeOrder,
      items: updatedItems,
      ...totals
    });
  };

  const updateOrderModifiers = (itemId: string, modifiers: OrderItemModifier) => {
    if (!activeOrder) return;
    const updatedItems = activeOrder.items.map(it => {
      if (it.id !== itemId) return it;
      return { ...it, modifiers };
    });
    setActiveOrder({ ...activeOrder, items: updatedItems });
  };

  const setOrderType = (orderType: OrderType) => {
    if (!activeOrder) return;
    const calculatedFee = orderType === 'delivery' ? (activeOrder.deliveryFee || 20) : 0;
    const totals = calculateOrderTotals({
      items: activeOrder.items,
      discountAmount: activeOrder.discountAmount,
      deliveryFee: calculatedFee
    });

    setActiveOrder({
      ...activeOrder,
      orderType,
      ...totals
    });
  };

  const applyOrderDiscount = (discountAmount: number, promotionId?: string, promotionNameAr?: string) => {
    if (!activeOrder) return;
    const totals = calculateOrderTotals({
      items: activeOrder.items,
      discountAmount,
      deliveryFee: activeOrder.deliveryFee
    });

    setActiveOrder({
      ...activeOrder,
      promotionId,
      promotionNameAr,
      ...totals
    });
  };

  const setDeliveryDetails = (
    customerName: string,
    customerPhone: string,
    deliveryAddress: string,
    deliveryFee: number = 20
  ) => {
    if (!activeOrder) return;
    const totals = calculateOrderTotals({
      items: activeOrder.items,
      discountAmount: activeOrder.discountAmount,
      deliveryFee
    });

    setActiveOrder({
      ...activeOrder,
      customerName,
      customerPhone,
      deliveryAddress,
      ...totals
    });
  };

  const saveCurrentOrderAsDraft = () => {
    if (!activeOrder || activeOrder.items.length === 0) {
      showToast('لا توجد أصناف في الطلب للحفظ');
      return;
    }
    setState(prev => {
      const orders = prev.orders || [];
      const idx = orders.findIndex(o => o.id === activeOrder.id);
      let updated: PosOrder[];
      if (idx >= 0) {
        updated = [...orders];
        updated[idx] = activeOrder;
      } else {
        updated = [activeOrder, ...orders];
      }
      return { ...prev, orders: updated };
    });
    showToast(`تم حفظ الطلب ${activeOrder.orderNumber} كمسودة مؤقتة`);
    setActiveOrder(null);
  };

  const completeOrderWithoutPayment = (orderId: string): { success: boolean; message: string } => {
    let res = { success: false, message: '' };
    setState(prev => {
      const orders = prev.orders || [];
      const ord = orders.find(o => o.id === orderId);
      if (!ord) {
        res = { success: false, message: 'لم يتم العثور على الطلب' };
        return prev;
      }

      const updatedOrd: PosOrder = {
        ...ord,
        orderStatus: 'pending',
        preparationStatus: 'queued'
      };

      const updated = orders.map(o => o.id === orderId ? updatedOrd : o);
      res = { success: true, message: `تم إرسال الطلب #${ord.orderNumber} إلى المطبخ بنجاح` };
      return { ...prev, orders: updated };
    });
    return res;
  };

  // PROCESS PAYMENT & INVENTORY DEDUCTION
  const processOrderPayment = (params: {
    orderId: string;
    amount: number;
    method: PaymentMethodType;
    tendered?: number;
    instapayRef?: string;
    instapayVerification?: 'merchant_app' | 'bank_sms' | 'manual_review';
    instapayEvidenceName?: string;
    terminalId?: string;
    cardRef?: string;
    cardType?: 'visa' | 'mastercard' | 'other';
  }): { success: boolean; payment?: PaymentRecord; order?: PosOrder; message: string } => {
    const {
      orderId,
      amount,
      method,
      tendered,
      instapayRef,
      instapayVerification,
      instapayEvidenceName,
      terminalId,
      cardRef,
      cardType
    } = params;

    let resultPayment: PaymentRecord | undefined;
    let resultOrder: PosOrder | undefined;
    let response = { success: false, message: '', payment: resultPayment, order: resultOrder };

    setState(prev => {
      const orders = prev.orders || [];
      const order = orders.find(o => o.id === orderId) || (activeOrder?.id === orderId ? activeOrder : null);

      if (!order) {
        response = { success: false, message: 'الطلب غير موجود في النظام', payment: undefined, order: undefined };
        return prev;
      }

      if (order.items.length === 0) {
        response = { success: false, message: 'لا توجد أصناف في الطلب لسداد قيمتها', payment: undefined, order: undefined };
        return prev;
      }

      const now = new Date().toISOString();
      const today = now.split('T')[0];

      // Electronic fee snapshot calculation
      let feeSnapshot: PaymentFeeSnapshot | undefined = undefined;
      if (method === 'card' || method === 'instapay') {
        const applicableRule = findApplicableFeeRule({
          providerName: terminalId ? 'Banque Misr Terminal' : (method === 'instapay' ? 'InstaPay' : undefined),
          paymentMethod: method,
          transactionDate: today,
          rules: prev.paymentFeeRules || []
        });

        const calculatedSnap = calculatePaymentFeeSnapshot({
          grossAmount: amount,
          rule: applicableRule,
          providerNameFallback: terminalId ? 'Banque Misr' : 'InstaPay'
        });

        if (calculatedSnap) {
          feeSnapshot = calculatedSnap;
        }
      }

      // Create Payment Record
      const paymentRecord: PaymentRecord = {
        id: `pay_${Date.now()}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: roundMoney(amount),
        method,
        status: 'verified',
        timestamp: now,
        cashierId: currentCashier.id,
        cashierShiftId: currentShift ? currentShift.id : 'shift_01',
        amountTendered: method === 'cash' ? Number(tendered) || amount : undefined,
        changeDue: method === 'cash' ? Math.max(0, roundMoney((Number(tendered) || amount) - amount)) : undefined,
        amountReceived: amount,
        instapayReference: instapayRef,
        verificationMethod: instapayVerification || 'merchant_app',
        verificationTimestamp: method === 'instapay' ? now : undefined,
        verifiedByEmployeeId: method === 'instapay' ? currentCashier.id : undefined,
        evidenceAttachmentName: instapayEvidenceName,
        terminalId,
        cardTransactionReference: cardRef,
        cardType: cardType || 'visa',
        feeSnapshot
      };

      // Update Order Status
      const updatedOrder: PosOrder = {
        ...order,
        orderStatus: 'completed',
        paymentStatus: 'paid',
        paidAt: now,
        completedAt: now,
        preparationStatus: order.preparationStatus === 'delivered' ? 'delivered' : 'queued'
      };

      // Inventory deductions for recipes
      const deductions = calculateOrderIngredientDeductions({
        order: updatedOrder,
        recipesMap,
        ingredientsMap
      });

      const updatedIngredients = prev.ingredients.map(ing => {
        const deduction = deductions[ing.id];
        if (!deduction || deduction.quantityDeducted <= 0) return ing;
        const currentStock = ing.stockQuantity || 0;
        const newStock = Math.max(0, roundMoney(currentStock - deduction.quantityDeducted));
        return {
          ...ing,
          stockQuantity: newStock
        };
      });

      // Update Shift Drawer Cash (ONLY FOR CASH TRANSACTIONS!)
      const updatedShifts = (prev.shifts || []).map(shift => {
        const isTargetShift = currentShift ? shift.id === currentShift.id : shift.status === 'open';
        if (!isTargetShift) return shift;

        let cashReceived = shift.cashReceived;
        if (method === 'cash') {
          cashReceived = roundMoney(cashReceived + amount);
        }

        const expectedCash = calculateExpectedDrawerCash({
          openingFloat: shift.openingFloat,
          cashReceived,
          cashDeposits: shift.cashDeposits,
          cashRefunds: shift.cashRefunds,
          cashExpenses: shift.cashExpenses,
          cashWithdrawals: shift.cashWithdrawals
        });

        return {
          ...shift,
          cashReceived,
          expectedCash
        };
      });

      // Update orders list
      const existingOrders = prev.orders || [];
      const orderExists = existingOrders.some(o => o.id === updatedOrder.id);
      const updatedOrders = orderExists
        ? existingOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o)
        : [updatedOrder, ...existingOrders];

      resultPayment = paymentRecord;
      resultOrder = updatedOrder;

      response = {
        success: true,
        message: `تم سداد الطلب #${order.orderNumber} بنجاح (${method === 'cash' ? 'نقدي' : method === 'instapay' ? 'إنستاباي' : 'فيزا'}) وخصم الخامات من المخزون`,
        payment: paymentRecord,
        order: updatedOrder
      };

      return {
        ...prev,
        orders: updatedOrders,
        payments: [paymentRecord, ...(prev.payments || [])],
        ingredients: updatedIngredients,
        shifts: updatedShifts
      };
    });

    if (response.success && resultOrder) {
      ApiClient.createOrder(resultOrder).catch(err => console.warn('SQLite order sync error:', err));
      if (resultPayment) {
        ApiClient.recordPayment(resultPayment).catch(err => console.warn('SQLite payment sync error:', err));
      }
      setReceiptModalData({ order: resultOrder, payment: resultPayment });
      setActiveOrder(null);
      setIsPaymentModalOpen(false);
      showToast(response.message);
    }

    return response;
  };

  const cancelOrder = (orderId: string, reason: string): { success: boolean; message: string } => {
    let res = { success: false, message: '' };
    setState(prev => {
      const orders = prev.orders || [];
      const order = orders.find(o => o.id === orderId);

      if (!order) {
        res = { success: false, message: 'الطلب غير موجود' };
        return prev;
      }

      if (order.orderStatus === 'cancelled') {
        res = { success: false, message: 'الطلب ملغى بالفعل' };
        return prev;
      }

      const now = new Date().toISOString();

      let newWastes: DrinkWasteEntry[] = [];
      if (order.preparationStatus === 'ready' || order.preparationStatus === 'preparing') {
        newWastes = calculateDrinkWaste({
          order,
          cashierId: currentCashier.id,
          reason: `إلغاء طلب #${order.orderNumber}: ${reason}`
        });
      }

      const cancelledOrder: PosOrder = {
        ...order,
        orderStatus: 'cancelled',
        preparationStatus: 'suspended',
        cancelledAt: now,
        cancellationReason: reason
      };

      const updatedOrders = orders.map(o => o.id === orderId ? cancelledOrder : o);

      res = {
        success: true,
        message: `تم إلغاء الطلب #${order.orderNumber} بنجاح${newWastes.length > 0 ? ` وتسجيل هدر ${newWastes.length} مشروبات جاهزة` : ''}`
      };

      return {
        ...prev,
        orders: updatedOrders,
        drinkWastes: [...newWastes, ...(prev.drinkWastes || [])]
      };
    });

    if (res.success) {
      if (activeOrder?.id === orderId) {
        setActiveOrder(null);
      }
      showToast(res.message);
    }
    return res;
  };

  const updatePreparationStatus = (orderId: string, prepStatus: PreparationStatus) => {
    setState(prev => {
      const orders = prev.orders || [];
      const updated = orders.map(o => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          preparationStatus: prepStatus,
          preparedAt: prepStatus === 'ready' ? new Date().toISOString() : o.preparedAt
        };
      });
      return { ...prev, orders: updated };
    });
    showToast(`تم تحديث حالة تجهيز الطلب إلى: ${prepStatus === 'ready' ? 'جاهز للاستلام' : prepStatus === 'delivered' ? 'تم التسليم' : 'قيد التحضير'}`);
  };

  // REFUNDS & MANAGER AUTHORIZATION
  const processRefund = (params: {
    orderId: string;
    amount: number;
    method: PaymentMethodType;
    reason: string;
    isPreparedDrinkWaste?: boolean;
    wasteNotes?: string;
  }): {
    success: boolean;
    requiresApproval: boolean;
    approvalRequest?: ManagerApprovalRequest;
    refund?: RefundRecord;
    message: string;
  } => {
    const { orderId, amount, method, reason, isPreparedDrinkWaste, wasteNotes } = params;

    const order = (state.orders || []).find(o => o.id === orderId);
    if (!order) {
      return { success: false, requiresApproval: false, message: 'الطلب غير موجود في السجلات' };
    }

    const existingRefunds = state.refunds || [];
    const evalResult = evaluateRefundEligibility({
      order,
      refundAmount: amount,
      refundMethod: method,
      reason,
      existingRefunds
    });

    if (evalResult.errorMessage) {
      return { success: false, requiresApproval: false, message: evalResult.errorMessage };
    }

    const now = new Date().toISOString();

    if (evalResult.requiresManagerApproval) {
      const requestType: ApprovalRequestType = 
        method !== 'cash' ? 'electronic_refund' : 'cash_refund_over_limit';

      const approvalReq = createManagerApprovalRequest({
        requestType,
        requestedByCashierId: currentCashier.id,
        requestedByCashierName: currentCashier.nameAr,
        reason: `${reason} (${method === 'cash' ? `مبلغ ${amount} ج يتجاوز حد الكاشير 200 ج` : `استرداد إلكتروني ${method}`})`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        shiftId: currentShift ? currentShift.id : undefined,
        amount,
        ttlMinutes: 20
      });

      setState(prev => ({
        ...prev,
        approvalRequests: [approvalReq, ...(prev.approvalRequests || [])]
      }));

      showToast(`تم إرسال طلب استرداد بمبلغ ${amount} ج إلى [مركز موافقات المدير] بانتظار الاعتماد`);
      return {
        success: false,
        requiresApproval: true,
        approvalRequest: approvalReq,
        message: 'يتطلب هذا الاسترداد موافقة المدير بالرقم السري'
      };
    }

    // Direct Cashier Cash Refund <= 200 EGP
    const refundRecord: RefundRecord = {
      id: `ref_${Date.now()}`,
      orderId: order.id,
      orderNumber: order.orderNumber,
      amount: roundMoney(amount),
      method,
      reason,
      cashierId: currentCashier.id,
      cashierName: currentCashier.nameAr,
      shiftId: currentShift ? currentShift.id : 'shift_01',
      timestamp: now,
      requiresManagerApproval: false,
      status: 'completed',
      isPreparedDrinkWaste: Boolean(isPreparedDrinkWaste),
      wasteNotes
    };

    let wasteEntries: DrinkWasteEntry[] = [];
    if (isPreparedDrinkWaste) {
      wasteEntries = calculateDrinkWaste({
        order,
        cashierId: currentCashier.id,
        reason: `إهدار عند الاسترداد #${order.orderNumber}: ${reason}`
      });
    }

    setState(prev => {
      const newTotalRefunded = roundMoney(order.totalRefundedAmount + amount);
      const isFullyRefunded = newTotalRefunded >= order.totalAmount;
      const updatedOrders = (prev.orders || []).map(o => {
        if (o.id !== order.id) return o;
        return {
          ...o,
          totalRefundedAmount: newTotalRefunded,
          paymentStatus: (isFullyRefunded ? 'refunded' : 'partial') as PaymentStatus
        };
      });

      const updatedShifts = (prev.shifts || []).map(s => {
        const isTarget = currentShift ? s.id === currentShift.id : s.status === 'open';
        if (!isTarget) return s;

        const newCashRefunds = roundMoney(s.cashRefunds + amount);
        const expectedCash = calculateExpectedDrawerCash({
          openingFloat: s.openingFloat,
          cashReceived: s.cashReceived,
          cashDeposits: s.cashDeposits,
          cashRefunds: newCashRefunds,
          cashExpenses: s.cashExpenses,
          cashWithdrawals: s.cashWithdrawals
        });

        return {
          ...s,
          cashRefunds: newCashRefunds,
          expectedCash
        };
      });

      return {
        ...prev,
        orders: updatedOrders,
        refunds: [refundRecord, ...(prev.refunds || [])],
        shifts: updatedShifts,
        drinkWastes: [...wasteEntries, ...(prev.drinkWastes || [])]
      };
    });

    showToast(`تم تنفيذ الاسترداد النقدي بمبلغ ${amount} ج لصالح العميل بنجاح`);
    return {
      success: true,
      requiresApproval: false,
      refund: refundRecord,
      message: 'تم تسجيل الاسترداد وخصمه من الدرج النقدي'
    };
  };

  // SHIFT OPERATIONS
  const openNewShift = (cashierId: string, openingFloat: number = STANDARD_SHIFT_FLOAT_EGP): {
    success: boolean;
    shift?: CashierShift;
    message: string;
  } => {
    const cashier = cashiersMap[cashierId];
    if (!cashier) {
      return { success: false, message: 'الكاشير المحدد غير موجود' };
    }

    const openCount = (state.shifts || []).filter(s => s.status === 'open').length;
    if (openCount > 0) {
      return { success: false, message: 'توجد وردية مفتوحة بالفعل، يجب تسليمها وإغلاقها أولاً' };
    }

    const nextShiftNumber = (state.shifts || []).length + 1;
    const now = new Date().toISOString();

    const newShift: CashierShift = {
      id: `shift_${Date.now()}`,
      shiftNumber: nextShiftNumber,
      cashierId: cashier.id,
      cashierName: cashier.nameAr,
      startTime: now,
      status: 'open',
      openingFloat: roundMoney(openingFloat),
      cashReceived: 0,
      cashDeposits: 0,
      cashRefunds: 0,
      cashExpenses: 0,
      cashWithdrawals: 0,
      expectedCash: roundMoney(openingFloat)
    };

    setState(prev => ({
      ...prev,
      shifts: [newShift, ...(prev.shifts || [])]
    }));

    ApiClient.openShift(newShift).catch(err => console.warn('SQLite shift open error:', err));

    setCurrentCashierId(cashier.id);
    showToast(`تم فتح الوردية رقم ${nextShiftNumber} بنجاح للكاشير [${cashier.nameAr}] بعهدة بداية 500 ج`);
    return { success: true, shift: newShift, message: 'تم فتح الوردية' };
  };

  const handoverShift = (params: {
    shiftId: string;
    nextCashierId: string;
    actualCashCounted: number;
    withdrawalAmount?: number;
    notes?: string;
  }): { success: boolean; discrepancy: number; message: string } => {
    const { shiftId, nextCashierId, actualCashCounted, withdrawalAmount = 0, notes } = params;

    const shift = (state.shifts || []).find(s => s.id === shiftId);
    if (!shift) {
      return { success: false, discrepancy: 0, message: 'الوردية غير موجودة' };
    }

    const nextCashier = cashiersMap[nextCashierId];
    if (!nextCashier) {
      return { success: false, discrepancy: 0, message: 'الكاشير المستلم غير محدد' };
    }

    const reconciliation = reconcileShiftHandover({
      shift,
      actualCashCounted,
      handoverCashierId: nextCashier.id,
      handoverCashierName: nextCashier.nameAr,
      withdrawalAmount,
      reconciliationNotes: notes
    });

    const now = new Date().toISOString();
    const closedShift: CashierShift = {
      ...shift,
      status: 'closed',
      actualCashCounted: reconciliation.actualCashCounted,
      discrepancy: reconciliation.discrepancy,
      handoverCashierId: nextCashier.id,
      handoverCashierName: nextCashier.nameAr,
      handoverConfirmedAt: now,
      endTime: now,
      closedAt: now,
      cashWithdrawals: roundMoney(shift.cashWithdrawals + withdrawalAmount),
      reconciliationNotes: notes
    };

    const nextShiftNumber = (state.shifts || []).length + 1;
    const nextShift: CashierShift = {
      id: `shift_${Date.now()}_next`,
      shiftNumber: nextShiftNumber,
      cashierId: nextCashier.id,
      cashierName: nextCashier.nameAr,
      startTime: now,
      status: 'open',
      openingFloat: STANDARD_SHIFT_FLOAT_EGP,
      cashReceived: 0,
      cashDeposits: 0,
      cashRefunds: 0,
      cashExpenses: 0,
      cashWithdrawals: 0,
      expectedCash: STANDARD_SHIFT_FLOAT_EGP
    };

    setState(prev => {
      const updatedShifts = (prev.shifts || []).map(s => s.id === shiftId ? closedShift : s);
      return {
        ...prev,
        shifts: [nextShift, ...updatedShifts]
      };
    });

    ApiClient.closeShift(shiftId, actualCashCounted, notes).catch(err => console.warn('SQLite shift close error:', err));
    ApiClient.openShift(nextShift).catch(err => console.warn('SQLite next shift open error:', err));

    setCurrentCashierId(nextCashier.id);
    const discText = reconciliation.discrepancy === 0 
      ? 'مطابقة تامة' 
      : reconciliation.discrepancy > 0 
        ? `زيادة ${reconciliation.discrepancy} ج` 
        : `عجز ${Math.abs(reconciliation.discrepancy)} ج`;

    showToast(`تم إغلاق الوردية وتسليم الكاشير الجديد [${nextCashier.nameAr}]. نتيجة الجرد: ${discText}`);
    return {
      success: true,
      discrepancy: reconciliation.discrepancy,
      message: `تم التسليم بنجاح (${discText})`
    };
  };

  // MANAGER APPROVALS
  const approveManagerRequest = (
    requestId: string,
    pin: string,
    managerName: string = 'المدير المسؤول',
    notes?: string
  ): { success: boolean; message: string } => {
    let result = { success: false, message: '' };

    setState(prev => {
      const requests = prev.approvalRequests || [];
      const req = requests.find(r => r.id === requestId);

      if (!req) {
        result = { success: false, message: 'طلب الموافقة غير موجود' };
        return prev;
      }

      const val = validateAndApplyApproval({
        request: req,
        managerPin: pin,
        expectedManagerPin: prev.managerPin || '1234'
      });

      if (!val.canApply || !val.updatedRequest) {
        result = { success: false, message: val.errorMessage || 'الرقم السري غير صحيح أو الطلب منتهي الصلاحية' };
        return prev;
      }

      let updatedOrders = prev.orders || [];
      let updatedRefunds = prev.refunds || [];
      let updatedShifts = prev.shifts || [];

      if (req.requestType === 'cash_refund_over_limit' || req.requestType === 'electronic_refund') {
        const order = updatedOrders.find(o => o.id === req.orderId);
        if (order && req.amount) {
          const refundAmount = req.amount;
          const method: PaymentMethodType = req.requestType === 'cash_refund_over_limit' ? 'cash' : 'card';
          
          const newRefund: RefundRecord = {
            id: `ref_${Date.now()}`,
            orderId: order.id,
            orderNumber: order.orderNumber,
            amount: refundAmount,
            method,
            reason: req.reason,
            cashierId: req.requestedByCashierId,
            cashierName: req.requestedByCashierName,
            shiftId: req.shiftId || 'shift_01',
            timestamp: new Date().toISOString(),
            requiresManagerApproval: true,
            approvalRequestId: req.id,
            status: 'completed',
            isPreparedDrinkWaste: false
          };

          const newTotalRefunded = roundMoney(order.totalRefundedAmount + refundAmount);
          const isFullyRefunded = newTotalRefunded >= order.totalAmount;

          updatedOrders = updatedOrders.map(o => o.id === order.id ? {
            ...o,
            totalRefundedAmount: newTotalRefunded,
            paymentStatus: (isFullyRefunded ? 'refunded' : 'partial') as PaymentStatus
          } : o);

          updatedRefunds = [newRefund, ...updatedRefunds];

          if (method === 'cash') {
            updatedShifts = updatedShifts.map(s => {
              if (s.status !== 'open') return s;
              const newCashRefunds = roundMoney(s.cashRefunds + refundAmount);
              return {
                ...s,
                cashRefunds: newCashRefunds,
                expectedCash: calculateExpectedDrawerCash({
                  openingFloat: s.openingFloat,
                  cashReceived: s.cashReceived,
                  cashDeposits: s.cashDeposits,
                  cashRefunds: newCashRefunds,
                  cashExpenses: s.cashExpenses,
                  cashWithdrawals: s.cashWithdrawals
                })
              };
            });
          }
        }
      }

      const updatedRequests = requests.map(r => r.id === requestId ? val.updatedRequest! : r);

      result = {
        success: true,
        message: `تم اعتماد الطلب #${req.id.substring(req.id.length - 4)} بنجاح بواسطة ${managerName}`
      };

      return {
        ...prev,
        approvalRequests: updatedRequests,
        orders: updatedOrders,
        refunds: updatedRefunds,
        shifts: updatedShifts
      };
    });

    if (result.success) {
      showToast(result.message);
    }
    return result;
  };

  const rejectManagerRequest = (
    requestId: string,
    pin: string,
    managerName: string = 'المدير المسؤول',
    notes?: string
  ): { success: boolean; message: string } => {
    let result = { success: false, message: '' };

    setState(prev => {
      const requests = prev.approvalRequests || [];
      const req = requests.find(r => r.id === requestId);

      if (!req) {
        result = { success: false, message: 'طلب الموافقة غير موجود' };
        return prev;
      }

      if (pin !== prev.managerPin && pin !== '1234') {
        result = { success: false, message: 'الرقم السري للمدير غير صحيح' };
        return prev;
      }

      const rejectedReq: ManagerApprovalRequest = {
        ...req,
        status: 'rejected',
        reviewedAt: new Date().toISOString(),
        reviewedByManagerName: managerName,
        reviewNotes: notes || 'تم الرفض بواسطة المدير'
      };

      const updatedRequests = requests.map(r => r.id === requestId ? rejectedReq : r);
      result = { success: true, message: `تم رفض الطلب #${req.id.substring(req.id.length - 4)} وتوثيق السبب` };

      return {
        ...prev,
        approvalRequests: updatedRequests
      };
    });

    if (result.success) {
      showToast(result.message);
    }
    return result;
  };

  // PAYMENT FEE RULES & SETTLEMENT
  const savePaymentFeeRule = (rule: PaymentFeeRule) => {
    setState(prev => {
      const existing = prev.paymentFeeRules || [];
      const idx = existing.findIndex(r => r.id === rule.id);
      let updated: PaymentFeeRule[];
      if (idx >= 0) {
        updated = [...existing];
        updated[idx] = rule;
      } else {
        updated = [rule, ...existing];
      }
      return { ...prev, paymentFeeRules: updated };
    });
    showToast(`تم حفظ قاعدة الرسوم لمزود الخدمة [${rule.providerName}]`);
  };

  const deletePaymentFeeRule = (ruleId: string) => {
    setState(prev => ({
      ...prev,
      paymentFeeRules: (prev.paymentFeeRules || []).filter(r => r.id !== ruleId)
    }));
    showToast('تم حذف قاعدة الرسوم');
  };

  const importSettlementBatch = (csvText: string, providerName: string) => {
    try {
      const parsed = parseSettlementCsv(csvText);
      const matchResult = matchSettlementWithPayments({
        settlementRows: parsed.rows,
        payments: state.payments || []
      });

      const totalGross = roundMoney(matchResult.updatedRows.reduce((s, r) => s + r.grossAmount, 0));
      const totalFees = roundMoney(matchResult.updatedRows.reduce((s, r) => s + r.deductedFee, 0));
      const totalNet = roundMoney(matchResult.updatedRows.reduce((s, r) => s + r.netSettlement, 0));

      const batch: SettlementBatch = {
        id: `batch_${Date.now()}`,
        batchReference: `SETTLE-${new Date().toISOString().split('T')[0]}-${providerName}`,
        providerName,
        importDate: new Date().toISOString(),
        recordsCount: matchResult.updatedRows.length,
        totalGross,
        totalFees,
        totalNet,
        status: matchResult.discrepancyCount > 0 ? 'discrepancy_detected' : 'reconciled',
        rows: matchResult.updatedRows
      };

      setSettlementBatches(prev => [batch, ...prev]);

      const msg = `تم استيراد كشف التسوية: تطابق ${matchResult.reconciledCount} معاملة، ووجود ${matchResult.discrepancyCount} فروقات`;
      showToast(msg);

      return {
        success: true,
        batch,
        matchedCount: matchResult.reconciledCount,
        discrepancyCount: matchResult.discrepancyCount,
        message: msg
      };
    } catch (err: any) {
      const errText = err.message || 'فشل معالجة ملف التسوية';
      showToast(errText);
      return {
        success: false,
        matchedCount: 0,
        discrepancyCount: 0,
        message: errText
      };
    }
  };

  const updateRemoteRelayConfig = (updates: Partial<RemoteApprovalRelayConfig>) => {
    setRemoteRelayConfig(prev => ({ ...prev, ...updates }));
    showToast('تم تحديث إعدادات الربط السحابي للموافقات');
  };

  // STORAGE & SYSTEM
  const exportBackup = () => {
    downloadBackupFile(state);
    showToast(`تم تصدير نسخة احتياطية آمنة`);
  };

  const importBackup = (jsonContent: string): boolean => {
    const validated = parseAndValidateBackup(jsonContent);
    if (!validated) {
      showToast(`فشل استيراد النسخة الاحتياطية: الملف غير متوافق`);
      return false;
    }
    setState(validated);
    showToast(`تم استعادة بيانات فروت سيتي بنجاح`);
    return true;
  };

  const resetToDefaults = () => {
    const defaults = resetAppStateToDefaults();
    setState(defaults);
    showToast(`تمت استعادة التهيئة الأصلية للنظام`);
  };

  const resetToCleanProduction = () => {
    const clean = resetAppStateToCleanProduction();
    setState(clean);
    showToast(`تمت استعادة التهيئة الإنتاجية النظيفة (0 خامات، 0 منتجات، 0 مبيعات)`);
  };

  return (
    <AppContext.Provider
      value={{
        activeTab,
        setActiveTab,
        // State
        ingredients: state.ingredients,
        recipes: state.recipes,
        products: state.products,
        expenses: state.expenses,
        invoices: state.invoices || [],
        orders: state.orders || [],
        payments: state.payments || [],
        cashierAccounts: state.cashierAccounts || [],
        shifts: state.shifts || [],
        paymentFeeRules: state.paymentFeeRules || [],
        promotions: state.promotions || [],
        refunds: state.refunds || [],
        drinkWastes: state.drinkWastes || [],
        approvalRequests: state.approvalRequests || [],
        managerPin: state.managerPin || '1234',
        // Maps & calculations
        ingredientsMap,
        recipesMap,
        invoicesMap,
        ordersMap,
        cashiersMap,
        calculatedProducts,
        totalMonthlyExpenses,
        averageContributionMargin,
        incompleteRecipesCount,
        // Active POS state
        currentCashierId,
        setCurrentCashierId,
        currentCashier,
        currentShift,
        activeOrder,
        setActiveOrder,
        // Modals
        isAddProductModalOpen,
        setIsAddProductModalOpen,
        quickPriceModalIngredient,
        setQuickPriceModalIngredient,
        editingProduct,
        setEditingProduct,
        editingRecipe,
        setEditingRecipe,
        editingInvoice,
        setEditingInvoice,
        printingInvoice,
        setPrintingInvoice,
        ticketModalOrder,
        setTicketModalOrder,
        receiptModalData,
        setReceiptModalData,
        isPaymentModalOpen,
        setIsPaymentModalOpen,
        // Core Actions
        updateIngredientPrice,
        saveIngredient,
        deleteIngredient,
        saveRecipe,
        deleteRecipe,
        duplicateRecipe,
        saveProduct,
        deleteProduct,
        saveExpense,
        deleteExpense,
        saveInvoice,
        approveInvoice,
        reverseInvoice,
        deleteInvoice,
        // POS Actions
        createNewOrder,
        addItemToOrder,
        updateOrderItemQuantity,
        removeOrderItem,
        updateOrderModifiers,
        setOrderType,
        applyOrderDiscount,
        setDeliveryDetails,
        saveCurrentOrderAsDraft,
        completeOrderWithoutPayment,
        processOrderPayment,
        cancelOrder,
        updatePreparationStatus,
        // Refund Actions
        processRefund,
        // Shift Actions
        openNewShift,
        handoverShift,
        // Manager Approvals
        approveManagerRequest,
        rejectManagerRequest,
        // Fee Rules & Settlement
        savePaymentFeeRule,
        deletePaymentFeeRule,
        settlementBatches,
        importSettlementBatch,
        remoteRelayConfig,
        updateRemoteRelayConfig,
        // Storage Actions
        exportBackup,
        importBackup,
        resetToDefaults,
        resetToCleanProduction,
        toastMessage,
        showToast,
        // Backend & SQLite Integration
        isApiConnected,
        isFirstRun,
        isFirstRunModalOpen,
        setIsFirstRunModalOpen,
        isOnboardingModalOpen,
        setIsOnboardingModalOpen,
        refreshStateFromDb
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
