import { describe, expect, it, vi } from "vitest";
import { previewFreeChoice, recipeMatchesQuery, searchFreeChoice } from "./free-choice";
import { matchCustomDishes, validCustomDish } from "./custom-dish";
import { commitExplicitRecipeAlternative } from "./meal-customization";
import { createWeekPreparation, changePreparedDayCategory } from "./week-preparation";
import { generatePreparedWeek, revalidatePreparedWeek } from "./week-generation";
import { encodeStoredWeekPreparation, decodeStoredWeekPreparation } from "./indexeddb-storage";
import { completeShoppingListFromWeek, createEmptyActiveShoppingList, addCatalogProduct } from "@/services/shopping-list/shopping-list";
import type { RecipeCatalog, RecipeRepository } from "./recipe-repository";
import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import type { Product, Recipe } from "@/types/catalog";
import type { CustomDish, WeekPreparation } from "@/types/week-preparation";
import { evaluateRecipeReadiness } from "./recipe-readiness";
import { rowsForGate } from "@/server/planner-cache-service";
import { createWeekPlanningSnapshotCache } from "./planning-cache";
import type { PersistentProductMatchRow, PersistentRecipeReadinessRow } from "./persistent-readiness-cache";
import reviewedProfiles from "../../../../../test/fixtures/meal-mix-reviewed-profiles.json";
import type { MealMixProfile } from "./meal-mix-profiles";

const now = new Date();
const pasta: Recipe = { id: "pasta", sourceKey: "spaghetti", name: "Zelfgemaakte spaghetti", normalizedName: "spaghetti", symbol: "fork.knife", preparationMinutes: 20, vegetarian: true, containsPork: false, kidFriendly: true, healthy: false, budgetTier: "economical" };
const catalog: RecipeCatalog = {
  recipes: [pasta],
  ingredients: [{ id: "spaghetti", sourceKey: "spaghetti", name: "spaghetti", normalizedName: "spaghetti", defaultUnit: "g", category: "Pasta, rijst & granen", aliases: ["pasta"] }],
  relations: [{ id: "rel", recipeId: "pasta", ingredientId: "spaghetti", amountPerPerson: 100, unit: "g", position: 0 }],
};
const product: Product = { id: "product-pasta", sku: "pasta-sku", name: "Spaghetti", supermarket: "Hoogvliet", brand: "G'woon", category: "Pasta, rijst & granen/Pasta", productType: "Pasta", packageText: "500 g", weightGrams: 500, imageUrl: null, sourceUrl: "https://example.test/pasta", isAvailable: true, updatedAt: now.toISOString(), currentPrice: { productId: "product-pasta", price: 2, oldPrice: null, isOffer: false, offerText: null, validFrom: null, validUntil: null, fetchedAt: now.toISOString(), updatedAt: now.toISOString() } };
const recipes: RecipeRepository = { async loadCatalog() { return catalog; } };
const products: CatalogRepository = {
  async getByIds(ids) { return { products: ids.includes(product.id) ? [product] : [], priceStatus: "complete" }; },
  async search(term) { return { products: /pasta|spaghetti/i.test(term) ? [product] : [], priceStatus: "complete" }; },
  async getPage() { return { products: [product], priceStatus: "complete", page: 1, pageSize: 20, hasMore: false }; },
  async query() { throw new Error("unused"); }, async getFilterOptions() { return { brands: [], categories: [] }; },
};
function week(): WeekPreparation {
  const base = createWeekPreparation({ schemaVersion: 1, people: 6, days: 2, budgetCents: 10000 }, { knownSubtotalCents: 0, unpricedItemCount: 0 }, now, "pwa13");
  return { ...base, mealBudgetCents: 10000, numberOfPeople: 6, numberOfDays: 2, status: "generated", categoryDistribution: { ...base.categoryDistribution, freeChoice: 2 }, days: [0, 1].map((dayIndex) => ({ dayIndex, category: "freeChoice", freeChoice: true, recipe: null, recipeId: null, status: "freeChoice" })) };
}
const dish: CustomDish = { name: "Mijn pasta", servings: 6, ingredients: [{ id: "row1", name: "pasta", quantity: 600, unit: "g", productId: null }] };

describe("PWA 13 vrije keuze", () => {
  it.each(["Knorr mix", "mix"])("keeps every matching catalog mix beyond twenty results for %s", async (query) => {
    const profiles = reviewedProfiles as MealMixProfile[];
    const variants = profiles.map(profile => ({ ...pasta, id: profile.productId!, sourceKey: profile.recipeSourceKey, name: profile.dishName }))
      .sort((a, b) => a.sourceKey.localeCompare(b.sourceKey));
    const repository = { loadCatalog: async () => ({ ...catalog, recipes: variants, relations: [], mealMixProfiles: profiles }) };
    const cache = createWeekPlanningSnapshotCache({ persistentRepository: { load: async () => ({ available: false, readiness: [], matches: [] }) } });
    const found = await searchFreeChoice(week(), 0, query, repository, products, undefined, cache);
    const expected = variants.filter(recipe => recipeMatchesQuery(recipe, query));
    expect(expected.length).toBeGreaterThan(20);
    expect(found.map(item => item.recipe.id)).toEqual(expected.map(recipe => recipe.id));
    expect(new Set(found.map(item => item.recipe.id)).size).toBe(found.length);
    expect(found.every(item => (query === "mix" || item.brand === "Knorr") && item.alternative === null)).toBe(true);
  });

  it("retains the twenty-result bound for ordinary recipes", async () => {
    const variants = Array.from({ length: 25 }, (_, index) => ({ ...pasta, id: `pasta-${index}` }));
    const repository = { loadCatalog: async () => ({ ...catalog, recipes: variants, relations: [] }) };
    const cache = createWeekPlanningSnapshotCache({ persistentRepository: { load: async () => ({ available: false, readiness: [], matches: [] }) } });
    const found = await searchFreeChoice(week(), 0, "spaghetti", repository, products, undefined, cache);
    expect(found.map(item => item.recipe.id)).toEqual(variants.slice(0, 20).map(recipe => recipe.id));
  });

  it('shows the complete branded inventory even when Knorr has more than twenty variants', async () => {
    const variants=Array.from({length:22},(_,i)=>({...pasta,id:`mix-${i}`,sourceKey:`catalog-mix-test-${i}`,name:`Knorr maaltijdmix ${i}`}));
    const repository={loadCatalog:async()=>({...catalog,recipes:variants,relations:[]})};
    const cache=createWeekPlanningSnapshotCache({persistentRepository:{load:async()=>({available:false,readiness:[],matches:[]})}});
    const found=await searchFreeChoice(week(),0,'Knorr',repository,products,undefined,cache);
    expect(found.map(r=>r.recipe.id)).toEqual(variants.map(r=>r.id));
  });
  it("batches candidate readiness and reuses it across searches", async () => {
    const load = vi.fn(async () => ({ available: false, readiness: [], matches: [] }));
    const search = vi.fn(products.search);
    const cache = createWeekPlanningSnapshotCache({ persistentRepository: { load } });
    const twoRecipes = { ...catalog, recipes: [pasta, { ...pasta, id: "pasta-2" }],
      relations: [...catalog.relations, { ...catalog.relations[0], id: "rel-2", recipeId: "pasta-2" }] };
    const repository = { loadCatalog: async () => twoRecipes };
    const first = await searchFreeChoice(week(), 0, "spaghetti", repository, { ...products, search }, undefined, cache);
    expect(first.filter(result => result.alternative)).toHaveLength(2);
    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]).toBeDefined();
    const calls = search.mock.calls.length;
    await searchFreeChoice(week(), 0, "spaghetti", repository, { ...products, search }, undefined, cache);
    expect(load).toHaveBeenCalledTimes(1);
    expect(search).toHaveBeenCalledTimes(calls);
  });

  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])("hergebruikt persistente readiness voor %i personen zonder live search", async (people) => {
    const saved = rowsForGate(await evaluateRecipeReadiness([pasta], people, catalog, products), people, now);
    let loads = 0;
    let productReads = 0;
    const cache = createWeekPlanningSnapshotCache({ persistentRepository: { load: async (ids, requestedPeople) => {
      loads++;
      expect(ids).toEqual([pasta.id]);
      expect(requestedPeople).toBe(people);
      return { available: true, matches: saved.matchRows as PersistentProductMatchRow[], readiness: saved.readinessRows as PersistentRecipeReadinessRow[] };
    } } });
    const noSearch = { ...products, search: async () => { throw new Error("unexpected live matching"); },
      getByIds: async (ids: string[]) => { productReads++; return products.getByIds(ids); } };
    const current = { ...week(), numberOfPeople: people };
    for (let run = 0; run < 2; run++) {
      const found = await searchFreeChoice(current, 0, "spaghetti", recipes, noSearch, undefined, cache);
      expect(found[0].alternative?.preparation.ingredients[0].requiredQuantity).toBe(people * 100);
      expect(found[0].alternative?.preparation.ingredients[0].purchaseQuantity).toBe(Math.ceil(people / 5));
      expect(found[0].alternative?.alternativeDishCostCents).toBe(200 * Math.ceil(people / 5));
    }
    expect(loads).toBe(1);
    expect(productReads).toBe(1);
  });

  it("valt gericht terug bij verlopen cache en maakt ontbrekende producten niet READY", async () => {
    const saved = rowsForGate(await evaluateRecipeReadiness([pasta], 6, catalog, products), 6, new Date(0));
    const cache = createWeekPlanningSnapshotCache({ persistentRepository: { load: async () => ({
      available: true, matches: [], readiness: saved.readinessRows as PersistentRecipeReadinessRow[],
    }) } });
    const unavailable = { ...products, search: async () => ({ products: [], priceStatus: "complete" as const }) };
    const found = await searchFreeChoice(week(), 0, "spaghetti", recipes, unavailable, undefined, cache);
    expect(found.every((item) => !item.alternative)).toBe(true);
  });
  it("laadt de catalogus en gedeelde ingrediëntzoekopdrachten eenmaal per zoekactie", async () => {
    const variants = [1, 2, 3].map((n) => ({ ...pasta, id: `pasta-${n}` }));
    const many = { ...catalog, recipes: variants, relations: variants.map((r) => ({ ...catalog.relations[0], id: r.id, recipeId: r.id })) };
    let catalogReads = 0;
    let searches = 0;
    const countedRecipes = { loadCatalog: async () => { catalogReads++; return many; } };
    const countedProducts = { ...products, search: async (term: string) => { searches++; return products.search(term); } };
    const found = await searchFreeChoice(week(), 0, "spaghetti", countedRecipes, countedProducts);
    expect(found.filter((item) => item.alternative)).toHaveLength(3);
    console.log(JSON.stringify({ freeChoiceCandidates: 3, catalogReads, searches }));
    expect(catalogReads).toBe(1);
    expect(searches).toBeLessThanOrEqual(2);
  });
  it("zoekt op alle woorden en houdt merken gescheiden", () => {
    expect(recipeMatchesQuery(pasta, "spaghetti")).toBe(true);
    expect(recipeMatchesQuery({ sourceKey: "honig-macaroni", name: "Honig macaroni" }, "Honig spaghetti")).toBe(true);
    expect(recipeMatchesQuery({ sourceKey: "knorr-lasagne-bolognese", name: "Knorr lasagne" }, "Honig lasagne")).toBe(false);
    expect(recipeMatchesQuery({ sourceKey: "knorr-lasagne-bolognese", name: "Knorr lasagne" }, "Knorr lasagne")).toBe(true);
  });
  it("zoekt bestaande recepten en schaalt voor zes personen", async () => {
    const found = await searchFreeChoice(week(), 0, "spaghetti", recipes, products);
    expect(found.filter((item) => item.alternative)).toHaveLength(1);
    expect(found[0].alternative?.preparation.ingredients[0].requiredQuantity).toBe(600);
    expect(found[0].alternative?.preparation.ingredients[0].purchaseQuantity).toBe(2);
    expect(found[0].alternative?.alternativeDishCostCents).toBe(400);
  });
  it("slaat eigen gerecht op via bestaande commit en behoudt het na refresh", async () => {
    const base = week();
    const preview = await previewFreeChoice(base, 0, { customDish: dish }, recipes, products, undefined, now);
    expect(preview).not.toBeNull();
    const committed = await commitExplicitRecipeAlternative(base, 0, preview!, false, recipes, products, undefined, now);
    expect(committed).toMatchObject({ ok: true });
    if (!committed.ok) return;
    const restored = decodeStoredWeekPreparation(encodeStoredWeekPreparation(committed.preparation));
    expect(restored?.days[0].customDish).toEqual(dish);
    const refreshed = await revalidatePreparedWeek(restored!, recipes, products, now);
    expect(refreshed.ready).toBe(true);
    expect(refreshed.preparation.generation?.mealPlanKnownCostCents).toBe(400);
  });
  it("berekent hoeveelheden opnieuw en bewaart een expliciet gekozen product", async () => {
    const changed = { ...dish, ingredients: [{ ...dish.ingredients[0], quantity: 1100, productId: product.id }] };
    const preview = await previewFreeChoice(week(), 0, { customDish: changed }, recipes, products, undefined, now);
    expect(preview?.preparation.ingredients[0].purchaseQuantity).toBe(3);
    expect(preview?.preparation.ingredients[0].product?.productId).toBe(product.id);
  });
  it("ontbrekende match is onvolledig en geen fictieve nulprijs", async () => {
    const missing = { ...dish, ingredients: [{ ...dish.ingredients[0], name: "onbekend ingrediënt" }] };
    expect(await previewFreeChoice(week(), 0, { customDish: missing }, recipes, products, undefined, now)).toBeNull();
    const base = week(); base.days[0] = { ...base.days[0], freeChoice: false, recipeId: "custom", recipe: { id: "custom", name: missing.name, sourceKey: "custom-dish" }, customDish: missing };
    const matched = await matchCustomDishes(base, catalog, products);
    expect(matched[0].productMatchMissing).toBe(true);
    expect(matched[0].price).toBeNull();
  });
  it("valideert naam, verwijderen en ongeldige hoeveelheden", () => {
    expect(validCustomDish(dish)).toBe(true);
    expect(validCustomDish({ ...dish, name: " " })).toBe(false);
    expect(validCustomDish({ ...dish, ingredients: [] })).toBe(false);
    expect(validCustomDish({ ...dish, ingredients: [{ ...dish.ingredients[0], quantity: -1 }] })).toBe(false);
  });
  it("eigen gerecht → bestaand gerecht verwijdert unieke regels, gedeelde en handmatige producten blijven", async () => {
    const first = await previewFreeChoice(week(), 0, { customDish: dish }, recipes, products, undefined, now);
    const both = await previewFreeChoice(first!.preparation, 1, { recipeId: pasta.id }, recipes, products, undefined, now);
    const empty = createEmptyActiveShoppingList(now);
    const manual = addCatalogProduct(empty, product, "catalog", now);
    const synced = completeShoppingListFromWeek(manual, both!.preparation.ingredients, week().id, now);
    const replaced = await previewFreeChoice(both!.preparation, 0, { recipeId: pasta.id }, recipes, products, undefined, now);
    expect(replaced!.preparation.ingredients.some((item) => item.ingredientId.startsWith("custom:"))).toBe(false);
    const resynced = completeShoppingListFromWeek(synced, replaced!.preparation.ingredients, week().id, now);
    expect(resynced.items).toHaveLength(1);
    expect(resynced.items[0].quantityContributions.persistentQuantity).toBe(1);
    expect(resynced.items[0].quantity).toBe(4);
  });
  it("veranderen naar vrije keuze verwijdert het gerecht zonder willekeurig nieuw gerecht", async () => {
    const first = await previewFreeChoice(week(), 0, { customDish: dish }, recipes, products, undefined, now);
    const generated = await generatePreparedWeek({ ...first!.preparation, status: "readyForGeneration" }, recipes, products, now);
    expect(generated.days[0].customDish).toEqual(dish);
    expect(generated.days[1].recipe).toBeNull();
    const changed = changePreparedDayCategory({ ...generated, days: generated.days.map((day) => day.dayIndex === 0 ? { ...day, category: "pasta" } : day) }, 0, "freeChoice", now);
    const validated = await revalidatePreparedWeek(changed, recipes, products, now);
    expect(validated.preparation.ingredients).toHaveLength(0);
    expect(validated.preparation.days.every((day) => !day.recipe)).toBe(true);
  });
  it("vraagt expliciete budgetgoedkeuring", async () => {
    const base = { ...week(), mealBudgetCents: 100 };
    const preview = await previewFreeChoice(base, 0, { customDish: dish }, recipes, products, undefined, now);
    expect(preview?.impact.mealBudgetOverageCents).toBe(300);
    expect((await commitExplicitRecipeAlternative(base, 0, preview!, false, recipes, products, undefined, now)).ok).toBe(false);
    expect((await commitExplicitRecipeAlternative(base, 0, preview!, true, recipes, products, undefined, now)).ok).toBe(true);
  });
  it("een oudere preview overschrijft nooit een inmiddels gekozen andere dag", async () => {
    const base = week();
    const preview = await previewFreeChoice(base, 0, { customDish: dish }, recipes, products, undefined, now);
    const other = await previewFreeChoice(base, 1, { recipeId: pasta.id }, recipes, products, undefined, new Date(now.getTime() + 1000));
    const result = await commitExplicitRecipeAlternative(other!.preparation, 0, preview!, false, recipes, products, undefined, new Date(now.getTime() + 1001));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("budget_impact_changed");
      expect(result.preview?.alternative.preparation.days[1].recipeId).toBe(pasta.id);
    }
  });
  it("onvolledige branded spaghetti heeft geen verzonnen recept of bedrag", async () => {
    const unavailable = { id: "unavailable-mix", sourceKey: "unavailable-mix", name: "Honig spaghetti", brand: "Honig" };
    const results = await searchFreeChoice(week(), 0, "Honig spaghetti", { loadCatalog: async () => ({ ...catalog, unavailableMealMixes: [unavailable] }) }, products);
    expect(results).toHaveLength(1);
    expect(results[0].brand).toBe("Honig");
    expect(results[0].alternative).toBeNull();
  });
});
