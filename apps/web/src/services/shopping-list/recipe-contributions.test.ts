import { describe, expect, it } from 'vitest';
import { createWeekPreparation } from '@/services/week-preparation/week-preparation';
import { completeShoppingListFromWeek, createEmptyActiveShoppingList, increaseQuantity, decreaseQuantity, removeShoppingListItem, adjustPersistentQuantity } from './shopping-list';
import { recipeContributionTargets } from './recipe-contributions';
import { decodeStoredActiveShoppingList, encodeStoredActiveShoppingList } from './indexeddb-storage';
import type { Recipe } from '@/types/catalog';
import type { WeekIngredientRequirement, WeekPreparation } from '@/types/week-preparation';
const recipe: Recipe = { id: 'recipe', sourceKey: 'pasta', name: 'Pasta', normalizedName: 'pasta', symbol: '', preparationMinutes: 20, vegetarian: true, containsPork: false, kidFriendly: true, healthy: true, budgetTier: 'economical' };
const ingredient: WeekIngredientRequirement = { ingredientId: 'ingredient', sourceKey: 'pasta', name: 'Pasta', unit: 'g', optional: false, servingsBase: 1, kind: 'ingredient', brandConstraint: null, requiredQuantity: 400, purchaseQuantity: 1, packageCapacity: 400, usedIn: [{ recipeId: recipe.id, recipeName: recipe.name, dayIndex: 0, requiredQuantity: 400 }], product: { productId: 'product', sku: 'sku', name: 'Pasta', brand: null, packageText: '400 g', imageUrl: null, supermarket: 'Hoogvliet', sourceUrl: '' }, price: { amountCents: 179, isOffer: false, updatedAt: '2026-09-16', freshness: 'stale' }, productMatchMissing: false, packageCalculationMissing: false };
const week: WeekPreparation = { ...createWeekPreparation({ schemaVersion: 1, people: 4, days: 1, budgetCents: 10000 }, { knownSubtotalCents: 0, unpricedItemCount: 0 }, new Date(), 'week', 7000), status: 'generated', ingredients: [ingredient], days: [{ dayIndex: 0, category: 'pasta', freeChoice: false, recipeId: recipe.id, recipe, status: 'recipeSelected' }] };
const list = completeShoppingListFromWeek(createEmptyActiveShoppingList(), week.ingredients, week.id);

describe('exact planned ingredient ownership and stored projection', () => {
  it('persists week/day/recipe/ingredient/product identity with no separate editable recipe count', () => {
    const decoded = decodeStoredActiveShoppingList(encodeStoredActiveShoppingList(list))!;
    expect(decoded.items[0].quantityContributions.mealPlans[0].ingredientLinks).toEqual([{ weekPreparationId: 'week', dayIndex: 0, recipeId: 'recipe', ingredientId: 'ingredient', productId: 'product', sku: 'sku' }]);
    expect(recipeContributionTargets(decoded.items[0], week)).toMatchObject({ unresolved: false, targets: [{ packages: 1, adjustable: true }] });
  });
  it.each(['weekPreparationId', 'dayIndex', 'recipeId', 'ingredientId', 'productId', 'sku'] as const)('never follows a stale or different %s', key => {
    const item = structuredClone(list.items[0]);
    Object.assign(item.quantityContributions.mealPlans[0].ingredientLinks![0], { [key]: key === 'dayIndex' ? 1 : 'other' });
    expect(recipeContributionTargets(item, week)).toEqual({ targets: [], unresolved: true });
  });
  it('a same-SKU manual item is not linked; a different week cannot claim the recipe', () => {
    const item = structuredClone(list.items[0]); item.quantityContributions = { persistentQuantity: 1, mealPlans: [] };
    expect(recipeContributionTargets(item, week)).toEqual({ targets: [], unresolved: false });
    expect(recipeContributionTargets(list.items[0], { ...week, id: 'other-week' })).toEqual({ targets: [], unresolved: true });
  });
  it('decodes old lists without inventing ownership beyond their exact known week', () => {
    const legacy = structuredClone(list); delete legacy.items[0].quantityContributions.mealPlans[0].ingredientLinks;
    const decoded = decodeStoredActiveShoppingList(encodeStoredActiveShoppingList(legacy))!;
    expect(recipeContributionTargets(decoded.items[0], week).targets).toHaveLength(1);
    decoded.items[0].quantityContributions.mealPlans[0].weekPreparationId = null;
    expect(recipeContributionTargets(decoded.items[0], week)).toEqual({ targets: [], unresolved: true });
  });
  it('generic quantity/delete cannot edit meal projections; explicit independent contribution remains separate', () => {
    expect(increaseQuantity(list, 'product')).toBe(list); expect(decreaseQuantity(list, 'product')).toBe(list);
    expect(removeShoppingListItem(list, 'product')).toEqual({ list, removed: null });
    const extra = adjustPersistentQuantity(list, 'product', 1);
    const more = completeShoppingListFromWeek(extra, [{ ...ingredient, requiredQuantity: 800, purchaseQuantity: 2, usedIn: [{ ...ingredient.usedIn[0], requiredQuantity: 800 }] }], week.id);
    expect(more.items[0]).toMatchObject({ quantity: 3, quantityContributions: { persistentQuantity: 1, mealPlans: [{ quantity: 2 }] } });
    expect(adjustPersistentQuantity(more, 'product', -1).items[0].quantity).toBe(2);
  });
  it('rejects malformed persisted links', () => {
    const stored = encodeStoredActiveShoppingList(structuredClone(list)); stored.list.items[0].quantityContributions.mealPlans[0].ingredientLinks![0].dayIndex = -1;
    expect(() => decodeStoredActiveShoppingList(stored)).toThrow('invalid-data');
  });
});
