import { describe, expect, it } from "vitest";

import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import {
  createCachedCatalogRepository,
  createCachedRecipeRepository,
  createWeekPlanningSnapshotCache,
} from "@/services/week-preparation/planning-cache";
import type {
  RecipeCatalog,
  RecipeRepository,
} from "@/services/week-preparation/recipe-repository";
import type { Product, Recipe } from "@/types/catalog";

const EMPTY_CATALOG: RecipeCatalog = {
  recipes: [],
  ingredients: [],
  relations: [],
};

function product(id: string): Product {
  return {
    id,
    supermarket: "Hoogvliet",
    sku: `sku-${id}`,
    name: id,
    brand: null,
    category: null,
    productType: null,
    packageText: "1 stuk",
    weightGrams: null,
    imageUrl: null,
    sourceUrl: `https://example.test/${id}`,
    isAvailable: true,
    updatedAt: "2026-09-18T10:00:00.000Z",
    currentPrice: null,
  };
}

describe("weekplanning request-cache", () => {
  it("dedupliceert gelijktijdige en herhaalde receptcatalogus-reads binnen de TTL", async () => {
    let loads = 0;
    let now = 1_000;
    const source: RecipeRepository = {
      async loadCatalog() {
        loads += 1;
        return EMPTY_CATALOG;
      },
    };
    const cached = createCachedRecipeRepository(source, {
      ttlMs: 500,
      now: () => now,
    });

    await Promise.all([cached.loadCatalog(), cached.loadCatalog()]);
    await cached.loadCatalog();
    expect(loads).toBe(1);

    now += 501;
    await cached.loadCatalog();
    expect(loads).toBe(2);
  });

  it("hergebruikt matcherzoekresultaten en exacte productbatches zonder Producten-query te cachen", async () => {
    let searches = 0;
    let idReads = 0;
    let queries = 0;
    const products = [product("a"), product("b")];
    const source: CatalogRepository = {
      async getPage() {
        return { products, priceStatus: "complete", page: 1, pageSize: 20, hasMore: false };
      },
      async getByIds(ids) {
        idReads += 1;
        return { products: products.filter((item) => ids.includes(item.id)), priceStatus: "complete" };
      },
      async query() {
        queries += 1;
        return {
          products,
          priceStatus: "complete",
          page: 1,
          pageSize: 20,
          hasMore: false,
          query: { term: "", category: null, brand: null, offersOnly: false, maxPrice: null, sort: "relevance" },
        };
      },
      async search() {
        searches += 1;
        return { products, priceStatus: "complete" };
      },
      async getFilterOptions() {
        return { categories: [], brands: [] };
      },
    };
    const cached = createCachedCatalogRepository(source);

    await Promise.all([
      cached.search("Aardappel", { limit: 12 }),
      cached.search("aardappel", { limit: 12 }),
    ]);
    await cached.getByIds(["b", "a"]);
    await cached.getByIds(["a", "b", "a"]);
    await cached.query({ term: "aardappel" });
    await cached.query({ term: "aardappel" });

    expect({ searches, idReads, queries }).toEqual({
      searches: 1,
      idReads: 1,
      queries: 2,
    });
  });

  it("hergebruikt READY-resultaten per recept en vult alleen een nieuwe categorie aan", async () => {
    let searches = 0;
    let now = 1_000;
    const recipes: Recipe[] = [
      {
        id: "recipe-a",
        sourceKey: "recipeA",
        name: "Pasta A",
        normalizedName: "pasta a",
        symbol: "fork.knife",
        preparationMinutes: 20,
        vegetarian: false,
        containsPork: false,
        kidFriendly: true,
        healthy: false,
        budgetTier: "economical",
      },
      {
        id: "recipe-b",
        sourceKey: "recipeB",
        name: "Snel B",
        normalizedName: "snel b",
        symbol: "fork.knife",
        preparationMinutes: 20,
        vegetarian: false,
        containsPork: false,
        kidFriendly: true,
        healthy: false,
        budgetTier: "economical",
      },
    ];
    const sourceCatalog: RecipeCatalog = {
      recipes,
      ingredients: recipes.map((recipe) => ({
        id: `ingredient-${recipe.id}`,
        sourceKey: `ingredient-${recipe.id}`,
        name: `product ${recipe.id}`,
        normalizedName: `product ${recipe.id}`,
        defaultUnit: "piece",
        category: "Maaltijdcomponenten",
        aliases: [`product ${recipe.id}`],
      })),
      relations: recipes.map((recipe, index) => ({
        id: `relation-${recipe.id}`,
        recipeId: recipe.id,
        ingredientId: `ingredient-${recipe.id}`,
        amountPerPerson: 1,
        unit: "piece" as const,
        position: index,
      })),
    };
    const products = recipes.map((recipe) => ({
      ...product(`product-${recipe.id}`),
      name: `product ${recipe.id}`,
      packageText: "1 stuk",
    }));
    const source: CatalogRepository = {
      async getPage() {
        return { products, priceStatus: "complete", page: 1, pageSize: 20, hasMore: false };
      },
      async getByIds(ids) {
        return { products: products.filter((item) => ids.includes(item.id)), priceStatus: "complete" };
      },
      async query() {
        return {
          products,
          priceStatus: "complete",
          page: 1,
          pageSize: 20,
          hasMore: false,
          query: { term: "", category: null, brand: null, offersOnly: false, maxPrice: null, sort: "relevance" },
        };
      },
      async search(term) {
        searches += 1;
        return {
          products: products.filter((item) =>
            item.name.toLocaleLowerCase("nl-NL").includes(term.toLocaleLowerCase("nl-NL")),
          ),
          priceStatus: "complete",
        };
      },
      async getFilterOptions() {
        return { categories: [], brands: [] };
      },
    };
    const cachedCatalog = createCachedCatalogRepository(source, {
      ttlMs: 500,
      now: () => now,
    });
    const snapshots = createWeekPlanningSnapshotCache({
      ttlMs: 500,
      now: () => now,
    });
    const preparedCatalog = snapshots.prepareCatalog(sourceCatalog, () => sourceCatalog);

    const first = await snapshots.evaluateReadiness(
      sourceCatalog,
      [recipes[0]],
      4,
      preparedCatalog,
      cachedCatalog,
    );
    const second = await snapshots.evaluateReadiness(
      sourceCatalog,
      recipes,
      4,
      preparedCatalog,
      cachedCatalog,
    );
    const third = await snapshots.evaluateReadiness(
      sourceCatalog,
      recipes,
      4,
      preparedCatalog,
      cachedCatalog,
    );
    const searchesBeforePeopleChange = searches;
    const peopleChanged = await snapshots.evaluateReadiness(
      sourceCatalog,
      recipes,
      5,
      preparedCatalog,
      cachedCatalog,
    );

    expect(first).toMatchObject({ hitCount: 0, missCount: 1 });
    expect(second).toMatchObject({ hitCount: 1, missCount: 1 });
    expect(third).toMatchObject({ hitCount: 2, missCount: 0 });
    expect(peopleChanged).toMatchObject({ hitCount: 0, missCount: 2 });
    expect(searches).toBe(searchesBeforePeopleChange);

    products[0] = { ...products[0], currentPrice: { productId: products[0].id,
      price: 1.99, oldPrice: null, isOffer: false, offerText: null, validFrom: null,
      validUntil: null, fetchedAt: new Date(now).toISOString(), updatedAt: new Date(now).toISOString() } };
    cachedCatalog.invalidateProducts?.([products[0].id]);
    snapshots.invalidateProducts([products[0].id]);
    await Promise.resolve();
    const repriced = await snapshots.evaluateReadiness(sourceCatalog, recipes, 4, preparedCatalog, cachedCatalog);
    expect(repriced).toMatchObject({ hitCount: 1, missCount: 1 });
    expect(repriced.gate.recipes.find(item => item.recipeId === recipes[0].id)?.ready).toBe(true);
    expect([...repriced.gate.matchedProductsByRequirement.values()].find(item => item.id === products[0].id)?.currentPrice?.price).toBe(1.99);

    now += 501;
    const expired = await snapshots.evaluateReadiness(
      sourceCatalog,
      recipes,
      4,
      preparedCatalog,
      cachedCatalog,
    );
    expect(expired).toMatchObject({ hitCount: 0, missCount: 2 });
    expect(searches).toBeGreaterThan(searchesBeforePeopleChange);
  });

  it("dedupliceert twee gelijktijdige READY-aanvragen", async () => {
    let searches = 0;
    const recipe: Recipe = {
      id: "recipe-concurrent",
      sourceKey: "recipeConcurrent",
      name: "Pasta concurrent",
      normalizedName: "pasta concurrent",
      symbol: "fork.knife",
      preparationMinutes: 20,
      vegetarian: false,
      containsPork: false,
      kidFriendly: true,
      healthy: false,
      budgetTier: "economical",
    };
    const catalog: RecipeCatalog = {
      recipes: [recipe],
      ingredients: [{
        id: "ingredient-concurrent",
        sourceKey: "ingredientConcurrent",
        name: "concurrent product",
        normalizedName: "concurrent product",
        defaultUnit: "piece",
        category: "Maaltijdcomponenten",
        aliases: ["concurrent product"],
      }],
      relations: [{
        id: "relation-concurrent",
        recipeId: recipe.id,
        ingredientId: "ingredient-concurrent",
        amountPerPerson: 1,
        unit: "piece",
        position: 0,
      }],
    };
    const found = { ...product("concurrent"), name: "concurrent product" };
    const repository: CatalogRepository = {
      async getPage() { return { products: [found], priceStatus: "complete", page: 1, pageSize: 20, hasMore: false }; },
      async getByIds() { return { products: [found], priceStatus: "complete" }; },
      async query() { return { products: [found], priceStatus: "complete", page: 1, pageSize: 20, hasMore: false, query: { term: "", category: null, brand: null, offersOnly: false, maxPrice: null, sort: "relevance" } }; },
      async search() {
        searches += 1;
        await Promise.resolve();
        return { products: [found], priceStatus: "complete" };
      },
      async getFilterOptions() { return { categories: [], brands: [] }; },
    };
    const snapshots = createWeekPlanningSnapshotCache();

    await Promise.all([
      snapshots.evaluateReadiness(catalog, [recipe], 4, catalog, repository),
      snapshots.evaluateReadiness(catalog, [recipe], 4, catalog, repository),
    ]);

    expect(searches).toBe(1);
  });
});
