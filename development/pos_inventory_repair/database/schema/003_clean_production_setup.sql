-- ============================================================================
-- FRUIT CITY MANAGEMENT SYSTEM — CLEAN PRODUCTION INITIALIZATION
-- Version: 2.0.0
-- Wipes all trial operational data and establishes clean structural foundations.
-- ============================================================================

PRAGMA foreign_keys = OFF;

-- 1. Wipe all operational data
DELETE FROM order_item_modifiers;
DELETE FROM order_items;
DELETE FROM order_status_history;
DELETE FROM payment_records;
DELETE FROM refund_records;
DELETE FROM orders;
DELETE FROM cashier_shifts;
DELETE FROM waste_records;
DELETE FROM inventory_movements;
DELETE FROM branch_inventory;
DELETE FROM purchase_invoice_items;
DELETE FROM purchase_invoices;
DELETE FROM suppliers;
DELETE FROM recipe_ingredients;
DELETE FROM recipes;
DELETE FROM product_prices;
DELETE FROM products;
DELETE FROM ingredients;
DELETE FROM expense_records;
DELETE FROM audit_logs;
DELETE FROM user_branch_access;
DELETE FROM users; -- ZERO USERS: Ready for First-Run Owner Setup!

-- 2. Verify or insert clean structural foundations
-- Branches
INSERT OR IGNORE INTO branches (branch_id, branch_name, address, phone, status, created_at, updated_at)
VALUES ('branch_downtown_cairo', 'Fruit City — Downtown Cairo (وسط البلد)', '15 شارع شريف، وسط البلد، القاهرة', '01000000001', 'active', datetime('now'), datetime('now'));

-- Ingredient Categories
INSERT OR IGNORE INTO ingredient_categories (category_id, name_ar, name_en, sort_order)
VALUES 
('cat_fresh_fruit', 'فواكه طازجة', 'Fresh Fruit', 1),
('cat_dairy', 'ألبان وكريمات', 'Dairy & Creams', 2),
('cat_sweeteners', 'سكريات ومحليات', 'Sugars & Sweeteners', 3),
('cat_packaging', 'تعبئة وتغليف', 'Packaging', 4),
('cat_additives', 'نكهات ومواد مضافة', 'Flavors & Additives', 5);

-- Product Categories
INSERT OR IGNORE INTO product_categories (category_id, name_ar, name_en, sort_order, active)
VALUES 
('prod_cat_pure', 'عصائر طبيعية كلاسيك', 'Classic Natural Juices', 1, 1),
('prod_cat_mixes', 'كوكتيلات وخلطات سيتي', 'Fruit City Signature Mixes', 2, 1);

-- Product Sizes
INSERT OR IGNORE INTO product_sizes (size_id, size_code, name_ar, volume_ml, sort_order)
VALUES 
('size_400ml', '400ml', 'كوب وسط (400 مل)', 400, 1),
('size_1l', '1L', 'لتر كامل (1000 مل)', 1000, 2);

-- Product Modifiers
INSERT OR IGNORE INTO product_modifiers (modifier_group_id, group_code, name_ar, is_required, max_selections)
VALUES 
('mod_sugar', 'sugar_level', 'درجة السكر', 1, 1),
('mod_ice', 'ice_level', 'كمية الثلج', 1, 1);

INSERT OR IGNORE INTO product_modifier_options (option_id, modifier_group_id, option_code, name_ar, price_delta, is_default)
VALUES 
('opt_sug_std', 'mod_sugar', 'standard', 'سكر مظبوط', 0.00, 1),
('opt_sug_low', 'mod_sugar', 'low', 'سكر خفيف', 0.00, 0),
('opt_sug_none', 'mod_sugar', 'sugar_free', 'بدون سكر (دايت)', 0.00, 0),
('opt_sug_extra', 'mod_sugar', 'extra', 'سكر زيادة', 0.00, 0),
('opt_ice_std', 'mod_ice', 'standard', 'ثلج مظبوط', 0.00, 1),
('opt_ice_light', 'mod_ice', 'light', 'ثلج قليل', 0.00, 0),
('opt_ice_none', 'mod_ice', 'no_ice', 'بدون ثلج', 0.00, 0);

-- Roles
INSERT OR IGNORE INTO roles (role_id, role_name, description_ar)
VALUES 
('role_owner', 'Owner', 'مالك المشروع — صلاحيات كاملة للنظام'),
('role_manager', 'Manager', 'مدير الفرع — اعتماد المشتريات والخصومات وإغلاق الورديات'),
('role_cashier', 'Cashier', 'كاشير — تسجيل الطلبات واستلام المدفوعات'),
('role_prep_staff', 'Preparation Staff', 'فريق التحضير والبار — استلام التذاكر وتحديث حالة التحضير'),
('role_inventory_mgr', 'Inventory Manager', 'مسؤول المخزن — استلام الخامات والجرد الدوري');

-- Permissions
INSERT OR IGNORE INTO permissions (permission_id, permission_code, description_ar)
VALUES 
('perm_pos_create', 'pos:create_order', 'إنشاء طلبات نقاط البيع'),
('perm_pos_discount', 'pos:apply_discount', 'تطبيق خصومات على الطلبات'),
('perm_pos_refund', 'pos:refund', 'استرجاع الطلبات ورد المبالغ'),
('perm_purchase_draft', 'purchase:create_draft', 'إنشاء مسودة فاتورة مشتريات'),
('perm_purchase_approve', 'purchase:approve', 'اعتماد فواتير المشتريات وتحديث المخزون'),
('perm_inventory_adjust', 'inventory:adjust', 'تعديل أرصدة المخزون وتسجيل الهوالك'),
('perm_shifts_close', 'shifts:close', 'إغلاق وردية ومطابقة العجز والزيادة'),
('perm_reports_view', 'reports:view', 'عرض التقارير المالية والأرباح');

-- Role Permissions Mapping
INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES 
('role_owner', 'perm_pos_create'),
('role_owner', 'perm_pos_discount'),
('role_owner', 'perm_pos_refund'),
('role_owner', 'perm_purchase_draft'),
('role_owner', 'perm_purchase_approve'),
('role_owner', 'perm_inventory_adjust'),
('role_owner', 'perm_shifts_close'),
('role_owner', 'perm_reports_view'),
('role_manager', 'perm_pos_create'),
('role_manager', 'perm_pos_discount'),
('role_manager', 'perm_pos_refund'),
('role_manager', 'perm_purchase_draft'),
('role_manager', 'perm_purchase_approve'),
('role_manager', 'perm_inventory_adjust'),
('role_manager', 'perm_shifts_close'),
('role_manager', 'perm_reports_view'),
('role_cashier', 'perm_pos_create'),
('role_cashier', 'perm_purchase_draft');

-- Payment Fee Rules
INSERT OR IGNORE INTO payment_fee_rules (rule_id, provider_name, payment_method, fee_percent, fixed_fee, contractual_tax_percent, effective_start_date, is_active)
VALUES 
('rule_card_pos', 'ماكينة الدفع الإلكتروني (فيزا / ماستركارد)', 'card', 1.500, 0.00, 14.00, '2026-01-01', 1),
('rule_instapay', 'شبكة إنستاباي الوطنية', 'instapay', 0.000, 0.00, 14.00, '2026-01-01', 1);

-- Expense Categories
INSERT OR IGNORE INTO expense_categories (category_id, name_ar, type)
VALUES 
('exp_cat_rent', 'إيجار المحل', 'fixed'),
('exp_cat_utilities', 'مرافق (كهرباء ومياه وغاز)', 'variable'),
('exp_cat_salaries', 'رواتب وأجور العمالة', 'fixed'),
('exp_cat_ops', 'مصاريف تشغيل وصيانة ونظافة', 'variable');

-- Placeholder custom ingredient for draft invoices
INSERT OR IGNORE INTO ingredients (
    ingredient_id, name_ar, name_en, category_id, purchase_unit, base_unit,
    conversion_factor, usable_yield_percent, waste_percent, reorder_level, status, is_measured, notes, created_at, updated_at
) VALUES (
    'custom', 'صنف مخصص', 'Custom Item', 'cat_fresh_fruit', 'package', 'piece',
    1.0000, 100.00, 0.00, 0.00, 'active', 1, 'خامة مخصصة للمسودات', datetime('now'), datetime('now')
);

PRAGMA foreign_keys = ON;
