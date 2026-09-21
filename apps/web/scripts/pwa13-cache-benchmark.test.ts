import { it, vi } from "vitest";
import { loadEnvFile } from "node:process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SupabaseRecipeRepository } from "@/services/week-preparation/recipe-repository";
import { SupabaseCatalogRepository } from "@/services/catalog/catalog-repository";
import { createCachedCatalogRepository, createCachedRecipeRepository } from "@/services/week-preparation/planning-cache";
import { createWeekPreparation, prepareWeek } from "@/services/week-preparation/week-preparation";
import { searchFreeChoice, previewFreeChoice } from "@/services/week-preparation/free-choice";

it("measures real catalog search and selection without writing database data", async () => {
  loadEnvFile(".env.local");
  const originalFetch = globalThis.fetch;
  let requests = 0;
  let searches = 0;
  vi.stubGlobal("window", {});
  vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
    if (String(input).startsWith("/api/")) return new Response(null, {status:503});
    requests++;
    if (String(input).includes("/rpc/search_catalog")) searches++;
    return originalFetch(input, init);
  });
  try {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {auth:{persistSession:false}});
    const recipes = createCachedRecipeRepository(new SupabaseRecipeRepository(client));
    const products = createCachedCatalogRepository(new SupabaseCatalogRepository(client));
    const context = {knownSubtotalCents:0,unpricedItemCount:0};
    const base = createWeekPreparation({schemaVersion:1,people:4,days:7,budgetCents:10000},context,new Date(),"cache-benchmark");
    const week = {...prepareWeek({...base,mealBudgetCents:7000,categoryDistribution:{...base.categoryDistribution,freeChoice:7}},context),status:"generated" as const};
    const results: unknown[] = [];
    mkdirSync("test-results/pwa13-cache",{recursive:true});
    for (const query of ["spaghetti","Honig","Knorr lasagne","burrito"]) {
      requests=0; searches=0;
      const start=performance.now();
      const found=await searchFreeChoice(week,0,query,recipes,products);
      results.push({flow:`search:${query}`,ms:Math.round(performance.now()-start),requests,searches,results:found.length,available:found.filter(x=>x.alternative).length});
      const complete=found.find(x=>x.alternative);
      if (complete && query==="burrito") {
        requests=0; searches=0; const start=performance.now();
        const selected=await previewFreeChoice(week,0,{recipeId:complete.recipe.id},recipes,products);
        results.push({flow:"select:burrito",ms:Math.round(performance.now()-start),requests,searches,available:Boolean(selected)});
      }
      writeFileSync(`test-results/pwa13-cache/${process.env.PWA13_BENCHMARK_LABEL ?? "baseline"}.json`,JSON.stringify(results,null,2));
    }
  } finally { vi.unstubAllGlobals(); }
},600000);
