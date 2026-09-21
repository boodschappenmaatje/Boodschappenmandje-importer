import { it, expect } from "vitest";
import { loadEnvFile } from "node:process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SupabaseRecipeRepository } from "@/services/week-preparation/recipe-repository";
import { SupabaseCatalogRepository } from "@/services/catalog/catalog-repository";
import { createCachedCatalogRepository } from "@/services/week-preparation/planning-cache";
import { evaluateRecipeReadiness } from "@/services/week-preparation/recipe-readiness";
import { rowsForGate } from "@/server/planner-cache-service";
import { resolveRecipeReadiness, SupabasePersistentRecipeReadinessRepository } from "@/services/week-preparation/persistent-readiness-cache";

it("builds reviewable 1–10 cache rows from existing products and prices only", async () => {
  loadEnvFile(".env.local");
  const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false},global:{fetch:async(input,init)=>{
    const response=await fetch(input,init);
    if(!response.ok) { const body=await response.clone().json().catch(()=>({})); console.error("Catalog read failed",{status:response.status,code:body.code,message:body.message}); }
    return response;
  }}});
  const catalog=await new SupabaseRecipeRepository(client).loadCatalog();
  const products=createCachedCatalogRepository(new SupabaseCatalogRepository(client));
  mkdirSync("test-results/pwa13-cache",{recursive:true});
  if(process.env.PWA13_VERIFY_PERSISTED==="1") {
    for(let people=1;people<=10;people++){
      const resolved=await resolveRecipeReadiness(catalog.recipes,people,catalog,{...products,
        search:async()=>{throw Error("Unexpected live search");},searchCandidates:async()=>{throw Error("Unexpected live search");}},new SupabasePersistentRecipeReadinessRepository(client));
      expect(resolved.persistentHitCount).toBe(catalog.recipes.length);
      expect(resolved.fallbackCount).toBe(0);
    }
    return;
  }
  const started=performance.now();
  const gate=await evaluateRecipeReadiness(catalog.recipes,4,catalog,products);
  writeFileSync("test-results/pwa13-cache/readiness.json",JSON.stringify(gate.recipes,null,2));
  for(let people=1;people<=10;people++) {
    const scaled=await evaluateRecipeReadiness(catalog.recipes,people,catalog,products,gate);
    writeFileSync(`test-results/pwa13-cache/rows-${people}.json`,JSON.stringify(rowsForGate(scaled,people,new Date())));
  }
  writeFileSync("test-results/pwa13-cache/backfill-summary.json",JSON.stringify({recipes:catalog.recipes.length,profiles:catalog.mealMixProfiles?.length,ready:gate.recipes.filter(r=>r.ready).length,ms:Math.round(performance.now()-started)},null,2));
},600000);
