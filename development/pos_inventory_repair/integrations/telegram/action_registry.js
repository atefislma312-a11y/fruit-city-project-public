/**
 * ==============================================================================
 * FRUIT CITY — TELEGRAM ACTION REGISTRY & EXECUTION LAYER
 * ==============================================================================
 * ينفذ الإجراءات التشغيلية والمالية بدقة داخل قاعدة البيانات والخادم،
 * مع التسجيل الإلزامي في سجل العمليات والتدقيق (audit_logs)،
 * وحساب تكاليف المنتجات من واقع متوسط التكلفة المرجح (WAC) والوصفات الفعلية.
 * ==============================================================================
 */

import {
  calculateItemCostsAndWaste,
  calculateIncomingStockAndWac,
  roundMoney,
  roundWeight
} from '../purchases/invoice_engine.js';
import { formatEgp, getCairoNow } from './reports.js';

/**
 * 1. قراءة وضبط الإعدادات التشغيلية (Operational Settings)
 */
export function getOperationalSetting(db, key, defaultValue = null) {
  try {
    const row = db.exec(`SELECT setting_value FROM operational_settings WHERE setting_key = '${key}';`);
    if (row && row.length > 0 && row[0].values.length > 0) {
      return row[0].values[0][0];
    }
  } catch (e) {
    // الجدول لم ينشأ بعد في النسخ القديمة
  }
  return defaultValue;
}

export function setOperationalSetting(db, { key, value, type = 'string', descriptionAr = '', user = 'owner' }) {
  const now = new Date().toISOString();
  db.run(`
    CREATE TABLE IF NOT EXISTS operational_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      setting_type VARCHAR(20) NOT NULL DEFAULT 'string',
      description_ar VARCHAR(255),
      updated_by VARCHAR(50),
      updated_at TEXT NOT NULL
    );
  `);

  const prev = getOperationalSetting(db, key, null);

  db.run(`
    INSERT INTO operational_settings (setting_key, setting_value, setting_type, description_ar, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(setting_key) DO UPDATE SET
      setting_value = excluded.setting_value,
      setting_type = excluded.setting_type,
      description_ar = excluded.description_ar,
      updated_by = excluded.updated_by,
      updated_at = excluded.updated_at;
  `, [key, String(value), type, descriptionAr, user, now]);

  // تسجيل في سجل المراجعة
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.run(`
    INSERT INTO audit_logs (log_id, user_id, action, target_type, target_id, details_json, created_at)
    VALUES (?, ?, 'SET_OPERATIONAL_SETTING', 'setting', ?, ?, ?);
  `, [logId, user, key, JSON.stringify({ key, previousValue: prev, newValue: value, descriptionAr }), now]);

  return { success: true, key, previousValue: prev, newValue: value };
}

export function setCartonTareWeight(db, { weightKg, weightGrams, fruitName = null, invoiceNumber = null, user = 'owner' }) {
  const kg = Number(weightKg || (weightGrams ? weightGrams / 1000 : 0));
  const grams = Math.round(kg * 1000);

  const settingKey = invoiceNumber ? `carton_tare_${invoiceNumber}` : (fruitName === 'تفاح' ? 'carton_tare_apple' : 'measured_carton_tare_weight');
  setOperationalSetting(db, {
    key: settingKey,
    value: kg,
    type: 'number',
    descriptionAr: `الوزن الفعلي المقاس للكرتونة الفارغة (${fruitName || invoiceNumber || 'خامات الكراتين'})`,
    user
  });

  setOperationalSetting(db, {
    key: 'default_carton_tare_weight_kg',
    value: kg,
    type: 'number',
    descriptionAr: 'الوزن الفعلي المقاس للكرتونة الفارغة',
    user
  });

  try {
    if (fruitName === 'تفاح') {
      db.run(`UPDATE ingredients SET carton_tare_weight = ? WHERE ingredient_id = 'ing_apple' OR name_ar LIKE '%تفاح%';`, [kg]);
    } else {
      db.run(`UPDATE ingredients SET carton_tare_weight = ? WHERE purchase_unit = 'carton';`, [kg]);
    }
  } catch (e) {}

  return {
    success: true,
    weightKg: kg,
    weightGrams: grams,
    fruitName,
    invoiceNumber,
    settingKey
  };
}

/**
  * مطابقة اسم المنتج بمرونة عبر اللهجة المصرية (مانجا / مانجو، فراولة / فراوله)
  * تعطي الأولوية القصوى للتطابق التام ولقسم العصائر الطبيعية الكلاسيكية (01)
  */
export function resolveProductFromDb(db, query) {
  if (!query || typeof query !== 'string') return null;
  const clean = query.trim().replace(/^(عصير|مشروب|فاكهة)\s*/i, '');

  const variations = [clean];
  if (clean.includes('مانج') || clean === 'مانجو' || clean === 'مانجا') {
    variations.push('مانجا', 'مانجو');
  }
  if (clean.includes('فراول') || clean === 'فراولة' || clean === 'فراوله') {
    variations.push('فراولة', 'فراوله');
  }
  if (clean.includes('جواف') || clean === 'جوافة' || clean === 'جوافه') {
    variations.push('جوافة', 'جوافه');
  }
  if (clean.includes('لمون') || clean === 'ليمون') {
    variations.push('ليمون', 'لمون');
  }

  const eqCond = variations.map(v => `name_ar = '${v}'`).join(' OR ');
  const likeCond = variations.map(v => `name_ar LIKE '%${v}%'`).join(' OR ');

  let rows = db.exec(`
    SELECT product_id, name_ar, is_active
    FROM products
    WHERE (${eqCond}) OR (${likeCond})
    ORDER BY
      (${eqCond}) DESC,
      (category_id = '01' OR category_id = 'prod_cat_pure') DESC,
      category_id ASC
    LIMIT 1;
  `);

  if (rows && rows.length > 0 && rows[0].values.length > 0) {
    return rows[0].values[0];
  }

  return null;
}

/**
 * 2. حساب التكلفة الفعلية للمنتج بناءً على خامات الوصفة ومتوسط التكلفة المرجح (WAC)
 */
export function calculateProductCostFromDb(db, productNameQuery) {
  let prodMatch = null;
  const clean = (productNameQuery || '').trim().replace(/^(عصير|مشروب|فاكهة)\s*/i, '');

  // محاولة تفضيل المنتجات التي لها وصفة نشطة أولاً
  try {
    const withRecipeRows = db.exec(`
      SELECT p.product_id, p.name_ar, p.is_active
      FROM products p
      JOIN recipes r ON p.product_id = r.product_id
      WHERE r.status = 'active' AND (
        p.name_ar = '${clean}' OR p.name_ar LIKE '%${clean}%' OR
        p.name_ar LIKE '%مانجا%' OR p.name_ar LIKE '%مانجو%'
      )
      ORDER BY (p.name_ar = '${clean}' OR p.name_ar = 'عصير ${clean}' OR p.name_ar = 'عصير ${clean} فريش') DESC, p.category_id ASC
      LIMIT 1;
    `);
    if (withRecipeRows && withRecipeRows.length > 0 && withRecipeRows[0].values.length > 0) {
      prodMatch = withRecipeRows[0].values[0];
    }
  } catch (_) {}

  if (!prodMatch) {
    prodMatch = resolveProductFromDb(db, productNameQuery);
  }

  if (!prodMatch) {
    return { success: false, message: `لم يتم العثور على منتج باسم: "${productNameQuery}" في قائمة الأصناف.` };
  }

  const [productId, nameAr, isActive] = prodMatch;

  // استخراج الوصفة
  const recRows = db.exec(`
    SELECT recipe_id, name_ar, batch_yield_ml, recipe_method FROM recipes
    WHERE product_id = '${productId}' AND status = 'active'
    LIMIT 1;
  `);

  if (!recRows || recRows.length === 0 || recRows[0].values.length === 0) {
    return { success: false, message: `لا توجد وصفة مكونات مسجلة للمنتج: "${nameAr}".` };
  }

  const [recipeId, recipeName, batchYieldMl] = recRows[0].values[0];

  // استخراج مكونات الوصفة وربطها بالمخزون WAC
  const ingRows = db.exec(`
    SELECT 
      ri.ingredient_id,
      ri.quantity,
      ri.unit,
      i.name_ar,
      i.base_unit,
      i.conversion_factor,
      coalesce(bi.weighted_average_cost, 0.0) as wac
    FROM recipe_ingredients ri
    JOIN ingredients i ON ri.ingredient_id = i.ingredient_id
    LEFT JOIN branch_inventory bi ON ri.ingredient_id = bi.ingredient_id
    WHERE ri.recipe_id = '${recipeId}';
  `);

  let totalIngredientsCost400 = 0;
  const ingredientsBreakdown = [];

  if (ingRows && ingRows.length > 0) {
    for (const row of ingRows[0].values) {
      const [ingId, qty, unit, ingName, baseUnit, convFactor, wac] = row;
      const numQty = Number(qty);
      const numWac = Number(wac);
      const itemCost = numQty * numWac;
      totalIngredientsCost400 += itemCost;
      ingredientsBreakdown.push({
        ingName,
        quantity: numQty,
        unit,
        wac: numWac,
        cost: roundMoney(itemCost)
      });
    }
  }

  // استخراج تكلفة التعبئة وسعر البيع من product_prices
  const priceRows = db.exec(`
    SELECT ps.size_code, ps.name_ar, pp.selling_price, pp.packaging_cost
    FROM product_prices pp
    JOIN product_sizes ps ON pp.size_id = ps.size_id
    WHERE pp.product_id = '${productId}'
    ORDER BY ps.volume_ml ASC;
  `);

  const sizes = [];
  if (priceRows && priceRows.length > 0) {
    for (const pr of priceRows[0].values) {
      const [sizeCode, sizeName, sellingPrice, packagingCost] = pr;
      const factor = sizeCode === '1L' ? 2.5 : 1.0;
      const rawCost = (totalIngredientsCost400 * factor) + Number(packagingCost || 0);
      const sellPrice = Number(sellingPrice || 0);
      const profit = sellPrice - rawCost;
      const marginPercent = sellPrice > 0 ? (profit / sellPrice) * 100 : 0;

      sizes.push({
        sizeCode,
        sizeName,
        sellingPrice: sellPrice,
        packagingCost: Number(packagingCost || 0),
        rawCost: roundMoney(rawCost),
        profit: roundMoney(profit),
        marginPercent: Math.round(marginPercent * 10) / 10
      });
    }
  }

  return {
    success: true,
    productId,
    nameAr,
    recipeName,
    ingredientsBreakdown,
    totalBaseIngredientsCost: roundMoney(totalIngredientsCost400),
    sizes
  };
}

/**
 * 3. تعديل سعر بيع منتج
 */
export function updateProductPriceInDb(db, { productName, sizeCode = '16oz', newPrice, user = 'owner' }) {
  const prodMatch = resolveProductFromDb(db, productName);

  if (!prodMatch) {
    return { success: false, message: `لم يتم العثور على منتج باسم: "${productName}".` };
  }

  const [productId, nameAr] = prodMatch;

  // استخراج المقاس
  const sizeRows = db.exec(`
    SELECT size_id, name_ar FROM product_sizes
    WHERE size_code = '${sizeCode}' LIMIT 1;
  `);

  if (!sizeRows || sizeRows.length === 0 || sizeRows[0].values.length === 0) {
    return { success: false, message: `حجم المنتج غير صالح: "${sizeCode}".` };
  }

  const [sizeId, sizeName] = sizeRows[0].values[0];

  // استخراج السعر القديم
  const curPriceRow = db.exec(`
    SELECT selling_price FROM product_prices
    WHERE product_id = '${productId}' AND size_id = '${sizeId}';
  `);

  const oldPrice = curPriceRow && curPriceRow.length > 0 ? Number(curPriceRow[0].values[0][0]) : null;
  const now = new Date().toISOString();

  for (const bId of ['branch_downtown_cairo', 'branch_al_munira']) {
    db.run(`
      INSERT INTO product_prices (price_id, product_id, size_id, branch_id, selling_price, packaging_cost, is_available, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0.0, 1, ?, ?)
      ON CONFLICT(product_id, size_id, branch_id) DO UPDATE SET
        selling_price = excluded.selling_price,
        updated_at = excluded.updated_at;
    `, [`prc_${Date.now()}_${bId}`, productId, sizeId, bId, Number(newPrice), now, now]);

    // Also sync 400ml alias if size is 16oz
    if (sizeCode === '16oz') {
      db.run(`
        INSERT INTO product_prices (price_id, product_id, size_id, branch_id, selling_price, packaging_cost, is_available, created_at, updated_at)
        VALUES (?, ?, 'size_400ml', ?, ?, 0.0, 1, ?, ?)
        ON CONFLICT(product_id, size_id, branch_id) DO UPDATE SET
          selling_price = excluded.selling_price,
          updated_at = excluded.updated_at;
      `, [`prc_${Date.now()}_400ml_${bId}`, productId, bId, Number(newPrice), now, now]);
    }
  }

  // تسجيل في سجل المراجعة
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.run(`
    INSERT INTO audit_logs (log_id, user_id, action, target_type, target_id, details_json, created_at)
    VALUES (?, ?, 'UPDATE_PRODUCT_PRICE', 'product_price', ?, ?, ?);
  `, [logId, user, `${productId}_${sizeId}`, JSON.stringify({ productName: nameAr, sizeCode, oldPrice, newPrice }), now]);

  return {
    success: true,
    productId,
    nameAr,
    sizeName,
    sizeCode,
    oldPrice,
    newPrice: Number(newPrice)
  };
}

/**
 * 4. تسجيل مصروف تشغيلي في قاعدة البيانات
 */
export function recordExpenseInDb(db, { nameAr, amount, categoryId = 'cat_exp_other', user = 'owner', notes = '' }) {
  const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();
  const cairoDate = now.substring(0, 10);

  // التأكد من وجود فئة المصروف أو إدراجها
  db.run(`
    INSERT OR IGNORE INTO expense_categories (category_id, name_ar, type)
    VALUES (?, ?, 'variable');
  `, [categoryId, categoryId.includes('util') ? 'مرافق وكهرباء' : 'مصروفات تشغيلية']);

  db.run(`
    INSERT INTO expense_records (expense_id, branch_id, category_id, name_ar, amount, expense_date, paid_by, notes, created_at)
    VALUES (?, 'branch_downtown_cairo', ?, ?, ?, ?, ?, ?, ?);
  `, [expenseId, categoryId, nameAr, Number(amount), cairoDate, user, notes || null, now]);

  // تسجيل في سجل المراجعة
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.run(`
    INSERT INTO audit_logs (log_id, user_id, action, target_type, target_id, details_json, created_at)
    VALUES (?, ?, 'RECORD_EXPENSE', 'expense', ?, ?, ?);
  `, [logId, user, expenseId, JSON.stringify({ nameAr, amount: Number(amount), categoryId }), now]);

  return {
    success: true,
    expenseId,
    nameAr,
    amount: Number(amount),
    expenseDate: cairoDate
  };
}

/**
 * 5. فحص الأصناف منتهية أو قاربت على النفاد (Low Stock)
 */
export function getLowStockItemsFromDb(db) {
  const rows = db.exec(`
    SELECT 
      i.name_ar,
      bi.stock_quantity,
      i.base_unit,
      bi.min_stock_alert,
      coalesce(bi.weighted_average_cost, 0.0) as wac
    FROM branch_inventory bi
    JOIN ingredients i ON bi.ingredient_id = i.ingredient_id
    WHERE bi.stock_quantity <= bi.min_stock_alert OR bi.stock_quantity <= 10000
    ORDER BY bi.stock_quantity ASC;
  `);

  const items = [];
  if (rows && rows.length > 0) {
    for (const r of rows[0].values) {
      items.push({
        nameAr: r[0],
        stockQuantity: Number(r[1]),
        baseUnit: r[2],
        minAlert: Number(r[3]),
        wac: Number(r[4])
      });
    }
  }

  return { success: true, items };
}

/**
 * 6. مقارنة مبيعات فترتين (Compare Sales Periods)
 */
export function compareSalesPeriodsFromDb(db) {
  const now = new Date();
  const cairoTodayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  
  // الأسبوع الحالي (آخر 7 أيام)
  const d7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
  const d7Str = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d7);

  // الأسبوع السابق (من اليوم 14 إلى اليوم 7)
  const d14 = new Date(now.getTime() - 14 * 24 * 3600 * 1000);
  const d14Str = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d14);

  const curRows = db.exec(`
    SELECT count(*), coalesce(sum(total_amount), 0)
    FROM orders
    WHERE payment_status = 'paid'
      AND substr(created_at, 1, 10) >= '${d7Str}' AND substr(created_at, 1, 10) <= '${cairoTodayStr}';
  `);

  const prevRows = db.exec(`
    SELECT count(*), coalesce(sum(total_amount), 0)
    FROM orders
    WHERE payment_status = 'paid'
      AND substr(created_at, 1, 10) >= '${d14Str}' AND substr(created_at, 1, 10) < '${d7Str}';
  `);

  const curCount = curRows && curRows.length > 0 ? Number(curRows[0].values[0][0]) : 0;
  const curSales = curRows && curRows.length > 0 ? Number(curRows[0].values[0][1]) : 0;

  const prevCount = prevRows && prevRows.length > 0 ? Number(prevRows[0].values[0][0]) : 0;
  const prevSales = prevRows && prevRows.length > 0 ? Number(prevRows[0].values[0][1]) : 0;

  const salesDiff = curSales - prevSales;
  const percentChange = prevSales > 0 ? ((salesDiff / prevSales) * 100).toFixed(1) : (curSales > 0 ? '+100' : '0');

  return {
    success: true,
    currentWeek: { period: `${d7Str} إلى ${cairoTodayStr}`, ordersCount: curCount, totalSales: curSales },
    previousWeek: { period: `${d14Str} إلى ${d7Str}`, ordersCount: prevCount, totalSales: prevSales },
    salesDiff: roundMoney(salesDiff),
    percentChange
  };
}

/**
 * 7. استرجاع آخر العمليات وسجل التدقيق (Recent Audit Logs)
 */
export function getRecentAuditLogsFromDb(db, limit = 10) {
  const rows = db.exec(`
    SELECT log_id, user_id, action, target_type, target_id, details_json, created_at
    FROM audit_logs
    ORDER BY created_at DESC
    LIMIT ${limit};
  `);

  const logs = [];
  if (rows && rows.length > 0) {
    for (const r of rows[0].values) {
      logs.push({
        logId: r[0],
        userId: r[1],
        action: r[2],
        targetType: r[3],
        targetId: r[4],
        detailsJson: r[5],
        createdAt: r[6]
      });
    }
  }

  return { success: true, count: logs.length, logs };
}

/**
 * 7.5. استخراج الفواتير المسودة المتاحة للمراجعة والاعتماد
 */
export function getDraftInvoicesFromDb(db, query = '') {
  let sql = `
    SELECT 
      pi.invoice_id, 
      pi.invoice_number, 
      pi.supplier_name, 
      pi.invoice_date, 
      pi.status, 
      pi.total_amount, 
      pi.total_weight_kg,
      coalesce(pii.custom_ingredient_name, 'صنف') as item_name
    FROM purchase_invoices pi
    LEFT JOIN purchase_invoice_items pii ON pi.invoice_id = pii.invoice_id
    WHERE pi.status = 'draft'
  `;

  if (query && typeof query === 'string' && query.trim()) {
    const q = query.trim().replace(/'/g, "''");
    sql += ` AND (pi.invoice_number LIKE '%${q}%' OR pi.supplier_name LIKE '%${q}%' OR pii.custom_ingredient_name LIKE '%${q}%')`;
  }

  sql += ` ORDER BY pi.created_at DESC LIMIT 10;`;

  const rows = db.exec(sql);
  const invoices = [];
  if (rows && rows.length > 0) {
    for (const r of rows[0].values) {
      invoices.push({
        invoiceId: r[0],
        invoiceNumber: r[1],
        supplierName: r[2] || 'مورد غير محدد',
        invoiceDate: r[3],
        status: r[4],
        totalAmount: Number(r[5] || 0),
        totalWeightKg: Number(r[6] || 0),
        itemName: r[7] || 'صنف'
      });
    }
  }

  return { success: true, count: invoices.length, invoices };
}

/**
 * 8. فحص ومراجعة فاتورة تفاح سوق العبور INV-20261017-360 أو أي فاتورة
 */
export function reviewInvoiceInDb(db, invoiceNumber = 'INV-20261017-360', options = {}) {
  const invRows = db.exec(`
    SELECT invoice_id, invoice_number, supplier_name, invoice_date, status, total_amount, total_weight_kg, notes
    FROM purchase_invoices
    WHERE invoice_number = '${invoiceNumber}';
  `);

  if (!invRows || invRows.length === 0 || invRows[0].values.length === 0) {
    return { success: false, message: `الفاتورة "${invoiceNumber}" غير موجودة في قاعدة البيانات.` };
  }

  const [invId, invNum, supplierName, invDate, status, totalAmount, totalWeightKg, notes] = invRows[0].values[0];

  const itmRows = db.exec(`
    SELECT item_id, ingredient_id, package_count, total_weight_kg, unit_price, package_fee, total_cost, custom_ingredient_name
    FROM purchase_invoice_items
    WHERE invoice_id = '${invId}';
  `);

  const items = [];
  if (itmRows && itmRows.length > 0) {
    for (const r of itmRows[0].values) {
      items.push({
        itemId: r[0],
        ingredientId: r[1],
        packageCount: Number(r[2] || 1),
        totalWeightKg: Number(r[3] || 0),
        unitPrice: Number(r[4] || 0),
        packageFee: Number(r[5] || 0),
        totalCost: Number(r[6] || 0),
        itemName: r[7] || 'صنف'
      });
    }
  }

  // قراءة الوزن الفعلي للكرتونة الفارغة المحدد للصنف أو الفاتورة
  let tareWeightKg = options.tareWeightKg !== undefined && options.tareWeightKg !== null ? Number(options.tareWeightKg) : null;
  if (tareWeightKg === null) {
    const invSpecific = getOperationalSetting(db, `carton_tare_${invoiceNumber}`, null);
    const appleSpecific = getOperationalSetting(db, 'carton_tare_apple', null);
    const generalTare = getOperationalSetting(db, 'default_carton_tare_weight_kg', null);
    const val = invSpecific || appleSpecific || generalTare;
    if (val !== null && val !== undefined && val !== '') {
      tareWeightKg = Number(val);
    }
  }

  const itm = items[0] || {};
  const grossKg = Number(totalWeightKg || itm.totalWeightKg || 0);
  const tare = tareWeightKg !== null ? tareWeightKg : null;
  const netWeightKg = tare !== null ? Math.max(0, roundWeight(grossKg - (Number(itm.packageCount || 1) * tare))) : grossKg;
  const totalCost = Number(totalAmount || itm.totalCost || 0);
  const effectiveNetKgCost = (tare !== null && netWeightKg > 0)
    ? roundMoney(totalCost / netWeightKg)
    : (grossKg > 0 ? roundMoney(totalCost / grossKg) : Number(itm.unitPrice || 0));

  return {
    success: true,
    invoiceId: invId,
    invoiceNumber: invNum,
    supplierName,
    invoiceDate: invDate,
    status,
    totalAmount: totalCost,
    totalWeightKg: grossKg,
    notes,
    items,
    configuredTareWeightKg: tare,
    netWeightKg,
    effectiveNetKgCost
  };
}

/**
 * 9. اعتماد فاتورة الشراء رسمياً وتحديث المخزون و WAC
 */
export function approveInvoiceInDb(db, { invoiceNumber = 'INV-20261017-360', tareWeightKg = undefined, pricingRule = 'gross', user = 'owner' }) {
  const review = reviewInvoiceInDb(db, invoiceNumber, { tareWeightKg });
  if (!review.success) return review;

  if (review.status === 'approved') {
    return {
      success: true,
      alreadyApproved: true,
      message: `الفاتورة ${invoiceNumber} معتمدة ومرحلة للمخزون مسبقاً (حماية 100% من التكرار).`
    };
  }

  const tareKg = tareWeightKg !== undefined && tareWeightKg !== null ? Number(tareWeightKg) : (review.configuredTareWeightKg || 0);
  const now = new Date().toISOString();

  let finalEffectiveNetCost = null;
  let finalNetKg = 0;

  // حساب التكاليف لكل صنف
  for (const itm of review.items) {
    const grossKg = itm.totalWeightKg;
    const netKg = tareKg > 0 ? Math.max(0, roundWeight(grossKg - (itm.packageCount * tareKg))) : grossKg;
    finalNetKg = netKg;

    // المبلغ الإجمالي المدفوع للمورد مبني على الوزن القائم والبيعة
    const finalTotalCost = roundMoney((grossKg * itm.unitPrice) + itm.packageFee);
    finalEffectiveNetCost = netKg > 0 ? roundMoney(finalTotalCost / netKg) : itm.unitPrice;

    // ترحيل للمخزون بـ netKg
    const hasApple = db.exec("SELECT ingredient_id FROM ingredients WHERE ingredient_id = 'ing_apple';")?.[0]?.values?.length > 0;
    const ingId = (itm.ingredientId === 'custom' && hasApple) ? 'ing_apple' : itm.ingredientId;
    const curInv = db.exec(`SELECT stock_quantity, weighted_average_cost FROM branch_inventory WHERE ingredient_id = '${ingId}';`);
    const curStock = curInv && curInv.length > 0 ? Number(curInv[0].values[0][0]) : 0;
    const curWac = curInv && curInv.length > 0 ? Number(curInv[0].values[0][1]) : 0;

    const incomingGrams = roundWeight(netKg * 1000);
    const incomingPricePerGram = incomingGrams > 0 ? roundMoney(finalTotalCost / incomingGrams, 4) : 0;
    const newStock = curStock + incomingGrams;
    const newWac = newStock > 0 ? roundMoney(((curStock * curWac) + finalTotalCost) / newStock, 4) : curWac;

    // تحديث رصيد المخزن
    db.run(`
      INSERT INTO branch_inventory (branch_id, ingredient_id, stock_quantity, weighted_average_cost, min_stock_alert, updated_at)
      VALUES ('branch_downtown_cairo', ?, ?, ?, 10000, ?)
      ON CONFLICT(branch_id, ingredient_id) DO UPDATE SET
        stock_quantity = excluded.stock_quantity,
        weighted_average_cost = excluded.weighted_average_cost,
        updated_at = excluded.updated_at;
    `, [ingId, newStock, newWac, now]);

    // تسجيل في دفتر حركات المخزون مع مفتاح Idempotency
    const mvtId = `mvt_pur_${review.invoiceId}_${itm.itemId}`;
    const idempKey = `idemp_pur_${review.invoiceId}_${itm.itemId}`;
    db.run(`
      INSERT INTO inventory_movements (movement_id, branch_id, ingredient_id, movement_type, quantity, unit, unit_cost, total_cost, balance_after, reference_type, reference_id, user_id, idempotency_key, created_at)
      VALUES (?, 'branch_downtown_cairo', ?, 'purchase_receipt', ?, 'g', ?, ?, ?, 'purchase_invoice', ?, ?, ?, ?);
    `, [mvtId, ingId, incomingGrams, incomingPricePerGram, finalTotalCost, newStock, review.invoiceId, user, idempKey, now]);

    // تحديث الوزن الصافي وتكلفة الكيلو الصافي في بنود الفاتورة
    try {
      db.run(`
        UPDATE purchase_invoice_items SET
          weight_before_peeling = ?,
          weight_after_peeling = ?,
          effective_net_kg_cost = ?
        WHERE item_id = ?;
      `, [grossKg, netKg, finalEffectiveNetCost, itm.itemId]);
    } catch (e) {}
  }

  // تحديث حالة الفاتورة لمعتمدة
  db.run(`
    UPDATE purchase_invoices
    SET status = 'approved', approved_by = ?, approved_at = ?
    WHERE invoice_id = ?;
  `, [user, now, review.invoiceId]);

  // تسجيل في سجل المراجعة
  const logId = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  db.run(`
    INSERT INTO audit_logs (log_id, user_id, action, target_type, target_id, details_json, created_at)
    VALUES (?, ?, 'APPROVE_PURCHASE_INVOICE', 'purchase_invoice', ?, ?, ?);
  `, [logId, user, review.invoiceId, JSON.stringify({ invoiceNumber, pricingRule, tareKg, netKg: finalNetKg, effectiveNetCost: finalEffectiveNetCost }), now]);

  return {
    success: true,
    invoiceId: review.invoiceId,
    invoiceNumber,
    status: 'approved',
    pricingRule,
    grossKg: review.totalWeightKg,
    netKg: finalNetKg,
    effectiveNetKgCost: finalEffectiveNetCost,
    tareKgApplied: tareKg
  };
}
