import { describe, expect, it } from "vitest";
import { SupabaseRecipeRepository } from "./recipe-repository";

const blockedRecipeId = "6593543a-5c8d-409d-8c9e-145632c43f0b";
const otherRecipeId = "00000000-0000-4000-8000-000000000001";

function database() {
  const dataByTable: Record<string, unknown[]> = {
    recipes: [blockedRecipeId, otherRecipeId].map((id) => ({ id, source_key: `recipe-${id}`, name: "Recept", normalized_name: "recept",
      symbol: "fork.knife", preparation_minutes: 20, vegetarian: false, contains_pork: false, kid_friendly: false,
      healthy: false, budget_tier: "standard" })),
    ingredients: [{ id: "ingredient-a", source_key: "ingredient-a", name: "Ui", normalized_name: "ui", default_unit: "piece", category: "Groente" }],
    ingredient_aliases: [],
    recipe_ingredients: [blockedRecipeId, otherRecipeId].map((recipe_id, index) => ({ id: `relation-${index}`, recipe_id,
      ingredient_id: "ingredient-a", amount_per_person: 1, unit: "piece", position: 0 })),
    meal_mix_profiles: [{ recipe_id: blockedRecipeId, product_id: "product-a", status: "needs_review", profile: null,
      products: { name: "Knorr Wereldgerechten Kip Siam", sku: "686060000" } }],
  };
  const from = (table: string) => {
    const query: Record<string, unknown> = {
      select: () => query,
      order: () => query,
      abortSignal: () => query,
      then: (resolve: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: dataByTable[table], error: null }).then(resolve),
    };
    return query;
  };
  return { from };
}

describe("recipe repository explicit blocked-recipe inclusion", () => {
  it("keeps needs_review recipes out of normal planner catalogs", async () => {
    const catalog = await new SupabaseRecipeRepository(database() as never).loadCatalog();
    expect(catalog.recipes.map((recipe) => recipe.id)).toEqual([otherRecipeId]);
    expect(catalog.mealMixProfiles).toEqual([]);
  });

  it("includes only the explicitly requested blocked recipe for internal readiness evaluation", async () => {
    const catalog = await new SupabaseRecipeRepository(database() as never).loadCatalog(undefined, { includeBlockedRecipeIds: [blockedRecipeId] });
    expect(catalog.recipes.map((recipe) => recipe.id).sort()).toEqual([blockedRecipeId, otherRecipeId].sort());
    expect(catalog.mealMixProfiles).toEqual([]);
  });
});
