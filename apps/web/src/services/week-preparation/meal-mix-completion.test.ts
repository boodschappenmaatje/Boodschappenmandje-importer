import { it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import profilesJson from '../../../../../test/fixtures/meal-mix-reviewed-profiles.json';
import { aggregateWeekIngredients } from './ingredient-aggregation';
import { enrichIngredientsForMealMixes, type MealMixProfile } from './meal-mix-profiles';
import { recipeImageFor, recipeImageContextFromCatalog } from './recipe-images';
import type { RecipeCatalog } from './recipe-repository';
import { isReliableIngredientMatch } from './product-matching';
import type { Product } from '@/types/catalog';
import { rowsForGate, planPlannerReadinessMaintenance } from '@/server/planner-cache-service';
const profiles = profilesJson as MealMixProfile[];
const recipes = profiles.map(p => ({ id: p.productId!, sourceKey:p.recipeSourceKey, name:p.dishName, normalizedName:p.dishName.toLowerCase(), symbol:'fork.knife', preparationMinutes:30, vegetarian:false,containsPork:false,kidFriendly:false,healthy:false,budgetTier:'standard' as const }));
const catalog: RecipeCatalog = { recipes, ingredients:enrichIngredientsForMealMixes([],profiles), relations:[], mealMixProfiles:profiles };

it('rejects baby meals and cooked preserves for fresh meal-mix supplements', () => {
  for (const [name, productName, category] of [
    ['appel', 'Bonbébé Multipack appel aardbei', 'Baby, kind/Fruithapjes'],
    ['appel', 'Hak Appel kaneel moes', 'Conserven/Appelmoes'],
    ['Pasta', 'Bonbébé Pasta met tomaat mozzarella 8+ maanden', 'Baby, kind/Groente- en maaltijdhapjes'],
    ['kastanjechampignons', 'Limburg Champignons schijfjes', 'Soepen, conserven/Conserven/Groenteconserven'],
    ['wortel', "G’woon Wortelen extra fijn", 'Soepen, conserven/Conserven/Groenteconserven'],
  ]) {
    const ingredient = catalog.ingredients.find(i => i.sourceKey.startsWith('mix-supplement-') && i.name.toLowerCase() === name.toLowerCase())!;
    expect(ingredient, name).toBeDefined();
    const product = {id:'test',sku:'test',supermarket:'Hoogvliet',name:productName,brand:null,category,isAvailable:true} as Product;
    expect(isReliableIngredientMatch(ingredient, product), productName).toBe(false);
  }
});

it('scales every reviewed SKU for 1–10 people with exact branded packs and per-sachet supplements', () => {
  expect(profiles).toHaveLength(40);
  for (const [index, profile] of profiles.entries()) for(let people=1;people<=10;people++) {
    const recipe=recipes[index];
    const result=aggregateWeekIngredients([{dayIndex:0,category:'freeChoice',freeChoice:true,recipeId:recipe.id,recipe:{id:recipe.id,sourceKey:recipe.sourceKey,name:recipe.name},status:'recipeSelected'}],people,catalog);
    const pack=result.find(r=>r.kind==='mealMix')!;
    expect(pack.requiredQuantity,profile.productName).toBe(Math.ceil(people/profile.servingsPerPackage));
    expect(pack.brandConstraint).toBe(profile.brand);
    for(const item of profile.supplements) expect(result.find(r=>r.sourceKey===item.sourceKey)?.requiredQuantity,`${profile.productName}: ${item.name}`).toBeCloseTo(item.quantity*people/(profile.supplementServings??profile.servingsPerPackage),2);
  }
});

it('has a reviewed local image for all 40 stable recipe IDs, preserved after serialization', () => {
  for(const recipe of recipes) {
    const context=recipeImageContextFromCatalog(recipe,[],catalog);
    const asset=recipeImageFor(context);
    expect(asset,recipe.name).not.toBeNull();
    expect(existsSync(`public${asset!.src}`),recipe.name).toBe(true);
    expect(recipeImageFor(JSON.parse(JSON.stringify(context)))).toEqual(asset);
    expect(recipeImageFor({...context,recipeName:recipe.name,recipeSourceKey:'unreviewed-mix'})).toBeNull();
  }
});

it('cannot display the chicken burrito photo for a changed beef/lasagne recipe', () => {
  expect(recipeImageFor({recipeSourceKey:'knorr-burritos',recipeName:'Runderlasagne',categories:[],ingredients:[{sourceKey:'beef',name:'rundergehakt'}]})).toBeNull();
});

it('produces deterministic unique cache keys and skips current records when backfilled again', () => {
  const now=new Date('2026-09-21T12:00:00Z');
  const gate={recipes:recipes.map(r=>({recipeId:r.id,recipeSourceKey:r.sourceKey,recipeName:r.name,ready:true,requiredIngredientCount:0,readyRequiredIngredientCount:0,problemCount:0,ingredients:[]})),matchedProductsByRequirement:new Map()};
  const rows=Array.from({length:10},(_,i)=>rowsForGate(gate,i+1,now).readinessRows).flat();
  expect(rows).toHaveLength(400);
  expect(new Set(rows.map(r=>`${r.recipe_id}:${r.people_count}`)).size).toBe(400);
  expect(planPlannerReadinessMaintenance(recipes.map(r=>r.id),rows,[1,2,3,4,5,6,7,8,9,10],now)).toEqual([]);
  expect(rowsForGate(gate,4,now)).toEqual(rowsForGate(gate,4,now));
});


it('rejects a baby meal for an ordinary sweet-potato recipe without rejecting fresh baby spinach', () => {
  const ingredient = { id: 'sweet-potato', sourceKey: 'sweetPotato', name: 'zoete aardappel', normalizedName: 'zoete aardappel', defaultUnit: 'g', category: 'Groente', aliases: ['zoete aardappel'] };
  const product = { id: 'baby-meal', sku: 'baby-meal', supermarket: 'Hoogvliet', name: 'Bonbébé Broccoli zoete aardappel 12+ maanden', category: 'Baby, kind/Groentehapjes', isAvailable: true } as Product;
  expect(isReliableIngredientMatch(ingredient, product)).toBe(false);
  expect(isReliableIngredientMatch({ ...ingredient, name: 'spinazie', normalizedName: 'spinazie', aliases: ['spinazie'] }, { ...product, name: 'Baby spinazie', category: 'Aardappelen, groente, fruit/Groente' })).toBe(true);
});
