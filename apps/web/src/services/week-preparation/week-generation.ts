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
  WeekCategoryReadinessSummary,
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
  readinessByCategory: WeekCategoryReadinessSummary[];
  lowestCompleteMealPlanCostCents: number | null;
  lowestCompleteMealPlanCostReliable: boolean;
}

interface EvaluatedPlan {
  days: WeekPreparation["days"];
  ingredients: WeekIngredientRequirement[];
  evaluation: MealBudgetEvaluation;
}

function generationSummary(
  ingredients: WeekIngredientRequirement[],
  generatedAt: string,
  evaluation: MealBudgetEvaluation,
  candidateCount = 0,
  rejectedCount = 0,
  readinessByCategory: WeekCategoryReadinessSummary[] = [],
  lowestCompleteMealPlanCostCents: number | null = null,
  lowestCompleteMealPlanCostReliable = false,
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
    readinessByCategory,
    lowestCompleteMealPlanCostCents,
    lowestCompleteMealPlanCostReliable,
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

function evaluatePlan(
  days: WeekPreparation["days"],
  preparation: WeekPreparation,
  catalog: RecipeCatalog,
  readiness: Awaited<ReturnType<typeof evaluateRecipeReadiness>>,
  list: ActiveShoppingList,
  now: Date,
): EvaluatedPlan {
  const requirements = aggregateWeekIngredients(
    days,
    preparation.numberOfPeople!,
    catalog,
  );
  const ingredients = applyReadinessProducts(requirements, readiness);
  return {
    days,
    ingredients,
    evaluation: evaluateMealBudget(
      preparation.budgetCents,
      preparation.mealBudgetCents,
      ingredients,
      list,
      now,
    ),
  };
}

function recipeSelectionKey(days: WeekPreparation["days"]): string {
  return days.map((day) => day.recipeId ?? "free").join(":");
}

function candidateDays(
  preparation: WeekPreparation,
  catalog: RecipeCatalog,
  readyIds: ReadonlySet<string>,
): Map<number, RecipeCatalog["recipes"]> {
  return new Map(
    preparation.days.map((day) => [
      day.dayIndex,
      rankedReadyRecipesForDay(
        day,
        catalog.recipes,
        preparation.preferences,
        preparation.id,
        readyIds,
      ),
    ]),
  );
}

function readinessCoverage(
  preparation: WeekPreparation,
  catalog: RecipeCatalog,
  candidatesByDay: ReadonlyMap<number, RecipeCatalog["recipes"]>,
): WeekCategoryReadinessSummary[] {
  const categories = new Map<
    WeekCategoryReadinessSummary["category"],
    WeekCategoryReadinessSummary
  >();
  for (const day of preparation.days) {
    if (day.freeChoice || day.category === "freeChoice" || categories.has(day.category)) {
      continue;
    }
    const candidates = candidateRecipesForDays(
      [{ ...day, freeChoice: false }],
      catalog.recipes,
      preparation.preferences,
    );
    categories.set(day.category, {
      category: day.category,
      candidateCount: candidates.length,
      readyCount: candidatesByDay.get(day.dayIndex)?.length ?? 0,
    });
  }
  return [...categories.values()];
}

function combinationCount(
  preparation: WeekPreparation,
  candidatesByDay: ReadonlyMap<number, RecipeCatalog["recipes"]>,
  limit: number,
): number {
  let count = 1;
  for (const day of preparation.days) {
    if (day.freeChoice) continue;
    count *= candidatesByDay.get(day.dayIndex)?.length ?? 0;
    if (count > limit) return limit + 1;
  }
  return count;
}

function lowestCompletePlan(
  preparation: WeekPreparation,
  catalog: RecipeCatalog,
  readiness: Awaited<ReturnType<typeof evaluateRecipeReadiness>>,
  list: ActiveShoppingList,
  now: Date,
  candidatesByDay: ReadonlyMap<number, RecipeCatalog["recipes"]>,
): { plan: EvaluatedPlan | null; reliable: boolean; evaluatedCount: number } {
  const exactCombinationLimit = 25_000;
  const totalCombinations = combinationCount(
    preparation,
    candidatesByDay,
    exactCombinationLimit,
  );
  const cache = new Map<string, EvaluatedPlan>();
  let evaluatedCount = 0;

  const evaluate = (days: WeekPreparation["days"]): EvaluatedPlan => {
    const key = recipeSelectionKey(days);
    const cached = cache.get(key);
    if (cached) return cached;
    const result = evaluatePlan(days, preparation, catalog, readiness, list, now);
    cache.set(key, result);
    evaluatedCount += 1;
    return result;
  };
  const cheaper = (left: EvaluatedPlan | null, right: EvaluatedPlan): EvaluatedPlan =>
    !left || right.evaluation.mealPlanKnownCostCents < left.evaluation.mealPlanKnownCostCents
      ? right
      : left;

  if (totalCombinations === 0) {
    return { plan: null, reliable: true, evaluatedCount };
  }

  if (totalCombinations <= exactCombinationLimit) {
    let best: EvaluatedPlan | null = null;
    const visit = (dayOffset: number, selected: WeekPreparation["days"]): void => {
      if (dayOffset === preparation.days.length) {
        best = cheaper(best, evaluate(selected));
        return;
      }
      const day = preparation.days[dayOffset];
      if (day.freeChoice) {
        visit(dayOffset + 1, [
          ...selected,
          { ...day, recipeId: null, recipe: null, status: "freeChoice" },
        ]);
        return;
      }
      for (const recipe of candidatesByDay.get(day.dayIndex) ?? []) {
        visit(dayOffset + 1, [...selected, selectedDay(day, recipe)]);
      }
    };
    visit(0, []);
    return { plan: best, reliable: true, evaluatedCount };
  }

  const autoDays = preparation.days.filter((day) => !day.freeChoice);
  const seedOffsets = [0, 1, 2, 3];
  let best: EvaluatedPlan | null = null;

  const standaloneCheapest = new Map<number, RecipeCatalog["recipes"][number]>();
  for (const day of autoDays) {
    let cheapest: { recipe: RecipeCatalog["recipes"][number]; cost: number } | null = null;
    for (const recipe of candidatesByDay.get(day.dayIndex) ?? []) {
      const single = evaluate([selectedDay(day, recipe)]);
      const cost = single.evaluation.mealPlanKnownCostCents;
      if (!cheapest || cost < cheapest.cost) cheapest = { recipe, cost };
    }
    if (cheapest) standaloneCheapest.set(day.dayIndex, cheapest.recipe);
  }

  const seeds = [
    preparation.days.map((day) => {
      if (day.freeChoice) return { ...day, recipeId: null, recipe: null, status: "freeChoice" as const };
      const recipe = standaloneCheapest.get(day.dayIndex) ?? candidatesByDay.get(day.dayIndex)?.[0];
      return recipe ? selectedDay(day, recipe) : day;
    }),
    ...seedOffsets.map((offset) =>
      preparation.days.map((day) => {
        if (day.freeChoice) return { ...day, recipeId: null, recipe: null, status: "freeChoice" as const };
        const candidates = candidatesByDay.get(day.dayIndex) ?? [];
        const recipe = candidates[offset % Math.max(1, candidates.length)];
        return recipe ? selectedDay(day, recipe) : day;
      }),
    ),
  ];

  for (const seed of seeds) {
    let current = evaluate(seed);
    for (let pass = 0; pass < 4; pass += 1) {
      let improved = false;
      for (const day of autoDays) {
        let dayBest = current;
        for (const recipe of candidatesByDay.get(day.dayIndex) ?? []) {
          const nextDays = current.days.map((currentDay) =>
            currentDay.dayIndex === day.dayIndex
              ? selectedDay(currentDay, recipe)
              : currentDay,
          );
          dayBest = cheaper(dayBest, evaluate(nextDays));
        }
        if (dayBest !== current) {
          current = dayBest;
          improved = true;
        }
      }
      if (!improved) break;
    }
    best = cheaper(best, current);
  }

  return { plan: best, reliable: false, evaluatedCount };
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
  const candidatesByDay = candidateDays(preparation, catalog, readyIds);
  const readinessByCategory = readinessCoverage(
    preparation,
    catalog,
    candidatesByDay,
  );
  const autoDays = preparation.days.filter((day) => !day.freeChoice);
  const missingReadyCategory = autoDays.some((day) =>
    (candidatesByDay.get(day.dayIndex)?.length ?? 0) === 0
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
      readinessByCategory,
      lowestCompleteMealPlanCostCents: null,
      lowestCompleteMealPlanCostReliable: missingReadyCategory,
    };
  }

  const lowest = lowestCompletePlan(
    preparation,
    catalog,
    readiness,
    list,
    now,
    candidatesByDay,
  );

  type State = {
    days: WeekPreparation["days"];
    rank: number;
    duplicates: number;
    mealCostCents: number;
  };
  let states: State[] = [{ days: [], rank: 0, duplicates: 0, mealCostCents: 0 }];
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
    const candidates = candidatesByDay.get(day.dayIndex) ?? [];
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
          mealCostCents: evaluation.mealPlanKnownCostCents,
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
    const uniqueStates = [...unique.values()];
    const preferenceLane = uniqueStates
      .toSorted((left, right) => left.duplicates - right.duplicates || left.rank - right.rank)
      .slice(0, beamWidth);
    const costLane = uniqueStates
      .toSorted((left, right) =>
        left.mealCostCents - right.mealCostCents ||
        left.duplicates - right.duplicates ||
        left.rank - right.rank
      )
      .slice(0, beamWidth);
    const retained = new Map<string, State>();
    for (const state of [...preferenceLane, ...costLane]) {
      retained.set(recipeSelectionKey(state.days), state);
    }
    states = [...retained.values()];
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

  let best = evaluated.toSorted((left, right) => {
    const leftWeekPenalty = left.evaluation.weekBudgetStatus === "overBudget" ? 1 : 0;
    const rightWeekPenalty = right.evaluation.weekBudgetStatus === "overBudget" ? 1 : 0;
    return leftWeekPenalty - rightWeekPenalty || left.duplicates - right.duplicates || left.rank - right.rank;
  })[0];

  if (!best && lowest.plan && mealBudgetAllowsPlan(lowest.plan.evaluation)) {
    best = {
      ...lowest.plan,
      rank: Number.MAX_SAFE_INTEGER,
      duplicates: 0,
      mealCostCents: lowest.plan.evaluation.mealPlanKnownCostCents,
    };
  }

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
      readinessByCategory,
      lowestCompleteMealPlanCostCents:
        lowest.plan?.evaluation.mealPlanKnownCostCents ?? null,
      lowestCompleteMealPlanCostReliable: lowest.reliable,
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
    readinessByCategory,
    lowestCompleteMealPlanCostCents:
      lowest.plan?.evaluation.mealPlanKnownCostCents ?? best.evaluation.mealPlanKnownCostCents,
    lowestCompleteMealPlanCostReliable: lowest.reliable,
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
        selection.readinessByCategory,
        selection.lowestCompleteMealPlanCostCents,
        selection.lowestCompleteMealPlanCostReliable,
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
    generation: {
      ...generationSummary(ingredients, generatedAt, mealBudget),
      readinessByCategory: preparation.generation?.readinessByCategory,
      lowestCompleteMealPlanCostCents:
        preparation.generation?.lowestCompleteMealPlanCostCents,
      lowestCompleteMealPlanCostReliable:
        preparation.generation?.lowestCompleteMealPlanCostReliable,
    },
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
  const hasNoAutomaticSelection = preparation.days.every(
    (day) => day.freeChoice || day.recipeId === null,
  );
  if (hasNoAutomaticSelection && preparation.generation) {
    return generatePreparedWeek(
      { ...preparation, status: "readyForGeneration" },
      recipeRepository,
      catalogRepository,
      now,
      list,
    );
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
