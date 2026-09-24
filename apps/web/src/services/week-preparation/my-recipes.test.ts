import { describe, expect, it, vi } from "vitest";
import { customDraftHasChanges, customDraftKey, loadCustomDraft, loadMyRecipes, saveCustomDraft, saveMyRecipe, MY_RECIPES_KEY } from "./my-recipes-storage";
import { customIngredientQuantity, matchCustomDishes, validCustomDish } from "./custom-dish";
import { previewFreeChoice } from "./free-choice";
import { commitExplicitRecipeAlternative } from "./meal-customization";
import { createWeekPreparation } from "./week-preparation";
import { decodeStoredWeekPreparation, encodeStoredWeekPreparation } from "./indexeddb-storage";
import { addCatalogProduct, completeShoppingListFromWeek, createEmptyActiveShoppingList, increaseQuantity } from "@/services/shopping-list/shopping-list";
import type { Product } from "@/types/catalog";
import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import type { CustomDish, WeekPreparation } from "@/types/week-preparation";
import type { RecipeRepository } from "./recipe-repository";

const now = new Date();
function product(id: string, packageText: string, price = 2): Product {
  return { id, sku: `sku-${id}`, name: id, supermarket: "Hoogvliet", brand: null, category: null, productType: null, packageText, weightGrams: null, imageUrl: null, sourceUrl: `https://example.test/${id}`, isAvailable: true, updatedAt: now.toISOString(),
    currentPrice: { productId: id, price, oldPrice: null, isOffer: false, offerText: null, validFrom: null, validUntil: null, fetchedAt: now.toISOString(), updatedAt: now.toISOString() } };
}
function storage() { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } }; }
const pasta = product("spaghetti", "500 g");
const cream = product("kookroom", "200 ml", 1.5);
const peppers = product("paprika", "2 stuks", 2.2);
const recipes: RecipeRepository = { loadCatalog: async () => ({ recipes: [], ingredients: [], relations: [] }) };
function catalog(items = [pasta, cream, peppers]): CatalogRepository {
  return { getByIds: vi.fn(async ids => ({ products: items.filter(item => ids.includes(item.id)), priceStatus: "complete" as const })),
    query: vi.fn(async query => ({ products: items.filter(item => item.name.includes(query.term ?? "")), priceStatus: "complete" as const, page: 1, pageSize: 12, hasMore: false, query })),
    search: vi.fn(async () => ({ products: [], priceStatus: "complete" as const })), getPage: vi.fn(), getFilterOptions: vi.fn() };
}
function dish(): CustomDish { return { name: "Mijn pasta", servings: 4, targetServings: 4, ingredients: [
  { id: "pasta-row", name: pasta.name, quantity: 400, unit: "g", productId: pasta.id },
  { id: "cream-row", name: cream.name, quantity: 200, unit: "ml", productId: cream.id },
  { id: "pepper-row", name: peppers.name, quantity: 2, unit: "piece", productId: peppers.id },
] }; }
function week(): WeekPreparation {
  const base = createWeekPreparation({ schemaVersion: 1, people: 4, days: 1, budgetCents: 10000 }, { knownSubtotalCents: 0, unpricedItemCount: 0 }, now, "pwa14");
  return { ...base, mealBudgetCents: 5000, numberOfPeople: 4, numberOfDays: 1, status: "generated", categoryDistribution: { ...base.categoryDistribution, freeChoice: 1 }, days: [{ dayIndex: 0, category: "freeChoice", freeChoice: true, recipe: null, recipeId: null, status: "freeChoice" }] };
}

describe("PWA 14 private recipes and drafts", () => {
  it("keeps incomplete name and ingredient input through navigation, isolated by week/day", () => {
    const store = storage(); const key = customDraftKey("week-a", 0);
    const draft = { ...dish(), name: "", ingredients: [{ ...dish().ingredients[0], name: "", productId: null, quantity: 0 }] };
    saveCustomDraft(store, key, draft);
    expect(loadCustomDraft(store, key)).toEqual(draft);
    expect(loadCustomDraft(store, customDraftKey("week-a", 1))).toBeNull();
    expect(loadCustomDraft(store, customDraftKey("week-b", 0))).toBeNull();
    expect(validCustomDish(draft)).toBe(false);
  });
  it("saves and reopens a typed recipe with stable product IDs, base servings and fallback", () => {
    const store = storage(); const saved = saveMyRecipe(store, dish(), "mine", now);
    expect(loadMyRecipes(store)).toEqual([saved]);
    expect(saved.dish).toMatchObject({ savedRecipeId: "mine", servings: 4, targetServings: 4 });
    expect(saved.photo).toEqual({ kind: "fallback" });
    expect(saved.dish.ingredients.map(row => row.productId)).toEqual([pasta.id, cream.id, peppers.id]);
    expect(store.getItem(MY_RECIPES_KEY)).not.toMatch(/amountCents|currentPrice|priceSnapshot/);
  });
  it("does not warn about changes when reopening an unchanged saved draft", () => {
    const store = storage();
    const saved = saveMyRecipe(store, dish(), "mine");
    saveCustomDraft(store, "draft", saved.dish);
    expect(customDraftHasChanges(loadCustomDraft(store, "draft")!, loadMyRecipes(store))).toBe(false);
    expect(customDraftHasChanges({ ...saved.dish, targetServings: 6 }, loadMyRecipes(store))).toBe(true);
    expect(customDraftHasChanges({ ...dish(), name: "", ingredients: [] }, [])).toBe(false);
  });
  it("updates in place without duplicating recipes and preserves recipes from another tab", () => {
    const store = storage(); saveMyRecipe(store, dish(), "one", now); saveMyRecipe(store, dish(), "two", now);
    const later = new Date(now.getTime() + 1000);
    saveMyRecipe(store, { ...dish(), name: "Nieuwe naam" }, "one", later);
    expect(loadMyRecipes(store)).toHaveLength(2);
    expect(loadMyRecipes(store)[0]).toMatchObject({ createdAt: now.toISOString(), updatedAt: later.toISOString(), dish: { name: "Nieuwe naam" } });
  });
  it("does not overwrite corrupt or unknown-version saved data", () => {
    const store = storage(); store.setItem(MY_RECIPES_KEY, '{"schemaVersion":99,"recipes":[]}');
    expect(() => loadMyRecipes(store)).toThrow();
    expect(() => saveMyRecipe(store, dish(), "one")).toThrow();
    expect(store.getItem(MY_RECIPES_KEY)).toContain('99');
  });
  it("reports storage failure and refuses invalid amounts, identities or unlinked rows", () => {
    const store = { ...storage(), setItem: () => { throw new Error("QuotaExceededError"); } };
    expect(() => saveMyRecipe(store, dish(), "one")).toThrow("QuotaExceededError");
    expect(() => saveCustomDraft(store, "key", dish())).toThrow("QuotaExceededError");
    for (const patch of [{ servings: 0 }, { targetServings: 13 }, { name: "" }]) expect(validCustomDish({ ...dish(), ...patch })).toBe(false);
    expect(() => saveMyRecipe(storage(), { ...dish(), ingredients: [{ ...dish().ingredients[0], productId: null }] }, "one")).toThrow();
  });
  it("rejects forged or zero package conversions and duplicate ingredients", () => {
    expect(validCustomDish({ ...dish(), ingredients: [{ ...dish().ingredients[0], packageCapacityOverride: 0 }] })).toBe(false);
    expect(validCustomDish({ ...dish(), ingredients: [dish().ingredients[0], dish().ingredients[0]] })).toBe(false);
  });
});

describe("PWA 14 current products, quantities, budget and list", () => {
  it("links three real products in one batched lookup and calculates package costs", async () => {
    const products = catalog();
    const preview = await previewFreeChoice(week(), 0, { customDish: dish() }, recipes, products);
    expect(preview?.alternativeDishCostCents).toBe(570);
    expect(preview?.preparation.ingredients.map(row => row.purchaseQuantity)).toEqual([1, 1, 1]);
    expect(products.getByIds).toHaveBeenCalledWith([pasta.id, cream.id, peppers.id]);
    expect(products.search).not.toHaveBeenCalled();
    expect(preview?.preparation.generation?.mealBudgetRemainingCents).toBe(4430);
  });
  it("scales a saved 4-person recipe to 6 without changing base amounts or the household", async () => {
    const store = storage(); saveMyRecipe(store, dish(), "mine");
    const saved = loadMyRecipes(store)[0].dish;
    const scaled = { ...saved, targetServings: 6 };
    const preview = await previewFreeChoice(week(), 0, { customDish: scaled }, recipes, catalog());
    expect(preview?.preparation.numberOfPeople).toBe(4);
    expect(preview?.preparation.ingredients.map(row => row.requiredQuantity)).toEqual([600, 300, 3]);
    expect(preview?.preparation.ingredients.map(row => row.purchaseQuantity)).toEqual([2, 2, 2]);
    expect(preview?.alternativeDishCostCents).toBe(1140);
    expect(loadMyRecipes(store)[0].dish).toEqual(saved);
    expect(customIngredientQuantity(saved.ingredients[0], { ...saved, targetServings: 4 })).toBe(400);
  });
  it.each([1, 2, 3, 4, 6, 8, 10, 12])("calculates %i servings with ceil packages and stable choices", async targetServings => {
    const next = { ...dish(), targetServings };
    const preview = await previewFreeChoice(week(), 0, { customDish: next }, recipes, catalog());
    expect(preview?.preparation.ingredients[0].purchaseQuantity).toBe(Math.ceil(targetServings * 100 / 500));
    expect(preview?.preparation.ingredients[0].product?.sku).toBe(pasta.sku);
  });
  it("reopens with a changed current price instead of an old saved amount", async () => {
    const store = storage(); saveMyRecipe(store, dish(), "mine");
    const updated = { ...pasta, currentPrice: { ...pasta.currentPrice!, price: 3.25 } };
    const preview = await previewFreeChoice(week(), 0, { customDish: loadMyRecipes(store)[0].dish }, recipes, catalog([updated, cream, peppers]));
    expect(preview?.alternativeDishCostCents).toBe(695);
  });
  it.each(["missing", "unavailable", "zero", "tiny", "stale", "wrong-price", "wrong-market", "no-sku"])("flags %s product data and never invents an alternative", async failure => {
    const bad = structuredClone(pasta);
    if (failure === "unavailable") bad.isAvailable = false;
    if (failure === "zero") bad.currentPrice!.price = 0;
    if (failure === "tiny") bad.currentPrice!.price = 0.001;
    if (failure === "stale") bad.currentPrice!.fetchedAt = new Date(0).toISOString();
    if (failure === "wrong-price") bad.currentPrice!.productId = "other";
    if (failure === "wrong-market") bad.supermarket = "Other";
    if (failure === "no-sku") bad.sku = "";
    const products = catalog(failure === "missing" ? [cream, peppers] : [bad, cream, peppers]);
    expect(await previewFreeChoice(week(), 0, { customDish: dish() }, recipes, products)).toBeNull();
    expect(products.search).not.toHaveBeenCalled();
    // Still editable and saveable offline; readiness is checked separately.
    expect(() => saveMyRecipe(storage(), dish(), "mine")).not.toThrow();
  });
  it("requires explicit content when units cannot be converted, never guesses grams to pieces", async () => {
    const wraps = product("wraps", "300 g", 3);
    const custom = { ...dish(), ingredients: [{ id: "wrap", name: "wraps", productId: wraps.id, quantity: 8, unit: "piece" as const }] };
    expect(await previewFreeChoice(week(), 0, { customDish: custom }, recipes, catalog([wraps]))).toBeNull();
    const confirmed = { ...custom, ingredients: [{ ...custom.ingredients[0], packageCapacityOverride: 6 }] };
    const preview = await previewFreeChoice(week(), 0, { customDish: confirmed }, recipes, catalog([wraps]));
    expect(preview?.preparation.ingredients[0]).toMatchObject({ purchaseQuantity: 2, packageCapacity: 6 });
    expect(preview?.alternativeDishCostCents).toBe(600);
  });
  it("uses live catalog packaging in preference to an old override and converts kg safely", async () => {
    const custom = { ...dish(), ingredients: [{ ...dish().ingredients[0], quantity: 0.6, unit: "kg" as const, packageCapacityOverride: 999 }] };
    const preview = await previewFreeChoice(week(), 0, { customDish: custom }, recipes, catalog());
    expect(preview?.preparation.ingredients[0]).toMatchObject({ requiredQuantity: 600, purchaseQuantity: 2, packageCapacity: 500 });
  });
  it("replacement changes product, packages, total and budget", async () => {
    const replacement = product("volkoren spaghetti", "250 g", 1.25);
    const custom = { ...dish(), ingredients: dish().ingredients.map((row, index) => index ? row : { ...row, name: replacement.name, productId: replacement.id }) };
    const preview = await previewFreeChoice(week(), 0, { customDish: custom }, recipes, catalog([replacement, cream, peppers]));
    expect(preview?.preparation.ingredients[0]).toMatchObject({ purchaseQuantity: 2, product: { productId: replacement.id } });
    expect(preview?.alternativeDishCostCents).toBe(620);
    expect(preview?.preparation.generation?.mealBudgetRemainingCents).toBe(4380);
  });
  it("keeps week and meal budgets separate and requires deliberate override", async () => {
    const base = { ...week(), mealBudgetCents: 500 };
    const preview = await previewFreeChoice(base, 0, { customDish: dish() }, recipes, catalog());
    expect(preview?.impact).toMatchObject({ mealBudgetOverageCents: 70, weekBudgetOverageCents: 0, requiresBudgetOverride: true });
    expect((await commitExplicitRecipeAlternative(base, 0, preview!, false, recipes, catalog())).ok).toBe(false);
    expect((await commitExplicitRecipeAlternative(base, 0, preview!, true, recipes, catalog())).ok).toBe(true);
  });
  it("rechecks price and availability at confirmation before touching the list", async () => {
    const preview = await previewFreeChoice(week(), 0, { customDish: dish() }, recipes, catalog());
    const changed = catalog([{ ...pasta, currentPrice: { ...pasta.currentPrice!, price: 5 } }, cream, peppers]);
    expect(await commitExplicitRecipeAlternative(week(), 0, preview!, false, recipes, changed)).toMatchObject({ ok: false, reason: "budget_impact_changed" });
    const stale = catalog([{ ...pasta, currentPrice: { ...pasta.currentPrice!, fetchedAt: new Date(0).toISOString() } }, cream, peppers]);
    expect(await commitExplicitRecipeAlternative(week(), 0, preview!, false, recipes, stale)).toMatchObject({ ok: false, reason: "recipe_not_ready" });
  });
  it("preserves recipe provenance, survives week storage and syncs without duplicates or lost manual quantity", async () => {
    const saved = saveMyRecipe(storage(), dish(), "mine");
    const preview = await previewFreeChoice(week(), 0, { customDish: saved.dish }, recipes, catalog());
    const committed = await commitExplicitRecipeAlternative(week(), 0, preview!, false, recipes, catalog());
    expect(committed.ok).toBe(true); if (!committed.ok) return;
    const restored = decodeStoredWeekPreparation(encodeStoredWeekPreparation(committed.preparation));
    expect(restored?.days[0].customDish?.savedRecipeId).toBe("mine");
    const manual = increaseQuantity(addCatalogProduct(createEmptyActiveShoppingList(), pasta, "catalog"), pasta.id);
    const list = completeShoppingListFromWeek(manual, restored!.ingredients, week().id);
    expect(list.items.find(item => item.productId === pasta.id)).toMatchObject({ quantity: 3, quantityContributions: { persistentQuantity: 2 } });
    expect(completeShoppingListFromWeek(list, restored!.ingredients, week().id).items.map(item => item.quantity)).toEqual(list.items.map(item => item.quantity));
    const rescaled = await previewFreeChoice(restored!, 0, { customDish: { ...saved.dish, targetServings: 6 } }, recipes, catalog(), list);
    const next = completeShoppingListFromWeek(list, rescaled!.preparation.ingredients, week().id);
    expect(next.items.find(item => item.productId === pasta.id)).toMatchObject({ quantity: 4, quantityContributions: { persistentQuantity: 2 } });
    expect(next.items).toHaveLength(3);
  });
  it("loads selected custom products once for repeated ingredient rows", async () => {
    const custom = { ...dish(), ingredients: [dish().ingredients[0], { ...dish().ingredients[0], id: "second" }] };
    const current = week(); current.days[0] = { ...current.days[0], recipe: { id: "custom", sourceKey: "custom-dish", name: custom.name }, customDish: custom };
    const products = catalog();
    await matchCustomDishes(current, await recipes.loadCatalog(), products);
    expect(products.getByIds).toHaveBeenCalledExactlyOnceWith([pasta.id]);
  });
});

it("keeps fixed package choices in saved recipes and derives ml/pieces after reopening",async()=>{
  const store=storage();const chosen=dish();
  chosen.ingredients=chosen.ingredients.map(row=>({...row,packageCount:2}));
  saveMyRecipe(store,chosen,"packs",now);
  const reopened=loadMyRecipes(store)[0].dish;
  expect(reopened.ingredients.every(row=>row.packageCount===2)).toBe(true);
  reopened.targetServings=6;
  const preview=await previewFreeChoice(week(),0,{customDish:reopened},recipes,catalog(),createEmptyActiveShoppingList(now),now);
  expect(preview!.preparation.ingredients.map(row=>[row.requiredQuantity,row.unit,row.purchaseQuantity])).toEqual([[1000,"g",2],[400,"ml",2],[4,"piece",2]]);
});
