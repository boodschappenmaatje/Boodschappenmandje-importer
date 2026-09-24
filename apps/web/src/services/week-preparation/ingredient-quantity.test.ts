import { describe, expect, it } from "vitest";
import { previewFreeChoice } from "./free-choice";
import { MEAL_MIX_PROFILES, enrichIngredientsForMealMixes } from "./meal-mix-profiles";
import { canAdjustIngredient, customDishWithIngredientQuantity, quantityStep, steppedIngredientQuantity, withIngredientQuantity } from "./ingredient-quantity";
import { previewIngredientQuantity } from "./ingredient-quantity-preview";
import { commitExplicitRecipeAlternative, previewManualProductChoice } from "./meal-customization";
import { calculateDishCostSummary, generatePreparedWeek, revalidatePreparedWeek } from "./week-generation";
import { createWeekPreparation, updateWeekSettings } from "./week-preparation";
import { decodeStoredWeekPreparation, encodeStoredWeekPreparation } from "./indexeddb-storage";
import { customIngredientQuantity } from "./custom-dish";
import { addCatalogProduct, completeShoppingListFromWeek, createEmptyActiveShoppingList, increaseQuantity } from "@/services/shopping-list/shopping-list";
import type { Product, Recipe } from "@/types/catalog";
import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import type { RecipeCatalog, RecipeRepository } from "./recipe-repository";
import type { CustomDish, WeekIngredientUnit, WeekPreparation } from "@/types/week-preparation";

const NOW = new Date();
const recipe: Recipe = { id: "recipe-pasta", sourceKey: "pasta", name: "Pasta", normalizedName: "pasta", symbol: "fork.knife", preparationMinutes: 20, vegetarian: true, containsPork: false, kidFriendly: true, healthy: false, budgetTier: "economical" };
const product: Product = { id: "pasta", sku: "100", name: "Spaghetti", supermarket: "Hoogvliet", brand: null, category: "Pasta", productType: "Pasta", packageText: "400 g", weightGrams: 400, imageUrl: null, sourceUrl: "https://example.test/pasta", isAvailable: true, updatedAt: NOW.toISOString(), currentPrice: { productId: "pasta", price: 2, oldPrice: null, isOffer: false, offerText: null, validFrom: null, validUntil: null, fetchedAt: NOW.toISOString(), updatedAt: NOW.toISOString() } };
const catalog: RecipeCatalog = { recipes: [recipe], ingredients: [{ id: "pasta", sourceKey: "spaghetti", name: "Spaghetti", normalizedName: "spaghetti", defaultUnit: "g", category: "Pasta", aliases: ["spaghetti"] }], relations: [{ id: "relation", recipeId: recipe.id, ingredientId: "pasta", amountPerPerson: 100, unit: "g", position: 0 }] };
const recipes: RecipeRepository = { loadCatalog: async () => catalog };
function products(selected = product): CatalogRepository {
  return { getByIds: async ids => ({ products: ids.includes(selected.id) ? [selected] : [], priceStatus: "complete" }), search: async () => ({ products: [selected], priceStatus: "complete" }), query: async () => { throw Error("unused"); }, getPage: async () => { throw Error("unused"); }, getFilterOptions: async () => ({ categories: [], brands: [] }) };
}
const list = createEmptyActiveShoppingList(NOW);

describe("free choice quantities", () => {
  it("persists a custom recipe amount through commit and reopening", async () => {
    const generated = await prepared();
    const base: WeekPreparation = { ...generated, days: generated.days.map(day => ({ ...day, category: "freeChoice", freeChoice: true, recipe: null, recipeId: null, status: "freeChoice" })) };
    const choice = await previewFreeChoice(base, 0, { customDish: { name: "Eigen pasta", servings: 4, ingredients: [{ id: "row", name: "Spaghetti", quantity: 400, unit: "g", productId: product.id }] } }, recipes, products(), list, NOW);
    const chosen = await commitExplicitRecipeAlternative(base, 0, choice!, false, recipes, products(), list, NOW);
    if (!chosen.ok) throw Error(chosen.reason);
    const more = await previewIngredientQuantity(chosen.preparation, chosen.preparation, 0, "custom:0:row", 850, recipes, products(), list, NOW);
    const result = await commitExplicitRecipeAlternative(chosen.preparation, 0, more!, false, recipes, products(), list, NOW);
    if (!result.ok) throw Error(result.reason);
    const reopened = decodeStoredWeekPreparation(encodeStoredWeekPreparation(result.preparation))!;
    expect(reopened.days[0].customDish?.ingredients[0].quantity).toBe(850);
    const refreshed = (await revalidatePreparedWeek(reopened, recipes, products(), NOW, list)).preparation;
    expect(refreshed.ingredients[0]).toMatchObject({ requiredQuantity: 850, purchaseQuantity: 3 });
    expect(refreshed.generation?.mealPlanKnownCostCents).toBe(600);
  });
  it.each(["honig-macaroni", "knorr-hokkien-mie"])("adjusts all ingredients in %s independently", async sourceKey => {
    const profile = { ...MEAL_MIX_PROFILES.find(item => item.recipeSourceKey === sourceKey)!, productId: "mix" };
    const mixRecipe = { ...recipe, id: "mix-recipe", sourceKey };
    const definitions = enrichIngredientsForMealMixes([], [profile]);
    const mixRecipes: RecipeRepository = { loadCatalog: async () => ({ recipes: [mixRecipe], ingredients: definitions, relations: [], mealMixProfiles: [profile] }) };
    const candidates = definitions.map(def => ({ ...product, id: def.sourceKey === profile.productIngredientSourceKey ? "mix" : def.id, sku: def.id, name: def.name, brand: def.sourceKey === profile.productIngredientSourceKey ? profile.brand : null, category: def.category, productType: def.category, packageText: def.defaultUnit === "piece" ? "1 stuk" : "400 g", weightGrams: def.defaultUnit === "piece" ? null : 400 }));
    for (const candidate of candidates) candidate.currentPrice = { ...product.currentPrice!, productId: candidate.id };
    const mixProducts: CatalogRepository = { ...products(), getByIds: async ids => ({ products: candidates.filter(p => ids.includes(p.id)), priceStatus: "complete" }), search: async () => ({ products: candidates, priceStatus: "complete" }) };
    const generated = await prepared();
    const base: WeekPreparation = { ...generated, days: generated.days.map(day => ({ ...day, category: "freeChoice", freeChoice: true, recipe: null, recipeId: null, status: "freeChoice" })) };
    const choice = await previewFreeChoice(base, 0, { recipeId: mixRecipe.id }, mixRecipes, mixProducts, list, NOW);
    expect(choice).not.toBeNull();
    const chosen = await commitExplicitRecipeAlternative(base, 0, choice!, false, mixRecipes, mixProducts, list, NOW);
    if (!chosen.ok) throw Error(chosen.reason);
    for (const ingredient of chosen.preparation.ingredients) {
      expect(canAdjustIngredient(ingredient, 0)).toBe(true);
      const amount = steppedIngredientQuantity(ingredient.requiredQuantity, ingredient.unit, 1);
      const adjusted = await previewIngredientQuantity(chosen.preparation, chosen.preparation, 0, ingredient.ingredientId, amount, mixRecipes, mixProducts, list, NOW);
      expect(adjusted).not.toBeNull();
      const committed = await commitExplicitRecipeAlternative(chosen.preparation, 0, adjusted!, false, mixRecipes, mixProducts, list, NOW);
      if (!committed.ok) throw Error(committed.reason);
      const refreshed = (await revalidatePreparedWeek(committed.preparation, mixRecipes, mixProducts, NOW, list)).preparation;
      expect(refreshed.ingredients.find(i => i.ingredientId === ingredient.ingredientId)?.requiredQuantity).toBe(amount);
      expect(refreshed.ingredients.filter(i => i.ingredientId !== ingredient.ingredientId).map(i => i.requiredQuantity)).toEqual(chosen.preparation.ingredients.filter(i => i.ingredientId !== ingredient.ingredientId).map(i => i.requiredQuantity));
    }
  });
});
async function prepared(days = 1) {
  const base = createWeekPreparation({ schemaVersion: 1, people: 4, days, budgetCents: 10000 }, { knownSubtotalCents: 0, unpricedItemCount: 0 }, NOW, "quantity-week");
  return (await revalidatePreparedWeek({ ...base, mealBudgetCents: 5000, status: "generated", days: Array.from({ length: days }, (_, dayIndex) => ({ dayIndex, category: "pasta", freeChoice: false, recipeId: recipe.id, recipe, status: "recipeSelected" })) }, recipes, products(), NOW, list)).preparation;
}
async function preview(base: WeekPreparation, quantity: number, shopping = list) {
  const result = await previewIngredientQuantity(base, base, 0, "pasta", quantity, recipes, products(), shopping, NOW);
  expect(result).not.toBeNull(); return result!;
}
async function commit(base: WeekPreparation, quantity: number, shopping = list, approve = false) {
  const choice = await preview(base, quantity, shopping);
  const result = await commitExplicitRecipeAlternative(base, 0, choice, approve, recipes, products(), shopping, NOW);
  expect(result.ok).toBe(true); if (!result.ok) throw Error(result.reason); return result.preparation;
}

describe("ingredient quantity steps", () => {
  it.each<[WeekIngredientUnit, number, number, number]>([["g",450,500,400],["ml",30,35,25],["kg",.4,.45,.35],["l",.03,.035,.025],["piece",2,3,1],["loaf",2,3,1]])("steps %s without conversion noise", (unit, amount, plus, minus) => {
    expect(steppedIngredientQuantity(amount,unit,1)).toBe(plus);
    expect(steppedIngredientQuantity(amount,unit,-1)).toBe(minus);
  });
  it.each<[WeekIngredientUnit, number]>([["g",1],["ml",1],["kg",.001],["l",.001],["piece",1],["loaf",1]])("never falls below the %s minimum", (unit,minimum) => expect(steppedIngredientQuantity(minimum,unit,-1)).toBe(minimum));
  it("uses small steps for small quantities and caps invalid extremes", () => {
    expect(quantityStep("g",5)).toBe(1); expect(quantityStep("g",30)).toBe(10);
    expect(steppedIngredientQuantity(100000,"g",1)).toBe(100000);
  });
});

describe("quantity persistence, packages and the existing recipe commit", () => {
  it("adds and removes full packages; 850 g in 400 g packs costs three full packs", async () => {
    const base=await prepared(); const more=await commit(base,850);
    expect(more.ingredients[0]).toMatchObject({ requiredQuantity:850, purchaseQuantity:3, packageCapacity:400 });
    expect(calculateDishCostSummary(0,more.ingredients).knownCostCents).toBe(600);
    expect(more.generation).toMatchObject({ mealPlanKnownCostCents:600, totalKnownWeekCostCents:600, mealBudgetRemainingCents:4400 });
    const less=await commit(more,400);
    expect(less.ingredients[0].purchaseQuantity).toBe(1); expect(less.generation?.mealPlanKnownCostCents).toBe(200);
    expect(base.ingredients[0].requiredQuantity).toBe(400);
  });
  it("requires explicit approval for meal and week budget overruns", async () => {
    const base={...await prepared(),budgetCents:500,mealBudgetCents:300};
    const manual=addCatalogProduct(list,{...product,id:"other",sku:"101",currentPrice:{...product.currentPrice!,productId:"other"}},"catalog",NOW);
    const choice=await preview(base,850,manual);
    expect(choice.impact).toMatchObject({ nextMealPlanCostCents:600,nextTotalWeekCostCents:800,mealBudgetOverageCents:300,weekBudgetOverageCents:300,requiresBudgetOverride:true });
    const denied=await commitExplicitRecipeAlternative(base,0,choice,false,recipes,products(),manual,NOW);
    expect(denied).toMatchObject({ok:false,reason:"budget_override_required"});
    const approved=await commit(base,850,manual,true);
    expect((await revalidatePreparedWeek(approved,recipes,products(),NOW,manual)).ready).toBe(true);
  });
  it("synchronizes changed package counts while protecting a manual extra package", async () => {
    const base=await prepared();
    const planned=completeShoppingListFromWeek(list,base.ingredients,base.id,NOW);
    const manual=increaseQuantity(planned,product.id,NOW);
    const more=await commit(base,850,manual);
    const synced=completeShoppingListFromWeek(manual,more.ingredients,more.id,NOW);
    expect(synced.items[0].quantity).toBe(4);
    const less=await commit(more,400,synced);
    const reduced=completeShoppingListFromWeek(synced,less.ingredients,less.id,NOW);
    expect(reduced.items[0].quantity).toBe(2);
    expect(reduced.items[0].quantityContributions.persistentQuantity).toBe(1);
  });
  it("persists, reopens and scales the chosen ratio when persons change", async () => {
    const changed=await commit(await prepared(),450);
    const reopened=decodeStoredWeekPreparation(encodeStoredWeekPreparation(changed));
    expect(reopened?.customizations[0].quantityOverrides?.[0].quantity).toBe(450);
    const settings=updateWeekSettings(reopened!,{people:6,days:1,budgetCents:10000},NOW);
    const six=(await revalidatePreparedWeek(settings,recipes,products(),NOW,list)).preparation;
    expect(six.ingredients[0].requiredQuantity).toBe(675); expect(six.ingredients[0].purchaseQuantity).toBe(2);
    const four=(await revalidatePreparedWeek(updateWeekSettings(six,{people:4,days:1,budgetCents:10000},NOW),recipes,products(),NOW,list)).preparation;
    expect(four.ingredients[0].requiredQuantity).toBe(450);
  });
  it("preserves the adjusted generated dish when the planner runs again", async () => {
    const changed=await commit(await prepared(),450);
    const regenerated=await generatePreparedWeek({...changed,status:"readyForGeneration"},recipes,products(),NOW,list);
    expect(regenerated.days[0].recipeId).toBe(recipe.id);
    expect(regenerated.ingredients[0].requiredQuantity).toBe(450);
  });
  it("changes only the chosen day and aggregates shared packages correctly", async () => {
    const changed=await commit(await prepared(2),450);
    expect(changed.ingredients[0].usedIn.map(use=>use.requiredQuantity)).toEqual([450,400]);
    expect(changed.ingredients[0].purchaseQuantity).toBe(3);
  });
  it("respects a later explicit product/package replacement", async () => {
    const changed = await commit(await prepared(), 850);
    const replacement = previewManualProductChoice(changed, { action: "replaceIngredient", dayIndex: 0, ingredientId: "pasta", productId: product.id, quantity: 1, selectionSource: "manualSearch" }, product, list, NOW);
    expect(replacement.ok).toBe(true);
    if (!replacement.ok) throw Error(replacement.reason);
    const refreshed = (await revalidatePreparedWeek(replacement.preview.preparation, recipes, products(), NOW, list)).preparation;
    expect(refreshed.ingredients[0]).toMatchObject({ unit: "piece", requiredQuantity: 1, purchaseQuantity: 1 });
    expect(refreshed.customizations[0].quantityOverrides).toEqual([]);
  });
  it("rejects invalid amounts and unavailable pricing without zero-price matches", async () => {
    const base=await prepared();
    for(const amount of [0,-1,NaN,Infinity,100001]) expect(withIngredientQuantity(base,0,"pasta",amount)).toBeNull();
    expect(canAdjustIngredient({...base.ingredients[0],price:null},0)).toBe(false);
    expect(await previewIngredientQuantity(base,base,0,"pasta",450,recipes,products({...product,currentPrice:null}),list,NOW)).toBeNull();
  });
  it("rejects corrupt new quantity metadata while older preparations remain readable", async () => {
    const base=await prepared(); expect(decodeStoredWeekPreparation(encodeStoredWeekPreparation(base))).not.toBeNull();
    const next=await commit(base,450); next.customizations[0].quantityOverrides![0].people=0;
    expect(()=>decodeStoredWeekPreparation(encodeStoredWeekPreparation(next))).toThrow();
  });
  it("writes custom quantities into the original recipe units and serving basis", () => {
    const dish:CustomDish={name:"Eigen pasta",servings:4,targetServings:2,ingredients:[{id:"row",name:"Spaghetti",quantity:.4,unit:"kg",productId:product.id}]};
    const next=customDishWithIngredientQuantity(dish,0,"custom:0:row",250,"g",2);
    expect(next.ingredients[0].quantity).toBe(.5);
    expect(customIngredientQuantity(next.ingredients[0],next)).toBe(.25);
    expect(customIngredientQuantity(next.ingredients[0],{...next,targetServings:4})).toBe(.5);
    expect(dish.ingredients[0].quantity).toBe(.4);
  });
});
