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
const currentMatches = [{ match_key: matchKey, refresh_status: "current", invalidated_at: null }];

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

interface DatabaseOptions {
  matchInitially?: "pending" | "current";
  readinessWriteError?: boolean;
  guardDowngrade?: boolean;
  initiallyCurrent?: boolean;
}

function database(options: DatabaseOptions = {}) {
  let committed = options.initiallyCurrent ?? false;
  let matchUpserts = 0;
  let readinessUpserts = 0;
  const from = vi.fn((table: string) => {
    let selected = "";
    let upserted = false;
    const query = {
      select: vi.fn((fields: string) => { selected = fields; return query; }),
      upsert: vi.fn(() => { upserted = true; return query; }),
      in: vi.fn(() => query),
      overlaps: vi.fn(() => query),
      limit: vi.fn(() => query),
      then: (resolve: (value: { data: unknown; error: { message: string } | null }) => unknown) => {
        let result: { data: unknown; error: { message: string } | null } = { data: [], error: null };
        if (table === "ingredient_product_matches") {
          if (upserted) {
            matchUpserts += 1;
            result = { data: currentMatches, error: null };
          } else if (selected === "match_key,refresh_status") {
            const state = committed ? "current" : options.matchInitially ?? "pending";
            result = { data: [{ match_key: matchKey, refresh_status: state }], error: null };
          } else {
            result = { data: currentMatches, error: null };
          }
        } else if (table === "recipe_readiness_cache") {
          if (upserted) {
            readinessUpserts += 1;
            if (options.readinessWriteError) {
              result = { data: null, error: { message: "simulated readiness upsert failure" } };
            } else if (options.guardDowngrade) {
              result = { data: [{ recipe_id: recipeId, people_count: 4, refresh_status: "pending", invalidated_at: now.toISOString() }], error: null };
            } else {
              result = { data: [{ recipe_id: recipeId, people_count: 4, refresh_status: "current", invalidated_at: null }], error: null };
            }
          } else if (selected.includes("evaluator_version")) {
            result = {
              data: readinessRows(committed ? "current" : "pending", committed ? null : now.toISOString()),
              error: null,
            };
          } else if (selected === "recipe_id,people_count,dependency_match_keys") {
            result = { data: readinessRows("pending", now.toISOString()).map(({ recipe_id, people_count, dependency_match_keys }) => ({
              recipe_id, people_count, dependency_match_keys,
            })), error: null };
          } else {
            result = { data: readinessRows("current", null), error: null };
          }
        }
        return Promise.resolve(result).then(resolve);
      },
    };
    return query;
  });
  return {
    client: { from, rpc: vi.fn() } as unknown as SupabaseClient,
    from,
    commit: () => { committed = true; },
    writes: () => ({ matchUpserts, readinessUpserts }),
  };
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
          ingredients: [{ requirementKey: matchKey, sourceKey: "test-source", ready: false, productId: null, reason: "no_catalog_product" }],
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
    bounded.dryRunBoundedReadiness.mockResolvedValue({
      blocked: false,
      planToken: "a".repeat(64),
      dependencyKeys: [matchKey],
      reason: null,
    });
    bounded.writeBoundedReadiness.mockResolvedValue({ blocked: false, readinessWrites: 10, matchWrites: 1 });
  });

  it("A: herstelt als match-upsert slaagt en de daaropvolgende readiness-upsert faalt", async () => {
    const db = database({ readinessWriteError: true });
    bounded.writeBoundedReadiness.mockImplementationOnce(async () => {
      db.commit();
      return { blocked: false, readinessWrites: 10, matchWrites: 1 };
    });

    const result = await maintainPlannerReadiness(db.client, { recipeIds: [recipeId], numberOfPeople: 4 }, now);

    expect(db.writes()).toEqual({ matchUpserts: 1, readinessUpserts: 1 });
    expect(bounded.writeBoundedReadiness).toHaveBeenCalledOnce();
    expect(result).toMatchObject({ requested: 1, refreshed: 10, maintainedPeopleCounts: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] });
  });

  it("B: herleidt de exacte scope uit pending readiness wanneer matches al current zijn", async () => {
    const db = database({ matchInitially: "current", guardDowngrade: true });
    bounded.writeBoundedReadiness.mockImplementationOnce(async () => {
      db.commit();
      return { blocked: false, readinessWrites: 10, matchWrites: 1 };
    });

    await maintainPlannerReadiness(db.client, { recipeIds: [recipeId], numberOfPeople: 4 }, now);

    expect(bounded.dryRunBoundedReadiness).toHaveBeenCalledWith(db.client, { recipeIds: [recipeId], matchKeys: [matchKey] });
    expect(bounded.writeBoundedReadiness).toHaveBeenCalledWith(db.client, {
      recipeIds: [recipeId], matchKeys: [matchKey], expectedPlanToken: "a".repeat(64),
    });
  });

  it("C: doet geen commit wanneer de bounded dry-run de scope weigert", async () => {
    const db = database({ guardDowngrade: true });
    bounded.dryRunBoundedReadiness.mockResolvedValueOnce({
      blocked: true, planToken: null, reason: "dependency_outside_allowlist", dependencyKeys: [],
    });

    await expect(maintainPlannerReadiness(db.client, { recipeIds: [recipeId], numberOfPeople: 4 }, now))
      .rejects.toThrow("planner-bounded-recovery-blocked:dependency_outside_allowlist");
    expect(bounded.writeBoundedReadiness).not.toHaveBeenCalled();
  });

  it("D: weigert een verlopen plan-token of CAS-conflict zonder CURRENT te rapporteren", async () => {
    const db = database({ guardDowngrade: true });
    bounded.writeBoundedReadiness.mockResolvedValueOnce({ blocked: true, reason: "plan_changed" });

    await expect(maintainPlannerReadiness(db.client, { recipeIds: [recipeId], numberOfPeople: 4 }, now))
      .rejects.toThrow("planner-bounded-recovery-blocked:plan_changed");
    expect(bounded.writeBoundedReadiness).toHaveBeenCalledOnce();
    expect(db.writes().readinessUpserts).toBe(1);
  });

  it("E: verifieert na commit de opgeslagen match en readiness voor personen 1–10", async () => {
    const db = database({ guardDowngrade: true });
    bounded.writeBoundedReadiness.mockImplementationOnce(async () => {
      db.commit();
      return { blocked: false, readinessWrites: 10, matchWrites: 1 };
    });

    const result = await maintainPlannerReadiness(db.client, { recipeIds: [recipeId], numberOfPeople: 4 }, now);

    expect(result.refreshed).toBe(10);
    expect(db.from).toHaveBeenCalledWith("ingredient_product_matches");
    expect(db.from).toHaveBeenCalledWith("recipe_readiness_cache");
  });

  it("F: een herhaalde refresh slaat CURRENT-rijen over zonder extra writes of scopeverbreding", async () => {
    const db = database({ guardDowngrade: true });
    bounded.writeBoundedReadiness.mockImplementationOnce(async () => {
      db.commit();
      return { blocked: false, readinessWrites: 10, matchWrites: 1 };
    });
    await maintainPlannerReadiness(db.client, { recipeIds: [recipeId], numberOfPeople: 4 }, now);
    const writesAfterFirstRefresh = db.writes();

    const second = await maintainPlannerReadiness(db.client, { recipeIds: [recipeId], numberOfPeople: 4 }, now);

    expect(second).toMatchObject({ requested: 1, refreshed: 0 });
    expect(db.writes()).toEqual(writesAfterFirstRefresh);
    expect(bounded.writeBoundedReadiness).toHaveBeenCalledOnce();
  });
});
