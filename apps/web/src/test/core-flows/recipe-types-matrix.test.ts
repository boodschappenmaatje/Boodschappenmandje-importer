import { expect, it } from "vitest";
import { MEAL_MIX_PROFILES, enrichIngredientsForMealMixes } from "@/services/week-preparation/meal-mix-profiles";
import { previewFreeChoice } from "@/services/week-preparation/free-choice";
import { createWeekPreparation } from "@/services/week-preparation/week-preparation";
import { ingredientPackageContents, ingredientRecipeAmount } from "@/services/week-preparation/ingredient-packages";
import { decodeStoredWeekPreparation, encodeStoredWeekPreparation } from "@/services/week-preparation/indexeddb-storage";
import { completeShoppingListFromWeek, createEmptyActiveShoppingList } from "@/services/shopping-list/shopping-list";
import { recipeContributionTargets } from "@/services/shopping-list/recipe-contributions";
import type { Product, Recipe } from "@/types/catalog";
import type { WeekPreparation } from "@/types/week-preparation";
import type { RecipeCatalog } from "@/services/week-preparation/recipe-repository";
import type { CatalogRepository } from "@/services/catalog/catalog-repository";

// Deliberately small, deterministic fixtures. They do not claim live assortment
// availability, change production data or repair unavailable brand variants.
const profiles = ["honig-macaroni", "knorr-hokkien-mie"].map(source => {
  const profile = MEAL_MIX_PROFILES.find(p => p.recipeSourceKey === source)!;
  return { ...profile, productId: `mix-${source}` };
});
const normal: Recipe = { id: "pasta", sourceKey: "pasta", name: "Groentepasta", normalizedName: "groentepasta", symbol: "fork.knife", preparationMinutes: 20, vegetarian: true, containsPork: false, kidFriendly: true, healthy: true, budgetTier: "economical" };
const definitions = enrichIngredientsForMealMixes([{ id: "spaghetti", sourceKey: "spaghetti", name: "Spaghetti", normalizedName: "spaghetti", defaultUnit: "g", category: "pasta", aliases: ["spaghetti"] }], profiles);
const catalog: RecipeCatalog = { recipes: [normal, ...profiles.map(p => ({ ...normal, id: p.recipeSourceKey, sourceKey: p.recipeSourceKey, name: p.dishName }))], ingredients: definitions, relations: [{ id: "pasta-row", recipeId: normal.id, ingredientId: "spaghetti", amountPerPerson: 100, unit: "g", position: 0 }], mealMixProfiles: profiles };
const at = new Date("2026-09-26T12:00:00Z");
const products: Product[] = definitions.map(d => {
  const mix = profiles.find(p => p.productIngredientSourceKey === d.sourceKey);
  const id = mix?.productId ?? d.id;
  return { id, sku: id, name: d.name, supermarket: "Hoogvliet", brand: mix?.brand ?? null, category: d.category, productType: d.category, packageText: d.defaultUnit === "piece" ? "1 stuk" : "400 g", weightGrams: d.defaultUnit === "piece" ? null : 400, imageUrl: null, sourceUrl: "https://example.test/fixture", isAvailable: true, updatedAt: "2026-09-16T12:00:00Z", currentPrice: { productId: id, price: 1.79, oldPrice: null, isOffer: false, offerText: null, validFrom: null, validUntil: null, fetchedAt: "2026-09-16T12:00:00Z", updatedAt: "2026-09-16T12:00:00Z" } };
});
const repository: CatalogRepository = { getByIds: async ids => ({ products: products.filter(p => ids.includes(p.id)), priceStatus: "complete" }), search: async () => ({ products, priceStatus: "complete" }), query: async () => { throw Error("unused"); }, getPage: async () => { throw Error("unused"); }, getFilterOptions: async () => ({ categories: [], brands: [] }) };

it.each([1, 2, 4, 6, 10, 12].flatMap(people => [1, 3, 5, 7].map(days => ({ people, days }))))("$people persons / $days days: normal, Honig, Knorr, custom share quantity/price/origin/storage rules", async ({ people, days }) => {
  const base = createWeekPreparation({ schemaVersion: 1, people, days, budgetCents: 10000 }, { knownSubtotalCents: 0, unpricedItemCount: 0 }, at, "type-matrix", 7000);
  const week: WeekPreparation = { ...base, status: "generated", days: Array.from({ length: days }, (_, dayIndex) => ({ dayIndex, category: "freeChoice", freeChoice: true, recipeId: null, recipe: null, status: "freeChoice" })) };
  const choices = [{ recipeId: normal.id }, ...profiles.map(p => ({ recipeId: p.recipeSourceKey })), { customDish: { name: "Eigen pasta", servings: 4, ingredients: [{ id: "own", name: "Spaghetti", productId: "spaghetti", quantity: 400, unit: "g" as const }] } }];
  for (const choice of choices) {
    const preview = await previewFreeChoice(week, days - 1, choice, { loadCatalog: async () => catalog }, repository, createEmptyActiveShoppingList(at), at);
    expect(preview, JSON.stringify(choice)).not.toBeNull();
    const preparation = preview!.preparation;
    expect(preview!.alternativeDishCostCents).toBeGreaterThan(0);
    const restored = decodeStoredWeekPreparation(JSON.parse(JSON.stringify(encodeStoredWeekPreparation(preparation))))!;
    expect(restored.ingredients).toEqual(preparation.ingredients);
    const list = completeShoppingListFromWeek(createEmptyActiveShoppingList(at), restored.ingredients, restored.id, at);
    for (const item of list.items) {
      const { targets, unresolved } = recipeContributionTargets(item, restored);
      expect(unresolved).toBe(false);
      expect(targets.length).toBeGreaterThan(0);
      expect(targets.every(target => target.link.dayIndex === days - 1)).toBe(true);
    }
    for (const ingredient of restored.ingredients) {
      expect(ingredient.price?.amountCents).toBe(179); // old positive remains usable
      expect(ingredient.purchaseQuantity).toBe(Math.ceil(ingredient.requiredQuantity / ingredient.packageCapacity!));
      expect(ingredientPackageContents(ingredient)).not.toBeNull();
      expect(ingredientRecipeAmount(ingredient, days - 1).quantity).toBeGreaterThan(0);
    }
    const profile = profiles.find(p => p.recipeSourceKey === ("recipeId" in choice ? choice.recipeId : null));
    if (profile) expect(restored.ingredients.find(i => i.kind === "mealMix")!.purchaseQuantity).toBe(Math.ceil(people / profile.servingsPerPackage));
    else expect(restored.ingredients[0].requiredQuantity).toBe(people * 100);
  }
});
