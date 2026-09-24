import { it } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { SupabaseRecipeRepository } from "@/services/week-preparation/recipe-repository";
import { SupabaseCatalogRepository } from "@/services/catalog/catalog-repository";
import { mapJoinedCatalogRows } from "@/services/catalog/catalog-mapper";
import { createCachedCatalogRepository, createWeekPlanningSnapshotCache } from "@/services/week-preparation/planning-cache";
import { evaluateRecipeReadiness } from "@/services/week-preparation/recipe-readiness";
import { SupabasePersistentRecipeReadinessRepository, resolveRecipeReadiness } from "@/services/week-preparation/persistent-readiness-cache";
import { enrichIngredientsForMealMixes, mealMixProfileForRecipe } from "@/services/week-preparation/meal-mix-profiles";
import { searchFreeChoice } from "@/services/week-preparation/free-choice";
import { createWeekPreparation } from "@/services/week-preparation/week-preparation";

it("read-only complete mix audit",async()=>{
 const config = process.env.PR28_PUBLIC_CONFIG ? JSON.parse(readFileSync(process.env.PR28_PUBLIC_CONFIG,"utf8")) : { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY };
 if (!config.url || !config.key) throw Error("Set public Supabase configuration for this read-only audit");
 const client=createClient(config.url,config.key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async(url,init)=>{
   if ((init?.method??"GET")!=="GET") throw Error("Read-only audit refuses writes");
   return fetch(url,init);
 }}});
 const catalog=await new SupabaseRecipeRepository(client).loadCatalog();
 catalog.ingredients=enrichIngredientsForMealMixes(catalog.ingredients,catalog.mealMixProfiles);
 const profileResult = await client.from("meal_mix_profiles").select("product_id,product_name,brand,status,reason,source_evidence");
 if (profileResult.error) throw profileResult.error;
 const allProducts=[];
 for(let start=0;;start+=250){const {data,error}=await client.from("products").select("*,current_price:product_prices(*)").order("id").range(start,start+249);if(error||!data)throw Error(JSON.stringify(error));allProducts.push(...mapJoinedCatalogRows(data).products);if(data.length<250)break;}
 const products=createCachedCatalogRepository(new SupabaseCatalogRepository(client));
 const recipes=catalog.recipes.filter(recipe=>mealMixProfileForRecipe(recipe.sourceKey,catalog.mealMixProfiles));
 const persistent=new SupabasePersistentRecipeReadinessRepository(client);
 const cache=createWeekPlanningSnapshotCache({persistentRepository:{load:(...args)=>persistent.load(...args)}});
 const matrix=[];
 for(const people of [1,2,4,6,10,12]){
   const cold=await evaluateRecipeReadiness(recipes,people,catalog,products);
   const warm=await resolveRecipeReadiness(recipes,people,catalog,products,{load:(...args)=>persistent.load(...args)});
   matrix.push({people,cold:cold.recipes,warm:warm.gate.recipes,hits:warm.persistentHitCount});
 }
 const base=createWeekPreparation({schemaVersion:1,people:4,days:1,budgetCents:100000},{knownSubtotalCents:0,unpricedItemCount:0},new Date(),"audit",100000);
 const week={...base,status:"generated" as const,days:[{dayIndex:0,category:"freeChoice" as const,freeChoice:true,recipe:null,recipeId:null,status:"freeChoice" as const}]};
 const selection=[];
 for(const brand of ["Honig","Knorr"]){const found=await searchFreeChoice(week,0,brand,{loadCatalog:async()=>catalog},products,undefined,cache,"mix");selection.push(...found.map(item=>({brand,recipe:item.recipe,selectable:!!item.alternative,ingredients:item.alternative?.preparation.ingredients})));}
 writeFileSync(process.env.PR28_AUDIT_SNAPSHOT ?? "test-results/pr28-snapshot.json",JSON.stringify({at:new Date().toISOString(),catalog,profiles:profileResult.data,products:allProducts,matrix,selection},null,2));
});
