import { describe, expect, it } from "vitest";

import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import {
  createCachedCatalogRepository,
  createCachedRecipeRepository,
} from "@/services/week-preparation/planning-cache";
import type {
  RecipeCatalog,
  RecipeRepository,
} from "@/services/week-preparation/recipe-repository";
import type { Product } from "@/types/catalog";

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
});
