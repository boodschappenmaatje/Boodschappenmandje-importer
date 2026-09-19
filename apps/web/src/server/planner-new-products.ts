import type { SupabaseClient } from "@supabase/supabase-js";

import { SupabaseCatalogRepository } from "@/services/catalog/catalog-repository";
import { resolveCurrentPrice } from "@/services/catalog/price";
import {
  PLANNER_MATCHER_VERSION,
  SupabasePersistentRecipeReadinessRepository,
  resolveRecipeReadiness,
  type PersistentProductMatchRow,
} from "@/services/week-preparation/persistent-readiness-cache";
import {
  isReliableIngredientMatch,
  productPackageCapacity,
  selectIngredientProduct,
} from "@/services/week-preparation/product-matching";
import type { RecipeCatalog } from "@/services/week-preparation/recipe-repository";
import type { Product } from "@/types/catalog";
import type { WeekIngredientUnit } from "@/types/week-preparation";
import { loadCatalog, matchDescriptor, rowsForGate } from "@/server/planner-cache-service";

export const MAX_NEW_PRODUCT_IDS = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function parseNewProductIds(value: unknown): string[] | null {
  if (typeof value !== "object" || value === null) return null;
  const ids = (value as { productIds?: unknown }).productIds;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > MAX_NEW_PRODUCT_IDS ||
    ids.some((id) => typeof id !== "string" || !UUID.test(id))) return null;
  return [...new Set(ids as string[])];
}

/** Local candidate check only; no catalog searches or SQL matching rules. */
export function selectNewProductRepairs(
  matches: PersistentProductMatchRow[],
  products: Product[],
  catalog: RecipeCatalog,
): Array<{ match: PersistentProductMatchRow; product: Product }> {
  return matches.flatMap((match) => {
    if (match.match_status !== "invalid" || match.failure_reason !== "no_catalog_product" ||
      match.refresh_status !== "current" || match.invalidated_at !== null ||
      match.matcher_version !== PLANNER_MATCHER_VERSION || match.product_id !== null) return [];
    const descriptor = matchDescriptor(match.match_key);
    const ingredient = descriptor && catalog.ingredients.find((item) =>
      item.id === descriptor.ingredientId && item.sourceKey === match.ingredient_source_key,
    );
    if (!descriptor || !ingredient || descriptor.unit !== match.requirement_unit ||
      descriptor.kind !== match.requirement_kind || descriptor.brandConstraint !== match.brand_constraint ||
      !["", "Knorr", "Honig"].includes(descriptor.brandConstraint)) return [];
    const brand = descriptor.brandConstraint === "Knorr" || descriptor.brandConstraint === "Honig"
      ? descriptor.brandConstraint : null;
    const candidates = products.filter((product) =>
      isReliableIngredientMatch(ingredient, product, brand) &&
      product.currentPrice?.productId === product.id &&
      resolveCurrentPrice(product.currentPrice) !== null &&
      (descriptor.kind === "mealMix" ||
        productPackageCapacity(product, descriptor.unit as WeekIngredientUnit) !== null),
    );
    if (candidates.length === 0) return [];
    const product = selectIngredientProduct(
      ingredient, candidates, brand, descriptor.unit as WeekIngredientUnit,
    );
    return product ? [{ match, product }] : [];
  });
}

type DependencyRow = {
  recipe_id: string;
  people_count: number;
  refresh_status: string;
  updated_at: string;
};

/** Trusted importer notification. Writes only existing derived cache rows. */
export async function maintainPlannerForNewProducts(
  client: SupabaseClient,
  productIds: string[],
  now = new Date(),
) {
  const ids = parseNewProductIds({ productIds });
  if (!ids) throw new Error("invalid-new-product-ids");
  const repository = new SupabaseCatalogRepository(client);
  const products = (await repository.getByIds(ids)).products;
  // Fail closed rather than acknowledge a notification before its price exists.
  if (products.length !== ids.length || products.some((product) =>
    product.supermarket !== "Hoogvliet" || product.currentPrice?.productId !== product.id ||
    !resolveCurrentPrice(product.currentPrice),
  )) throw new Error("new-products-not-price-ready");

  const missing = await client.from("ingredient_product_matches").select("*")
    .eq("match_status", "invalid").eq("failure_reason", "no_catalog_product")
    .eq("refresh_status", "current").is("invalidated_at", null)
    .eq("matcher_version", PLANNER_MATCHER_VERSION).limit(1001);
  if (missing.error || !Array.isArray(missing.data) || missing.data.length > 1000) {
    throw new Error("missing-match-scope-read-failed");
  }
  const catalog = await loadCatalog(client);
  const repairs = selectNewProductRepairs(missing.data, products, catalog);
  const changedMatchKeys: string[] = [];
  for (const { match, product } of repairs) {
    // Compare-and-set: a concurrent repair/invalidation must never be overwritten.
    const result = await client.from("ingredient_product_matches").update({
      product_id: product.id,
      match_status: "valid",
      failure_reason: null,
      product_updated_at: product.updatedAt,
      price_updated_at: product.currentPrice?.updatedAt ?? null,
      matched_at: now.toISOString(),
      checked_at: now.toISOString(),
      invalidation_reason: null,
    }).eq("match_key", match.match_key).eq("checked_at", match.checked_at)
      .eq("match_status", "invalid").eq("failure_reason", "no_catalog_product")
      .eq("refresh_status", "current").is("invalidated_at", null)
      .eq("matcher_version", PLANNER_MATCHER_VERSION).select("match_key");
    if (result.error) throw new Error("new-product-match-write-failed");
    if (result.data?.length) changedMatchKeys.push(match.match_key);
  }
  // Also resume after an interrupted notification: valid matches are NOT rewritten.
  // Existing match-change triggers have already marked dependent rows pending.
  const linked = await client.from("ingredient_product_matches").select("match_key")
    .eq("match_status", "valid").eq("refresh_status", "current").in("product_id", ids);
  if (linked.error || !Array.isArray(linked.data)) throw new Error("linked-match-read-failed");
  const keys = linked.data.map((row) => row.match_key as string);
  let refreshedReadinessCount = 0;
  const affectedRecipeIds = new Set<string>();
  if (keys.length > 0) {
    const pending = await client.from("recipe_readiness_cache")
      .select("recipe_id,people_count,refresh_status,updated_at")
      .overlaps("dependency_match_keys", keys).eq("refresh_status", "pending")
      .gte("people_count", 1).lte("people_count", 10).limit(1001);
    if (pending.error || !Array.isArray(pending.data) || pending.data.length > 1000) {
      throw new Error("dependent-readiness-read-failed");
    }
    const rows = pending.data as DependencyRow[];
    for (const people of [...new Set(rows.map((row) => row.people_count))]) {
      const targets = rows.filter((row) => row.people_count === people);
      // Bound evaluation work and never fill a missing people_count as a side effect.
      for (let offset = 0; offset < targets.length; offset += 10) {
        const batch = targets.slice(offset, offset + 10);
        const recipes = catalog.recipes.filter((recipe) => batch.some((row) => row.recipe_id === recipe.id));
        const resolved = await resolveRecipeReadiness(recipes, people, catalog, repository,
          new SupabasePersistentRecipeReadinessRepository(client), now);
        const readiness = rowsForGate(resolved.gate, people, now).readinessRows;
        for (const row of readiness) {
          const snapshot = batch.find((item) => item.recipe_id === row.recipe_id)!;
          const write = await client.from("recipe_readiness_cache").update(row)
            .eq("recipe_id", row.recipe_id).eq("people_count", people)
            .eq("refresh_status", "pending").eq("updated_at", snapshot.updated_at)
            .select("recipe_id");
          if (write.error) throw new Error("dependent-readiness-write-failed");
          if (write.data?.length) {
            refreshedReadinessCount += 1;
            affectedRecipeIds.add(row.recipe_id);
          }
        }
      }
    }
  }
  return { productCount: ids.length, changedMatchKeys, refreshedReadinessCount,
    affectedRecipeIds: [...affectedRecipeIds] };
}
