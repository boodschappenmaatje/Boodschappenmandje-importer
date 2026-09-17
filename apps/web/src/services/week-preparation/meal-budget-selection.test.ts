import { describe, expect, it } from "vitest";

import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import type { RecipeCatalog, RecipeRepository } from "@/services/week-preparation/recipe-repository";
import { generatePreparedWeek, revalidatePreparedWeek } from "@/services/week-preparation/week-generation";
import {
  createWeekPreparation,
  prepareWeek,
  setCategoryCount,
  setMealBudgetCents,
} from "@/services/week-preparation/week-preparation";
import type { Product, Recipe } from "@/types/catalog";
import type { ActiveShoppingList } from "@/types/shopping-list";

const NOW = new Date("2026-09-17T12:00:00Z");

function recipe(id: string, name: string, budgetTier: Recipe["budgetTier"]): Recipe {
  return {
    id,
    sourceKey: id,
    name,
    normalizedName: name.toLocaleLowerCase("nl-NL"),
    symbol: "fork.knife",
    preparationMinutes: 25,
    vegetarian: false,
    containsPork: false,
    kidFriendly: true,
    healthy: false,
    budgetTier,
  };
}

const EXPENSIVE = recipe("recipe-expensive", "Spaghetti luxe", "premium");
const CHEAP = recipe("recipe-cheap", "Macaroni voordelig", "economical");

const CATALOG: RecipeCatalog = {
  recipes: [EXPENSIVE, CHEAP],
  ingredients: [
    { id: "ingredient-expensive", sourceKey: "luxuryPasta", name: "luxe pasta", normalizedName: "luxe pasta", defaultUnit: "grams", category: "Pasta", aliases: ["luxe pasta"] },
    { id: "ingredient-cheap", sourceKey: "budgetPasta", name: "budget pasta", normalizedName: "budget pasta", defaultUnit: "grams", category: "Pasta", aliases: ["budget pasta"] },
  ],
  relations: [
    { id: "relation-expensive", recipeId: EXPENSIVE.id, ingredientId: "ingredient-expensive", amountPerPerson: 125, unit: "g", position: 0 },
    { id: "relation-cheap", recipeId: CHEAP.id, ingredientId: "ingredient-cheap", amountPerPerson: 125, unit: "g", position: 0 },
  ],
};

function product(id: string, name: string, price: number): Product {
  return {
    id,
    supermarket: "Hoogvliet",
    sku: `sku-${id}`,
    name,
    brand: "Hoogvliet",
    category: "Pasta",
    productType: "Pasta",
    packageText: "500 g",
    weightGrams: 500,
    imageUrl: null,
    sourceUrl: `https://example.test/${id}`,
    isAvailable: true,
    updatedAt: NOW.toISOString(),
    currentPrice: {
      productId: id,
      price,
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

const PRODUCTS = [
  product("product-expensive", "Hoogvliet luxe pasta", 6),
  product("product-cheap", "Hoogvliet budget pasta", 2),
];

const recipeRepository: RecipeRepository = {
  async loadCatalog() { return CATALOG; },
};

const catalogRepository: CatalogRepository = {
  async getPage() { return { products: PRODUCTS, priceStatus: "complete", page: 1, pageSize: 20, hasMore: false }; },
  async getByIds(ids) { return { products: PRODUCTS.filter((item) => ids.includes(item.id)), priceStatus: "complete" }; },
  async query(request = {}) {
    const term = request.term?.toLocaleLowerCase("nl-NL") ?? "";
    const products = PRODUCTS.filter((item) => item.name.toLocaleLowerCase("nl-NL").includes(term));
    return {
      products,
      priceStatus: "complete",
      page: 1,
      pageSize: 20,
      hasMore: false,
      query: { term, category: null, brand: null, offersOnly: false, maxPrice: null, sort: "relevance" },
    };
  },
  async search(term) { return { products: PRODUCTS.filter((item) => item.name.toLocaleLowerCase("nl-NL").includes(term.toLocaleLowerCase("nl-NL"))), priceStatus: "complete" }; },
  async getFilterOptions() { return { categories: ["Pasta"], brands: ["Hoogvliet"] }; },
};

function emptyList(): ActiveShoppingList {
  return { schemaVersion: 1, startedAt: NOW.toISOString(), updatedAt: NOW.toISOString(), items: [] };
}

function prepared(mealBudgetCents: number) {
  let week = createWeekPreparation(
    { schemaVersion: 1, budgetCents: 10_000, people: 4, days: 1 },
    { knownSubtotalCents: 0, unpricedItemCount: 0 },
    NOW,
    `week-${mealBudgetCents}`,
  );
  week = setMealBudgetCents(week, mealBudgetCents, NOW);
  week = setCategoryCount(week, "pasta", 1, NOW);
  return prepareWeek(week, { knownSubtotalCents: 0, unpricedItemCount: 0 }, NOW);
}

describe("budgetbewuste READY-receptselectie", () => {
  it("kiest een andere READY kandidaat binnen dezelfde categorie wanneer de eerste te duur is", async () => {
    const result = await generatePreparedWeek(
      prepared(300),
      recipeRepository,
      catalogRepository,
      NOW,
      emptyList(),
    );
    expect(result.status).toBe("generated");
    expect(result.days[0].recipeId).toBe(CHEAP.id);
    expect(result.generation).toMatchObject({
      mealPlanKnownCostCents: 200,
      mealBudgetRemainingCents: 100,
      mealBudgetStatus: "withinMealBudget",
      isMealBudgetComplete: true,
    });
  });

  it("forceert geen gerecht wanneer geen READY combinatie binnen het budget bestaat", async () => {
    const result = await generatePreparedWeek(
      prepared(100),
      recipeRepository,
      catalogRepository,
      NOW,
      emptyList(),
    );
    expect(result.status).toBe("generationPartial");
    expect(result.days[0]).toMatchObject({ recipeId: null, recipe: null });
    expect(result.ingredients).toEqual([]);
    expect(result.generation?.mealBudgetStatus).toBe("noValidMealPlanWithinBudget");
  });

  it("revalideert een bestaande week na een lager maaltijd-budget zonder stilzwijgend te vervangen", async () => {
    const generated = await generatePreparedWeek(
      prepared(300),
      recipeRepository,
      catalogRepository,
      NOW,
      emptyList(),
    );
    const lowered = { ...generated, mealBudgetCents: 100 };
    const validation = await revalidatePreparedWeek(
      lowered,
      recipeRepository,
      catalogRepository,
      new Date("2026-09-17T13:00:00Z"),
      emptyList(),
    );
    expect(validation.ready).toBe(false);
    expect(validation.preparation.days[0].recipeId).toBe(CHEAP.id);
    expect(validation.preparation.generation?.mealBudgetStatus).toBe("overMealBudget");
  });
});
