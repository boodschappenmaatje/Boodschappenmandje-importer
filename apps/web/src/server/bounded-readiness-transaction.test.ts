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

  it("commits the exact 20-recipe Shanghai shared scope in one transaction", async () => {
    const recipeIds = [
      "0dd9fbc7-6fa9-4b50-ab47-b1fa1e4cca8d", "17966cab-93ca-4364-b99c-c6fe7aff36ac",
      "189d9b3c-073a-43c7-8930-8191b22421bb", "2825125a-4ec4-4fae-a5f3-b44be2afb0aa",
      "39189d5d-21c6-4d57-a462-f95b63c0dda5", "3bbe1561-d757-422e-aded-3d802310805c",
      "4f871e07-a684-4014-843a-f72a11b4c01d", "5c655d2e-97f1-4d8c-8b97-10881e5589b0",
      "672ea259-71bc-446f-881c-8e59cf675fe2", "6a85d19f-5654-440b-b296-325c8f9fbd30",
      "6bb5396c-ee59-46bd-bb75-12f68c142fc2", "7ba39ebe-a057-4044-a47b-f9e79e2ef52f",
      "8f8c6883-2a58-4671-b5c4-13cd588d72ba", "ac562f36-fa92-4540-9e2d-4e073ca6b989",
      "af9c3407-a24d-4142-b8b6-cc18bc63defd", "bd423b61-4eb8-458e-8d32-bb64a9b38bda",
      "c4ace2a9-237b-4884-93d4-12fdc066274b", "c6903433-cfd0-4c97-ae1f-350f1625636b",
      "de621d70-dab9-4ad0-9747-43605a34af2a", "e33fcd95-34c9-471d-befe-76095b9d96e9",
    ];
    const matchKeys = [
      "meal-mix-ingredient:mix-supplement-olie:ml:ingredient:generic",
      "meal-mix-ingredient:mix-supplement-ui:piece:ingredient:generic",
    ];
    const shanghaiScope = { recipeIds, matchKeys };
    const db = client(null, shanghaiScope);
    vi.mocked(loadCatalog).mockResolvedValue({
      recipes: recipeIds.map((id) => ({ id })), ingredients: [], relations: [],
    } as unknown as Awaited<ReturnType<typeof loadCatalog>>);
    vi.mocked(requirementKeysForRecipes).mockReturnValue(new Map(recipeIds.map((id) => [id, matchKeys])));
    vi.mocked(rowsForGate).mockImplementation((_gate, people) => ({
      matchRows: matchKeys.map((match_key) => ({ match_key, product_id: null, match_status: "invalid", failure_reason: "no_catalog_product" })),
      readinessRows: recipeIds.map((recipe_id) => ({ recipe_id, people_count: people, dependency_match_keys: matchKeys })),
    } as ReturnType<typeof rowsForGate>));

    const result = await writeBoundedReadiness(db.value, { ...shanghaiScope, expectedPlanToken: token });
    expect(result).toMatchObject({ blocked: false, matchWrites: 2, readinessWrites: 200, outsideScopeEffects: 0 });
    expect(db.rpc.mock.calls.filter(([name]) => name === "commit_bounded_readiness")).toHaveLength(1);
    expect(db.rpc).toHaveBeenLastCalledWith("commit_bounded_readiness", expect.objectContaining({
      p_recipe_ids: recipeIds, p_match_keys: matchKeys,
      p_expected_plan_token: token,
      p_match_rows: expect.arrayContaining(matchKeys.map((match_key) => expect.objectContaining({ match_key }))),
      p_readiness_rows: expect.arrayContaining(recipeIds.map((recipe_id) => expect.objectContaining({ recipe_id }))),
    }));
    const submitted = db.rpc.mock.calls.at(-1)?.[1] as { p_readiness_rows: unknown[] };
    expect(submitted.p_readiness_rows).toHaveLength(200);
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
