-- ============================================================================
-- FRUIT CITY MANAGEMENT SYSTEM — RELATIONAL DATABASE FOUNDATION
-- Schema Version: 1.0.0
-- Dialect: ANSI SQL / SQLite / PostgreSQL Compatible
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ----------------------------------------------------------------------------
-- 1. BRANCHES (الفروع)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branches (
    branch_id VARCHAR(50) PRIMARY KEY,
    branch_name VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(50),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 2. INGREDIENT CATEGORIES & INGREDIENTS (التصنيفات والخامات)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ingredient_categories (
    category_id VARCHAR(50) PRIMARY KEY,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS ingredients (
    ingredient_id VARCHAR(50) PRIMARY KEY,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    category_id VARCHAR(50) NOT NULL REFERENCES ingredient_categories(category_id),
    purchase_unit VARCHAR(20) NOT NULL, -- kg, bundle, liter, box, piece
    base_unit VARCHAR(20) NOT NULL,     -- g, ml, piece
    conversion_factor DECIMAL(12, 4) NOT NULL DEFAULT 1.0000, -- e.g. 1000g per 1kg
    usable_yield_percent DECIMAL(5, 2) NOT NULL DEFAULT 100.00,
    waste_percent DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    reorder_level DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    is_measured BOOLEAN NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 3. BRANCH INVENTORY & MOVEMENTS (مخزون الفروع وحركات الجرد)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS branch_inventory (
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(branch_id),
    ingredient_id VARCHAR(50) NOT NULL REFERENCES ingredients(ingredient_id),
    stock_quantity DECIMAL(12, 3) NOT NULL DEFAULT 0.000 CHECK (stock_quantity >= 0),
    weighted_average_cost DECIMAL(12, 4) NOT NULL DEFAULT 0.0000 CHECK (weighted_average_cost >= 0),
    last_purchase_price DECIMAL(12, 4) DEFAULT NULL,
    min_stock_alert DECIMAL(12, 3) NOT NULL DEFAULT 0.000,
    last_counted_at TEXT,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (branch_id, ingredient_id)
);

CREATE TABLE IF NOT EXISTS inventory_movements (
    movement_id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(branch_id),
    ingredient_id VARCHAR(50) NOT NULL REFERENCES ingredients(ingredient_id),
    movement_type VARCHAR(30) NOT NULL CHECK (movement_type IN (
        'purchase_receipt', 
        'sale_deduction', 
        'order_cancellation_restore', 
        'waste', 
        'manual_adjustment', 
        'transfer_in', 
        'transfer_out'
    )),
    quantity DECIMAL(12, 3) NOT NULL, -- negative for deduction, positive for addition
    unit VARCHAR(20) NOT NULL,
    unit_cost DECIMAL(12, 4) NOT NULL DEFAULT 0.0000,
    total_cost DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    balance_after DECIMAL(12, 3) NOT NULL,
    reference_type VARCHAR(30), -- 'order', 'purchase_invoice', 'waste_record', 'adjustment'
    reference_id VARCHAR(50),
    user_id VARCHAR(50) NOT NULL,
    idempotency_key VARCHAR(100) UNIQUE, -- CRITICAL: Prevents double deduction!
    notes TEXT,
    created_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 4. SUPPLIERS & PURCHASES (الموردين وفواتير المشتريات)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS suppliers (
    supplier_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    market_location VARCHAR(100), -- سوق العبور
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS purchase_invoices (
    invoice_id VARCHAR(50) PRIMARY KEY,
    invoice_number VARCHAR(50) NOT NULL UNIQUE,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(branch_id),
    supplier_id VARCHAR(50) REFERENCES suppliers(supplier_id),
    supplier_name VARCHAR(150) NOT NULL,
    invoice_date TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'cancelled')),
    total_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    total_weight_kg DECIMAL(12, 3) DEFAULT 0.000,
    notes TEXT,
    created_by VARCHAR(50) NOT NULL,
    created_at TEXT NOT NULL,
    approved_by VARCHAR(50),
    approved_at TEXT
);

CREATE TABLE IF NOT EXISTS purchase_invoice_items (
    item_id VARCHAR(50) PRIMARY KEY,
    invoice_id VARCHAR(50) NOT NULL REFERENCES purchase_invoices(invoice_id) ON DELETE CASCADE,
    ingredient_id VARCHAR(50) NOT NULL REFERENCES ingredients(ingredient_id),
    pricing_method VARCHAR(20) NOT NULL CHECK (pricing_method IN ('by_weight', 'by_package', 'by_piece')),
    package_count DECIMAL(10, 2) DEFAULT 1.00,
    package_unit_name VARCHAR(50), -- سباطة، كرتونة، قفص، شيكارة، رابطة
    total_weight_kg DECIMAL(12, 3) DEFAULT NULL,
    unit_price DECIMAL(12, 2) NOT NULL CHECK (unit_price >= 0),
    package_fee DECIMAL(12, 2) DEFAULT 0.00,
    total_cost DECIMAL(12, 2) NOT NULL CHECK (total_cost >= 0),
    effective_kg_price DECIMAL(12, 4) DEFAULT NULL,
    weight_unknown BOOLEAN NOT NULL DEFAULT 0,
    custom_ingredient_name VARCHAR(100) DEFAULT NULL,
    notes TEXT
);

-- ----------------------------------------------------------------------------
-- 5. PRODUCTS, SIZES, AND PRICING (المنتجات والمقاسات والأسعار)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_categories (
    category_id VARCHAR(50) PRIMARY KEY,
    name_ar VARCHAR(100) NOT NULL,
    name_en VARCHAR(100),
    sort_order INTEGER DEFAULT 0,
    active BOOLEAN NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS products (
    product_id VARCHAR(50) PRIMARY KEY,
    product_code VARCHAR(50) UNIQUE,
    name_ar VARCHAR(150) NOT NULL,
    name_en VARCHAR(150),
    category_id VARCHAR(50) NOT NULL REFERENCES product_categories(category_id),
    description_ar TEXT,
    image_url TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS product_sizes (
    size_id VARCHAR(50) PRIMARY KEY,
    size_code VARCHAR(20) NOT NULL UNIQUE, -- '400ml', '1L', 'regular', 'large'
    name_ar VARCHAR(50) NOT NULL,
    volume_ml INTEGER NOT NULL DEFAULT 400,
    sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS product_prices (
    price_id VARCHAR(50) PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    size_id VARCHAR(50) NOT NULL REFERENCES product_sizes(size_id),
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(branch_id),
    selling_price DECIMAL(10, 2) NOT NULL CHECK (selling_price >= 0),
    packaging_cost DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (packaging_cost >= 0),
    is_available BOOLEAN NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (product_id, size_id, branch_id)
);

-- ----------------------------------------------------------------------------
-- 6. RECIPES & RECIPE INGREDIENTS (الوصفات والمعادلات الحسابية)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS recipes (
    recipe_id VARCHAR(50) PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL REFERENCES products(product_id) ON DELETE CASCADE,
    recipe_version INTEGER NOT NULL DEFAULT 1,
    name_ar VARCHAR(150) NOT NULL,
    recipe_method VARCHAR(20) NOT NULL CHECK (recipe_method IN ('batch', 'per_serving')),
    batch_yield_ml INTEGER NOT NULL DEFAULT 1000,
    yield_unit VARCHAR(20) NOT NULL DEFAULT 'ml',
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
    ice_water_notes TEXT,
    has_added_sugar BOOLEAN NOT NULL DEFAULT 0,
    is_complete BOOLEAN NOT NULL DEFAULT 1,
    safety_notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
    recipe_item_id VARCHAR(50) PRIMARY KEY,
    recipe_id VARCHAR(50) NOT NULL REFERENCES recipes(recipe_id) ON DELETE CASCADE,
    ingredient_id VARCHAR(50) NOT NULL REFERENCES ingredients(ingredient_id),
    quantity DECIMAL(12, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    notes TEXT,
    UNIQUE (recipe_id, ingredient_id)
);

-- ----------------------------------------------------------------------------
-- 7. PRODUCT MODIFIERS (الإضافات والخيارات: سكر، ثلج، نكهات)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS product_modifiers (
    modifier_group_id VARCHAR(50) PRIMARY KEY,
    group_code VARCHAR(50) NOT NULL UNIQUE,
    name_ar VARCHAR(100) NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT 0,
    max_selections INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS product_modifier_options (
    option_id VARCHAR(50) PRIMARY KEY,
    modifier_group_id VARCHAR(50) NOT NULL REFERENCES product_modifiers(modifier_group_id) ON DELETE CASCADE,
    option_code VARCHAR(50) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    price_delta DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    is_default BOOLEAN NOT NULL DEFAULT 0
);

-- ----------------------------------------------------------------------------
-- 8. SHIFTS (ورديات الكاشير وجرد الدرج)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cashier_shifts (
    shift_id VARCHAR(50) PRIMARY KEY,
    shift_number INTEGER NOT NULL,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(branch_id),
    cashier_id VARCHAR(50) NOT NULL,
    opened_at TEXT NOT NULL,
    closed_at TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'handover_pending', 'closed')),
    opening_float DECIMAL(10, 2) NOT NULL DEFAULT 500.00 CHECK (opening_float >= 0),
    cash_sales DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    electronic_sales DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cash_refunds DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    cash_expenses DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    expected_cash DECIMAL(12, 2) NOT NULL DEFAULT 500.00,
    actual_cash_counted DECIMAL(12, 2) DEFAULT NULL,
    discrepancy DECIMAL(12, 2) DEFAULT 0.00,
    reconciliation_notes TEXT,
    handover_to_cashier_id VARCHAR(50)
);

-- ----------------------------------------------------------------------------
-- 9. ORDERS & ORDER ITEMS (طلبات المبيعات ومصادرها)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
    order_id VARCHAR(50) PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(branch_id),
    order_source VARCHAR(30) NOT NULL CHECK (order_source IN ('pos', 'website', 'qr_menu', 'whatsapp_assisted')),
    order_type VARCHAR(20) NOT NULL CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
    order_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (order_status IN ('pending', 'completed', 'cancelled', 'refunded')),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded', 'failed')),
    preparation_status VARCHAR(20) NOT NULL DEFAULT 'queued' CHECK (preparation_status IN ('queued', 'preparing', 'ready', 'delivered', 'suspended')),
    subtotal DECIMAL(12, 2) NOT NULL CHECK (subtotal >= 0),
    discount_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    tax_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (tax_amount >= 0),
    delivery_fee DECIMAL(12, 2) NOT NULL DEFAULT 0.00 CHECK (delivery_fee >= 0),
    total_amount DECIMAL(12, 2) NOT NULL CHECK (total_amount >= 0),
    cost_snapshot DECIMAL(12, 2) DEFAULT 0.00,
    cashier_id VARCHAR(50) NOT NULL,
    shift_id VARCHAR(50) REFERENCES cashier_shifts(shift_id),
    customer_name VARCHAR(150),
    customer_phone VARCHAR(50),
    delivery_address TEXT,
    notes TEXT,
    idempotency_key VARCHAR(100) UNIQUE,
    created_at TEXT NOT NULL,
    paid_at TEXT,
    completed_at TEXT,
    cancelled_at TEXT,
    cancellation_reason TEXT
);

CREATE TABLE IF NOT EXISTS order_items (
    order_item_id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id VARCHAR(50) NOT NULL REFERENCES products(product_id),
    size_id VARCHAR(50) NOT NULL REFERENCES product_sizes(size_id),
    recipe_id VARCHAR(50) REFERENCES recipes(recipe_id),
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    unit_cost_snapshot DECIMAL(10, 4) NOT NULL DEFAULT 0.0000,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    total_price DECIMAL(12, 2) NOT NULL CHECK (total_price >= 0),
    is_prepared BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS order_item_modifiers (
    item_modifier_id VARCHAR(50) PRIMARY KEY,
    order_item_id VARCHAR(50) NOT NULL REFERENCES order_items(order_item_id) ON DELETE CASCADE,
    modifier_group_id VARCHAR(50) NOT NULL REFERENCES product_modifiers(modifier_group_id),
    option_id VARCHAR(50) NOT NULL REFERENCES product_modifier_options(option_id),
    extra_price DECIMAL(10, 2) NOT NULL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS order_status_history (
    history_id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    old_status VARCHAR(20),
    new_status VARCHAR(20) NOT NULL,
    status_type VARCHAR(20) NOT NULL, -- 'order', 'payment', 'preparation'
    changed_by VARCHAR(50) NOT NULL,
    changed_at TEXT NOT NULL,
    notes TEXT
);

-- ----------------------------------------------------------------------------
-- 10. PAYMENTS & FEE RULES (المدفوعات ورسوم الدفع الإلكتروني)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_fee_rules (
    rule_id VARCHAR(50) PRIMARY KEY,
    provider_name VARCHAR(100) NOT NULL,
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('card', 'instapay')),
    fee_percent DECIMAL(6, 3) NOT NULL DEFAULT 0.000,
    fixed_fee DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
    min_fee DECIMAL(10, 2) DEFAULT NULL,
    max_fee DECIMAL(10, 2) DEFAULT NULL,
    contractual_tax_percent DECIMAL(5, 2) NOT NULL DEFAULT 14.00,
    effective_start_date TEXT NOT NULL,
    effective_end_date TEXT,
    is_active BOOLEAN NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS payment_records (
    payment_id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(order_id),
    shift_id VARCHAR(50) NOT NULL REFERENCES cashier_shifts(shift_id),
    payment_method VARCHAR(20) NOT NULL CHECK (payment_method IN ('cash', 'card', 'instapay')),
    gross_amount DECIMAL(12, 2) NOT NULL CHECK (gross_amount > 0),
    fee_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00 CHECK (fee_amount >= 0),
    net_amount DECIMAL(12, 2) NOT NULL CHECK (net_amount >= 0),
    reference_number VARCHAR(100),
    payment_status VARCHAR(20) NOT NULL DEFAULT 'verified' CHECK (payment_status IN ('pending', 'verified', 'refunded', 'rejected')),
    cashier_id VARCHAR(50) NOT NULL,
    idempotency_key VARCHAR(100) UNIQUE,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS refund_records (
    refund_id VARCHAR(50) PRIMARY KEY,
    order_id VARCHAR(50) NOT NULL REFERENCES orders(order_id),
    payment_id VARCHAR(50) REFERENCES payment_records(payment_id),
    shift_id VARCHAR(50) NOT NULL REFERENCES cashier_shifts(shift_id),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    method VARCHAR(20) NOT NULL CHECK (method IN ('cash', 'card', 'instapay')),
    reason TEXT NOT NULL,
    approved_by VARCHAR(50) NOT NULL,
    restock_inventory BOOLEAN NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS waste_records (
    waste_id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(branch_id),
    ingredient_id VARCHAR(50) REFERENCES ingredients(ingredient_id),
    product_id VARCHAR(50) REFERENCES products(product_id),
    size_id VARCHAR(50) REFERENCES product_sizes(size_id),
    quantity DECIMAL(12, 3) NOT NULL CHECK (quantity > 0),
    unit VARCHAR(20) NOT NULL,
    estimated_loss_egp DECIMAL(12, 2) NOT NULL CHECK (estimated_loss_egp >= 0),
    reason TEXT NOT NULL,
    logged_by VARCHAR(50) NOT NULL,
    logged_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 11. EXPENSES (المصروفات التشغيلية)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expense_categories (
    category_id VARCHAR(50) PRIMARY KEY,
    name_ar VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('fixed', 'variable', 'mixed'))
);

CREATE TABLE IF NOT EXISTS expense_records (
    expense_id VARCHAR(50) PRIMARY KEY,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(branch_id),
    category_id VARCHAR(50) NOT NULL REFERENCES expense_categories(category_id),
    name_ar VARCHAR(150) NOT NULL,
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    expense_date TEXT NOT NULL,
    paid_by VARCHAR(50) NOT NULL,
    shift_id VARCHAR(50) REFERENCES cashier_shifts(shift_id),
    notes TEXT,
    created_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- 12. USERS, ROLES & AUDIT LOGS (المستخدمين والأدوار وسجل العمليات)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    role_id VARCHAR(50) PRIMARY KEY,
    role_name VARCHAR(50) NOT NULL UNIQUE,
    description_ar VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS permissions (
    permission_id VARCHAR(50) PRIMARY KEY,
    permission_code VARCHAR(100) NOT NULL UNIQUE,
    description_ar VARCHAR(150)
);

CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(50) NOT NULL REFERENCES roles(role_id) ON DELETE CASCADE,
    permission_id VARCHAR(50) NOT NULL REFERENCES permissions(permission_id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(50) PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    full_name_ar VARCHAR(150) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(64) NOT NULL,
    role_id VARCHAR(50) NOT NULL REFERENCES roles(role_id),
    is_active BOOLEAN NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_branch_access (
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    branch_id VARCHAR(50) NOT NULL REFERENCES branches(branch_id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, branch_id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
    log_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    target_type VARCHAR(50) NOT NULL,
    target_id VARCHAR(50) NOT NULL,
    details_json TEXT,
    ip_address VARCHAR(50),
    created_at TEXT NOT NULL
);

-- ----------------------------------------------------------------------------
-- INDEXES FOR PERFORMANCE AND INTEGRITY (الفهارس لسرعة الاستعلام والتقارير)
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_orders_branch_created ON orders(branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status, payment_status);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_branch_inventory_ing ON branch_inventory(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_inv_movements_branch_ing ON inventory_movements(branch_id, ingredient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payment_records(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_shift ON payment_records(shift_id);
CREATE INDEX IF NOT EXISTS idx_shifts_cashier ON cashier_shifts(cashier_id, opened_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);
