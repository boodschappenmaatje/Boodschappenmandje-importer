import { describe, expect, it } from "vitest";

import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import type { RecipeCatalog, RecipeRepository } from "@/services/week-preparation/recipe-repository";
import {
  createCachedCatalogRepository,
  createCachedRecipeRepository,
} from "@/services/week-preparation/planning-cache";
import { generatePreparedWeek, refreshGeneratedWeek, revalidatePreparedWeek } from "@/services/week-preparation/week-generation";
import {
  createWeekPreparation,
  prepareWeek,
  setCategoryCount,
  setMealBudgetCents,
} from "@/services/week-preparation/week-preparation";
import type { Product, Recipe } from "@/types/catalog";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type { MealCategory } from "@/types/week-preparation";

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
const INCOMPLETE = recipe("recipe-incomplete", "Pasta zonder product", "economical");

const CATALOG: RecipeCatalog = {
  recipes: [EXPENSIVE, CHEAP, INCOMPLETE],
  ingredients: [
    { id: "ingredient-expensive", sourceKey: "luxuryPasta", name: "luxe pasta", normalizedName: "luxe pasta", defaultUnit: "grams", category: "Pasta", aliases: ["luxe pasta"] },
    { id: "ingredient-cheap", sourceKey: "budgetPasta", name: "budget pasta", normalizedName: "budget pasta", defaultUnit: "grams", category: "Pasta", aliases: ["budget pasta"] },
    { id: "ingredient-incomplete", sourceKey: "missingPasta", name: "onvindbare pasta", normalizedName: "onvindbare pasta", defaultUnit: "grams", category: "Pasta", aliases: ["onvindbare pasta"] },
  ],
  relations: [
    { id: "relation-expensive", recipeId: EXPENSIVE.id, ingredientId: "ingredient-expensive", amountPerPerson: 125, unit: "g", position: 0 },
    { id: "relation-cheap", recipeId: CHEAP.id, ingredientId: "ingredient-cheap", amountPerPerson: 125, unit: "g", position: 0 },
    { id: "relation-incomplete", recipeId: INCOMPLETE.id, ingredientId: "ingredient-incomplete", amountPerPerson: 125, unit: "g", position: 0 },
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
  return { schemaVersion: 2, startedAt: NOW.toISOString(), updatedAt: NOW.toISOString(), items: [] };
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

function preparedDays(mealBudgetCents: number, categories: MealCategory[]) {
  let week = createWeekPreparation(
    { schemaVersion: 1, budgetCents: 10_000, people: 4, days: categories.length },
    { knownSubtotalCents: 0, unpricedItemCount: 0 },
    NOW,
    `week-${mealBudgetCents}-${categories.join("-")}`,
  );
  week = setMealBudgetCents(week, mealBudgetCents, NOW);
  for (const category of new Set(categories)) {
    week = setCategoryCount(
      week,
      category,
      categories.filter((item) => item === category).length,
      NOW,
    );
  }
  return prepareWeek(week, { knownSubtotalCents: 0, unpricedItemCount: 0 }, NOW);
}

function fixture(
  definitions: Array<{
    id: string;
    name: string;
    price: number | null;
    preparationMinutes?: number;
  }>,
): { recipeRepository: RecipeRepository; catalogRepository: CatalogRepository } {
  const recipes = definitions.map((definition) => ({
    ...recipe(definition.id, definition.name, "economical"),
    preparationMinutes: definition.preparationMinutes ?? 20,
  }));
  const ingredients = definitions.map((definition) => ({
    id: `ingredient-${definition.id}`,
    sourceKey: `ingredient-${definition.id}`,
    name: `ingrediënt ${definition.id}`,
    normalizedName: `ingredient ${definition.id}`,
    defaultUnit: "grams",
    category: "Pasta",
    aliases: [`ingrediënt ${definition.id}`],
  }));
  const relations = definitions.map((definition, index) => ({
    id: `relation-${definition.id}`,
    recipeId: definition.id,
    ingredientId: `ingredient-${definition.id}`,
    amountPerPerson: 125,
    unit: "g" as const,
    position: index,
  }));
  const products = definitions.flatMap((definition) =>
    definition.price === null
      ? []
      : [product(
          `product-${definition.id}`,
          `Hoogvliet ingrediënt ${definition.id}`,
          definition.price,
        )],
  );
  const catalog: RecipeCatalog = { recipes, ingredients, relations };
  return {
    recipeRepository: {
      async loadCatalog() { return catalog; },
    },
    catalogRepository: {
      async getPage() {
        return { products, priceStatus: "complete", page: 1, pageSize: 100, hasMore: false };
      },
      async getByIds(ids) {
        return { products: products.filter((item) => ids.includes(item.id)), priceStatus: "complete" };
      },
      async query(request = {}) {
        const term = request.term?.toLocaleLowerCase("nl-NL") ?? "";
        const matches = products.filter((item) =>
          item.name.toLocaleLowerCase("nl-NL").includes(term)
        );
        return {
          products: matches,
          priceStatus: "complete",
          page: 1,
          pageSize: 100,
          hasMore: false,
          query: { term, category: null, brand: null, offersOnly: false, maxPrice: null, sort: "relevance" },
        };
      },
      async search(term) {
        const normalized = term.toLocaleLowerCase("nl-NL");
        return {
          products: products.filter((item) =>
            item.name.toLocaleLowerCase("nl-NL").includes(normalized)
          ),
          priceStatus: "complete",
        };
      },
      async getFilterOptions() { return { categories: ["Pasta"], brands: ["Hoogvliet"] }; },
    },
  };
}

function selectedRecipeIds(result: Awaited<ReturnType<typeof generatePreparedWeek>>): string[] {
  return result.days
    .map((day) => day.recipeId)
    .filter((recipeId): recipeId is string => recipeId !== null);
}

describe("budgetbewuste READY-receptselectie", () => {
  it("hergebruikt recipe- en productdata wanneer alleen het maaltijd-budget opnieuw wordt geoptimaliseerd", async () => {
    let recipeLoads = 0;
    let searches = 0;
    const countedRecipes: RecipeRepository = {
      async loadCatalog() {
        recipeLoads += 1;
        return CATALOG;
      },
    };
    const countedCatalog: CatalogRepository = {
      ...catalogRepository,
      async search(term) {
        searches += 1;
        return catalogRepository.search(term);
      },
    };
    const cachedRecipes = createCachedRecipeRepository(countedRecipes);
    const cachedCatalog = createCachedCatalogRepository(countedCatalog);

    const first = await generatePreparedWeek(
      prepared(300),
      cachedRecipes,
      cachedCatalog,
      NOW,
      emptyList(),
    );
    const firstCounts = { recipeLoads, searches };
    const second = await generatePreparedWeek(
      prepared(700),
      cachedRecipes,
      cachedCatalog,
      NOW,
      emptyList(),
    );

    expect(first.status).toBe("generated");
    expect(second.status).toBe("generated");
    expect(firstCounts.recipeLoads).toBe(1);
    expect(firstCounts.searches).toBeGreaterThan(0);
    expect({ recipeLoads, searches }).toEqual(firstCounts);
  });

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
      readinessByCategory: [{ category: "pasta", candidateCount: 3, readyCount: 2 }],
      lowestCompleteMealPlanCostCents: 200,
      lowestCompleteMealPlanCostReliable: true,
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
    expect(result.generation).toMatchObject({
      readinessByCategory: [{ category: "pasta", candidateCount: 3, readyCount: 2 }],
      lowestCompleteMealPlanCostCents: 200,
      lowestCompleteMealPlanCostReliable: true,
    });
  });

  it.each([
    { budget: 199, valid: false, status: "noValidMealPlanWithinBudget" },
    { budget: 200, valid: true, status: "exactlyMealBudget" },
    { budget: 201, valid: true, status: "withinMealBudget" },
  ] as const)(
    "respecteert de integer-cent grens bij een minimum van 200 cent: $budget",
    async ({ budget, valid, status }) => {
      const result = await generatePreparedWeek(
        prepared(budget),
        recipeRepository,
        catalogRepository,
        NOW,
        emptyList(),
      );
      expect(result.status === "generated").toBe(valid);
      expect(result.generation?.mealBudgetStatus).toBe(status);
      expect(result.generation?.lowestCompleteMealPlanCostCents).toBe(200);
    },
  );

  it("houdt een echte readiness-leegte apart van budgetfalen", async () => {
    const unavailableRepository: CatalogRepository = {
      ...catalogRepository,
      async getPage() { return { products: [], priceStatus: "complete", page: 1, pageSize: 20, hasMore: false }; },
      async getByIds() { return { products: [], priceStatus: "complete" }; },
      async query(request = {}) {
        return {
          products: [],
          priceStatus: "complete",
          page: 1,
          pageSize: 20,
          hasMore: false,
          query: { term: request.term ?? "", category: null, brand: null, offersOnly: false, maxPrice: null, sort: "relevance" },
        };
      },
      async search() { return { products: [], priceStatus: "complete" }; },
    };
    const result = await generatePreparedWeek(
      prepared(5_000),
      recipeRepository,
      unavailableRepository,
      NOW,
      emptyList(),
    );
    expect(result.generation).toMatchObject({
      mealBudgetStatus: "incompleteValidation",
      readinessByCategory: [{ category: "pasta", candidateCount: 3, readyCount: 0 }],
      lowestCompleteMealPlanCostCents: null,
    });
  });

  it.each([
    { budget: 5_000, expectedStatus: "withinMealBudget" },
    { budget: 6_000, expectedStatus: "withinMealBudget" },
    { budget: 7_000, expectedStatus: "withinMealBudget" },
  ] as const)(
    "blijft bij €$budget binnen de READY selectie en dezelfde categorie",
    async ({ budget, expectedStatus }) => {
      const result = await generatePreparedWeek(
        prepared(budget),
        recipeRepository,
        catalogRepository,
        NOW,
        emptyList(),
      );
      expect(result.generation?.mealBudgetStatus).toBe(expectedStatus);
      expect(result.days[0]).toMatchObject({ category: "pasta", recipeId: CHEAP.id });
    },
  );

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

  it("hervat een lege budgetgeblokkeerde week wanneer een hoger budget wel past", async () => {
    const blocked = await generatePreparedWeek(
      prepared(100),
      recipeRepository,
      catalogRepository,
      NOW,
      emptyList(),
    );
    const raised = { ...blocked, mealBudgetCents: 200 };
    const refreshed = await refreshGeneratedWeek(
      raised,
      recipeRepository,
      catalogRepository,
      new Date("2026-09-17T13:00:00Z"),
      emptyList(),
    );
    expect(refreshed.status).toBe("generated");
    expect(refreshed.days[0].recipeId).toBe(CHEAP.id);
    expect(refreshed.generation).toMatchObject({
      mealBudgetStatus: "exactlyMealBudget",
      mealPlanKnownCostCents: 200,
    });
  });

  it("kiest bij zeven dagen eerst een volledig unieke READY-combinatie binnen budget", async () => {
    const repositories = fixture(
      Array.from({ length: 7 }, (_, index) => ({
        id: `recipe-variation-${index + 1}`,
        name: `Pasta variatie ${index + 1}`,
        price: 1,
      })),
    );
    const result = await generatePreparedWeek(
      preparedDays(5_000, Array.from({ length: 7 }, () => "pasta" as const)),
      repositories.recipeRepository,
      repositories.catalogRepository,
      NOW,
      emptyList(),
    );
    const ids = selectedRecipeIds(result);

    expect(result.status).toBe("generated");
    expect(ids).toHaveLength(7);
    expect(new Set(ids)).toHaveLength(7);
    expect(result.generation?.mealPlanKnownCostCents).toBe(700);
  });

  it("staat één dubbel READY-gerecht toe wanneer de unieke combinatie te duur is", async () => {
    const result = await generatePreparedWeek(
      preparedDays(400, ["pasta", "pasta"]),
      recipeRepository,
      catalogRepository,
      NOW,
      emptyList(),
    );
    const ids = selectedRecipeIds(result);

    expect(result.status).toBe("generated");
    expect(ids).toEqual([CHEAP.id, CHEAP.id]);
    expect(result.generation?.mealPlanKnownCostCents).toBe(400);
  });

  it("kiest de unieke combinatie zodra die exact binnen het maaltijd-budget past", async () => {
    const result = await generatePreparedWeek(
      preparedDays(800, ["pasta", "pasta"]),
      recipeRepository,
      catalogRepository,
      NOW,
      emptyList(),
    );
    const ids = selectedRecipeIds(result);

    expect(result.status).toBe("generated");
    expect(new Set(ids)).toHaveLength(2);
    expect(result.generation?.mealPlanKnownCostCents).toBe(800);
  });

  it("gebruikt liever een dubbel READY-recept dan een uniek NOT READY alternatief", async () => {
    const repositories = fixture([
      { id: "recipe-ready-pasta", name: "Pasta compleet", price: 2 },
      { id: "recipe-incomplete-pasta", name: "Pasta zonder product", price: null },
    ]);
    const result = await generatePreparedWeek(
      preparedDays(400, ["pasta", "pasta"]),
      repositories.recipeRepository,
      repositories.catalogRepository,
      NOW,
      emptyList(),
    );
    const ids = selectedRecipeIds(result);

    expect(result.status).toBe("generated");
    expect(ids).toEqual(["recipe-ready-pasta", "recipe-ready-pasta"]);
  });

  it("verandert geen categorie om een dubbel gerecht te vermijden", async () => {
    const repositories = fixture([
      { id: "recipe-shared", name: "Pasta rijst basis", price: 2 },
      { id: "recipe-wrong-category", name: "Hamburger alternatief", price: 2, preparationMinutes: 35 },
    ]);
    const result = await generatePreparedWeek(
      preparedDays(400, ["pasta", "rice"]),
      repositories.recipeRepository,
      repositories.catalogRepository,
      NOW,
      emptyList(),
    );

    expect(result.status).toBe("generated");
    expect(result.days.map((day) => day.category)).toEqual(["pasta", "rice"]);
    expect(selectedRecipeIds(result)).toEqual(["recipe-shared", "recipe-shared"]);
  });

  it("minimaliseert het aantal herhalingen wanneer volledige uniciteit onmogelijk is", async () => {
    const repositories = fixture([
      { id: "recipe-one", name: "Pasta één", price: 1 },
      { id: "recipe-two", name: "Pasta twee", price: 1 },
      { id: "recipe-three", name: "Pasta drie", price: 1 },
    ]);
    const result = await generatePreparedWeek(
      preparedDays(1_000, ["pasta", "pasta", "pasta", "pasta"]),
      repositories.recipeRepository,
      repositories.catalogRepository,
      NOW,
      emptyList(),
    );
    const ids = selectedRecipeIds(result);

    expect(result.status).toBe("generated");
    expect(ids).toHaveLength(4);
    expect(new Set(ids)).toHaveLength(3);
    expect(ids.length - new Set(ids).size).toBe(1);
  });
});
