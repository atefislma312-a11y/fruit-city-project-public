import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveServingSize, calculateIngredientNeeds } from './orderRules.js';

const recipes = { p1: { recipe_id: 'r1', batch_yield_ml: 1000 }, p2: { recipe_id: 'r2', batch_yield_ml: 1000 } };
const ingredients = { r1: [{ ingredient_id: 'mango', quantity: 2, unit: 'kg' }], r2: [{ ingredient_id: 'mango', quantity: 1, unit: 'kg' }] };
const needs = items => calculateIngredientNeeds(items, id => recipes[id], id => ingredients[id]);

test('canonical sizes are distinct and unsupported sizes fail closed', () => {
  assert.deepEqual(['400ml', '500ml', '16oz', '1L'].map(s => resolveServingSize(s).sizeId),
    ['size_400ml', 'size_bottle_500ml', 'size_cup_16oz', 'size_bottle_1l']);
  assert.throws(() => resolveServingSize('kg'), /UNSUPPORTED_SIZE/);
});

test('shared ingredient demand includes every line and quantity', () => {
  const result = needs([{ productId: 'p1', servingSize: '500ml', quantity: 2 }, { productId: 'p2', servingSize: '1L', quantity: 1 }]);
  assert.equal(result.get('mango').quantity, 3);
});

test('16oz is 473ml, not 400ml', () => {
  assert.equal(needs([{ productId: 'p1', servingSize: '16oz', quantity: 1 }]).get('mango').quantity, 0.946);
});

test('invalid quantity and recipe yield fail before stock is touched', () => {
  assert.throws(() => needs([{ productId: 'p1', servingSize: '400ml', quantity: 0 }]), /INVALID_QUANTITY/);
  recipes.p1.batch_yield_ml = 0;
  assert.throws(() => needs([{ productId: 'p1', servingSize: '400ml', quantity: 1 }]), /INVALID_RECIPE_YIELD/);
});
