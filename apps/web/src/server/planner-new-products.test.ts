import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SupabaseCatalogRepository } from "@/services/catalog/catalog-repository";
import type { PersistentProductMatchRow } from "@/services/week-preparation/persistent-readiness-cache";
import { evaluateRecipeReadiness } from "@/services/week-preparation/recipe-readiness";
import type { RecipeCatalog, RecipeIngredientDefinition } from "@/services/week-preparation/recipe-repository";
import type { Product, Recipe } from "@/types/catalog";
import { loadCatalog, rowsForGate } from "@/server/planner-cache-service";
import { maintainPlannerForNewProducts, parseNewProductIds, selectNewProductRepairs } from "@/server/planner-new-products";

vi.mock("@/server/planner-cache-service", async (original) => ({
  ...await original<typeof import("@/server/planner-cache-service")>(),
  loadCatalog: vi.fn(),
}));

const NOW = new Date("2026-09-19T22:00:00.000Z");
const BEFORE = "2026-09-19T20:00:00.000Z";
const ID = "00000000-0000-4000-8000-000000000001";
const FALAFEL: RecipeIngredientDefinition = { id: "falafel", sourceKey: "falafel", name: "falafel",
  normalizedName: "falafel", defaultUnit: "grams", category: "Vegetarische proteïne", aliases: ["falafel"] };
const RICE = { ...FALAFEL, id: "rice", sourceKey: "rice", name: "rijst", aliases: ["rijst"], category: "Pasta, rijst & granen" };
const recipe = (id: string): Recipe => ({ id, sourceKey: id, name: id, normalizedName: id,
  symbol: "fork.knife", preparationMinutes: 20, vegetarian: true, containsPork: false,
  kidFriendly: true, healthy: true, budgetTier: "standard" });
const CATALOG: RecipeCatalog = { recipes: [recipe("affected"), recipe("untouched")],
  ingredients: [FALAFEL, RICE], relations: [
    { id: "r1", recipeId: "affected", ingredientId: "falafel", amountPerPerson: 100, unit: "g", position: 0, optional: false },
    { id: "r2", recipeId: "untouched", ingredientId: "rice", amountPerPerson: 75, unit: "g", position: 0, optional: false },
  ] };
function product(id = ID, name = "Go vega Plantaardige falafel"): Product {
  return { id, sku: "730331000", name, supermarket: "Hoogvliet", brand: "Go vega", category: "Vegetarisch",
    productType: "Falafel", packageText: "200 gram", weightGrams: 200, imageUrl: null,
    sourceUrl: "https://www.hoogvliet.com/product/falafel", isAvailable: true, updatedAt: BEFORE,
    currentPrice: { productId: id, price: 1.48, oldPrice: null, isOffer: false, offerText: null,
      validFrom: null, validUntil: null, fetchedAt: BEFORE, updatedAt: BEFORE } };
}
function missing(ingredient = FALAFEL): PersistentProductMatchRow {
  return { match_key: `${ingredient.id}:g:ingredient:generic`, ingredient_id: null,
    ingredient_source_key: ingredient.sourceKey, requirement_unit: "g", requirement_kind: "ingredient",
    brand_constraint: "", product_id: null, match_status: "invalid", failure_reason: "no_catalog_product",
    matcher_version: 1, refresh_status: "current", invalidated_at: null,
    product_updated_at: null, price_updated_at: null, checked_at: BEFORE };
}
type Row = Record<string, unknown>;
class Database {
  tables: Record<string, Row[]> = { ingredient_product_matches: [], recipe_readiness_cache: [] };
  writes: Array<{ table: string; row: Row }> = [];
  failReadiness = false;
  from(table: string) {
    const filters: Array<(row: Row) => boolean> = [];
    let values: Row | null = null;
    let limit = Infinity;
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push((r) => r[key] === value); return query; },
      is: (key: string, value: unknown) => query.eq(key, value),
      in: (key: string, list: unknown[]) => { filters.push((r) => list.includes(r[key])); return query; },
      overlaps: (key: string, list: unknown[]) => { filters.push((r) => (r[key] as unknown[]).some((v) => list.includes(v))); return query; },
      gte: (key: string, value: number) => { filters.push((r) => Number(r[key]) >= value); return query; },
      lte: (key: string, value: number) => { filters.push((r) => Number(r[key]) <= value); return query; },
      limit: (count: number) => { limit = count; return query; },
      update: (patch: Row) => { values = patch; return query; },
      then: (resolve: (result: { data: Row[]; error: string | null }) => unknown) => {
        const rows = this.tables[table].filter((r) => filters.every((fn) => fn(r))).slice(0, limit);
        if (values && this.failReadiness && table === "recipe_readiness_cache") {
          return Promise.resolve(resolve({ data: [], error: "fixture interruption" }));
        }
        if (values) for (const row of rows) {
          Object.assign(row, values, { updated_at: NOW.toISOString() });
          this.writes.push({ table, row: structuredClone(row) });
          if (table === "ingredient_product_matches") {
            for (const dependent of this.tables.recipe_readiness_cache) {
              if ((dependent.dependency_match_keys as string[]).includes(row.match_key as string)) {
                Object.assign(dependent, { refresh_status: "pending", invalidated_at: NOW.toISOString(), updated_at: NOW.toISOString() });
              }
            }
          }
        }
        return Promise.resolve(resolve({ data: structuredClone(rows), error: null }));
      },
    };
    return query;
  }
  client() { return this as unknown as SupabaseClient; }
}

let products: Product[];
let search: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.restoreAllMocks();
  products = [product()];
  vi.mocked(loadCatalog).mockResolvedValue(CATALOG);
  vi.spyOn(SupabaseCatalogRepository.prototype, "getByIds").mockImplementation(async (ids) =>
    ({ products: products.filter((p) => ids.includes(p.id)), priceStatus: "complete" }));
  search = vi.spyOn(SupabaseCatalogRepository.prototype, "search").mockImplementation(async (term) =>
    ({ products: products.filter((p) => p.name.toLowerCase().includes(term)), priceStatus: "complete" }));
});

async function database() {
  const db = new Database();
  db.tables.ingredient_product_matches = [missing(), missing(RICE)] as unknown as Row[];
  const repo = new SupabaseCatalogRepository(db.client());
  const saved = products;
  products = [];
  for (let people = 1; people <= 10; people++) {
    const gate = await evaluateRecipeReadiness(CATALOG.recipes, people, CATALOG, repo);
    db.tables.recipe_readiness_cache.push(...rowsForGate(gate, people, new Date(BEFORE)).readinessRows
      .map((row) => ({ ...row, updated_at: BEFORE })));
  }
  products = saved;
  search.mockClear();
  return db;
}

describe("new importer products: targeted maintenance", () => {
  it("A/D/E resolves only falafel and its ten existing variants with the real readiness evaluator", async () => {
    const db = await database();
    const untouched = structuredClone(db.tables.recipe_readiness_cache.filter((r) => r.recipe_id === "untouched"));
    const otherMatch = structuredClone(db.tables.ingredient_product_matches[1]);
    const result = await maintainPlannerForNewProducts(db.client(), [ID], NOW);
    expect(result).toEqual({ productCount: 1, changedMatchKeys: [missing().match_key],
      refreshedReadinessCount: 10, affectedRecipeIds: ["affected"] });
    expect(db.tables.recipe_readiness_cache.filter((r) => r.recipe_id === "untouched")).toEqual(untouched);
    expect(db.tables.ingredient_product_matches[1]).toEqual(otherMatch);
    expect(db.tables.recipe_readiness_cache.filter((r) => r.recipe_id === "affected")
      .map((r) => [r.people_count, r.readiness_status, r.refresh_status]))
      .toEqual(Array.from({ length: 10 }, (_, i) => [i + 1, "READY", "current"]));
    expect(search).not.toHaveBeenCalled();
    expect(db.writes.filter((w) => w.table === "ingredient_product_matches")).toHaveLength(1);
  });

  it("B unmatched new product performs zero cache writes", async () => {
    const db = await database();
    products = [product(ID, "Cola")];
    const before = structuredClone(db.tables);
    const result = await maintainPlannerForNewProducts(db.client(), [ID], NOW);
    expect(result.refreshedReadinessCount).toBe(0);
    expect(db.tables).toEqual(before);
    expect(db.writes).toEqual([]);
    expect(search).not.toHaveBeenCalled();
  });

  it("C existing central matching rejects unreliable, wrong-package and unpriced candidates", () => {
    const good = product();
    const bad = product("bad", "Kipfilet");
    expect(selectNewProductRepairs([missing(), missing(RICE)], [bad, good], CATALOG)
      .map((r) => r.product.id)).toEqual([ID]);
    expect(selectNewProductRepairs([missing()], [{ ...good, currentPrice: null }], CATALOG)).toEqual([]);
    expect(selectNewProductRepairs([missing()], [{ ...good, weightGrams: null, packageText: null }], CATALOG)).toEqual([]);
    expect(selectNewProductRepairs([missing()], [{ ...good, isAvailable: false }], CATALOG)).toEqual([]);
    expect(selectNewProductRepairs([{ ...missing(), failure_reason: "category_mismatch" }], [good], CATALOG)).toEqual([]);
  });

  it("F/G repeated notification never rewrites valid matches, timestamps or readiness", async () => {
    const db = await database();
    await maintainPlannerForNewProducts(db.client(), [ID], NOW);
    const before = structuredClone(db.tables);
    db.writes = [];
    const result = await maintainPlannerForNewProducts(db.client(), [ID, ID], NOW);
    expect(result.changedMatchKeys).toEqual([]);
    expect(result.refreshedReadinessCount).toBe(0);
    expect(db.tables).toEqual(before);
    expect(db.writes).toEqual([]);
    expect(new Set(db.tables.recipe_readiness_cache.map((r) => `${r.recipe_id}:${r.people_count}`)).size).toBe(20);
  });

  it("resumes interrupted readiness writes without rewriting the repaired match", async () => {
    const db = await database();
    db.failReadiness = true;
    await expect(maintainPlannerForNewProducts(db.client(), [ID], NOW)).rejects.toThrow("dependent-readiness-write-failed");
    expect(db.tables.ingredient_product_matches[0].match_status).toBe("valid");
    db.failReadiness = false;
    db.writes = [];
    expect((await maintainPlannerForNewProducts(db.client(), [ID], NOW)).refreshedReadinessCount).toBe(10);
    expect(db.writes.every((w) => w.table === "recipe_readiness_cache")).toBe(true);
  });

  it("updates only existing people variants, never creates absent variants or touches 11/12", async () => {
    const db = await database();
    db.tables.recipe_readiness_cache = db.tables.recipe_readiness_cache.filter((r) => r.people_count !== 3);
    expect((await maintainPlannerForNewProducts(db.client(), [ID], NOW)).refreshedReadinessCount).toBe(9);
    expect(db.tables.recipe_readiness_cache.some((r) => r.people_count === 3)).toBe(false);
  });

  it("keeps NOT_READY when the affected recipe still has another blocker", async () => {
    const db = await database();
    vi.mocked(loadCatalog).mockResolvedValue({ ...CATALOG,
      relations: [...CATALOG.relations, { ...CATALOG.relations[1], recipeId: "affected", id: "extra", position: 1 }] });
    await maintainPlannerForNewProducts(db.client(), [ID], NOW);
    expect(db.tables.recipe_readiness_cache.filter((r) => r.recipe_id === "affected")
      .every((r) => r.readiness_status === "NOT_READY" && r.problem_count === 1)).toBe(true);
    expect(db.writes.filter((w) => w.table === "ingredient_product_matches")).toHaveLength(1);
  });

  it("rejects unbounded/non-UUID input before accessing the database", async () => {
    expect(parseNewProductIds({ productIds: [] })).toBeNull();
    expect(parseNewProductIds({ productIds: Array(21).fill(ID) })).toBeNull();
    expect(parseNewProductIds({ productIds: ["not-a-uuid"] })).toBeNull();
    expect(parseNewProductIds({ productIds: [ID, ID] })).toEqual([ID]);
  });
});
