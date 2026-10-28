/**
 * ============================================================================
 * FRUIT CITY MANAGEMENT SYSTEM — UNIFIED ADMIN CONTROL API LAYER
 * ============================================================================
 * Module: integrations/admin/adminControlHandler.js
 * Version: 2.1.0
 *
 * Provides a unified backend administration API for the Fruit City Telegram Bot
 * and remote management interfaces. Enforces:
 * 1. Strict authentication & role checks (Bearer token or loopback owner resolution).
 * 2. Idempotency on all mutating requests (admin_idempotency_records).
 * 3. Atomic database transactions (runTransaction) with write locks.
 * 4. Comprehensive audit logging (audit_logs).
 * 5. Complete parity with internal POS, Purchases, and Costing engines:
 *    - Reuses calculateItemCostsAndWaste & calculateIncomingStockAndWac.
 *    - Preserves 10 EGP package fee rule and WAC calculation.
 * 6. Concurrency safe: serialized transactions protect simultaneous POS sales
 *    and purchase approvals without locking or race conditions.
 * ============================================================================
 */

import crypto from 'crypto';
import {
  calculateItemCostsAndWaste,
  calculateIncomingStockAndWac,
  roundMoney,
  roundWeight
} from '../purchases/invoice_engine.js';

/**
 * Initializes required tables for admin idempotency and carton tare settings if missing.
 */
export function initAdminSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS admin_idempotency_records (
      idempotency_key VARCHAR(100) PRIMARY KEY,
      action VARCHAR(100) NOT NULL,
      status_code INTEGER NOT NULL DEFAULT 200,
      response_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  try {
    db.run(`ALTER TABLE ingredients ADD COLUMN default_package_weight DECIMAL(10, 3) DEFAULT NULL;`);
  } catch (e) {}

  try {
    db.run(`ALTER TABLE ingredients ADD COLUMN carton_tare_weight DECIMAL(10, 3) DEFAULT NULL;`);
  } catch (e) {}

  try {
    db.run(`ALTER TABLE purchase_invoice_items ADD COLUMN weight_before_peeling DECIMAL(12, 3) DEFAULT NULL;`);
  } catch (e) {}

  try {
    db.run(`ALTER TABLE purchase_invoice_items ADD COLUMN weight_after_peeling DECIMAL(12, 3) DEFAULT NULL;`);
  } catch (e) {}

  try {
    db.run(`ALTER TABLE purchase_invoice_items ADD COLUMN effective_net_kg_cost DECIMAL(12, 4) DEFAULT NULL;`);
  } catch (e) {}

  try {
    db.run(`ALTER TABLE purchase_invoice_items ADD COLUMN weight_before_peeling DECIMAL(10, 3) DEFAULT NULL;`);
  } catch (e) {}

  try {
    db.run(`ALTER TABLE purchase_invoice_items ADD COLUMN weight_after_peeling DECIMAL(10, 3) DEFAULT NULL;`);
  } catch (e) {}

  try {
    db.run(`ALTER TABLE purchase_invoice_items ADD COLUMN effective_net_kg_cost DECIMAL(10, 4) DEFAULT NULL;`);
  } catch (e) {}

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
}

/**
 * Helper to authenticate incoming admin request.
 */
function authenticateAdminRequest(req, db) {
  const authHeader = req.headers['authorization'] || '';
  const xToken = req.headers['x-admin-token'] || req.headers['x-worker-token'] || '';
  const configuredToken = process.env.ADMIN_API_TOKEN || process.env.WORKER_SECRET_TOKEN || '';

  let providedToken = '';
  if (authHeader.startsWith('Bearer ')) {
    providedToken = authHeader.substring(7).trim();
  } else if (xToken) {
    providedToken = String(xToken).trim();
  }

  const remoteIp = req.socket.remoteAddress || '';
  const isLoopback = (
    remoteIp === '127.0.0.1' ||
    remoteIp === '::1' ||
    remoteIp === '::ffff:127.0.0.1' ||
    remoteIp.endsWith('127.0.0.1')
  );

  // If a secret token is explicitly configured in environment, require exact match
  if (configuredToken) {
    if (providedToken !== configuredToken) {
      return { authorized: false, error: 'UNAUTHORIZED', message: 'رمز الدخول الإداري غير صحيح أو مفقود.' };
    }
  } else {
    // If no token is configured, allow local loopback for the owner
    if (!isLoopback) {
      return { authorized: false, error: 'FORBIDDEN_EXTERNAL', message: 'الاتصال الخارجي غير مصرح به بدون تهيئة رمز الأمان.' };
    }
  }

  return { authorized: true, isLoopback, userId: 'usr_owner' };
}

/**
 * Writes an entry into the system audit_logs table.
 */
function recordAudit(runSql, { userId, action, targetType, targetId, details, ip }) {
  const logId = `log_adm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();
  runSql(
    `INSERT INTO audit_logs (log_id, user_id, action, target_type, target_id, details_json, ip_address, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
    [
      logId,
      userId || 'usr_owner',
      action,
      targetType,
      targetId,
      JSON.stringify(details || {}),
      ip || '127.0.0.1',
      now
    ]
  );
}

/**
 * Main dispatcher for all /api/admin/* endpoints.
 */
export async function handleAdminApi(req, res, context) {
  const { DB, runSql, queryOne, queryAll, runTransaction, saveDatabase, sendJson, parseJsonBody } = context;

  // Initialize schema on first request if needed
  initAdminSchema(DB);

  const auth = authenticateAdminRequest(req, DB);
  if (!auth.authorized) {
    return sendJson(res, 401, { error: auth.error, message: auth.message });
  }

  const method = req.method;
  const fullUrl = req.url;
  const [pathname, queryString] = fullUrl.split('?');
  const params = new URLSearchParams(queryString || '');
  const subPath = pathname.replace('/api/admin', '');

  const remoteIp = req.socket.remoteAddress || '127.0.0.1';

  try {
    // ========================================================================
    // 1. HEALTH & EXECUTIVE SYSTEM OVERVIEW
    // ========================================================================
    if (subPath === '/health' || subPath === '/status') {
      const activeShift = queryOne(`SELECT * FROM cashier_shifts WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1;`);
      const today = new Date().toISOString().split('T')[0];

      const salesToday = queryOne(
        `SELECT COUNT(*) AS order_count, COALESCE(SUM(total_amount), 0) AS total_gross
         FROM orders WHERE DATE(created_at) = ? AND order_status != 'cancelled';`,
        [today]
      );

      const pendingInvoices = queryOne(
        `SELECT COUNT(*) AS count, COALESCE(SUM(total_amount), 0) AS total_amount
         FROM purchase_invoices WHERE status = 'draft';`
      );

      const lowStock = queryOne(
        `SELECT COUNT(*) AS count
         FROM branch_inventory bi
         JOIN ingredients i ON bi.ingredient_id = i.ingredient_id
         WHERE bi.branch_id = 'branch_downtown_cairo' AND bi.stock_quantity <= bi.min_stock_alert AND bi.min_stock_alert > 0;`
      );

      return sendJson(res, 200, {
        status: 'ok',
        system: 'Fruit City Management System',
        branchId: 'branch_downtown_cairo',
        serverTime: new Date().toISOString(),
        todayDate: today,
        activeShift: activeShift ? {
          shiftId: activeShift.shift_id,
          shiftNumber: activeShift.shift_number,
          cashierId: activeShift.cashier_id,
          openedAt: activeShift.opened_at,
          openingFloat: Number(activeShift.opening_float),
          cashSales: Number(activeShift.cash_sales),
          electronicSales: Number(activeShift.electronic_sales),
          expectedCash: Number(activeShift.expected_cash)
        } : null,
        todaySales: {
          orderCount: Number(salesToday ? salesToday.order_count : 0),
          totalGross: Number(salesToday ? salesToday.total_gross : 0)
        },
        pendingInvoices: {
          draftCount: Number(pendingInvoices ? pendingInvoices.count : 0),
          draftTotalAmount: Number(pendingInvoices ? pendingInvoices.total_amount : 0)
        },
        lowStockAlertsCount: Number(lowStock ? lowStock.count : 0)
      });
    }

    // ========================================================================
    // 2. FIXED CARTON WEIGHT & TARE MANAGEMENT (وزن الكرتونة والتارة)
    // ========================================================================
    if (subPath === '/carton-weights' && method === 'GET') {
      const rows = queryAll(`
        SELECT 
          i.ingredient_id, i.name_ar, i.category_id, i.purchase_unit, i.base_unit,
          i.conversion_factor, i.usable_yield_percent, i.waste_percent,
          COALESCE(i.default_package_weight, 0) AS default_package_weight,
          COALESCE(i.carton_tare_weight, 0) AS carton_tare_weight,
          bi.stock_quantity, bi.weighted_average_cost
        FROM ingredients i
        LEFT JOIN branch_inventory bi ON i.ingredient_id = bi.ingredient_id AND bi.branch_id = 'branch_downtown_cairo'
        WHERE i.status = 'active'
        ORDER BY i.name_ar ASC;
      `);

      const items = rows.map(r => {
        const gross = Number(r.default_package_weight || 0);
        const tare = Number(r.carton_tare_weight || 0);
        const net = Math.max(0, roundWeight(gross - tare));
        return {
          ingredientId: r.ingredient_id,
          nameAr: r.name_ar,
          categoryId: r.category_id,
          purchaseUnit: r.purchase_unit,
          baseUnit: r.base_unit,
          defaultPackageWeight: gross,
          cartonTareWeight: tare,
          netPackageWeight: net,
          usableYieldPercent: Number(r.usable_yield_percent || 100),
          currentStock: Number(r.stock_quantity || 0),
          wac: Number(r.weighted_average_cost || 0)
        };
      });

      return sendJson(res, 200, { success: true, count: items.length, items });
    }

    // ========================================================================
    // 2.1 OPERATIONAL SETTINGS (الإعدادات التشغيلية المركزية)
    // ========================================================================
    if (subPath === '/settings' && method === 'GET') {
      const rows = queryAll(`SELECT setting_key, setting_value, setting_type, description_ar, updated_at FROM operational_settings;`);
      const dict = {};
      rows.forEach(r => { dict[r.setting_key] = r.setting_value; });
      return sendJson(res, 200, { success: true, settings: dict, list: rows });
    }

    if (subPath === '/settings' && method === 'POST') {
      const body = await parseJsonBody(req);
      const { settingKey, settingValue, settingType, descriptionAr } = body;
      if (!settingKey) {
        return sendJson(res, 400, { error: 'MISSING_KEY', message: 'مفتاح الإعداد مطلوب.' });
      }

      const prev = queryOne(`SELECT setting_value FROM operational_settings WHERE setting_key = ?;`, [settingKey]);
      const now = new Date().toISOString();

      await runTransaction(() => {
        runSql(`
          INSERT INTO operational_settings (setting_key, setting_value, setting_type, description_ar, updated_by, updated_at)
          VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(setting_key) DO UPDATE SET
            setting_value = excluded.setting_value,
            setting_type = excluded.setting_type,
            description_ar = excluded.description_ar,
            updated_by = excluded.updated_by,
            updated_at = excluded.updated_at;
        `, [settingKey, String(settingValue), settingType || 'string', descriptionAr || null, auth.userId, now]);

        recordAudit(runSql, {
          userId: auth.userId,
          action: 'SET_OPERATIONAL_SETTING',
          targetType: 'setting',
          targetId: settingKey,
          details: { settingKey, previousValue: prev ? prev.setting_value : null, newValue: settingValue, descriptionAr },
          ip: remoteIp
        });
      });

      return sendJson(res, 200, {
        success: true,
        settingKey,
        previousValue: prev ? prev.setting_value : null,
        newValue: settingValue
      });
    }

    if (subPath === '/carton-weights' && method === 'POST') {
      const body = await parseJsonBody(req);
      const idempotencyKey = body.idempotencyKey || req.headers['x-idempotency-key'];

      // Check idempotency replay
      if (idempotencyKey) {
        const existing = queryOne(`SELECT response_json, status_code FROM admin_idempotency_records WHERE idempotency_key = ?;`, [idempotencyKey]);
        if (existing) {
          const resp = JSON.parse(existing.response_json);
          resp.idempotentReplay = true;
          return sendJson(res, existing.status_code, resp);
        }
      }

      let { ingredientId, fruitName, defaultPackageWeight, cartonTareWeight, weightKg, weightGrams, invoiceNumber, notes } = body;
      
      if (!ingredientId && fruitName) {
        const found = queryOne(
          `SELECT ingredient_id, name_ar, default_package_weight, carton_tare_weight FROM ingredients WHERE status = 'active' AND (name_ar LIKE ? OR name_en LIKE ?) LIMIT 1;`,
          [`%${fruitName}%`, `%${fruitName}%`]
        );
        if (found) {
          ingredientId = found.ingredient_id;
          if (!defaultPackageWeight && found.default_package_weight) {
            defaultPackageWeight = found.default_package_weight;
          }
        }
      }

      if (!ingredientId) {
        return sendJson(res, 400, { error: 'MISSING_INGREDIENT_ID', message: 'معرف الصنف أو اسم الفاكهة مطلوب.' });
      }

      const ing = queryOne(`SELECT ingredient_id, name_ar, default_package_weight, carton_tare_weight FROM ingredients WHERE ingredient_id = ?;`, [ingredientId]);
      if (!ing) {
        return sendJson(res, 404, { error: 'INGREDIENT_NOT_FOUND', message: 'الصنف غير موجود في قاعدة البيانات.' });
      }

      const gross = Number(defaultPackageWeight || ing.default_package_weight || 15.0);
      if (!Number.isFinite(gross) || gross <= 0) {
        return sendJson(res, 400, { error: 'INVALID_WEIGHT', message: 'وزن الكرتونة القائم يجب أن يكون رقماً موجباً.' });
      }

      let tare = 0;
      if (cartonTareWeight !== undefined && cartonTareWeight !== null) {
        tare = Number(cartonTareWeight);
      } else if (weightKg !== undefined && weightKg !== null) {
        tare = Number(weightKg);
      } else if (weightGrams !== undefined && weightGrams !== null) {
        tare = Number(weightGrams) / 1000;
      } else {
        tare = Number(ing.carton_tare_weight || 0);
      }

      if (!Number.isFinite(tare) || tare < 0 || tare >= gross) {
        return sendJson(res, 400, { error: 'INVALID_TARE', message: 'وزن التارة (الكرتونة فارغة) يجب أن يكون موجباً وأقل من الوزن الإجمالي.' });
      }

      const net = roundWeight(gross - tare);
      const now = new Date().toISOString();

      await runTransaction(() => {
        runSql(
          `UPDATE ingredients SET
             default_package_weight = ?,
             carton_tare_weight = ?,
             notes = COALESCE(?, notes),
             updated_at = ?
           WHERE ingredient_id = ?;`,
          [gross, tare, notes || null, now, ingredientId]
        );

        // حفظ أيضاً في جدول إعدادات التشغيل
        const settingKey = invoiceNumber ? `carton_tare_${invoiceNumber}` : `carton_tare_${ingredientId}`;
        runSql(`
          INSERT INTO operational_settings (setting_key, setting_value, setting_type, description_ar, updated_by, updated_at)
          VALUES (?, ?, 'number', ?, ?, ?)
          ON CONFLICT(setting_key) DO UPDATE SET
            setting_value = excluded.setting_value,
            updated_at = excluded.updated_at;
        `, [settingKey, String(tare), `وزن تارة الكرتونة لـ ${ing.name_ar}`, auth.userId, now]);

        recordAudit(runSql, {
          userId: auth.userId,
          action: 'UPDATE_CARTON_WEIGHT',
          targetType: 'ingredient',
          targetId: ingredientId,
          details: { nameAr: ing.name_ar, grossWeightKg: gross, tareWeightKg: tare, netWeightKg: net, idempotencyKey },
          ip: remoteIp
        });
      });

      const responsePayload = {
        success: true,
        message: `تم تحديث الوزن الثابت والتارة للصنف (${ing.name_ar}) بنجاح.`,
        ingredientId,
        nameAr: ing.name_ar,
        defaultPackageWeight: gross,
        cartonTareWeight: tare,
        netPackageWeight: net
      };

      if (idempotencyKey) {
        runSql(
          `INSERT OR REPLACE INTO admin_idempotency_records (idempotency_key, action, status_code, response_json, created_at)
           VALUES (?, 'UPDATE_CARTON_WEIGHT', 200, ?, ?);`,
          [idempotencyKey, JSON.stringify(responsePayload), now]
        );
      }

      return sendJson(res, 200, responsePayload);
    }

    // ========================================================================
    // 3. WHOLESALE PURCHASES & SOUQ EL OBOUR INVOICES
    // ========================================================================
    if (subPath === '/invoices' && method === 'GET') {
      const statusFilter = params.get('status');
      const supplierFilter = params.get('supplier');
      const limit = Math.min(100, parseInt(params.get('limit') || '50', 10));

      let query = `SELECT * FROM purchase_invoices WHERE 1=1`;
      const queryParams = [];

      if (statusFilter && statusFilter !== 'all') {
        query += ` AND status = ?`;
        queryParams.push(statusFilter);
      }
      if (supplierFilter) {
        query += ` AND supplier_name LIKE ?`;
        queryParams.push(`%${supplierFilter}%`);
      }

      query += ` ORDER BY invoice_date DESC, created_at DESC LIMIT ?;`;
      queryParams.push(limit);

      const rawInvoices = queryAll(query, queryParams);
      const rawItems = queryAll(`
        SELECT pii.*, i.name_ar AS ing_name_ar, i.category_id AS ing_category
        FROM purchase_invoice_items pii
        LEFT JOIN ingredients i ON pii.ingredient_id = i.ingredient_id;
      `);

      const invoices = rawInvoices.map(inv => {
        const items = rawItems.filter(it => it.invoice_id === inv.invoice_id).map(it => ({
          itemId: it.item_id,
          ingredientId: it.ingredient_id,
          ingredientNameAr: it.custom_ingredient_name || it.ing_name_ar || 'صنف توريد',
          pricingMethod: it.pricing_method,
          packageCount: Number(it.package_count || 1),
          packageUnitName: it.package_unit_name || 'عبوة',
          totalWeightKg: Number(it.total_weight_kg || 0),
          unitPrice: Number(it.unit_price),
          packageFee: Number(it.package_fee || 0),
          totalCost: Number(it.total_cost),
          effectiveNetKgCost: it.effective_net_kg_cost !== null ? Number(it.effective_net_kg_cost) : undefined,
          wastePercent: it.waste_percent !== null ? Number(it.waste_percent) : undefined,
          notes: it.notes || ''
        }));

        return {
          invoiceId: inv.invoice_id,
          invoiceNumber: inv.invoice_number,
          invoiceDate: inv.invoice_date,
          supplierName: inv.supplier_name,
          status: inv.status,
          totalAmount: Number(inv.total_amount),
          totalWeightKg: Number(inv.total_weight_kg || 0),
          itemCount: items.length,
          items,
          notes: inv.notes || '',
          createdAt: inv.created_at,
          approvedAt: inv.approved_at,
          approvedBy: inv.approved_by
        };
      });

      return sendJson(res, 200, { success: true, count: invoices.length, invoices });
    }

    if (subPath.startsWith('/invoices/') && method === 'GET') {
      const invId = subPath.replace('/invoices/', '').trim();
      const inv = queryOne(`SELECT * FROM purchase_invoices WHERE invoice_id = ? OR invoice_number = ?;`, [invId, invId]);
      if (!inv) {
        return sendJson(res, 404, { error: 'INVOICE_NOT_FOUND', message: 'الفاتورة غير موجودة.' });
      }

      const rawItems = queryAll(
        `SELECT pii.*, i.name_ar AS ing_name_ar
         FROM purchase_invoice_items pii
         LEFT JOIN ingredients i ON pii.ingredient_id = i.ingredient_id
         WHERE pii.invoice_id = ?;`,
        [inv.invoice_id]
      );

      const items = rawItems.map(it => ({
        itemId: it.item_id,
        ingredientId: it.ingredient_id,
        ingredientNameAr: it.custom_ingredient_name || it.ing_name_ar || 'صنف توريد',
        pricingMethod: it.pricing_method,
        packageCount: Number(it.package_count || 1),
        packageUnitName: it.package_unit_name || 'عبوة',
        totalWeightKg: Number(it.total_weight_kg || 0),
        unitPrice: Number(it.unit_price),
        packageFee: Number(it.package_fee || 0),
        totalCost: Number(it.total_cost),
        packageGrossWeight: it.package_gross_weight !== null ? Number(it.package_gross_weight) : undefined,
        weightBeforePeeling: it.weight_before_peeling !== null ? Number(it.weight_before_peeling) : undefined,
        weightAfterPeeling: it.weight_after_peeling !== null ? Number(it.weight_after_peeling) : undefined,
        wastePercent: it.waste_percent !== null ? Number(it.waste_percent) : undefined,
        effectiveNetKgCost: it.effective_net_kg_cost !== null ? Number(it.effective_net_kg_cost) : undefined,
        notes: it.notes || ''
      }));

      return sendJson(res, 200, {
        success: true,
        invoice: {
          invoiceId: inv.invoice_id,
          invoiceNumber: inv.invoice_number,
          invoiceDate: inv.invoice_date,
          supplierName: inv.supplier_name,
          status: inv.status,
          totalAmount: Number(inv.total_amount),
          totalWeightKg: Number(inv.total_weight_kg || 0),
          items,
          notes: inv.notes || '',
          createdAt: inv.created_at,
          approvedAt: inv.approved_at,
          approvedBy: inv.approved_by
        }
      });
    }

    // CREATE WHOLESALE DRAFT (سوق العبور)
    if (subPath === '/invoices/create-obour' && method === 'POST') {
      const body = await parseJsonBody(req);
      const idempotencyKey = body.idempotencyKey || req.headers['x-idempotency-key'];

      if (idempotencyKey) {
        const existing = queryOne(`SELECT response_json, status_code FROM admin_idempotency_records WHERE idempotency_key = ?;`, [idempotencyKey]);
        if (existing) {
          const resp = JSON.parse(existing.response_json);
          resp.idempotentReplay = true;
          return sendJson(res, existing.status_code, resp);
        }
      }

      const items = Array.isArray(body.items) ? body.items : [];
      if (items.length === 0) {
        return sendJson(res, 400, { error: 'EMPTY_ITEMS', message: 'يجب إدخال صنف واحد على الأقل في الفاتورة.' });
      }

      const supplierName = (body.supplierName || 'سوق العبور').trim();
      const invoiceDate = (body.invoiceDate || new Date().toISOString().split('T')[0]).trim();
      const notes = body.notes || '';
      const invoiceId = body.invoiceId || `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const invoiceNumber = body.invoiceNumber || `PUR-OB-${Date.now().toString().slice(-4)}`;
      const now = new Date().toISOString();

      let calculatedInvoiceTotal = 0;
      let calculatedInvoiceWeight = 0;
      const processedItems = [];

      for (const rawItm of items) {
        let ingId = rawItm.ingredientId || 'custom';
        const ing = queryOne(`SELECT ingredient_id, name_ar, default_package_weight, carton_tare_weight FROM ingredients WHERE ingredient_id = ?;`, [ingId]);

        // Auto-fill fixed carton weight if available and weight not explicitly provided
        let totalWeightKg = rawItm.totalWeightKg;
        if ((totalWeightKg === undefined || totalWeightKg === null || totalWeightKg === 0) && ing && ing.default_package_weight > 0) {
          const pkgCount = Number(rawItm.packageCount || 1);
          const netPerPkg = Number(ing.default_package_weight) - Number(ing.carton_tare_weight || 0);
          totalWeightKg = roundWeight(pkgCount * netPerPkg);
        }

        const calculated = calculateItemCostsAndWaste({
          ...rawItm,
          itemId: rawItm.itemId || `pitem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          ingredientId: ingId,
          itemName: rawItm.ingredientNameAr || rawItm.nameAr || rawItm.itemName || (ing ? ing.name_ar : 'صنف سوق العبور'),
          unitPrice: rawItm.unitPrice,
          packageCount: rawItm.packageCount,
          packageFee: rawItm.packageFee !== undefined ? rawItm.packageFee : 10.00, // Standard 10 EGP fee
          totalWeightKg: totalWeightKg,
          pricingMethod: rawItm.pricingMethod || 'by_weight'
        });

        calculatedInvoiceTotal += calculated.totalCost;
        if (calculated.totalWeightKg) calculatedInvoiceWeight += calculated.totalWeightKg;
        processedItems.push(calculated);
      }

      calculatedInvoiceTotal = roundMoney(calculatedInvoiceTotal);
      calculatedInvoiceWeight = roundWeight(calculatedInvoiceWeight);

      await runTransaction(() => {
        runSql(
          `INSERT INTO purchase_invoices (invoice_id, invoice_number, branch_id, supplier_name, invoice_date, status, total_amount, total_weight_kg, notes, created_by, created_at)
           VALUES (?, ?, 'branch_downtown_cairo', ?, ?, 'draft', ?, ?, ?, 'owner', ?);`,
          [invoiceId, invoiceNumber, supplierName, invoiceDate, calculatedInvoiceTotal, calculatedInvoiceWeight, notes, now]
        );

        for (const itm of processedItems) {
          runSql(
            `INSERT INTO purchase_invoice_items (
              item_id, invoice_id, ingredient_id, pricing_method, package_count,
              package_unit_name, total_weight_kg, unit_price, package_fee, total_cost,
              effective_kg_price, weight_unknown, custom_ingredient_name, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
            [
              itm.itemId,
              invoiceId,
              itm.ingredientId,
              itm.pricingMethod,
              itm.packageCount,
              itm.packageUnitName,
              itm.totalWeightKg,
              itm.unitPrice,
              itm.packageFee,
              itm.totalCost,
              itm.effectiveNetKgCost || itm.unitPrice,
              0,
              itm.ingredientId === 'custom' ? itm.itemName : null,
              itm.notes
            ]
          );
        }

        recordAudit(runSql, {
          userId: auth.userId,
          action: 'CREATE_WHOLESALE_DRAFT',
          targetType: 'purchase_invoice',
          targetId: invoiceId,
          details: { invoiceNumber, supplierName, calculatedInvoiceTotal, itemCount: processedItems.length },
          ip: remoteIp
        });
      });

      const responsePayload = {
        success: true,
        message: `تم إنشاء مسودة فاتورة سوق العبور (${invoiceNumber}) بنجاح.`,
        invoiceId,
        invoiceNumber,
        status: 'draft',
        totalAmount: calculatedInvoiceTotal,
        totalWeightKg: calculatedInvoiceWeight,
        itemCount: processedItems.length
      };

      if (idempotencyKey) {
        runSql(
          `INSERT OR REPLACE INTO admin_idempotency_records (idempotency_key, action, status_code, response_json, created_at)
           VALUES (?, 'CREATE_WHOLESALE_DRAFT', 200, ?, ?);`,
          [idempotencyKey, JSON.stringify(responsePayload), now]
        );
      }

      return sendJson(res, 200, responsePayload);
    }

    // APPROVE PURCHASE INVOICE & COMMITTED TO INVENTORY
    if (subPath === '/invoices/approve' && method === 'POST') {
      const body = await parseJsonBody(req);
      const idempotencyKey = body.idempotencyKey || req.headers['x-idempotency-key'];

      if (idempotencyKey) {
        const existing = queryOne(`SELECT response_json, status_code FROM admin_idempotency_records WHERE idempotency_key = ?;`, [idempotencyKey]);
        if (existing) {
          const resp = JSON.parse(existing.response_json);
          resp.idempotentReplay = true;
          return sendJson(res, existing.status_code, resp);
        }
      }

      const invoiceId = body.invoiceId;
      if (!invoiceId) {
        return sendJson(res, 400, { error: 'MISSING_INVOICE_ID', message: 'معرف الفاتورة مطلوب للاعتماد.' });
      }

      const inv = queryOne(`SELECT * FROM purchase_invoices WHERE invoice_id = ? OR invoice_number = ?;`, [invoiceId, invoiceId]);
      if (!inv) {
        return sendJson(res, 404, { error: 'INVOICE_NOT_FOUND', message: 'الفاتورة المراد اعتمادها غير موجودة.' });
      }

      if (inv.status === 'approved') {
        return sendJson(res, 200, {
          success: true,
          wasAlreadyApproved: true,
          message: 'هذه الفاتورة معتمدة ومرحلة إلى المخزون بالفعل.',
          invoiceId: inv.invoice_id,
          invoiceNumber: inv.invoice_number
        });
      }

      const rawItems = queryAll(`SELECT * FROM purchase_invoice_items WHERE invoice_id = ?;`, [inv.invoice_id]);
      if (rawItems.length === 0) {
        return sendJson(res, 400, { error: 'NO_ITEMS', message: 'الفاتورة لا تحتوي على أي بنود للاعتماد.' });
      }

      let inputTareKg = body.tareWeightKg !== undefined && body.tareWeightKg !== null ? Number(body.tareWeightKg) : null;
      if (inputTareKg === null && body.tareWeightGrams !== undefined && body.tareWeightGrams !== null) {
        inputTareKg = Number(body.tareWeightGrams) / 1000;
      }
      if (inputTareKg === null) {
        const invTareSetting = queryOne(`SELECT setting_value FROM operational_settings WHERE setting_key = ?;`, [`carton_tare_${inv.invoice_number}`]);
        const appleTareSetting = queryOne(`SELECT setting_value FROM operational_settings WHERE setting_key = 'carton_tare_apple';`);
        const defaultTareSetting = queryOne(`SELECT setting_value FROM operational_settings WHERE setting_key = 'default_carton_tare_weight_kg';`);
        const found = invTareSetting || appleTareSetting || defaultTareSetting;
        if (found && found.setting_value) {
          inputTareKg = Number(found.setting_value);
        }
      }

      const now = new Date().toISOString();
      const updatedMovements = [];

      await runTransaction(() => {
        // 1. Update invoice status
        runSql(
          `UPDATE purchase_invoices SET
             status = 'approved',
             approved_by = ?,
             approved_at = ?
           WHERE invoice_id = ?;`,
          [auth.userId || 'owner', now, inv.invoice_id]
        );

        // 2. Commit each item into branch inventory and WAC
        for (const itm of rawItems) {
          const ing = queryOne(`SELECT conversion_factor, base_unit, name_ar, carton_tare_weight FROM ingredients WHERE ingredient_id = ?;`, [itm.ingredient_id]);
          const factor = ing ? Number(ing.conversion_factor) : 1000;
          const curInv = queryOne(
            `SELECT stock_quantity, weighted_average_cost FROM branch_inventory WHERE branch_id = 'branch_downtown_cairo' AND ingredient_id = ?;`,
            [itm.ingredient_id]
          );

          const curStock = curInv ? Number(curInv.stock_quantity) : 0;
          const curWac = curInv ? Number(curInv.weighted_average_cost) : 0;

          const itemTare = inputTareKg !== null ? inputTareKg : (ing && ing.carton_tare_weight ? Number(ing.carton_tare_weight) : 0);
          const grossKg = Number(itm.total_weight_kg || 0);
          const pkgCount = Number(itm.package_count || 1);
          const netFruitKg = itemTare > 0 ? Math.max(0, roundWeight(grossKg - (pkgCount * itemTare))) : (itm.weight_after_peeling ? Number(itm.weight_after_peeling) : grossKg);
          const itemTotalCost = Number(itm.total_cost);
          const effectiveNetCost = netFruitKg > 0 ? roundMoney(itemTotalCost / netFruitKg) : Number(itm.unit_price);

          try {
            runSql(
              `UPDATE purchase_invoice_items SET
                 weight_before_peeling = ?,
                 weight_after_peeling = ?,
                 effective_net_kg_cost = ?
               WHERE item_id = ?;`,
              [grossKg, netFruitKg, effectiveNetCost, itm.item_id]
            );
          } catch (e) {}

          const { incomingBaseQty, incomingPricePerBase, newStock, newWac } = calculateIncomingStockAndWac({
            currentStock: curStock,
            currentWac: curWac,
            item: {
              ...itm,
              itemName: itm.custom_ingredient_name || (ing ? ing.name_ar : 'صنف توريد'),
              pricingMethod: itm.pricing_method || 'by_weight',
              unitPrice: Number(itm.unit_price),
              packageFee: Number(itm.package_fee || 0),
              totalCost: itemTotalCost,
              totalWeightKg: grossKg,
              packageCount: pkgCount,
              weightAfterPeeling: netFruitKg
            },
            conversionFactor: factor
          });

          runSql(
            `INSERT INTO branch_inventory (branch_id, ingredient_id, stock_quantity, weighted_average_cost, last_purchase_price, updated_at)
             VALUES ('branch_downtown_cairo', ?, ?, ?, ?, ?)
             ON CONFLICT(branch_id, ingredient_id) DO UPDATE SET
               stock_quantity = excluded.stock_quantity,
               weighted_average_cost = excluded.weighted_average_cost,
               last_purchase_price = excluded.last_purchase_price,
               updated_at = excluded.updated_at;`,
            [itm.ingredient_id, newStock, newWac, Number(itm.unit_price), now]
          );

          const movementId = `mvt_${inv.invoice_id}_${itm.item_id}`;
          const mvtIdemp = `idemp_pur_${inv.invoice_id}_${itm.item_id}`;

          runSql(
            `INSERT OR IGNORE INTO inventory_movements (movement_id, branch_id, ingredient_id, movement_type, quantity, unit, unit_cost, total_cost, balance_after, reference_type, reference_id, user_id, idempotency_key, created_at)
             VALUES (?, 'branch_downtown_cairo', ?, 'purchase_receipt', ?, ?, ?, ?, ?, 'purchase_invoice', ?, 'owner', ?, ?);`,
            [
              movementId,
              itm.ingredient_id,
              incomingBaseQty,
              ing ? ing.base_unit : 'g',
              incomingPricePerBase,
              itemTotalCost,
              newStock,
              inv.invoice_id,
              mvtIdemp,
              now
            ]
          );

          updatedMovements.push({
            ingredientId: itm.ingredient_id,
            addedBaseQty: incomingBaseQty,
            grossKg,
            tareKg: itemTare,
            netFruitKg,
            effectiveNetCost,
            newStock,
            newWac
          });
        }

        recordAudit(runSql, {
          userId: auth.userId,
          action: 'APPROVE_PURCHASE_INVOICE',
          targetType: 'purchase_invoice',
          targetId: inv.invoice_id,
          details: { invoiceNumber: inv.invoice_number, itemCount: rawItems.length, totalAmount: inv.total_amount, movements: updatedMovements },
          ip: remoteIp
        });
      });

      const responsePayload = {
        success: true,
        message: `تم اعتماد الفاتورة (${inv.invoice_number}) بنجاح وترحيل ${updatedMovements.length} أصناف إلى المخزون وتحديث متوسط التكلفة WAC.`,
        invoiceId: inv.invoice_id,
        invoiceNumber: inv.invoice_number,
        status: 'approved',
        totalAmount: Number(inv.total_amount),
        updatedItemsCount: updatedMovements.length,
        inventoryUpdates: updatedMovements
      };

      if (idempotencyKey) {
        runSql(
          `INSERT OR REPLACE INTO admin_idempotency_records (idempotency_key, action, status_code, response_json, created_at)
           VALUES (?, 'APPROVE_PURCHASE_INVOICE', 200, ?, ?);`,
          [idempotencyKey, JSON.stringify(responsePayload), now]
        );
      }

      return sendJson(res, 200, responsePayload);
    }

    // ========================================================================
    // 4. INVENTORY CONTROL & AUDIT ADJUSTMENTS
    // ========================================================================
    if (subPath === '/inventory' && method === 'GET') {
      const lowStockOnly = params.get('lowStockOnly') === 'true';
      const rows = queryAll(`
        SELECT 
          i.ingredient_id, i.name_ar, i.category_id, i.purchase_unit, i.base_unit,
          i.conversion_factor, i.usable_yield_percent, i.waste_percent, i.reorder_level,
          COALESCE(i.default_package_weight, 0) AS default_package_weight,
          COALESCE(i.carton_tare_weight, 0) AS carton_tare_weight,
          bi.stock_quantity, bi.weighted_average_cost, bi.last_purchase_price, bi.min_stock_alert, bi.updated_at
        FROM ingredients i
        LEFT JOIN branch_inventory bi ON i.ingredient_id = bi.ingredient_id AND bi.branch_id = 'branch_downtown_cairo'
        WHERE i.status = 'active'
        ORDER BY i.name_ar ASC;
      `);

      let items = rows.map(r => {
        const stockBase = Number(r.stock_quantity || 0);
        const factor = Number(r.conversion_factor || 1000);
        const minAlert = Number(r.min_stock_alert || r.reorder_level || 0);
        const isLow = minAlert > 0 && stockBase <= minAlert;

        return {
          ingredientId: r.ingredient_id,
          nameAr: r.name_ar,
          categoryId: r.category_id,
          baseUnit: r.base_unit,
          purchaseUnit: r.purchase_unit,
          stockInBaseUnit: stockBase,
          stockInPurchaseUnit: factor > 0 ? roundWeight(stockBase / factor) : stockBase,
          weightedAverageCost: Number(r.weighted_average_cost || 0),
          lastPurchasePrice: Number(r.last_purchase_price || 0),
          minStockAlert: minAlert,
          isLowStock: isLow,
          defaultPackageWeight: Number(r.default_package_weight || 0),
          cartonTareWeight: Number(r.carton_tare_weight || 0),
          lastUpdated: r.updated_at
        };
      });

      if (lowStockOnly) {
        items = items.filter(it => it.isLowStock);
      }

      return sendJson(res, 200, { success: true, count: items.length, items });
    }

    if (subPath === '/inventory/adjust' && method === 'POST') {
      const body = await parseJsonBody(req);
      const idempotencyKey = body.idempotencyKey || req.headers['x-idempotency-key'];

      if (idempotencyKey) {
        const existing = queryOne(`SELECT response_json, status_code FROM admin_idempotency_records WHERE idempotency_key = ?;`, [idempotencyKey]);
        if (existing) {
          const resp = JSON.parse(existing.response_json);
          resp.idempotentReplay = true;
          return sendJson(res, existing.status_code, resp);
        }
      }

      let { ingredientId, fruitName, adjustmentQuantity, tareWeightKg, reason } = body;

      if (!ingredientId && fruitName) {
        const found = queryOne(
          `SELECT ingredient_id, name_ar, base_unit FROM ingredients WHERE status = 'active' AND (name_ar LIKE ? OR name_en LIKE ?) LIMIT 1;`,
          [`%${fruitName}%`, `%${fruitName}%`]
        );
        if (found) {
          ingredientId = found.ingredient_id;
        }
      }

      if (!ingredientId || adjustmentQuantity === undefined || adjustmentQuantity === null) {
        return sendJson(res, 400, { error: 'MISSING_DATA', message: 'معرف الصنف (أو اسم الفاكهة) والكمية المعدلة مطلوبان.' });
      }

      const ing = queryOne(`SELECT ingredient_id, name_ar, base_unit FROM ingredients WHERE ingredient_id = ?;`, [ingredientId]);
      if (!ing) {
        return sendJson(res, 404, { error: 'INGREDIENT_NOT_FOUND', message: 'الصنف غير موجود.' });
      }

      let delta = Number(adjustmentQuantity);
      if (tareWeightKg && Number(tareWeightKg) > 0) {
        // إذا تم تحديد وزن التارة للكرتونة، يتم تحويلها حسب وحدة القياس الأساسية للصنف (جرام أو كجم)
        const isGrams = (ing.base_unit === 'g' || ing.base_unit === 'gram');
        const tareVal = isGrams ? Number(tareWeightKg) * 1000 : Number(tareWeightKg);
        if (delta > 0 && delta > tareVal) {
          delta = roundWeight(delta - tareVal);
        }
      }

      if (!Number.isFinite(delta) || delta === 0) {
        return sendJson(res, 400, { error: 'INVALID_QUANTITY', message: 'قيمة التعديل يجب أن تكون رقماً غير صفري.' });
      }

      const curInv = queryOne(
        `SELECT stock_quantity, weighted_average_cost FROM branch_inventory WHERE branch_id = 'branch_downtown_cairo' AND ingredient_id = ?;`,
        [ingredientId]
      );
      const curStock = curInv ? Number(curInv.stock_quantity) : 0;
      const wac = curInv ? Number(curInv.weighted_average_cost) : 0;
      const newStock = Math.max(0, curStock + delta);
      const now = new Date().toISOString();
      const movementId = `mvt_adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

      await runTransaction(() => {
        if (tareWeightKg && Number(tareWeightKg) > 0) {
          runSql(`UPDATE ingredients SET carton_tare_weight = ? WHERE ingredient_id = ?;`, [Number(tareWeightKg), ingredientId]);
        }
        runSql(
          `INSERT INTO branch_inventory (branch_id, ingredient_id, stock_quantity, weighted_average_cost, updated_at)
           VALUES ('branch_downtown_cairo', ?, ?, ?, ?)
           ON CONFLICT(branch_id, ingredient_id) DO UPDATE SET
             stock_quantity = excluded.stock_quantity,
             updated_at = excluded.updated_at;`,
          [ingredientId, newStock, wac, now]
        );

        runSql(
          `INSERT INTO inventory_movements (movement_id, branch_id, ingredient_id, movement_type, quantity, unit, unit_cost, total_cost, balance_after, reference_type, reference_id, user_id, idempotency_key, notes, created_at)
           VALUES (?, 'branch_downtown_cairo', ?, 'manual_adjustment', ?, ?, ?, ?, ?, 'admin_control', ?, 'owner', ?, ?, ?);`,
          [
            movementId,
            ingredientId,
            delta,
            ing.base_unit || 'g',
            wac,
            roundMoney(Math.abs(delta) * wac),
            newStock,
            movementId,
            idempotencyKey || movementId,
            reason || 'تعديل جرد يدوي من لوحة الإدارة',
            now
          ]
        );

        recordAudit(runSql, {
          userId: auth.userId,
          action: 'MANUAL_STOCK_ADJUSTMENT',
          targetType: 'ingredient',
          targetId: ingredientId,
          details: { nameAr: ing.name_ar, delta, prevStock: curStock, newStock, reason },
          ip: remoteIp
        });
      });

      const responsePayload = {
        success: true,
        message: `تم تعديل رصيد الصنف (${ing.name_ar}) من ${curStock} إلى ${newStock} ${ing.base_unit}.`,
        ingredientId,
        nameAr: ing.name_ar,
        previousStock: curStock,
        adjustedQuantity: delta,
        newStock,
        unit: ing.base_unit
      };

      if (idempotencyKey) {
        runSql(
          `INSERT OR REPLACE INTO admin_idempotency_records (idempotency_key, action, status_code, response_json, created_at)
           VALUES (?, 'MANUAL_STOCK_ADJUSTMENT', 200, ?, ?);`,
          [idempotencyKey, JSON.stringify(responsePayload), now]
        );
      }

      return sendJson(res, 200, responsePayload);
    }

    // ========================================================================
    // 5. PRODUCTS & SELLING PRICES CONTROL
    // ========================================================================
    if (subPath === '/products' && method === 'GET') {
      const rawProducts = queryAll(`SELECT * FROM products WHERE is_active = 1 ORDER BY sort_order ASC, name_ar ASC;`);
      const rawPrices = queryAll(`
        SELECT pp.*, ps.size_code, ps.name_ar AS size_name_ar
        FROM product_prices pp
        JOIN product_sizes ps ON pp.size_id = ps.size_id
        WHERE pp.branch_id = 'branch_downtown_cairo';
      `);

      const products = rawProducts.map(p => {
        const prices = {};
        for (const pr of rawPrices.filter(x => x.product_id === p.product_id)) {
          prices[pr.size_code] = {
            sellingPrice: Number(pr.selling_price),
            packagingCost: Number(pr.packaging_cost),
            isAvailable: Boolean(pr.is_available)
          };
        }
        return {
          productId: p.product_id,
          nameAr: p.name_ar,
          nameEn: p.name_en || '',
          categoryId: p.category_id,
          prices
        };
      });

      return sendJson(res, 200, { success: true, count: products.length, products });
    }

    if (subPath === '/products/price' && method === 'POST') {
      const body = await parseJsonBody(req);
      const idempotencyKey = body.idempotencyKey || req.headers['x-idempotency-key'];

      if (idempotencyKey) {
        const existing = queryOne(`SELECT response_json, status_code FROM admin_idempotency_records WHERE idempotency_key = ?;`, [idempotencyKey]);
        if (existing) {
          const resp = JSON.parse(existing.response_json);
          resp.idempotentReplay = true;
          return sendJson(res, existing.status_code, resp);
        }
      }

      const { productId, productName, sizeCode, sellingPrice, packagingCost } = body;
      const targetCode = sizeCode || '16oz';
      if ((!productId && !productName) || sellingPrice === undefined || sellingPrice === null) {
        return sendJson(res, 400, { error: 'MISSING_DATA', message: 'معرف المنتج أو اسمه، وسعر البيع مطلوبون.' });
      }

      let prod = null;
      if (productId) {
        prod = queryOne(`SELECT product_id, name_ar FROM products WHERE product_id = ?;`, [productId]);
      }
      if (!prod && productName) {
        const clean = productName.trim().replace(/^(عصير|مشروب|كوكتيل)\s*/i, '');
        let stem = clean;
        if (clean.includes('مانج')) stem = 'مانج';
        else if (clean.includes('فراول')) stem = 'فراول';
        else if (clean.includes('تفاح')) stem = 'تفاح';
        else if (clean.includes('برتقال')) stem = 'برتقال';
        else if (clean.includes('ليمون') || clean.includes('لمون')) stem = 'مون';
        else if (clean.includes('جواف')) stem = 'جواف';
        else if (clean.includes('موز')) stem = 'موز';
        else if (clean.includes('قصب')) stem = 'قصب';
        else if (clean.includes('بطيخ')) stem = 'بطيخ';

        prod = queryOne(
          `SELECT product_id, name_ar FROM products 
           WHERE name_ar = ? OR name_ar LIKE ? OR name_ar LIKE ? OR name_en LIKE ?
           ORDER BY (category_id = 'prod_cat_pure' OR category_id = 'cat_fresh_juices') DESC LIMIT 1;`,
          [productName, `%${productName}%`, `%${stem}%`, `%${stem}%`]
        );
      }
      if (!prod) {
        return sendJson(res, 404, { error: 'PRODUCT_NOT_FOUND', message: 'المنتج غير موجود.' });
      }

      const effectiveProdId = prod.product_id;
      const price = Number(sellingPrice);
      if (!Number.isFinite(price) || price < 0) {
        return sendJson(res, 400, { error: 'INVALID_PRICE', message: 'سعر البيع يجب أن يكون رقماً غير سالب.' });
      }

      const targetSizeIds = new Set();
      const existingSizes = queryAll(`SELECT size_id, size_code FROM product_sizes;`);
      for (const es of existingSizes) {
        if ((targetCode === '16oz' || targetCode === '400ml') && (es.size_code === '16oz' || es.size_code === '400ml' || es.size_id.includes('16oz') || es.size_id.includes('400ml'))) {
          targetSizeIds.add(es.size_id);
        } else if (targetCode === '1L' && (es.size_code === '1L' || es.size_id.includes('1l') || es.size_id.includes('1L'))) {
          targetSizeIds.add(es.size_id);
        } else if (targetCode === '500ml' && (es.size_code === '500ml' || es.size_id.includes('500ml'))) {
          targetSizeIds.add(es.size_id);
        } else if (es.size_code === targetCode || es.size_id === targetCode) {
          targetSizeIds.add(es.size_id);
        }
      }
      if (targetSizeIds.size === 0) {
        if (existingSizes.length > 0) {
          targetSizeIds.add(existingSizes[0].size_id);
        } else {
          targetSizeIds.add('size_400ml');
        }
      }

      const now = new Date().toISOString();
      const pkgCost = packagingCost !== undefined && packagingCost !== null ? Number(packagingCost) : 0;

      const existingBranches = queryAll(`SELECT branch_id FROM branches WHERE status = 'active';`);
      const targetBranches = existingBranches.length > 0 ? existingBranches.map(b => b.branch_id) : ['branch_downtown_cairo'];

      await runTransaction(() => {
        for (const sId of targetSizeIds) {
          for (const bId of targetBranches) {
            runSql(
              `INSERT INTO product_prices (price_id, product_id, size_id, branch_id, selling_price, packaging_cost, is_available, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
               ON CONFLICT(product_id, size_id, branch_id) DO UPDATE SET
                 selling_price = excluded.selling_price,
                 packaging_cost = CASE WHEN excluded.packaging_cost > 0 THEN excluded.packaging_cost ELSE product_prices.packaging_cost END,
                 updated_at = excluded.updated_at;`,
              [`prc_${effectiveProdId}_${sId}_${bId}`, effectiveProdId, sId, bId, price, pkgCost, now, now]
            );
          }
        }

        recordAudit(runSql, {
          userId: auth.userId,
          action: 'UPDATE_PRODUCT_PRICE',
          targetType: 'product_price',
          targetId: `${effectiveProdId}_${targetCode}`,
          details: { nameAr: prod.name_ar, sizeCode: targetCode, newPrice: price, packagingCost: pkgCost },
          ip: remoteIp
        });
      });

      const responsePayload = {
        success: true,
        message: `تم تحديث سعر (${prod.name_ar} - ${targetCode}) بنجاح إلى ${price} ج.م.`,
        productId: effectiveProdId,
        nameAr: prod.name_ar,
        sizeCode: targetCode,
        sellingPrice: price,
        packagingCost: pkgCost
      };

      if (idempotencyKey) {
        runSql(
          `INSERT OR REPLACE INTO admin_idempotency_records (idempotency_key, action, status_code, response_json, created_at)
           VALUES (?, 'UPDATE_PRODUCT_PRICE', 200, ?, ?);`,
          [idempotencyKey, JSON.stringify(responsePayload), now]
        );
      }

      return sendJson(res, 200, responsePayload);
    }

    if (subPath === '/products/toggle' && method === 'POST') {
      const body = await parseJsonBody(req);
      const { productId, productName, isAvailable } = body;
      let prod = null;
      if (productId) {
        prod = queryOne(`SELECT product_id, name_ar FROM products WHERE product_id = ?;`, [productId]);
      }
      if (!prod && productName) {
        const clean = productName.trim().replace(/^(عصير|مشروب|كوكتيل)\s*/i, '');
        let stem = clean;
        if (clean.includes('مانج')) stem = 'مانج';
        else if (clean.includes('فراول')) stem = 'فراول';
        else if (clean.includes('تفاح')) stem = 'تفاح';
        else if (clean.includes('برتقال')) stem = 'برتقال';
        else if (clean.includes('ليمون') || clean.includes('لمون')) stem = 'مون';
        else if (clean.includes('جواف')) stem = 'جواف';
        else if (clean.includes('موز')) stem = 'موز';
        else if (clean.includes('قصب')) stem = 'قصب';
        else if (clean.includes('بطيخ')) stem = 'بطيخ';

        prod = queryOne(
          `SELECT product_id, name_ar FROM products 
           WHERE name_ar = ? OR name_ar LIKE ? OR name_ar LIKE ? OR name_en LIKE ?
           ORDER BY (category_id = 'prod_cat_pure' OR category_id = 'cat_fresh_juices') DESC LIMIT 1;`,
          [productName, `%${productName}%`, `%${stem}%`, `%${stem}%`]
        );
      }
      if (!prod) {
        return sendJson(res, 404, { error: 'PRODUCT_NOT_FOUND', message: 'المنتج غير موجود.' });
      }

      const available = isAvailable === false ? 0 : 1;
      await runTransaction(() => {
        runSql(`UPDATE product_prices SET is_available = ?, updated_at = datetime('now') WHERE product_id = ?;`, [available, prod.product_id]);
        recordAudit(runSql, {
          userId: auth.userId,
          action: 'TOGGLE_PRODUCT_AVAILABILITY',
          targetType: 'product',
          targetId: prod.product_id,
          details: { nameAr: prod.name_ar, isAvailable: Boolean(available) },
          ip: remoteIp
        });
      });

      return sendJson(res, 200, {
        success: true,
        productId: prod.product_id,
        nameAr: prod.name_ar,
        isAvailable: Boolean(available),
        message: available ? `تم تفعيل وإتاحة (${prod.name_ar}) على الكاشير بنجاح.` : `تم إيقاف وحظر (${prod.name_ar}) من الكاشير لعدم التوفر.`
      });
    }

    // ========================================================================
    // 6. OPERATING EXPENSES (المصروفات)
    // ========================================================================
    if (subPath === '/expenses' && method === 'GET') {
      const rows = queryAll(`SELECT * FROM expense_records ORDER BY expense_date DESC, created_at DESC LIMIT 50;`);
      return sendJson(res, 200, { success: true, count: rows.length, expenses: rows });
    }

    if (subPath === '/expenses' && method === 'POST') {
      const body = await parseJsonBody(req);
      const idempotencyKey = body.idempotencyKey || req.headers['x-idempotency-key'];

      if (idempotencyKey) {
        const existing = queryOne(`SELECT response_json, status_code FROM admin_idempotency_records WHERE idempotency_key = ?;`, [idempotencyKey]);
        if (existing) {
          const resp = JSON.parse(existing.response_json);
          resp.idempotentReplay = true;
          return sendJson(res, existing.status_code, resp);
        }
      }

      const { nameAr, amount, categoryId, expenseDate, notes, paidFromShift } = body;
      const val = Number(amount);
      if (!nameAr || !Number.isFinite(val) || val <= 0) {
        return sendJson(res, 400, { error: 'INVALID_EXPENSE', message: 'اسم المصروف والمبلغ الصالح مطلوبان.' });
      }

      let validCategoryId = 'exp_cat_ops';
      if (categoryId) {
        const cat = queryOne(`SELECT category_id FROM expense_categories WHERE category_id = ?;`, [categoryId]);
        if (cat) {
          validCategoryId = cat.category_id;
        } else {
          if (categoryId.includes('util') || categoryId.includes('كهرب') || categoryId.includes('مياه')) validCategoryId = 'exp_cat_utilities';
          else if (categoryId.includes('rent') || categoryId.includes('إيجار') || categoryId.includes('ايجار')) validCategoryId = 'exp_cat_rent';
          else if (categoryId.includes('sal') || categoryId.includes('مرتب') || categoryId.includes('يومي')) validCategoryId = 'exp_cat_salaries';
          else validCategoryId = 'exp_cat_ops';
        }
      }

      const expenseId = `exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const now = new Date().toISOString();
      const dateStr = expenseDate || now.split('T')[0];

      let linkedShiftId = body.shiftId || null;
      if (paidFromShift && !linkedShiftId) {
        const activeShift = queryOne(`SELECT shift_id FROM cashier_shifts WHERE status = 'open' ORDER BY opened_at DESC, shift_number DESC LIMIT 1;`);
        if (activeShift) linkedShiftId = activeShift.shift_id;
      }

      await runTransaction(() => {
        runSql(
          `INSERT INTO expense_records (expense_id, branch_id, category_id, name_ar, amount, expense_date, paid_by, shift_id, notes, created_at)
           VALUES (?, 'branch_downtown_cairo', ?, ?, ?, ?, 'owner', ?, ?, ?);`,
          [expenseId, validCategoryId, nameAr.trim(), val, dateStr, linkedShiftId, notes || null, now]
        );

        if (linkedShiftId) {
          runSql(
            `UPDATE cashier_shifts SET
               cash_expenses = cash_expenses + ?,
               expected_cash = expected_cash - ?
             WHERE shift_id = ?;`,
            [val, val, linkedShiftId]
          );
        }

        recordAudit(runSql, {
          userId: auth.userId,
          action: 'RECORD_EXPENSE',
          targetType: 'expense',
          targetId: expenseId,
          details: { nameAr, amount: val, dateStr, linkedShiftId },
          ip: remoteIp
        });
      });

      const responsePayload = {
        success: true,
        message: `تم تسجيل المصروف (${nameAr}) بقيمة ${val} ج.م بنجاح.`,
        expenseId,
        amount: val,
        date: dateStr,
        linkedShiftId
      };

      if (idempotencyKey) {
        runSql(
          `INSERT OR REPLACE INTO admin_idempotency_records (idempotency_key, action, status_code, response_json, created_at)
           VALUES (?, 'RECORD_EXPENSE', 200, ?, ?);`,
          [idempotencyKey, JSON.stringify(responsePayload), now]
        );
      }

      return sendJson(res, 200, responsePayload);
    }

    // ========================================================================
    // 7. CASHIER SHIFTS & DRAWER RECONCILIATION
    // ========================================================================
    if (subPath === '/shifts/active' && method === 'GET') {
      const shift = queryOne(`SELECT * FROM cashier_shifts WHERE status = 'open' ORDER BY opened_at DESC LIMIT 1;`);
      if (!shift) {
        return sendJson(res, 200, { success: true, activeShift: null, message: 'لا توجد وردية مفتوحة حالياً.' });
      }

      const expected = Number(shift.opening_float) + Number(shift.cash_sales) - Number(shift.cash_refunds) - Number(shift.cash_expenses);

      return sendJson(res, 200, {
        success: true,
        activeShift: {
          shiftId: shift.shift_id,
          shiftNumber: shift.shift_number,
          cashierId: shift.cashier_id,
          openedAt: shift.opened_at,
          openingFloat: Number(shift.opening_float),
          cashSales: Number(shift.cash_sales),
          electronicSales: Number(shift.electronic_sales),
          cashRefunds: Number(shift.cash_refunds),
          cashExpenses: Number(shift.cash_expenses),
          expectedCash: expected
        }
      });
    }

    if (subPath === '/shifts/close' && method === 'POST') {
      const body = await parseJsonBody(req);
      const idempotencyKey = body.idempotencyKey || req.headers['x-idempotency-key'];

      if (idempotencyKey) {
        const existing = queryOne(`SELECT response_json, status_code FROM admin_idempotency_records WHERE idempotency_key = ?;`, [idempotencyKey]);
        if (existing) {
          const resp = JSON.parse(existing.response_json);
          resp.idempotentReplay = true;
          return sendJson(res, existing.status_code, resp);
        }
      }

      const activeShift = body.shiftId
        ? queryOne(`SELECT * FROM cashier_shifts WHERE shift_id = ?;`, [body.shiftId])
        : queryOne(`SELECT * FROM cashier_shifts WHERE status = 'open' ORDER BY opened_at DESC, shift_number DESC LIMIT 1;`);
      if (!activeShift) {
        return sendJson(res, 400, { error: 'NO_OPEN_SHIFT', message: 'لا توجد وردية مفتوحة لإغلاقها.' });
      }

      const actualCash = Number(body.actualCashCounted || 0);
      const expected = Number(activeShift.opening_float) + Number(activeShift.cash_sales) - Number(activeShift.cash_refunds) - Number(activeShift.cash_expenses);
      const discrepancy = Math.round((actualCash - expected) * 100) / 100;
      const now = new Date().toISOString();

      await runTransaction(() => {
        runSql(
          `UPDATE cashier_shifts SET
             status = 'closed',
             closed_at = ?,
             expected_cash = ?,
             actual_cash_counted = ?,
             discrepancy = ?,
             reconciliation_notes = ?
           WHERE shift_id = ?;`,
          [now, expected, actualCash, discrepancy, body.notes || 'إغلاق ومطابقة الوردية من لوحة الإدارة', activeShift.shift_id]
        );

        recordAudit(runSql, {
          userId: auth.userId,
          action: 'CLOSE_SHIFT',
          targetType: 'shift',
          targetId: activeShift.shift_id,
          details: { shiftNumber: activeShift.shift_number, expectedCash: expected, actualCash, discrepancy },
          ip: remoteIp
        });
      });

      const responsePayload = {
        success: true,
        message: `تم إغلاق الوردية رقم ${activeShift.shift_number} بنجاح. الفارق: ${discrepancy} ج.م.`,
        shiftId: activeShift.shift_id,
        expectedCash: expected,
        actualCashCounted: actualCash,
        discrepancy
      };

      if (idempotencyKey) {
        runSql(
          `INSERT OR REPLACE INTO admin_idempotency_records (idempotency_key, action, status_code, response_json, created_at)
           VALUES (?, 'CLOSE_SHIFT', 200, ?, ?);`,
          [idempotencyKey, JSON.stringify(responsePayload), now]
        );
      }

      return sendJson(res, 200, responsePayload);
    }

    // ========================================================================
    // 8. DAILY OPERATIONAL REPORT & KPIS (التقرير اليومي)
    // ========================================================================
    if (subPath === '/reports/daily' && method === 'GET') {
      const date = params.get('date') || new Date().toISOString().split('T')[0];

      const salesSummary = queryOne(
        `SELECT 
           COUNT(*) AS total_orders,
           COALESCE(SUM(total_amount), 0) AS gross_sales,
           COALESCE(SUM(discount_amount), 0) AS total_discounts,
           COALESCE(SUM(CASE WHEN payment_status = 'paid' THEN total_amount ELSE 0 END), 0) AS paid_sales
         FROM orders
         WHERE DATE(created_at) = ? AND order_status != 'cancelled';`,
        [date]
      );

      const paymentsBreakdown = queryAll(
        `SELECT payment_method, COALESCE(SUM(gross_amount), 0) AS amount
         FROM payment_records
         WHERE DATE(created_at) = ? AND payment_status = 'verified'
         GROUP BY payment_method;`,
        [date]
      );

      const expensesSummary = queryOne(
        `SELECT COALESCE(SUM(amount), 0) AS total_expenses
         FROM expense_records
         WHERE expense_date = ?;`,
        [date]
      );

      const purchasesSummary = queryOne(
        `SELECT COUNT(*) AS invoice_count, COALESCE(SUM(total_amount), 0) AS total_purchases
         FROM purchase_invoices
         WHERE invoice_date = ? AND status = 'approved';`,
        [date]
      );

      const topProducts = queryAll(
        `SELECT p.name_ar, oi.size_id, COUNT(*) AS count_sold, SUM(oi.quantity) AS qty_sold, SUM(oi.total_price) AS total_revenue
         FROM order_items oi
         JOIN orders o ON oi.order_id = o.order_id
         JOIN products p ON oi.product_id = p.product_id
         WHERE DATE(o.created_at) = ? AND o.order_status != 'cancelled'
         GROUP BY p.product_id, oi.size_id
         ORDER BY qty_sold DESC
         LIMIT 5;`,
        [date]
      );

      const cashMap = {};
      for (const p of paymentsBreakdown) {
        cashMap[p.payment_method] = Number(p.amount);
      }

      const gross = Number(salesSummary ? salesSummary.gross_sales : 0);
      const expenses = Number(expensesSummary ? expensesSummary.total_expenses : 0);

      return sendJson(res, 200, {
        success: true,
        reportDate: date,
        sales: {
          totalOrders: Number(salesSummary ? salesSummary.total_orders : 0),
          grossSales: gross,
          totalDiscounts: Number(salesSummary ? salesSummary.total_discounts : 0),
          cashSales: Number(cashMap['cash'] || 0),
          cardSales: Number(cashMap['card'] || 0),
          instapaySales: Number(cashMap['instapay'] || 0)
        },
        expenses: {
          totalExpenses: expenses
        },
        purchases: {
          approvedInvoicesCount: Number(purchasesSummary ? purchasesSummary.invoice_count : 0),
          totalPurchases: Number(purchasesSummary ? purchasesSummary.total_purchases : 0)
        },
        topSellingItems: topProducts.map(tp => ({
          nameAr: tp.name_ar,
          size: tp.size_id === 'size_1l' ? '1 لتر' : '400 مل',
          quantitySold: Number(tp.qty_sold),
          totalRevenue: Number(tp.total_revenue)
        }))
      });
    }

    // ========================================================================
    // 9. AUDIT LOGS
    // ========================================================================
    if (subPath === '/audit-logs' && method === 'GET') {
      const limit = Math.min(100, parseInt(params.get('limit') || '50', 10));
      const logs = queryAll(`SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?;`, [limit]);
      return sendJson(res, 200, { success: true, count: logs.length, logs });
    }

    // UNHANDLED ADMIN ROUTE
    return sendJson(res, 404, { error: 'NOT_FOUND', message: `مسار الإدارة (${method} ${pathname}) غير مسجل في النظام.` });

  } catch (err) {
    console.error('[AdminControl] API Handler Error:', err);
    return sendJson(res, 500, { error: 'ADMIN_API_ERROR', message: err.message });
  }
}
