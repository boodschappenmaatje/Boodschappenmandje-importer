import { describe, expect, it } from "vitest";
import { applyProductToRequirement } from "./product-matching";
import { ingredientPackageContents, packageAmount, packageCountLabel, stepPackageCount } from "./ingredient-packages";
import { applyIngredientQuantityOverrides } from "./ingredient-quantity";
import { createWeekPreparation } from "./week-preparation";
import type { Product } from "@/types/catalog";
import type { WeekIngredientRequirement } from "@/types/week-preparation";

const requirement: WeekIngredientRequirement = {ingredientId:"i",sourceKey:"i",name:"Ingrediënt",unit:"g",optional:false,servingsBase:1,kind:"ingredient",brandConstraint:null,requiredQuantity:400,purchaseQuantity:null,packageCapacity:null,usedIn:[{recipeId:"r",recipeName:"Recept",dayIndex:0,requiredQuantity:400}],product:null,price:null,productMatchMissing:false,packageCalculationMissing:false};
const product: Product = {id:"p",sku:"p",name:"Product",brand:null,supermarket:"Hoogvliet",category:null,productType:null,packageText:"400 gram",weightGrams:400,imageUrl:null,sourceUrl:"https://example.test/p",isAvailable:true,updatedAt:new Date().toISOString(),currentPrice:null};
describe("reliable package contents", () => {
  it.each([1,2,3])("derives %s × 400g", count => expect(packageAmount(count,400)).toBe(count*400));
  it.each([[1,1,2],[2,-1,1],[2,1,3],[1,-1,1],[0,-1,1],[-1,-1,1]] as const)("steps %s by %s to %s",(count,direction,expected)=>expect(stepPackageCount(count,direction)).toBe(expected));
  it("uses correct Dutch count labels",()=>{expect(packageCountLabel(1)).toBe("1 verpakking");expect(packageCountLabel(2)).toBe("2 verpakkingen");});
  it.each([ ["g","400 gram",400,800], ["ml","500 milliliter",500,1000], ["piece","6 stuks",6,12] ] as const)("recalculates %s contents from real catalog packaging",(unit,packageText,capacity,total)=>{
    const matched=applyProductToRequirement({...requirement,unit},{...product,packageText,weightGrams:unit==="g"?capacity:null});
    expect(ingredientPackageContents(matched)).toEqual({unit,capacity});
    const preparation=createWeekPreparation({schemaVersion:1,people:4,days:1,budgetCents:10000},{knownSubtotalCents:0,unpricedItemCount:0});
    preparation.customizations=[{dayIndex:0,baseRecipe:{id:"r",name:"Recept",sourceKey:"r"},replacementRecipe:null,recipeBudgetDecision:{mode:"userConfirmedManualChoice"},ingredientOverrides:[],productOverrides:[],manualProductAdditions:[],updatedAt:preparation.updatedAt,quantityOverrides:[{ingredientId:"i",recipeId:"r",quantity:total,unit,people:4,packageCount:2,productId:"p"}]}];
    expect(applyIngredientQuantityOverrides(preparation,[matched])[0]).toMatchObject({unit,requiredQuantity:total,purchaseQuantity:2});
  });
  it("does not invent unknown package contents, including meal mix packets",()=>{
    const unknown=applyProductToRequirement(requirement,{...product,packageText:null,weightGrams:null});
    expect(ingredientPackageContents(unknown)).toBeNull();
    const mix=applyProductToRequirement({...requirement,kind:"mealMix",unit:"piece"},{...product,packageText:null,weightGrams:null});
    expect(ingredientPackageContents(mix)).toBeNull();
  });
});
