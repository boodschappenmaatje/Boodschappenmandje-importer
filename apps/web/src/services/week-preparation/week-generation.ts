import { calculateBudget } from "@/services/budget/budget-engine";
import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import { aggregateWeekIngredients } from "@/services/week-preparation/ingredient-aggregation";
import {
  combinedProductPurchaseQuantity,
} from "@/services/week-preparation/product-matching";
import {
  applyReadinessProducts,
  evaluateRecipeReadiness,
  readyRecipeIds,
} from "@/services/week-preparation/recipe-readiness";
import type {
  RecipeCatalog,
  RecipeRepository,
} from "@/services/week-preparation/recipe-repository";
import {
  candidateRecipesForDays,
  selectRecipesForDays,
} from "@/services/week-preparation/recipe-selection";
import { enrichIngredientsForMealMixes } from "@/services/week-preparation/meal-mix-profiles";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type {
  WeekGenerationSummary,
  WeekIngredientRequirement,
  WeekPreparation,
  WeekPreparationStatus,
} from "@/types/week-preparation";

function generationSummary(
  ingredients: WeekIngredientRequirement[],
  generatedAt: string,
): WeekGenerationSummary {
  const pricedByProduct = Map.groupBy(
    ingredients.filter(
      (item) => item.product && item.price && item.purchaseQuantity !== null,
    ),
    (item) => item.product!.productId,
  );
  return {
    generatedAt,
    knownPurchaseCostCents: [...pricedByProduct.values()].reduce(
      (total, grouped) =>
        total + grouped[0].price!.amountCents * combinedProductPurchaseQuantity(grouped),
      0,
    ),
    matchedProductCount: ingredients.filter((item) => item.product !== null).length,
    missingProductMatchCount: ingredients.filter(
      (item) => !item.optional && item.productMatchMissing,
    ).length,
    missingPackageCalculationCount: ingredients.filter(
      (item) => !item.optional && item.packageCalculationMissing,
    ).length,
    missingPriceCount: ingredients.filter(
      (item) => !item.optional && item.product !== null && item.price === null,
    ).length,
  };
}

function finalStatus(
  preparation: WeekPreparation,
  ingredients: WeekIngredientRequirement[],
): WeekPreparationStatus {
  const hasRecipeGap = preparation.days.some(
    (day) => !day.freeChoice && !day.recipeId,
  );
  const hasIngredientGap = ingredients.some(
    (item) =>
      !item.optional &&
      (item.productMatchMissing ||
        item.packageCalculationMissing ||
        item.price === null),
  );
  return hasRecipeGap || hasIngredientGap ? "generationPartial" : "generated";
}

export function markWeekGenerating(
  preparation: WeekPreparation,
  now: Date = new Date(),
): WeekPreparation {
  return {
    ...preparation,
    status: "generating",
    updatedAt: now.toISOString(),
  };
}

export function markWeekGenerationFailed(
  preparation: WeekPreparation,
  now: Date = new Date(),
): WeekPreparation {
  return {
    ...preparation,
    status: "generationError",
    updatedAt: now.toISOString(),
  };
}

export async function generatePreparedWeek(
  preparation: WeekPreparation,
  recipeRepository: RecipeRepository,
  catalogRepository: CatalogRepository,
  now: Date = new Date(),
): Promise<WeekPreparation> {
  if (
    !["readyForGeneration", "generationError"].includes(preparation.status) ||
    preparation.numberOfPeople === null
  ) {
    return preparation;
  }

  const loadedCatalog = await recipeRepository.loadCatalog();
  const catalog = {
    ...loadedCatalog,
    ingredients: enrichIngredientsForMealMixes(loadedCatalog.ingredients),
  };
  const candidates = candidateRecipesForDays(
    preparation.days,
    catalog.recipes,
    preparation.preferences,
  );
  const readiness = await evaluateRecipeReadiness(
    candidates,
    preparation.numberOfPeople,
    catalog,
    catalogRepository,
  );
  const days = selectRecipesForDays(
    preparation.days,
    catalog.recipes,
    preparation.preferences,
    preparation.id,
    readyRecipeIds(readiness),
  );
  const requirements = aggregateWeekIngredients(
    days,
    preparation.numberOfPeople,
    catalog,
  );
  const ingredients = applyReadinessProducts(requirements, readiness);
  const generatedAt = now.toISOString();
  const prepared = {
    ...preparation,
    days,
    ingredients,
  };

  return {
    ...prepared,
    generation: generationSummary(ingredients, generatedAt),
    status: finalStatus(prepared, ingredients),
    updatedAt: generatedAt,
  };
}

export interface PreparedWeekReadinessResult {
  ready: boolean;
  preparation: WeekPreparation;
}

export async function revalidatePreparedWeek(
  preparation: WeekPreparation,
  recipeRepository: RecipeRepository,
  catalogRepository: CatalogRepository,
  now: Date = new Date(),
): Promise<PreparedWeekReadinessResult> {
  if (preparation.numberOfPeople === null) {
    return { ready: false, preparation };
  }
  const loadedCatalog = await recipeRepository.loadCatalog();
  const catalog: RecipeCatalog = {
    ...loadedCatalog,
    ingredients: enrichIngredientsForMealMixes(loadedCatalog.ingredients),
  };
  const selectedIds = new Set(
    preparation.days
      .map((day) => day.recipeId)
      .filter((id): id is string => Boolean(id)),
  );
  const selectedRecipes = catalog.recipes.filter((recipe) => selectedIds.has(recipe.id));
  const readiness = await evaluateRecipeReadiness(
    selectedRecipes,
    preparation.numberOfPeople,
    catalog,
    catalogRepository,
  );
  const readyIds = readyRecipeIds(readiness);
  const hasDayGap = preparation.days.some(
    (day) =>
      !day.freeChoice &&
      (!day.recipeId || !readyIds.has(day.recipeId)),
  );
  const requirements = aggregateWeekIngredients(
    preparation.days,
    preparation.numberOfPeople,
    catalog,
  );
  const ingredients = applyReadinessProducts(requirements, readiness);
  const generatedAt = now.toISOString();
  const refreshed = { ...preparation, ingredients };
  const next: WeekPreparation = {
    ...refreshed,
    generation: generationSummary(ingredients, generatedAt),
    status: hasDayGap ? "generationPartial" : finalStatus(refreshed, ingredients),
    updatedAt: generatedAt,
  };
  return {
    ready: !hasDayGap && next.status === "generated",
    preparation: next,
  };
}

export async function refreshGeneratedWeek(
  preparation: WeekPreparation,
  recipeRepository: RecipeRepository,
  catalogRepository: CatalogRepository,
  now: Date = new Date(),
): Promise<WeekPreparation> {
  if (
    !["generated", "generationPartial"].includes(preparation.status)
  ) {
    return preparation;
  }
  return (
    await revalidatePreparedWeek(
      preparation,
      recipeRepository,
      catalogRepository,
      now,
    )
  ).preparation;
}

export interface WeekBudgetSummary {
  budgetCents: number | null;
  existingListKnownSubtotalCents: number;
  existingListUnpricedCount: number;
  newKnownCostCents: number;
  newPackageCount: number;
  newUnpricedRequirementCount: number;
  knownTotalCents: number;
  remainingCents: number | null;
  overBudgetCents: number;
  isComplete: boolean;
}

export interface DishCostSummary {
  knownCostCents: number;
  missingProductCount: number;
  complete: boolean;
}

export function dayReadinessIssueCount(
  dayIndex: number,
  ingredients: WeekIngredientRequirement[],
): number {
  return ingredients.filter(
    (ingredient) =>
      !ingredient.optional &&
      ingredient.usedIn.some((item) => item.dayIndex === dayIndex) &&
      (ingredient.product === null ||
        ingredient.productMatchMissing ||
        ingredient.price === null ||
        ingredient.purchaseQuantity === null ||
        ingredient.packageCapacity === null ||
        ingredient.packageCalculationMissing),
  ).length;
}

export function calculateDishCostSummary(
  dayIndex: number,
  ingredients: WeekIngredientRequirement[],
): DishCostSummary {
  let knownCostCents = 0;
  let missingProductCount = 0;

  for (const ingredient of ingredients) {
    if (ingredient.optional) continue;
    const use = ingredient.usedIn.find((item) => item.dayIndex === dayIndex);
    if (!use) continue;
    const packages =
      ingredient.kind === "mealMix"
        ? Math.ceil(use.requiredQuantity)
        : ingredient.packageCapacity
          ? Math.max(1, Math.ceil(use.requiredQuantity / ingredient.packageCapacity))
          : null;
    if (!ingredient.product || !ingredient.price || packages === null) {
      missingProductCount += 1;
      continue;
    }
    knownCostCents += ingredient.price.amountCents * packages;
  }

  return {
    knownCostCents,
    missingProductCount,
    complete: missingProductCount === 0,
  };
}

export function calculateWeekBudgetSummary(
  preparation: WeekPreparation,
  list: ActiveShoppingList,
  now: Date = new Date(),
): WeekBudgetSummary {
  const existing = calculateBudget(preparation.budgetCents, list, now);
  const existingQuantity = new Map(
    list.items.map((item) => [item.productId, item.quantity]),
  );
  const grouped = new Map<
    string,
    {
      requirements: WeekIngredientRequirement[];
      priceCents: number | null;
    }
  >();
  let unmatchedOrUnpackaged = 0;

  for (const requirement of preparation.ingredients) {
    if (requirement.optional && (!requirement.product || requirement.purchaseQuantity === null)) {
      continue;
    }
    if (!requirement.product || requirement.purchaseQuantity === null) {
      unmatchedOrUnpackaged += 1;
      continue;
    }
    const current = grouped.get(requirement.product.productId);
    if (current) {
      current.requirements.push(requirement);
      if (current.priceCents === null && requirement.price) {
        current.priceCents = requirement.price.amountCents;
      }
    } else {
      grouped.set(requirement.product.productId, {
        requirements: [requirement],
        priceCents: requirement.price?.amountCents ?? null,
      });
    }
  }

  let newKnownCostCents = 0;
  let newPackageCount = 0;
  let newUnpricedRequirementCount = unmatchedOrUnpackaged;

  for (const [productId, requirement] of grouped) {
    const packagesNeeded = Math.max(
      0,
      combinedProductPurchaseQuantity(requirement.requirements) -
        (existingQuantity.get(productId) ?? 0),
    );
    if (packagesNeeded === 0) continue;
    newPackageCount += packagesNeeded;
    if (requirement.priceCents === null) {
      newUnpricedRequirementCount += 1;
    } else {
      newKnownCostCents += requirement.priceCents * packagesNeeded;
    }
  }

  const knownTotalCents =
    existing.knownSubtotalCents + newKnownCostCents;
  const missingCount =
    existing.unpricedItemCount + newUnpricedRequirementCount;
  const isComplete = missingCount === 0;
  const remainingCents =
    preparation.budgetCents !== null && isComplete
      ? Math.max(0, preparation.budgetCents - knownTotalCents)
      : null;
  const overBudgetCents =
    preparation.budgetCents === null
      ? 0
      : Math.max(0, knownTotalCents - preparation.budgetCents);

  return {
    budgetCents: preparation.budgetCents,
    existingListKnownSubtotalCents: existing.knownSubtotalCents,
    existingListUnpricedCount: existing.unpricedItemCount,
    newKnownCostCents,
    newPackageCount,
    newUnpricedRequirementCount,
    knownTotalCents,
    remainingCents,
    overBudgetCents,
    isComplete,
  };
}
