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
  rankedReadyRecipesForDay,
} from "@/services/week-preparation/recipe-selection";
import {
  evaluateMealBudget,
  mealBudgetAllowsPlan,
  type MealBudgetEvaluation,
} from "@/services/week-preparation/meal-budget";
import { enrichIngredientsForMealMixes } from "@/services/week-preparation/meal-mix-profiles";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type {
  WeekGenerationSummary,
  WeekIngredientRequirement,
  WeekPreparation,
  WeekPreparationStatus,
} from "@/types/week-preparation";

const EMPTY_LIST: ActiveShoppingList = {
  schemaVersion: 1,
  startedAt: "1970-01-01T00:00:00.000Z",
  updatedAt: "1970-01-01T00:00:00.000Z",
  items: [],
};

interface BudgetedSelection {
  days: WeekPreparation["days"];
  ingredients: WeekIngredientRequirement[];
  evaluation: MealBudgetEvaluation;
  candidateCount: number;
  rejectedCount: number;
  found: boolean;
  status: WeekGenerationSummary["mealBudgetStatus"];
}

function generationSummary(
  ingredients: WeekIngredientRequirement[],
  generatedAt: string,
  evaluation: MealBudgetEvaluation,
  candidateCount = 0,
  rejectedCount = 0,
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
    mealPlanKnownCostCents: evaluation.mealPlanKnownCostCents,
    mealBudgetRemainingCents: evaluation.mealBudgetRemainingCents,
    nonMealReservedCents: evaluation.nonMealReservedCents,
    totalKnownWeekCostCents: evaluation.totalKnownWeekCostCents,
    mealBudgetStatus: evaluation.mealBudgetStatus,
    weekBudgetStatus: evaluation.weekBudgetStatus,
    isMealBudgetComplete: evaluation.isMealBudgetComplete,
    mealBudgetCandidateCount: candidateCount,
    mealBudgetRejectedCount: rejectedCount,
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
  evaluation?: MealBudgetEvaluation,
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
  const budgetGap =
    evaluation !== undefined && !mealBudgetAllowsPlan(evaluation);
  return hasRecipeGap || hasIngredientGap || budgetGap
    ? "generationPartial"
    : "generated";
}

function selectedDay(
  day: WeekPreparation["days"][number],
  recipe: RecipeCatalog["recipes"][number],
): WeekPreparation["days"][number] {
  return {
    ...day,
    recipeId: recipe.id,
    recipe: {
      id: recipe.id,
      sourceKey: recipe.sourceKey,
      name: recipe.name,
    },
    status: "recipeSelected",
  };
}

function unselectedDays(days: WeekPreparation["days"]): WeekPreparation["days"] {
  return days.map((day) =>
    day.freeChoice
      ? { ...day, recipeId: null, recipe: null, status: "freeChoice" as const }
      : { ...day, recipeId: null, recipe: null, status: "categoryAssigned" as const },
  );
}

function selectWeekWithinMealBudget(
  preparation: WeekPreparation,
  catalog: RecipeCatalog,
  readiness: Awaited<ReturnType<typeof evaluateRecipeReadiness>>,
  list: ActiveShoppingList,
  now: Date,
): BudgetedSelection {
  const readyIds = readyRecipeIds(readiness);
  const autoDays = preparation.days.filter((day) => !day.freeChoice);
  const missingReadyCategory = autoDays.some((day) =>
    rankedReadyRecipesForDay(
      day,
      catalog.recipes,
      preparation.preferences,
      preparation.id,
      readyIds,
    ).length === 0
  );
  if (preparation.mealBudgetCents === null || missingReadyCategory) {
    const days = unselectedDays(preparation.days);
    const evaluation = evaluateMealBudget(
      preparation.budgetCents,
      preparation.mealBudgetCents,
      [],
      list,
      now,
    );
    return {
      days,
      ingredients: [],
      evaluation,
      candidateCount: 0,
      rejectedCount: 0,
      found: false,
      status: preparation.mealBudgetCents === null
        ? "noMealBudget"
        : "incompleteValidation",
    };
  }

  type State = { days: WeekPreparation["days"]; rank: number; duplicates: number };
  let states: State[] = [{ days: [], rank: 0, duplicates: 0 }];
  let candidateCount = 0;
  let rejectedCount = 0;
  const beamWidth = 192;

  for (const day of preparation.days) {
    if (day.freeChoice) {
      states = states.map((state) => ({
        ...state,
        days: [...state.days, { ...day, recipeId: null, recipe: null, status: "freeChoice" }],
      }));
      continue;
    }
    const candidates = rankedReadyRecipesForDay(
      day,
      catalog.recipes,
      preparation.preferences,
      preparation.id,
      readyIds,
    ).slice(0, 24);
    const nextStates: State[] = [];
    for (const state of states) {
      const usedIds = new Set(state.days.map((item) => item.recipeId).filter(Boolean));
      candidates.forEach((recipe, rank) => {
        candidateCount += 1;
        const days = [...state.days, selectedDay(day, recipe)];
        const requirements = aggregateWeekIngredients(days, preparation.numberOfPeople!, catalog);
        const ingredients = applyReadinessProducts(requirements, readiness);
        const evaluation = evaluateMealBudget(
          preparation.budgetCents,
          preparation.mealBudgetCents,
          ingredients,
          list,
          now,
        );
        if (!mealBudgetAllowsPlan(evaluation)) {
          rejectedCount += 1;
          return;
        }
        nextStates.push({
          days,
          rank: state.rank + rank,
          duplicates: state.duplicates + (usedIds.has(recipe.id) ? 1 : 0),
        });
      });
    }
    const unique = new Map<string, State>();
    for (const state of nextStates) {
      const signature = state.days.map((item) => item.recipeId ?? "free").join(":");
      const current = unique.get(signature);
      if (!current || state.duplicates < current.duplicates || state.rank < current.rank) {
        unique.set(signature, state);
      }
    }
    states = [...unique.values()]
      .toSorted((left, right) => left.duplicates - right.duplicates || left.rank - right.rank)
      .slice(0, beamWidth);
    if (states.length === 0) break;
  }

  const evaluated = states.map((state) => {
    const requirements = aggregateWeekIngredients(state.days, preparation.numberOfPeople!, catalog);
    const ingredients = applyReadinessProducts(requirements, readiness);
    const evaluation = evaluateMealBudget(
      preparation.budgetCents,
      preparation.mealBudgetCents,
      ingredients,
      list,
      now,
    );
    return { ...state, ingredients, evaluation };
  }).filter((state) => state.days.length === preparation.days.length && mealBudgetAllowsPlan(state.evaluation));

  const best = evaluated.toSorted((left, right) => {
    const leftWeekPenalty = left.evaluation.weekBudgetStatus === "overBudget" ? 1 : 0;
    const rightWeekPenalty = right.evaluation.weekBudgetStatus === "overBudget" ? 1 : 0;
    return leftWeekPenalty - rightWeekPenalty || left.duplicates - right.duplicates || left.rank - right.rank;
  })[0];

  if (!best) {
    const days = unselectedDays(preparation.days);
    const evaluation = evaluateMealBudget(
      preparation.budgetCents,
      preparation.mealBudgetCents,
      [],
      list,
      now,
    );
    return {
      days,
      ingredients: [],
      evaluation,
      candidateCount,
      rejectedCount,
      found: false,
      status: "noValidMealPlanWithinBudget",
    };
  }
  return {
    days: best.days,
    ingredients: best.ingredients,
    evaluation: best.evaluation,
    candidateCount,
    rejectedCount,
    found: true,
    status: best.evaluation.mealBudgetStatus,
  };
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
  list: ActiveShoppingList = EMPTY_LIST,
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
  const selection = selectWeekWithinMealBudget(
    preparation,
    catalog,
    readiness,
    list,
    now,
  );
  const { days, ingredients } = selection;
  const generatedAt = now.toISOString();
  const prepared = {
    ...preparation,
    days,
    ingredients,
  };

  return {
    ...prepared,
    generation: {
      ...generationSummary(
        ingredients,
        generatedAt,
        selection.evaluation,
        selection.candidateCount,
        selection.rejectedCount,
      ),
      mealBudgetStatus: selection.status,
    },
    status: selection.found
      ? finalStatus(prepared, ingredients, selection.evaluation)
      : "generationPartial",
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
  list: ActiveShoppingList = EMPTY_LIST,
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
  const mealBudget = evaluateMealBudget(
    preparation.budgetCents,
    preparation.mealBudgetCents,
    ingredients,
    list,
    now,
  );
  const next: WeekPreparation = {
    ...refreshed,
    generation: generationSummary(ingredients, generatedAt, mealBudget),
    status: hasDayGap
      ? "generationPartial"
      : finalStatus(refreshed, ingredients, mealBudget),
    updatedAt: generatedAt,
  };
  return {
    ready:
      !hasDayGap &&
      next.status === "generated" &&
      mealBudgetAllowsPlan(mealBudget),
    preparation: next,
  };
}

export async function refreshGeneratedWeek(
  preparation: WeekPreparation,
  recipeRepository: RecipeRepository,
  catalogRepository: CatalogRepository,
  now: Date = new Date(),
  list: ActiveShoppingList = EMPTY_LIST,
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
      list,
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
    if (
      requirement.optional &&
      (!requirement.product ||
        requirement.purchaseQuantity === null ||
        requirement.price === null)
    ) {
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

export function recalculateMealBudgetSummary(
  preparation: WeekPreparation,
  list: ActiveShoppingList,
  now: Date = new Date(),
): WeekPreparation {
  if (!preparation.generation) return preparation;
  const evaluation = evaluateMealBudget(
    preparation.budgetCents,
    preparation.mealBudgetCents,
    preparation.ingredients,
    list,
    now,
  );
  return {
    ...preparation,
    generation: {
      ...preparation.generation,
      mealPlanKnownCostCents: evaluation.mealPlanKnownCostCents,
      mealBudgetRemainingCents: evaluation.mealBudgetRemainingCents,
      nonMealReservedCents: evaluation.nonMealReservedCents,
      totalKnownWeekCostCents: evaluation.totalKnownWeekCostCents,
      mealBudgetStatus: evaluation.mealBudgetStatus,
      weekBudgetStatus: evaluation.weekBudgetStatus,
      isMealBudgetComplete: evaluation.isMealBudgetComplete,
    },
    status: finalStatus(preparation, preparation.ingredients, evaluation),
    updatedAt: now.toISOString(),
  };
}
