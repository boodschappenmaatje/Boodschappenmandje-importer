import { mealMixProfileForRecipe } from "@/services/week-preparation/meal-mix-profiles";
import { it, expect } from "vitest";
import { readFileSync, writeFileSync } from "node:fs";
import { productMatchesSearchTokens, type CatalogRepository } from "@/services/catalog/catalog-repository";
import { createWeekPlanningSnapshotCache } from "@/services/week-preparation/planning-cache";
import { evaluateRecipeReadiness } from "@/services/week-preparation/recipe-readiness";
import { searchFreeChoice, previewFreeChoice } from "@/services/week-preparation/free-choice";
import { createWeekPreparation, prepareWeek } from "@/services/week-preparation/week-preparation";
import { generatePreparedWeek, calculateDishCostSummary } from "@/services/week-preparation/week-generation";
import type { RecipeCatalog } from "@/services/week-preparation/recipe-repository";
import type { Product } from "@/types/catalog";
import type { WeekPreparation } from "@/types/week-preparation";

it("current read-only catalog: full assortment and 6 persons × 4 days × all recipe types", async () => {
 const live = JSON.parse(readFileSync(process.env.PR28_AUDIT_SNAPSHOT ?? 'test-results/pr28-snapshot.json','utf8'));
 const catalog=live.catalog as RecipeCatalog; const all=live.products as Product[];
 const termCache = new Map<string, Product[]>();
 const candidates = (term:string) => { let found=termCache.get(term); if(!found){found=all.filter(p=>productMatchesSearchTokens(p,term));termCache.set(term,found);} return found; };
 const products: CatalogRepository={getByIds:async ids=>({products:all.filter(p=>ids.includes(p.id)),priceStatus:'complete'}),searchCandidates:async term=>({products:candidates(term),priceStatus:'complete'}), search:async term=>({products:candidates(term),priceStatus:'complete'}),query:async()=>{throw Error('unused')},getPage:async()=>{throw Error('unused')},getFilterOptions:async()=>({categories:[],brands:[]})};
 const recipes={loadCatalog:async()=>catalog};const cache=createWeekPlanningSnapshotCache();
 const ready=await evaluateRecipeReadiness(catalog.recipes,4,catalog,products);
 const normal=catalog.recipes.find(r=>!/(honig|knorr)/i.test(r.name)&&ready.recipes.find(x=>x.recipeId===r.id)?.ready)!;
 const linked=all.find(p=>p.name==='Cherry tomaten')!;
 const matrix=[];
 const assortment=[];
 for(const people of [1,2,4,6,10,12]) {
  const cold=await evaluateRecipeReadiness(catalog.recipes,people,catalog,products);
  for(const days of [1,3,5,7]) {
   const base=createWeekPreparation({schemaVersion:1,people,days,budgetCents:100000},{knownSubtotalCents:0,unpricedItemCount:0},new Date(),'matrix',100000);
   const week:WeekPreparation={...base,status:'generated',days:Array.from({length:days},(_,dayIndex)=>({dayIndex,category:'freeChoice',freeChoice:true,recipe:null,recipeId:null,status:'freeChoice'}))};
   const counts:Record<string,number>={};
   for(const brand of ['Honig','Knorr']) {
    const found=await searchFreeChoice(week,days-1,brand,recipes,products,undefined,cache,'mix');
    counts[brand]=found.filter(x=>x.alternative).length;
    expect(found.every(x=>!!x.alternative===!!cold.recipes.find(r=>r.recipeId===x.recipe.id)?.ready)).toBe(true);
    if(people===4&&days===1) assortment.push(...found.map(x=>({brand,recipe:x.recipe,selectable:!!x.alternative,readiness:cold.recipes.find(r=>r.recipeId===x.recipe.id)??null})));
    const selected=found.find(x=>x.alternative)!;
    expect(selected.alternative!.alternativeDishCostCents).toBeGreaterThan(0);
    expect(selected.alternative!.preparation.numberOfPeople).toBe(people);
    const profile = mealMixProfileForRecipe(selected.recipe.sourceKey,catalog.mealMixProfiles)!;
    const ingredients=selected.alternative!.preparation.ingredients;
    const mix=ingredients.find(i=>i.kind==='mealMix')!;
    expect(mix.purchaseQuantity).toBe(Math.ceil(people/profile.servingsPerPackage));
    for(const supplement of profile.supplements) {
      const ingredient=ingredients.find(i=>i.sourceKey===supplement.sourceKey)!;
      const factor=supplement.unit==='kg'||supplement.unit==='l'?1000:1;
      expect(ingredient.requiredQuantity).toBeCloseTo(supplement.quantity*factor*people/(profile.supplementServings??profile.servingsPerPackage),5);
      expect(ingredient.purchaseQuantity).toBe(Math.ceil(ingredient.requiredQuantity/ingredient.packageCapacity!));
      expect(ingredient.price!.amountCents).toBe(Math.round(all.find(p=>p.id===ingredient.product!.productId)!.currentPrice!.price*100));
    }
   }
   const dish=await previewFreeChoice(week,days-1,{recipeId:normal.id},recipes,products,undefined,new Date(),cache);
   expect(dish).not.toBeNull();
   const custom=await previewFreeChoice(week,days-1,{customDish:{name:'Eigen tomaat',servings:4,ingredients:[{id:'tomato',name:linked.name,productId:linked.id,quantity:400,unit:'g'}]}},recipes,products);
   expect(custom?.preparation.ingredients[0].requiredQuantity).toBe(people*100);
   expect(custom?.preparation.ingredients[0].purchaseQuantity).toBe(Math.ceil(people*100/250));
   expect(custom?.alternativeDishCostCents).toBe(Math.ceil(people*100/250)*Math.round(linked.currentPrice!.price*100));
   console.log('matrix',people,days,counts);
   matrix.push({people,days,selectable:counts,normalCost:dish!.alternativeDishCostCents,customCost:custom!.alternativeDishCostCents});
  }
 }
 const base=createWeekPreparation({schemaVersion:1,people:4,days:5,budgetCents:10000},{knownSubtotalCents:0,unpricedItemCount:0},new Date(),'case-4-5-100-70',7000);
 const input=prepareWeek({...base,categoryDistribution:{...base.categoryDistribution,dutch:2,pasta:1,rice:1,quick:1}},{knownSubtotalCents:0,unpricedItemCount:0});
 const result=await generatePreparedWeek(input,recipes,products,new Date());
 expect(result.status).toBe('generated');expect(result.days.filter(d=>d.recipe)).toHaveLength(5);expect(result.generation!.mealPlanKnownCostCents).toBeLessThanOrEqual(7000);
 const failed=await generatePreparedWeek({...input,mealBudgetCents:1},recipes,products,new Date());
 expect(failed.generation?.mealBudgetStatus).toBe('noValidMealPlanWithinBudget');
 writeFileSync(process.env.PR28_AUDIT_OUTPUT ?? 'test-results/pr28-matrix.json',JSON.stringify({snapshotAt:live.at,at:new Date().toISOString(),matrix,assortment,planner:{cost:result.generation!.mealPlanKnownCostCents,status:result.status,days:result.days.map(d=>({name:d.recipe?.name,cost:calculateDishCostSummary(d.dayIndex,result.ingredients).knownCostCents}))},insufficientBudget:failed.generation?.mealBudgetStatus},null,2));
},180000);
