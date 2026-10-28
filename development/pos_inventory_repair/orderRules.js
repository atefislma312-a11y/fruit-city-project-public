export const SIZE_TO_ID = Object.freeze({
  '400ml': 'size_400ml',
  '500ml': 'size_bottle_500ml',
  '16oz': 'size_cup_16oz',
  '1L': 'size_bottle_1l'
});

export const SIZE_TO_ML = Object.freeze({ '400ml': 400, '500ml': 500, '16oz': 473, '1L': 1000 });

export function resolveServingSize(size) {
  if (!Object.hasOwn(SIZE_TO_ID, size)) throw new Error('UNSUPPORTED_SIZE');
  return { sizeId: SIZE_TO_ID[size], milliliters: SIZE_TO_ML[size] };
}

export function calculateIngredientNeeds(items, getRecipe, getIngredients) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('EMPTY_ORDER');
  const needs = new Map();
  for (const item of items) {
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99) throw new Error('INVALID_QUANTITY');
    const { milliliters } = resolveServingSize(item.servingSize);
    const recipe = getRecipe(item.productId);
    if (!recipe) continue;
    const yieldMl = Number(recipe.batch_yield_ml);
    if (!Number.isFinite(yieldMl) || yieldMl <= 0) throw new Error('INVALID_RECIPE_YIELD');
    const ratio = milliliters / yieldMl;
    for (const ingredient of getIngredients(recipe.recipe_id)) {
      const amount = Number(ingredient.quantity) * ratio * quantity;
      if (!Number.isFinite(amount) || amount <= 0) throw new Error('INVALID_RECIPE_QUANTITY');
      const prior = needs.get(ingredient.ingredient_id);
      if (prior && prior.unit !== ingredient.unit) throw new Error('INGREDIENT_UNIT_MISMATCH');
      needs.set(ingredient.ingredient_id, { quantity: (prior?.quantity || 0) + amount, unit: ingredient.unit });
    }
  }
  return needs;
}
