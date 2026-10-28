import { Ingredient, Recipe, ServingCostBreakdown, UnitType } from '../types';

/**
 * Rounds a monetary or numeric value safely to 2 decimal places.
 */
export function roundMoney(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Convert quantity from a given unit to the ingredient's base unit (g, ml, or piece).
 */
export function convertToBaseUnit(
  quantity: number,
  unit: UnitType,
  ingredient: Ingredient
): number {
  switch (unit) {
    case 'kg':
      return quantity * 1000; // to grams
    case 'g':
      return quantity;
    case 'l':
      return quantity * 1000; // to ml
    case 'ml':
      return quantity;
    case 'piece':
      return quantity;
    case 'box':
      return quantity * (ingredient.packageSize || 1);
    case 'bag':
      return quantity * (ingredient.packageSize || 1);
    case 'bundle':
      return quantity * (ingredient.packageSize || 1); // e.g. 1 bundle = 8 stalks
    default:
      return quantity;
  }
}

/**
 * Calculate the true cost per base unit (per gram, per ml, or per piece)
 * accounting for purchase unit packaging, package size, and usable yield percentage.
 */
export function calculateBaseUnitCost(ingredient: Ingredient): number {
  let costPerPurchaseBase = 0;

  if (ingredient.purchaseUnit === 'kg') {
    // Current price is per 1 kg -> cost per gram = currentPrice / 1000
    costPerPurchaseBase = ingredient.currentPrice / 1000;
  } else if (ingredient.purchaseUnit === 'g') {
    costPerPurchaseBase = ingredient.currentPrice;
  } else if (ingredient.purchaseUnit === 'l') {
    // Current price is per 1 liter -> cost per ml = currentPrice / 1000
    costPerPurchaseBase = ingredient.currentPrice / 1000;
  } else if (ingredient.purchaseUnit === 'ml') {
    costPerPurchaseBase = ingredient.currentPrice;
  } else if (ingredient.purchaseUnit === 'bundle') {
    // Current price is per bundle of packageSize pieces (e.g. 30 EGP for 8 stalks)
    const pieces = ingredient.packageSize > 0 ? ingredient.packageSize : 1;
    costPerPurchaseBase = ingredient.currentPrice / pieces;
  } else if (ingredient.purchaseUnit === 'box' || ingredient.purchaseUnit === 'bag') {
    const pieces = ingredient.packageSize > 0 ? ingredient.packageSize : 1;
    costPerPurchaseBase = ingredient.currentPrice / pieces;
  } else {
    // per piece or default
    costPerPurchaseBase = ingredient.currentPrice;
  }

  // Account for Usable Yield Percentage (Peeling & Waste loss)
  // If yield is 80%, 1kg purchased yields 0.8kg usable, so usable base cost = cost / 0.8
  const yieldRatio = (ingredient.usableYieldPercent > 0 ? ingredient.usableYieldPercent : 100) / 100;
  return costPerPurchaseBase / yieldRatio;
}

/**
 * Calculate the cost of a single recipe ingredient item.
 */
export function calculateRecipeItemCost(
  itemQuantity: number,
  itemUnit: UnitType,
  ingredient: Ingredient
): number {
  const baseQty = convertToBaseUnit(itemQuantity, itemUnit, ingredient);
  const baseCost = calculateBaseUnitCost(ingredient);
  return roundMoney(baseQty * baseCost);
}

/**
 * Calculate total batch cost for a recipe.
 */
export function calculateBatchCost(
  recipe: Recipe,
  ingredientsMap: Record<string, Ingredient>
): {
  totalCost: number;
  itemCosts: { ingredientId: string; nameAr: string; cost: number; quantityStr: string }[];
} {
  let totalCost = 0;
  const itemCosts: { ingredientId: string; nameAr: string; cost: number; quantityStr: string }[] = [];

  for (const item of recipe.ingredients) {
    const ingredient = ingredientsMap[item.ingredientId];
    if (!ingredient) continue;

    const cost = calculateRecipeItemCost(item.quantity, item.unit, ingredient);
    totalCost += cost;

    itemCosts.push({
      ingredientId: item.ingredientId,
      nameAr: ingredient.nameAr,
      cost,
      quantityStr: `${item.quantity} ${item.unit}`
    });
  }

  return {
    totalCost: roundMoney(totalCost),
    itemCosts
  };
}

/**
 * Calculate raw material cost per liter for a batch recipe.
 */
export function calculateRawCostPerLiter(
  batchCost: number,
  batchYieldMl: number
): number {
  if (batchYieldMl <= 0) return 0;
  const batchYieldLiters = batchYieldMl / 1000;
  return roundMoney(batchCost / batchYieldLiters);
}

/**
 * Calculate complete serving breakdown (Cost, Packaging, Contribution, Margin %, Target Prices)
 */
export function calculateServingBreakdown(params: {
  sizeLabel: string;
  servingMl: number;
  rawCostPerLiter: number;
  packagingCost: number;
  sellingPrice: number;
  isComplete: boolean;
  notes?: string;
  directServingRawCost?: number; // for per-serving recipes where raw cost isn't from batch per liter
}): ServingCostBreakdown {
  const {
    sizeLabel,
    servingMl,
    rawCostPerLiter,
    packagingCost,
    sellingPrice,
    isComplete,
    notes,
    directServingRawCost
  } = params;

  let rawMaterialCost = 0;
  if (directServingRawCost !== undefined) {
    rawMaterialCost = directServingRawCost;
  } else {
    const liters = servingMl / 1000;
    rawMaterialCost = roundMoney(liters * rawCostPerLiter);
  }

  const directVariableCost = roundMoney(rawMaterialCost + packagingCost);
  const contribution = roundMoney(sellingPrice - directVariableCost);
  const contributionMarginPercent = sellingPrice > 0 
    ? roundMoney((contribution / sellingPrice) * 100) 
    : 0;

  // Target selling prices based on industry benchmarks: 60% and 70% contribution margins
  // sellingPrice = directVariableCost / (1 - targetMargin)
  const targetPriceAt60 = directVariableCost > 0 
    ? roundMoney(directVariableCost / (1 - 0.60)) 
    : 0;
  const targetPriceAt70 = directVariableCost > 0 
    ? roundMoney(directVariableCost / (1 - 0.70)) 
    : 0;

  return {
    size: sizeLabel,
    sizeMl: servingMl,
    rawMaterialCost,
    packagingCost,
    directVariableCost,
    sellingPrice,
    contribution,
    contributionMarginPercent,
    targetPriceAt60PercentMargin: targetPriceAt60,
    targetPriceAt70PercentMargin: targetPriceAt70,
    isComplete,
    notes
  };
}

/**
 * Break-even calculation.
 * Returns the number of average servings needed to cover fixed monthly expenses.
 */
export function calculateBreakEvenUnits(
  monthlyFixedExpenses: number,
  averageContributionPerUnit: number
): number {
  if (averageContributionPerUnit <= 0) return 0;
  return Math.ceil(monthlyFixedExpenses / averageContributionPerUnit);
}

/**
 * Calculates forecasted monthly contribution and operating result
 * from a projected volume of products.
 */
export function calculateMonthlyOperatingResult(
  salesScenarios: { productId: string; size: '400ml' | '1L'; unitsSold: number; contributionPerUnit: number }[],
  monthlyOperatingExpenses: number
): {
  totalEstimatedRevenue: number;
  totalEstimatedContribution: number;
  monthlyOperatingExpenses: number;
  netOperatingResult: number; // Contribution - Monthly Operating Expenses
} {
  let totalEstimatedContribution = 0;
  let totalEstimatedRevenue = 0;

  for (const item of salesScenarios) {
    totalEstimatedContribution += item.unitsSold * item.contributionPerUnit;
  }

  const netOperatingResult = roundMoney(totalEstimatedContribution - monthlyOperatingExpenses);

  return {
    totalEstimatedRevenue: roundMoney(totalEstimatedRevenue),
    totalEstimatedContribution: roundMoney(totalEstimatedContribution),
    monthlyOperatingExpenses: roundMoney(monthlyOperatingExpenses),
    netOperatingResult
  };
}
