import type { SupabaseClient } from "@supabase/supabase-js";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BoundedReadinessConflict, dryRunBoundedReadiness, verifyBoundedReadiness, writeBoundedReadiness } from "./bounded-readiness-maintenance";
import { loadCatalog, rowsForGate } from "./planner-cache-service";
import { requirementKeysForRecipes } from "@/services/week-preparation/persistent-readiness-cache";
import { evaluateRecipeReadiness } from "@/services/week-preparation/recipe-readiness";

vi.mock("./planner-cache-service", async (importOriginal) => ({
  ...await importOriginal<typeof import("./planner-cache-service")>(), loadCatalog: vi.fn(), rowsForGate: vi.fn(),
}));
vi.mock("@/services/week-preparation/persistent-readiness-cache", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/services/week-preparation/persistent-readiness-cache")>(), requirementKeysForRecipes: vi.fn(),
}));
vi.mock("@/services/week-preparation/recipe-readiness", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/services/week-preparation/recipe-readiness")>(), evaluateRecipeReadiness: vi.fn(),
}));

const recipeId = "00000000-0000-4000-8000-000000000001";
const key = "meal-mix-ingredient:mix-supplement-tomaten:piece:ingredient:generic";
const token = "a".repeat(64);
const input = { recipeIds: [recipeId], matchKeys: [key], expectedPlanToken: token };
const result = { blocked: false, reason: null, matchWrites: 1, readinessWrites: 10, outsideScopeEffects: 0,
  finalPlanToken: "b".repeat(64), validatedScope: { recipeIds: input.recipeIds, matchKeys: input.matchKeys } };

function client(
  commitError: { code: string; message: string } | null = null,
  scope = { recipeIds: [recipeId], matchKeys: [key] },
) {
  const subscriberRows = scope.recipeIds.flatMap((id) => Array.from({ length: 10 }, (_, index) => ({
    recipe_id: id, people_count: index + 1, updated_at: "2026-10-02T10:00:00.000Z", dependency_match_keys: scope.matchKeys,
  })));
  const scopeResult = { ...result, matchWrites: scope.matchKeys.length,
    readinessWrites: scope.recipeIds.length * 10, validatedScope: scope };
  const resources = [
    ...scope.matchKeys.map((matchKey) => [`k:${matchKey}`, "0"]),
    ...scope.recipeIds.map((id) => [`r:${id}`, "0"]),
  ];
  const rpc = vi.fn(async (name: string, params?: unknown) => {
    if (name === "bounded_readiness_source_revision") return { data: "17", error: null };
    if (name === "bounded_readiness_plan") return { data: { planToken: token, sourceRevision: "17", state: { resources } }, error: null };
    if (name === "commit_bounded_readiness") {
      const submitted = params as { p_recipe_ids: string[]; p_match_keys: string[]; p_readiness_rows: unknown[] };
      return { data: commitError ? null : {
        ...scopeResult, matchWrites: submitted.p_match_keys.length,
        readinessWrites: submitted.p_readiness_rows.length,
        validatedScope: { recipeIds: submitted.p_recipe_ids, matchKeys: submitted.p_match_keys },
      }, error: commitError };
    }
    throw new Error(`unexpected RPC ${name}`);
  });
  const limit = vi.fn().mockResolvedValue({ data: subscriberRows, error: null });
  const from = vi.fn(() => ({ select: () => ({ overlaps: () => ({ limit }) }) }));
  return { value: { rpc, from } as unknown as SupabaseClient, rpc, from };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(loadCatalog).mockResolvedValue({ recipes: [{ id: recipeId }], ingredients: [], relations: [] } as unknown as Awaited<ReturnType<typeof loadCatalog>>);
  vi.mocked(requirementKeysForRecipes).mockReturnValue(new Map([[recipeId, [key]]]));
  vi.mocked(evaluateRecipeReadiness).mockResolvedValue({} as Awaited<ReturnType<typeof evaluateRecipeReadiness>>);
  vi.mocked(rowsForGate).mockImplementation((_gate, people) => ({
    matchRows: [{ match_key: key, product_id: null, match_status: "invalid", failure_reason: "no_catalog_product" }],
    readinessRows: [{ recipe_id: recipeId, people_count: people, dependency_match_keys: [key] }],
  } as ReturnType<typeof rowsForGate>));
});

describe("bounded transaction integration", () => {
  it("uses one final write RPC with the original CAS token and all ten variants", async () => {
    const db = client();
    expect(await writeBoundedReadiness(db.value, input)).toEqual(result);
    expect(db.rpc.mock.calls.map(([name]) => name)).toEqual([
      "bounded_readiness_source_revision", "bounded_readiness_plan", "commit_bounded_readiness",
    ]);
    expect(db.rpc).toHaveBeenLastCalledWith("commit_bounded_readiness", expect.objectContaining({
      p_expected_plan_token: token, p_recipe_ids: [recipeId], p_match_keys: [key], p_dependency_keys: [key],
      p_match_rows: [expect.objectContaining({ match_key: key })],
      p_readiness_rows: Array.from({ length: 10 }, (_, i) => expect.objectContaining({ recipe_id: recipeId, people_count: i + 1 })),
    }));
    expect(db.from).toHaveBeenCalledExactlyOnceWith("recipe_readiness_cache"); // subscriber SELECT only, no upsert API
  });
  it("evaluates and commits the exact shared 16+9 subscriber union as one 200-row RPC", async () => {
    const recipeIds = Array.from({ length: 20 }, (_, index) =>
      `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
    const matchKeys = [
      "meal-mix-ingredient:mix-supplement-olie:ml:ingredient:generic",
      "meal-mix-ingredient:mix-supplement-ui:piece:ingredient:generic",
    ];
    const dependenciesByRecipe = new Map(recipeIds.map((id, index) => [
      id, index < 11 ? [matchKeys[0]] : index < 16 ? matchKeys : [matchKeys[1]],
    ]));
    vi.mocked(loadCatalog).mockResolvedValue({ recipes: recipeIds.map((id) => ({ id })), ingredients: [], relations: [] } as unknown as Awaited<ReturnType<typeof loadCatalog>>);
    vi.mocked(requirementKeysForRecipes).mockReturnValue(dependenciesByRecipe);
    vi.mocked(rowsForGate).mockImplementation((_gate, people) => ({
      matchRows: matchKeys.map((matchKey) => ({ match_key: matchKey, product_id: null, match_status: "invalid", failure_reason: "no_catalog_product" })),
      readinessRows: recipeIds.map((id) => ({ recipe_id: id, people_count: people, dependency_match_keys: dependenciesByRecipe.get(id) })),
    } as ReturnType<typeof rowsForGate>));
    const db = client(null, { recipeIds, matchKeys });
    const resultForSharedScope = await writeBoundedReadiness(db.value, {
      recipeIds, matchKeys, expectedPlanToken: token,
    });
    expect(resultForSharedScope).toMatchObject({ blocked: false, matchWrites: 2, readinessWrites: 200, outsideScopeEffects: 0 });
    expect(db.rpc).toHaveBeenLastCalledWith("commit_bounded_readiness", expect.objectContaining({
      p_recipe_ids: recipeIds,
      p_match_keys: matchKeys,
      p_readiness_rows: expect.any(Array),
    }));
    const commitArgs = db.rpc.mock.calls.at(-1)?.[1] as unknown as { p_readiness_rows: unknown[] };
    expect(commitArgs.p_readiness_rows).toHaveLength(200);
  });
  it.each(["bounded_stale_plan", "bounded_outside_subscriber", "bounded_outside_readiness_scope"])("surfaces %s as an atomic conflict", async (message) => {
    const db = client({ code: "P0001", message });
    await expect(writeBoundedReadiness(db.value, input)).rejects.toBeInstanceOf(BoundedReadinessConflict);
    expect(db.rpc.mock.calls.filter(([name]) => name === "commit_bounded_readiness")).toHaveLength(1);
  });
  it.each(["40001", "40P01", "55P03"])("treats concurrency SQLSTATE %s as retryable conflict", async (code) => {
    await expect(writeBoundedReadiness(client({ code, message: "conflict" }).value, input)).rejects.toBeInstanceOf(BoundedReadinessConflict);
  });
  it.each(["XX000", "08006", "23514", "PGRST202"])("fails infrastructure/schema SQLSTATE %s without sequential write fallback", async (code) => {
    const db = client({ code, message: "unavailable" });
    await expect(writeBoundedReadiness(db.value, input)).rejects.toThrow("bounded_database_unavailable");
    expect(db.from).toHaveBeenCalledTimes(1);
  });
  it("rejects an altered source revision during catalog loading", async () => {
    const db = client();
    db.rpc.mockResolvedValueOnce({ data: "16", error: null });
    await expect(writeBoundedReadiness(db.value, input)).rejects.toThrow("bounded_catalog_changed");
    expect(evaluateRecipeReadiness).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalledWith("commit_bounded_readiness", expect.anything());
  });
  it("returns the DB CAS token in an admin dry-run without writes", async () => {
    const db = client();
    expect(await dryRunBoundedReadiness(db.value, input)).toMatchObject({ planToken: token, transactional: true });
    expect(db.rpc).toHaveBeenCalledTimes(2);
    expect(evaluateRecipeReadiness).not.toHaveBeenCalled();
  });
  it("keeps public Preview scope inspection read-only and cannot issue an executable token", async () => {
    const db = client();
    expect(await dryRunBoundedReadiness(db.value, input, false)).toMatchObject({ blocked: false, planToken: null, transactional: false });
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it("limits the prepared read-only verifier to the seven-by-three approved scope", async () => {
    await expect(verifyBoundedReadiness({} as SupabaseClient, input)).rejects.toThrow("bounded_verification_scope_invalid");
  });
  it("rejects changed plan before evaluator or writes", async () => {
    const db = client();
    expect(await writeBoundedReadiness(db.value, { ...input, expectedPlanToken: "c".repeat(64) })).toMatchObject({ blocked: true, reason: "plan_changed", matchWrites: 0, readinessWrites: 0 });
    expect(evaluateRecipeReadiness).not.toHaveBeenCalled();
  });
});
