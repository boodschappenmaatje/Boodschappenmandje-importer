import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { evaluateRecipeReadiness } from "@/services/week-preparation/recipe-readiness";
import { loadCatalog, PLANNER_MAINTENANCE_PEOPLE_COUNTS, rowsForGate } from "@/server/planner-cache-service";
import {
  EXPLICIT_RECIPE_LINKS,
  parseExplicitRecipeLinkInput,
  refreshExplicitRecipeReadiness,
} from "./explicit-recipe-readiness";

vi.mock("@/services/catalog/catalog-repository", () => ({
  SupabaseCatalogRepository: vi.fn(function () { return {}; }),
}));
vi.mock("@/services/week-preparation/recipe-readiness", () => ({ evaluateRecipeReadiness: vi.fn() }));
vi.mock("@/server/planner-cache-service", () => ({
  PLANNER_MAINTENANCE_PEOPLE_COUNTS: Array.from({ length: 10 }, (_, i) => i + 1),
  loadCatalog: vi.fn(),
  rowsForGate: vi.fn(),
}));

const sku = "686060000";
const recipeId = EXPLICIT_RECIPE_LINKS[sku];
const recipe = { id: recipeId, sourceKey: "knorr-kip-siam", name: "Kip Siam" };

type DbRows = {
  product?: unknown;
  profile?: unknown;
  recipe?: unknown;
  ingredients?: unknown[];
  cache?: Record<string, unknown>[];
};

function database(rows: DbRows = {}) {
  const writes: Array<{ table: string; rows: unknown }> = [];
  const reads: string[] = [];
  const from = vi.fn((table: string) => {
    reads.push(table);
    const result = table === "products" ? ("product" in rows ? rows.product : { id: "product-a", sku, name: "Knorr Wereldgerechten Kip Siam", brand: "Knorr" })
      : table === "meal_mix_profiles" ? ("profile" in rows ? rows.profile : { product_id: "product-a", recipe_id: null, status: "needs_review", profile: null, brand: "Knorr" })
        : table === "recipes" ? ("recipe" in rows ? rows.recipe : { id: recipeId })
          : table === "recipe_ingredients" ? rows.ingredients ?? [{ id: "relation-a" }]
            : table === "recipe_readiness_cache" ? rows.cache ?? [] : [];
    const query: Record<string, unknown> = {
      select: vi.fn(() => query),
      eq: vi.fn(() => query),
      in: vi.fn(() => query),
      limit: vi.fn(async () => ({ data: result, error: null })),
      maybeSingle: vi.fn(async () => ({ data: Array.isArray(result) ? result[0] ?? null : result, error: null })),
      upsert: vi.fn(async (value: unknown) => { writes.push({ table, rows: value }); return { data: value, error: null }; }),
      then: (resolve: (value: { data: unknown; error: null }) => unknown) => Promise.resolve({ data: result, error: null }).then(resolve),
    };
    return query;
  });
  return { client: { from } as unknown as SupabaseClient, from, reads, writes };
}

function readinessGate(ready: boolean) {
  return { recipes: [{ recipeId, ready, problemCount: ready ? 0 : 1, requiredIngredientCount: 1,
    readyRequiredIngredientCount: ready ? 1 : 0, ingredients: [] }], matchedProductsByRequirement: new Map() };
}

function cacheRows(ready: boolean, now: Date) {
  return PLANNER_MAINTENANCE_PEOPLE_COUNTS.map((peopleCount) => ({
    recipe_id: recipeId, people_count: peopleCount, evaluator_version: 1, dependency_match_keys: [],
    refresh_status: "current", invalidated_at: null, expires_at: new Date(now.getTime() + 3600000).toISOString(),
    readiness_status: ready ? "READY" : "NOT_READY", required_ingredient_count: 1,
    ready_required_ingredient_count: ready ? 1 : 0, problem_count: ready ? 0 : 1,
    readiness_payload: { recipeId, ready, problemCount: ready ? 0 : 1, requiredIngredientCount: 1,
      readyRequiredIngredientCount: ready ? 1 : 0, ingredients: [] },
  }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadCatalog).mockResolvedValue({ recipes: [recipe], ingredients: [], relations: [] } as never);
  vi.mocked(evaluateRecipeReadiness).mockImplementation(async (_recipes, peopleCount) => readinessGate(peopleCount !== 4) as never);
  vi.mocked(rowsForGate).mockImplementation((gate, peopleCount, now) => {
    const result = gate.recipes[0];
    const keys: string[] = [];
    return {
      matchRows: [{ match_key: "must-not-write", product_id: "unrelated-product" }],
      readinessRows: [{ recipe_id: result.recipeId, people_count: peopleCount,
        readiness_status: result.ready ? "READY" : "NOT_READY", required_ingredient_count: 1,
        ready_required_ingredient_count: result.ready ? 1 : 0, problem_count: result.problemCount,
        readiness_payload: result, dependency_match_keys: keys, evaluator_version: 1,
        refresh_status: "current", invalidated_at: null, evaluated_at: now.toISOString(),
        expires_at: new Date(now.getTime() + 3600000).toISOString() }],
    } as ReturnType<typeof rowsForGate>;
  });
});

afterEach(() => vi.unstubAllEnvs());

describe("explicit needs_review recipe readiness", () => {
  it("accepts exactly the seven reviewed SKU→recipe links", () => {
    expect(Object.keys(EXPLICIT_RECIPE_LINKS)).toHaveLength(7);
    for (const [linkSku, linkRecipeId] of Object.entries(EXPLICIT_RECIPE_LINKS)) {
      expect(parseExplicitRecipeLinkInput({ sku: linkSku, recipeId: linkRecipeId })).toEqual({ sku: linkSku, recipeId: linkRecipeId });
    }
    expect(Object.hasOwn(EXPLICIT_RECIPE_LINKS, "704881000")).toBe(false);
  });

  it.each([
    ["no explicit recipe", { sku }],
    ["wrong recipe", { sku, recipeId: "17b1cade-cd86-4c55-81b6-ceeef22ed196" }],
    ["unknown recipe", { sku, recipeId: "00000000-0000-4000-8000-000000000001" }],
    ["out of scope product", { sku: "704881000", recipeId }],
  ])("fails closed for %s", (_label, value) => {
    expect(parseExplicitRecipeLinkInput(value)).toBeNull();
  });

  it("reuses the normal evaluator for a needs_review profile and keeps that status", async () => {
    const db = database();
    const result = await refreshExplicitRecipeReadiness(db.client, { sku, recipeId });
    expect(result).toMatchObject({ profileStatus: "needs_review", profilePromoted: false, matchCacheWrites: 0, readinessWrites: 10 });
    expect(result.readiness).toHaveLength(10);
    expect(result.readiness.find((item) => item.peopleCount === 4)).toMatchObject({ status: "NOT_READY", problemCount: 1 });
    expect(evaluateRecipeReadiness).toHaveBeenCalledTimes(10);
    expect(loadCatalog).toHaveBeenCalledWith(db.client, [recipeId]);
    expect(db.writes).toHaveLength(1);
    expect(db.writes[0]).toMatchObject({ table: "recipe_readiness_cache" });
    expect((db.writes[0].rows as Record<string, unknown>[]).map((row) => row.recipe_id)).toEqual(Array(10).fill(recipeId));
    expect(db.reads).not.toContain("ingredient_product_matches");
    expect(db.reads.filter((table) => table === "meal_mix_profiles")).toHaveLength(1);
  });

  it("rejects a verified or populated profile without changing its status", async () => {
    for (const profile of [
      { product_id: "product-a", recipe_id: null, status: "verified", profile: null, brand: "Knorr" },
      { product_id: "product-a", recipe_id: null, status: "needs_review", profile: { supplements: [] }, brand: "Knorr" },
      { product_id: "product-a", recipe_id: "00000000-0000-4000-8000-000000000001", status: "needs_review", profile: null, brand: "Knorr" },
      { product_id: "product-a", recipe_id: null, status: "needs_review", profile: null, brand: "Honig" },
    ]) {
      await expect(refreshExplicitRecipeReadiness(database({ profile }).client, { sku, recipeId })).rejects.toThrow("explicit_profile_state_mismatch");
    }
    expect(evaluateRecipeReadiness).not.toHaveBeenCalled();
  });

  it("rejects wrong product brand and missing recipe or ingredients", async () => {
    await expect(refreshExplicitRecipeReadiness(database({ product: { id: "product-a", sku, name: "Knorr Wereldgerechten Kip Siam", brand: "Honig" } }).client, { sku, recipeId }))
      .rejects.toThrow("explicit_product_identity_mismatch");
    await expect(refreshExplicitRecipeReadiness(database({ recipe: null }).client, { sku, recipeId })).rejects.toThrow("explicit_recipe_unavailable");
    await expect(refreshExplicitRecipeReadiness(database({ ingredients: [] }).client, { sku, recipeId })).rejects.toThrow("explicit_recipe_ingredients_missing");
    expect(evaluateRecipeReadiness).not.toHaveBeenCalled();
  });

  it("records normal NOT_READY results when matching/price checks fail and never writes match cache", async () => {
    vi.mocked(evaluateRecipeReadiness).mockImplementation(async () => readinessGate(false) as never);
    const db = database();
    const result = await refreshExplicitRecipeReadiness(db.client, { sku, recipeId });
    expect(result.readiness.every((item) => item.status === "NOT_READY")).toBe(true);
    expect(result.matchCacheWrites).toBe(0);
    expect(db.writes.map((write) => write.table)).toEqual(["recipe_readiness_cache"]);
    expect(rowsForGate).toHaveBeenCalled();
  });

  it("does not change a prior NOT_READY into READY unless the existing evaluator returns READY", async () => {
    vi.mocked(evaluateRecipeReadiness).mockImplementation(async (_recipes, peopleCount) => readinessGate(peopleCount === 4) as never);
    const result = await refreshExplicitRecipeReadiness(database().client, { sku, recipeId });
    expect(result.readiness.find((item) => item.peopleCount === 4)?.status).toBe("READY");
    expect(result.readiness.filter((item) => item.peopleCount !== 4).every((item) => item.status === "NOT_READY")).toBe(true);
  });

  it("is idempotent when all readiness rows already contain the same current evaluation", async () => {
    const now = new Date("2026-10-10T12:00:00.000Z");
    const db = database({ cache: cacheRows(true, now).map((row) => ({ ...row,
      readiness_payload: { ingredients: [], readyRequiredIngredientCount: 1, requiredIngredientCount: 1,
        problemCount: 0, ready: true, recipeId },
    })) });
    vi.mocked(evaluateRecipeReadiness).mockImplementation(async () => readinessGate(true) as never);
    vi.mocked(rowsForGate).mockImplementation((gate, peopleCount) => ({
      matchRows: [{ match_key: "ignored" }],
      readinessRows: [cacheRows(true, now)[peopleCount - 1]],
    } as unknown as ReturnType<typeof rowsForGate>));
    const first = await refreshExplicitRecipeReadiness(db.client, { sku, recipeId }, { now });
    const second = await refreshExplicitRecipeReadiness(db.client, { sku, recipeId }, { now });
    expect(first.readinessWrites).toBe(0);
    expect(second.readinessWrites).toBe(0);
    expect(db.writes).toHaveLength(0);
  });

  it("Preview evaluation performs no readiness or match-cache writes", async () => {
    const db = database();
    const result = await refreshExplicitRecipeReadiness(db.client, { sku, recipeId }, { persist: false });
    expect(result.readinessWrites).toBe(0);
    expect(result.matchCacheWrites).toBe(0);
    expect(db.writes).toHaveLength(0);
  });

  it("Production preflight evaluates one fixed people count and skips cache reads and all writes", async () => {
    const db = database();
    const result = await refreshExplicitRecipeReadiness(db.client, { sku, recipeId }, {
      persist: false,
      evaluationMode: "preflight",
    });
    expect(result).toMatchObject({ evaluationMode: "preflight", readinessWrites: 0, matchCacheWrites: 0 });
    expect(result.readiness).toEqual([{ peopleCount: 4, status: "NOT_READY", problemCount: 1 }]);
    expect(evaluateRecipeReadiness).toHaveBeenCalledTimes(1);
    expect(evaluateRecipeReadiness).toHaveBeenCalledWith([recipe], 4, expect.anything(), expect.anything());
    expect(db.reads).not.toContain("recipe_readiness_cache");
    expect(db.reads).not.toContain("ingredient_product_matches");
    expect(db.writes).toHaveLength(0);
  });

  it("cannot combine bounded preflight evaluation with persistence", async () => {
    const db = database();
    await expect(refreshExplicitRecipeReadiness(db.client, { sku, recipeId }, {
      persist: true,
      evaluationMode: "preflight",
    })).rejects.toThrow("preflight_must_be_read_only");
    expect(evaluateRecipeReadiness).not.toHaveBeenCalled();
    expect(db.writes).toHaveLength(0);
  });
});
