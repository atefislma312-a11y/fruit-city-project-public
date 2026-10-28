import { describe, it, expect } from 'vitest';
import {
  calculatePurchaseItemTotal,
  calculateEffectiveKgPrice,
  calculateInvoiceTotals,
  calculateWeightedAverageCost
} from './purchaseEngine';
import { PurchaseInvoiceItem } from '../types';

describe('Fruit City Purchase Management Engine', () => {

  it('Scenario 1: Banana sold by weight (2 bunches, TOTAL 90 kg, 30 EGP/kg = 2700 EGP)', () => {
    const bananaItem: Partial<PurchaseInvoiceItem> = {
      ingredientNameAr: 'موز بلدي',
      pricingMethod: 'by_weight',
      packageCount: 2, // 2 bunches
      packageUnitName: 'سباطة',
      totalWeightKg: 90, // TOTAL net weight of both bunches
      unitPrice: 30 // EGP per kg
    };

    const total = calculatePurchaseItemTotal(bananaItem);
    // MUST NOT multiply by 2 again! 90 kg * 30 EGP = 2700 EGP
    expect(total).toBe(2700);

    const effectiveKgPrice = calculateEffectiveKgPrice(bananaItem);
    expect(effectiveKgPrice).toBe(30);
  });

  it('Scenario 2: Two packages with a combined weight of 90 kg', () => {
    const strawberryItem: Partial<PurchaseInvoiceItem> = {
      ingredientNameAr: 'فراولة',
      pricingMethod: 'by_weight',
      packageCount: 2, // 2 crates
      packageUnitName: 'قفص',
      totalWeightKg: 90,
      unitPrice: 50 // 50 EGP/kg
    };

    const total = calculatePurchaseItemTotal(strawberryItem);
    expect(total).toBe(4500); // 90 * 50 = 4500 EGP
  });

  it('Scenario 3: Carton sold at fixed price without inventing kg weight', () => {
    const vanillaCrates: Partial<PurchaseInvoiceItem> = {
      ingredientNameAr: 'كرتونة فانيليا بودرة',
      pricingMethod: 'by_package',
      packageCount: 4,
      packageUnitName: 'كرتونة',
      unitPrice: 500, // 500 EGP per carton
      totalWeightKg: undefined // Weight is unknown / unmeasured
    };

    const total = calculatePurchaseItemTotal(vanillaCrates);
    expect(total).toBe(2000); // 4 * 500 = 2000 EGP

    const effectiveKgPrice = calculateEffectiveKgPrice(vanillaCrates);
    // Weight was not entered, so cost per kg must be null / unavailable
    expect(effectiveKgPrice).toBeNull();
  });

  it('Scenario 4: Item sold by piece or bundle (Sugarcane 5 bundles @ 30 EGP)', () => {
    const sugarcaneItem: Partial<PurchaseInvoiceItem> = {
      ingredientNameAr: 'قصب سكر',
      pricingMethod: 'by_piece',
      packageCount: 5,
      packageUnitName: 'رابطة',
      unitPrice: 30 // 30 EGP per bundle
    };

    const total = calculatePurchaseItemTotal(sugarcaneItem);
    expect(total).toBe(150); // 5 * 30 = 150 EGP
  });

  it('Scenario 5: Multi-item invoice totals calculation', () => {
    const items: PurchaseInvoiceItem[] = [
      {
        id: '1',
        ingredientId: 'ing_banana',
        ingredientNameAr: 'موز',
        ingredientCategory: 'فواكه طازجة',
        pricingMethod: 'by_weight',
        packageCount: 2,
        totalWeightKg: 90,
        unitPrice: 30,
        totalCost: 2700
      },
      {
        id: '2',
        ingredientId: 'ing_orange',
        ingredientNameAr: 'برتقال',
        ingredientCategory: 'فواكه طازجة',
        pricingMethod: 'by_weight',
        packageCount: 5,
        totalWeightKg: 100,
        unitPrice: 20,
        totalCost: 2000
      },
      {
        id: '3',
        ingredientId: 'ing_sugarcane',
        ingredientNameAr: 'قصب سكر',
        ingredientCategory: 'فواكه طازجة',
        pricingMethod: 'by_piece',
        packageCount: 10,
        unitPrice: 30,
        totalCost: 300
      }
    ];

    const { totalAmount, totalWeightKg } = calculateInvoiceTotals(items);
    expect(totalAmount).toBe(5000); // 2700 + 2000 + 300 = 5000 EGP
    expect(totalWeightKg).toBe(190); // 90 + 100 = 190 kg
  });

  it('Scenario 6: Weighted Average Cost (WAC) valuation method', () => {
    // Current stock: 50 kg @ 40 EGP
    // Incoming purchase: 90 kg @ 30 EGP
    // Total value = 2000 + 2700 = 4700 EGP
    // Total quantity = 140 kg
    // WAC = 4700 / 140 = 33.57 EGP
    const wac = calculateWeightedAverageCost({
      currentStock: 50,
      currentPrice: 40,
      incomingQuantity: 90,
      incomingPrice: 30
    });

    expect(wac).toBe(33.57);

    // If initial stock was 0, WAC equals the incoming invoice price
    const wacZeroStock = calculateWeightedAverageCost({
      currentStock: 0,
      currentPrice: 40,
      incomingQuantity: 90,
      incomingPrice: 30
    });

    expect(wacZeroStock).toBe(30);
  });

  it('Scenario 7: Market fee (البيعة) for single carton of apples (1 carton, 15 kg @ 53 EGP + 10 EGP fee = 805 EGP)', () => {
    const appleItem: Partial<PurchaseInvoiceItem> = {
      ingredientNameAr: 'تفاح',
      pricingMethod: 'by_weight',
      packageCount: 1,
      packageUnitName: 'كرتونة',
      totalWeightKg: 15,
      unitPrice: 53,
      packageFee: 10 // 10 EGP fee per carton
    };

    const total = calculatePurchaseItemTotal(appleItem);
    // (15 kg * 53) + (1 carton * 10 EGP) = 795 + 10 = 805 EGP
    expect(total).toBe(805);

    // Effective kg price includes the fee: 805 / 15 = 53.67 EGP/kg
    const effectiveKg = calculateEffectiveKgPrice(appleItem);
    expect(effectiveKg).toBe(53.67);
  });

  it('Scenario 8: Market fee (البيعة) for multiple cartons (2 cartons @ 10 EGP = 20 EGP fee + 30 kg @ 53 EGP = 1610 EGP)', () => {
    const multiCartonApples: Partial<PurchaseInvoiceItem> = {
      ingredientNameAr: 'تفاح',
      pricingMethod: 'by_weight',
      packageCount: 2,
      packageUnitName: 'كرتونة',
      totalWeightKg: 30,
      unitPrice: 53,
      packageFee: 10 // 10 EGP fee per carton -> 20 EGP total fee
    };

    const total = calculatePurchaseItemTotal(multiCartonApples);
    // (30 kg * 53) + (2 cartons * 10 EGP) = 1590 + 20 = 1610 EGP
    expect(total).toBe(1610);

    const effectiveKg = calculateEffectiveKgPrice(multiCartonApples);
    expect(effectiveKg).toBe(53.67);
  });

  it('Scenario 9: Idempotency of calculation — repeated recalculation must NEVER double or compound the fee', () => {
    const appleItem: Partial<PurchaseInvoiceItem> = {
      ingredientNameAr: 'تفاح',
      pricingMethod: 'by_weight',
      packageCount: 1,
      packageUnitName: 'كرتونة',
      totalWeightKg: 15,
      unitPrice: 53,
      packageFee: 10
    };

    const total1 = calculatePurchaseItemTotal(appleItem);
    appleItem.totalCost = total1;

    // Simulate editing other attributes or re-evaluating 5 times
    const total2 = calculatePurchaseItemTotal(appleItem);
    const total3 = calculatePurchaseItemTotal(appleItem);
    const total4 = calculatePurchaseItemTotal(appleItem);

    expect(total1).toBe(805);
    expect(total2).toBe(805);
    expect(total3).toBe(805);
    expect(total4).toBe(805);
  });

  it('Scenario 10: Backward compatibility — old items without packageFee or with packageFee=0 never add unexpected fees', () => {
    const oldItemWithoutFee: Partial<PurchaseInvoiceItem> = {
      ingredientNameAr: 'مانجو عويس',
      pricingMethod: 'by_weight',
      packageCount: 3,
      totalWeightKg: 30,
      unitPrice: 70
    };

    expect(calculatePurchaseItemTotal(oldItemWithoutFee)).toBe(2100);

    const oldItemZeroFee: Partial<PurchaseInvoiceItem> = {
      ingredientNameAr: 'مانجو عويس',
      pricingMethod: 'by_weight',
      packageCount: 3,
      totalWeightKg: 30,
      unitPrice: 70,
      packageFee: 0
    };

    expect(calculatePurchaseItemTotal(oldItemZeroFee)).toBe(2100);
  });
});
