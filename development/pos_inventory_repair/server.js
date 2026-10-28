import http from 'http';
import {posSessions,cashierRouteAllowed} from '../../web_app/order_sandbox/pos-sessions.mjs';
import {requestLimit} from '../../web_app/order_sandbox/request-limit.mjs';
import { startPosWorker } from '../../web_app/order_sandbox/pos-worker.mjs';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import initSqlJs from 'sql.js';
import { argon2id } from 'hash-wasm';
import { resolveServingSize, calculateIngredientNeeds } from './orderRules.js';
import { initIngestSchema, handleIngestInvoice } from './integrations/telegram/ingestHandler.js';
import { initAdminSchema, handleAdminApi } from './integrations/admin/adminControlHandler.js';
import {
  calculateItemCostsAndWaste,
  calculateIncomingStockAndWac,
  parseRawInvoiceText
} from './integrations/purchases/invoice_engine.js';
import { saveDatabaseAtomic, recoverOnStartup } from './durable-commit.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.FRUIT_CITY_DEV_PORT || 5173);
const DIST_DIR = path.join(__dirname, 'dist');
const DB_PATH = process.env.FRUIT_CITY_DEV_DB_PATH || path.join(__dirname, 'database', 'fruit_city_production.db');
// Validate before any database initialization or listener is started.
if (process.env.FC_DEV_ORDER_BRIDGE_URL) {
    const testPath = path.resolve(DB_PATH);
    const devRoot = path.resolve(__dirname) + path.sep;
    const bridgeUrl = new URL(process.env.FC_DEV_ORDER_BRIDGE_URL);
    if (!process.env.FRUIT_CITY_DEV_PORT || !process.env.FRUIT_CITY_DEV_DB_PATH ||
        !testPath.startsWith(devRoot) || !testPath.endsWith('.test.db') ||
        bridgeUrl.protocol !== 'http:' || bridgeUrl.hostname !== '127.0.0.1' ||
        !process.env.FC_DEV_BRANCH_ID) throw new Error('ISOLATED_BRIDGE_CONFIG_REQUIRED');

}
recoverOnStartup(DB_PATH);
const SCHEMA_PATH = path.join(__dirname, 'database', 'schema', '001_initial_schema.sql');
const CLEAN_SETUP_PATH = path.join(__dirname, 'database', 'schema', '003_clean_production_setup.sql');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

// ---------------------------------------------------------------------------
// 1. DATABASE SINGLETON & TRANSACTIONAL ENGINE
// ---------------------------------------------------------------------------
let SQL_MODULE = null;
let DB = null;
let dbLastMtime = 0;

export function syncDatabaseWithDisk() {
  if (!fs.existsSync(DB_PATH) || !SQL_MODULE || inTransaction) return;
  try {
    const stat = fs.statSync(DB_PATH);
    if (stat.mtimeMs > dbLastMtime) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      if (fileBuffer.length > 0) {
        if (DB) {
          try { DB.close(); } catch (_) {}
        }
        DB = new SQL_MODULE.Database(fileBuffer);
        DB.run('PRAGMA foreign_keys = ON;');
        dbLastMtime = stat.mtimeMs;
        console.log(`[Database Sync] Reloaded DB from disk (size: ${fileBuffer.length}, mtime: ${new Date(stat.mtimeMs).toISOString()})`);
      }
    }
  } catch (err) {
    console.warn('[Database Sync Warning]', err.message);
  }
}

async function getDatabase() {
  if (!SQL_MODULE) {
    SQL_MODULE = await initSqlJs();
  }

  if (DB) {
    syncDatabaseWithDisk();
    return DB;
  }

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    DB = new SQL_MODULE.Database(fileBuffer);
    try {
      dbLastMtime = fs.statSync(DB_PATH).mtimeMs;
    } catch (_) {}
  } else {
    DB = new SQL_MODULE.Database();
    if (fs.existsSync(SCHEMA_PATH)) {
      DB.run(fs.readFileSync(SCHEMA_PATH, 'utf8'));
    }
    if (fs.existsSync(CLEAN_SETUP_PATH)) {
      DB.run(fs.readFileSync(CLEAN_SETUP_PATH, 'utf8'));
    }
    saveDatabase();
  }
  DB.run('PRAGMA foreign_keys = ON;');
  DB.run('CREATE UNIQUE INDEX IF NOT EXISTS idx_single_active_owner ON users (role_id) WHERE role_id = "role_owner" AND is_active = 1;');

  // Ensure 'custom' placeholder ingredient exists so foreign keys are fully satisfied for custom invoice items
  DB.run(`
    INSERT OR IGNORE INTO ingredients (
      ingredient_id, name_ar, name_en, category_id, purchase_unit, base_unit,
      conversion_factor, usable_yield_percent, waste_percent, reorder_level, status, is_measured, notes, created_at, updated_at
    ) VALUES (
      'custom', 'صنف مخصص', 'Custom Item', 'cat_fresh_fruit', 'package', 'piece',
      1.0000, 100.00, 0.00, 0.00, 'active', 1, 'خامة مخصصة للمسودات', datetime('now'), datetime('now')
    );
  `);

  // Auto-migrate purchase_invoice_items columns if missing
  try {
    DB.run(`ALTER TABLE purchase_invoice_items ADD COLUMN package_fee DECIMAL(12, 2) DEFAULT 0.00;`);
  } catch (e) {
    // Already exists
  }
  try {
    DB.run(`ALTER TABLE purchase_invoice_items ADD COLUMN custom_ingredient_name VARCHAR(100) DEFAULT NULL;`);
  } catch (e) {
    // Already exists
  }
  try { DB.run(`ALTER TABLE purchase_invoice_items ADD COLUMN units_per_kg DECIMAL(10, 2) DEFAULT NULL;`); } catch (e) {}
  try { DB.run(`ALTER TABLE purchase_invoice_items ADD COLUMN total_units DECIMAL(10, 2) DEFAULT NULL;`); } catch (e) {}
  try { DB.run(`ALTER TABLE purchase_invoice_items ADD COLUMN package_gross_weight DECIMAL(10, 3) DEFAULT NULL;`); } catch (e) {}
  try { DB.run(`ALTER TABLE purchase_invoice_items ADD COLUMN weight_before_peeling DECIMAL(10, 3) DEFAULT NULL;`); } catch (e) {}
  try { DB.run(`ALTER TABLE purchase_invoice_items ADD COLUMN weight_after_peeling DECIMAL(10, 3) DEFAULT NULL;`); } catch (e) {}
  try { DB.run(`ALTER TABLE purchase_invoice_items ADD COLUMN waste_percent DECIMAL(5, 2) DEFAULT NULL;`); } catch (e) {}
  try { DB.run(`ALTER TABLE purchase_invoice_items ADD COLUMN effective_net_kg_cost DECIMAL(12, 2) DEFAULT NULL;`); } catch (e) {}
  try { DB.run(`ALTER TABLE purchase_invoice_items ADD COLUMN prep_notes TEXT DEFAULT NULL;`); } catch (e) {}

  // Ensure table for tracking ingested external messages and preventing duplicates
  initIngestSchema(DB);

  // Ensure table for admin idempotency and carton tare settings
  initAdminSchema(DB);

  return DB;
}

function saveDatabase() {
  if (!DB) return;
  if (inTransaction) {
    console.warn('[db] saveDatabase called during transaction — deferred to commit');
    return;
  }
  saveDatabaseAtomic(DB, DB_PATH, () => {
    DB.run('PRAGMA foreign_keys = ON;');
  });
  try { dbLastMtime = fs.statSync(DB_PATH).mtimeMs; } catch (_) {}
}

function queryAll(sql, params = []) {
  const stmt = DB.prepare(sql);
  try {
    if (params.length > 0) stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    return rows;
  } finally {
    stmt.free();
  }
}

function queryOne(sql, params = []) {
  const rows = queryAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

let inTransaction = false;
let dbTransactionQueue = Promise.resolve();

function databaseSnapshot() {
  try { return DB.export(); }
  finally { DB.run('PRAGMA foreign_keys = ON;'); }
}

function restoreDatabaseSnapshot(snapshot) {
  DB.close();
  DB = new SQL_MODULE.Database(snapshot);
  DB.run('PRAGMA foreign_keys = ON;');
}

function runSql(sql, params = []) {
  if (inTransaction) { DB.run(sql, params); return; }
  const before = databaseSnapshot();
  try { DB.run(sql, params); saveDatabase(); }
  catch (error) { restoreDatabaseSnapshot(before); throw error; }
}

function runTransaction(callback) {
  const op = () => {
    if (callback.constructor.name === 'AsyncFunction') throw new Error('SYNCHRONOUS_TRANSACTION_REQUIRED');
    const before = databaseSnapshot();
    inTransaction = true;
    try {
      DB.run('BEGIN TRANSACTION;');
      const result = callback();
      if (result && typeof result.then === 'function') throw new Error('SYNCHRONOUS_TRANSACTION_REQUIRED');
      DB.run('COMMIT;');
      inTransaction = false;
      saveDatabase();
      return result;
    } catch (error) {
      inTransaction = false;
      restoreDatabaseSnapshot(before);
      throw error;
    }
  };
  const nextPromise = dbTransactionQueue.then(op, op);
  dbTransactionQueue = nextPromise.catch(() => {});
  return nextPromise;
}

// ---------------------------------------------------------------------------
// 2. ARGON2ID SECURITY & FIRST-RUN OWNER SETUP
// ---------------------------------------------------------------------------
async function hashArgon2id(password) {
  const salt = crypto.randomBytes(16);
  return await argon2id({
    password,
    salt,
    parallelism: 1,
    iterations: 3,
    memorySize: 65536,
    hashLength: 32,
    outputType: 'encoded'
  });
}

async function verifyArgon2id(password, encodedHash) {
  try {
    const parts = encodedHash.split('$');
    if (parts.length < 6 || parts[1] !== 'argon2id') return false;
    const saltBuffer = Buffer.from(parts[4], 'base64');
    const computed = await argon2id({
      password,
      salt: saltBuffer,
      parallelism: 1,
      iterations: 3,
      memorySize: 65536,
      hashLength: 32,
      outputType: 'encoded'
    });
    return computed === encodedHash;
  } catch {
    return false;
  }
}

function checkIsFirstRun() {
  const row = queryOne(`SELECT count(*) as cnt FROM users WHERE role_id = 'role_owner' AND is_active = 1;`);
  return !row || Number(row.cnt) === 0;
}

// ---------------------------------------------------------------------------
// 3. HTTP REQUEST BODY PARSER
// ---------------------------------------------------------------------------
function parseJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// ---------------------------------------------------------------------------
// 4. API ROUTER
// ---------------------------------------------------------------------------
const cashierSessions=posSessions({lookupUser:id=>queryOne('SELECT user_id,role_id,is_active FROM users WHERE user_id=?',[id])});
const cashierLoginLimit=requestLimit({limit:10,windowMs:60000});
async function handleApiRequest(req, res, db) {
  syncDatabaseWithDisk();
  const url = req.url.split('?')[0];
  const method = req.method;

  res.setHeader('Cache-Control','no-store');
  if(req.headers.origin){
    let originHost;try{originHost=new URL(req.headers.origin).host;}catch{return sendJson(res,403,{error:'ORIGIN_NOT_ALLOWED'});}
    if(originHost!==req.headers.host && req.headers.origin!==process.env.FRUIT_CITY_DEV_WEB_ORIGIN)return sendJson(res,403,{error:'ORIGIN_NOT_ALLOWED'});
  }
  const publicRoute=(method==='GET'&&url==='/api/health')||(method==='POST'&&['/api/auth/login','/api/auth/setup-owner'].includes(url));
  if(publicRoute && method==='POST'){
    const budget=cashierLoginLimit(req.socket.remoteAddress??'unknown');
    if(!budget.allowed){res.setHeader('Retry-After',String(budget.retryAfter));return sendJson(res,429,{error:'RATE_LIMITED'});}
  }
  if(!publicRoute){
    const user=cashierSessions.authenticate(req);
    if(!user)return sendJson(res,401,{error:'UNAUTHORIZED'});
    const permissions=queryAll('SELECT p.permission_code FROM role_permissions rp JOIN permissions p ON rp.permission_id=p.permission_id WHERE rp.role_id=?',[user.role_id]).map(p=>p.permission_code);
    if(!cashierRouteAllowed(user,url,permissions))return sendJson(res,403,{error:'FORBIDDEN'});
    req.authenticatedUser=user;
  }
  if(url==='/api/auth/session'&&method==='GET')return sendJson(res,200,{userId:req.authenticatedUser.user_id,roleId:req.authenticatedUser.role_id});
  if(url==='/api/auth/logout'&&method==='POST'){cashierSessions.logout(req,res);return sendJson(res,200,{success:true});}
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  try {
    // HEALTH CHECK
    if (url === '/api/health' && method === 'GET') {
      const isFirstRun = checkIsFirstRun();
      return sendJson(res, 200, {
        status: 'ok',
        version: '2.0.0',
        branchId: 'branch_downtown_cairo',
        branchNameAr: 'Fruit City — Downtown Cairo (وسط البلد)',
        isFirstRun,
        database: 'SQLite (Isolated Windows Production Engine)'
      });
    }

    // FIRST-RUN OWNER SETUP
    if (url === '/api/auth/setup-owner' && method === 'POST') {
      if (!checkIsFirstRun()) {
        return sendJson(res, 400, { error: 'SYSTEM_ALREADY_INITIALIZED', message: 'حساب المالك تم تأسيسه بالفعل.' });
      }
      const { fullNameAr, username, password } = await parseJsonBody(req);
      if (!username || username.trim().length < 3) {
        return sendJson(res, 400, { error: 'INVALID_USERNAME', message: 'اسم المستخدم يجب ألا يقل عن 3 أحرف.' });
      }
      if (!password || password.length < 8) {
        return sendJson(res, 400, { error: 'WEAK_PASSWORD', message: 'كلمة المرور يجب أن تتكون من 8 خانات على الأقل.' });
      }

      const encodedHash = await hashArgon2id(password);
      const userId = `usr_owner_${Date.now()}`;
      const now = new Date().toISOString();

      await runTransaction(() => {
        if (!checkIsFirstRun()) {
          throw new Error('SYSTEM_ALREADY_INITIALIZED');
        }

        runSql(
          `INSERT INTO users (user_id, username, full_name_ar, password_hash, salt, role_id, is_active, created_at)
           VALUES (?, ?, ?, ?, 'argon2id_embedded', 'role_owner', 1, ?);`,
          [userId, username.trim(), (fullNameAr || 'مالك Fruit City').trim(), encodedHash, now]
        );
        runSql(
          `INSERT OR IGNORE INTO user_branch_access (user_id, branch_id) VALUES (?, 'branch_downtown_cairo');`,
          [userId]
        );
        runSql(
          `INSERT INTO audit_logs (log_id, user_id, action, target_type, target_id, details_json, created_at)
           VALUES (?, ?, 'FIRST_RUN_OWNER_SETUP', 'user', ?, ?, ?);`,
          [`log_${Date.now()}`, userId, userId, JSON.stringify({ username: username.trim(), method: 'Argon2id' }), now]
        );
      });

      cashierSessions.issue(req,res,userId);
      return sendJson(res, 200, {
        success: true,
        message: 'تم تأسيس حساب المالك بنجاح وتشفير كلمة المرور بـ Argon2id.',
        user: { userId, username: username.trim(), fullNameAr: fullNameAr || 'مالك Fruit City', roleId: 'role_owner' }
      });
    }

    // AUTH LOGIN
    if (url === '/api/auth/login' && method === 'POST') {
      const { username, password } = await parseJsonBody(req);
      if (!username || !password) {
        return sendJson(res, 400, { error: 'MISSING_CREDENTIALS', message: 'يرجى إدخال اسم المستخدم وكلمة المرور.' });
      }

      const user = queryOne(
        `SELECT u.user_id, u.username, u.full_name_ar, u.password_hash, u.role_id, r.role_name
         FROM users u
         JOIN roles r ON u.role_id = r.role_id
         WHERE u.username = ? AND u.is_active = 1;`,
        [username.trim()]
      );

      if (!user) {
        return sendJson(res, 401, { error: 'INVALID_CREDENTIALS', message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
      }

      const valid = await verifyArgon2id(password, user.password_hash);
      if (!valid) {
        return sendJson(res, 401, { error: 'INVALID_CREDENTIALS', message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
      }

      cashierSessions.issue(req,res,user.user_id);
      const perms = queryAll(
        `SELECT p.permission_code
         FROM role_permissions rp
         JOIN permissions p ON rp.permission_id = p.permission_id
         WHERE rp.role_id = ?;`,
        [user.role_id]
      ).map(p => p.permission_code);

      return sendJson(res, 200, {
        success: true,
        user: {
          userId: user.user_id,
          username: user.username,
          fullNameAr: user.full_name_ar,
          roleId: user.role_id,
          roleName: user.role_name,
          permissions: perms
        }
      });
    }

    // GET FULL APPLICATION STATE
    if (url === '/api/state' && method === 'GET') {
      const isFirstRun = checkIsFirstRun();
      const rawIngs = queryAll(`
        SELECT i.*, bi.stock_quantity, bi.weighted_average_cost, bi.last_purchase_price, bi.min_stock_alert
        FROM ingredients i
        LEFT JOIN branch_inventory bi ON i.ingredient_id = bi.ingredient_id AND bi.branch_id = 'branch_downtown_cairo';
      `);

      const ingredients = rawIngs.map(i => ({
        id: i.ingredient_id,
        nameAr: i.name_ar,
        nameEn: i.name_en || '',
        category: i.category_id,
        purchaseUnit: i.purchase_unit,
        packageSize: 1,
        currentPrice: Number(i.last_purchase_price || 0),
        pricePerBaseUnit: Number(i.weighted_average_cost || 0),
        baseUnit: i.base_unit,
        usableYieldPercent: Number(i.usable_yield_percent || 100),
        wastePercentage: Number(i.waste_percent || 0),
        stockQuantity: Number(i.stock_quantity || 0),
        lowStockThreshold: Number(i.min_stock_alert || 0),
        isMeasured: Boolean(i.is_measured),
        notes: i.notes || '',
        priceHistory: []
      }));

      const rawProducts = queryAll(`SELECT * FROM products WHERE is_active = 1;`);
      const rawPrices = queryAll(`
        SELECT pp.*, ps.size_code 
        FROM product_prices pp
        JOIN product_sizes ps ON pp.size_id = ps.size_id
        WHERE pp.branch_id = 'branch_downtown_cairo';
      `);

      const products = rawProducts.map(p => {
        const pricesObj = { '16oz': 0, '500ml': 0, '1L': 0, '400ml': 0 };
        const packagingObj = { '16oz': 0, '500ml': 0, '1L': 0, '400ml': 0 };
        const pPrices = rawPrices.filter(pr => pr.product_id === p.product_id);
        for (const pr of pPrices) {
          pricesObj[pr.size_code] = Number(pr.selling_price);
          packagingObj[pr.size_code] = Number(pr.packaging_cost);
        }
        // Fallbacks between sizes
        if (!pricesObj['400ml'] && pricesObj['16oz']) pricesObj['400ml'] = pricesObj['16oz'];
        if (!pricesObj['16oz'] && pricesObj['400ml']) pricesObj['16oz'] = pricesObj['400ml'];

        const isAvailable = pPrices.length > 0 ? pPrices.some(pr => Number(pr.is_available) === 1) : true;

        return {
          id: p.product_id,
          nameAr: p.name_ar,
          nameEn: p.name_en || '',
          category: p.category_id,
          recipeId: `rec_${p.product_id}`,
          prices: pricesObj,
          packaging: packagingObj,
          servingMl: { '16oz': 473, '500ml': 500, '1L': 1000, '400ml': 400 },
          isComplete: true,
          isAvailable
        };
      });

      const rawRecipes = queryAll(`SELECT * FROM recipes WHERE status = 'active';`);
      const rawRecipeIngs = queryAll(`SELECT * FROM recipe_ingredients;`);

      const recipes = rawRecipes.map(r => ({
        id: r.recipe_id,
        productId: r.product_id,
        nameAr: r.name_ar,
        method: r.recipe_method,
        batchYieldMl: Number(r.batch_yield_ml || 1000),
        hasAddedSugar: Boolean(r.has_added_sugar),
        isComplete: Boolean(r.is_complete),
        iceWaterNotes: r.ice_water_notes || '',
        lastUpdated: r.updated_at,
        ingredients: rawRecipeIngs
          .filter(ri => ri.recipe_id === r.recipe_id)
          .map(ri => ({
            ingredientId: ri.ingredient_id,
            quantity: Number(ri.quantity),
            unit: ri.unit,
            notes: ri.notes || ''
          }))
      }));

      const rawInvoices = queryAll(`SELECT * FROM purchase_invoices ORDER BY invoice_date DESC, created_at DESC;`);
      const rawInvoiceItems = queryAll(`
        SELECT pii.*, i.name_ar AS ing_name_ar, i.category_id AS ing_category
        FROM purchase_invoice_items pii
        LEFT JOIN ingredients i ON pii.ingredient_id = i.ingredient_id;
      `);

      const invoices = rawInvoices.map(inv => ({
        id: inv.invoice_id,
        invoiceNumber: inv.invoice_number,
        invoiceDate: inv.invoice_date,
        supplierName: inv.supplier_name,
        status: inv.status,
        totalAmount: Number(inv.total_amount),
        totalWeightKg: Number(inv.total_weight_kg || 0),
        notes: inv.notes || '',
        createdAt: inv.created_at,
        items: rawInvoiceItems
          .filter(it => it.invoice_id === inv.invoice_id)
          .map(it => ({
            id: it.item_id,
            ingredientId: it.ingredient_id,
            ingredientNameAr: it.custom_ingredient_name || it.ing_name_ar || (it.ingredient_id === 'custom' ? 'صنف مخصص' : ''),
            ingredientCategory: it.ing_category === 'cat_fresh_fruit' ? 'فواكه طازجة'
              : (it.ing_category === 'cat_dairy' ? 'ألبان وكريمات'
              : (it.ing_category === 'cat_sweeteners' ? 'سكريات ومحليات'
              : (it.ing_category === 'cat_packaging' ? 'تعبئة وتغليف'
              : (it.ing_category === 'cat_additives' ? 'نكهات ومواد مضافة' : (it.ing_category || 'فواكه طازجة'))))),
            pricingMethod: it.pricing_method,
            packageCount: Number(it.package_count || 1),
            packageUnitName: it.package_unit_name || '',
            totalWeightKg: Number(it.total_weight_kg || 0),
            unitPrice: Number(it.unit_price),
            packageFee: Number(it.package_fee || 0),
            totalCost: Number(it.total_cost),
            effectiveKgPrice: it.effective_kg_price !== null && it.effective_kg_price !== undefined ? Number(it.effective_kg_price) : undefined,
            unitsPerKg: it.units_per_kg !== null && it.units_per_kg !== undefined ? Number(it.units_per_kg) : undefined,
            totalUnits: it.total_units !== null && it.total_units !== undefined ? Number(it.total_units) : undefined,
            packageGrossWeight: it.package_gross_weight !== null && it.package_gross_weight !== undefined ? Number(it.package_gross_weight) : undefined,
            weightBeforePeeling: it.weight_before_peeling !== null && it.weight_before_peeling !== undefined ? Number(it.weight_before_peeling) : undefined,
            weightAfterPeeling: it.weight_after_peeling !== null && it.weight_after_peeling !== undefined ? Number(it.weight_after_peeling) : undefined,
            wastePercent: it.waste_percent !== null && it.waste_percent !== undefined ? Number(it.waste_percent) : undefined,
            effectiveNetKgCost: it.effective_net_kg_cost !== null && it.effective_net_kg_cost !== undefined ? Number(it.effective_net_kg_cost) : undefined,
            prepNotes: it.prep_notes || undefined,
            customIngredientName: it.custom_ingredient_name || undefined,
            weightUnknown: Boolean(it.weight_unknown),
            notes: it.notes || ''
          }))
      }));

      const rawOrders = queryAll(`SELECT * FROM orders ORDER BY created_at DESC;`);
      const rawOrderItems = queryAll(`SELECT * FROM order_items;`);

      const orders = rawOrders.map(o => ({
        id: o.order_id,
        orderNumber: o.order_number,
        orderType: o.order_type,
        subtotal: Number(o.subtotal),
        discountAmount: Number(o.discount_amount || 0),
        deliveryFee: Number(o.delivery_fee || 0),
        totalAmount: Number(o.total_amount),
        orderStatus: o.order_status,
        paymentStatus: o.payment_status,
        preparationStatus: o.preparation_status,
        cashierId: o.cashier_id,
        shiftId: o.shift_id,
        createdAt: o.created_at,
        items: rawOrderItems
          .filter(oi => oi.order_id === o.order_id)
          .map(oi => ({
            id: oi.order_item_id,
            productId: oi.product_id,
            servingSize: '400ml',
            unitPrice: Number(oi.unit_price),
            quantity: Number(oi.quantity),
            totalPrice: Number(oi.total_price),
            modifiers: { sugarLevel: 'standard', iceLevel: 'standard' }
          }))
      }));

      const rawPayments = queryAll(`SELECT * FROM payment_records ORDER BY created_at DESC;`);
      const payments = rawPayments.map(p => ({
        id: p.payment_id,
        orderId: p.order_id,
        amount: Number(p.gross_amount),
        method: p.payment_method,
        status: p.payment_status,
        timestamp: p.created_at,
        cashierId: p.cashier_id,
        feeAmount: Number(p.fee_amount || 0),
        netAmount: Number(p.net_amount || p.gross_amount)
      }));

      const rawShifts = queryAll(`SELECT * FROM cashier_shifts ORDER BY shift_number DESC;`);
      const shifts = rawShifts.map(s => ({
        id: s.shift_id,
        shiftNumber: Number(s.shift_number),
        cashierId: s.cashier_id,
        cashierName: s.cashier_id,
        startTime: s.opened_at,
        endTime: s.closed_at || undefined,
        status: s.status,
        openingFloat: Number(s.opening_float),
        cashReceived: Number(s.cash_sales),
        expectedCash: Number(s.expected_cash),
        actualCashCounted: s.actual_cash_counted ? Number(s.actual_cash_counted) : undefined,
        discrepancy: Number(s.discrepancy || 0)
      }));

      const rawExpenses = queryAll(`SELECT * FROM expense_records ORDER BY expense_date DESC;`);
      const expenses = rawExpenses.map(e => ({
        id: e.expense_id,
        nameAr: e.name_ar,
        nameEn: '',
        monthlyAmount: Number(e.amount),
        type: 'fixed',
        category: 'rent'
      }));

      const rawFeeRules = queryAll(`SELECT * FROM payment_fee_rules WHERE is_active = 1;`);
      const paymentFeeRules = rawFeeRules.map(r => ({
        id: r.rule_id,
        providerName: r.provider_name,
        paymentMethod: r.payment_method,
        feePercent: Number(r.fee_percent),
        fixedFee: Number(r.fixed_fee),
        contractualTaxPercent: Number(r.contractual_tax_percent),
        active: Boolean(r.is_active)
      }));

      const rawUsers = queryAll(`SELECT user_id, username, full_name_ar, role_id FROM users WHERE is_active = 1;`);
      const cashierAccounts = rawUsers.map(u => ({
        id: u.user_id,
        nameAr: u.full_name_ar,
        username: u.username,
        role: u.role_id === 'role_owner' ? 'manager' : 'cashier',
        pinCode: '****',
        active: true
      }));

      return sendJson(res, 200, {
        isFirstRun,
        ingredients,
        products,
        recipes,
        expenses,
        invoices,
        orders,
        payments,
        shifts,
        paymentFeeRules,
        cashierAccounts,
        promotions: [],
        refunds: [],
        drinkWastes: [],
        approvalRequests: []
      });
    }

    // ADD / UPDATE INGREDIENT
    if (url === '/api/ingredients' && method === 'POST') {
      const data = await parseJsonBody(req);
      const now = new Date().toISOString();
      const id = data.id || `ing_${Date.now()}`;
      const factor = data.baseUnit === 'g' && data.purchaseUnit === 'kg' ? 1000 : 1;

      await runTransaction(() => {
        runSql(
          `INSERT INTO ingredients (ingredient_id, name_ar, name_en, category_id, purchase_unit, base_unit, conversion_factor, usable_yield_percent, waste_percent, reorder_level, status, is_measured, notes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', 1, ?, ?, ?)
           ON CONFLICT(ingredient_id) DO UPDATE SET
             name_ar = excluded.name_ar,
             category_id = excluded.category_id,
             purchase_unit = excluded.purchase_unit,
             base_unit = excluded.base_unit,
             conversion_factor = excluded.conversion_factor,
             usable_yield_percent = excluded.usable_yield_percent,
             waste_percent = excluded.waste_percent,
             reorder_level = excluded.reorder_level,
             notes = excluded.notes,
             updated_at = excluded.updated_at;`,
          [
            id,
            data.nameAr,
            data.nameEn || null,
            data.category || 'cat_fresh_fruit',
            data.purchaseUnit || 'kg',
            data.baseUnit || 'g',
            factor,
            Number(data.usableYieldPercent || 100),
            Number(data.wastePercentage || 0),
            Number(data.lowStockThreshold || 0),
            data.notes || null,
            now,
            now
          ]
        );

        runSql(
          `INSERT INTO branch_inventory (branch_id, ingredient_id, stock_quantity, weighted_average_cost, min_stock_alert, updated_at)
           VALUES ('branch_downtown_cairo', ?, ?, ?, ?, ?)
           ON CONFLICT(branch_id, ingredient_id) DO UPDATE SET
             stock_quantity = CASE WHEN excluded.stock_quantity > 0 THEN excluded.stock_quantity ELSE branch_inventory.stock_quantity END,
             weighted_average_cost = CASE WHEN excluded.weighted_average_cost > 0 THEN excluded.weighted_average_cost ELSE branch_inventory.weighted_average_cost END,
             updated_at = excluded.updated_at;`,
          ['branch_downtown_cairo', id, Number(data.stockQuantity || 0), Number(data.pricePerBaseUnit || 0), Number(data.lowStockThreshold || 0), now]
        );
      });

      return sendJson(res, 200, { success: true, id });
    }

    // PARSE RAW WHOLESALE INVOICE TEXT
    if (url === '/api/invoices/parse' && method === 'POST') {
      const body = await parseJsonBody(req);
      try {
        const parsed = parseRawInvoiceText(body.rawText || body.text || '');
        return sendJson(res, 200, { success: true, parsed });
      } catch (err) {
        return sendJson(res, 400, { error: 'PARSE_FAILED', message: err.message });
      }
    }

    // ADD / UPDATE PURCHASE INVOICE & APPROVE
    if (url === '/api/invoices' && method === 'POST') {
      const data = await parseJsonBody(req);
      const now = new Date().toISOString();
      let invoiceId = data.id;
      if (data.invoiceNumber) {
        const existingInv = queryOne(`SELECT invoice_id FROM purchase_invoices WHERE invoice_number = ?;`, [data.invoiceNumber]);
        if (existingInv) invoiceId = existingInv.invoice_id;
      }
      if (!invoiceId) {
        invoiceId = `inv_${Date.now()}`;
      }

      let wasAlreadyApproved = false;
      if (invoiceId) {
        const existingInv = queryOne(`SELECT status FROM purchase_invoices WHERE invoice_id = ?;`, [invoiceId]);
        if (existingInv && existingInv.status === 'approved') {
          wasAlreadyApproved = true;
        }
      }
      const isApproval = data.status === 'approved';

      await runTransaction(() => {
        runSql(
          `INSERT INTO purchase_invoices (invoice_id, invoice_number, branch_id, supplier_name, invoice_date, status, total_amount, total_weight_kg, notes, created_by, created_at)
           VALUES (?, ?, 'branch_downtown_cairo', ?, ?, ?, ?, ?, ?, 'owner', ?)
           ON CONFLICT(invoice_id) DO UPDATE SET
             invoice_number = excluded.invoice_number,
             invoice_date = excluded.invoice_date,
             supplier_name = excluded.supplier_name,
             status = excluded.status,
             total_amount = excluded.total_amount,
             total_weight_kg = excluded.total_weight_kg,
             notes = excluded.notes;`,
          [
            invoiceId,
            data.invoiceNumber || `PUR-${Date.now().toString().slice(-4)}`,
            data.supplierName || 'سوق العبور',
            data.invoiceDate || now.split('T')[0],
            data.status || 'draft',
            Number(data.totalAmount || 0),
            Number(data.totalWeightKg || 0),
            data.notes || null,
            now
          ]
        );

        if (Array.isArray(data.items)) {
          runSql(`DELETE FROM purchase_invoice_items WHERE invoice_id = ?;`, [invoiceId]);
          for (const rawItm of data.items) {
            const calced = calculateItemCostsAndWaste({
              ...rawItm,
              itemId: rawItm.id || `pitem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
              ingredientId: rawItm.ingredientId || 'custom',
              itemName: rawItm.customIngredientName || rawItm.ingredientNameAr || rawItm.nameAr || rawItm.itemName || 'صنف توريد',
              unitPrice: rawItm.unitPrice,
              packageCount: rawItm.packageCount,
              packageFee: rawItm.packageFee,
              totalWeightKg: rawItm.totalWeightKg,
              pricingMethod: rawItm.pricingMethod,
              purchaseUnit: rawItm.purchaseUnit || rawItm.packageUnitName,
              unitsPerKg: rawItm.unitsPerKg,
              totalUnits: rawItm.totalUnits,
              packageGrossWeight: rawItm.packageGrossWeight,
              weightBeforePeeling: rawItm.weightBeforePeeling,
              weightAfterPeeling: rawItm.weightAfterPeeling,
              notes: rawItm.notes,
              prepNotes: rawItm.prepNotes
            });

            const customName = calced.ingredientId === 'custom' ? calced.itemName : (rawItm.customIngredientName || null);

            runSql(
              `INSERT INTO purchase_invoice_items (
                item_id, invoice_id, ingredient_id, pricing_method, package_count,
                package_unit_name, total_weight_kg, unit_price, package_fee, total_cost,
                effective_kg_price, units_per_kg, total_units, package_gross_weight,
                weight_before_peeling, weight_after_peeling, waste_percent,
                effective_net_kg_cost, prep_notes, weight_unknown, custom_ingredient_name, notes
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
              [
                calced.itemId,
                invoiceId,
                calced.ingredientId,
                calced.pricingMethod,
                calced.packageCount,
                calced.packageUnitName,
                calced.totalWeightKg,
                calced.unitPrice,
                calced.packageFee,
                calced.totalCost,
                calced.effectiveNetKgCost || calced.effectiveKgPrice,
                calced.unitsPerKg,
                calced.totalUnits,
                calced.packageGrossWeight,
                calced.weightBeforePeeling,
                calced.weightAfterPeeling,
                calced.wastePercent,
                calced.effectiveNetKgCost,
                calced.prepNotes,
                calced.weightUnknown ? 1 : 0,
                customName,
                calced.notes
              ]
            );

            // If approved AND NOT ALREADY APPROVED, update inventory & WAC with idempotency
            if (isApproval && !wasAlreadyApproved) {
              const ing = queryOne(`SELECT conversion_factor, base_unit FROM ingredients WHERE ingredient_id = ?;`, [calced.ingredientId]);
              const factor = ing ? Number(ing.conversion_factor) : 1000;
              const inv = queryOne(
                `SELECT stock_quantity, weighted_average_cost FROM branch_inventory WHERE branch_id = 'branch_downtown_cairo' AND ingredient_id = ?;`,
                [calced.ingredientId]
              );
              const curStock = inv ? Number(inv.stock_quantity) : 0;
              const curWac = inv ? Number(inv.weighted_average_cost) : 0;

              const { incomingBaseQty, incomingPricePerBase, newStock, newWac } = calculateIncomingStockAndWac({
                currentStock: curStock,
                currentWac: curWac,
                item: calced,
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
                ['branch_downtown_cairo', calced.ingredientId, newStock, newWac, calced.unitPrice, now]
              );

              // Ledger movement
              runSql(
                `INSERT INTO inventory_movements (movement_id, branch_id, ingredient_id, movement_type, quantity, unit, unit_cost, total_cost, balance_after, reference_type, reference_id, user_id, idempotency_key, created_at)
                 VALUES (?, 'branch_downtown_cairo', ?, 'purchase_receipt', ?, ?, ?, ?, ?, 'purchase_invoice', ?, 'owner', ?, ?);`,
                [
                  `mvt_${invoiceId}_${calced.itemId}`,
                  calced.ingredientId,
                  incomingBaseQty,
                  ing ? ing.base_unit : 'g',
                  incomingPricePerBase,
                  calced.totalCost,
                  newStock,
                  invoiceId,
                  `idemp_pur_${invoiceId}_${calced.itemId}`,
                  now
                ]
              );
            }
          }
        }
      });

      return sendJson(res, 200, { success: true, invoiceId, wasAlreadyApproved });
    }

    // DELETE DRAFT PURCHASE INVOICE
    if (url.startsWith('/api/invoices/') && method === 'DELETE') {
      const invoiceId = url.replace('/api/invoices/', '').trim();
      const existingInv = queryOne(`SELECT invoice_id, status FROM purchase_invoices WHERE invoice_id = ?;`, [invoiceId]);
      if (!existingInv) {
        return sendJson(res, 404, { error: 'NOT_FOUND', message: 'فاتورة التوريد غير موجودة' });
      }
      if (existingInv.status === 'approved') {
        return sendJson(res, 400, {
          error: 'CANNOT_DELETE_APPROVED',
          message: 'لا يمكن حذف فاتورة معتمدة رحلت إلى المخزون؛ استخدم إجراء العكس أو التسوية المعتمدة.'
        });
      }

      await runTransaction(() => {
        runSql(`DELETE FROM purchase_invoice_items WHERE invoice_id = ?;`, [invoiceId]);
        runSql(`DELETE FROM purchase_invoices WHERE invoice_id = ?;`, [invoiceId]);
      });

      return sendJson(res, 200, { success: true, deletedInvoiceId: invoiceId });
    }

    // INGEST PURCHASE INVOICE DRAFT (LOOPBACK & WORKER RESTRICTED)
    if (url === '/api/ingest/invoice' && method === 'POST') {
      return handleIngestInvoice(req, res, { DB, runSql, queryOne, queryAll, runTransaction, saveDatabase, sendJson, parseJsonBody });
    }

    // UNIFIED ADMIN CONTROL API (TELEGRAM BOT & MANAGEMENT BRIDGE)
    if (url.startsWith('/api/admin/')) {
      return handleAdminApi(req, res, { DB, runSql, queryOne, queryAll, runTransaction, saveDatabase, sendJson, parseJsonBody });
    }

    // CREATE POS ORDER & DEDUCT STOCK
    if (url === '/api/orders' && method === 'POST') {
      const data = await parseJsonBody(req);
      const now = new Date().toISOString();
      const orderId = data.id || `ord_${crypto.randomUUID()}`;
      const orderNumber = data.orderNumber || `ORD-${Date.now().toString().slice(-4)}`;

      if (!Array.isArray(data.items) || data.items.length === 0) return sendJson(res, 400, { error: 'EMPTY_ORDER' });
      try {
        for (const item of data.items) resolveServingSize(item.servingSize);
        calculateIngredientNeeds(data.items,
          productId => queryOne(`SELECT recipe_id, recipe_method, batch_yield_ml FROM recipes WHERE product_id = ? AND status = 'active';`, [productId]),
          recipeId => queryAll(`SELECT * FROM recipe_ingredients WHERE recipe_id = ?;`, [recipeId]));
      } catch (error) {
        return sendJson(res, 400, { error: error.message });
      }

      const needs = calculateIngredientNeeds(data.items,
        productId => queryOne(`SELECT recipe_id, recipe_method, batch_yield_ml FROM recipes WHERE product_id = ? AND status = 'active';`, [productId]),
        recipeId => queryAll(`SELECT * FROM recipe_ingredients WHERE recipe_id = ?;`, [recipeId]));

      await runTransaction(() => {
        runSql(
          `INSERT INTO orders (order_id, order_number, branch_id, order_source, order_type, order_status, payment_status, preparation_status, subtotal, discount_amount, delivery_fee, total_amount, cashier_id, shift_id, created_at)
           VALUES (?, ?, 'branch_downtown_cairo', 'pos', ?, 'pending', 'pending', 'queued', ?, ?, ?, ?, ?, ?, ?);`,
          [
            orderId,
            orderNumber,
            data.orderType || 'takeaway',
            Number(data.subtotal || 0),
            Number(data.discountAmount || 0),
            Number(data.deliveryFee || 0),
            Number(data.totalAmount || 0),
            data.cashierId || 'cashier',
            data.shiftId || null,
            now
          ]
        );

        if (Array.isArray(data.items)) {
          for (const itm of data.items) {
            const oiId = itm.id || `oi_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const sizeId = resolveServingSize(itm.servingSize).sizeId;

            runSql(
              `INSERT INTO order_items (order_item_id, order_id, product_id, size_id, unit_price, quantity, total_price)
               VALUES (?, ?, ?, ?, ?, ?, ?);`,
              [oiId, orderId, itm.productId, sizeId, Number(itm.unitPrice || 0), Number(itm.quantity || 1), Number(itm.totalPrice || 0)]
            );

          }
        }
        for (const [ingredientId, need] of needs) {
          const inv = queryOne(`SELECT stock_quantity, weighted_average_cost FROM branch_inventory WHERE branch_id = 'branch_downtown_cairo' AND ingredient_id = ?;`, [ingredientId]);
          if (!inv || Number(inv.stock_quantity) + 1e-9 < need.quantity) throw new Error('INSUFFICIENT_STOCK');
          const newStock = Number(inv.stock_quantity) - need.quantity;
          runSql(`UPDATE branch_inventory SET stock_quantity = ?, updated_at = ? WHERE branch_id = 'branch_downtown_cairo' AND ingredient_id = ?;`, [newStock, now, ingredientId]);
          runSql(`INSERT INTO inventory_movements (movement_id, branch_id, ingredient_id, movement_type, quantity, unit, unit_cost, total_cost, balance_after, reference_type, reference_id, user_id, idempotency_key, created_at)
            VALUES (?, 'branch_downtown_cairo', ?, 'sale_deduction', ?, ?, ?, ?, ?, 'order', ?, ?, ?, ?);`,
            [`mvt_ord_${orderId}_${ingredientId}`, ingredientId, -need.quantity, need.unit,
              Number(inv.weighted_average_cost) || 0, need.quantity * (Number(inv.weighted_average_cost) || 0),
              newStock, orderId, data.cashierId || 'cashier', `idemp_ord_${orderId}_${ingredientId}`, now]);
        }
      });

      return sendJson(res, 200, { success: true, orderId, orderNumber });
    }

    // RECORD PAYMENT & UPDATE SHIFT
    if (url === '/api/payments' && method === 'POST') {
      const data = await parseJsonBody(req);
      const now = new Date().toISOString();
      const paymentId = data.id || `pay_${Date.now()}`;
      const amount = Number(data.amount || 0);

      let feeAmount = 0;
      if (data.method === 'card') {
        feeAmount = Math.round((amount * 0.015 * 1.14) * 100) / 100; // 1.5% + 14% VAT
      }

      await runTransaction(() => {
        runSql(
          `INSERT INTO payment_records (payment_id, order_id, shift_id, payment_method, gross_amount, fee_amount, net_amount, payment_status, cashier_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'verified', ?, ?);`,
          [paymentId, data.orderId, data.shiftId || 'shift_default', data.method || 'cash', amount, feeAmount, amount - feeAmount, data.cashierId || 'cashier', now]
        );

        runSql(`UPDATE orders SET payment_status = 'paid', paid_at = ? WHERE order_id = ?;`, [now, data.orderId]);

        if (data.shiftId) {
          if (data.method === 'cash') {
            runSql(
              `UPDATE cashier_shifts SET cash_sales = cash_sales + ?, expected_cash = expected_cash + ? WHERE shift_id = ?;`,
              [amount, amount, data.shiftId]
            );
          } else {
            runSql(
              `UPDATE cashier_shifts SET electronic_sales = electronic_sales + ? WHERE shift_id = ?;`,
              [amount, data.shiftId]
            );
          }
        }
      });

      return sendJson(res, 200, { success: true, paymentId, feeAmount, netAmount: amount - feeAmount });
    }

    // OPEN SHIFT
    if (url === '/api/shifts/open' && method === 'POST') {
      const data = await parseJsonBody(req);
      const now = new Date().toISOString();
      const shiftId = data.id || `shift_${Date.now()}`;
      const floatVal = Number(data.openingFloat !== undefined ? data.openingFloat : 500);

      runSql(
        `INSERT INTO cashier_shifts (shift_id, shift_number, branch_id, cashier_id, opened_at, status, opening_float, cash_sales, electronic_sales, cash_refunds, cash_expenses, expected_cash, discrepancy)
         VALUES (?, ?, 'branch_downtown_cairo', ?, ?, 'open', ?, 0, 0, 0, 0, ?, 0);`,
        [shiftId, Number(data.shiftNumber || 1), data.cashierId || 'cashier', now, floatVal, floatVal]
      );

      return sendJson(res, 200, { success: true, shiftId });
    }

    // CLOSE SHIFT
    if (url === '/api/shifts/close' && method === 'POST') {
      const data = await parseJsonBody(req);
      const now = new Date().toISOString();
      const shift = queryOne(`SELECT opening_float, cash_sales, cash_refunds, cash_expenses FROM cashier_shifts WHERE shift_id = ?;`, [data.shiftId]);

      if (!shift) {
        return sendJson(res, 404, { error: 'SHIFT_NOT_FOUND', message: 'الوردية غير موجودة.' });
      }

      const expected = Number(shift.opening_float) + Number(shift.cash_sales) - Number(shift.cash_refunds) - Number(shift.cash_expenses);
      const actual = Number(data.actualCashCounted || 0);
      const disc = Math.round((actual - expected) * 100) / 100;

      runSql(
        `UPDATE cashier_shifts SET
           status = 'closed',
           closed_at = ?,
           expected_cash = ?,
           actual_cash_counted = ?,
           discrepancy = ?,
           reconciliation_notes = ?
         WHERE shift_id = ?;`,
        [now, expected, actual, disc, data.notes || null, data.shiftId]
      );

      return sendJson(res, 200, { success: true, expectedCash: expected, actualCash: actual, discrepancy: disc });
    }

    // UNHANDLED API ROUTE
    return sendJson(res, 404, { error: 'NOT_FOUND', message: `Route ${method} ${url} not found.` });

  } catch (err) {
    console.error('API Error:', err.message);
    if (err.message === 'SYSTEM_ALREADY_INITIALIZED') {
      return sendJson(res, 400, { error: 'SYSTEM_ALREADY_INITIALIZED', message: 'حساب المالك تم تأسيسه بالفعل.' });
    }
    return sendJson(res, 500, { error: 'INTERNAL_SERVER_ERROR', message: err.message });
  }
}

// ---------------------------------------------------------------------------
// 5. SERVER CREATION & STATIC / SPA FALLBACK
// ---------------------------------------------------------------------------
const server = http.createServer(async (req, res) => {
  const db = await getDatabase();

  // Route API calls
  if (req.url.startsWith('/api/')) {
    return handleApiRequest(req, res, db);
  }

  // Static files and SPA fallback
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/' || reqPath === '') {
    reqPath = '/index.html';
  }

  let filePath = path.join(DIST_DIR, reqPath);
  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Error loading ' + reqPath);
        return;
      }
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content);
    });
  });
});

server.on('error', (err) => {
  console.error('SERVER ERROR:', err);
});

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('UNHANDLED REJECTION:', reason);
});

let workerProcess = null;
function startTelegramWorkerIfConfigured() {
  const workerScript = path.join(__dirname, 'integrations', 'telegram', 'worker.py');
  if (!fs.existsSync(workerScript)) return;
  if (process.env.ENABLE_TELEGRAM_WORKER === 'true' || process.env.APPS_SCRIPT_URL) {
    try {
      const pythonBin = process.env.PYTHON_BIN || (fs.existsSync('C:\\Users\\MR.X\\.local\\bin\\python3.12.exe') ? 'C:\\Users\\MR.X\\.local\\bin\\python3.12.exe' : 'python');
      console.log(`[Worker] Starting background Telegram sync worker with ${pythonBin}...`);
      workerProcess = spawn(pythonBin, [workerScript], {
        stdio: 'inherit',
        windowsHide: true,
        env: { ...process.env }
      });
      workerProcess.on('error', (err) => {
        console.error('[Worker] Process error (POS continuing):', err.message);
      });
      workerProcess.on('exit', (code, signal) => {
        console.log(`[Worker] Exited with code ${code}, signal ${signal}`);
      });
    } catch (err) {
      console.error('[Worker] Failed to launch worker process:', err.message);
    }
  }
}

process.on('SIGINT', () => {
  if (workerProcess) workerProcess.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  if (workerProcess) workerProcess.kill();
  process.exit(0);
});

server.listen(PORT, process.env.FRUIT_CITY_DEV_PORT ? '127.0.0.1' : '0.0.0.0', async () => {
  await getDatabase();
  const isFirstRun = checkIsFirstRun();
  console.log(`=======================================================`);
  console.log(`FRUIT CITY LOCAL BACKEND + POS ACTIVE`);
  console.log(`URL: http://localhost:${PORT}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`First-Run Setup Required: ${isFirstRun}`);
  console.log(`=======================================================`);
  if (process.env.FC_DEV_ORDER_BRIDGE_URL) {
    await startPosWorker({
      writer: {branchId:process.env.FC_DEV_BRANCH_ID,transaction:runTransaction,run:runSql,one:queryOne,all:queryAll},
      baseUrl:process.env.FC_DEV_ORDER_BRIDGE_URL,token:process.env.FC_DEV_BRIDGE_TOKEN,
      onStatus:status=>{if(!status.ok)console.warn('[web orders] Sync pending; retry scheduled');}
    });
  }
  startTelegramWorkerIfConfigured();
});
