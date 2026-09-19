import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  isPlannerCacheAdminRequest,
  isSameOriginPlannerRequest,
} from "@/server/planner-cache-auth";
import { parsePlannerCacheRefreshInput } from "@/server/planner-cache-service";

const projectRoot = resolve(process.cwd(), "../..");
const migration = readFileSync(
  resolve(projectRoot, "supabase/migrations/20260919_persistent_planner_readiness_cache.sql"),
  "utf8",
);
const dataHealth = readFileSync(
  resolve(process.cwd(), "src/components/week-preparation/DataHealthView.tsx"),
  "utf8",
);
const serverService = readFileSync(
  resolve(process.cwd(), "src/server/planner-cache-service.ts"),
  "utf8",
);

describe("structureel planner-cachecontract", () => {
  it("maakt uitsluitend afgeleide cachetabellen met expliciete read-only RLS", () => {
    expect(migration).toContain("create table if not exists public.ingredient_product_matches");
    expect(migration).toContain("create table if not exists public.recipe_readiness_cache");
    expect(migration).toContain("alter table public.ingredient_product_matches enable row level security");
    expect(migration).toContain("alter table public.recipe_readiness_cache enable row level security");
    expect(migration).toContain("revoke all on public.ingredient_product_matches from anon, authenticated");
    expect(migration).toContain("revoke all on public.recipe_readiness_cache from anon, authenticated");
    expect(migration).toContain("grant select on public.ingredient_product_matches to anon, authenticated");
    expect(migration).toContain("grant select on public.recipe_readiness_cache to anon, authenticated");
    expect(migration).toContain("grant select, insert, update, delete on public.ingredient_product_matches to service_role");
    expect(migration).toContain("grant select, insert, update, delete on public.recipe_readiness_cache to service_role");
    expect(migration).toContain("grant execute on function public.invalidate_recipe_readiness_for_match_key(text, text)");
    expect(migration).toContain("ingredient_id uuid references public.ingredients(id) on delete cascade");
    expect(migration).toContain("ingredient_source_key text not null");
    expect(migration).not.toContain("ingredient_id uuid not null references public.ingredients");
    expect(serverService).toContain("ingredient_id: persistedIngredientId(descriptor.ingredientId)");
    expect(serverService).toContain("ingredient_source_key: ingredient.sourceKey");
  });

  it("invalideert wijzigingen gericht via match-key, recept, ingrediënt, product en prijs", () => {
    expect(migration).toContain("dependency_match_keys @> array[affected_match_key]::text[]");
    expect(migration).toContain("recipe_ingredients_invalidate_readiness");
    expect(migration).toContain("ingredient_aliases_invalidate_matches");
    expect(migration).toContain("products_invalidate_matches");
    expect(migration).toContain("product_prices_invalidate_readiness");
    expect(migration).not.toMatch(/truncate\s+public\.(recipes|recipe_ingredients|ingredients)/i);
  });

  it("laat Data Health dezelfde centrale READY-resolver gebruiken als de consumentenplanner", () => {
    expect(dataHealth).toContain("resolveRecipeReadiness(");
    expect(dataHealth).toContain("createPersistentRecipeReadinessRepository()");
    expect(dataHealth).not.toContain("evaluateRecipeReadiness(");
  });

  it("houdt backfill begrensd, cursor-gebaseerd en Match Repair receptgericht", () => {
    expect(serverService).toContain("afterSourceKey");
    expect(serverService).toContain("Math.min(20");
    expect(serverService).toContain("onConflict: \"recipe_id,people_count\"");
    expect(serverService).toContain("keysByRecipe.get(recipe.id)?.includes(input.matchKey)");
    expect(serverService).toContain(".in(\"recipe_id\", affectedRecipes.map");
    expect(serverService).not.toContain("delete().neq");
  });

  it("begrensd refreshverzoeken tot geldige recept-id's en 1–12 personen", () => {
    expect(parsePlannerCacheRefreshInput({
      recipeIds: ["a", "a", "b"],
      numberOfPeople: 4,
    })).toEqual({ recipeIds: ["a", "b"], numberOfPeople: 4 });
    expect(parsePlannerCacheRefreshInput({ recipeIds: ["a"], numberOfPeople: 13 })).toBeNull();
    expect(parsePlannerCacheRefreshInput({ recipeIds: [], numberOfPeople: 4 })).toBeNull();
  });

  it("scheidt publieke same-origin refresh van admin-only backfill en repair", () => {
    const sameOrigin = new Request("https://app.test/api/planner-readiness/refresh", {
      method: "POST",
      headers: { origin: "https://app.test", host: "app.test" },
    });
    const foreign = new Request("https://app.test/api/planner-readiness/refresh", {
      method: "POST",
      headers: { origin: "https://evil.test", host: "app.test" },
    });
    expect(isSameOriginPlannerRequest(sameOrigin)).toBe(true);
    expect(isSameOriginPlannerRequest(foreign)).toBe(false);

    const previous = process.env.PLANNER_CACHE_ADMIN_TOKEN;
    process.env.PLANNER_CACHE_ADMIN_TOKEN = "test-secret";
    try {
      expect(isPlannerCacheAdminRequest(new Request("https://app.test", {
        headers: { authorization: "Bearer test-secret" },
      }))).toBe(true);
      expect(isPlannerCacheAdminRequest(new Request("https://app.test"))).toBe(false);
    } finally {
      if (previous === undefined) delete process.env.PLANNER_CACHE_ADMIN_TOKEN;
      else process.env.PLANNER_CACHE_ADMIN_TOKEN = previous;
    }
  });
});
