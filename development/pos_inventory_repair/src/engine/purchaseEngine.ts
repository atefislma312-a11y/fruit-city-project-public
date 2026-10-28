import { PurchaseInvoiceItem, PurchaseInvoice } from '../types';
import { roundMoney } from './costingEngine';

export const WASTE_TYPES = {
  PEELING_PREP: 'peeling_prep',
  SPOILAGE_DAMAGE: 'spoilage_damage',
  INVENTORY_DISCREPANCY: 'inventory_variance'
} as const;

export function roundWeight(val: number | string | undefined | null): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 1000) / 1000;
}

export function roundPercent(val: number | string | undefined | null): number {
  const n = Number(val);
  if (!Number.isFinite(n)) return 0;
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Calculates the total cost for a single purchase invoice line item.
 */
export function calculatePurchaseItemTotal(item: Partial<PurchaseInvoiceItem>): number {
  const pricingMethod = item.pricingMethod || 'by_weight';
  const unitPrice = Number(item.unitPrice) || 0;
  const packageCount = Number(item.packageCount) || 1;
  const packageFee = Number(item.packageFee) || 0;
  const feeTotal = packageFee > 0 ? roundMoney(packageCount * packageFee) : 0;

  if (pricingMethod === 'by_weight') {
    const totalWeightKg = Number(item.totalWeightKg) || 0;
    const baseCost = roundMoney(totalWeightKg * unitPrice);
    return roundMoney(baseCost + feeTotal);
  }

  if (pricingMethod === 'by_package') {
    const baseCost = roundMoney(packageCount * unitPrice);
    return roundMoney(baseCost + feeTotal);
  }

  if (pricingMethod === 'by_piece') {
    const baseCost = roundMoney(packageCount * unitPrice);
    return roundMoney(baseCost + feeTotal);
  }

  return 0;
}

/**
 * Calculates the effective price per kilogram for an item,
 * or returns null if weight is unmeasured.
 */
export function calculateEffectiveKgPrice(item: Partial<PurchaseInvoiceItem>): number | null {
  const totalWeightKg = Number(item.totalWeightKg);
  const packageFee = Number(item.packageFee) || 0;

  if (item.pricingMethod === 'by_weight') {
    if (packageFee > 0 && totalWeightKg > 0) {
      const totalCost = item.totalCost !== undefined ? item.totalCost : calculatePurchaseItemTotal(item);
      return roundMoney(totalCost / totalWeightKg);
    }
    return Number(item.unitPrice) || 0;
  }

  const totalCost = item.totalCost !== undefined ? item.totalCost : calculatePurchaseItemTotal(item);

  if (totalWeightKg && totalWeightKg > 0) {
    return roundMoney(totalCost / totalWeightKg);
  }

  return null;
}

/**
 * Validates and calculates all 15 fields including peeling waste and effective net usable cost.
 */
export function calculateItemCostsAndWaste(rawItem: Partial<PurchaseInvoiceItem>): PurchaseInvoiceItem {
  const itemName = String(rawItem.ingredientNameAr || rawItem.customIngredientName || 'صنف توريد').trim();
  const pricingMethod = rawItem.pricingMethod || 'by_weight';
  const packageCount = Math.max(1, parseInt(String(rawItem.packageCount || 1), 10));
  const unitPrice = Number(rawItem.unitPrice || 0);
  const packageFee = Number(rawItem.packageFee || 0);

  let totalWeightKg: number | undefined = undefined;
  if (rawItem.totalWeightKg !== undefined && rawItem.totalWeightKg !== null) {
    const w = Number(rawItem.totalWeightKg);
    if (Number.isFinite(w) && w > 0) {
      totalWeightKg = roundWeight(w);
    }
  }

  const totalCost = calculatePurchaseItemTotal({
    ...rawItem,
    pricingMethod,
    packageCount,
    unitPrice,
    packageFee,
    totalWeightKg
  });

  let packageGrossWeight: number | undefined = undefined;
  if (rawItem.packageGrossWeight !== undefined && rawItem.packageGrossWeight !== null) {
    const gw = Number(rawItem.packageGrossWeight);
    if (Number.isFinite(gw) && gw > 0) packageGrossWeight = roundWeight(gw);
  } else if (totalWeightKg !== undefined && packageCount > 0) {
    packageGrossWeight = roundWeight(totalWeightKg / packageCount);
  }

  let weightBeforePeeling: number | undefined = undefined;
  let weightAfterPeeling: number | undefined = undefined;
  let wastePercent: number | undefined = undefined;
  let effectiveNetKgCost: number | undefined = undefined;

  if (rawItem.weightBeforePeeling !== undefined && rawItem.weightBeforePeeling !== null) {
    const wb = Number(rawItem.weightBeforePeeling);
    if (Number.isFinite(wb) && wb > 0) weightBeforePeeling = roundWeight(wb);
  } else if (totalWeightKg !== undefined && rawItem.weightAfterPeeling !== undefined && rawItem.weightAfterPeeling !== null) {
    weightBeforePeeling = totalWeightKg;
  }

  if (rawItem.weightAfterPeeling !== undefined && rawItem.weightAfterPeeling !== null) {
    const wa = Number(rawItem.weightAfterPeeling);
    if (Number.isFinite(wa) && wa >= 0) {
      weightAfterPeeling = roundWeight(wa);
    }
  }

  if (weightBeforePeeling !== undefined && weightAfterPeeling !== undefined && weightBeforePeeling > 0) {
    const wasteWeight = roundWeight(weightBeforePeeling - weightAfterPeeling);
    wastePercent = roundPercent((wasteWeight / weightBeforePeeling) * 100);
    effectiveNetKgCost = weightAfterPeeling > 0 ? roundMoney(totalCost / weightAfterPeeling) : undefined;
  } else if (totalWeightKg !== undefined && totalWeightKg > 0) {
    effectiveNetKgCost = roundMoney(totalCost / totalWeightKg);
  }

  let unitsPerKg = rawItem.unitsPerKg !== undefined ? roundPercent(rawItem.unitsPerKg) : undefined;
  let totalUnits = rawItem.totalUnits !== undefined ? Math.round(Number(rawItem.totalUnits)) : undefined;

  if (unitsPerKg !== undefined && totalWeightKg !== undefined && totalUnits === undefined) {
    totalUnits = Math.round(unitsPerKg * totalWeightKg);
  } else if (totalUnits !== undefined && totalWeightKg !== undefined && unitsPerKg === undefined && totalWeightKg > 0) {
    unitsPerKg = roundPercent(totalUnits / totalWeightKg);
  }

  return {
    id: rawItem.id || `item_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ingredientId: rawItem.ingredientId || 'custom',
    ingredientNameAr: itemName,
    ingredientCategory: rawItem.ingredientCategory || 'فواكه طازجة',
    pricingMethod,
    packageCount,
    packageUnitName: rawItem.packageUnitName || 'كرتونة',
    totalWeightKg,
    unitPrice,
    packageFee,
    totalCost,
    effectiveKgPrice: calculateEffectiveKgPrice({ ...rawItem, totalCost, totalWeightKg }) || undefined,
    unitsPerKg,
    totalUnits,
    packageGrossWeight,
    weightBeforePeeling,
    weightAfterPeeling,
    wastePercent,
    effectiveNetKgCost,
    prepNotes: rawItem.prepNotes,
    customIngredientName: rawItem.customIngredientName,
    weightUnknown: Boolean(rawItem.weightUnknown),
    notes: rawItem.notes
  };
}

/**
 * Calculates the total amount and total weight for an entire purchase invoice.
 */
export function calculateInvoiceTotals(items: PurchaseInvoiceItem[]): {
  totalAmount: number;
  totalWeightKg: number;
} {
  let totalAmount = 0;
  let totalWeightKg = 0;

  for (const item of items) {
    totalAmount += item.totalCost || calculatePurchaseItemTotal(item);
    if (item.totalWeightKg && item.totalWeightKg > 0) {
      totalWeightKg += item.totalWeightKg;
    }
  }

  return {
    totalAmount: roundMoney(totalAmount),
    totalWeightKg: roundMoney(totalWeightKg)
  };
}

/**
 * Calculates Weighted Average Cost (WAC / متوسط التكلفة المرجح)
 */
export function calculateWeightedAverageCost(params: {
  currentStock: number;
  currentPrice: number;
  incomingQuantity: number;
  incomingPrice: number;
}): number {
  const { currentStock, currentPrice, incomingQuantity, incomingPrice } = params;

  if (incomingQuantity <= 0) return currentPrice;
  if (currentStock <= 0) return roundMoney(incomingPrice);

  const totalOldValue = currentStock * currentPrice;
  const totalNewValue = incomingQuantity * incomingPrice;
  const totalQuantity = currentStock + incomingQuantity;

  if (totalQuantity <= 0) return roundMoney(incomingPrice);

  return roundMoney((totalOldValue + totalNewValue) / totalQuantity);
}
