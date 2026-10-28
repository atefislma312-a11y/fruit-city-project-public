/**
 * Fruit City — Shared Ingestion Module for Telegram Intake (and other external sources)
 * Handles business validation, canonical content hashing, idempotency, revision ledger,
 * and physical SQLite readback verification.
 */

import crypto from 'crypto';

export function initIngestSchema(DB) {
  // Ensure tables and columns exist for tracking external ingest messages and revisions
  DB.run(`
    CREATE TABLE IF NOT EXISTS ingested_external_messages (
      source_system VARCHAR(50) NOT NULL,
      external_id VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(50) NOT NULL,
      raw_payload TEXT,
      payload_hash VARCHAR(64),
      revision INTEGER DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (source_system, external_id)
    );
  `);

  try { DB.run(`ALTER TABLE ingested_external_messages ADD COLUMN payload_hash VARCHAR(64);`); } catch (e) {}
  try { DB.run(`ALTER TABLE ingested_external_messages ADD COLUMN revision INTEGER DEFAULT 1;`); } catch (e) {}
  try { DB.run(`ALTER TABLE ingested_external_messages ADD COLUMN updated_at TEXT;`); } catch (e) {}

  try { DB.run(`ALTER TABLE purchase_invoices ADD COLUMN revision INTEGER DEFAULT 1;`); } catch (e) {}
  try { DB.run(`ALTER TABLE purchase_invoices ADD COLUMN content_checksum VARCHAR(64);`); } catch (e) {}
  try { DB.run(`ALTER TABLE purchase_invoices ADD COLUMN updated_at TEXT;`); } catch (e) {}
}

export function computeCanonicalPayloadHash(data, processedItems, calculatedTotalAmount, calculatedTotalWeight) {
  const norm = {
    cloud_checksum: data.cloud_checksum ? String(data.cloud_checksum).trim() : null,
    supplier: (data.supplier_name || '').trim(),
    date: (data.invoice_date || '').trim(),
    total: Math.round(Number(calculatedTotalAmount) * 100) / 100,
    weight: Math.round(Number(calculatedTotalWeight) * 1000) / 1000,
    items: processedItems.map(it => ({
      name: it.customIngredientName,
      pricing_method: it.pricingMethod,
      package_count: it.packageCount,
      total_weight_kg: it.totalWeightKg,
      unit_price: it.unitPrice,
      package_fee: it.packageFee,
      total_cost: it.totalCost
    }))
  };
  return crypto.createHash('sha256').update(JSON.stringify(norm)).digest('hex');
}

export function isValidCalendarDate(dateStr) {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return false;
  }
  const d = new Date(year, month - 1, day);
  return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
}

export async function handleIngestInvoice(req, res, context) {
  const { DB, runSql, queryOne, queryAll, runTransaction, sendJson, parseJsonBody } = context;

  // 1. Loopback Restriction (127.0.0.1 / ::1)
  const remoteIp = (req.socket && req.socket.remoteAddress) || '';
  const isLoopback = remoteIp === '127.0.0.1' || remoteIp === '::1' || remoteIp === '::ffff:127.0.0.1';
  if (!isLoopback) {
    return sendJson(res, 403, { error: 'FORBIDDEN', message: 'Ingest endpoint is restricted to loopback interface only.' });
  }

  // 2. Worker Secret Token Authentication
  const configuredWorkerToken = process.env.WORKER_SECRET_TOKEN;
  if (!configuredWorkerToken) {
    return sendJson(res, 500, {
      error: 'SERVER_MISCONFIGURED',
      message: 'WORKER_SECRET_TOKEN is not configured on local server.'
    });
  }

  const providedToken = req.headers['x-worker-token'];
  if (!providedToken || providedToken !== configuredWorkerToken) {
    return sendJson(res, 401, { error: 'UNAUTHORIZED', message: 'Invalid or missing X-Worker-Token.' });
  }

  const data = await parseJsonBody(req);
  const items = Array.isArray(data.items) ? data.items : [];
  if (items.length === 0) {
    return sendJson(res, 400, { error: 'EMPTY_INVOICE_ITEMS', message: 'الفاتورة لا تحتوي على أصناف صالحة.' });
  }

  // 3. Strict Business Rules: Required Supplier, Date, Package Fee, and Totals (No Guessed Defaults!)
  if (!data.supplier_name || typeof data.supplier_name !== 'string' || data.supplier_name.trim().length === 0) {
    return sendJson(res, 400, {
      error: 'MISSING_SUPPLIER_NAME',
      message: 'اسم المورد مطلوب ولا يمكن اعتماد افتراضات غير مصرح بها.'
    });
  }
  const supplierName = data.supplier_name.trim();

  if (!data.invoice_date || typeof data.invoice_date !== 'string') {
    return sendJson(res, 400, {
      error: 'MISSING_INVOICE_DATE',
      message: 'تاريخ الفاتورة مطلوب.'
    });
  }
  if (!isValidCalendarDate(data.invoice_date)) {
    return sendJson(res, 400, {
      error: 'INVALID_INVOICE_DATE',
      message: 'تاريخ الفاتورة غير صالح (يجب أن يكون YYYY-MM-DD وتاريخاً حقيقياً في التقويم).'
    });
  }
  const invoiceDate = data.invoice_date.trim();

  const statedTotal = data.stated_total_amount !== undefined ? data.stated_total_amount : data.total_amount;
  if (statedTotal !== undefined && statedTotal !== null) {
    const stNum = Number(statedTotal);
    if (!Number.isFinite(stNum) || stNum <= 0) {
      return sendJson(res, 400, {
        error: 'INVALID_TOTAL_AMOUNT',
        message: 'إجمالي الفاتورة المذكور يجب أن يكون رقماً موجباً منتهياً.'
      });
    }
  }

  let calculatedTotalAmount = 0;
  let calculatedTotalWeight = 0;
  const processedItems = [];
  const validPricingMethods = ['by_weight', 'by_package', 'by_piece'];

  for (let i = 0; i < items.length; i++) {
    const itm = items[i];
    if (!itm.ingredient_name_ar || typeof itm.ingredient_name_ar !== 'string' || itm.ingredient_name_ar.trim().length === 0) {
      return sendJson(res, 400, { error: 'INVALID_INGREDIENT_NAME', message: 'اسم الصنف مطلوب ويجب ألا يكون فارغاً.' });
    }
    const pkgCount = Number(itm.package_count);
    if (itm.package_count === undefined || itm.package_count === null || !Number.isInteger(pkgCount) || pkgCount <= 0) {
      return sendJson(res, 400, { error: 'MISSING_PACKAGE_COUNT', message: `عدد العبوات مطلوب ويجب أن يكون رقماً صحيحاً موجباً للصنف ${itm.ingredient_name_ar}.` });
    }
    const unitPrice = Number(itm.unit_price);
    if (itm.unit_price === undefined || itm.unit_price === null || !Number.isFinite(unitPrice) || unitPrice <= 0) {
      return sendJson(res, 400, { error: 'MISSING_UNIT_PRICE', message: `سعر الوحدة مطلوب ويجب أن يكون رقماً موجباً منتهياً للصنف ${itm.ingredient_name_ar}.` });
    }

    const pricingMethod = itm.pricing_method || 'by_weight';
    if (!validPricingMethods.includes(pricingMethod)) {
      return sendJson(res, 400, { error: 'INVALID_PRICING_METHOD', message: `طريقة التسعير غير صالحة للصنف ${itm.ingredient_name_ar}.` });
    }

    // Strict Package Fee Rule: EXACTLY 10.00 EGP per container
    if (itm.package_fee_per_unit !== undefined && itm.package_fee_per_unit !== null) {
      const feeVal = Number(itm.package_fee_per_unit);
      if (!Number.isFinite(feeVal) || Math.abs(feeVal - 10.00) > 0.001) {
        return sendJson(res, 400, {
          error: 'INVALID_PACKAGE_FEE',
          message: `قيمة البيعة للعبوة يجب أن تكون بالضبط 10 جنيه لكل عبوة للصنف ${itm.ingredient_name_ar}.`
        });
      }
    }
    const packageFeePerUnit = 10.00;
    const totalPackageFee = Math.round(pkgCount * packageFeePerUnit * 100) / 100;

    let weight = null;
    if (itm.total_weight_kg !== null && itm.total_weight_kg !== undefined) {
      const wNum = Number(itm.total_weight_kg);
      if (!Number.isFinite(wNum) || wNum <= 0) {
        return sendJson(res, 400, { error: 'INVALID_WEIGHT', message: `الوزن غير صالح للصنف ${itm.ingredient_name_ar}.` });
      }
      weight = wNum;
    }

    if (pricingMethod === 'by_weight' && weight === null) {
      return sendJson(res, 400, { error: 'MISSING_WEIGHT', message: `الوزن مطلوب للمشتريات بالوزن للصنف ${itm.ingredient_name_ar}.` });
    }

    let calculatedItemCost = 0;
    let effectiveKgPrice = null;

    if (pricingMethod === 'by_weight') {
      calculatedItemCost = Math.round(((weight * unitPrice) + totalPackageFee) * 100) / 100;
      effectiveKgPrice = Math.round((calculatedItemCost / weight) * 10000) / 10000;
      calculatedTotalWeight += weight;
    } else {
      calculatedItemCost = Math.round(((pkgCount * unitPrice) + totalPackageFee) * 100) / 100;
      if (weight !== null && weight > 0) {
        effectiveKgPrice = Math.round((calculatedItemCost / weight) * 10000) / 10000;
        calculatedTotalWeight += weight;
      }
    }

    // Validate stated item cost if provided
    const statedItemCost = itm.total_cost !== undefined ? itm.total_cost : itm.authoritative_cost;
    if (statedItemCost !== undefined && statedItemCost !== null) {
      if (Math.abs(Number(statedItemCost) - calculatedItemCost) > 0.05) {
        return sendJson(res, 400, {
          error: 'ITEM_TOTAL_MISMATCH',
          message: `إجمالي الصنف ${itm.ingredient_name_ar} المذكور (${statedItemCost} ج.م) لا يطابق المحسوب (${calculatedItemCost} ج.م).`
        });
      }
    }

    calculatedTotalAmount += calculatedItemCost;

    const itemId = itm.id || `pitem_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`;
    processedItems.push({
      itemId,
      ingredientId: itm.ingredient_id || 'custom',
      pricingMethod,
      packageCount: pkgCount,
      packageUnitName: itm.package_unit_name || 'عبوة',
      totalWeightKg: weight,
      unitPrice,
      packageFee: totalPackageFee,
      totalCost: calculatedItemCost,
      effectiveKgPrice,
      weightUnknown: weight === null ? 1 : 0,
      customIngredientName: itm.ingredient_name_ar.trim(),
      notes: itm.notes || null
    });
  }

  calculatedTotalAmount = Math.round(calculatedTotalAmount * 100) / 100;
  calculatedTotalWeight = Math.round(calculatedTotalWeight * 1000) / 1000;

  // Validate stated invoice total against calculated total ONLY when supplied
  if (statedTotal !== undefined && statedTotal !== null) {
    if (Math.abs(Number(statedTotal) - calculatedTotalAmount) > 0.05) {
      return sendJson(res, 400, {
        error: 'INVOICE_TOTAL_MISMATCH',
        message: `إجمالي الفاتورة المذكور (${statedTotal} ج.م) لا يطابق مجموع بنود الفاتورة (${calculatedTotalAmount} ج.م).`
      });
    }
  }

  // Compute canonical full payload / content digest
  const payloadHash = computeCanonicalPayloadHash(data, processedItems, calculatedTotalAmount, calculatedTotalWeight);

  const sourceSystem = data.source_system || 'telegram';
  const externalId = data.idempotency_key || data.queue_id;
  const reqRevision = Number(data.revision !== undefined ? data.revision : 1);

  let invoiceId = null;
  let invoiceNumber = null;
  let isRevisionUpdate = false;

  // 4. Idempotency, Monotonic Revision & Conflict Protection
  if (externalId) {
    const existingMsg = queryOne(
      `SELECT entity_id, raw_payload, payload_hash, revision FROM ingested_external_messages WHERE source_system = ? AND external_id = ?;`,
      [sourceSystem, externalId]
    );

    if (existingMsg) {
      const existingInv = queryOne(`SELECT * FROM purchase_invoices WHERE invoice_id = ?;`, [existingMsg.entity_id]);
      if (!existingInv) {
        return sendJson(res, 500, { error: 'CORRUPTED_LEDGER', message: 'External message points to missing invoice.' });
      }

      const existingRev = Number(existingMsg.revision || 1);

      // (a) Older revision is rejected
      if (reqRevision < existingRev) {
        return sendJson(res, 409, {
          error: 'OLDER_REVISION_REJECTED',
          message: `Cannot commit older revision ${reqRevision} over existing revision ${existingRev}.`
        });
      }

      // (b) Same revision: exact duplicate check vs conflict
      if (reqRevision === existingRev) {
        if (existingMsg.payload_hash && existingMsg.payload_hash !== payloadHash) {
          return sendJson(res, 409, {
            error: 'IDEMPOTENCY_CONFLICT',
            message: 'Duplicate idempotency key and revision with conflicting payload. Increment revision to update.'
          });
        }

        // Exact retry with matching hash: return existing committed draft
        const existingItems = queryAll(
          `SELECT * FROM purchase_invoice_items WHERE invoice_id = ?;`,
          [existingInv.invoice_id]
        );

        return sendJson(res, 200, {
          success: true,
          already_processed: true,
          verified: true,
          invoiceId: existingInv.invoice_id,
          invoiceNumber: existingInv.invoice_number,
          status: existingInv.status,
          revision: existingRev,
          content_checksum: existingMsg.payload_hash,
          cloud_checksum: data.cloud_checksum || null,
          itemCount: existingItems.length,
          totalAmount: Number(existingInv.total_amount),
          totalWeightKg: Number(existingInv.total_weight_kg),
          invoice: existingInv,
          items: existingItems
        });
      }

      // (c) Higher revision: ONLY allowed if existing invoice is still in 'draft' status
      if (existingInv.status !== 'draft') {
        return sendJson(res, 409, {
          error: 'INVOICE_ALREADY_APPROVED',
          message: 'Invoice has already been approved and cannot be modified by external revisions.'
        });
      }

      invoiceId = existingInv.invoice_id;
      invoiceNumber = existingInv.invoice_number;
      isRevisionUpdate = true;
    }
  }

  const now = new Date().toISOString();
  if (!invoiceId) {
    const randIdSuffix = crypto.randomBytes ? crypto.randomBytes(4).toString('hex') : Math.random().toString(36).substring(2, 8);
    invoiceId = `inv_tg_${Date.now()}_${randIdSuffix}`;
  }
  if (!invoiceNumber) {
    const randNumSuffix = crypto.randomBytes ? crypto.randomBytes(3).toString('hex').toUpperCase() : Math.random().toString(36).substring(2, 6).toUpperCase();
    invoiceNumber = `PUR-TG-${Date.now()}-${randNumSuffix}`;
  }

  const notesArr = [];
  if (data.notes) notesArr.push(data.notes);
  const finalNotes = notesArr.length > 0 ? notesArr.join(' | ') : null;

  // Resolve real owner user actor
  const ownerUser = queryOne(`SELECT username FROM users WHERE role_id = 'role_owner' LIMIT 1;`);
  const createdBy = ownerUser ? ownerUser.username : 'owner';

  // 5. Transactional Atomic Commit
  runTransaction(() => {
    if (isRevisionUpdate) {
      runSql(`DELETE FROM purchase_invoice_items WHERE invoice_id = ?;`, [invoiceId]);
      runSql(
        `UPDATE purchase_invoices SET
           supplier_name = ?,
           invoice_date = ?,
           total_amount = ?,
           total_weight_kg = ?,
           notes = ?,
           revision = ?,
           content_checksum = ?,
           updated_at = ?
         WHERE invoice_id = ?;`,
        [
          supplierName,
          invoiceDate,
          calculatedTotalAmount,
          calculatedTotalWeight,
          finalNotes,
          reqRevision,
          payloadHash,
          now,
          invoiceId
        ]
      );

      // Atomically update ledger
      runSql(
        `UPDATE ingested_external_messages SET
           raw_payload = ?,
           payload_hash = ?,
           revision = ?,
           updated_at = ?
         WHERE source_system = ? AND external_id = ?;`,
        [JSON.stringify(data), payloadHash, reqRevision, now, sourceSystem, externalId]
      );
    } else {
      runSql(
        `INSERT INTO purchase_invoices (
           invoice_id, invoice_number, branch_id, supplier_name, invoice_date, status,
           total_amount, total_weight_kg, notes, revision, content_checksum, created_by, created_at, updated_at
         ) VALUES (?, ?, 'branch_downtown_cairo', ?, ?, 'draft', ?, ?, ?, ?, ?, ?, ?, ?);`,
        [
          invoiceId,
          invoiceNumber,
          supplierName,
          invoiceDate,
          calculatedTotalAmount,
          calculatedTotalWeight,
          finalNotes,
          reqRevision,
          payloadHash,
          createdBy,
          now,
          now
        ]
      );

      if (externalId) {
        runSql(
          `INSERT INTO ingested_external_messages (
             source_system, external_id, entity_type, entity_id, raw_payload, payload_hash, revision, created_at, updated_at
           ) VALUES (?, ?, 'purchase_invoice', ?, ?, ?, ?, ?, ?);`,
          [sourceSystem, externalId, invoiceId, JSON.stringify(data), payloadHash, reqRevision, now, now]
        );
      }
    }

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
          itm.effectiveKgPrice,
          itm.weightUnknown,
          itm.customIngredientName,
          itm.notes
        ]
      );
    }
  });

  // 6. Physical SQLite Readback Verification
  const readbackInv = queryOne(`SELECT * FROM purchase_invoices WHERE invoice_id = ?;`, [invoiceId]);
  const readbackItemCount = queryOne(`SELECT count(*) as cnt FROM purchase_invoice_items WHERE invoice_id = ?;`, [invoiceId]);
  const readbackMsg = externalId ? queryOne(
    `SELECT revision, payload_hash FROM ingested_external_messages WHERE source_system = ? AND external_id = ?;`,
    [sourceSystem, externalId]
  ) : null;

  if (!readbackInv || !readbackItemCount || Number(readbackItemCount.cnt) !== processedItems.length) {
    return sendJson(res, 500, {
      error: 'VERIFICATION_FAILED',
      message: 'Failed to verify invoice persistence in SQLite database.'
    });
  }

  return sendJson(res, 200, {
    success: true,
    verified: true,
    invoiceId: readbackInv.invoice_id,
    invoiceNumber: readbackInv.invoice_number,
    status: readbackInv.status,
    revision: readbackMsg ? Number(readbackMsg.revision) : reqRevision,
    content_checksum: readbackMsg ? readbackMsg.payload_hash : payloadHash,
    cloud_checksum: data.cloud_checksum || null,
    itemCount: Number(readbackItemCount.cnt),
    totalAmount: Number(readbackInv.total_amount),
    totalWeightKg: Number(readbackInv.total_weight_kg),
    invoice: readbackInv,
    items: processedItems
  });
}
