import type { SupabaseClient } from "@supabase/supabase-js";

import { SupabaseCatalogRepository } from "@/services/catalog/catalog-repository";
import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import { createCachedCatalogRepository } from "@/services/week-preparation/planning-cache";
import { enrichIngredientsForMealMixes } from "@/services/week-preparation/meal-mix-profiles";
import {
  isReliableIngredientMatch,
} from "@/services/week-preparation/product-matching";
import {
  matcherVersionForSourceKey,
  readinessVersionForMatchKeys,
  PLANNER_READINESS_TTL_MS,
  SupabasePersistentRecipeReadinessRepository,
  requirementKeysForRecipes,
  resolveRecipeReadiness,
} from "@/services/week-preparation/persistent-readiness-cache";
import type {
  IngredientReadinessResult,
  RecipeReadinessGateResult,
} from "@/services/week-preparation/recipe-readiness";
import {
  SupabaseRecipeRepository,
  type RecipeCatalog,
} from "@/services/week-preparation/recipe-repository";
import type { Product, Recipe } from "@/types/catalog";

export interface PlannerCacheRefreshInput {
  recipeIds: string[];
  numberOfPeople: number;
}

export interface PlannerCacheRefreshResult {
  requested: number;
  refreshed: number;
  persistentHits: number;
  fallbackCount: number;
}

export const PLANNER_MAINTENANCE_PEOPLE_COUNTS = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
] as const;

export interface PlannerReadinessStateRow {
  recipe_id: string;
  people_count: number;
  evaluator_version: number;
  dependency_match_keys?: string[];
  refresh_status: string;
  invalidated_at: string | null;
  expires_at: string;
}

export interface PlannerReadinessMaintenanceTarget {
  numberOfPeople: number;
  recipeIds: string[];
}

export interface PlannerCacheMaintenanceResult extends PlannerCacheRefreshResult {
  maintainedPeopleCounts: number[];
  skippedCurrentReadiness: number;
}

interface PlannerCacheRefreshAttempt extends PlannerCacheRefreshResult {
  rejectedReadinessRecipeIds: string[];
}

function currentReadinessState(
  row: PlannerReadinessStateRow,
  now: Date,
): boolean {
  const expiresAt = Date.parse(row.expires_at);
  return (
    row.evaluator_version === readinessVersionForMatchKeys(row.dependency_match_keys ?? []) &&
    row.refresh_status === "current" &&
    row.invalidated_at === null &&
    Number.isFinite(expiresAt) &&
    expiresAt > now.getTime()
  );
}

export function planPlannerReadinessMaintenance(
  recipeIds: string[],
  rows: PlannerReadinessStateRow[],
  peopleCounts: readonly number[],
  now: Date = new Date(),
): PlannerReadinessMaintenanceTarget[] {
  const uniqueRecipeIds = [...new Set(recipeIds)];
  const currentKeys = new Set(
    rows
      .filter((row) => currentReadinessState(row, now))
      .map((row) => `${row.recipe_id}:${row.people_count}`),
  );
  return [...new Set(peopleCounts)].flatMap((numberOfPeople) => {
    const missingOrStale = uniqueRecipeIds.filter(
      (recipeId) => !currentKeys.has(`${recipeId}:${numberOfPeople}`),
    );
    return missingOrStale.length > 0
      ? [{ numberOfPeople, recipeIds: missingOrStale }]
      : [];
  });
}

function uniqueBoundedIds(values: unknown, maximum: number): string[] {
  if (!Array.isArray(values)) return [];
  return [...new Set(
    values
      .filter((value): value is string => typeof value === "string")
      .map((value) => value.trim())
      .filter(Boolean),
  )].slice(0, maximum);
}

export function parsePlannerCacheRefreshInput(
  value: unknown,
): PlannerCacheRefreshInput | null {
  if (typeof value !== "object" || value === null) return null;
  const input = value as { recipeIds?: unknown; numberOfPeople?: unknown };
  const recipeIds = uniqueBoundedIds(input.recipeIds, 100);
  const numberOfPeople = Number(input.numberOfPeople);
  if (
    recipeIds.length === 0 ||
    !Number.isInteger(numberOfPeople) ||
    numberOfPeople < 1 ||
    numberOfPeople > 12
  ) {
    return null;
  }
  return { recipeIds, numberOfPeople };
}

export function matchDescriptor(requirementKey: string): {
  ingredientId: string;
  unit: string;
  kind: string;
  brandConstraint: string;
} | null {
  const parts = requirementKey.split(":");
  const brand = parts.pop() ?? "";
  const kind = parts.pop() ?? "";
  const unit = parts.pop() ?? "";
  const ingredientId = parts.join(":");
  if (
    !ingredientId ||
    !["g", "kg", "ml", "l", "piece", "loaf"].includes(unit) ||
    !["ingredient", "mealMix"].includes(kind)
  ) {
    return null;
  }
  return {
    ingredientId,
    unit,
    kind,
    brandConstraint: brand === "generic" ? "" : brand,
  };
}

function bestIngredientResult(
  current: IngredientReadinessResult | undefined,
  next: IngredientReadinessResult,
): IngredientReadinessResult {
  if (!current) return next;
  if (!current.productId && next.productId) return next;
  if (!current.ready && next.ready) return next;
  return current;
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function persistedIngredientId(ingredientId: string): string | null {
  return UUID_PATTERN.test(ingredientId) ? ingredientId : null;
}

export function rowsForGate(
  gate: RecipeReadinessGateResult,
  numberOfPeople: number,
  now: Date,
) {
  const ingredientsByKey = new Map<string, IngredientReadinessResult>();
  for (const recipe of gate.recipes) {
    for (const ingredient of recipe.ingredients) {
      if (!ingredient.requirementKey) continue;
      ingredientsByKey.set(
        ingredient.requirementKey,
        bestIngredientResult(
          ingredientsByKey.get(ingredient.requirementKey),
          ingredient,
        ),
      );
    }
  }

  const matchRows = [...ingredientsByKey].flatMap(([key, ingredient]) => {
    const descriptor = matchDescriptor(key);
    if (!descriptor) return [];
    const product = gate.matchedProductsByRequirement.get(key) ?? null;
    return [{
      match_key: key,
      ingredient_id: persistedIngredientId(descriptor.ingredientId),
      ingredient_source_key: ingredient.sourceKey,
      requirement_unit: descriptor.unit,
      requirement_kind: descriptor.kind,
      brand_constraint: descriptor.brandConstraint,
      product_id: product?.id ?? null,
      candidate_product_ids: gate.candidatesByRequirement?.get(key)?.products.map((candidate) => candidate.id) ?? (product ? [product.id] : []),
      match_status: product ? "valid" : "invalid",
      failure_reason: product ? null : ingredient.reason ?? "matcher_failed",
      matcher_version: matcherVersionForSourceKey(ingredient.sourceKey),
      refresh_status: "current",
      invalidated_at: null,
      invalidation_reason: null,
      product_updated_at: product?.updatedAt ?? null,
      price_updated_at: product?.currentPrice?.updatedAt ?? null,
      matched_at: now.toISOString(),
      checked_at: now.toISOString(),
    }];
  });
  const expiresAt = new Date(now.getTime() + PLANNER_READINESS_TTL_MS).toISOString();
  const readinessRows = gate.recipes.map((recipe) => ({
    recipe_id: recipe.recipeId,
    people_count: numberOfPeople,
    readiness_status: recipe.ready ? "READY" : "NOT_READY",
    required_ingredient_count: recipe.requiredIngredientCount,
    ready_required_ingredient_count: recipe.readyRequiredIngredientCount,
    problem_count: recipe.problemCount,
    readiness_payload: recipe,
    dependency_match_keys: [...new Set(
      recipe.ingredients.flatMap((ingredient) =>
        ingredient.requirementKey ? [ingredient.requirementKey] : [],
      ),
    )],
    evaluator_version: readinessVersionForMatchKeys(recipe.ingredients.flatMap((ingredient) =>
      ingredient.requirementKey ? [ingredient.requirementKey] : [],
    )),
    refresh_status: "current",
    invalidated_at: null,
    invalidation_reason: null,
    evaluated_at: now.toISOString(),
    expires_at: expiresAt,
  }));
  return { matchRows, readinessRows };
}

export function rejectedReadinessRecipeIds(
  expectedRows: Array<{ recipe_id: string; people_count: number }>,
  savedRows: Array<{
    recipe_id: string;
    people_count: number;
    refresh_status: string;
    invalidated_at: string | null;
  }>,
): string[] {
  const expectedKeys = new Set(expectedRows.map((row) => `${row.recipe_id}:${row.people_count}`));
  const savedKeys = new Set(savedRows.map((row) => `${row.recipe_id}:${row.people_count}`));
  if (savedKeys.size !== savedRows.length || savedKeys.size !== expectedKeys.size ||
      [...expectedKeys].some((key) => !savedKeys.has(key))) {
    throw new Error("planner-readiness-cache-verification-failed");
  }
  return [...new Set(savedRows.filter((row) =>
    row.refresh_status !== "current" || row.invalidated_at !== null,
  ).map((row) => row.recipe_id))];
}

export async function loadCatalog(
  client: SupabaseClient,
  includeBlockedRecipeIds: readonly string[] = [],
): Promise<RecipeCatalog> {
  const loaded = await new SupabaseRecipeRepository(client).loadCatalog(undefined, {
    includeBlockedRecipeIds,
  });
  return {
    ...loaded,
    ingredients: enrichIngredientsForMealMixes(loaded.ingredients, loaded.mealMixProfiles),
  };
}

async function persistGate(
  client: SupabaseClient,
  gate: RecipeReadinessGateResult,
  numberOfPeople: number,
  now: Date,
): Promise<string[]> {
  const { matchRows, readinessRows } = rowsForGate(gate, numberOfPeople, now);
  if (matchRows.length > 0) {
    const matchResult = await client
      .from("ingredient_product_matches")
      .upsert(matchRows, { onConflict: "match_key" })
      .select("match_key,refresh_status,invalidated_at");
    if (matchResult.error) throw new Error("planner-match-cache-write-failed");
    const savedMatches = matchResult.data as Array<{
      match_key: string;
      refresh_status: string;
      invalidated_at: string | null;
    }> | null;
    if (!Array.isArray(savedMatches) || savedMatches.length !== matchRows.length ||
        savedMatches.some((row) => row.refresh_status !== "current" || row.invalidated_at !== null) ||
        matchRows.some((row) => !savedMatches.some((saved) => saved.match_key === row.match_key))) {
      throw new Error("planner-match-cache-verification-failed");
    }
  }
  if (readinessRows.length > 0) {
    const readinessResult = await client
      .from("recipe_readiness_cache")
      .upsert(readinessRows, { onConflict: "recipe_id,people_count" })
      .select("recipe_id,people_count,refresh_status,invalidated_at");
    if (readinessResult.error) throw new Error("planner-readiness-cache-write-failed");
    if (!Array.isArray(readinessResult.data) || readinessResult.data.length !== readinessRows.length) {
      throw new Error("planner-readiness-cache-verification-failed");
    }
    const saved = readinessResult.data as Array<{
      recipe_id: string;
      people_count: number;
      refresh_status: string;
      invalidated_at: string | null;
    }>;
    return rejectedReadinessRecipeIds(readinessRows, saved);
  }
  return [];
}

async function refreshWithCatalog(
  client: SupabaseClient,
  catalog: RecipeCatalog,
  recipes: Recipe[],
  numberOfPeople: number,
  now: Date,
  catalogRepository: CatalogRepository = new SupabaseCatalogRepository(client),
  allowRejectedReadiness = false,
): Promise<PlannerCacheRefreshAttempt> {
  const persistentRepository = new SupabasePersistentRecipeReadinessRepository(client);
  const resolution = await resolveRecipeReadiness(
    recipes,
    numberOfPeople,
    catalog,
    catalogRepository,
    persistentRepository,
    now,
  );
  const rejectedReadinessRecipeIds = await persistGate(client, resolution.gate, numberOfPeople, now);
  if (rejectedReadinessRecipeIds.length > 0 && !allowRejectedReadiness) {
    throw new Error("planner-readiness-cache-not-current-after-write");
  }
  return {
    requested: recipes.length,
    refreshed: resolution.gate.recipes.length,
    persistentHits: resolution.persistentHitCount,
    fallbackCount: resolution.fallbackCount,
    rejectedReadinessRecipeIds,
  };
}

async function pendingMatchKeysForRecipes(
  client: SupabaseClient,
  recipes: Recipe[],
  catalog: RecipeCatalog,
): Promise<Map<string, string[]>> {
  const keysByRecipe = new Map<string, Set<string>>();
  for (const people of PLANNER_MAINTENANCE_PEOPLE_COUNTS) {
    for (const [recipeId, keys] of requirementKeysForRecipes(recipes, people, catalog)) {
      const current = keysByRecipe.get(recipeId) ?? new Set<string>();
      for (const key of keys) current.add(key);
      keysByRecipe.set(recipeId, current);
    }
  }
  const keys = [...new Set([...keysByRecipe.values()].flatMap((recipeKeys) => [...recipeKeys]))];
  if (keys.length === 0) return new Map();
  // Keep the recovery preflight bounded independently of the refresh input.
  // Oversized requests may still refresh through the existing route; if the
  // guard rejects them, recovery fails closed because no exact pending scope
  // was collected.
  if (keys.length > 1000) return new Map([...keysByRecipe.keys()].map((id) => [id, []]));
  const pending = new Set<string>();
  for (let offset = 0; offset < keys.length; offset += 100) {
    const result = await client.from("ingredient_product_matches")
      .select("match_key,refresh_status")
      .in("match_key", keys.slice(offset, offset + 100));
    if (result.error || !Array.isArray(result.data)) throw new Error("planner-match-cache-state-read-failed");
    for (const row of result.data as Array<{ match_key: string; refresh_status: string }>) {
      if (row.refresh_status === "pending") pending.add(row.match_key);
    }
  }
  return new Map([...keysByRecipe].map(([recipeId, recipeKeys]) => [
    recipeId,
    [...recipeKeys].filter((key) => pending.has(key)).sort(),
  ]));
}

async function restoreRejectedBoundedReadiness(
  client: SupabaseClient,
  recipeIds: string[],
  matchKeys: string[],
  now: Date,
): Promise<number> {
  if (recipeIds.length === 0 || matchKeys.length === 0) {
    throw new Error("planner-bounded-recovery-scope-unavailable");
  }
  if (recipeIds.length > 10 || matchKeys.length > 10) {
    throw new Error("planner-bounded-recovery-scope-exceeded");
  }
  const subscribers = await client.from("recipe_readiness_cache")
    .select("recipe_id,people_count")
    .overlaps("dependency_match_keys", matchKeys)
    .limit(1000);
  if (subscribers.error || !Array.isArray(subscribers.data)) {
    throw new Error("planner-bounded-recovery-subscribers-unavailable");
  }
  const scopedRecipeIds = [...new Set([
    ...recipeIds,
    ...(subscribers.data as Array<{ recipe_id: string }>).map((row) => row.recipe_id),
  ])].sort();
  if (scopedRecipeIds.length > 10 || matchKeys.length > 10) {
    throw new Error("planner-bounded-recovery-scope-exceeded");
  }

  // Import lazily to avoid a static cycle: the bounded service uses this
  // module's catalog loader and row builder. Its RPC remains the only route
  // that can publish CURRENT for bounded_only resources.
  const { dryRunBoundedReadiness, writeBoundedReadiness } =
    await import("@/server/bounded-readiness-maintenance");
  const scope = { recipeIds: scopedRecipeIds, matchKeys };
  const plan = await dryRunBoundedReadiness(client, scope);
  if (plan.blocked || !plan.planToken) {
    throw new Error(`planner-bounded-recovery-blocked:${plan.reason ?? "plan_unavailable"}`);
  }
  const committed = await writeBoundedReadiness(client, {
    ...scope,
    expectedPlanToken: plan.planToken,
  });
  if (committed.blocked) throw new Error(`planner-bounded-recovery-blocked:${committed.reason}`);

  const readiness = await loadReadinessState(
    client,
    scopedRecipeIds,
    PLANNER_MAINTENANCE_PEOPLE_COUNTS,
  );
  const readinessByKey = new Map(readiness.map((row) => [`${row.recipe_id}:${row.people_count}`, row]));
  const allReadinessCurrent = scopedRecipeIds.every((id) =>
    PLANNER_MAINTENANCE_PEOPLE_COUNTS.every((people) => {
      const row = readinessByKey.get(`${id}:${people}`);
      return row !== undefined && currentReadinessState(row, now);
    }),
  );
  const matches = await client.from("ingredient_product_matches")
    .select("match_key,refresh_status,invalidated_at")
    .in("match_key", matchKeys);
  const matchRows = matches.data as Array<{
    match_key: string;
    refresh_status: string;
    invalidated_at: string | null;
  }> | null;
  if (matches.error || !Array.isArray(matchRows) || matchRows.length !== matchKeys.length ||
      matchRows.some((row) => row.refresh_status !== "current" || row.invalidated_at !== null) ||
      !allReadinessCurrent) {
    throw new Error("planner-bounded-recovery-verification-failed");
  }
  return scopedRecipeIds.length * PLANNER_MAINTENANCE_PEOPLE_COUNTS.length;
}

export async function refreshPlannerReadiness(
  client: SupabaseClient,
  input: PlannerCacheRefreshInput,
  now: Date = new Date(),
): Promise<PlannerCacheRefreshResult> {
  const catalog = await loadCatalog(client);
  const requested = new Set(input.recipeIds);
  const recipes = catalog.recipes.filter((recipe) => requested.has(recipe.id));
  return refreshWithCatalog(client, catalog, recipes, input.numberOfPeople, now);
}

const READINESS_STATE_SELECT = [
  "recipe_id",
  "people_count",
  "evaluator_version",
  "dependency_match_keys",
  "refresh_status",
  "invalidated_at",
  "expires_at",
].join(",");

async function loadReadinessState(
  client: SupabaseClient,
  recipeIds: string[],
  peopleCounts: readonly number[],
): Promise<PlannerReadinessStateRow[]> {
  if (recipeIds.length === 0 || peopleCounts.length === 0) return [];
  const result = await client
    .from("recipe_readiness_cache")
    .select(READINESS_STATE_SELECT)
    .in("recipe_id", recipeIds)
    .in("people_count", [...peopleCounts]);
  if (result.error || !Array.isArray(result.data)) {
    throw new Error("planner-readiness-state-read-failed");
  }
  return result.data as unknown as PlannerReadinessStateRow[];
}

/**
 * Lazy, targeted maintenance for normal planner traffic. The browser already
 * reports only recipes that missed the persistent fast path. Rebuild those
 * recipes for 1–10 people without touching current rows for other recipes.
 */
export async function maintainPlannerReadiness(
  client: SupabaseClient,
  input: PlannerCacheRefreshInput,
  now: Date = new Date(),
): Promise<PlannerCacheMaintenanceResult> {
  const catalog = await loadCatalog(client);
  const requested = new Set(input.recipeIds);
  const recipes = catalog.recipes.filter((recipe) => requested.has(recipe.id));
  const recipeIds = recipes.map((recipe) => recipe.id);
  const peopleCounts = input.numberOfPeople >= 1 && input.numberOfPeople <= 10
    ? [
        input.numberOfPeople,
        ...PLANNER_MAINTENANCE_PEOPLE_COUNTS.filter(
          (count) => count !== input.numberOfPeople,
        ),
      ]
    : [input.numberOfPeople];
  const existing = await loadReadinessState(client, recipeIds, peopleCounts);
  const targets = planPlannerReadinessMaintenance(
    recipeIds,
    existing,
    peopleCounts,
    now,
  );
  const targetRecipeIds = new Set(targets.flatMap((target) => target.recipeIds));
  const pendingKeysByRecipe = targetRecipeIds.size > 0
    ? await pendingMatchKeysForRecipes(
        client,
        recipes.filter((recipe) => targetRecipeIds.has(recipe.id)),
        catalog,
      )
    : new Map<string, string[]>();
  let refreshed = 0;
  let persistentHits = 0;
  let fallbackCount = 0;
  const rejectedRecipeIds = new Set<string>();
  const catalogRepository = createCachedCatalogRepository(new SupabaseCatalogRepository(client));
  for (const target of targets) {
    const targetIds = new Set(target.recipeIds.filter((id) => !rejectedRecipeIds.has(id)));
    if (targetIds.size === 0) continue;
    const result = await refreshWithCatalog(
      client,
      catalog,
      recipes.filter((recipe) => targetIds.has(recipe.id)),
      target.numberOfPeople,
      now,
      catalogRepository,
      true,
    );
    const rejected = new Set(result.rejectedReadinessRecipeIds);
    for (const id of rejected) rejectedRecipeIds.add(id);
    refreshed += result.refreshed - rejected.size;
    persistentHits += result.persistentHits;
    fallbackCount += result.fallbackCount;
  }
  if (rejectedRecipeIds.size > 0) {
    const recovered = await restoreRejectedBoundedReadiness(
      client,
      [...rejectedRecipeIds].sort(),
      [...new Set([...rejectedRecipeIds].flatMap((id) => pendingKeysByRecipe.get(id) ?? []))].sort(),
      now,
    );
    refreshed += recovered;
  }
  const maintainedPeopleCounts = [...new Set([
    ...targets.map((target) => target.numberOfPeople),
    ...(rejectedRecipeIds.size > 0 ? PLANNER_MAINTENANCE_PEOPLE_COUNTS : []),
  ])].sort((a, b) => a - b);
  return {
    requested: recipes.length,
    refreshed,
    persistentHits,
    fallbackCount,
    maintainedPeopleCounts,
    skippedCurrentReadiness: Math.max(0, recipeIds.length * peopleCounts.length - refreshed),
  };
}

export interface PlannerBackfillInput {
  afterSourceKey?: string | null;
  batchSize?: number;
  numberOfPeople: number;
}

export interface PlannerBackfillResult extends PlannerCacheRefreshResult {
  nextCursor: string | null;
  complete: boolean;
}

export async function backfillPlannerReadinessBatch(
  client: SupabaseClient,
  input: PlannerBackfillInput,
  now: Date = new Date(),
): Promise<PlannerBackfillResult> {
  if (!Number.isInteger(input.numberOfPeople) || input.numberOfPeople < 1 || input.numberOfPeople > 12) {
    throw new Error("invalid-people-count");
  }
  const requestedBatchSize = Number.isFinite(input.batchSize)
    ? Math.trunc(input.batchSize ?? 10)
    : 10;
  const batchSize = Math.max(1, Math.min(20, requestedBatchSize));
  const catalog = await loadCatalog(client);
  const ordered = catalog.recipes.toSorted((left, right) =>
    left.sourceKey.localeCompare(right.sourceKey),
  );
  const candidates = ordered.filter((recipe) =>
    !input.afterSourceKey || recipe.sourceKey > input.afterSourceKey,
  );
  const batch = candidates.slice(0, batchSize);
  const existing = await loadReadinessState(
    client,
    batch.map((recipe) => recipe.id),
    [input.numberOfPeople],
  );
  const targets = planPlannerReadinessMaintenance(
    batch.map((recipe) => recipe.id),
    existing,
    [input.numberOfPeople],
    now,
  );
  const targetIds = new Set(targets[0]?.recipeIds ?? []);
  const refreshed = targetIds.size > 0
    ? await refreshWithCatalog(
        client,
        catalog,
        batch.filter((recipe) => targetIds.has(recipe.id)),
        input.numberOfPeople,
        now,
      )
    : {
        requested: 0,
        refreshed: 0,
        persistentHits: 0,
        fallbackCount: 0,
      };
  const nextCursor = batch.at(-1)?.sourceKey ?? null;
  return {
    ...refreshed,
    nextCursor,
    complete: batch.length === 0 || candidates.length <= batch.length,
  };
}

export interface MatchRepairInput {
  matchKey: string;
  productId: string;
}

export interface MatchRepairResult {
  affectedRecipeCount: number;
  refreshedReadinessCount: number;
}

export async function repairIngredientProductMatch(
  client: SupabaseClient,
  input: MatchRepairInput,
  now: Date = new Date(),
): Promise<MatchRepairResult> {
  const descriptor = matchDescriptor(input.matchKey);
  if (!descriptor || !input.productId.trim()) throw new Error("invalid-match-repair");
  const catalog = await loadCatalog(client);
  const ingredient = catalog.ingredients.find((item) => item.id === descriptor.ingredientId);
  if (!ingredient) throw new Error("ingredient-not-found");
  const catalogRepository = new SupabaseCatalogRepository(client);
  const productResult = await catalogRepository.getByIds([input.productId]);
  const product: Product | undefined = productResult.products[0];
  if (
    !product ||
    !isReliableIngredientMatch(
      ingredient,
      product,
      descriptor.brandConstraint === "Knorr" || descriptor.brandConstraint === "Honig"
        ? descriptor.brandConstraint
        : null,
    )
  ) {
    throw new Error("unreliable-match-repair");
  }

  const write = await client.from("ingredient_product_matches").upsert({
    match_key: input.matchKey,
    ingredient_id: persistedIngredientId(descriptor.ingredientId),
    ingredient_source_key: ingredient.sourceKey,
    requirement_unit: descriptor.unit,
    requirement_kind: descriptor.kind,
    brand_constraint: descriptor.brandConstraint,
    product_id: product.id,
    match_status: "valid",
    failure_reason: null,
    matcher_version: matcherVersionForSourceKey(ingredient.sourceKey),
    refresh_status: "current",
    invalidated_at: null,
    invalidation_reason: null,
    product_updated_at: product.updatedAt,
    price_updated_at: product.currentPrice?.updatedAt ?? null,
    matched_at: now.toISOString(),
    checked_at: now.toISOString(),
  }, { onConflict: "match_key" });
  if (write.error) throw new Error("planner-match-repair-write-failed");

  const keysByRecipe = requirementKeysForRecipes(catalog.recipes, 1, catalog);
  const affectedRecipes = catalog.recipes.filter((recipe) =>
    keysByRecipe.get(recipe.id)?.includes(input.matchKey),
  );
  if (affectedRecipes.length === 0) {
    return { affectedRecipeCount: 0, refreshedReadinessCount: 0 };
  }
  const existing = await client
    .from("recipe_readiness_cache")
    .select("recipe_id,people_count")
    .in("recipe_id", affectedRecipes.map((recipe) => recipe.id));
  if (existing.error || !Array.isArray(existing.data)) {
    throw new Error("planner-readiness-scope-read-failed");
  }
  const peopleCounts = [...new Set(
    existing.data.flatMap((row) =>
      typeof row.people_count === "number" ? [row.people_count] : [],
    ),
  )];
  let refreshedReadinessCount = 0;
  for (const numberOfPeople of peopleCounts) {
    const result = await refreshWithCatalog(
      client,
      catalog,
      affectedRecipes,
      numberOfPeople,
      now,
    );
    refreshedReadinessCount += result.refreshed;
  }
  return {
    affectedRecipeCount: affectedRecipes.length,
    refreshedReadinessCount,
  };
}
