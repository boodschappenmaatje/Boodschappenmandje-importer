import type { SupabaseClient } from "@supabase/supabase-js";

import { SupabaseCatalogRepository } from "@/services/catalog/catalog-repository";
import { evaluateRecipeReadiness } from "@/services/week-preparation/recipe-readiness";
import { PLANNER_MAINTENANCE_PEOPLE_COUNTS, loadCatalog, rowsForGate } from "@/server/planner-cache-service";
import type { Recipe } from "@/types/catalog";

/** Only the seven independently reviewed SKU → existing recipe links are
 * eligible for this narrow readiness path. Adding a link requires review. */
export const EXPLICIT_RECIPE_LINKS = {
  "686060000": "6593543a-5c8d-409d-8c9e-145632c43f0b",
  "686150000": "17b1cade-cd86-4c55-81b6-ceeef22ed196",
  "704884000": "654b1b0c-6a25-412e-9119-b05a475e0d2e",
  "704888000": "f6460830-bd8e-4e85-9568-5336f5543bfb",
  "704892000": "4404d963-73f3-4cc7-b8d0-b9a91cbca5da",
  "704897000": "4718fbbd-5cd9-4a58-841c-e62bee4574db",
  "704898000": "95cfbfc8-45a0-4de9-b015-a731cb015107",
} as const;

export type ExplicitRecipeLinkInput = { sku: string; recipeId: string };
export type ExplicitRecipeReadinessResult = {
  sku: string;
  recipeId: string;
  readiness: Array<{ peopleCount: number; status: "READY" | "NOT_READY"; problemCount: number }>;
  readinessWrites: number;
  profileStatus: "needs_review";
  profilePromoted: false;
  matchCacheWrites: 0;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

export function parseExplicitRecipeLinkInput(value: unknown): ExplicitRecipeLinkInput | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const input = value as Record<string, unknown>;
  if (typeof input.sku !== "string" || typeof input.recipeId !== "string" ||
      !UUID.test(input.recipeId) || !Object.hasOwn(EXPLICIT_RECIPE_LINKS, input.sku) ||
      EXPLICIT_RECIPE_LINKS[input.sku as keyof typeof EXPLICIT_RECIPE_LINKS] !== input.recipeId) return null;
  return { sku: input.sku, recipeId: input.recipeId.toLowerCase() };
}

function failClosed(reason: string): never {
  throw new Error(reason);
}

function currentEquivalent(row: Record<string, unknown>, next: Record<string, unknown>, now: Date): boolean {
  const expiry = typeof row.expires_at === "string" ? Date.parse(row.expires_at) : NaN;
  return row.recipe_id === next.recipe_id && row.people_count === next.people_count &&
    row.readiness_status === next.readiness_status &&
    row.required_ingredient_count === next.required_ingredient_count &&
    row.ready_required_ingredient_count === next.ready_required_ingredient_count &&
    row.problem_count === next.problem_count &&
    stableJson(row.readiness_payload) === stableJson(next.readiness_payload) &&
    stableJson(row.dependency_match_keys) === stableJson(next.dependency_match_keys) &&
    row.evaluator_version === next.evaluator_version && row.refresh_status === "current" &&
    row.invalidated_at === null && Number.isFinite(expiry) && expiry > now.getTime();
}

/** Evaluate a reviewed link with the normal readiness evaluator. The only
 * possible write is this exact recipe's readiness cache; match cache/profile
 * rows and every other recipe are read-only. */
export async function refreshExplicitRecipeReadiness(
  client: SupabaseClient,
  input: ExplicitRecipeLinkInput,
  { persist = true, now = new Date() }: { persist?: boolean; now?: Date } = {},
): Promise<ExplicitRecipeReadinessResult> {
  const parsed = parseExplicitRecipeLinkInput(input);
  if (!parsed) failClosed("explicit_link_not_allowlisted");

  const productResult = await client.from("products").select("id,sku,name,brand")
    .eq("sku", parsed.sku).maybeSingle();
  if (productResult.error || !productResult.data) failClosed("explicit_product_unavailable");
  const product = productResult.data as { id: string; sku: string; name: string; brand: string | null };
  if (product.sku !== parsed.sku || product.brand?.trim().toLocaleLowerCase("en-US") !== "knorr" ||
      !/^knorr\b/i.test(product.name)) failClosed("explicit_product_identity_mismatch");

  const profileResult = await client.from("meal_mix_profiles")
    .select("product_id,recipe_id,status,profile,brand")
    .eq("product_id", product.id).maybeSingle();
  if (profileResult.error || !profileResult.data) failClosed("explicit_profile_unavailable");
  const profile = profileResult.data as { product_id: string; recipe_id: string | null; status: string; profile: unknown; brand: string | null };
  if (profile.status !== "needs_review" || profile.profile !== null ||
      profile.brand?.trim().toLocaleLowerCase("en-US") !== "knorr" ||
      (profile.recipe_id !== null && profile.recipe_id !== parsed.recipeId)) {
    failClosed("explicit_profile_state_mismatch");
  }

  const recipeResult = await client.from("recipes").select("id")
    .eq("id", parsed.recipeId).maybeSingle();
  if (recipeResult.error || !recipeResult.data) failClosed("explicit_recipe_unavailable");
  const ingredientResult = await client.from("recipe_ingredients").select("id")
    .eq("recipe_id", parsed.recipeId).limit(1);
  if (ingredientResult.error || !Array.isArray(ingredientResult.data) || ingredientResult.data.length === 0) {
    failClosed("explicit_recipe_ingredients_missing");
  }

  const catalog = await loadCatalog(client, [parsed.recipeId]);
  const recipe = catalog.recipes.find((item) => item.id === parsed.recipeId);
  if (!recipe) failClosed("explicit_recipe_not_in_catalog");
  const oldResult = await client.from("recipe_readiness_cache")
    .select("recipe_id,people_count,evaluator_version,dependency_match_keys,refresh_status,invalidated_at,expires_at,readiness_status,required_ingredient_count,ready_required_ingredient_count,problem_count,readiness_payload")
    .eq("recipe_id", parsed.recipeId).in("people_count", [...PLANNER_MAINTENANCE_PEOPLE_COUNTS]);
  if (oldResult.error || !Array.isArray(oldResult.data)) failClosed("readiness_state_unavailable");
  const previous = new Map((oldResult.data as Record<string, unknown>[]).map((row) => [row.people_count, row]));
  const pendingWrites: Record<string, unknown>[] = [];
  const readiness: ExplicitRecipeReadinessResult["readiness"] = [];
  const repository = new SupabaseCatalogRepository(client);
  for (const peopleCount of PLANNER_MAINTENANCE_PEOPLE_COUNTS) {
    const gate = await evaluateRecipeReadiness([recipe as Recipe], peopleCount, catalog, repository);
    if (gate.recipes.length !== 1 || gate.recipes[0]?.recipeId !== parsed.recipeId) failClosed("evaluator_scope_mismatch");
    const rows = rowsForGate(gate, peopleCount, now);
    if (rows.readinessRows.length !== 1 || rows.readinessRows[0]?.recipe_id !== parsed.recipeId) failClosed("readiness_scope_mismatch");
    const row = rows.readinessRows[0] as unknown as Record<string, unknown>;
    const old = previous.get(peopleCount);
    if (persist && (!old || !currentEquivalent(old, row, now))) pendingWrites.push(row);
    readiness.push({ peopleCount, status: row.readiness_status as "READY" | "NOT_READY", problemCount: Number(row.problem_count) });
  }

  if (persist && pendingWrites.length) {
    const saved = await client.from("recipe_readiness_cache").upsert(pendingWrites, { onConflict: "recipe_id,people_count" });
    if (saved.error) failClosed("readiness_cache_write_failed");
  }
  return {
    sku: parsed.sku,
    recipeId: parsed.recipeId,
    readiness,
    readinessWrites: pendingWrites.length,
    profileStatus: "needs_review",
    profilePromoted: false,
    matchCacheWrites: 0,
  };
}
