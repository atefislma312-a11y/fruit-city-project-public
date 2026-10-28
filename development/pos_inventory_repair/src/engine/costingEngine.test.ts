import { describe, it, expect } from 'vitest';
import {
  calculateBaseUnitCost,
  calculateRecipeItemCost,
  calculateBatchCost,
  calculateRawCostPerLiter,
  calculateServingBreakdown,
  calculateBreakEvenUnits,
  roundMoney
} from './costingEngine';
import { Ingredient, Recipe } from '../types';

describe('Fruit City Costing Engine', () => {
  // Test Ingredients
  const mockIngredients: Record<string, Ingredient> = {
    guava: {
      id: 'guava',
      nameAr: 'جوافة',
      nameEn: 'Guava',
      category: 'فواكه طازجة',
      purchaseUnit: 'kg',
      packageSize: 1,
      currentPrice: 35, // 35 EGP/kg
      pricePerBaseUnit: 0.035,
      baseUnit: 'g',
      lastUpdated: '2026-10-11',
      priceHistory: [],
      usableYieldPercent: 100,
      wastePercentage: 0,
      isMeasured: true
    },
    strawberry: {
      id: 'strawberry',
      nameAr: 'فراولة',
      nameEn: 'Strawberry',
      category: 'فواكه طازجة',
      purchaseUnit: 'kg',
      packageSize: 1,
      currentPrice: 50, // 50 EGP/kg
      pricePerBaseUnit: 0.05,
      baseUnit: 'g',
      lastUpdated: '2026-10-11',
      priceHistory: [],
      usableYieldPercent: 100,
      wastePercentage: 0,
      isMeasured: true
    },
    sugar: {
      id: 'sugar',
      nameAr: 'سكر',
      nameEn: 'Sugar',
      category: 'سكريات ومحليات',
      purchaseUnit: 'kg',
      packageSize: 1,
      currentPrice: 35, // 35 EGP/kg
      pricePerBaseUnit: 0.035,
      baseUnit: 'g',
      lastUpdated: '2026-10-11',
      priceHistory: [],
      usableYieldPercent: 100,
      wastePercentage: 0,
      isMeasured: true
    },
    mango: {
      id: 'mango',
      nameAr: 'مانجو',
      nameEn: 'Mango',
      category: 'فواكه طازجة',
      purchaseUnit: 'kg',
      packageSize: 1,
      currentPrice: 60, // 60 EGP/kg
      pricePerBaseUnit: 0.06,
      baseUnit: 'g',
      lastUpdated: '2026-10-11',
      priceHistory: [],
      usableYieldPercent: 100,
      wastePercentage: 0,
      isMeasured: true
    },
    orange: {
      id: 'orange',
      nameAr: 'برتقال',
      nameEn: 'Orange',
      category: 'فواكه طازجة',
      purchaseUnit: 'kg',
      packageSize: 1,
      currentPrice: 20, // 20 EGP/kg
      pricePerBaseUnit: 0.02,
      baseUnit: 'g',
      lastUpdated: '2026-10-11',
      priceHistory: [],
      usableYieldPercent: 100,
      wastePercentage: 0,
      isMeasured: true
    },
    sugarcane: {
      id: 'sugarcane',
      nameAr: 'قصب سكر',
      nameEn: 'Sugarcane',
      category: 'فواكه طازجة',
      purchaseUnit: 'bundle',
      packageSize: 8, // 8 stalks per bundle
      currentPrice: 30, // 30 EGP per bundle
      pricePerBaseUnit: 3.75, // 3.75 EGP per stalk
      baseUnit: 'piece',
      lastUpdated: '2026-10-11',
      priceHistory: [],
      usableYieldPercent: 100,
      wastePercentage: 0,
      isMeasured: false
    }
  };

  it('correctly calculates sugarcane bundle unit cost (8 stalks per 30 EGP bundle)', () => {
    const costPerStalk = calculateBaseUnitCost(mockIngredients.sugarcane);
    expect(costPerStalk).toBe(3.75);

    const oneStalkCost = calculateRecipeItemCost(1, 'piece', mockIngredients.sugarcane);
    expect(oneStalkCost).toBe(3.75);
  });

  it('correctly calculates Strawberry recipe costs matching verified dashboard numbers', () => {
    // 1.5 kg strawberry + 200 g sugar -> 2000 ml final yield
    const strawberryRecipe: Recipe = {
      id: 'recipe_strawberry',
      productId: 'prod_strawberry',
      nameAr: 'فراولة',
      method: 'batch',
      ingredients: [
        { ingredientId: 'strawberry', quantity: 1.5, unit: 'kg' },
        { ingredientId: 'sugar', quantity: 200, unit: 'g' }
      ],
      batchYieldMl: 2000,
      isComplete: true,
      hasAddedSugar: true,
      lastUpdated: '2026-10-11'
    };

    const { totalCost } = calculateBatchCost(strawberryRecipe, mockIngredients);
    // 1.5 * 50 = 75; 0.2 * 35 = 7 -> Total = 82 EGP
    expect(totalCost).toBe(82);

    const rawCostPerLiter = calculateRawCostPerLiter(totalCost, strawberryRecipe.batchYieldMl);
    // 82 / 2 = 41 EGP/L
    expect(rawCostPerLiter).toBe(41);

    // 400 ml serving: 0.4 * 41 = 16.40 EGP raw + 4 EGP packaging = 20.40 EGP cost
    // Selling price: 40 EGP -> Contribution = 19.60 EGP
    const serving400ml = calculateServingBreakdown({
      sizeLabel: '400ml',
      servingMl: 400,
      rawCostPerLiter,
      packagingCost: 4,
      sellingPrice: 40,
      isComplete: true
    });
    expect(serving400ml.rawMaterialCost).toBe(16.4);
    expect(serving400ml.directVariableCost).toBe(20.4);
    expect(serving400ml.contribution).toBe(19.6); // Matches picture: 19.60 ج!
    expect(serving400ml.contributionMarginPercent).toBe(49);

    // 1 Liter serving: 41 EGP raw + 6 EGP packaging = 47 EGP cost
    // Selling price: 70 EGP -> Contribution = 23.00 EGP
    const serving1L = calculateServingBreakdown({
      sizeLabel: '1L',
      servingMl: 1000,
      rawCostPerLiter,
      packagingCost: 6,
      sellingPrice: 70,
      isComplete: true
    });
    expect(serving1L.rawMaterialCost).toBe(41);
    expect(serving1L.directVariableCost).toBe(47);
    expect(serving1L.contribution).toBe(23); // Matches picture: 23.00 ج!
  });

  it('correctly calculates Mango recipe costs matching verified dashboard numbers', () => {
    // 1 kg mango + 150 g sugar -> 1200 ml yield
    const mangoRecipe: Recipe = {
      id: 'recipe_mango',
      productId: 'prod_mango',
      nameAr: 'مانجو',
      method: 'batch',
      ingredients: [
        { ingredientId: 'mango', quantity: 1, unit: 'kg' },
        { ingredientId: 'sugar', quantity: 150, unit: 'g' }
      ],
      batchYieldMl: 1200,
      isComplete: true,
      hasAddedSugar: true,
      lastUpdated: '2026-10-11'
    };

    const { totalCost } = calculateBatchCost(mangoRecipe, mockIngredients);
    // 1 * 60 = 60; 0.15 * 35 = 5.25 -> Total = 65.25 EGP
    expect(totalCost).toBe(65.25);

    const rawCostPerLiter = calculateRawCostPerLiter(totalCost, mangoRecipe.batchYieldMl);
    // 65.25 / 1.2 = 54.38 EGP/L
    expect(rawCostPerLiter).toBe(54.38);

    // 400 ml serving: 0.4 * 54.38 = 21.75 EGP raw + 4 packaging = 25.75 EGP cost
    // Selling price: 50 EGP -> Contribution = 24.25 EGP!
    const serving400ml = calculateServingBreakdown({
      sizeLabel: '400ml',
      servingMl: 400,
      rawCostPerLiter,
      packagingCost: 4,
      sellingPrice: 50,
      isComplete: true
    });
    expect(serving400ml.rawMaterialCost).toBe(21.75);
    expect(serving400ml.directVariableCost).toBe(25.75);
    expect(serving400ml.contribution).toBe(24.25); // Matches picture: 24.25 ج!

    // 1 Liter serving: 54.38 raw + 6 packaging = 60.38 cost
    // Selling price: 90 EGP -> Contribution = 29.62 EGP (~29.63 ج in picture)
    const serving1L = calculateServingBreakdown({
      sizeLabel: '1L',
      servingMl: 1000,
      rawCostPerLiter,
      packagingCost: 6,
      sellingPrice: 90,
      isComplete: true
    });
    expect(serving1L.contribution).toBeCloseTo(29.62, 1);
  });

  it('handles usable yield percentage & peeling waste correctly', () => {
    const unpeeledMango: Ingredient = {
      ...mockIngredients.mango,
      usableYieldPercent: 70, // 30% peeling and pit waste
      wastePercentage: 30
    };

    // Purchased at 60 EGP/kg. With 70% yield, effective edible cost per kg = 60 / 0.7 = 85.71 EGP/kg
    const baseCostPerGram = calculateBaseUnitCost(unpeeledMango);
    expect(roundMoney(baseCostPerGram * 1000)).toBe(85.71);
  });

  it('calculates monthly break-even units against 61,050 EGP budget', () => {
    const monthlyBudget = 61050;
    const avgContribution = 22.0; // average EGP per cup
    const breakEvenCups = calculateBreakEvenUnits(monthlyBudget, avgContribution);

    expect(breakEvenCups).toBe(2775); // 2775 cups * 22 = 61,050 EGP
  });
});
