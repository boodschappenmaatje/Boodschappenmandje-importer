import { it } from "vitest";
import { loadEnvFile } from "node:process";
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SupabaseRecipeRepository } from "@/services/week-preparation/recipe-repository";
import { SupabaseCatalogRepository } from "@/services/catalog/catalog-repository";
import { createCachedCatalogRepository, createWeekPlanningSnapshotCache } from "@/services/week-preparation/planning-cache";
import { SupabasePersistentRecipeReadinessRepository } from "@/services/week-preparation/persistent-readiness-cache";
import { createWeekPreparation, prepareWeek } from "@/services/week-preparation/week-preparation";
import { revalidatePreparedWeek, calculateDishCostSummary } from "@/services/week-preparation/week-generation";
it("audits current price usability separately from cached ingredient readiness",async()=>{
 loadEnvFile('.env.local');
 const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,{auth:{persistSession:false}});
 const catalog=await new SupabaseRecipeRepository(client).loadCatalog();
 const products=createCachedCatalogRepository(new SupabaseCatalogRepository(client));
 const cache=createWeekPlanningSnapshotCache({persistentRepository:new SupabasePersistentRecipeReadinessRepository(client)});
 const context={knownSubtotalCents:0,unpricedItemCount:0};
 const base=createWeekPreparation({schemaVersion:1,people:4,days:7,budgetCents:10000},context,new Date(),'audit');
 const prepared=prepareWeek({...base,mealBudgetCents:7000,categoryDistribution:{...base.categoryDistribution,freeChoice:7}},context);
 const output=[];
 for(const profile of catalog.mealMixProfiles??[]){
  const recipe=catalog.recipes.find(r=>r.sourceKey===profile.recipeSourceKey)!;
  const week={...prepared,days:prepared.days.map((day,i)=>i===0?{...day,recipe,recipeId:recipe.id,freeChoice:false,status:'recipeSelected' as const}:day)};
  const result=await revalidatePreparedWeek(week,{loadCatalog:async()=>catalog},products,new Date(),undefined,cache);
  const cost=calculateDishCostSummary(0,result.preparation.ingredients);
  const issues=result.preparation.ingredients.filter(i=>!i.optional&&(!i.product||!i.price||i.price.freshness!=='fresh'||i.purchaseQuantity===null)).map(i=>({name:i.name,product:i.product?.name,price:i.price?.freshness,updatedAt:i.price?.updatedAt}));
  output.push({name:profile.productName,complete:cost.complete&&issues.length===0,cost:cost.knownCostCents,issues});
 }
 writeFileSync('test-results/pwa13-cache/availability.json',JSON.stringify(output,null,2));
 console.log(JSON.stringify({complete:output.filter(r=>r.complete).length,total:output.length,completeNames:output.filter(r=>r.complete).map(r=>r.name)}));
},120000);
