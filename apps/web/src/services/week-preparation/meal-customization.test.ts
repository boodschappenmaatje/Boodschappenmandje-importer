import { describe, expect, it } from "vitest";

import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import {
  findRecipeAlternatives,
  replaceWeekRecipe,
} from "@/services/week-preparation/meal-customization";
import type {
  RecipeCatalog,
  RecipeRepository,
} from "@/services/week-preparation/recipe-repository";
import { revalidatePreparedWeek } from "@/services/week-preparation/week-generation";
import { createWeekPreparation } from "@/services/week-preparation/week-preparation";
import type { Product, Recipe } from "@/types/catalog";
import type { ActiveShoppingList } from "@/types/shopping-list";

const NOW = new Date("2026-09-17T12:00:00Z");
const recipe = (id: string, sourceKey: string, name: string): Recipe => ({
  id,
  sourceKey,
  name,
  normalizedName: name.toLocaleLowerCase("nl-NL"),
  symbol: "fork.knife",
  preparationMinutes: 20,
  vegetarian: false,
  containsPork: false,
  kidFriendly: true,
  healthy: false,
  budgetTier: "economical",
});
const SPAGHETTI = recipe("recipe-spaghetti", "spaghetti", "Spaghetti bolognese");
const MACARONI = recipe("recipe-macaroni", "macaroni", "Macaroni met groente");
const NOT_READY = recipe("recipe-lasagne", "lasagne", "Lasagne zonder product");

const catalog: RecipeCatalog = {
  recipes: [SPAGHETTI, MACARONI, NOT_READY],
  ingredients: [
    { id: "ingredient-spaghetti", sourceKey: "spaghetti", name: "spaghetti", normalizedName: "spaghetti", defaultUnit: "g", category: "Pasta, rijst & granen", aliases: ["spaghetti"] },
    { id: "ingredient-macaroni", sourceKey: "macaroni", name: "macaroni", normalizedName: "macaroni", defaultUnit: "g", category: "Pasta, rijst & granen", aliases: ["macaroni"] },
    { id: "ingredient-lasagne", sourceKey: "lasagne", name: "lasagnebladen", normalizedName: "lasagnebladen", defaultUnit: "g", category: "Pasta, rijst & granen", aliases: ["lasagnebladen"] },
  ],
  relations: [
    { id: "relation-spaghetti", recipeId: SPAGHETTI.id, ingredientId: "ingredient-spaghetti", amountPerPerson: 100, unit: "g", position: 0 },
    { id: "relation-macaroni", recipeId: MACARONI.id, ingredientId: "ingredient-macaroni", amountPerPerson: 100, unit: "g", position: 0 },
    { id: "relation-lasagne", recipeId: NOT_READY.id, ingredientId: "ingredient-lasagne", amountPerPerson: 100, unit: "g", position: 0 },
  ],
};

function product(id: string, name: string, cents: number): Product {
  return {
    id,
    sku: `sku-${id}`,
    name,
    supermarket: "Hoogvliet",
    brand: "G'woon",
    category: "Pasta, rijst & granen/Pasta",
    productType: "Pasta",
    packageText: "500 g",
    weightGrams: 500,
    imageUrl: null,
    sourceUrl: `https://example.test/${id}`,
    isAvailable: true,
    updatedAt: NOW.toISOString(),
    currentPrice: {
      productId: id,
      price: cents / 100,
      oldPrice: null,
      isOffer: false,
      offerText: null,
      validFrom: null,
      validUntil: null,
      fetchedAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
  };
}

const products = [
  product("product-spaghetti", "G'woon spaghetti", 149),
  product("product-macaroni", "G'woon macaroni", 129),
];

const recipeRepository: RecipeRepository = { async loadCatalog() { return catalog; } };
const catalogRepository: CatalogRepository = {
  async getPage() { return { products, priceStatus: "complete", page: 1, pageSize: 20, hasMore: false }; },
  async getByIds(ids) { return { products: products.filter((item) => ids.includes(item.id)), priceStatus: "complete" }; },
  async query() { throw new Error("unused"); },
  async search(term) { return { products: products.filter((item) => item.name.toLowerCase().includes(term.toLowerCase())), priceStatus: "complete" }; },
  async getFilterOptions() { return { categories: [], brands: [] }; },
};
const list: ActiveShoppingList = {
  schemaVersion: 2,
  startedAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  items: [],
};

async function preparedWeek() {
  const base = createWeekPreparation(
    { schemaVersion: 1, people: 4, days: 1, budgetCents: 10_000 },
    { knownSubtotalCents: 0, unpricedItemCount: 0 },
    NOW,
    "week-pwa12",
  );
  const selected = {
    ...base,
    mealBudgetCents: 500,
    days: [{
      dayIndex: 0,
      category: "pasta" as const,
      freeChoice: false,
      recipeId: SPAGHETTI.id,
      recipe: { id: SPAGHETTI.id, sourceKey: SPAGHETTI.sourceKey, name: SPAGHETTI.name },
      status: "recipeSelected" as const,
    }],
    status: "generated" as const,
  };
  return (await revalidatePreparedWeek(selected, recipeRepository, catalogRepository, NOW, list)).preparation;
}

describe("PWA 12 maaltijdcustomization", () => {
  it("biedt alleen actuele READY alternatieven uit dezelfde categorie aan", async () => {
    const alternatives = await findRecipeAlternatives(
      await preparedWeek(), 0, recipeRepository, catalogRepository, list, NOW,
    );
    expect(alternatives.map((item) => item.recipe.id)).toEqual([MACARONI.id]);
    expect(alternatives[0]).toMatchObject({ withinMealBudget: true, alreadyUsedInWeek: false });
  });

  it("vervangt atomair, bewaart de basisreferentie en herberekent integer-centkosten", async () => {
    const original = await preparedWeek();
    const result = await replaceWeekRecipe(
      original, 0, MACARONI.id, recipeRepository, catalogRepository, list, NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preparation.days[0].recipeId).toBe(MACARONI.id);
    expect(result.preparation.generation?.mealPlanKnownCostCents).toBe(129);
    expect(result.preparation.customizations[0]).toMatchObject({
      dayIndex: 0,
      baseRecipe: { id: SPAGHETTI.id },
      replacementRecipe: { id: MACARONI.id },
    });
  });

  it("weigert een NOT READY recept opnieuw vlak voor bevestiging", async () => {
    const result = await replaceWeekRecipe(
      await preparedWeek(), 0, NOT_READY.id, recipeRepository, catalogRepository, list, NOW,
    );
    expect(result).toEqual({ ok: false, reason: "recipe_not_ready" });
  });
});
