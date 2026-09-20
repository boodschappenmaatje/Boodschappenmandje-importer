import { calculateBudget } from "@/services/budget/budget-engine";
import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import { aggregateWeekIngredients } from "@/services/week-preparation/ingredient-aggregation";
import { matchCustomDishes } from "@/services/week-preparation/custom-dish";
import {
  applyManualProductToRequirement,
  applyProductToRequirement,
  combinedProductPurchaseQuantity,
  isReliableIngredientMatch,
} from "@/services/week-preparation/product-matching";
import {
  applyReadinessProducts,
  evaluateRecipeReadiness,
  readyRecipeIds,
} from "@/services/week-preparation/recipe-readiness";
import {
  createPersistentRecipeReadinessRepository,
  resolveRecipeReadiness,
} from "@/services/week-preparation/persistent-readiness-cache";
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
import type { WeekPlanningSnapshotCache } from "@/services/week-preparation/planning-cache";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type {
  WeekGenerationSummary,
  WeekCategoryReadinessSummary,
  WeekIngredientRequirement,
  WeekBudgetDecision,
  WeekBudgetMutation,
  WeekPreparation,
  WeekPreparationStatus,
} from "@/types/week-preparation";

const EMPTY_LIST: ActiveShoppingList = {
  schemaVersion: 2,
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

export interface WeekGenerationMetrics {
  totalMs: number;
  catalogMs: number;
  cacheLookupMs: number;
  readinessMs: number;
  selectionMs: number;
  resultCacheHit: boolean;
  readinessCacheHits: number;
  readinessCacheMisses: number;
}

export interface WeekGenerationOptions {
  cache?: WeekPlanningSnapshotCache;
  onMetrics?: (metrics: WeekGenerationMetrics) => void;
}

function monotonicNow(): number {
  return globalThis.performance?.now() ?? Date.now();
}

function weekGenerationSnapshotKey(
  preparation: WeekPreparation,
  list: ActiveShoppingList,
): string {
  return JSON.stringify({
    version: 1,
    weekPreparationId: preparation.id,
    numberOfPeople: preparation.numberOfPeople,
    numberOfDays: preparation.numberOfDays,
    budgetCents: preparation.budgetCents,
    mealBudgetCents: preparation.mealBudgetCents,
    days: preparation.days.map((day) => [
      day.dayIndex,
      day.category,
      day.freeChoice,
    ]),
    preferences: preparation.preferences,
    list: list.items
      .map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        price: item.price
          ? [
              item.price.amount,
              item.price.isOffer,
              item.price.updatedAt,
              item.price.freshness,
              item.price.validFrom ?? null,
              item.price.validUntil ?? null,
            ]
          : null,
      }))
      .toSorted((left, right) =>
        left.productId.localeCompare(right.productId),
      ),
  });
}

function manualAdditionRequirement(
  preparation: WeekPreparation,
  dayIndex: number,
  addition: WeekPreparation["customizations"][number]["manualProductAdditions"][number],
  product: Awaited<ReturnType<CatalogRepository["getByIds"]>>["products"][number] | null,
): WeekIngredientRequirement | null {
  const day = preparation.days.find((item) => item.dayIndex === dayIndex);
  if (!day?.recipe) return null;
  const base: WeekIngredientRequirement = {
    ingredientId: addition.id,
    sourceKey: "manualProductAddition",
    name: product?.name ?? addition.product.name,
    unit: "piece",
    optional: false,
    servingsBase: 1,
    kind: "ingredient",
    brandConstraint: null,
    requiredQuantity: addition.quantity,
    purchaseQuantity: addition.quantity,
    packageCapacity: 1,
    usedIn: [{
      recipeId: day.recipe.id,
      recipeName: day.recipe.name,
      dayIndex,
      requiredQuantity: addition.quantity,
    }],
    product: addition.product,
    price: addition.price,
    productMatchMissing: false,
    packageCalculationMissing: false,
  };
  return product
    ? applyManualProductToRequirement(base, product, addition.quantity)
    : {
        ...base,
        product: null,
        price: null,
        productMatchMissing: true,
      };
}

async function applyStoredCustomizations(
  preparation: WeekPreparation,
  ingredients: WeekIngredientRequirement[],
  catalog: RecipeCatalog,
  catalogRepository: CatalogRepository,
): Promise<WeekIngredientRequirement[]> {
  const overrides = preparation.customizations.flatMap((customization) =>
    customization.productOverrides.map((override) => ({
      ...override,
      dayIndex: customization.dayIndex,
    })),
  );
  const additions = preparation.customizations.flatMap((customization) =>
    customization.manualProductAdditions.map((addition) => ({
      ...addition,
      dayIndex: customization.dayIndex,
    })),
  );
  if (overrides.length === 0 && additions.length === 0) return ingredients;

  const productIds = [...new Set([
    ...overrides.map((override) => override.productId),
    ...additions.map((addition) => addition.product.productId),
  ])];
  const result = await catalogRepository.getByIds(productIds);
  const products = new Map(result.products.map((product) => [product.id, product]));
  const ingredientDefinitions = new Map(
    catalog.ingredients.map((ingredient) => [ingredient.id, ingredient]),
  );

  const overridden = ingredients.flatMap((requirement) => {
    const applicable = overrides.filter(
      (override) =>
        override.ingredientId === requirement.ingredientId &&
        requirement.usedIn.some((use) => use.dayIndex === override.dayIndex),
    );
    if (applicable.length === 0) return [requirement];

    const ingredient = ingredientDefinitions.get(requirement.ingredientId);
    const overrideByDay = new Map(
      applicable.map((override) => [override.dayIndex, override]),
    );
    const groups = Map.groupBy(
      requirement.usedIn,
      (use) => overrideByDay.get(use.dayIndex)?.productId ?? "base",
    );

    return [...groups.entries()].map(([productId, uses]) => {
      const requiredQuantity = uses.reduce(
        (total, use) => total + use.requiredQuantity,
        0,
      );
      const scoped = { ...requirement, requiredQuantity, usedIn: uses };
      if (productId === "base") {
        return {
          ...scoped,
          purchaseQuantity: scoped.packageCapacity
            ? Math.max(1, Math.ceil(requiredQuantity / scoped.packageCapacity))
            : null,
        };
      }
      const override = overrideByDay.get(uses[0]!.dayIndex)!;
      const product = products.get(productId) ?? null;
      if (override.selectionSource === "manualSearch") {
        const quantity = override.quantity ?? 1;
        if (
          product &&
          product.supermarket === "Hoogvliet" &&
          product.isAvailable !== false
        ) {
          return applyManualProductToRequirement(scoped, product, quantity);
        }
        return applyProductToRequirement(scoped, null);
      }
      const validProduct =
        ingredient &&
        product &&
        isReliableIngredientMatch(
          ingredient,
          product,
          requirement.brandConstraint,
        )
          ? product
          : null;
      return applyProductToRequirement(scoped, validProduct);
    });
  });

  return [
    ...overridden,
    ...additions.flatMap((addition) => {
      const requirement = manualAdditionRequirement(
        preparation,
        addition.dayIndex,
        addition,
        (() => {
          const product = products.get(addition.product.productId) ?? null;
          return product?.supermarket === "Hoogvliet" && product.isAvailable !== false
            ? product
            : null;
        })(),
      );
      return requirement ? [requirement] : [];
    }),
  ];
}

interface ApprovalCostSnapshot {
  isMealBudgetComplete: boolean;
  mealPlanKnownCostCents: number;
  totalKnownWeekCostCents: number;
}

interface ScopedApproval {
  decision: Extract<WeekBudgetDecision, { mode: "userApprovedBudgetOverride" }>;
  mutationMatches: boolean;
  currentMutation: WeekBudgetMutation | null;
}

function mutationMatches(
  expected: WeekBudgetMutation,
  actual: WeekBudgetMutation,
): boolean {
  if (
    expected.kind !== actual.kind ||
    expected.weekPreparationId !== actual.weekPreparationId ||
    expected.dayIndex !== actual.dayIndex
  ) {
    return false;
  }
  if (expected.kind === "replaceRecipe" && actual.kind === "replaceRecipe") {
    return expected.recipeId === actual.recipeId;
  }
  if (expected.kind === "addToMeal" && actual.kind === "addToMeal") {
    return (
      expected.productId === actual.productId &&
      expected.quantity === actual.quantity
    );
  }
  return (
    expected.kind === "replaceIngredient" &&
    actual.kind === "replaceIngredient" &&
    expected.ingredientId === actual.ingredientId &&
    expected.productId === actual.productId &&
    expected.quantity === actual.quantity
  );
}

function scopedApprovals(preparation: WeekPreparation): ScopedApproval[] {
  return preparation.customizations.flatMap((customization) => {
    const approvals: ScopedApproval[] = [];
    if (customization.recipeBudgetDecision.mode === "userApprovedBudgetOverride") {
      const currentMutation: WeekBudgetMutation | null =
        customization.replacementRecipe === null
          ? null
          : {
              kind: "replaceRecipe",
              weekPreparationId: preparation.id,
              dayIndex: customization.dayIndex,
              recipeId: customization.replacementRecipe.id,
            };
      approvals.push({
        decision: customization.recipeBudgetDecision,
        mutationMatches: currentMutation !== null &&
          mutationMatches(
            customization.recipeBudgetDecision.approvedMutation,
            currentMutation,
          ),
        currentMutation,
      });
    }
    for (const override of customization.productOverrides) {
      if (override.budgetDecision.mode !== "userApprovedBudgetOverride") continue;
      const currentMutation: WeekBudgetMutation | null = override.quantity === null
        ? null
        : {
            kind: "replaceIngredient",
            weekPreparationId: preparation.id,
            dayIndex: customization.dayIndex,
            ingredientId: override.ingredientId,
            productId: override.productId,
            quantity: override.quantity,
          };
      approvals.push({
        decision: override.budgetDecision,
        mutationMatches:
          override.applicationMode === "explicitUserChoice" &&
          currentMutation !== null &&
          mutationMatches(override.budgetDecision.approvedMutation, currentMutation),
        currentMutation,
      });
    }
    for (const addition of customization.manualProductAdditions) {
      if (addition.budgetDecision.mode !== "userApprovedBudgetOverride") continue;
      const currentMutation: WeekBudgetMutation = {
        kind: "addToMeal",
        weekPreparationId: preparation.id,
        dayIndex: customization.dayIndex,
        productId: addition.product.productId,
        quantity: addition.quantity,
      };
      approvals.push({
        decision: addition.budgetDecision,
        mutationMatches:
          addition.applicationMode === "explicitUserChoice" &&
          mutationMatches(addition.budgetDecision.approvedMutation, currentMutation),
        currentMutation,
      });
    }
    return approvals;
  });
}

function approvedBudgetOverrideAllowsPlan(
  preparation: WeekPreparation,
  evaluation: ApprovalCostSnapshot,
): boolean {
  if (!evaluation.isMealBudgetComplete) return false;
  const latest = scopedApprovals(preparation).toSorted(
    (left, right) =>
      right.decision.approvedAt.localeCompare(left.decision.approvedAt),
  )[0];
  return Boolean(
    latest?.mutationMatches &&
    preparation.mealBudgetCents === latest.decision.approvedMealBudgetCents &&
    preparation.budgetCents === latest.decision.approvedWeekBudgetCents &&
    evaluation.mealPlanKnownCostCents <=
      latest.decision.approvedMealPlanCostCents &&
    evaluation.totalKnownWeekCostCents <=
      latest.decision.approvedTotalWeekCostCents,
  );
}

export function hasValidUserApprovedBudgetOverride(
  preparation: WeekPreparation,
): boolean {
  const generation = preparation.generation;
  return Boolean(
    generation && approvedBudgetOverrideAllowsPlan(preparation, generation),
  );
}

export function hasStoredUserApprovedBudgetOverride(
  preparation: WeekPreparation,
): boolean {
  return scopedApprovals(preparation).length > 0;
}

export interface BudgetOverrideReapprovalPreview {
  mutation: WeekBudgetMutation;
  previouslyApprovedMealPlanCostCents: number;
  currentMealPlanCostCents: number;
  mealPlanDifferenceCents: number;
  mealBudgetCents: number | null;
  mealBudgetOverageCents: number;
  previouslyApprovedTotalWeekCostCents: number;
  currentTotalWeekCostCents: number;
  totalWeekDifferenceCents: number;
  weekBudgetCents: number | null;
  weekBudgetOverageCents: number;
  weekBudgetRemainingCents: number | null;
}

export function budgetOverrideReapprovalPreview(
  preparation: WeekPreparation,
): BudgetOverrideReapprovalPreview | null {
  const generation = preparation.generation;
  if (
    !generation?.isMealBudgetComplete ||
    (generation.mealBudgetStatus !== "overMealBudget" &&
      generation.weekBudgetStatus !== "overBudget") ||
    approvedBudgetOverrideAllowsPlan(preparation, generation)
  ) {
    return null;
  }
  const latest = scopedApprovals(preparation).toSorted(
    (left, right) =>
      right.decision.approvedAt.localeCompare(left.decision.approvedAt),
  )[0];
  if (!latest?.currentMutation) return null;
  const mealBudgetOverageCents = preparation.mealBudgetCents === null
    ? 0
    : Math.max(
        0,
        generation.mealPlanKnownCostCents - preparation.mealBudgetCents,
      );
  const weekBudgetOverageCents = preparation.budgetCents === null
    ? 0
    : Math.max(
        0,
        generation.totalKnownWeekCostCents - preparation.budgetCents,
      );
  return {
    mutation: latest.currentMutation,
    previouslyApprovedMealPlanCostCents:
      latest.decision.approvedMealPlanCostCents,
    currentMealPlanCostCents: generation.mealPlanKnownCostCents,
    mealPlanDifferenceCents:
      generation.mealPlanKnownCostCents -
      latest.decision.approvedMealPlanCostCents,
    mealBudgetCents: preparation.mealBudgetCents,
    mealBudgetOverageCents,
    previouslyApprovedTotalWeekCostCents:
      latest.decision.approvedTotalWeekCostCents,
    currentTotalWeekCostCents: generation.totalKnownWeekCostCents,
    totalWeekDifferenceCents:
      generation.totalKnownWeekCostCents -
      latest.decision.approvedTotalWeekCostCents,
    weekBudgetCents: preparation.budgetCents,
    weekBudgetOverageCents,
    weekBudgetRemainingCents: preparation.budgetCents === null
      ? null
      : Math.max(
          0,
          preparation.budgetCents - generation.totalKnownWeekCostCents,
        ),
  };
}

export function reapproveCurrentBudgetOverride(
  preparation: WeekPreparation,
  preview: BudgetOverrideReapprovalPreview,
  now: Date = new Date(),
): WeekPreparation | null {
  const currentPreview = budgetOverrideReapprovalPreview(preparation);
  if (
    !currentPreview ||
    !mutationMatches(currentPreview.mutation, preview.mutation) ||
    currentPreview.currentMealPlanCostCents !== preview.currentMealPlanCostCents ||
    currentPreview.currentTotalWeekCostCents !== preview.currentTotalWeekCostCents
  ) {
    return null;
  }
  const decision: WeekBudgetDecision = {
    mode: "userApprovedBudgetOverride",
    approvedAt: now.toISOString(),
    approvedMealPlanCostCents: currentPreview.currentMealPlanCostCents,
    approvedTotalWeekCostCents: currentPreview.currentTotalWeekCostCents,
    approvedMealBudgetCents: preparation.mealBudgetCents,
    approvedWeekBudgetCents: preparation.budgetCents,
    approvedMutation: currentPreview.mutation,
  };
  const customizations = preparation.customizations.map((customization) => {
    const mutation = currentPreview.mutation;
    if (customization.dayIndex !== mutation.dayIndex) {
      return customization;
    }
    if (mutation.kind === "replaceRecipe") {
      return { ...customization, recipeBudgetDecision: decision };
    }
    if (mutation.kind === "replaceIngredient") {
      return {
        ...customization,
        productOverrides: customization.productOverrides.map((override) =>
          override.ingredientId === mutation.ingredientId &&
          override.productId === mutation.productId &&
          override.quantity === mutation.quantity
            ? { ...override, budgetDecision: decision }
            : override,
        ),
      };
    }
    return {
      ...customization,
      manualProductAdditions: customization.manualProductAdditions.map(
        (addition) =>
          addition.product.productId === mutation.productId &&
          addition.quantity === mutation.quantity
            ? { ...addition, budgetDecision: decision }
            : addition,
      ),
    };
  });
  return { ...preparation, customizations, updatedAt: now.toISOString() };
}

function budgetAllowsPreparedWeek(
  preparation: WeekPreparation,
  evaluation: MealBudgetEvaluation,
): boolean {
  const approvedChoiceNeedsValidation =
    hasStoredUserApprovedBudgetOverride(preparation) &&
    (evaluation.mealBudgetStatus === "overMealBudget" ||
      evaluation.weekBudgetStatus === "overBudget");
  if (approvedChoiceNeedsValidation) {
    return approvedBudgetOverrideAllowsPlan(preparation, evaluation);
  }
  return mealBudgetAllowsPlan(evaluation);
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

function duplicateRecipeCount(days: WeekPreparation["days"]): number {
  const recipeIds = days
    .map((day) => day.recipeId)
    .filter((recipeId): recipeId is string => recipeId !== null);
  return recipeIds.length - new Set(recipeIds).size;
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
  candidatesByDay: ReadonlyMap<number, RecipeCatalog["recipes"]>,
  evaluate: (days: WeekPreparation["days"]) => EvaluatedPlan,
): { plan: EvaluatedPlan | null; reliable: boolean } {
  const exactCombinationLimit = 25_000;
  const totalCombinations = combinationCount(
    preparation,
    candidatesByDay,
    exactCombinationLimit,
  );
  const cheaper = (left: EvaluatedPlan | null, right: EvaluatedPlan): EvaluatedPlan =>
    !left || right.evaluation.mealPlanKnownCostCents < left.evaluation.mealPlanKnownCostCents
      ? right
      : left;

  if (totalCombinations === 0) {
    return { plan: null, reliable: true };
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
    return { plan: best, reliable: true };
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

  return { plan: best, reliable: false };
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
    evaluation !== undefined && !budgetAllowsPreparedWeek(preparation, evaluation);
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

  type State = {
    days: WeekPreparation["days"];
    rank: number;
    duplicates: number;
    mealCostCents: number;
  };
  let candidateCount = 0;
  let rejectedCount = 0;
  const beamWidth = 192;
  const evaluatedPlanCache = new Map<string, EvaluatedPlan>();

  const evaluateSelection = (days: WeekPreparation["days"]): EvaluatedPlan => {
    const key = recipeSelectionKey(days);
    const cached = evaluatedPlanCache.get(key);
    if (cached) return cached;
    const evaluated = evaluatePlan(days, preparation, catalog, readiness, list, now);
    evaluatedPlanCache.set(key, evaluated);
    return evaluated;
  };

  const lowest = lowestCompletePlan(
    preparation,
    candidatesByDay,
    evaluateSelection,
  );

  const standaloneCostByRecipe = new Map<string, number>();
  const standaloneCost = (
    day: WeekPreparation["days"][number],
    recipe: RecipeCatalog["recipes"][number],
  ): number => {
    const cached = standaloneCostByRecipe.get(recipe.id);
    if (cached !== undefined) return cached;
    const cost = evaluateSelection([selectedDay(day, recipe)])
      .evaluation.mealPlanKnownCostCents;
    standaloneCostByRecipe.set(recipe.id, cost);
    return cost;
  };

  const selectionRank = (days: WeekPreparation["days"]): number =>
    days.reduce((total, day) => {
      if (!day.recipeId) return total;
      const rank = (candidatesByDay.get(day.dayIndex) ?? [])
        .findIndex((recipe) => recipe.id === day.recipeId);
      return total + Math.max(0, rank);
    }, 0);

  const uniqueVariationSeeds = (): State[] => {
    const dayOrders = [
      autoDays,
      [...autoDays].reverse(),
      [...autoDays].toSorted((left, right) =>
        (candidatesByDay.get(left.dayIndex)?.length ?? 0) -
        (candidatesByDay.get(right.dayIndex)?.length ?? 0) ||
        left.dayIndex - right.dayIndex
      ),
    ];
    const seeds = new Map<string, WeekPreparation["days"]>();

    for (const dayOrder of dayOrders) {
      for (const sortByCost of [false, true]) {
        for (const offset of [0, 1, 2, 3]) {
          const selectedByDay = new Map<number, RecipeCatalog["recipes"][number]>();
          const usedRecipeIds = new Set<string>();
          for (const day of dayOrder) {
            const ranked = candidatesByDay.get(day.dayIndex) ?? [];
            const ordered = sortByCost
              ? ranked.toSorted((left, right) =>
                  standaloneCost(day, left) - standaloneCost(day, right) ||
                  ranked.indexOf(left) - ranked.indexOf(right)
                )
              : ranked;
            const rotated = [
              ...ordered.slice(offset % Math.max(1, ordered.length)),
              ...ordered.slice(0, offset % Math.max(1, ordered.length)),
            ];
            const recipe = rotated.find((candidate) => !usedRecipeIds.has(candidate.id));
            if (!recipe) break;
            selectedByDay.set(day.dayIndex, recipe);
            usedRecipeIds.add(recipe.id);
          }
          if (selectedByDay.size !== autoDays.length) continue;
          const days = preparation.days.map((day) => {
            if (day.freeChoice) {
              return { ...day, recipeId: null, recipe: null, status: "freeChoice" as const };
            }
            return selectedDay(day, selectedByDay.get(day.dayIndex)!);
          });
          seeds.set(recipeSelectionKey(days), days);
        }
      }
    }

    const improved = new Map<string, State>();
    for (const seed of seeds.values()) {
      let current = seed;
      let currentEvaluation = evaluateSelection(current);
      for (let pass = 0; pass < 3; pass += 1) {
        let changed = false;
        for (const day of autoDays) {
          const usedByOtherDays = new Set(
            current
              .filter((currentDay) => currentDay.dayIndex !== day.dayIndex)
              .map((currentDay) => currentDay.recipeId)
              .filter((recipeId): recipeId is string => recipeId !== null),
          );
          let bestDays = current;
          let bestEvaluation = currentEvaluation;
          for (const recipe of candidatesByDay.get(day.dayIndex) ?? []) {
            if (usedByOtherDays.has(recipe.id)) continue;
            const nextDays = current.map((currentDay) =>
              currentDay.dayIndex === day.dayIndex
                ? selectedDay(currentDay, recipe)
                : currentDay
            );
            const nextEvaluation = evaluateSelection(nextDays);
            if (
              nextEvaluation.evaluation.mealPlanKnownCostCents <
              bestEvaluation.evaluation.mealPlanKnownCostCents
            ) {
              bestDays = nextDays;
              bestEvaluation = nextEvaluation;
            }
          }
          if (bestDays !== current) {
            current = bestDays;
            currentEvaluation = bestEvaluation;
            changed = true;
          }
        }
        if (!changed) break;
      }
      if (!mealBudgetAllowsPlan(currentEvaluation.evaluation)) continue;
      const state: State = {
        days: current,
        rank: selectionRank(current),
        duplicates: 0,
        mealCostCents: currentEvaluation.evaluation.mealPlanKnownCostCents,
      };
      improved.set(recipeSelectionKey(current), state);
    }
    return [...improved.values()];
  };

  const searchWithDuplicateLimit = (duplicateLimit: number): State[] => {
    let states: State[] = [{ days: [], rank: 0, duplicates: 0, mealCostCents: 0 }];

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
          const duplicates = state.duplicates + (usedIds.has(recipe.id) ? 1 : 0);
          if (duplicates > duplicateLimit) return;
          candidateCount += 1;
          const days = [...state.days, selectedDay(day, recipe)];
          nextStates.push({
            days,
            rank: state.rank + rank,
            duplicates,
            mealCostCents: state.mealCostCents + standaloneCost(day, recipe),
          });
        });
      }
      const unique = new Map<string, State>();
      for (const state of nextStates) {
        const signature = recipeSelectionKey(state.days);
        const current = unique.get(signature);
        if (
          !current ||
          state.duplicates < current.duplicates ||
          (state.duplicates === current.duplicates && state.rank < current.rank)
        ) {
          unique.set(signature, state);
        }
      }
      const uniqueStates = [...unique.values()];
      const preferenceLane = uniqueStates
        .toSorted((left, right) =>
          left.duplicates - right.duplicates ||
          left.rank - right.rank ||
          left.mealCostCents - right.mealCostCents
        )
        .slice(0, beamWidth);
      const variationCostLane = uniqueStates
        .toSorted((left, right) =>
          left.duplicates - right.duplicates ||
          left.mealCostCents - right.mealCostCents ||
          left.rank - right.rank
        )
        .slice(0, beamWidth);
      const costLane = uniqueStates
        .toSorted((left, right) =>
          left.mealCostCents - right.mealCostCents ||
          left.duplicates - right.duplicates ||
          left.rank - right.rank
        )
        .slice(0, beamWidth);
      const retained = new Map<string, State>();
      for (const state of [...preferenceLane, ...variationCostLane, ...costLane]) {
        retained.set(recipeSelectionKey(state.days), state);
      }
      states = [...retained.values()];
      if (states.length === 0) break;
    }

    const completed = states.filter((state) => state.days.length === preparation.days.length);
    if (duplicateLimit !== 0 || completed.length > 0) return completed;
    const unique = new Map(
      completed.map((state) => [recipeSelectionKey(state.days), state]),
    );
    for (const state of uniqueVariationSeeds()) {
      unique.set(recipeSelectionKey(state.days), state);
    }
    return [...unique.values()];
  };

  type EvaluatedState = State & EvaluatedPlan;
  let evaluated: EvaluatedState[] = [];
  const maximumDuplicates = Math.max(0, autoDays.length - 1);
  for (let duplicateLimit = 0; duplicateLimit <= maximumDuplicates; duplicateLimit += 1) {
    const states = searchWithDuplicateLimit(duplicateLimit);
    evaluated = states.flatMap((state) => {
      const { ingredients, evaluation } = evaluateSelection(state.days);
      if (!mealBudgetAllowsPlan(evaluation)) {
        rejectedCount += 1;
        return [];
      }
      return [{ ...state, ingredients, evaluation }];
    });
    if (evaluated.length > 0) break;
  }

  let best = evaluated.toSorted((left, right) => {
    const leftWeekPenalty = left.evaluation.weekBudgetStatus === "overBudget" ? 1 : 0;
    const rightWeekPenalty = right.evaluation.weekBudgetStatus === "overBudget" ? 1 : 0;
    return leftWeekPenalty - rightWeekPenalty || left.duplicates - right.duplicates || left.rank - right.rank;
  })[0];

  if (!best && lowest.plan && mealBudgetAllowsPlan(lowest.plan.evaluation)) {
    best = {
      ...lowest.plan,
      rank: Number.MAX_SAFE_INTEGER,
      duplicates: duplicateRecipeCount(lowest.plan.days),
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
  options: WeekGenerationOptions = {},
): Promise<WeekPreparation> {
  const startedAt = monotonicNow();
  if (
    !["readyForGeneration", "generationError"].includes(preparation.status) ||
    preparation.numberOfPeople === null
  ) {
    return preparation;
  }

  const explicitDays = preparation.days.filter((day) => day.category === "freeChoice" && day.recipe);
  if (explicitDays.length) {
    const automatic = await generatePreparedWeek({
      ...preparation,
      days: preparation.days.map((day) => explicitDays.includes(day) ? { ...day, freeChoice: true, recipeId: null, recipe: null, customDish: undefined } : day),
    }, recipeRepository, catalogRepository, now, list, options);
    return (await revalidatePreparedWeek({ ...automatic,
      days: automatic.days.map((day) => explicitDays.find((chosen) => chosen.dayIndex === day.dayIndex) ?? day),
      customizations: preparation.customizations,
    }, recipeRepository, catalogRepository, now, list)).preparation;
  }
  const catalogStartedAt = monotonicNow();
  const loadedCatalog = await recipeRepository.loadCatalog();
  const catalog = options.cache?.prepareCatalog(loadedCatalog, () => ({
    ...loadedCatalog,
    ingredients: enrichIngredientsForMealMixes(loadedCatalog.ingredients),
  })) ?? {
    ...loadedCatalog,
    ingredients: enrichIngredientsForMealMixes(loadedCatalog.ingredients),
  };
  const catalogMs = monotonicNow() - catalogStartedAt;
  const cacheLookupStartedAt = monotonicNow();
  const snapshotKey = weekGenerationSnapshotKey(preparation, list);
  const cachedWeek = options.cache?.getWeek(loadedCatalog, snapshotKey) ?? null;
  const cacheLookupMs = monotonicNow() - cacheLookupStartedAt;
  if (cachedWeek) {
    options.onMetrics?.({
      totalMs: monotonicNow() - startedAt,
      catalogMs,
      cacheLookupMs,
      readinessMs: 0,
      selectionMs: 0,
      resultCacheHit: true,
      readinessCacheHits: 0,
      readinessCacheMisses: 0,
    });
    return cachedWeek;
  }

  const candidates = candidateRecipesForDays(
    preparation.days,
    catalog.recipes,
    preparation.preferences,
  );
  const readinessStartedAt = monotonicNow();
  const cachedReadiness = options.cache
    ? await options.cache.evaluateReadiness(
        loadedCatalog,
        candidates,
        preparation.numberOfPeople,
        catalog,
        catalogRepository,
      )
    : {
        gate: await evaluateRecipeReadiness(
          candidates,
          preparation.numberOfPeople,
          catalog,
          catalogRepository,
        ),
        hitCount: 0,
        missCount: candidates.length,
      };
  const readiness = cachedReadiness.gate;
  const readinessMs = monotonicNow() - readinessStartedAt;
  const selectionStartedAt = monotonicNow();
  const selection = selectWeekWithinMealBudget(
    preparation,
    catalog,
    readiness,
    list,
    now,
  );
  const selectionMs = monotonicNow() - selectionStartedAt;
  const { days, ingredients } = selection;
  const generatedAt = now.toISOString();
  const prepared = {
    ...preparation,
    days,
    ingredients,
  };

  const generated: WeekPreparation = {
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
  options.cache?.setWeek(loadedCatalog, snapshotKey, generated);
  options.onMetrics?.({
    totalMs: monotonicNow() - startedAt,
    catalogMs,
    cacheLookupMs,
    readinessMs,
    selectionMs,
    resultCacheHit: false,
    readinessCacheHits: cachedReadiness.hitCount,
    readinessCacheMisses: cachedReadiness.missCount,
  });
  return generated;
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
  const readiness = (await resolveRecipeReadiness(
    selectedRecipes,
    preparation.numberOfPeople,
    catalog,
    catalogRepository,
    createPersistentRecipeReadinessRepository(),
  )).gate;
  const readyIds = readyRecipeIds(readiness);
  const hasDayGap = preparation.days.some(
    (day) =>
      !day.freeChoice &&
      (!day.recipeId || (!day.customDish && !readyIds.has(day.recipeId))),
  );
  const requirements = aggregateWeekIngredients(
    preparation.days,
    preparation.numberOfPeople,
    catalog,
  );
  const ingredients = await applyStoredCustomizations(
    preparation,
    [...applyReadinessProducts(requirements, readiness), ...await matchCustomDishes(preparation, catalog, catalogRepository)],
    catalog,
    catalogRepository,
  );
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
      budgetAllowsPreparedWeek(next, mealBudget),
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

/**
 * Rebuilds every derived week value after a deliberate, already validated
 * selection change. Keeping this here ensures PWA 12 uses the exact same
 * package aggregation and integer-cent budget engine as normal generation.
 */
export function rebuildPreparedWeekSelection(
  preparation: WeekPreparation,
  days: WeekPreparation["days"],
  ingredients: WeekIngredientRequirement[],
  list: ActiveShoppingList = EMPTY_LIST,
  now: Date = new Date(),
): WeekPreparation {
  const evaluation = evaluateMealBudget(
    preparation.budgetCents,
    preparation.mealBudgetCents,
    ingredients,
    list,
    now,
  );
  const next = { ...preparation, days, ingredients };
  return {
    ...next,
    generation: {
      ...generationSummary(ingredients, now.toISOString(), evaluation),
      readinessByCategory: preparation.generation?.readinessByCategory,
      lowestCompleteMealPlanCostCents:
        preparation.generation?.lowestCompleteMealPlanCostCents,
      lowestCompleteMealPlanCostReliable:
        preparation.generation?.lowestCompleteMealPlanCostReliable,
    },
    status: finalStatus(next, ingredients, evaluation),
    updatedAt: now.toISOString(),
  };
}
