import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const bounded = vi.hoisted(() => ({
  dryRunBoundedReadiness: vi.fn(),
  writeBoundedReadiness: vi.fn(),
}));

vi.mock("@/server/bounded-readiness-maintenance", () => bounded);
vi.mock("@/services/week-preparation/persistent-readiness-cache", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/services/week-preparation/persistent-readiness-cache")>(),
  requirementKeysForRecipes: vi.fn(),
  resolveRecipeReadiness: vi.fn(),
}));

import {
  requirementKeysForRecipes,
  readinessVersionForMatchKeys,
  resolveRecipeReadiness,
} from "@/services/week-preparation/persistent-readiness-cache";
import { SupabaseRecipeRepository } from "@/services/week-preparation/recipe-repository";
import { maintainPlannerReadiness } from "@/server/planner-cache-service";

const recipeId = "00000000-0000-4000-8000-000000000001";
const ingredientId = "00000000-0000-4000-8000-000000000002";
const matchKey = `${ingredientId}:g:ingredient:generic`;
const now = new Date("2026-10-12T07:00:00.000Z");
const expiry = "2026-10-13T07:00:00.000Z";

function readinessRows(status: string, invalidatedAt: string | null) {
  return Array.from({ length: 10 }, (_, index) => ({
    recipe_id: recipeId,
    people_count: index + 1,
    evaluator_version: readinessVersionForMatchKeys([matchKey]),
    dependency_match_keys: [matchKey],
    refresh_status: status,
    invalidated_at: invalidatedAt,
    expires_at: expiry,
  }));
}

function database() {
  const calls = new Map<string, number>();
  const from = vi.fn((table: string) => {
    const callNumber = (calls.get(table) ?? 0) + 1;
    calls.set(table, callNumber);
    let result: { data: unknown; error: null } = { data: [], error: null };
    if (table === "recipe_readiness_cache" && callNumber === 1) {
      result = { data: readinessRows("pending", now.toISOString()), error: null };
    } else if (table === "recipe_readiness_cache" && callNumber === 2) {
      // Simulate planner_cache_write_guard downgrading a legacy upsert.
      result = { data: [{ recipe_id: recipeId, people_count: 4, refresh_status: "pending", invalidated_at: now.toISOString() }], error: null };
    } else if (table === "recipe_readiness_cache" && callNumber === 3) {
      result = { data: [{ recipe_id: recipeId, people_count: 4 }], error: null };
    } else if (table === "recipe_readiness_cache" && callNumber === 4) {
      result = { data: readinessRows("current", null), error: null };
    } else if (table === "ingredient_product_matches" && callNumber === 1) {
      result = { data: [{ match_key: matchKey, refresh_status: "pending" }], error: null };
    } else if (table === "ingredient_product_matches" && callNumber === 2) {
      result = { data: [{ match_key: matchKey, refresh_status: "current", invalidated_at: null }], error: null };
    } else if (table === "ingredient_product_matches" && callNumber === 3) {
      result = { data: [{ match_key: matchKey, refresh_status: "current", invalidated_at: null }], error: null };
    }
    const query = {
      select: vi.fn(() => query),
      upsert: vi.fn(() => query),
      in: vi.fn(() => query),
      overlaps: vi.fn(() => query),
      limit: vi.fn(() => query),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  });
  return { client: { from, rpc: vi.fn() } as unknown as SupabaseClient, from };
}

describe("automatic bounded cache recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(SupabaseRecipeRepository.prototype, "loadCatalog").mockResolvedValue({
      recipes: [{ id: recipeId, ingredients: [] }],
      ingredients: [],
      relations: [],
      mealMixProfiles: [],
    } as never);
    vi.mocked(requirementKeysForRecipes).mockReturnValue(new Map([[recipeId, [matchKey]]]));
    vi.mocked(resolveRecipeReadiness).mockResolvedValue({
      gate: {
        recipes: [{
          recipeId,
          ingredients: [{
            requirementKey: matchKey,
            sourceKey: "test-source",
            ready: false,
            productId: null,
            reason: "no_catalog_product",
          }],
          ready: false,
          requiredIngredientCount: 1,
          readyRequiredIngredientCount: 0,
          problemCount: 1,
        }],
        matchedProductsByRequirement: new Map(),
        candidatesByRequirement: new Map(),
      },
      persistentHitCount: 0,
      fallbackCount: 1,
      cacheAvailable: true,
    } as never);
    bounded.dryRunBoundedReadiness.mockResolvedValue({ blocked: false, planToken: "a".repeat(64), reason: null });
    bounded.writeBoundedReadiness.mockResolvedValue({ blocked: false, readinessWrites: 10, matchWrites: 1 });
  });

  it("recovers a guard-downgraded row through one bounded commit and verifies all 1–10 variants", async () => {
    const db = database();
    const result = await maintainPlannerReadiness(db.client, { recipeIds: [recipeId], numberOfPeople: 4 }, now);

    expect(bounded.dryRunBoundedReadiness).toHaveBeenCalledOnce();
    expect(bounded.dryRunBoundedReadiness).toHaveBeenCalledWith(db.client, {
      recipeIds: [recipeId],
      matchKeys: [matchKey],
    });
    expect(bounded.writeBoundedReadiness).toHaveBeenCalledOnce();
    expect(bounded.writeBoundedReadiness).toHaveBeenCalledWith(db.client, {
      recipeIds: [recipeId],
      matchKeys: [matchKey],
      expectedPlanToken: "a".repeat(64),
    });
    expect(result).toMatchObject({ requested: 1, refreshed: 10, maintainedPeopleCounts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
  });

  it("does not write when bounded preflight rejects the recovery scope", async () => {
    const db = database();
    bounded.dryRunBoundedReadiness.mockResolvedValueOnce({
      blocked: true,
      planToken: null,
      reason: "dependency_outside_allowlist",
    });

    await expect(maintainPlannerReadiness(
      db.client,
      { recipeIds: [recipeId], numberOfPeople: 4 },
      now,
    )).rejects.toThrow("planner-bounded-recovery-blocked:dependency_outside_allowlist");
    expect(bounded.writeBoundedReadiness).not.toHaveBeenCalled();
  });
});
