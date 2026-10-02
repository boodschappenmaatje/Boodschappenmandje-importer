import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import { SupabaseCatalogRepository } from "@/services/catalog/catalog-repository";
import { createCachedCatalogRepository } from "@/services/week-preparation/planning-cache";
import { evaluateRecipeReadiness } from "@/services/week-preparation/recipe-readiness";
import { requirementKeysForRecipes } from "@/services/week-preparation/persistent-readiness-cache";
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

export interface BoundedRefreshPlan {
  requestedMatchKeys: string[];
  requestedRecipeIds: string[];
  resolvedRecipeIds: string[];
  plannedMatchWrites: number;
  plannedReadinessWrites: number;
  unexpectedDependencies: string[];
  blocked: boolean;
  reason: string | null;
  planToken: string | null;
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
      new Set(input.recipeIds).size !== input.recipeIds.length ||
      new Set(input.matchKeys).size !== input.matchKeys.length ||
      (input.expectedPlanToken !== undefined &&
        (typeof input.expectedPlanToken !== "string" || !/^[a-f0-9]{64}$/.test(input.expectedPlanToken)))) {
    return null;
  }
  return {
    recipeIds: [...input.recipeIds].sort() as string[],
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

async function inspectBoundedScope(client: SupabaseClient, input: BoundedRefreshInput) {
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
  return { catalog, recipes, plan };
}

export async function dryRunBoundedReadiness(client: SupabaseClient, input: BoundedRefreshInput): Promise<BoundedRefreshPlan> {
  return (await inspectBoundedScope(client, input)).plan;
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
  // Recheck immediately before writes. The database trigger invalidates subscribers
  // of match keys, so its observed subscribers must remain inside the allowlist.
  const recheck = await inspectBoundedScope(client, input);
  const recheckBlock = boundedWriteBlockReason(recheck.plan, input.expectedPlanToken);
  if (recheckBlock) {
    return { blocked: true, reason: recheckBlock, matchWrites: 0, readinessWrites: 0 };
  }
  const matchWrite = await client.from("ingredient_product_matches")
    .upsert([...matches.values()], { onConflict: "match_key" });
  if (matchWrite.error) throw new Error("bounded_match_write_failed");
  const readinessWrite = await client.from("recipe_readiness_cache")
    .upsert(readinessRows, { onConflict: "recipe_id,people_count" });
  if (readinessWrite.error) throw new Error("bounded_readiness_write_failed");
  return { blocked: false, reason: null, matchWrites: matches.size, readinessWrites: readinessRows.length };
}
