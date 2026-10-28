import { 
  Ingredient, 
  Product, 
  Recipe, 
  ExpenseItem, 
  PurchaseInvoice,
  PosOrder,
  PaymentRecord,
  CashierAccount,
  CashierShift,
  PaymentFeeRule,
  Promotion,
  RefundRecord,
  DrinkWasteEntry,
  ManagerApprovalRequest
} from '../types';
import {
  INITIAL_INGREDIENTS,
  INITIAL_PRODUCTS,
  INITIAL_RECIPES,
  INITIAL_EXPENSES,
  INITIAL_INVOICES,
  INITIAL_CASHIERS,
  INITIAL_SHIFTS,
  INITIAL_FEE_RULES,
  INITIAL_PROMOTIONS,
  INITIAL_ORDERS,
  INITIAL_PAYMENTS,
  INITIAL_REFUNDS,
  INITIAL_APPROVALS,
  DEFAULT_MANAGER_PIN
} from './initialData';

const STORAGE_KEYS = {
  INGREDIENTS: 'fruit_city_ingredients_v1',
  RECIPES: 'fruit_city_recipes_v1',
  PRODUCTS: 'fruit_city_products_v1',
  EXPENSES: 'fruit_city_expenses_v1',
  INVOICES: 'fruit_city_invoices_v1',
  ORDERS: 'fruit_city_orders_v1',
  PAYMENTS: 'fruit_city_payments_v1',
  CASHIERS: 'fruit_city_cashiers_v1',
  SHIFTS: 'fruit_city_shifts_v1',
  FEE_RULES: 'fruit_city_fee_rules_v1',
  PROMOTIONS: 'fruit_city_promotions_v1',
  REFUNDS: 'fruit_city_refunds_v1',
  WASTES: 'fruit_city_wastes_v1',
  APPROVALS: 'fruit_city_approvals_v1',
  MANAGER_PIN: 'fruit_city_manager_pin_v1',
  SETTINGS: 'fruit_city_settings_v1',
  LAST_BACKUP: 'fruit_city_last_backup_date'
};

export interface FruitCityAppState {
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
}

export function loadAppState(): FruitCityAppState {
  try {
    const rawIng = localStorage.getItem(STORAGE_KEYS.INGREDIENTS);
    const rawRec = localStorage.getItem(STORAGE_KEYS.RECIPES);
    const rawProd = localStorage.getItem(STORAGE_KEYS.PRODUCTS);
    const rawExp = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    const rawInv = localStorage.getItem(STORAGE_KEYS.INVOICES);
    const rawOrd = localStorage.getItem(STORAGE_KEYS.ORDERS);
    const rawPay = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    const rawCsh = localStorage.getItem(STORAGE_KEYS.CASHIERS);
    const rawShf = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    const rawFee = localStorage.getItem(STORAGE_KEYS.FEE_RULES);
    const rawPrm = localStorage.getItem(STORAGE_KEYS.PROMOTIONS);
    const rawRef = localStorage.getItem(STORAGE_KEYS.REFUNDS);
    const rawWst = localStorage.getItem(STORAGE_KEYS.WASTES);
    const rawApp = localStorage.getItem(STORAGE_KEYS.APPROVALS);
    const rawPin = localStorage.getItem(STORAGE_KEYS.MANAGER_PIN);

    return {
      ingredients: rawIng ? JSON.parse(rawIng) : INITIAL_INGREDIENTS,
      recipes: rawRec ? JSON.parse(rawRec) : INITIAL_RECIPES,
      products: rawProd ? JSON.parse(rawProd) : INITIAL_PRODUCTS,
      expenses: rawExp ? JSON.parse(rawExp) : INITIAL_EXPENSES,
      invoices: rawInv ? JSON.parse(rawInv) : INITIAL_INVOICES,
      orders: rawOrd ? JSON.parse(rawOrd) : INITIAL_ORDERS,
      payments: rawPay ? JSON.parse(rawPay) : INITIAL_PAYMENTS,
      cashierAccounts: rawCsh ? JSON.parse(rawCsh) : INITIAL_CASHIERS,
      shifts: rawShf ? JSON.parse(rawShf) : INITIAL_SHIFTS,
      paymentFeeRules: rawFee ? JSON.parse(rawFee) : INITIAL_FEE_RULES,
      promotions: rawPrm ? JSON.parse(rawPrm) : INITIAL_PROMOTIONS,
      refunds: rawRef ? JSON.parse(rawRef) : INITIAL_REFUNDS,
      drinkWastes: rawWst ? JSON.parse(rawWst) : [],
      approvalRequests: rawApp ? JSON.parse(rawApp) : INITIAL_APPROVALS,
      managerPin: rawPin ? rawPin : DEFAULT_MANAGER_PIN
    };
  } catch (error) {
    console.error('Failed to load local state from localStorage, falling back to defaults:', error);
    return {
      ingredients: INITIAL_INGREDIENTS,
      recipes: INITIAL_RECIPES,
      products: INITIAL_PRODUCTS,
      expenses: INITIAL_EXPENSES,
      invoices: INITIAL_INVOICES,
      orders: INITIAL_ORDERS,
      payments: INITIAL_PAYMENTS,
      cashierAccounts: INITIAL_CASHIERS,
      shifts: INITIAL_SHIFTS,
      paymentFeeRules: INITIAL_FEE_RULES,
      promotions: INITIAL_PROMOTIONS,
      refunds: INITIAL_REFUNDS,
      drinkWastes: [],
      approvalRequests: INITIAL_APPROVALS,
      managerPin: DEFAULT_MANAGER_PIN
    };
  }
}

export function saveAppState(state: FruitCityAppState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.INGREDIENTS, JSON.stringify(state.ingredients));
    localStorage.setItem(STORAGE_KEYS.RECIPES, JSON.stringify(state.recipes));
    localStorage.setItem(STORAGE_KEYS.PRODUCTS, JSON.stringify(state.products));
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(state.expenses));
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(state.invoices || []));
    localStorage.setItem(STORAGE_KEYS.ORDERS, JSON.stringify(state.orders || []));
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(state.payments || []));
    localStorage.setItem(STORAGE_KEYS.CASHIERS, JSON.stringify(state.cashierAccounts || []));
    localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(state.shifts || []));
    localStorage.setItem(STORAGE_KEYS.FEE_RULES, JSON.stringify(state.paymentFeeRules || []));
    localStorage.setItem(STORAGE_KEYS.PROMOTIONS, JSON.stringify(state.promotions || []));
    localStorage.setItem(STORAGE_KEYS.REFUNDS, JSON.stringify(state.refunds || []));
    localStorage.setItem(STORAGE_KEYS.WASTES, JSON.stringify(state.drinkWastes || []));
    localStorage.setItem(STORAGE_KEYS.APPROVALS, JSON.stringify(state.approvalRequests || []));
    localStorage.setItem(STORAGE_KEYS.MANAGER_PIN, state.managerPin || DEFAULT_MANAGER_PIN);
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
}

export function exportBackupJSON(state: FruitCityAppState): string {
  const backupObject = {
    app: 'Fruit City Management System',
    version: '1.0.0',
    exportDate: new Date().toISOString(),
    data: state
  };
  return JSON.stringify(backupObject, null, 2);
}

export function downloadBackupFile(state: FruitCityAppState): void {
  const jsonStr = exportBackupJSON(state);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().split('T')[0];
  a.href = url;
  a.download = `fruit_city_backup_${dateStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  localStorage.setItem(STORAGE_KEYS.LAST_BACKUP, dateStr);
}

export function parseAndValidateBackup(jsonString: string): FruitCityAppState | null {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed || !parsed.data) {
      throw new Error('Invalid backup file structure: missing data field');
    }
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
      managerPin
    } = parsed.data;

    if (!Array.isArray(ingredients) || !Array.isArray(recipes) || !Array.isArray(products) || !Array.isArray(expenses)) {
      throw new Error('Invalid backup file: core tables must be arrays');
    }
    return { 
      ingredients, 
      recipes, 
      products, 
      expenses, 
      invoices: Array.isArray(invoices) ? invoices : [],
      orders: Array.isArray(orders) ? orders : INITIAL_ORDERS,
      payments: Array.isArray(payments) ? payments : INITIAL_PAYMENTS,
      cashierAccounts: Array.isArray(cashierAccounts) ? cashierAccounts : INITIAL_CASHIERS,
      shifts: Array.isArray(shifts) ? shifts : INITIAL_SHIFTS,
      paymentFeeRules: Array.isArray(paymentFeeRules) ? paymentFeeRules : INITIAL_FEE_RULES,
      promotions: Array.isArray(promotions) ? promotions : INITIAL_PROMOTIONS,
      refunds: Array.isArray(refunds) ? refunds : [],
      drinkWastes: Array.isArray(drinkWastes) ? drinkWastes : [],
      approvalRequests: Array.isArray(approvalRequests) ? approvalRequests : [],
      managerPin: typeof managerPin === 'string' ? managerPin : DEFAULT_MANAGER_PIN
    };
  } catch (error) {
    console.error('Backup validation error:', error);
    return null;
  }
}

/**
 * Generate full SQLite compatible SQL script for future database migrations
 * or desktop SQLite synchronization.
 */
export function generateSQLiteScript(state: FruitCityAppState): string {
  let sql = `-- =======================================================
-- FRUIT CITY MANAGEMENT SYSTEM — SQLITE EXPORT / MIGRATION
-- Generated: ${new Date().toISOString()}
-- =======================================================

PRAGMA foreign_keys = ON;

-- 1. Ingredients Table
CREATE TABLE IF NOT EXISTS ingredients (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  category TEXT NOT NULL,
  purchase_unit TEXT NOT NULL,
  package_size REAL NOT NULL,
  current_price REAL NOT NULL,
  price_per_base_unit REAL NOT NULL,
  base_unit TEXT NOT NULL,
  supplier TEXT,
  last_updated TEXT NOT NULL,
  usable_yield_percent REAL DEFAULT 100,
  waste_percentage REAL DEFAULT 0,
  is_measured INTEGER DEFAULT 1,
  notes TEXT
);

-- 2. Recipes Table
CREATE TABLE IF NOT EXISTS recipes (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL,
  name_ar TEXT NOT NULL,
  method TEXT NOT NULL,
  batch_yield_ml REAL NOT NULL,
  is_complete INTEGER DEFAULT 1,
  incomplete_reason TEXT,
  has_added_sugar INTEGER DEFAULT 0,
  marketing_alert TEXT,
  safety_notes TEXT,
  last_updated TEXT NOT NULL
);

-- 3. Recipe Ingredients Items
CREATE TABLE IF NOT EXISTS recipe_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipe_id TEXT NOT NULL,
  ingredient_id TEXT NOT NULL,
  quantity REAL NOT NULL,
  unit TEXT NOT NULL,
  notes TEXT,
  FOREIGN KEY (recipe_id) REFERENCES recipes(id) ON DELETE CASCADE,
  FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
);

-- 4. Products Table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  category TEXT NOT NULL,
  recipe_id TEXT,
  price_400ml REAL NOT NULL,
  price_1l REAL NOT NULL,
  packaging_400ml REAL NOT NULL,
  packaging_1l REAL NOT NULL,
  is_complete INTEGER DEFAULT 1,
  incomplete_notes TEXT
);

-- 5. Operating Expenses Table
CREATE TABLE IF NOT EXISTS operating_expenses (
  id TEXT PRIMARY KEY,
  name_ar TEXT NOT NULL,
  name_en TEXT,
  monthly_amount REAL NOT NULL,
  type TEXT NOT NULL,
  category TEXT NOT NULL,
  notes TEXT
);

-- 6. Purchase Invoices Table
CREATE TABLE IF NOT EXISTS purchase_invoices (
  id TEXT PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  invoice_date TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  status TEXT NOT NULL,
  total_amount REAL NOT NULL,
  total_weight_kg REAL,
  notes TEXT,
  created_at TEXT NOT NULL
);

`;

  // Insert ingredients
  for (const ing of state.ingredients) {
    sql += `INSERT OR REPLACE INTO ingredients VALUES ('${ing.id}', '${ing.nameAr}', '${ing.nameEn}', '${ing.category}', '${ing.purchaseUnit}', ${ing.packageSize}, ${ing.currentPrice}, ${ing.pricePerBaseUnit}, '${ing.baseUnit}', '${ing.supplier || ''}', '${ing.lastUpdated}', ${ing.usableYieldPercent}, ${ing.wastePercentage}, ${ing.isMeasured ? 1 : 0}, '${(ing.notes || '').replace(/'/g, "''")}');\n`;
  }

  // Insert products
  for (const prod of state.products) {
    sql += `INSERT OR REPLACE INTO products VALUES ('${prod.id}', '${prod.nameAr}', '${prod.nameEn}', '${prod.category}', '${prod.recipeId}', ${prod.prices['400ml']}, ${prod.prices['1L']}, ${prod.packaging['400ml']}, ${prod.packaging['1L']}, ${prod.isComplete ? 1 : 0}, '${(prod.incompleteNotes || '').replace(/'/g, "''")}');\n`;
  }

  // Insert expenses
  for (const exp of state.expenses) {
    sql += `INSERT OR REPLACE INTO operating_expenses VALUES ('${exp.id}', '${exp.nameAr}', '${exp.nameEn}', ${exp.monthlyAmount}, '${exp.type}', '${exp.category}', '${(exp.notes || '').replace(/'/g, "''")}');\n`;
  }

  // Insert invoices
  if (state.invoices && state.invoices.length > 0) {
    for (const inv of state.invoices) {
      sql += `INSERT OR REPLACE INTO purchase_invoices VALUES ('${inv.id}', '${inv.invoiceNumber}', '${inv.invoiceDate}', '${inv.supplierName.replace(/'/g, "''")}', '${inv.status}', ${inv.totalAmount}, ${inv.totalWeightKg || 0}, '${(inv.notes || '').replace(/'/g, "''")}', '${inv.createdAt}');\n`;
    }
  }

  return sql;
}

export function resetAppStateToDefaults(): FruitCityAppState {
  localStorage.removeItem(STORAGE_KEYS.INGREDIENTS);
  localStorage.removeItem(STORAGE_KEYS.RECIPES);
  localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
  localStorage.removeItem(STORAGE_KEYS.EXPENSES);
  localStorage.removeItem(STORAGE_KEYS.INVOICES);
  localStorage.removeItem(STORAGE_KEYS.ORDERS);
  localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
  localStorage.removeItem(STORAGE_KEYS.CASHIERS);
  localStorage.removeItem(STORAGE_KEYS.SHIFTS);
  localStorage.removeItem(STORAGE_KEYS.FEE_RULES);
  localStorage.removeItem(STORAGE_KEYS.PROMOTIONS);
  localStorage.removeItem(STORAGE_KEYS.REFUNDS);
  localStorage.removeItem(STORAGE_KEYS.WASTES);
  localStorage.removeItem(STORAGE_KEYS.APPROVALS);
  localStorage.removeItem(STORAGE_KEYS.MANAGER_PIN);
  return {
    ingredients: INITIAL_INGREDIENTS,
    recipes: INITIAL_RECIPES,
    products: INITIAL_PRODUCTS,
    expenses: INITIAL_EXPENSES,
    invoices: INITIAL_INVOICES,
    orders: INITIAL_ORDERS,
    payments: INITIAL_PAYMENTS,
    cashierAccounts: INITIAL_CASHIERS,
    shifts: INITIAL_SHIFTS,
    paymentFeeRules: INITIAL_FEE_RULES,
    promotions: INITIAL_PROMOTIONS,
    refunds: INITIAL_REFUNDS,
    drinkWastes: [],
    approvalRequests: INITIAL_APPROVALS,
    managerPin: DEFAULT_MANAGER_PIN
  };
}

export function resetAppStateToCleanProduction(): FruitCityAppState {
  localStorage.removeItem(STORAGE_KEYS.INGREDIENTS);
  localStorage.removeItem(STORAGE_KEYS.RECIPES);
  localStorage.removeItem(STORAGE_KEYS.PRODUCTS);
  localStorage.removeItem(STORAGE_KEYS.EXPENSES);
  localStorage.removeItem(STORAGE_KEYS.INVOICES);
  localStorage.removeItem(STORAGE_KEYS.ORDERS);
  localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
  localStorage.removeItem(STORAGE_KEYS.CASHIERS);
  localStorage.removeItem(STORAGE_KEYS.SHIFTS);
  localStorage.removeItem(STORAGE_KEYS.FEE_RULES);
  localStorage.removeItem(STORAGE_KEYS.PROMOTIONS);
  localStorage.removeItem(STORAGE_KEYS.REFUNDS);
  localStorage.removeItem(STORAGE_KEYS.WASTES);
  localStorage.removeItem(STORAGE_KEYS.APPROVALS);
  localStorage.removeItem(STORAGE_KEYS.MANAGER_PIN);
  return {
    ingredients: [],
    recipes: [],
    products: [],
    expenses: INITIAL_EXPENSES,
    invoices: [],
    orders: [],
    payments: [],
    cashierAccounts: [],
    shifts: [],
    paymentFeeRules: INITIAL_FEE_RULES,
    promotions: [],
    refunds: [],
    drinkWastes: [],
    approvalRequests: [],
    managerPin: ''
  };
}
