/**
 * Fruit City — Wholesale Market Purchase & Costing Engine
 * Specialized for Souq El Obour (سوق العبور) invoices and rich item lifecycle:
 * - 15-field rich item schema
 * - Variable packaging & gross weight tracking
 * - Explicit peeling/prep waste separation (no assumed ratios)
 * - Effective net usable kg cost calculation
 * - Weighted Average Cost (WAC) updates
 * - Raw receipt text parser
 */

export const WASTE_TYPES = {
  PEELING_PREP: 'peeling_prep',            // هالك تقشير وتجهيز طبيعي (يرفع تكلفة الصافي)
  SPOILAGE_DAMAGE: 'spoilage_damage',        // هالك تلف وعطب أثناء التخزين (يسجل كخسارة)
  INVENTORY_DISCREPANCY: 'inventory_variance' // فروق جرد دوري
};

export const PURCHASE_UNITS = {
  CARTON: 'carton',   // كرتونة
  BUNCH: 'bunch',     // سباطة موز
  CRATE: 'crate',     // قفص
  BAG: 'bag',         // شيكارة / طرد
  KG: 'kg',           // كيلو جرام
  BUNDLE: 'bundle',   // رابطة
  PIECE: 'piece'      // قطعة
};

export function roundMoney(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function roundWeight(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function roundPercent(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function roundCostPerBase(val) {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  if (n > 0 && n < 1.0) {
    return Math.round((n + Number.EPSILON) * 10000) / 10000;
  }
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Validates and calculates all costs, peeling waste, and effective net costs
 * for a single Souq El Obour invoice line item (covering all 15 fields).
 */
export function calculateItemCostsAndWaste(rawItem) {
  if (!rawItem || typeof rawItem !== 'object') {
    throw new Error('بيانات الصنف غير صالحة');
  }

  const itemName = String(rawItem.itemName || rawItem.nameAr || rawItem.customIngredientName || rawItem.name || '').trim();
  if (!itemName) {
    throw new Error('اسم الصنف مطلوب');
  }

  const category = rawItem.category || rawItem.ingredientCategory || 'cat_fresh_fruit';
  const pricingMethod = rawItem.pricingMethod || 'by_weight';
  const purchaseUnit = rawItem.purchaseUnit || rawItem.packageUnitName || 'carton';

  const packageCount = Math.max(1, parseInt(rawItem.packageCount || 1, 10));
  const unitPrice = Number(rawItem.unitPrice || 0);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) {
    throw new Error(`سعر الوحدة غير صالح للصنف ${itemName}`);
  }

  const packageFee = Number(rawItem.packageFee || 0);
  if (!Number.isFinite(packageFee) || packageFee < 0) {
    throw new Error(`قيمة البيعة/المصاريف غير صالحة للصنف ${itemName}`);
  }

  // Weight handling
  let totalWeightKg = null;
  if (rawItem.totalWeightKg !== undefined && rawItem.totalWeightKg !== null) {
    const w = Number(rawItem.totalWeightKg);
    if (Number.isFinite(w) && w > 0) {
      totalWeightKg = roundWeight(w);
    }
  }

  if (pricingMethod === 'by_weight' && (totalWeightKg === null || totalWeightKg <= 0)) {
    throw new Error(`طريقة الشراء بالوزن تتطلب إدخال الوزن الإجمالي بالكيلو للصنف ${itemName}`);
  }

  // Package gross weight (variable weight per box/bunch)
  let packageGrossWeight = null;
  if (rawItem.packageGrossWeight !== undefined && rawItem.packageGrossWeight !== null) {
    const gw = Number(rawItem.packageGrossWeight);
    if (Number.isFinite(gw) && gw > 0) {
      packageGrossWeight = roundWeight(gw);
    }
  } else if (totalWeightKg !== null && packageCount > 0) {
    packageGrossWeight = roundWeight(totalWeightKg / packageCount);
  }

  // Base cost and package fees calculation
  let baseCost = 0;
  if (pricingMethod === 'by_weight') {
    baseCost = roundMoney(totalWeightKg * unitPrice);
  } else {
    baseCost = roundMoney(packageCount * unitPrice);
  }

  const totalPackageFee = roundMoney(packageCount * packageFee);
  const totalCost = roundMoney(baseCost + totalPackageFee);

  // Peeling & Prep Waste Calculation (Explicit measurement only, no assumed ratios!)
  let weightBeforePeeling = null;
  let weightAfterPeeling = null;
  let wastePercent = null;
  let effectiveNetKgCost = null;

  if (rawItem.weightBeforePeeling !== undefined && rawItem.weightBeforePeeling !== null) {
    const wb = Number(rawItem.weightBeforePeeling);
    if (Number.isFinite(wb) && wb > 0) {
      weightBeforePeeling = roundWeight(wb);
    }
  } else if (totalWeightKg !== null && (rawItem.weightAfterPeeling !== undefined && rawItem.weightAfterPeeling !== null)) {
    // If not explicitly set, total gross weight acts as weight before peeling
    weightBeforePeeling = totalWeightKg;
  }

  if (rawItem.weightAfterPeeling !== undefined && rawItem.weightAfterPeeling !== null) {
    const wa = Number(rawItem.weightAfterPeeling);
    if (Number.isFinite(wa)) {
      if (wa < 0) {
        throw new Error(`الوزن بعد التقشير لا يمكن أن يكون سالباً للصنف ${itemName}`);
      }
      if (weightBeforePeeling !== null && wa > weightBeforePeeling) {
        throw new Error(`الوزن بعد التقشير (${wa} كجم) لا يمكن أن يتجاوز الوزن قبل التقشير (${weightBeforePeeling} كجم) للصنف ${itemName}`);
      }
      weightAfterPeeling = roundWeight(wa);
    }
  }

  // Compute waste % and effective net cost ONLY when explicitly measured
  if (weightBeforePeeling !== null && weightAfterPeeling !== null && weightBeforePeeling > 0) {
    const wasteWeightKg = roundWeight(weightBeforePeeling - weightAfterPeeling);
    wastePercent = roundPercent((wasteWeightKg / weightBeforePeeling) * 100);
    effectiveNetKgCost = weightAfterPeeling > 0 ? roundMoney(totalCost / weightAfterPeeling) : null;
  } else if (totalWeightKg !== null && totalWeightKg > 0) {
    // Unpeeled item: effective kg cost is simply total cost / total weight
    effectiveNetKgCost = roundMoney(totalCost / totalWeightKg);
  }

  // Units count & units per kg
  let unitsPerKg = null;
  let totalUnits = null;

  if (rawItem.unitsPerKg !== undefined && rawItem.unitsPerKg !== null) {
    const upk = Number(rawItem.unitsPerKg);
    if (Number.isFinite(upk) && upk > 0) {
      unitsPerKg = roundPercent(upk);
    }
  }

  if (rawItem.totalUnits !== undefined && rawItem.totalUnits !== null) {
    const tu = Number(rawItem.totalUnits);
    if (Number.isFinite(tu) && tu > 0) {
      totalUnits = Math.round(tu);
    }
  }

  if (unitsPerKg !== null && totalWeightKg !== null && totalUnits === null) {
    totalUnits = Math.round(unitsPerKg * totalWeightKg);
  } else if (totalUnits !== null && totalWeightKg !== null && unitsPerKg === null && totalWeightKg > 0) {
    unitsPerKg = roundPercent(totalUnits / totalWeightKg);
  }

  const weightUnknown = Boolean(rawItem.weightUnknown) || (pricingMethod !== 'by_weight' && totalWeightKg === null);

  return {
    itemId: rawItem.itemId || rawItem.id || `pitem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ingredientId: rawItem.ingredientId || 'custom',
    itemName,
    nameAr: itemName,
    category,
    pricingMethod,
    purchaseUnit,
    packageUnitName: rawItem.packageUnitName || purchaseUnit,
    packageCount,
    packageGrossWeight,
    totalWeightKg,
    unitsPerKg,
    totalUnits,
    unitPrice,
    packageFee,
    totalPackageFee,
    totalCost,
    weightBeforePeeling,
    weightAfterPeeling,
    wastePercent,
    effectiveNetKgCost,
    weightUnknown,
    prepNotes: rawItem.prepNotes || rawItem.notes || null,
    notes: rawItem.notes || null
  };
}

/**
 * Calculates summary totals for an entire wholesale purchase invoice.
 */
export function calculateInvoiceTotals(items = []) {
  let totalAmount = 0;
  let totalWeightKg = 0;
  let totalUsableWeightKg = 0;

  for (const itm of items) {
    const calculated = calculateItemCostsAndWaste(itm);
    totalAmount += calculated.totalCost;
    if (calculated.totalWeightKg && calculated.totalWeightKg > 0) {
      totalWeightKg += calculated.totalWeightKg;
    }
    if (calculated.weightAfterPeeling !== null && calculated.weightAfterPeeling > 0) {
      totalUsableWeightKg += calculated.weightAfterPeeling;
    } else if (calculated.totalWeightKg && calculated.totalWeightKg > 0) {
      totalUsableWeightKg += calculated.totalWeightKg;
    }
  }

  return {
    totalAmount: roundMoney(totalAmount),
    totalWeightKg: roundWeight(totalWeightKg),
    totalUsableWeightKg: roundWeight(totalUsableWeightKg),
    itemCount: items.length
  };
}

/**
 * Computes Weighted Average Cost (WAC) and incoming inventory stock update
 * when an approved invoice is committed into inventory.
 * If peeling was performed, incoming inventory receives net usable pulp at effective net cost.
 */
export function calculateIncomingStockAndWac({
  currentStock = 0,
  currentWac = 0,
  item,
  conversionFactor = 1000 // default 1 kg = 1000 g
}) {
  const itm = calculateItemCostsAndWaste(item);

  let incomingBaseQty = 0;
  let incomingPricePerBase = 0;

  // Determine usable incoming quantity
  if (itm.weightAfterPeeling !== null && itm.weightAfterPeeling > 0) {
    // Usable peeled fruit pulp entering stock
    incomingBaseQty = roundWeight(itm.weightAfterPeeling * conversionFactor);
  } else if (itm.pricingMethod === 'by_weight' || (itm.totalWeightKg !== null && itm.totalWeightKg > 0)) {
    // Unpeeled fruit/ingredient by weight
    incomingBaseQty = roundWeight(itm.totalWeightKg * conversionFactor);
  } else {
    // By package or piece (e.g. cups, packaging, bottles)
    incomingBaseQty = roundWeight(itm.packageCount * conversionFactor);
  }

  if (incomingBaseQty <= 0) {
    return {
      incomingBaseQty: 0,
      incomingPricePerBase: 0,
      newStock: currentStock,
      newWac: currentWac
    };
  }

  incomingPricePerBase = itm.totalCost / incomingBaseQty;

  const curStock = Number(currentStock) || 0;
  const curWac = Number(currentWac) || 0;

  let newWac = incomingPricePerBase;
  const newStock = curStock + incomingBaseQty;

  if (curStock > 0 && newStock > 0) {
    newWac = ((curStock * curWac) + (incomingBaseQty * incomingPricePerBase)) / newStock;
  }

  return {
    incomingBaseQty,
    incomingPricePerBase,
    newStock,
    newWac: roundCostPerBase(newWac)
  };
}

/**
 * Robust Raw Text Parser for Egyptian Wholesale Market Invoices (سوق العبور).
 * Parses transcribed voice messages or typed wholesale receipts into structured items.
 */
export function parseRawInvoiceText(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    throw new Error('النص المدخل فارغ');
  }

  const lines = rawText.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

  let supplierName = 'سوق العبور';
  let invoiceDate = new Date().toISOString().split('T')[0];
  let invoiceNumber = null;
  const notes = [];
  const rawItemLines = [];

  for (const line of lines) {
    // Check for supplier
    const supMatch = line.match(/(?:المورد|التاجر|وكالة|معلم|من)\s*[:\-]\s*(.+)/i);
    if (supMatch) {
      supplierName = supMatch[1].trim();
      continue;
    }

    // Check for date
    const dateMatch = line.match(/(?:التاريخ|بتاريخ)\s*[:\-]\s*(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})/i);
    if (dateMatch) {
      const rawDate = dateMatch[1].replace(/\//g, '-');
      const parts = rawDate.split('-');
      if (parts[0].length === 4) {
        invoiceDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else {
        invoiceDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
      continue;
    }

    // Check for invoice number
    const invNoMatch = line.match(/(?:رقم الفاتورة|فاتورة رقم)\s*[:\-]\s*([A-Z0-9\-_]+)/i);
    if (invNoMatch) {
      invoiceNumber = invNoMatch[1].trim();
      continue;
    }

    // Otherwise candidate item line if it has fruit or packaging keywords or numbers
    if (line.match(/(تفاح|موز|فراولة|مانجو|برتقال|ليمون|جوافة|بطيخ|كانتالوب|قصب|سكر|حليب|كوب|أكواب|شيكارة|كرتونة|سباطة|قفص|كجم|كيلو)/i)) {
      rawItemLines.push(line);
    } else {
      notes.push(line);
    }
  }

  const items = [];

  for (let i = 0; i < rawItemLines.length; i++) {
    const line = rawItemLines[i];

    // Detect packaging unit and count
    let packageCount = 1;
    let purchaseUnit = 'carton';
    let pricingMethod = 'by_weight';

    const countMatch = line.match(/^(\d+)\s*(كرتونة|كراتين|سباطة|سبايط|قفص|أقفاص|شيكارة|شكاير|رابطة|روابط|طرد|كوب|علبة|قطعة)?/i);
    if (countMatch) {
      packageCount = parseInt(countMatch[1], 10);
      const uStr = (countMatch[2] || '').toLowerCase();
      if (uStr.includes('سباط')) purchaseUnit = 'bunch';
      else if (uStr.includes('قفص')) purchaseUnit = 'crate';
      else if (uStr.includes('شيكار')) { purchaseUnit = 'bag'; pricingMethod = 'by_package'; }
      else if (uStr.includes('رابط')) { purchaseUnit = 'bundle'; pricingMethod = 'by_piece'; }
      else if (uStr.includes('كوب') || uStr.includes('علب') || uStr.includes('قطع')) { purchaseUnit = 'piece'; pricingMethod = 'by_piece'; }
    } else {
      // Check unit word anywhere
      if (line.includes('سباط')) purchaseUnit = 'bunch';
      else if (line.includes('قفص')) purchaseUnit = 'crate';
      else if (line.includes('شيكار')) { purchaseUnit = 'bag'; pricingMethod = 'by_package'; }
      else if (line.includes('رابط')) { purchaseUnit = 'bundle'; pricingMethod = 'by_piece'; }
    }

    // Extract item name
    let itemName = 'صنف غير محدد';
    const knownNames = [
      'تفاح سكري', 'تفاح أمريكي', 'تفاح إيطالي', 'تفاح بلدي', 'تفاح',
      'موز بلدي', 'موز وليم', 'موز مغربي', 'موز',
      'فراولة بلدي', 'فراولة فريش', 'فراولة',
      'مانجو عويس', 'مانجو فص', 'مانجو زبدية', 'مانجو سكري', 'مانجو كيت', 'مانجو نعومي', 'مانجو',
      'برتقال بلدي', 'برتقال بسرة', 'برتقال سكري', 'برتقال صيفي', 'برتقال',
      'ليمون بلدي', 'ليمون أضاليا', 'ليمون',
      'جوافة بناتي', 'جوافة بلدي', 'جوافة',
      'بطيخ', 'كانتالوب', 'أناناس', 'كيوي', 'أفوكادو',
      'قصب سكر صعيدي', 'قصب سكر', 'قصب',
      'حليب بودرة نيوزيلندي', 'حليب بودرة', 'سكر أبيض', 'شيكارة سكر',
      'أكواب 400 مل', 'أكواب 1 لتر', 'أكواب عصير', 'أكواب'
    ];

    for (const kn of knownNames) {
      if (line.includes(kn)) {
        itemName = kn;
        break;
      }
    }

    // Determine category
    let category = 'cat_fresh_fruit';
    if (itemName.includes('حليب')) {
      category = 'cat_dairy';
    } else if (itemName === 'سكر' || itemName === 'سكر أبيض' || itemName.includes('شيكارة سكر')) {
      category = 'cat_sweeteners';
    } else if (itemName.includes('كوب') || itemName.includes('أكواب')) {
      category = 'cat_packaging';
    } else {
      category = 'cat_fresh_fruit';
    }

    // Extract weight
    let totalWeightKg = null;
    const weightMatch = line.match(/(?:(?:وزن|إجمالي وزن|بوزن)\s*)?(\d+(?:\.\d+)?)\s*(?:كجم|كيلو|كج|ك)(?![ا-ي])/i);
    if (weightMatch) {
      totalWeightKg = parseFloat(weightMatch[1]);
    }

    // Extract unit price
    let unitPrice = 0;
    const priceMatch = line.match(/(?:(?:بسعر|سعر|بـ|بـ |@)\s*(\d+(?:\.\d+)?)\s*(?:ج|جنيه|ج\/كجم|ج\/كرتونة)?)|(?:(\d+(?:\.\d+)?)\s*(?:ج|جنيه|ج\/كجم|ج\/كرتونة))/i);
    if (priceMatch) {
      unitPrice = parseFloat(priceMatch[1] || priceMatch[2]);
    }

    // Extract package fee (بيعة)
    let packageFee = 0;
    const feeMatch = line.match(/(?:بيعة|عمولة|مشال)\s*(\d+(?:\.\d+)?)/i);
    if (feeMatch) {
      packageFee = parseFloat(feeMatch[1]);
    }

    // Extract peeling weights if mentioned (e.g. "وزن قبل التقشير 90 وبعد التقشير 58.5" or "صافي 58.5 كجم")
    let weightBeforePeeling = null;
    let weightAfterPeeling = null;

    const beforePeelMatch = line.match(/(?:قبل التقشير|قائم)\s*(\d+(?:\.\d+)?)/i);
    if (beforePeelMatch) {
      weightBeforePeeling = parseFloat(beforePeelMatch[1]);
    }

    const afterPeelMatch = line.match(/(?:بعد التقشير|صافي بعد التقشير|صافي اللب|صافي)\s*(\d+(?:\.\d+)?)/i);
    if (afterPeelMatch) {
      weightAfterPeeling = parseFloat(afterPeelMatch[1]);
    }

    // Extract total units (e.g. "500 كوب")
    let totalUnits = null;
    const unitsMatch = line.match(/(\d+)\s*(?:كوب|حبة|قطعة)/i);
    if (unitsMatch) {
      totalUnits = parseInt(unitsMatch[1], 10);
    }

    // If by_piece or by_package has high count (>= 50 pieces) and price looks like total batch price
    if (pricingMethod === 'by_piece' && packageCount >= 50 && unitPrice >= 50) {
      totalUnits = packageCount;
      packageCount = 1;
      purchaseUnit = 'carton';
      pricingMethod = 'by_package';
    }

    const item = calculateItemCostsAndWaste({
      itemName,
      category,
      pricingMethod,
      purchaseUnit,
      packageCount,
      totalWeightKg,
      unitPrice,
      packageFee,
      weightBeforePeeling,
      weightAfterPeeling,
      totalUnits,
      notes: line
    });

    items.push(item);
  }

  const totals = calculateInvoiceTotals(items);

  return {
    supplierName,
    invoiceDate,
    invoiceNumber: invoiceNumber || `INV-${invoiceDate.replace(/-/g, '')}-${Math.floor(100 + Math.random() * 900)}`,
    notes: notes.join(' | ') || null,
    items,
    totalAmount: totals.totalAmount,
    totalWeightKg: totals.totalWeightKg,
    totalUsableWeightKg: totals.totalUsableWeightKg,
    status: 'draft'
  };
}
