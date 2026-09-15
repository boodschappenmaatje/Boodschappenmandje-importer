import { calculateBudget } from "@/services/budget/budget-engine";
import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import { aggregateWeekIngredients } from "@/services/week-preparation/ingredient-aggregation";
import {
  applyProductToRequirement,
  combinedProductPurchaseQuantity,
  matchWeekIngredients,
} from "@/services/week-preparation/product-matching";
import type {
  RecipeCatalog,
  RecipeRepository,
} from "@/services/week-preparation/recipe-repository";
import { selectRecipesForDays } from "@/services/week-preparation/recipe-selection";
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
    missingProductMatchCount: ingredients.filter((item) => item.productMatchMissing).length,
    missingPackageCalculationCount: ingredients.filter(
      (item) => item.packageCalculationMissing,
    ).length,
    missingPriceCount: ingredients.filter(
      (item) => item.product !== null && item.price === null,
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
      item.productMatchMissing ||
      item.packageCalculationMissing ||
      item.price === null,
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
  const days = selectRecipesForDays(
    preparation.days,
    catalog.recipes,
    preparation.preferences,
    preparation.id,
  );
  const requirements = aggregateWeekIngredients(
    days,
    preparation.numberOfPeople,
    catalog,
  );
  const ingredients = await matchWeekIngredients(
    requirements,
    catalog.ingredients,
    catalogRepository,
  );
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

async function refreshRequirements(
  requirements: WeekIngredientRequirement[],
  catalog: RecipeCatalog,
  catalogRepository: CatalogRepository,
): Promise<WeekIngredientRequirement[]> {
  const productIds = requirements
    .map((item) => item.product?.productId)
    .filter((id): id is string => Boolean(id));
  const currentProducts = productIds.length
    ? await catalogRepository.getByIds(productIds)
    : { products: [], priceStatus: "complete" as const };
  const productById = new Map(
    currentProducts.products.map((product) => [product.id, product]),
  );
  const refreshed = requirements.map((requirement) => {
    const product = requirement.product
      ? productById.get(requirement.product.productId)
      : null;
    return product && product.sku === requirement.product?.sku
      ? applyProductToRequirement(requirement, product)
      : applyProductToRequirement(requirement, null);
  });
  const retryIndexes = refreshed
    .map((requirement, index) =>
      requirement.productMatchMissing || requirement.packageCalculationMissing
        ? index
        : -1,
    )
    .filter((index) => index >= 0);

  if (retryIndexes.length === 0) return refreshed;
  const retried = await matchWeekIngredients(
    retryIndexes.map((index) => refreshed[index]),
    catalog.ingredients,
    catalogRepository,
  );
  const result = [...refreshed];
  retryIndexes.forEach((index, retryIndex) => {
    result[index] = retried[retryIndex];
  });
  return result;
}

export async function refreshGeneratedWeek(
  preparation: WeekPreparation,
  recipeRepository: RecipeRepository,
  catalogRepository: CatalogRepository,
  now: Date = new Date(),
): Promise<WeekPreparation> {
  if (
    !["generated", "generationPartial"].includes(preparation.status) ||
    preparation.ingredients.length === 0
  ) {
    return preparation;
  }
  const loadedCatalog = await recipeRepository.loadCatalog();
  const catalog = {
    ...loadedCatalog,
    ingredients: enrichIngredientsForMealMixes(loadedCatalog.ingredients),
  };
  const ingredients = await refreshRequirements(
    preparation.ingredients,
    catalog,
    catalogRepository,
  );
  const generatedAt = now.toISOString();
  const refreshed = { ...preparation, ingredients };
  return {
    ...refreshed,
    generation: generationSummary(ingredients, generatedAt),
    status: finalStatus(refreshed, ingredients),
    updatedAt: generatedAt,
  };
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

export function calculateDishCostSummary(
  dayIndex: number,
  ingredients: WeekIngredientRequirement[],
): DishCostSummary {
  let knownCostCents = 0;
  let missingProductCount = 0;

  for (const ingredient of ingredients) {
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
