import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import type { RecipeRepository } from "@/services/week-preparation/recipe-repository";
import { budgetImpact, listWithoutCurrentWeekMealPlan, type RecipeAlternative } from "@/services/week-preparation/meal-customization";
import { mealMixProfileForRecipe } from "@/services/week-preparation/meal-mix-profiles";
import { validCustomDish } from "@/services/week-preparation/custom-dish";
import { calculateDishCostSummary, revalidatePreparedWeek } from "@/services/week-preparation/week-generation";
import type { Recipe } from "@/types/catalog";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type { CustomDish, WeekPreparation } from "@/types/week-preparation";
import { createCachedCatalogRepository, createWeekPlanningSnapshotCache, type WeekPlanningSnapshotCache } from "./planning-cache";
import { createPersistentRecipeReadinessRepository } from "./persistent-readiness-cache";
import { enrichIngredientsForMealMixes } from "./meal-mix-profiles";

export type FreeChoiceRoute = "all" | "recipe" | "mix";

export interface FreeChoiceResult {
  recipe: Pick<Recipe, "id" | "sourceKey" | "name"> & Partial<Pick<Recipe, "preparationMinutes">>;
  brand: string | null;
  alternative: RecipeAlternative | null;
}

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/['’`]/g, "");
export function recipeMatchesQuery(recipe: Pick<Recipe, "name" | "sourceKey">, query: string): boolean {
  const profile = mealMixProfileForRecipe(recipe.sourceKey);
  const text = normalize([recipe.name, recipe.sourceKey, profile?.brand, profile?.dishName, profile?.productName, ...(profile?.productAliases ?? [])].join(" "));
  return normalize(query).trim().split(/\s+/).every((word) => text.includes(word));
}

export async function previewFreeChoice(preparation: WeekPreparation, dayIndex: number, choice: { recipeId: string } | { customDish: CustomDish }, recipes: RecipeRepository, products: CatalogRepository, list?: ActiveShoppingList, now = new Date(), planningCache?: WeekPlanningSnapshotCache): Promise<RecipeAlternative | null> {
  const day = preparation.days.find((item) => item.dayIndex === dayIndex);
  if (!day || !preparation.numberOfPeople) return null;
  const custom = "customDish" in choice ? choice.customDish : undefined;
  if (custom && !validCustomDish(custom)) return null;
  const catalog = custom ? null : await recipes.loadCatalog();
  const recipe = custom
    ? { id: `custom-dish:${preparation.id}:${dayIndex}`, sourceKey: "custom-dish", name: custom.name.trim() }
    : catalog?.recipes.find((item) => item.id === (choice as { recipeId: string }).recipeId);
  if (!recipe) return null;
  // A brand name alone is never proof of a validated meal-mix recipe.
  if (!custom && /\b(knorr|honig)\b/i.test(`${recipe.name} ${recipe.sourceKey}`) && !mealMixProfileForRecipe(recipe.sourceKey, catalog?.mealMixProfiles)) return null;
  const reference = { id: recipe.id, sourceKey: recipe.sourceKey, name: recipe.name };
  const next: WeekPreparation = {
    ...preparation,
    categoryDistribution: { ...preparation.categoryDistribution,
      [day.category]: preparation.categoryDistribution[day.category] - (day.category === "freeChoice" ? 0 : 1),
      freeChoice: preparation.categoryDistribution.freeChoice + (day.category === "freeChoice" ? 0 : 1),
    },
    days: preparation.days.map((item) => item.dayIndex === dayIndex ? {
      ...item, category: "freeChoice", freeChoice: false, recipeId: recipe.id, recipe: reference, customDish: custom, status: "recipeSelected",
    } : item),
    customizations: [...preparation.customizations.filter((item) => item.dayIndex !== dayIndex), {
      dayIndex, baseRecipe: day.recipe ?? reference, replacementRecipe: reference,
      recipeBudgetDecision: { mode: "userConfirmedManualChoice" }, productOverrides: [], ingredientOverrides: [], manualProductAdditions: [], updatedAt: now.toISOString(),
    }],
  };
  const baseline = listWithoutCurrentWeekMealPlan(list, preparation.id, now);
  const validated = (await revalidatePreparedWeek(next, recipes, products, now, baseline, planningCache)).preparation;
  const dish = calculateDishCostSummary(dayIndex, validated.ingredients);
  if (!dish.complete || !validated.ingredients.some((item) => item.usedIn.some((use) => use.dayIndex === dayIndex)) ||
    validated.ingredients.some((item) => item.usedIn.some((use) => use.dayIndex === dayIndex) && !item.optional && item.price?.freshness !== "fresh")) return null;
  const impact = budgetImpact(preparation, validated, baseline ?? { schemaVersion: 2, startedAt: now.toISOString(), updatedAt: now.toISOString(), items: [] }, now);
  return {
    recipe: reference, category: "comfort", currentDishCostCents: calculateDishCostSummary(dayIndex, preparation.ingredients).knownCostCents,
    alternativeDishCostCents: dish.knownCostCents, differenceCents: dish.knownCostCents - calculateDishCostSummary(dayIndex, preparation.ingredients).knownCostCents,
    nextMealPlanCostCents: impact.nextMealPlanCostCents, mealBudgetCents: preparation.mealBudgetCents,
    withinMealBudget: !impact.requiresBudgetOverride, alreadyUsedInWeek: preparation.days.some((item) => item.dayIndex !== dayIndex && item.recipeId === recipe.id),
    impact, preparation: validated, basePreparationUpdatedAt: preparation.updatedAt, validatedAt: now.toISOString(),
  };
}

export async function searchFreeChoice(preparation: WeekPreparation, dayIndex: number, query: string, recipes: RecipeRepository, products: CatalogRepository, list?: ActiveShoppingList, planningCache = createWeekPlanningSnapshotCache({ persistentRepository: createPersistentRecipeReadinessRepository() }), route: FreeChoiceRoute = "all"): Promise<FreeChoiceResult[]> {
  if (query.trim().length < 2) return [];
  const catalog = await recipes.loadCatalog();
  const matching = catalog.recipes.filter((recipe) => {
    const mix = mealMixProfileForRecipe(recipe.sourceKey, catalog.mealMixProfiles) !== null;
    return (route === "all" || (route === "mix" ? mix : !mix)) && recipeMatchesQuery(recipe, query);
  });
  // Combined queries (e.g. "Knorr mix") must retain the complete matching mix
  // inventory too. Keep the existing bound for ordinary recipe results.
  const candidates = /^(honig|knorr)$/i.test(query.trim()) ? matching : matching.filter((recipe, index) =>
    index < 20 || mealMixProfileForRecipe(recipe.sourceKey, catalog.mealMixProfiles) !== null);
  // One snapshot and one batched persistent lookup, including selected dishes
  // needed by the unchanged whole-week budget and package calculations.
  const snapshotRecipes: RecipeRepository = { loadCatalog: async () => catalog };
  const snapshotProducts = createCachedCatalogRepository(products);
  const preparedCatalog = planningCache.prepareCatalog(catalog, () => ({
    ...catalog, ingredients: enrichIngredientsForMealMixes(catalog.ingredients, catalog.mealMixProfiles),
  }));
  const selectedIds = new Set(preparation.days.map((day) => day.recipeId));
  const targetIds = new Set(candidates.map((recipe) => recipe.id));
  const readiness = preparation.numberOfPeople ? await planningCache.evaluateReadiness(catalog,
    catalog.recipes.filter((recipe) => selectedIds.has(recipe.id) || targetIds.has(recipe.id)),
    preparation.numberOfPeople, preparedCatalog, snapshotProducts) : null;
  const readyIds = new Set(readiness?.gate.recipes.filter((recipe) => recipe.ready).map((recipe) => recipe.recipeId));
  const results: FreeChoiceResult[] = [];
  for (const recipe of candidates) {
    results.push({ recipe, brand: mealMixProfileForRecipe(recipe.sourceKey, catalog.mealMixProfiles)?.brand ?? null,
      alternative: readyIds.has(recipe.id) ? await previewFreeChoice(preparation, dayIndex, { recipeId: recipe.id }, snapshotRecipes, snapshotProducts, list, new Date(), planningCache) : null });
  }
  for (const recipe of route === "recipe" ? [] : catalog.unavailableMealMixes ?? []) {
    if (recipeMatchesQuery(recipe, query) && !results.some(item => item.recipe.name === recipe.name)) results.push({ recipe, brand: recipe.brand, alternative: null });
  }
  return results.sort((a, b) => Number(!a.alternative) - Number(!b.alternative));
}
