import { afterEach, describe, expect, it, vi } from "vitest";
import fixture from "./fixtures/planner-five-days.json";
import type { RecipeCatalog, RecipeRepository } from "./recipe-repository";
import type { Product } from "@/types/catalog";
import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import { createWeekPreparation, prepareWeek } from "./week-preparation";
import { generatePreparedWeek } from "./week-generation";
import { aggregateWeekIngredients } from "./ingredient-aggregation";
const catalog=fixture.catalog as RecipeCatalog;
const products=fixture.products as Product[];
const recipes: RecipeRepository={loadCatalog:async()=>catalog};
const repository: CatalogRepository={getByIds:async ids=>({products:products.filter(p=>ids.includes(p.id)),priceStatus:"complete"}),search:async()=>({products,priceStatus:"complete"}),query:async()=>{throw Error("unused")},getPage:async()=>{throw Error("unused")},getFilterOptions:async()=>({categories:[],brands:[]})};
afterEach(()=>vi.useRealTimers());
describe("five-day planner regression with recorded real catalog data",()=>{
  it("plans 4 people / 5 days / €100 week / €70 meals with all readiness and budget gates",async()=>{
    vi.useFakeTimers();vi.setSystemTime(new Date(fixture.at));
    const base=createWeekPreparation({schemaVersion:1,people:4,days:5,budgetCents:10000},{knownSubtotalCents:0,unpricedItemCount:0},new Date(),"five-days",7000);
    const input=prepareWeek({...base,categoryDistribution:{...base.categoryDistribution,dutch:2,pasta:1,rice:1,quick:1}},{knownSubtotalCents:0,unpricedItemCount:0});
    const next=await generatePreparedWeek(input,recipes,repository,new Date());
    expect(next.status).toBe("generated");
    expect(next.days.filter(day=>day.recipeId)).toHaveLength(5);
    expect(next.generation).toMatchObject({isMealBudgetComplete:true,mealBudgetStatus:"withinMealBudget",missingProductMatchCount:0,missingPackageCalculationCount:0,missingPriceCount:0});
    expect(next.generation!.mealPlanKnownCostCents).toBeGreaterThan(0);
    expect(next.generation!.mealPlanKnownCostCents).toBeLessThanOrEqual(7000);
  });
  it("keeps different recipe units separate instead of aborting a valid week",()=>{
    const first=catalog.recipes[0]; const second=catalog.recipes[1];const ingredient=catalog.ingredients[0];
    const mixed:RecipeCatalog={recipes:[first,second],ingredients:[ingredient],relations:[{id:"a",recipeId:first.id,ingredientId:ingredient.id,amountPerPerson:100,unit:"g",position:0},{id:"b",recipeId:second.id,ingredientId:ingredient.id,amountPerPerson:1,unit:"piece",position:0}]};
    const requirements=aggregateWeekIngredients([first,second].map((recipe,dayIndex)=>({dayIndex,category:"dutch",freeChoice:false,recipeId:recipe.id,recipe,status:"recipeSelected"})),4,mixed);
    expect(requirements.map(row=>[row.unit,row.requiredQuantity])).toEqual([["g",400],["piece",4]]);
    expect(requirements.map(row=>row.usedIn[0].dayIndex)).toEqual([0,1]);
  });
});
