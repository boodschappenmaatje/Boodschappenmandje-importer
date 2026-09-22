import { it, expect } from "vitest";
import { loadEnvFile } from "node:process";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SupabaseRecipeRepository } from "@/services/week-preparation/recipe-repository";
import { SupabaseCatalogRepository } from "@/services/catalog/catalog-repository";
import { createCachedCatalogRepository, createWeekPlanningSnapshotCache } from "@/services/week-preparation/planning-cache";
import { searchFreeChoice } from "@/services/week-preparation/free-choice";
import { createWeekPreparation } from "@/services/week-preparation/week-preparation";
import { recipeImageFor } from "@/services/week-preparation/recipe-images";
import { encodeStoredWeekPreparation, decodeStoredWeekPreparation } from "@/services/week-preparation/indexeddb-storage";
import { revalidatePreparedWeek } from "@/services/week-preparation/week-generation";
import { evaluateRecipeReadiness } from "@/services/week-preparation/recipe-readiness";
import { rowsForGate } from "@/server/planner-cache-service";
import { enrichIngredientsForMealMixes, type MealMixProfile } from "@/services/week-preparation/meal-mix-profiles";

it("audits only the existing Honig/Knorr SKU inventory and prepares idempotent caches 1–10", async () => {
  loadEnvFile(".env.local");
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, { auth: { persistSession: false } });
  const catalog = await new SupabaseRecipeRepository(client).loadCatalog();
  if (process.env.MIX_COMPLETION_OVERLAY === "1") {
    const plan = JSON.parse(readFileSync("test-results/mix-completion/profile-plan.json", "utf8"));
    for (const row of plan) {
      const profile: MealMixProfile = row.profile;
      catalog.mealMixProfiles = [...(catalog.mealMixProfiles ?? []).filter(p => p.productId !== profile.productId), profile];
      catalog.recipes.push({ id: `preview-${profile.productId}`, sourceKey: profile.recipeSourceKey, name: profile.dishName,
        normalizedName: profile.dishName.toLowerCase(), symbol: "fork.knife", preparationMinutes: row.recipe.preparation_minutes,
        vegetarian: row.recipe.vegetarian, containsPork: row.recipe.contains_pork, kidFriendly: false, healthy: false, budgetTier: "standard" });
    }
    catalog.ingredients = enrichIngredientsForMealMixes(catalog.ingredients, catalog.mealMixProfiles);
  }
  const keys = new Set(catalog.mealMixProfiles?.map(p => p.recipeSourceKey));
  const recipes = catalog.recipes.filter(r => keys.has(r.sourceKey));
  const products = createCachedCatalogRepository(new SupabaseCatalogRepository(client));
  const gate = await evaluateRecipeReadiness(recipes, 4, catalog, products);
  writeFileSync("test-results/mix-completion/readiness.json", JSON.stringify(gate.recipes, null, 2));
  writeFileSync("test-results/mix-completion/matches.json", JSON.stringify([...gate.matchedProductsByRequirement], null, 2));
  writeFileSync("test-results/mix-completion/candidates.json", JSON.stringify([...gate.candidatesByRequirement ?? []], null, 2));
  for (let people = 1; people <= 10; people++) {
    const scaled = await evaluateRecipeReadiness(recipes, people, catalog, products, gate);
    expect(scaled.recipes).toHaveLength(recipes.length);
    writeFileSync(`test-results/mix-completion/cache-${people}.json`, JSON.stringify(rowsForGate(scaled, people, new Date())));
  }
  const now = new Date();
  const base = createWeekPreparation({schemaVersion:1,people:4,days:1,budgetCents:100000}, {knownSubtotalCents:0,unpricedItemCount:0},now,'mix-audit');
  const week = {...base,numberOfPeople:4,numberOfDays:1,mealBudgetCents:100000,status:'generated' as const,categoryDistribution:{...base.categoryDistribution,freeChoice:1},days:[{dayIndex:0,category:'freeChoice' as const,freeChoice:true,recipe:null,recipeId:null,status:'freeChoice' as const}]};
  const scoped = {...catalog,recipes};
  const repository = {loadCatalog:async()=>scoped};
  const cache=createWeekPlanningSnapshotCache({persistentRepository:{load:async()=>({available:false,readiness:[],matches:[]})}});
  const selection=[];
  const diagnostics=[];
  for(const brand of ['Honig','Knorr']) {
    const found=await searchFreeChoice(week,0,brand,repository,products,undefined,cache);
    expect(found.filter(item=>recipes.some(r=>r.id===item.recipe.id)).length).toBe(recipes.filter(r=>r.name.includes(brand)).length);
    for(const item of found) {
      const chosen=item.alternative?.preparation;
      const restored=chosen ? decodeStoredWeekPreparation(encodeStoredWeekPreparation(chosen)) : null;
      const context={recipeSourceKey:item.recipe.sourceKey,recipeName:item.recipe.name,categories:[],ingredients:restored?.ingredients.map(i=>({sourceKey:i.sourceKey,name:i.name,optional:i.optional}))??[]};
      if(chosen) expect(recipeImageFor(context),item.recipe.name).not.toBeNull();
      selection.push({sourceKey:item.recipe.sourceKey,name:item.recipe.name,brand,selectable:!!chosen,imageAfterReload:!!chosen&&!!recipeImageFor(context)});
      if(!chosen && gate.recipes.some(r=>r.recipeId===item.recipe.id&&r.ready)) {
        const probe={...week,days:[{...week.days[0],freeChoice:false,recipeId:item.recipe.id,recipe:item.recipe,status:'recipeSelected' as const}]};
        const evaluated=(await revalidatePreparedWeek(probe,repository,products,now,undefined,cache)).preparation;
        diagnostics.push({sourceKey:item.recipe.sourceKey,ingredients:evaluated.ingredients});
      }
    }
  }
  writeFileSync('test-results/mix-completion/selection.json',JSON.stringify(selection,null,2));
  writeFileSync('test-results/mix-completion/selection-diagnostics.json',JSON.stringify(diagnostics,null,2));
  console.log(JSON.stringify({ profiles: recipes.length, ready: gate.recipes.filter(r => r.ready).length,
    problems: gate.recipes.filter(r => !r.ready).map(r => ({ name: r.recipeName, issues: r.ingredients.filter(i => i.reason).map(i => `${i.name}: ${i.reason}`) })) }));
});
