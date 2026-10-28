/**
 * ==============================================================================
 * FRUIT CITY — TELEGRAM ADMIN REPORTING & METRICS ENGINE (READ-ONLY)
 * ==============================================================================
 * يستخرج البيانات الحقيقية فقط من قاعدة بيانات الإنتاج وخادم 5173 المحلي
 * مع التنسيق بالجنيه المصري (ج.م) وتوقيت القاهرة المحلي (Africa/Cairo)،
 * ودون أي عمليات كتابة أو تعديل مطلقاً.
 * ==============================================================================
 */

import fs from 'fs';
import path from 'path';
import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '..', '..', 'database', 'fruit_city_production.db');

let SQL_LIB = null;

export async function getReadOnlyDb() {
  if (!SQL_LIB) {
    SQL_LIB = await initSqlJs();
  }
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(`قاعدة البيانات غير موجودة في المسار: ${DB_PATH}`);
  }
  const buffer = fs.readFileSync(DB_PATH);
  return new SQL_LIB.Database(buffer);
}

export function saveDbToDisk(db) {
  if (db && typeof db.export === 'function') {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

export function formatEgp(amount) {
  const num = Number(amount || 0);
  return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ج.م';
}

export function getCairoNow() {
  const now = new Date();
  return {
    dateStr: new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now),
    timeStr: now.toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }),
    fullStr: now.toLocaleString('ar-EG', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: true })
  };
}

export function getDateRange(period = 'today') {
  const now = new Date();
  const cairoTodayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  
  if (period === 'yesterday') {
    const yDate = new Date(now.getTime() - 24 * 3600 * 1000);
    const yStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(yDate);
    return { startDate: yStr, endDate: yStr, label: `أمس (${yStr})` };
  }
  
  if (period === '7days') {
    const past7 = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
    const pastStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(past7);
    return { startDate: pastStr, endDate: cairoTodayStr, label: `آخر 7 أيام (${pastStr} إلى ${cairoTodayStr})` };
  }
  
  if (period === 'month') {
    const monthPrefix = cairoTodayStr.substring(0, 7); // YYYY-MM
    return { startDate: `${monthPrefix}-01`, endDate: `${monthPrefix}-31`, label: `شهر ${monthPrefix}` };
  }
  
  return { startDate: cairoTodayStr, endDate: cairoTodayStr, label: `اليوم (${cairoTodayStr})` };
}

// ---------------------------------------------------------------------------
// 1. تقرير المبيعات (Sales Report)
// ---------------------------------------------------------------------------
export async function getSalesReport(period = 'today') {
  const db = await getReadOnlyDb();
  const range = getDateRange(period);

  try {
    // المبيعات المدفوعة فقط
    const stmt = db.prepare(`
      SELECT 
        count(*) as order_count,
        coalesce(sum(total_amount), 0) as total_sales,
        coalesce(sum(discount_amount), 0) as total_discounts,
        coalesce(sum(delivery_fee), 0) as total_delivery
      FROM orders
      WHERE payment_status = 'paid'
        AND substr(created_at, 1, 10) >= ?
        AND substr(created_at, 1, 10) <= ?;
    `);
    stmt.bind([range.startDate, range.endDate]);
    stmt.step();
    const row = stmt.getAsObject();
    stmt.free();

    // عدد الطلبات غير المدفوعة أو المعلقة
    const pendStmt = db.prepare(`
      SELECT count(*) as pending_count, coalesce(sum(total_amount), 0) as pending_amount
      FROM orders
      WHERE payment_status != 'paid'
        AND substr(created_at, 1, 10) >= ?
        AND substr(created_at, 1, 10) <= ?;
    `);
    pendStmt.bind([range.startDate, range.endDate]);
    pendStmt.step();
    const pendRow = pendStmt.getAsObject();
    pendStmt.free();

    const orderCount = Number(row.order_count || 0);
    const totalSales = Number(row.total_sales || 0);
    const avgOrder = orderCount > 0 ? (totalSales / orderCount) : 0;
    const cairoTime = getCairoNow();

    return {
      period: range.label,
      cairoTime: cairoTime.fullStr,
      orderCount,
      totalSales,
      avgOrder,
      totalDiscounts: Number(row.total_discounts || 0),
      pendingCount: Number(pendRow.pending_count || 0),
      pendingAmount: Number(pendRow.pending_amount || 0),
      formattedText: (
        `📊 *تقرير المبيعات — ${range.label}*\n\n` +
        `💰 *إجمالي المبيعات المدفوعة:* ${formatEgp(totalSales)}\n` +
        `🧾 *عدد الطلبات المكتملة:* ${orderCount} طلب\n` +
        `🎯 *متوسط قيمة الطلب:* ${formatEgp(avgOrder)}\n` +
        (Number(row.total_discounts || 0) > 0 ? `🏷️ *إجمالي الخصومات:* ${formatEgp(row.total_discounts)}\n` : '') +
        (Number(pendRow.pending_count || 0) > 0 ? `⚠️ *طلبات معلقة/غير مدفوعة:* ${pendRow.pending_count} (${formatEgp(pendRow.pending_amount)})\n` : '') +
        `\n🕒 *وقت الفحص:* ${cairoTime.timeStr} (توقيت القاهرة)\n` +
        (orderCount === 0 ? `\n💡 _ملاحظة: لا توجد طلبات مدفوعة مسجلة خلال هذه الفترة._` : '')
      )
    };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// 2. تقرير طرق الدفع (Payment Methods Breakdown)
// ---------------------------------------------------------------------------
export async function getPaymentsReport(period = 'today') {
  const db = await getReadOnlyDb();
  const range = getDateRange(period);

  try {
    const stmt = db.prepare(`
      SELECT 
        payment_method,
        count(*) as count,
        coalesce(sum(gross_amount), 0) as gross,
        coalesce(sum(fee_amount), 0) as fees,
        coalesce(sum(net_amount), 0) as net
      FROM payment_records
      WHERE payment_status = 'verified'
        AND substr(created_at, 1, 10) >= ?
        AND substr(created_at, 1, 10) <= ?
      GROUP BY payment_method;
    `);
    stmt.bind([range.startDate, range.endDate]);
    
    const methods = { cash: 0, card: 0, instapay: 0 };
    let totalGross = 0;
    let totalFees = 0;
    let totalNet = 0;
    let countTotal = 0;

    while (stmt.step()) {
      const r = stmt.getAsObject();
      const m = r.payment_method;
      methods[m] = {
        count: Number(r.count),
        gross: Number(r.gross),
        fees: Number(r.fees),
        net: Number(r.net)
      };
      totalGross += Number(r.gross);
      totalFees += Number(r.fees);
      totalNet += Number(r.net);
      countTotal += Number(r.count);
    }
    stmt.free();

    // قواعد العمولات الثابتة للتوضيح
    const rulesStmt = db.prepare(`SELECT payment_method, provider_name, fee_percent FROM payment_fee_rules WHERE is_active = 1;`);
    const feeRules = [];
    while (rulesStmt.step()) {
      feeRules.push(rulesStmt.getAsObject());
    }
    rulesStmt.free();

    const cairoTime = getCairoNow();

    const cashInfo = methods.cash || { gross: 0, count: 0 };
    const cardInfo = methods.card || { gross: 0, fees: 0, net: 0, count: 0 };
    const instaInfo = methods.instapay || { gross: 0, count: 0 };

    return {
      period: range.label,
      totalGross,
      totalFees,
      totalNet,
      methods,
      formattedText: (
        `💳 *تقرير طرق الدفع — ${range.label}*\n\n` +
        `💵 *النقدية (الكاش):* ${formatEgp(cashInfo.gross)} (${cashInfo.count || 0} معاملة)\n` +
        `💳 *البطاقات (POS):* ${formatEgp(cardInfo.gross)} (${cardInfo.count || 0} معاملة)\n` +
        `   • عمولات البنك: -${formatEgp(cardInfo.fees || 0)}\n` +
        `⚡ *إنستاباي (InstaPay):* ${formatEgp(instaInfo.gross)} (${instaInfo.count || 0} معاملة)\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `💰 *إجمالي المحصل:* ${formatEgp(totalGross)}\n` +
        `📉 *إجمالي العمولات:* -${formatEgp(totalFees)}\n` +
        `✅ *الصافي الفعلي:* ${formatEgp(totalNet)}\n\n` +
        `🕒 *توقيت التقرير:* ${cairoTime.timeStr}` +
        (countTotal === 0 ? `\n\n💡 _ملاحظة: لا توجد معاملات دفع مسجلة خلال هذه الفترة._` : '')
      )
    };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// 3. تقرير المخزون والخامات (Inventory & Stock Report)
// ---------------------------------------------------------------------------
export async function getInventoryReport() {
  const db = await getReadOnlyDb();
  try {
    const stmt = db.prepare(`
      SELECT 
        i.ingredient_id,
        i.name_ar,
        i.purchase_unit,
        i.base_unit,
        bi.stock_quantity,
        bi.weighted_average_cost,
        bi.min_stock_alert,
        (bi.stock_quantity * bi.weighted_average_cost) as total_val
      FROM ingredients i
      LEFT JOIN branch_inventory bi ON i.ingredient_id = bi.ingredient_id AND bi.branch_id = 'branch_downtown_cairo'
      ORDER BY i.name_ar ASC;
    `);

    const items = [];
    const lowStock = [];
    let totalStockValue = 0;

    while (stmt.step()) {
      const row = stmt.getAsObject();
      const stock = Number(row.stock_quantity || 0);
      const minAlert = Number(row.min_stock_alert || 0);
      const val = Number(row.total_val || 0);
      totalStockValue += val;

      items.push(row);
      if (minAlert > 0 && stock <= minAlert) {
        lowStock.push(row);
      }
    }
    stmt.free();

    const cairoTime = getCairoNow();

    let itemsListText = '';
    if (items.length > 0) {
      itemsListText = items.slice(0, 10).map(it => {
        const qty = Number(it.stock_quantity || 0);
        return `• *${it.name_ar}:* ${qty} ${it.base_unit || it.purchase_unit} (${formatEgp(it.weighted_average_cost)}/${it.base_unit})`;
      }).join('\n');
      if (items.length > 10) itemsListText += `\n_... و ${items.length - 10} أصناف أخرى_`;
    } else {
      itemsListText = `_لا توجد خامات مسجلة بالمخزن حالياً._`;
    }

    let alertText = '';
    if (lowStock.length > 0) {
      alertText = `\n⚠️ *نواقص المخزون (${lowStock.length} صنف):*\n` +
        lowStock.map(l => `• ${l.name_ar}: متبقي ${l.stock_quantity} (الحد الأدنى: ${l.min_stock_alert})`).join('\n') + '\n';
    } else {
      alertText = `\n✅ *حالة النواقص:* لا توجد أصناف تحت الحد الأدنى.\n`;
    }

    return {
      totalItems: items.length,
      lowStockCount: lowStock.length,
      totalStockValue,
      formattedText: (
        `📦 *تقرير المخزون والخامات — فرع وسط البلد*\n\n` +
        `🔢 *عدد الأصناف المسجلة:* ${items.length} صنف\n` +
        `💵 *القيمة التقديرية للمخزون (WAC):* ${formatEgp(totalStockValue)}\n` +
        alertText +
        `\n📋 *بيان الخامات الرئيسية:*\n` +
        itemsListText +
        `\n\n🕒 *وقت الفحص:* ${cairoTime.timeStr}`
      )
    };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// 4. تقرير المشتريات وفواتير التوريد (Purchases Report)
// ---------------------------------------------------------------------------
export async function getPurchasesReport() {
  const db = await getReadOnlyDb();
  try {
    const stmt = db.prepare(`
      SELECT 
        status,
        count(*) as count,
        coalesce(sum(total_amount), 0) as total_amount,
        coalesce(sum(total_weight_kg), 0) as total_weight
      FROM purchase_invoices
      GROUP BY status;
    `);

    let approvedCount = 0;
    let approvedAmount = 0;
    let approvedWeight = 0;
    let draftCount = 0;
    let draftAmount = 0;
    let draftWeight = 0;

    while (stmt.step()) {
      const r = stmt.getAsObject();
      if (r.status === 'approved') {
        approvedCount = Number(r.count);
        approvedAmount = Number(r.total_amount);
        approvedWeight = Number(r.total_weight);
      } else {
        draftCount += Number(r.count);
        draftAmount += Number(r.total_amount);
        draftWeight += Number(r.total_weight);
      }
    }
    stmt.free();

    // آخر 3 فواتير
    const lastStmt = db.prepare(`
      SELECT invoice_number, supplier_name, invoice_date, status, total_amount, total_weight_kg
      FROM purchase_invoices
      ORDER BY invoice_date DESC, created_at DESC
      LIMIT 3;
    `);
    const recentInvoices = [];
    while (lastStmt.step()) {
      recentInvoices.push(lastStmt.getAsObject());
    }
    lastStmt.free();

    const cairoTime = getCairoNow();
    let recentText = '';
    if (recentInvoices.length > 0) {
      recentText = `\n📄 *آخر الفواتير:*\n` + recentInvoices.map(inv => {
        const stIcon = inv.status === 'approved' ? '✅ معتمدة' : '⏳ مسودة';
        return `• *${inv.invoice_number}* (${inv.supplier_name || 'سوق العبور'}) | ${formatEgp(inv.total_amount)} [${stIcon}]`;
      }).join('\n');
    }

    return {
      approvedCount,
      approvedAmount,
      approvedWeight,
      draftCount,
      draftAmount,
      draftWeight,
      formattedText: (
        `🛒 *تقرير المشتريات وتوريدات السوق*\n\n` +
        `✅ *الفواتير المعتمدة:* ${approvedCount} فاتورة (${formatEgp(approvedAmount)})\n` +
        `   • إجمالي الوزن المستلم: ${approvedWeight.toFixed(2)} كجم\n` +
        `⏳ *المسودات في الانتظار:* ${draftCount} فاتورة (${formatEgp(draftAmount)})\n` +
        `   • إجمالي وزن المسودات: ${draftWeight.toFixed(2)} كجم\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `💰 *إجمالي قيمة التوريدات:* ${formatEgp(approvedAmount + draftAmount)}\n` +
        recentText +
        `\n\n🕒 *توقيت الفحص:* ${cairoTime.timeStr}`
      )
    };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// 5. تقرير المصروفات (Expenses Report)
// ---------------------------------------------------------------------------
export async function getExpensesReport() {
  const db = await getReadOnlyDb();
  try {
    const stmt = db.prepare(`
      SELECT 
        ec.name_ar as category_name_ar,
        count(er.expense_id) as count,
        coalesce(sum(er.amount), 0) as total
      FROM expense_categories ec
      LEFT JOIN expense_records er ON ec.category_id = er.category_id
      GROUP BY ec.category_id;
    `);

    const cats = [];
    let grandTotal = 0;
    let countTotal = 0;

    while (stmt.step()) {
      const r = stmt.getAsObject();
      const tot = Number(r.total || 0);
      const cnt = Number(r.count || 0);
      grandTotal += tot;
      countTotal += cnt;
      cats.push({ name: r.category_name_ar, total: tot, count: cnt });
    }
    stmt.free();

    const cairoTime = getCairoNow();

    return {
      grandTotal,
      countTotal,
      categories: cats,
      formattedText: (
        `💸 *تقرير المصروفات التشغيلية والنثرية*\n\n` +
        `💰 *إجمالي المصروفات:* ${formatEgp(grandTotal)}\n` +
        `🧾 *عدد العمليات المسجلة:* ${countTotal} حركة\n\n` +
        `📋 *بيان بنود المصروفات:*\n` +
        cats.map(c => `• *${c.name}:* ${formatEgp(c.total)} (${c.count} سند)`).join('\n') +
        `\n\n🕒 *توقيت التقرير:* ${cairoTime.timeStr}` +
        (countTotal === 0 ? `\n\n💡 _ملاحظة: لا توجد مصروفات مسجلة حتى الآن._` : '')
      )
    };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// 6. تقرير الورديات والخزينة (Shifts Report)
// ---------------------------------------------------------------------------
export async function getShiftsReport() {
  const db = await getReadOnlyDb();
  try {
    // الوردية المفتوحة حالياً إن وجدت
    const openStmt = db.prepare(`
      SELECT cs.*, b.branch_name as branch_name
      FROM cashier_shifts cs
      LEFT JOIN branches b ON cs.branch_id = b.branch_id
      WHERE cs.status = 'open'
      ORDER BY cs.opened_at DESC
      LIMIT 1;
    `);
    
    let openShift = null;
    if (openStmt.step()) {
      openShift = openStmt.getAsObject();
    }
    openStmt.free();

    // آخر وردية مغلقة
    const lastClosedStmt = db.prepare(`
      SELECT cs.*, b.branch_name as branch_name
      FROM cashier_shifts cs
      LEFT JOIN branches b ON cs.branch_id = b.branch_id
      WHERE cs.status = 'closed'
      ORDER BY cs.closed_at DESC
      LIMIT 1;
    `);
    let lastClosed = null;
    if (lastClosedStmt.step()) {
      lastClosed = lastClosedStmt.getAsObject();
    }
    lastClosedStmt.free();

    const cairoTime = getCairoNow();

    let openText = '';
    if (openShift) {
      const expCash = Number(openShift.expected_cash || 0);
      openText = (
        `🟢 *الوردية الحالية:* مفتوحة (رقم #${openShift.shift_number})\n` +
        `👤 *الكاشير المسئول:* ${openShift.cashier_id}\n` +
        `🚪 *وقت الفتح:* ${openShift.opened_at ? String(openShift.opened_at).split(/[T ]/)[1]?.slice(0, 5) || 'غير محدد' : 'غير محدد'}\n` +
        `💵 *العهدة الافتتاحية (Float):* ${formatEgp(openShift.opening_float)}\n` +
        `💰 *مبيعات كاش بالوردية:* ${formatEgp(openShift.cash_sales)}\n` +
        `💳 *مبيعات إلكترونية:* ${formatEgp(openShift.electronic_sales)}\n` +
        `📥 *النقدية المتوقعة بالدرج:* ${formatEgp(expCash)}\n`
      );
    } else {
      openText = `🔴 *حالة الوردية الآن:* لا توجد وردية مفتوحة حالياً بالفرع.\n`;
    }

    let closedText = '';
    if (lastClosed) {
      const disc = Number(lastClosed.discrepancy || 0);
      const discText = disc === 0 ? 'مطابق تماماً (0.00 ج.م) ✅' : (disc > 0 ? `زيادة +${formatEgp(disc)} 🟢` : `عجز -${formatEgp(Math.abs(disc))} 🔴`);
      closedText = (
        `\n⏮️ *آخر وردية تم إغلاقها (رقم #${lastClosed.shift_number}):*\n` +
        `• إجمالي الكاش المورد: ${formatEgp(lastClosed.actual_cash_counted)}\n` +
        `• النقدية المتوقعة: ${formatEgp(lastClosed.expected_cash)}\n` +
        `• التسوية (العجز/الزيادة): ${discText}\n`
      );
    }

    return {
      hasOpenShift: Boolean(openShift),
      openShift,
      lastClosed,
      formattedText: (
        `⏱️ *تقرير الورديات والخزينة — وسط البلد*\n\n` +
        openText +
        closedText +
        `\n🕒 *وقت الفحص:* ${cairoTime.timeStr}`
      )
    };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// 7. تقرير قائمة المنتجات (Products & Menu Items)
// ---------------------------------------------------------------------------
export async function getProductsReport() {
  const db = await getReadOnlyDb();
  try {
    const catStmt = db.prepare(`SELECT * FROM product_categories ORDER BY sort_order ASC;`);
    const categories = [];
    while (catStmt.step()) {
      categories.push(catStmt.getAsObject());
    }
    catStmt.free();

    const prodStmt = db.prepare(`SELECT count(*) as cnt FROM products WHERE is_active = 1;`);
    prodStmt.step();
    const prodCount = prodStmt.getAsObject().cnt || 0;
    prodStmt.free();

    const sizeStmt = db.prepare(`SELECT size_code, name_ar, volume_ml FROM product_sizes ORDER BY sort_order ASC;`);
    const sizes = [];
    while (sizeStmt.step()) {
      sizes.push(sizeStmt.getAsObject());
    }
    sizeStmt.free();

    const cairoTime = getCairoNow();

    return {
      prodCount,
      categoriesCount: categories.length,
      sizes,
      formattedText: (
        `🥤 *دليل المنتجات والأصناف الجاهزة للبيع*\n\n` +
        `🏷️ *عدد المنتجات النشطة:* ${prodCount} منتج\n` +
        `📂 *أقسام المنيو:* ${categories.length} أقسام\n` +
        categories.map(c => `   • ${c.name_ar}`).join('\n') + `\n\n` +
        `📏 *الأحجام المعيارية:* ` + sizes.map(s => `${s.name_ar}`).join(' و ') + `\n` +
        `\n🕒 *وقت الفحص:* ${cairoTime.timeStr}` +
        (prodCount === 0 ? `\n\n💡 _ملاحظة: قاعدة البيانات مجهزة بأقسام المنيو والأحجام، ولم تُدرج منتجات نهائية بعد._` : '')
      )
    };
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// 8. التقرير اليومي الشامل (Full Daily Executive Summary)
// ---------------------------------------------------------------------------
export async function getExecutiveSummary(period = 'today') {
  const sales = await getSalesReport(period);
  const payments = await getPaymentsReport(period);
  const inventory = await getInventoryReport();
  const purchases = await getPurchasesReport();
  const shifts = await getShiftsReport();
  const cairoTime = getCairoNow();

  const netOperations = sales.totalSales - purchases.approvedAmount;

  return {
    sales,
    payments,
    inventory,
    purchases,
    shifts,
    formattedText: (
      `📈 *التقرير التنفيذي الشامل — Fruit City*\n` +
      `📅 *الفترة:* ${sales.period}\n\n` +
      `💰 *المبيعات المدفوعة:* ${formatEgp(sales.totalSales)} (${sales.orderCount} طلب)\n` +
      `💳 *المحصل كاش / إلكتروني:* ${formatEgp(payments.totalGross)}\n` +
      `🛒 *توريدات المشتريات المعتمدة:* ${formatEgp(purchases.approvedAmount)} (${purchases.approvedCount} فاتورة)\n` +
      `📦 *قيمة المخزون الحالي:* ${formatEgp(inventory.totalStockValue)} (${inventory.totalItems} صنف)\n` +
      `⏱️ *حالة الوردية:* ${shifts.hasOpenShift ? `مفتوحة (#${shifts.openShift.shift_number}) 🟢` : 'لا توجد وردية مفتوحة 🔴'}\n` +
      `━━━━━━━━━━━━━━━━━━\n` +
      `⚖️ *مؤشر الحركة التشغيلية (المبيعات - المشتريات المعتمدة):* ${formatEgp(netOperations)}\n\n` +
      `🕒 *تاريخ ووقت الفحص:* ${cairoTime.fullStr}\n` +
      `🛡️ _جميع البيانات حية ومستخرجة من قاعدة البيانات المحلية مباشرة دون تعديل._`
    )
  };
}
