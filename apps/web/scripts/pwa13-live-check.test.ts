import { expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SupabaseCatalogRepository } from "@/services/catalog/catalog-repository";
import { SupabaseRecipeRepository } from "@/services/week-preparation/recipe-repository";
import { createWeekPreparation } from "@/services/week-preparation/week-preparation";
import { searchFreeChoice, previewFreeChoice } from "@/services/week-preparation/free-choice";
import type { WeekPreparation } from "@/types/week-preparation";

// Deliberately separate from the deterministic regression suite. Public read access only.
it("controleert Vrije keuze tegen de echte catalogus zonder databasewrites", async () => {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
  const recipes = new SupabaseRecipeRepository(client);
  const products = new SupabaseCatalogRepository(client);
  const base = createWeekPreparation({ schemaVersion: 1, people: 6, days: 1, budgetCents: 10000 }, { knownSubtotalCents: 0, unpricedItemCount: 0 });
  const week: WeekPreparation = { ...base, mealBudgetCents: 8000, categoryDistribution: { ...base.categoryDistribution, freeChoice: 1 }, status: "generated", days: [{ dayIndex: 0, category: "freeChoice", freeChoice: true, recipeId: null, recipe: null, status: "freeChoice" }] };
  const evidence: unknown[] = [];
  for (const query of ["spaghetti", "Honig spaghetti", "Knorr lasagne"]) {
    const found = await searchFreeChoice(week, 0, query, recipes, products);
    expect(found.length).toBeGreaterThan(0);
    evidence.push({ query, results: found.map((item) => ({ name: item.recipe.name, available: Boolean(item.alternative), cents: item.alternative?.alternativeDishCostCents ?? null, products: item.alternative?.preparation.ingredients.map((ingredient) => ({ name: ingredient.product?.name, brand: ingredient.product?.brand, packages: ingredient.purchaseQuantity })) })) });
    console.log(JSON.stringify({ query, results: found.map((item) => ({ name: item.recipe.name, available: Boolean(item.alternative), cents: item.alternative?.alternativeDishCostCents ?? null, products: item.alternative?.preparation.ingredients.map((ingredient) => ({ name: ingredient.product?.name, brand: ingredient.product?.brand, packages: ingredient.purchaseQuantity })) })) }));
    for (const result of found) {
      for (const ingredient of result.alternative?.preparation.ingredients ?? []) {
        expect(ingredient.price?.freshness).toBe("fresh");
        if (ingredient.brandConstraint) expect(`${ingredient.product?.brand} ${ingredient.product?.name}`.toLowerCase()).toContain(ingredient.brandConstraint.toLowerCase());
      }
    }
  }
  const custom = await previewFreeChoice(week, 0, { customDish: { name: "Eigen pastagerecht", servings: 6, ingredients: [{ id: "pasta", name: "spaghetti", quantity: 600, unit: "g", productId: null }] } }, recipes, products);
  expect(custom).not.toBeNull();
  evidence.push({ custom: custom?.recipe.name, cents: custom?.alternativeDishCostCents, products: custom?.preparation.ingredients.map((item) => item.product?.name) });
  mkdirSync("test-results/pwa13", { recursive: true });
  writeFileSync("test-results/pwa13/live.json", JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ customDish: custom?.recipe.name, cents: custom?.alternativeDishCostCents, products: custom?.preparation.ingredients.map((item) => item.product?.name) }));
});
