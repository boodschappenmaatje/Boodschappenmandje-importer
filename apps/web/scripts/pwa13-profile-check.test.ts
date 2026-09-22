import { it, expect } from "vitest";
import { writeFileSync, mkdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SupabaseRecipeRepository } from "@/services/week-preparation/recipe-repository";
import { SupabaseCatalogRepository } from "@/services/catalog/catalog-repository";
import { createCachedCatalogRepository } from "@/services/week-preparation/planning-cache";
import { evaluateRecipeReadiness } from "@/services/week-preparation/recipe-readiness";
import { rowsForGate } from "@/server/planner-cache-service";
import { resolveRecipeReadiness, SupabasePersistentRecipeReadinessRepository } from "@/services/week-preparation/persistent-readiness-cache";

it("audits persisted profiles using public reads and produces reviewable cache rows", async () => {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const catalog = await new SupabaseRecipeRepository(client).loadCatalog();
  const products = createCachedCatalogRepository(new SupabaseCatalogRepository(client));
  const profiles = new Set(catalog.mealMixProfiles?.map((profile) => profile.recipeSourceKey));
  const recipes = catalog.recipes.filter((recipe) => profiles.has(recipe.sourceKey));
  expect(recipes.length).toBeGreaterThan(0);
  if (process.env.PWA13_VERIFY_PERSISTED === "1") {
    const cached = await resolveRecipeReadiness(recipes, 4, catalog, { ...products, search: async () => { throw Error("Unexpected live search"); }, searchCandidates: async () => { throw Error("Unexpected live search"); } }, new SupabasePersistentRecipeReadinessRepository(client));
    expect(cached.persistentHitCount).toBe(recipes.length);
    expect(cached.fallbackCount).toBe(0);
    return;
  }
  const gate = await evaluateRecipeReadiness(recipes, 4, catalog, products);
  mkdirSync("test-results/pwa13", { recursive: true });
  writeFileSync("test-results/pwa13/profile-readiness.json", JSON.stringify(gate.recipes, null, 2));
  const rows = [];
  if (process.env.PWA13_CACHE_EVIDENCE === "1") {
    for (let people = 1; people <= 10; people++) {
      const scaled = await evaluateRecipeReadiness(recipes, people, catalog, products, gate);
      rows.push(rowsForGate(scaled, people, new Date()));
    }
    writeFileSync("test-results/pwa13/profile-cache-rows.json", JSON.stringify(rows, null, 2));
  }
});
