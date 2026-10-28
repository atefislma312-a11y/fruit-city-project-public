import { 
  PosOrder, 
  PosOrderItem, 
  OrderType, 
  OrderItemModifier, 
  Recipe, 
  Ingredient, 
  DrinkWasteEntry 
} from '../types';
import { roundMoney } from './costingEngine';

/**
 * Calculates line item price and total
 */
export function calculateOrderItemTotal(item: Partial<PosOrderItem>): number {
  const unitPrice = Number(item.unitPrice) || 0;
  const quantity = Math.max(1, Number(item.quantity) || 1);
  return roundMoney(unitPrice * quantity);
}

/**
 * Calculates subtotal, discount, delivery fee, and final total for a POS Order
 */
export function calculateOrderTotals(params: {
  items: PosOrderItem[];
  discountAmount?: number;
  deliveryFee?: number;
}): {
  subtotal: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
} {
  const { items, discountAmount = 0, deliveryFee = 0 } = params;

  let subtotal = 0;
  for (const item of items) {
    subtotal += item.totalPrice || calculateOrderItemTotal(item);
  }
  subtotal = roundMoney(subtotal);

  const cleanDiscount = Math.min(subtotal, Math.max(0, roundMoney(discountAmount)));
  const cleanDelivery = Math.max(0, roundMoney(deliveryFee));
  const totalAmount = roundMoney(Math.max(0, subtotal - cleanDiscount + cleanDelivery));

  return {
    subtotal,
    discountAmount: cleanDiscount,
    deliveryFee: cleanDelivery,
    totalAmount
  };
}

/**
 * Calculates exact ingredient deductions when an order is completed.
 * Maps recipe ingredients and quantities according to serving size (400ml vs 1L).
 */
export function calculateOrderIngredientDeductions(params: {
  order: PosOrder;
  recipesMap: Record<string, Recipe>;
  ingredientsMap: Record<string, Ingredient>;
}): Record<string, { ingredientId: string; ingredientNameAr: string; quantityDeducted: number; unit: string }> {
  const { order, recipesMap, ingredientsMap } = params;
  const deductions: Record<string, { ingredientId: string; ingredientNameAr: string; quantityDeducted: number; unit: string }> = {};

  for (const item of order.items) {
    if (!item.recipeId) continue;
    const recipe = recipesMap[item.recipeId];
    if (!recipe) continue;

    const itemCount = item.quantity || 1;
    // Ratio relative to recipe standard yield
    // For batch recipes (e.g. 10L = 10,000ml):
    // 400ml = 400 / 10000 = 0.04 of batch
    // 1L = 1000 / 10000 = 0.1 of batch
    let servingRatio = 1;
    if (recipe.method === 'batch' && recipe.batchYieldMl > 0) {
      const ml = item.servingSize === '1L' ? 1000 : (item.servingSize === '500ml' ? 500 : 473);
      servingRatio = ml / recipe.batchYieldMl;
    } else if (recipe.method === 'per_serving') {
      servingRatio = item.servingSize === '1L' ? 2.11 : (item.servingSize === '500ml' ? 1.05 : 1.0);
    }

    for (const recIng of recipe.ingredients) {
      const ing = ingredientsMap[recIng.ingredientId];
      const baseDeduction = recIng.quantity * servingRatio * itemCount;

      if (!deductions[recIng.ingredientId]) {
        deductions[recIng.ingredientId] = {
          ingredientId: recIng.ingredientId,
          ingredientNameAr: ing ? ing.nameAr : recIng.ingredientId,
          quantityDeducted: 0,
          unit: recIng.unit
        };
      }
      deductions[recIng.ingredientId].quantityDeducted += baseDeduction;
    }
  }

  // Round results
  for (const id in deductions) {
    deductions[id].quantityDeducted = roundMoney(deductions[id].quantityDeducted);
  }

  return deductions;
}

/**
 * Calculates drink waste entry if an order was prepared and then cancelled
 */
export function calculateDrinkWaste(params: {
  order: PosOrder;
  cashierId: string;
  reason: string;
}): DrinkWasteEntry[] {
  const { order, cashierId, reason } = params;
  const entries: DrinkWasteEntry[] = [];
  const now = new Date().toISOString();

  for (const item of order.items) {
    // Only prepared drinks count as wasted prepared beverages
    if (item.isPrepared || order.preparationStatus === 'ready' || order.preparationStatus === 'preparing') {
      entries.push({
        id: `waste_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        orderId: order.id,
        orderNumber: order.orderNumber,
        productId: item.productId,
        productNameAr: item.productNameAr,
        recipeId: item.recipeId,
        servingSize: item.servingSize,
        quantity: item.quantity,
        estimatedCostLoss: roundMoney(item.unitPrice * 0.45 * item.quantity), // estimated ingredient cost
        reason,
        loggedAt: now,
        cashierId
      });
    }
  }

  return entries;
}

/**
 * 80mm Preparation Ticket Formatter for Kitchen / Barista Worker
 * CRITICAL RULE: NO CUSTOMER PRICES on the worker preparation ticket!
 */
export function formatWorkerPreparationTicket(order: PosOrder): {
  ticketNumber: string;
  orderTypeAr: string;
  timestamp: string;
  items: {
    name: string;
    size: string;
    quantity: number;
    sugar: string;
    ice: string;
    notes?: string;
  }[];
  orderNotes?: string;
} {
  const orderTypeLabels: Record<OrderType, string> = {
    dine_in: 'صالة — داخل المحل',
    takeaway: 'تيك أواي — سفري',
    delivery: 'دليفري — توصيل'
  };

  const sugarLabels: Record<string, string> = {
    standard: 'سكر مظبوط',
    low: 'سكر خفيف',
    sugar_free: 'بدون سكر (دايت)',
    extra: 'سكر زيادة'
  };

  const iceLabels: Record<string, string> = {
    standard: 'ثلج مظبوط',
    light: 'ثلج قليل',
    no_ice: 'بدون ثلج',
    extra: 'ثلج زيادة'
  };

  return {
    ticketNumber: order.orderNumber,
    orderTypeAr: orderTypeLabels[order.orderType] || 'تيك أواي',
    timestamp: new Date(order.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
    items: order.items.map(itm => ({
      name: itm.productNameAr,
      size: itm.servingSize === '1L' ? 'لتر كامل (1L)' : 'كوب وسط (400 مل)',
      quantity: itm.quantity,
      sugar: sugarLabels[itm.modifiers?.sugarLevel || 'standard'] || 'سكر مظبوط',
      ice: iceLabels[itm.modifiers?.iceLevel || 'standard'] || 'ثلج مظبوط',
      notes: itm.modifiers?.extraNotes
    })),
    orderNotes: order.notes
  };
}
