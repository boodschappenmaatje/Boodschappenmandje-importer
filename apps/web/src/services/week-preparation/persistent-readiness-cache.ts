import type { SupabaseClient } from "@supabase/supabase-js";

import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { aggregateWeekIngredients } from "@/services/week-preparation/ingredient-aggregation";
import {
  evaluateRecipeReadiness,
  recipeRequirementKey,
  type IngredientReadinessResult,
  type RecipeReadinessGateResult,
  type RecipeReadinessIssueOrigin,
  type RecipeReadinessReason,
  type RecipeReadinessResult,
} from "@/services/week-preparation/recipe-readiness";
import type { RecipeCatalog } from "@/services/week-preparation/recipe-repository";
import type { Product, Recipe } from "@/types/catalog";
import type { PreparedDay } from "@/types/week-preparation";

export const PLANNER_MATCHER_VERSION = 4;
export const PLANNER_READINESS_EVALUATOR_VERSION = 4;
export const PLANNER_READINESS_TTL_MS = 24 * 60 * 60 * 1000;

type RefreshStatus = "current" | "pending" | "failed";
type MatchStatus = "valid" | "invalid";

export interface PersistentProductMatchRow {
  match_key: string;
  ingredient_id: string | null;
  ingredient_source_key: string;
  requirement_unit: string;
  requirement_kind: string;
  brand_constraint: string;
  product_id: string | null;
  candidate_product_ids?: string[];
  match_status: MatchStatus;
  failure_reason: string | null;
  matcher_version: number;
  refresh_status: RefreshStatus;
  invalidated_at: string | null;
  product_updated_at: string | null;
  price_updated_at: string | null;
  checked_at: string;
}

export interface PersistentRecipeReadinessRow {
  recipe_id: string;
  people_count: number;
  readiness_status: "READY" | "NOT_READY";
  required_ingredient_count: number;
  ready_required_ingredient_count: number;
  problem_count: number;
  readiness_payload: unknown;
  dependency_match_keys: string[];
  evaluator_version: number;
  refresh_status: RefreshStatus;
  invalidated_at: string | null;
  evaluated_at: string;
  expires_at: string;
}

export interface PersistentReadinessLoadResult {
  available: boolean;
  readiness: PersistentRecipeReadinessRow[];
  matches: PersistentProductMatchRow[];
}

export interface PersistentRecipeReadinessRepository {
  load(
    recipeIds: string[],
    numberOfPeople: number,
    matchKeys: string[],
  ): Promise<PersistentReadinessLoadResult>;
  requestRefresh?(recipeIds: string[], numberOfPeople: number): Promise<void>;
}

export interface RecipeReadinessResolution {
  gate: RecipeReadinessGateResult;
  persistentHitCount: number;
  fallbackCount: number;
  cacheAvailable: boolean;
}

const READINESS_REASONS = new Set<RecipeReadinessReason>([
  "ingredient_invalid",
  "no_catalog_product",
  "matcher_failed",
  "low_confidence_match",
  "missing_price",
  "package_unknown",
  "quantity_conversion_failed",
  "product_reference_invalid",
  "category_mismatch",
  "alias_missing",
]);
const ISSUE_ORIGINS = new Set<RecipeReadinessIssueOrigin>([
  "catalogCoverage",
  "softwareOrMatching",
  "recipeData",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function validIngredientResult(value: unknown): value is IngredientReadinessResult {
  if (!isRecord(value)) return false;
  return (
    typeof value.ingredientId === "string" &&
    typeof value.sourceKey === "string" &&
    typeof value.name === "string" &&
    typeof value.required === "boolean" &&
    (value.requiredQuantity === null || typeof value.requiredQuantity === "number") &&
    (value.unit === null || ["g", "kg", "ml", "l", "piece", "loaf"].includes(String(value.unit))) &&
    typeof value.ready === "boolean" &&
    typeof value.catalogProductAvailable === "boolean" &&
    typeof value.reliableProductMatch === "boolean" &&
    typeof value.priceKnown === "boolean" &&
    typeof value.packageCalculable === "boolean" &&
    isNullableString(value.productId) &&
    isNullableString(value.sku) &&
    isNullableString(value.productName) &&
    isNullableString(value.requirementKey) &&
    (value.reason === null || READINESS_REASONS.has(value.reason as RecipeReadinessReason)) &&
    (value.origin === null || ISSUE_ORIGINS.has(value.origin as RecipeReadinessIssueOrigin))
  );
}

function parseReadinessResult(
  value: unknown,
  expectedRecipeId: string,
): RecipeReadinessResult | null {
  if (!isRecord(value) || value.recipeId !== expectedRecipeId) return null;
  if (
    typeof value.recipeSourceKey !== "string" ||
    typeof value.recipeName !== "string" ||
    typeof value.ready !== "boolean" ||
    !Number.isInteger(value.requiredIngredientCount) ||
    !Number.isInteger(value.readyRequiredIngredientCount) ||
    !Number.isInteger(value.problemCount) ||
    !Array.isArray(value.ingredients) ||
    !value.ingredients.every(validIngredientResult)
  ) {
    return null;
  }
  return value as unknown as RecipeReadinessResult;
}

function selectedDay(recipe: Recipe): PreparedDay {
  return {
    dayIndex: 0,
    category: "quick",
    freeChoice: false,
    recipeId: recipe.id,
    recipe: { id: recipe.id, sourceKey: recipe.sourceKey, name: recipe.name },
    status: "recipeSelected",
  };
}

export function requirementKeysForRecipes(
  recipes: Recipe[],
  numberOfPeople: number,
  catalog: RecipeCatalog,
): Map<string, string[]> {
  return new Map(
    recipes.map((recipe) => {
      try {
        const keys = aggregateWeekIngredients(
          [selectedDay(recipe)],
          numberOfPeople,
          catalog,
        ).map(recipeRequirementKey);
        return [recipe.id, [...new Set(keys)]];
      } catch {
        return [recipe.id, []];
      }
    }),
  );
}

function timestamp(value: string | null): number | null {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function sameTimestamp(left: string | null, right: string | null): boolean {
  return timestamp(left) === timestamp(right);
}

function currentMatch(row: PersistentProductMatchRow): boolean {
  return (
    row.matcher_version === PLANNER_MATCHER_VERSION &&
    row.refresh_status === "current" &&
    row.invalidated_at === null
  );
}

function currentReadiness(
  row: PersistentRecipeReadinessRow,
  now: Date,
): boolean {
  const expiresAt = timestamp(row.expires_at);
  return (
    row.evaluator_version === PLANNER_READINESS_EVALUATOR_VERSION &&
    row.refresh_status === "current" &&
    row.invalidated_at === null &&
    expiresAt !== null &&
    expiresAt > now.getTime()
  );
}

function productStillMatchesSnapshot(
  row: PersistentProductMatchRow,
  product: Product,
): boolean {
  return (
    product.id === row.product_id &&
    product.isAvailable !== false &&
    sameTimestamp(row.product_updated_at, product.updatedAt) &&
    sameTimestamp(row.price_updated_at, product.currentPrice?.updatedAt ?? null)
  );
}

async function loadProductsInBatches(
  repository: CatalogRepository,
  productIds: string[],
): Promise<Map<string, Product>> {
  const products = new Map<string, Product>();
  for (let offset = 0; offset < productIds.length; offset += 100) {
    const batch = productIds.slice(offset, offset + 100);
    const result = await repository.getByIds(batch);
    for (const product of result.products) products.set(product.id, product);
  }
  return products;
}

export async function resolveRecipeReadiness(
  recipes: Recipe[],
  numberOfPeople: number,
  catalog: RecipeCatalog,
  catalogRepository: CatalogRepository,
  persistentRepository?: PersistentRecipeReadinessRepository | null,
  now: Date = new Date(),
): Promise<RecipeReadinessResolution> {
  const keysByRecipe = requirementKeysForRecipes(recipes, numberOfPeople, catalog);
  const requestedKeys = [
    ...new Set([...keysByRecipe.values()].flat()),
  ];
  const emptyLoad: PersistentReadinessLoadResult = {
    available: false,
    readiness: [],
    matches: [],
  };
  const loaded = persistentRepository
    ? await persistentRepository
        .load(
          recipes.map((recipe) => recipe.id),
          numberOfPeople,
          requestedKeys,
        )
        .catch(() => emptyLoad)
    : emptyLoad;

  const matchByKey = new Map(
    loaded.matches
      .filter(currentMatch)
      .map((match) => [match.match_key, match]),
  );
  const productIds = [
    ...new Set(
      [...matchByKey.values()].flatMap((match) =>
        match.match_status === "valid" && match.product_id
          ? [match.product_id, ...(match.candidate_product_ids ?? [])]
          : [],
      ),
    ),
  ];
  const products = loaded.available
    ? await loadProductsInBatches(catalogRepository, productIds)
    : new Map<string, Product>();
  const usableProductsByRequirement = new Map<string, Product>();
  const candidatesByRequirement = new Map<string, { ingredient: RecipeCatalog["ingredients"][number]; products: Product[] }>();
  const usableMatchKeys = new Set<string>();
  for (const [key, match] of matchByKey) {
    if (match.match_status === "invalid") {
      usableMatchKeys.add(key);
      continue;
    }
    const product = match.product_id ? products.get(match.product_id) : null;
    if (product && productStillMatchesSnapshot(match, product)) {
      usableMatchKeys.add(key);
      usableProductsByRequirement.set(key, product);
      const ingredient = catalog.ingredients.find((item) => item.sourceKey === match.ingredient_source_key);
      if (ingredient) candidatesByRequirement.set(key, { ingredient, products: (match.candidate_product_ids ?? [product.id]).flatMap((id) => products.get(id) ?? []) });
    }
  }

  const rowByRecipe = new Map(
    loaded.readiness.map((row) => [row.recipe_id, row]),
  );
  const persistentResults = new Map<string, RecipeReadinessResult>();
  const fallbackRecipes: Recipe[] = [];
  for (const recipe of recipes) {
    const row = rowByRecipe.get(recipe.id);
    const payload = row ? parseReadinessResult(row.readiness_payload, recipe.id) : null;
    const dependencies = row?.dependency_match_keys ?? [];
    const dependenciesCurrent = dependencies.every((key) => usableMatchKeys.has(key));
    if (
      row &&
      payload &&
      currentReadiness(row, now) &&
      dependenciesCurrent &&
      row.people_count === numberOfPeople &&
      row.readiness_status === (payload.ready ? "READY" : "NOT_READY")
    ) {
      persistentResults.set(recipe.id, payload);
    } else {
      fallbackRecipes.push(recipe);
    }
  }

  const fallback = fallbackRecipes.length > 0
    ? await evaluateRecipeReadiness(
        fallbackRecipes,
        numberOfPeople,
        catalog,
        catalogRepository,
        { matchedProductsByRequirement: usableProductsByRequirement, candidatesByRequirement },
      )
    : { recipes: [], matchedProductsByRequirement: new Map<string, Product>(), candidatesByRequirement: new Map() };
  const fallbackByRecipe = new Map(
    fallback.recipes.map((result) => [result.recipeId, result]),
  );
  const matchedProductsByRequirement = new Map(usableProductsByRequirement);
  for (const [key, product] of fallback.matchedProductsByRequirement) {
    matchedProductsByRequirement.set(key, product);
  }
  for (const [key, candidates] of fallback.candidatesByRequirement ?? []) candidatesByRequirement.set(key, candidates);

  if (fallbackRecipes.length > 0 && persistentRepository?.requestRefresh) {
    void persistentRepository
      .requestRefresh(
        fallbackRecipes.map((recipe) => recipe.id),
        numberOfPeople,
      )
      .catch(() => undefined);
  }

  return {
    gate: {
      recipes: recipes.flatMap((recipe) => {
        const result = persistentResults.get(recipe.id) ?? fallbackByRecipe.get(recipe.id);
        return result ? [result] : [];
      }),
      matchedProductsByRequirement,
      candidatesByRequirement,
    },
    persistentHitCount: persistentResults.size,
    fallbackCount: fallbackRecipes.length,
    cacheAvailable: loaded.available,
  };
}

const READINESS_SELECT = [
  "recipe_id",
  "people_count",
  "readiness_status",
  "required_ingredient_count",
  "ready_required_ingredient_count",
  "problem_count",
  "readiness_payload",
  "dependency_match_keys",
  "evaluator_version",
  "refresh_status",
  "invalidated_at",
  "evaluated_at",
  "expires_at",
].join(",");

const MATCH_SELECT = [
  "match_key",
  "ingredient_id",
  "ingredient_source_key",
  "requirement_unit",
  "requirement_kind",
  "brand_constraint",
  "product_id",
  "candidate_product_ids",
  "match_status",
  "failure_reason",
  "matcher_version",
  "refresh_status",
  "invalidated_at",
  "product_updated_at",
  "price_updated_at",
  "checked_at",
].join(",");

export class SupabasePersistentRecipeReadinessRepository
  implements PersistentRecipeReadinessRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async load(
    recipeIds: string[],
    numberOfPeople: number,
    matchKeys: string[],
  ): Promise<PersistentReadinessLoadResult> {
    const readiness: PersistentRecipeReadinessRow[] = [];
    const matches: PersistentProductMatchRow[] = [];
    const readinessBatches = Array.from(
      { length: Math.ceil(recipeIds.length / 100) },
      (_, index) => recipeIds.slice(index * 100, (index + 1) * 100),
    );
    const matchBatches = Array.from(
      { length: Math.ceil(matchKeys.length / 100) },
      (_, index) => matchKeys.slice(index * 100, (index + 1) * 100),
    );
    const [readinessResults, matchResults] = await Promise.all([
      Promise.all(readinessBatches.map((ids) => this.client
        .from("recipe_readiness_cache")
        .select(READINESS_SELECT)
        .eq("people_count", numberOfPeople)
        .in("recipe_id", ids))),
      Promise.all(matchBatches.map((keys) => this.client
        .from("ingredient_product_matches")
        .select(MATCH_SELECT)
        .in("match_key", keys))),
    ]);
    for (const result of readinessResults) {
      if (result.error || !Array.isArray(result.data)) {
        return { available: false, readiness: [], matches: [] };
      }
      readiness.push(...(result.data as unknown as PersistentRecipeReadinessRow[]));
    }
    for (const result of matchResults) {
      if (result.error || !Array.isArray(result.data)) {
        return { available: false, readiness: [], matches: [] };
      }
      matches.push(...(result.data as unknown as PersistentProductMatchRow[]));
    }
    return { available: true, readiness, matches };
  }

  async requestRefresh(recipeIds: string[], numberOfPeople: number): Promise<void> {
    if (recipeIds.length === 0 || typeof window === "undefined") return;
    const response = await fetch("/api/planner-readiness/refresh", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recipeIds: recipeIds.slice(0, 100), numberOfPeople }),
      keepalive: true,
    });
    if (!response.ok && response.status !== 503) {
      throw new Error("planner-cache-refresh-failed");
    }
  }
}

export function createPersistentRecipeReadinessRepository(): PersistentRecipeReadinessRepository | null {
  if (typeof window === "undefined") return null;
  const client = getSupabaseBrowserClient();
  return client ? new SupabasePersistentRecipeReadinessRepository(client) : null;
}
