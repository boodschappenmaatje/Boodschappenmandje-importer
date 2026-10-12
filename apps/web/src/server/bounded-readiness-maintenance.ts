import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SupabaseCatalogRepository } from "@/services/catalog/catalog-repository";
import { createCachedCatalogRepository } from "@/services/week-preparation/planning-cache";
import { evaluateRecipeReadiness } from "@/services/week-preparation/recipe-readiness";
import {
  matcherVersionForSourceKey,
  readinessVersionForMatchKeys,
  requirementKeysForRecipes,
} from "@/services/week-preparation/persistent-readiness-cache";
import { loadCatalog, PLANNER_MAINTENANCE_PEOPLE_COUNTS, rowsForGate } from "@/server/planner-cache-service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_RECIPES = 10;
const MAX_KEYS = 10;
const MAX_SUBSCRIBERS = 1000;

export interface BoundedRefreshInput {
  recipeIds: string[];
  matchKeys: string[];
  expectedPlanToken?: string;
}

interface Subscriber {
  recipe_id: string;
  people_count: number;
  updated_at: string;
  dependency_match_keys: string[];
}

export class BoundedReadinessConflict extends Error {}

const APPROVED_RECIPE_IDS = [
  "4e60b9b6-abd3-46e7-b6a1-b10f73ccbec3",
  "baf31144-bb45-4c2b-aa2f-2f9be588b01c",
  "3bbe1561-d757-422e-aded-3d802310805c",
  "5726609e-82a3-4fa7-b5b0-dab78b2b59f1",
  "4f871e07-a684-4014-843a-f72a11b4c01d",
  "2825125a-4ec4-4fae-a5f3-b44be2afb0aa",
  "6a85d19f-5654-440b-b296-325c8f9fbd30",
].sort();
const APPROVED_MATCH_KEYS = [
  "meal-mix-ingredient:mix-supplement-hacheevlees:g:ingredient:generic",
  "meal-mix-ingredient:mix-supplement-pitabroodjes:g:ingredient:generic",
  "meal-mix-ingredient:mix-supplement-tomaten:piece:ingredient:generic",
].sort();

export function isBoundedDatabaseConflict(error: { code?: string; message?: string }): boolean {
  return ["40001", "40P01", "55P03"].includes(error.code ?? "") ||
    (error.code === "P0001" && error.message?.startsWith("bounded_") === true);
}

function databaseFailure(error: { code?: string; message?: string }): never {
  if (isBoundedDatabaseConflict(error)) throw new BoundedReadinessConflict(error.message ?? "bounded_conflict");
  throw new Error("bounded_database_unavailable");
}

export interface BoundedRefreshPlan {
  requestedMatchKeys: string[];
  requestedRecipeIds: string[];
  resolvedRecipeIds: string[];
  dependencyKeys?: string[];
  sourceRevision?: string | null;
  casRevisions?: Array<[string, string]>;
  subscriberScope?: Array<{ recipeId: string; peopleCount: number }>;
  plannedMatchWrites: number;
  plannedReadinessWrites: number;
  unexpectedDependencies: string[];
  blocked: boolean;
  reason: string | null;
  planToken: string | null;
  transactional?: boolean;
}

export function parseBoundedRefreshInput(value: unknown): BoundedRefreshInput | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  if (!Array.isArray(input.recipeIds) || !Array.isArray(input.matchKeys) ||
      input.recipeIds.length < 1 || input.recipeIds.length > MAX_RECIPES ||
      input.matchKeys.length < 1 || input.matchKeys.length > MAX_KEYS ||
      input.recipeIds.some((id) => typeof id !== "string" || !UUID.test(id)) ||
      input.matchKeys.some((key) => typeof key !== "string" || key.length > 200 ||
        !/^.+:(g|kg|ml|l|piece|loaf):(ingredient|mealMix):[^:]+$/.test(key)) ||
      new Set(input.recipeIds.map((id) => id.toLowerCase())).size !== input.recipeIds.length ||
      new Set(input.matchKeys).size !== input.matchKeys.length ||
      (input.expectedPlanToken !== undefined &&
        (typeof input.expectedPlanToken !== "string" || !/^[a-f0-9]{64}$/.test(input.expectedPlanToken)))) {
    return null;
  }
  return {
    recipeIds: input.recipeIds.map((id: string) => id.toLowerCase()).sort(),
    matchKeys: [...input.matchKeys].sort() as string[],
    expectedPlanToken: input.expectedPlanToken as string | undefined,
  };
}

export function buildBoundedRefreshPlan(
  input: BoundedRefreshInput,
  keysByPeople: Map<number, Map<string, string[]>>,
  subscribers: Subscriber[],
  resolvedRecipeIds: string[],
): BoundedRefreshPlan {
  const requestedRecipeIds = [...input.recipeIds].sort();
  const requestedMatchKeys = [...input.matchKeys].sort();
  const allowedRecipes = new Set(requestedRecipeIds);
  const allowedKeys = new Set(requestedMatchKeys);
  const resolved = [...resolvedRecipeIds].sort();
  const observedKeys = new Set<string>();
  const unexpected = new Set<string>();
  let reason: string | null = null;

  if (resolved.join("|") !== requestedRecipeIds.join("|")) reason = "unknown_recipe_id";
  for (const people of PLANNER_MAINTENANCE_PEOPLE_COUNTS) {
    const keys = keysByPeople.get(people);
    if (!keys) { reason ??= "missing_people_scope"; continue; }
    for (const recipeId of requestedRecipeIds) {
      const recipeKeys = keys.get(recipeId);
      if (!recipeKeys?.some((key) => allowedKeys.has(key))) reason ??= "recipe_has_no_requested_match_key";
      for (const key of recipeKeys ?? []) if (allowedKeys.has(key)) observedKeys.add(key);
    }
  }
  if (observedKeys.size !== allowedKeys.size) reason ??= "unknown_match_key";
  if (subscribers.length >= MAX_SUBSCRIBERS) reason ??= "subscriber_scope_too_large";
  for (const subscriber of subscribers) {
    if (subscriber.dependency_match_keys.some((key) => allowedKeys.has(key)) &&
        (!allowedRecipes.has(subscriber.recipe_id) ||
          !PLANNER_MAINTENANCE_PEOPLE_COUNTS.includes(subscriber.people_count as 1))) {
      unexpected.add(`${subscriber.recipe_id}:${subscriber.people_count}`);
    }
  }
  if (unexpected.size) reason ??= "dependency_outside_allowlist";
  const blocked = reason !== null;
  const scope = subscribers.map(({ recipe_id, people_count, updated_at, dependency_match_keys }) =>
    [recipe_id, people_count, updated_at, dependency_match_keys.toSorted()],
  ).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const recipeDependencies = PLANNER_MAINTENANCE_PEOPLE_COUNTS.map((people) =>
    [people, requestedRecipeIds.map((recipeId) =>
      [recipeId, [...(keysByPeople.get(people)?.get(recipeId) ?? [])].sort()],
    )],
  );
  const planToken = blocked ? null : createHash("sha256")
    .update(JSON.stringify([requestedRecipeIds, requestedMatchKeys, recipeDependencies, scope]))
    .digest("hex");
  return {
    requestedMatchKeys,
    requestedRecipeIds,
    resolvedRecipeIds: resolved,
    plannedMatchWrites: blocked ? 0 : requestedMatchKeys.length,
    plannedReadinessWrites: blocked ? 0 : requestedRecipeIds.length * PLANNER_MAINTENANCE_PEOPLE_COUNTS.length,
    unexpectedDependencies: [...unexpected].sort(),
    blocked, reason, planToken,
  };
}

async function inspectBoundedScope(client: SupabaseClient, input: BoundedRefreshInput, transactional = true) {
  // Bracket catalog reads with the DB source revision. A recipe/profile change
  // during load must not turn an old dependency set into a newly valid plan.
  const source = transactional ? await client.rpc("bounded_readiness_source_revision") : null;
  if (source?.error) databaseFailure(source.error);
  if (transactional && typeof source?.data !== "string") throw new Error("bounded_source_revision_unavailable");
  const catalog = await loadCatalog(client);
  const requested = new Set(input.recipeIds);
  const recipes = catalog.recipes.filter((recipe) => requested.has(recipe.id));
  const keysByPeople = new Map(PLANNER_MAINTENANCE_PEOPLE_COUNTS.map((people) =>
    [people, requirementKeysForRecipes(recipes, people, catalog)],
  ));
  const subscribers = await client.from("recipe_readiness_cache")
    .select("recipe_id,people_count,updated_at,dependency_match_keys")
    .overlaps("dependency_match_keys", input.matchKeys)
    .limit(MAX_SUBSCRIBERS);
  if (subscribers.error || !Array.isArray(subscribers.data)) throw new Error("subscriber_scope_unavailable");
  const plan = buildBoundedRefreshPlan(input, keysByPeople, subscribers.data as Subscriber[], recipes.map((recipe) => recipe.id));
  const dependencyKeys = [...new Set([...keysByPeople.values()].flatMap((keys) => [...keys.values()].flat()))].sort();
  plan.dependencyKeys = dependencyKeys;
  plan.sourceRevision = transactional ? source?.data as string : null;
  plan.subscriberScope = subscribers.data.map((row: Subscriber) => ({
    recipeId: row.recipe_id,
    peopleCount: row.people_count,
  })).sort((a: { recipeId: string; peopleCount: number }, b: { recipeId: string; peopleCount: number }) =>
    a.recipeId.localeCompare(b.recipeId) || a.peopleCount - b.peopleCount);
  plan.transactional = transactional;
  if (!transactional) {
    // Public Preview inspection never creates a write token or needs an RPC
    // privilege. A Production admin dry-run is required for an executable plan.
    plan.planToken = null;
  } else if (!plan.blocked) {
    const snapshot = await client.rpc("bounded_readiness_plan", {
      p_recipe_ids: input.recipeIds, p_match_keys: input.matchKeys, p_dependency_keys: dependencyKeys,
    });
    if (snapshot.error) databaseFailure(snapshot.error);
    if (snapshot.data?.sourceRevision !== source?.data) throw new BoundedReadinessConflict("bounded_catalog_changed");
    if (typeof snapshot.data?.planToken !== "string" || !/^[a-f0-9]{64}$/.test(snapshot.data.planToken)) {
      throw new Error("bounded_plan_unavailable");
    }
    plan.planToken = snapshot.data.planToken;
    const revisions = snapshot.data?.state?.resources;
    if (!Array.isArray(revisions) || revisions.some((entry: unknown) =>
      !Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== "string" ||
      typeof entry[1] !== "string" || !/^\d+$/.test(entry[1]))) {
      throw new Error("bounded_revision_snapshot_unavailable");
    }
    plan.casRevisions = revisions as Array<[string, string]>;
  }
  return { catalog, recipes, plan, dependencyKeys };
}

export async function dryRunBoundedReadiness(client: SupabaseClient, input: BoundedRefreshInput, transactional = true): Promise<BoundedRefreshPlan> {
  return (await inspectBoundedScope(client, input, transactional)).plan;
}

export function boundedWriteBlockReason(plan: BoundedRefreshPlan, expectedPlanToken?: string): string | null {
  if (!expectedPlanToken) return "plan_token_required";
  if (plan.blocked) return plan.reason ?? "scope_blocked";
  if (plan.planToken !== expectedPlanToken) return "plan_changed";
  return null;
}

export async function writeBoundedReadiness(client: SupabaseClient, input: BoundedRefreshInput) {
  if (!input.expectedPlanToken) return { blocked: true, reason: "plan_token_required", matchWrites: 0, readinessWrites: 0 };
  const initial = await inspectBoundedScope(client, input);
  const initialBlock = boundedWriteBlockReason(initial.plan, input.expectedPlanToken);
  if (initialBlock) {
    return { blocked: true, reason: initialBlock, matchWrites: 0, readinessWrites: 0 };
  }
  const catalogRepository = createCachedCatalogRepository(new SupabaseCatalogRepository(client));
  const readinessRows: ReturnType<typeof rowsForGate>["readinessRows"] = [];
  const matches = new Map<string, ReturnType<typeof rowsForGate>["matchRows"][number]>();
  const allowedKeys = new Set(input.matchKeys);
  const allowedRecipes = new Set(input.recipeIds);
  for (const people of PLANNER_MAINTENANCE_PEOPLE_COUNTS) {
    const gate = await evaluateRecipeReadiness(initial.recipes, people, initial.catalog, catalogRepository);
    const rows = rowsForGate(gate, people, new Date());
    if (rows.readinessRows.length !== input.recipeIds.length ||
        rows.readinessRows.some((row) => !allowedRecipes.has(row.recipe_id))) {
      return { blocked: true, reason: "evaluator_recipe_scope_changed", matchWrites: 0, readinessWrites: 0 };
    }
    readinessRows.push(...rows.readinessRows);
    for (const row of rows.matchRows.filter((candidate) => allowedKeys.has(candidate.match_key))) {
      const previous = matches.get(row.match_key);
      if (previous && (previous.product_id !== row.product_id || previous.match_status !== row.match_status ||
          previous.failure_reason !== row.failure_reason)) {
        return { blocked: true, reason: "match_changes_across_people", matchWrites: 0, readinessWrites: 0 };
      }
      matches.set(row.match_key, row);
    }
  }
  if (matches.size !== allowedKeys.size || readinessRows.length !== initial.plan.plannedReadinessWrites) {
    return { blocked: true, reason: "computed_scope_mismatch", matchWrites: 0, readinessWrites: 0 };
  }
  // Exactly one final write request. All guards, CAS, legacy trigger effects
  // and both upserts execute in its PostgreSQL transaction. No write fallback.
  const committed = await client.rpc("commit_bounded_readiness", {
    p_recipe_ids: input.recipeIds,
    p_match_keys: input.matchKeys,
    p_dependency_keys: initial.dependencyKeys,
    p_expected_plan_token: input.expectedPlanToken,
    p_match_rows: [...matches.values()],
    p_readiness_rows: readinessRows,
  });
  if (committed.error) databaseFailure(committed.error);
  const result = committed.data;
  if (result?.blocked !== false || result.matchWrites !== matches.size ||
      result.readinessWrites !== readinessRows.length || result.outsideScopeEffects !== 0 ||
      typeof result.finalPlanToken !== "string" || !/^[a-f0-9]{64}$/.test(result.finalPlanToken) ||
      !Array.isArray(result.validatedScope?.recipeIds) || !Array.isArray(result.validatedScope?.matchKeys) ||
      JSON.stringify([...result.validatedScope.recipeIds].sort()) !== JSON.stringify([...input.recipeIds].sort()) ||
      JSON.stringify([...result.validatedScope.matchKeys].sort()) !== JSON.stringify([...input.matchKeys].sort())) {
    throw new Error("bounded_commit_result_invalid");
  }
  return result;
}

/** Read-only post-commit verification for the fixed, approved one-time scope. */
export async function verifyBoundedReadiness(client: SupabaseClient, input: BoundedRefreshInput, now = new Date()) {
  if (JSON.stringify([...input.recipeIds].sort()) !== JSON.stringify(APPROVED_RECIPE_IDS) ||
      JSON.stringify([...input.matchKeys].sort()) !== JSON.stringify(APPROVED_MATCH_KEYS)) {
    throw new Error("bounded_verification_scope_invalid");
  }
  const plan = await dryRunBoundedReadiness(client, input);
  const expectedSubscribers = APPROVED_RECIPE_IDS.flatMap((recipeId) =>
    PLANNER_MAINTENANCE_PEOPLE_COUNTS.map((peopleCount) => `${recipeId}:${peopleCount}`)).sort();
  const subscribers = (plan.subscriberScope ?? []).map((entry) => `${entry.recipeId}:${entry.peopleCount}`).sort();
  if (plan.blocked || plan.transactional !== true || plan.plannedMatchWrites !== 3 ||
      plan.plannedReadinessWrites !== 70 || subscribers.length !== 70 ||
      JSON.stringify(subscribers) !== JSON.stringify(expectedSubscribers) ||
      !Array.isArray(plan.casRevisions) || !plan.sourceRevision) {
    throw new Error("bounded_verification_plan_mismatch");
  }
  const expectedResources = new Set([
    ...APPROVED_RECIPE_IDS.map((recipeId) => `r:${recipeId}`),
    ...(plan.dependencyKeys ?? []).map((key) => `k:${key}`),
  ]);
  const casResources = plan.casRevisions.map(([resource]) => resource);
  if (new Set(casResources).size !== casResources.length ||
      plan.casRevisions.some(([resource, revision]) => !/^\d+$/.test(revision) || typeof resource !== "string") ||
      [...expectedResources].some((resource) => !casResources.includes(resource)) ||
      casResources.some((resource) => !expectedResources.has(resource) &&
        !(resource.startsWith("k:") && /^[A-Za-z0-9:_-]+:(g|kg|ml|l|piece|loaf):(ingredient|mealMix):[A-Za-z0-9_-]+$/.test(resource.slice(2))))) {
    throw new Error("bounded_verification_revision_scope_invalid");
  }

  const [matches, readiness] = await Promise.all([
    client.from("ingredient_product_matches")
      .select("match_key,ingredient_source_key,product_id,match_status,failure_reason,refresh_status,invalidated_at,invalidation_reason,matcher_version,product_updated_at,price_updated_at,matched_at,checked_at,updated_at")
      .in("match_key", APPROVED_MATCH_KEYS),
    client.from("recipe_readiness_cache")
      .select("recipe_id,people_count,readiness_status,required_ingredient_count,ready_required_ingredient_count,problem_count,readiness_payload,dependency_match_keys,evaluator_version,refresh_status,invalidated_at,invalidation_reason,evaluated_at,expires_at,updated_at")
      .in("recipe_id", APPROVED_RECIPE_IDS)
      .in("people_count", [...PLANNER_MAINTENANCE_PEOPLE_COUNTS]),
  ]);
  if (matches.error || !Array.isArray(matches.data) || matches.data.length !== 3 ||
      readiness.error || !Array.isArray(readiness.data) || readiness.data.length !== 70) {
    throw new Error("bounded_verification_rows_missing");
  }
  const matchKeys = matches.data.map((row) => row.match_key).sort();
  if (JSON.stringify(matchKeys) !== JSON.stringify(APPROVED_MATCH_KEYS) || matches.data.some((row) =>
    row.refresh_status !== "current" || row.invalidated_at !== null || row.invalidation_reason !== null ||
    !["valid", "invalid"].includes(row.match_status) || !Number.isInteger(row.matcher_version) ||
    row.matcher_version !== matcherVersionForSourceKey(row.ingredient_source_key) ||
    (row.match_status === "valid" && (!row.product_id || row.failure_reason !== null)) ||
    (row.match_status === "invalid" && (row.product_id !== null || !row.failure_reason)) ||
    !row.matched_at || !row.checked_at || !row.updated_at ||
    [row.product_updated_at, row.price_updated_at].some((value) => value !== null && !Number.isFinite(Date.parse(value))))) {
    throw new Error("bounded_verification_match_state_invalid");
  }
  const readinessKeys = readiness.data.map((row) => `${row.recipe_id}:${row.people_count}`).sort();
  if (JSON.stringify(readinessKeys) !== JSON.stringify(expectedSubscribers)) {
    throw new Error("bounded_verification_readiness_scope_invalid");
  }
  const expiries: number[] = [];
  const evaluatorVersions = new Set<number>();
  for (const row of readiness.data) {
    const dependencyKeys = row.dependency_match_keys;
    const payload = row.readiness_payload;
    const expiry = typeof row.expires_at === "string" ? Date.parse(row.expires_at) : NaN;
    if (row.refresh_status !== "current" || row.invalidated_at !== null || row.invalidation_reason !== null ||
        !["READY", "NOT_READY"].includes(row.readiness_status) ||
        !Number.isInteger(row.evaluator_version) || !Array.isArray(dependencyKeys) ||
        dependencyKeys.some((key) => typeof key !== "string" || !plan.dependencyKeys?.includes(key)) ||
        !dependencyKeys.some((key) => APPROVED_MATCH_KEYS.includes(key)) ||
        row.evaluator_version !== readinessVersionForMatchKeys(dependencyKeys) ||
        !Number.isInteger(row.required_ingredient_count) || !Number.isInteger(row.ready_required_ingredient_count) ||
        !Number.isInteger(row.problem_count) || row.ready_required_ingredient_count > row.required_ingredient_count ||
        !payload || typeof payload !== "object" || Array.isArray(payload) ||
        (payload as { recipeId?: unknown }).recipeId !== row.recipe_id ||
        (payload as { ready?: unknown }).ready !== (row.readiness_status === "READY") ||
        (payload as { requiredIngredientCount?: unknown }).requiredIngredientCount !== row.required_ingredient_count ||
        (payload as { readyRequiredIngredientCount?: unknown }).readyRequiredIngredientCount !== row.ready_required_ingredient_count ||
        (payload as { problemCount?: unknown }).problemCount !== row.problem_count ||
        !Array.isArray((payload as { ingredients?: unknown }).ingredients) ||
        JSON.stringify([...new Set([...(payload as { ingredients: Array<{ requirementKey?: unknown }> }).ingredients]
          .map((ingredient) => ingredient?.requirementKey).filter((key): key is string => typeof key === "string"))].sort()) !==
          JSON.stringify([...dependencyKeys].sort()) ||
        !row.evaluated_at || !row.updated_at || !Number.isFinite(expiry) || expiry <= now.getTime()) {
      throw new Error("bounded_verification_readiness_state_invalid");
    }
    evaluatorVersions.add(row.evaluator_version);
    expiries.push(expiry);
  }
  return {
    blocked: false,
    recipeCount: APPROVED_RECIPE_IDS.length,
    matchKeyCount: matches.data.length,
    subscriberCount: readiness.data.length,
    currentMatchRows: matches.data.length,
    currentReadinessRows: readiness.data.length,
    invalidatedRows: 0,
    dependencyKeys: plan.dependencyKeys,
    sourceRevision: plan.sourceRevision,
    casRevisionCount: plan.casRevisions.length,
    revisionMetadataValidated: true,
    evaluatorVersions: [...evaluatorVersions].sort((a, b) => a - b),
    expiryRange: { earliest: new Date(Math.min(...expiries)).toISOString(), latest: new Date(Math.max(...expiries)).toISOString() },
    payloadsValidated: readiness.data.length,
  };
}
