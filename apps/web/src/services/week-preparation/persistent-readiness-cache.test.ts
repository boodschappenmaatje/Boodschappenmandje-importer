import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import {
  PLANNER_MATCHER_VERSION,
  PLANNER_READINESS_EVALUATOR_VERSION,
  SupabasePersistentRecipeReadinessRepository,
  resolveRecipeReadiness,
  type PersistentProductMatchRow,
  type PersistentRecipeReadinessRepository,
  type PersistentRecipeReadinessRow,
} from "@/services/week-preparation/persistent-readiness-cache";
import type {
  RecipeCatalog,
  RecipeIngredientDefinition,
} from "@/services/week-preparation/recipe-repository";
import type { Product, Recipe, RecipeIngredient } from "@/types/catalog";

const NOW = new Date("2026-09-19T12:00:00.000Z");

function recipe(id: string): Recipe {
  return {
    id,
    sourceKey: id,
    name: id,
    normalizedName: id,
    symbol: "fork.knife",
    preparationMinutes: 20,
    vegetarian: false,
    containsPork: false,
    kidFriendly: true,
    healthy: false,
    budgetTier: "economical",
  };
}

function ingredient(id: string): RecipeIngredientDefinition {
  return {
    id,
    sourceKey: id,
    name: id,
    normalizedName: id,
    defaultUnit: "pieces",
    category: "Maaltijdcomponenten",
    aliases: [id],
  };
}

function relation(recipeId: string, ingredientId: string): RecipeIngredient {
  return {
    id: `${recipeId}-${ingredientId}`,
    recipeId,
    ingredientId,
    amountPerPerson: 1,
    unit: "piece",
    position: 0,
    optional: false,
  };
}

function product(id: string): Product {
  return {
    id: `product-${id}`,
    supermarket: "Hoogvliet",
    sku: `sku-${id}`,
    name: id,
    brand: null,
    category: "Maaltijdcomponenten",
    productType: id,
    packageText: "1 stuk",
    weightGrams: null,
    imageUrl: null,
    sourceUrl: `https://example.test/${id}`,
    isAvailable: true,
    updatedAt: NOW.toISOString(),
    currentPrice: {
      productId: `product-${id}`,
      price: 1.25,
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

function catalog(recipeIds: string[], sharedIngredient = false): RecipeCatalog {
  const recipes = recipeIds.map(recipe);
  const ingredients = sharedIngredient
    ? [ingredient("gedeeld")]
    : recipeIds.map(ingredient);
  return {
    recipes,
    ingredients,
    relations: recipes.map((item) =>
      relation(item.id, sharedIngredient ? "gedeeld" : item.id),
    ),
  };
}

function repository(products: Product[], counters: { searches: number; batches: number }): CatalogRepository {
  return {
    async getPage() {
      return { products, priceStatus: "complete", page: 1, pageSize: 20, hasMore: false };
    },
    async getByIds(ids) {
      counters.batches += 1;
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
      counters.searches += 1;
      return {
        products: products.filter((item) => item.name.includes(term)),
        priceStatus: "complete",
      };
    },
    async getFilterOptions() {
      return { categories: [], brands: [] };
    },
  };
}

function matchRow(ingredientId: string, matchedProduct: Product | null): PersistentProductMatchRow {
  return {
    match_key: `${ingredientId}:piece:ingredient:generic`,
    ingredient_id: ingredientId,
    ingredient_source_key: "ingredient",
    requirement_unit: "piece",
    requirement_kind: "ingredient",
    brand_constraint: "",
    product_id: matchedProduct?.id ?? null,
    match_status: matchedProduct ? "valid" : "invalid",
    failure_reason: matchedProduct ? null : "no_catalog_product",
    matcher_version: PLANNER_MATCHER_VERSION,
    refresh_status: "current",
    invalidated_at: null,
    product_updated_at: matchedProduct?.updatedAt ?? null,
    price_updated_at: matchedProduct?.currentPrice?.updatedAt ?? null,
    checked_at: NOW.toISOString(),
  };
}

function readinessRow(
  recipeData: Recipe,
  ingredientData: RecipeIngredientDefinition,
  matchedProduct: Product | null,
): PersistentRecipeReadinessRow {
  const key = `${ingredientData.id}:piece:ingredient:generic`;
  const ready = matchedProduct !== null;
  return {
    recipe_id: recipeData.id,
    people_count: 4,
    readiness_status: ready ? "READY" : "NOT_READY",
    required_ingredient_count: 1,
    ready_required_ingredient_count: ready ? 1 : 0,
    problem_count: ready ? 0 : 1,
    readiness_payload: {
      recipeId: recipeData.id,
      recipeSourceKey: recipeData.sourceKey,
      recipeName: recipeData.name,
      ready,
      requiredIngredientCount: 1,
      readyRequiredIngredientCount: ready ? 1 : 0,
      problemCount: ready ? 0 : 1,
      ingredients: [{
        ingredientId: ingredientData.id,
        sourceKey: ingredientData.sourceKey,
        name: ingredientData.name,
        required: true,
        requiredQuantity: 4,
        unit: "piece",
        ready,
        catalogProductAvailable: ready,
        reliableProductMatch: ready,
        priceKnown: ready,
        packageCalculable: ready,
        productId: matchedProduct?.id ?? null,
        sku: matchedProduct?.sku ?? null,
        productName: matchedProduct?.name ?? null,
        requirementKey: key,
        reason: ready ? null : "no_catalog_product",
        origin: ready ? null : "catalogCoverage",
      }],
    },
    dependency_match_keys: [key],
    evaluator_version: PLANNER_READINESS_EVALUATOR_VERSION,
    refresh_status: "current",
    invalidated_at: null,
    evaluated_at: NOW.toISOString(),
    expires_at: "2026-09-20T12:00:00.000Z",
  };
}

function persistent(
  readiness: PersistentRecipeReadinessRow[],
  matches: PersistentProductMatchRow[],
): PersistentRecipeReadinessRepository {
  return {
    async load() {
      return { available: true, readiness, matches };
    },
    requestRefresh: vi.fn(async () => undefined),
  };
}

describe("persistente Recipe Readiness fast path", () => {
  it("start readiness- en matchbatches onafhankelijk en parallel", async () => {
    type Result = { data: unknown[]; error: null };
    const pending: Array<{
      table: string;
      resolve: (result: Result) => void;
    }> = [];
    const client = {
      from(table: string) {
        const builder = {
          select() { return builder; },
          eq() { return builder; },
          in() {
            return new Promise<Result>((resolve) => {
              pending.push({ table, resolve });
            });
          },
        };
        return builder;
      },
    } as unknown as SupabaseClient;
    const cache = new SupabasePersistentRecipeReadinessRepository(client);
    const loading = cache.load(
      ["recipe-a"],
      4,
      Array.from({ length: 101 }, (_, index) => `match-${index}`),
    );

    await Promise.resolve();
    expect(pending.map(({ table }) => table)).toEqual([
      "recipe_readiness_cache",
      "ingredient_product_matches",
      "ingredient_product_matches",
    ]);
    for (const request of pending) request.resolve({ data: [], error: null });
    await expect(loading).resolves.toEqual({
      available: true,
      readiness: [],
      matches: [],
    });
  });

  it("gebruikt een geldige centrale READY-snapshot zonder evaluate/search en hydrateert producten in één batch", async () => {
    const source = catalog(["pasta"]);
    const matched = product("pasta");
    const counters = { searches: 0, batches: 0 };
    const resolution = await resolveRecipeReadiness(
      source.recipes,
      4,
      source,
      repository([matched], counters),
      persistent(
        [readinessRow(source.recipes[0], source.ingredients[0], matched)],
        [matchRow(source.ingredients[0].id, matched)],
      ),
      NOW,
    );

    expect(resolution).toMatchObject({ persistentHitCount: 1, fallbackCount: 0 });
    expect(resolution.gate.recipes[0].ready).toBe(true);
    expect(counters).toEqual({ searches: 0, batches: 1 });
  });

  it("zoekt bij een gerichte fallback niet opnieuw naar een reeds geldige persistente productmatch", async () => {
    const source = catalog(["pasta-a", "pasta-b"], true);
    const matched = product("gedeeld");
    const counters = { searches: 0, batches: 0 };
    const cache = persistent([], [matchRow("gedeeld", matched)]);
    const resolution = await resolveRecipeReadiness(
      source.recipes,
      4,
      source,
      repository([matched], counters),
      cache,
      NOW,
    );

    expect(resolution).toMatchObject({ persistentHitCount: 0, fallbackCount: 2 });
    expect(resolution.gate.recipes.every((item) => item.ready)).toBe(true);
    expect(counters).toEqual({ searches: 0, batches: 1 });
    expect(cache.requestRefresh).toHaveBeenCalledWith(["pasta-a", "pasta-b"], 4);
  });

  it("behoudt een actuele centrale NOT READY-uitkomst zonder nutteloze productzoekactie", async () => {
    const source = catalog(["ontbrekend"]);
    const counters = { searches: 0, batches: 0 };
    const resolution = await resolveRecipeReadiness(
      source.recipes,
      4,
      source,
      repository([], counters),
      persistent(
        [readinessRow(source.recipes[0], source.ingredients[0], null)],
        [matchRow(source.ingredients[0].id, null)],
      ),
      NOW,
    );

    expect(resolution).toMatchObject({ persistentHitCount: 1, fallbackCount: 0 });
    expect(resolution.gate.recipes[0]).toMatchObject({ ready: false, problemCount: 1 });
    expect(counters).toEqual({ searches: 0, batches: 0 });
  });

  it("valt alleen voor de stale rij terug en laat een geldige andere receptsnapshot ongemoeid", async () => {
    const source = catalog(["vers", "stale"]);
    const freshProduct = product("vers");
    const staleProduct = product("stale");
    const counters = { searches: 0, batches: 0 };
    const staleRow = readinessRow(source.recipes[1], source.ingredients[1], staleProduct);
    staleRow.refresh_status = "pending";
    staleRow.invalidated_at = NOW.toISOString();
    const resolution = await resolveRecipeReadiness(
      source.recipes,
      4,
      source,
      repository([freshProduct, staleProduct], counters),
      persistent(
        [readinessRow(source.recipes[0], source.ingredients[0], freshProduct), staleRow],
        [matchRow(source.ingredients[0].id, freshProduct), matchRow(source.ingredients[1].id, staleProduct)],
      ),
      NOW,
    );

    expect(resolution).toMatchObject({ persistentHitCount: 1, fallbackCount: 1 });
    expect(counters.searches).toBe(0);
    expect(resolution.gate.recipes.map((item) => item.recipeId)).toEqual(["vers", "stale"]);
  });
});
