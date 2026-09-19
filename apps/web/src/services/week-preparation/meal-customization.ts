import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import { PRICE_STALE_AFTER_DAYS } from "@/services/catalog/price";
import { removeMealPlanContributionsForWeek } from "@/services/shopping-list/shopping-list";
import { aggregateWeekIngredients } from "@/services/week-preparation/ingredient-aggregation";
import { evaluateMealBudget, mealBudgetAllowsPlan } from "@/services/week-preparation/meal-budget";
import { enrichIngredientsForMealMixes } from "@/services/week-preparation/meal-mix-profiles";
import {
  applyProductToRequirement,
  applyManualProductToRequirement,
  isReliableIngredientMatch,
  productPackageCapacity,
} from "@/services/week-preparation/product-matching";
import {
  applyReadinessProducts,
  readyRecipeIds,
  type RecipeReadinessGateResult,
} from "@/services/week-preparation/recipe-readiness";
import {
  createPersistentRecipeReadinessRepository,
  resolveRecipeReadiness,
} from "@/services/week-preparation/persistent-readiness-cache";
import type {
  RecipeCatalog,
  RecipeIngredientDefinition,
  RecipeRepository,
} from "@/services/week-preparation/recipe-repository";
import {
  rankedReadyRecipesForDay,
  suitableRecipes,
} from "@/services/week-preparation/recipe-selection";
import { PLANNING_CACHE_TTL_MS } from "@/services/week-preparation/planning-cache";
import {
  calculateDishCostSummary,
  recalculateMealBudgetSummary,
  rebuildPreparedWeekSelection,
  revalidatePreparedWeek,
} from "@/services/week-preparation/week-generation";
import type { Product, Recipe } from "@/types/catalog";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type {
  PreparedDay,
  RecipeMealCategory,
  SelectedRecipeReference,
  WeekIngredientRequirement,
  WeekBudgetDecision,
  WeekBudgetMutation,
  WeekMealCustomization,
  WeekPreparation,
  WeekProductSelectionSource,
} from "@/types/week-preparation";

const EMPTY_LIST: ActiveShoppingList = {
  schemaVersion: 2,
  startedAt: "1970-01-01T00:00:00.000Z",
  updatedAt: "1970-01-01T00:00:00.000Z",
  items: [],
};

export function listWithoutCurrentWeekMealPlan(
  list: ActiveShoppingList | undefined,
  weekPreparationId: string,
  now: Date = new Date(),
): ActiveShoppingList | undefined {
  return list
    ? removeMealPlanContributionsForWeek(list, weekPreparationId, now)
    : undefined;
}

export interface RecipeAlternative {
  recipe: SelectedRecipeReference;
  category: RecipeMealCategory;
  currentDishCostCents: number;
  alternativeDishCostCents: number;
  differenceCents: number;
  nextMealPlanCostCents: number;
  mealBudgetCents: number | null;
  withinMealBudget: boolean;
  alreadyUsedInWeek: boolean;
  impact: ManualProductBudgetImpact;
  preparation: WeekPreparation;
  basePreparationUpdatedAt: string;
  validatedAt: string;
}

export interface ProductAlternative {
  product: Product;
  packageCount: number;
  totalCostCents: number;
  differenceCents: number;
  nextMealPlanCostCents: number;
  mealBudgetCents: number | null;
  withinMealBudget: boolean;
  preparation: WeekPreparation;
}

export type ManualProductAction = "replaceIngredient" | "addToMeal";

export interface ManualProductChoice {
  action: ManualProductAction;
  dayIndex: number;
  ingredientId: string | null;
  productId: string;
  quantity: number;
  selectionSource: WeekProductSelectionSource;
}

export interface ExplicitRecipeChoicePreview {
  dayIndex: number;
  recipeId: string;
  alternative: RecipeAlternative;
}

export type ExplicitRecipeChoiceResult =
  | { ok: true; preview: ExplicitRecipeChoicePreview }
  | { ok: false; reason: CustomizationFailure };

export type ExplicitRecipeCommitResult =
  | {
      ok: true;
      preparation: WeekPreparation;
      impact: ManualProductBudgetImpact;
    }
  | {
      ok: false;
      reason:
        | CustomizationFailure
        | "budget_override_required"
        | "budget_impact_changed";
      preview?: ExplicitRecipeChoicePreview;
    };

export interface ManualProductBudgetImpact {
  currentMealPlanCostCents: number;
  nextMealPlanCostCents: number;
  mealPlanDifferenceCents: number;
  mealBudgetCents: number | null;
  mealBudgetOverageCents: number;
  currentTotalWeekCostCents: number;
  nextTotalWeekCostCents: number;
  totalWeekDifferenceCents: number;
  weekBudgetCents: number | null;
  weekBudgetOverageCents: number;
  weekBudgetRemainingCents: number | null;
  requiresBudgetOverride: boolean;
}

export interface ManualProductChoicePreview {
  choice: ManualProductChoice;
  product: Product;
  currentIngredientName: string | null;
  impact: ManualProductBudgetImpact;
  preparation: WeekPreparation;
}

export type ManualProductChoiceFailure =
  | "day_not_found"
  | "ingredient_not_found"
  | "product_not_found"
  | "product_price_missing"
  | "source_unavailable"
  | "invalid_quantity"
  | "budget_override_required";

export type ManualProductPreviewResult =
  | { ok: true; preview: ManualProductChoicePreview }
  | { ok: false; reason: ManualProductChoiceFailure };

export type ManualProductCommitResult =
  | { ok: true; preparation: WeekPreparation; impact: ManualProductBudgetImpact }
  | {
      ok: false;
      reason: ManualProductChoiceFailure;
      preview?: ManualProductChoicePreview;
    };

export type CustomizationFailure =
  | "day_not_found"
  | "current_recipe_missing"
  | "recipe_not_ready"
  | "wrong_category"
  | "over_meal_budget"
  | "ingredient_not_found"
  | "product_not_reliable"
  | "source_unavailable";

export type CustomizationResult =
  | { ok: true; preparation: WeekPreparation }
  | { ok: false; reason: CustomizationFailure };

function recipeReference(recipe: Recipe): SelectedRecipeReference {
  return { id: recipe.id, sourceKey: recipe.sourceKey, name: recipe.name };
}

function selectedDay(day: PreparedDay, recipe: Recipe): PreparedDay {
  return {
    ...day,
    recipeId: recipe.id,
    recipe: recipeReference(recipe),
    status: "recipeSelected",
  };
}

function customizationForRecipe(
  preparation: WeekPreparation,
  day: PreparedDay,
  recipe: Recipe,
  now: Date,
): WeekMealCustomization {
  const current = preparation.customizations.find(
    (customization) => customization.dayIndex === day.dayIndex,
  );
  return {
    dayIndex: day.dayIndex,
    baseRecipe: current?.baseRecipe ?? day.recipe!,
    replacementRecipe: recipe.id === (current?.baseRecipe.id ?? day.recipeId)
      ? null
      : recipeReference(recipe),
    recipeBudgetDecision: { mode: "automaticPlanValidation" },
    productOverrides: [],
    ingredientOverrides: [],
    manualProductAdditions: [],
    updatedAt: now.toISOString(),
  };
}

function withCustomization(
  preparation: WeekPreparation,
  customization: WeekMealCustomization,
): WeekMealCustomization[] {
  const retained = preparation.customizations.filter(
    (item) => item.dayIndex !== customization.dayIndex,
  );
  const isOriginal =
    customization.replacementRecipe === null &&
    customization.productOverrides.length === 0 &&
    customization.ingredientOverrides.length === 0 &&
    customization.manualProductAdditions.length === 0;
  return isOriginal ? retained : [...retained, customization];
}

async function loadedRecipeContext(
  preparation: WeekPreparation,
  dayIndex: number,
  recipeRepository: RecipeRepository,
  catalogRepository: CatalogRepository,
): Promise<{
  day: PreparedDay;
  catalog: RecipeCatalog;
  rankedRecipes: Recipe[];
  readiness: RecipeReadinessGateResult;
} | null> {
  const day = preparation.days.find((item) => item.dayIndex === dayIndex);
  if (
    !day ||
    day.freeChoice ||
    day.category === "freeChoice" ||
    !day.recipe ||
    preparation.numberOfPeople === null
  ) {
    return null;
  }
  const loaded = await recipeRepository.loadCatalog();
  const catalog: RecipeCatalog = {
    ...loaded,
    ingredients: enrichIngredientsForMealMixes(loaded.ingredients),
  };
  const candidates = suitableRecipes(
    catalog.recipes,
    day.category,
    preparation.preferences,
  );
  const selectedIds = new Set(
    preparation.days
      .map((item) => item.recipeId)
      .filter((id): id is string => id !== null),
  );
  const evaluatedRecipes = new Map<string, Recipe>();
  for (const recipe of [...candidates, ...catalog.recipes.filter((item) => selectedIds.has(item.id))]) {
    evaluatedRecipes.set(recipe.id, recipe);
  }
  const readiness = (await resolveRecipeReadiness(
    [...evaluatedRecipes.values()],
    preparation.numberOfPeople,
    catalog,
    catalogRepository,
    createPersistentRecipeReadinessRepository(),
  )).gate;
  const rankedRecipes = rankedReadyRecipesForDay(
    day,
    candidates,
    preparation.preferences,
    preparation.id,
    readyRecipeIds(readiness),
  );
  return { day, catalog, rankedRecipes, readiness };
}

function buildAlternative(
  preparation: WeekPreparation,
  day: PreparedDay,
  recipe: Recipe,
  catalog: RecipeCatalog,
  readiness: RecipeReadinessGateResult,
  list: ActiveShoppingList,
  now: Date,
): RecipeAlternative {
  const days = preparation.days.map((item) =>
    item.dayIndex === day.dayIndex ? selectedDay(item, recipe) : item,
  );
  const requirements = aggregateWeekIngredients(
    days,
    preparation.numberOfPeople!,
    catalog,
  );
  const ingredients = applyReadinessProducts(requirements, readiness);
  const next = rebuildPreparedWeekSelection(preparation, days, ingredients, list, now);
  const currentCost = calculateDishCostSummary(day.dayIndex, preparation.ingredients);
  const alternativeCost = calculateDishCostSummary(day.dayIndex, ingredients);
  const evaluation = evaluateMealBudget(
    next.budgetCents,
    next.mealBudgetCents,
    next.ingredients,
    list,
    now,
  );
  const nextPreparation = {
    ...next,
    customizations: withCustomization(
      preparation,
      customizationForRecipe(preparation, day, recipe, now),
    ),
  };
  return {
    recipe: recipeReference(recipe),
    category: day.category as RecipeMealCategory,
    currentDishCostCents: currentCost.knownCostCents,
    alternativeDishCostCents: alternativeCost.knownCostCents,
    differenceCents: alternativeCost.knownCostCents - currentCost.knownCostCents,
    nextMealPlanCostCents: evaluation.mealPlanKnownCostCents,
    mealBudgetCents: preparation.mealBudgetCents,
    withinMealBudget: mealBudgetAllowsPlan(evaluation),
    alreadyUsedInWeek: preparation.days.some(
      (item) => item.dayIndex !== day.dayIndex && item.recipeId === recipe.id,
    ),
    impact: budgetImpact(preparation, nextPreparation, list, now),
    preparation: nextPreparation,
    basePreparationUpdatedAt: preparation.updatedAt,
    validatedAt: now.toISOString(),
  };
}

export async function findRecipeAlternatives(
  preparation: WeekPreparation,
  dayIndex: number,
  recipeRepository: RecipeRepository,
  catalogRepository: CatalogRepository,
  list: ActiveShoppingList = EMPTY_LIST,
  now: Date = new Date(),
): Promise<RecipeAlternative[]> {
  const context = await loadedRecipeContext(
    preparation,
    dayIndex,
    recipeRepository,
    catalogRepository,
  );
  if (!context) return [];
  return context.rankedRecipes
    .filter((recipe) => recipe.id !== context.day.recipeId)
    .map((recipe) =>
      buildAlternative(
        preparation,
        context.day,
        recipe,
        context.catalog,
        context.readiness,
        list,
        now,
      ),
    )
    .toSorted(
      (left, right) =>
        Number(!left.withinMealBudget) - Number(!right.withinMealBudget) ||
        Number(left.alreadyUsedInWeek) - Number(right.alreadyUsedInWeek) ||
        left.alternativeDishCostCents - right.alternativeDishCostCents ||
        left.recipe.name.localeCompare(right.recipe.name, "nl-NL"),
    );
}

export async function previewExplicitRecipeChoice(
  preparation: WeekPreparation,
  dayIndex: number,
  recipeId: string,
  recipeRepository: RecipeRepository,
  catalogRepository: CatalogRepository,
  list: ActiveShoppingList = EMPTY_LIST,
  now: Date = new Date(),
): Promise<ExplicitRecipeChoiceResult> {
  const context = await loadedRecipeContext(
    preparation,
    dayIndex,
    recipeRepository,
    catalogRepository,
  );
  if (!context) return { ok: false, reason: "current_recipe_missing" };
  const recipe = context.catalog.recipes.find((item) => item.id === recipeId);
  if (!recipe) return { ok: false, reason: "recipe_not_ready" };
  if (!context.rankedRecipes.some((item) => item.id === recipe.id)) {
    return {
      ok: false,
      reason: suitableRecipes(
        [recipe],
        context.day.category as Exclude<PreparedDay["category"], "freeChoice">,
        preparation.preferences,
      ).length === 0
        ? "wrong_category"
        : "recipe_not_ready",
    };
  }
  return {
    ok: true,
    preview: {
      dayIndex,
      recipeId,
      alternative: buildAlternative(
        preparation,
        context.day,
        recipe,
        context.catalog,
        context.readiness,
        list,
        now,
      ),
    },
  };
}

function recipeMutation(
  preparation: WeekPreparation,
  dayIndex: number,
  recipeId: string,
): WeekBudgetMutation {
  return {
    kind: "replaceRecipe",
    weekPreparationId: preparation.id,
    dayIndex,
    recipeId,
  };
}

function recipeBudgetDecision(
  preparation: WeekPreparation,
  dayIndex: number,
  recipeId: string,
  impact: ManualProductBudgetImpact,
  now: Date,
): WeekBudgetDecision {
  return impact.requiresBudgetOverride
    ? {
        mode: "userApprovedBudgetOverride",
        approvedAt: now.toISOString(),
        approvedMealPlanCostCents: impact.nextMealPlanCostCents,
        approvedTotalWeekCostCents: impact.nextTotalWeekCostCents,
        approvedMealBudgetCents: impact.mealBudgetCents,
        approvedWeekBudgetCents: impact.weekBudgetCents,
        approvedMutation: recipeMutation(preparation, dayIndex, recipeId),
      }
    : { mode: "userConfirmedManualChoice" };
}

function withRecipeBudgetDecision(
  preparation: WeekPreparation,
  dayIndex: number,
  decision: WeekBudgetDecision,
): WeekPreparation {
  return {
    ...preparation,
    customizations: preparation.customizations.map((customization) =>
      customization.dayIndex === dayIndex
        ? { ...customization, recipeBudgetDecision: decision }
        : customization,
    ),
  };
}

function sameBudgetImpact(
  expected: ManualProductBudgetImpact,
  actual: ManualProductBudgetImpact,
): boolean {
  return (
    expected.nextMealPlanCostCents === actual.nextMealPlanCostCents &&
    expected.nextTotalWeekCostCents === actual.nextTotalWeekCostCents &&
    expected.mealBudgetCents === actual.mealBudgetCents &&
    expected.weekBudgetCents === actual.weekBudgetCents &&
    expected.mealBudgetOverageCents === actual.mealBudgetOverageCents &&
    expected.weekBudgetOverageCents === actual.weekBudgetOverageCents
  );
}

function snapshotPriceIsFresh(
  ingredient: WeekIngredientRequirement,
  now: Date,
): boolean {
  if (ingredient.optional && !ingredient.product) return true;
  if (
    !ingredient.product ||
    !ingredient.price ||
    ingredient.price.freshness !== "fresh" ||
    ingredient.purchaseQuantity === null ||
    ingredient.packageCapacity === null
  ) {
    return false;
  }
  const updatedAt = ingredient.price.updatedAt
    ? new Date(ingredient.price.updatedAt).getTime()
    : Number.NaN;
  return (
    Number.isFinite(updatedAt) &&
    updatedAt <= now.getTime() &&
    now.getTime() - updatedAt <= PRICE_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000
  );
}

function recipeSnapshotIsFresh(
  alternative: RecipeAlternative,
  now: Date,
): boolean {
  const validatedAt = new Date(alternative.validatedAt).getTime();
  return (
    Number.isFinite(validatedAt) &&
    validatedAt <= now.getTime() &&
    now.getTime() - validatedAt <= PLANNING_CACHE_TTL_MS &&
    alternative.preparation.ingredients.every((ingredient) =>
      snapshotPriceIsFresh(ingredient, now),
    )
  );
}

function hasIngredientLevelCustomizations(preparation: WeekPreparation): boolean {
  return preparation.customizations.some(
    (customization) =>
      customization.productOverrides.length > 0 ||
      customization.ingredientOverrides.length > 0 ||
      customization.manualProductAdditions.length > 0,
  );
}

function technicallyComplete(preparation: WeekPreparation): boolean {
  return (
    preparation.days.every(
      (day) => day.freeChoice || (day.recipeId !== null && day.recipe !== null),
    ) &&
    preparation.ingredients.every(
      (ingredient) =>
        ingredient.optional ||
        (!ingredient.productMatchMissing &&
          !ingredient.packageCalculationMissing &&
          ingredient.product !== null &&
          ingredient.price !== null &&
          ingredient.purchaseQuantity !== null),
    )
  );
}

function refreshedAlternative(
  current: WeekPreparation,
  dayIndex: number,
  original: RecipeAlternative,
  preparation: WeekPreparation,
  list: ActiveShoppingList,
  now: Date,
): RecipeAlternative {
  const impact = budgetImpact(current, preparation, list, now);
  const currentDish = calculateDishCostSummary(
    dayIndex,
    current.ingredients,
  );
  const alternativeDish = calculateDishCostSummary(
    dayIndex,
    preparation.ingredients,
  );
  return {
    ...original,
    currentDishCostCents: currentDish.knownCostCents,
    alternativeDishCostCents: alternativeDish.knownCostCents,
    differenceCents: alternativeDish.knownCostCents - currentDish.knownCostCents,
    nextMealPlanCostCents: impact.nextMealPlanCostCents,
    mealBudgetCents: impact.mealBudgetCents,
    withinMealBudget: impact.mealBudgetOverageCents === 0,
    impact,
    preparation,
    basePreparationUpdatedAt: current.updatedAt,
    validatedAt: now.toISOString(),
  };
}

export async function commitExplicitRecipeChoice(
  preparation: WeekPreparation,
  dayIndex: number,
  recipeId: string,
  approveBudgetOverride: boolean,
  recipeRepository: RecipeRepository,
  catalogRepository: CatalogRepository,
  list: ActiveShoppingList = EMPTY_LIST,
  now: Date = new Date(),
): Promise<ExplicitRecipeCommitResult> {
  const result = await previewExplicitRecipeChoice(
    preparation,
    dayIndex,
    recipeId,
    recipeRepository,
    catalogRepository,
    list,
    now,
  );
  if (!result.ok) return result;
  const { alternative } = result.preview;
  if (alternative.impact.requiresBudgetOverride && !approveBudgetOverride) {
    return {
      ok: false,
      reason: "budget_override_required",
      preview: result.preview,
    };
  }
  const decision = recipeBudgetDecision(
    preparation,
    dayIndex,
    recipeId,
    alternative.impact,
    now,
  );
  return {
    ok: true,
    preparation: withRecipeBudgetDecision(
      alternative.preparation,
      dayIndex,
      decision,
    ),
    impact: alternative.impact,
  };
}

/**
 * Commits the exact alternative the user inspected. A fresh snapshot already
 * contains READY products, packages, prices and the aggregated week, so the
 * normal confirmation path is local. Only a stale or structurally changed
 * snapshot falls back to one selected-week revalidation.
 */
export async function commitExplicitRecipeAlternative(
  current: WeekPreparation,
  dayIndex: number,
  alternative: RecipeAlternative,
  approveBudgetOverride: boolean,
  recipeRepository: RecipeRepository,
  catalogRepository: CatalogRepository,
  list: ActiveShoppingList = EMPTY_LIST,
  now: Date = new Date(),
): Promise<ExplicitRecipeCommitResult> {
  const selectedDay = alternative.preparation.days.find(
    (day) => day.dayIndex === dayIndex,
  );
  if (
    alternative.preparation.id !== current.id ||
    alternative.recipe.id !== selectedDay?.recipeId ||
    selectedDay.freeChoice ||
    selectedDay.category === "freeChoice"
  ) {
    return { ok: false, reason: "day_not_found" };
  }
  if (alternative.impact.requiresBudgetOverride && !approveBudgetOverride) {
    return {
      ok: false,
      reason: "budget_override_required",
      preview: { dayIndex, recipeId: alternative.recipe.id, alternative },
    };
  }

  let validatedAlternative = alternative;
  const canReuseSnapshot =
    alternative.basePreparationUpdatedAt === current.updatedAt &&
    recipeSnapshotIsFresh(alternative, now) &&
    !hasIngredientLevelCustomizations(alternative.preparation);

  if (!canReuseSnapshot) {
    const tentativeDecision = recipeBudgetDecision(
      current,
      dayIndex,
      alternative.recipe.id,
      alternative.impact,
      now,
    );
    const tentative = withRecipeBudgetDecision(
      alternative.preparation,
      dayIndex,
      tentativeDecision,
    );
    const validation = await revalidatePreparedWeek(
      tentative,
      recipeRepository,
      catalogRepository,
      now,
      list,
    );
    if (!technicallyComplete(validation.preparation)) {
      return { ok: false, reason: "recipe_not_ready" };
    }
    validatedAlternative = refreshedAlternative(
      current,
      dayIndex,
      alternative,
      validation.preparation,
      list,
      now,
    );
    if (!sameBudgetImpact(alternative.impact, validatedAlternative.impact)) {
      return {
        ok: false,
        reason: "budget_impact_changed",
        preview: {
          dayIndex,
          recipeId: alternative.recipe.id,
          alternative: validatedAlternative,
        },
      };
    }
  }

  const impact = budgetImpact(
    current,
    validatedAlternative.preparation,
    list,
    now,
  );
  if (!sameBudgetImpact(alternative.impact, impact)) {
    return {
      ok: false,
      reason: "budget_impact_changed",
      preview: {
        dayIndex,
        recipeId: alternative.recipe.id,
        alternative: { ...validatedAlternative, impact },
      },
    };
  }
  if (impact.requiresBudgetOverride && !approveBudgetOverride) {
    return {
      ok: false,
      reason: "budget_override_required",
      preview: {
        dayIndex,
        recipeId: alternative.recipe.id,
        alternative: validatedAlternative,
      },
    };
  }

  const decision = recipeBudgetDecision(
    current,
    dayIndex,
    alternative.recipe.id,
    impact,
    now,
  );
  const approved = withRecipeBudgetDecision(
    validatedAlternative.preparation,
    dayIndex,
    decision,
  );
  const preparation = recalculateMealBudgetSummary(approved, list, now);
  if (!technicallyComplete(preparation) || preparation.status !== "generated") {
    return { ok: false, reason: "recipe_not_ready" };
  }
  return { ok: true, preparation, impact };
}

export async function replaceWeekRecipe(
  preparation: WeekPreparation,
  dayIndex: number,
  recipeId: string,
  recipeRepository: RecipeRepository,
  catalogRepository: CatalogRepository,
  list: ActiveShoppingList = EMPTY_LIST,
  now: Date = new Date(),
): Promise<CustomizationResult> {
  const context = await loadedRecipeContext(
    preparation,
    dayIndex,
    recipeRepository,
    catalogRepository,
  );
  if (!context) return { ok: false, reason: "current_recipe_missing" };
  const recipe = context.catalog.recipes.find((item) => item.id === recipeId);
  if (!recipe) return { ok: false, reason: "recipe_not_ready" };
  if (!context.rankedRecipes.some((item) => item.id === recipe.id)) {
    return {
      ok: false,
      reason: suitableRecipes(
        [recipe],
        context.day.category as Exclude<PreparedDay["category"], "freeChoice">,
        preparation.preferences,
      ).length === 0
        ? "wrong_category"
        : "recipe_not_ready",
    };
  }
  const alternative = buildAlternative(
    preparation,
    context.day,
    recipe,
    context.catalog,
    context.readiness,
    list,
    now,
  );
  return alternative.withinMealBudget
    ? { ok: true, preparation: alternative.preparation }
    : { ok: false, reason: "over_meal_budget" };
}

function requirementForDay(
  preparation: WeekPreparation,
  dayIndex: number,
  ingredientId: string,
): WeekIngredientRequirement | null {
  return preparation.ingredients.find(
    (item) =>
      item.ingredientId === ingredientId &&
      item.usedIn.some((use) => use.dayIndex === dayIndex),
  ) ?? null;
}

function splitRequirementForProduct(
  requirements: WeekIngredientRequirement[],
  dayIndex: number,
  ingredientId: string,
  product: Product,
): WeekIngredientRequirement[] {
  return requirements.flatMap((requirement) => {
    if (requirement.ingredientId !== ingredientId) return [requirement];
    const selectedUses = requirement.usedIn.filter((use) => use.dayIndex === dayIndex);
    if (selectedUses.length === 0) return [requirement];
    const otherUses = requirement.usedIn.filter((use) => use.dayIndex !== dayIndex);
    const selectedQuantity = selectedUses.reduce(
      (total, use) => total + use.requiredQuantity,
      0,
    );
    const selected = applyProductToRequirement(
      {
        ...requirement,
        requiredQuantity: selectedQuantity,
        usedIn: selectedUses,
      },
      product,
    );
    if (otherUses.length === 0) return [selected];
    const otherQuantity = otherUses.reduce(
      (total, use) => total + use.requiredQuantity,
      0,
    );
    const remaining = {
      ...requirement,
      requiredQuantity: otherQuantity,
      purchaseQuantity: requirement.packageCapacity
        ? Math.max(1, Math.ceil(otherQuantity / requirement.packageCapacity))
        : null,
      usedIn: otherUses,
    };
    return [remaining, selected];
  });
}

async function productsForIngredient(
  ingredient: RecipeIngredientDefinition,
  repository: CatalogRepository,
): Promise<Product[]> {
  const found = new Map<string, Product>();
  for (const term of [ingredient.name, ...ingredient.aliases].slice(0, 4)) {
    const result = await repository.search(term, { limit: 12 });
    for (const product of result.products) found.set(product.id, product);
  }
  return [...found.values()];
}

export async function findProductAlternatives(
  preparation: WeekPreparation,
  dayIndex: number,
  ingredientId: string,
  recipeRepository: RecipeRepository,
  catalogRepository: CatalogRepository,
  list: ActiveShoppingList = EMPTY_LIST,
  now: Date = new Date(),
): Promise<ProductAlternative[]> {
  const requirement = requirementForDay(preparation, dayIndex, ingredientId);
  if (!requirement || requirement.kind === "mealMix") return [];
  const loaded = await recipeRepository.loadCatalog();
  const ingredient = enrichIngredientsForMealMixes(loaded.ingredients)
    .find((item) => item.id === ingredientId);
  if (!ingredient) return [];
  const currentPackages = requirement.purchaseQuantity ?? 0;
  const currentTotal = (requirement.price?.amountCents ?? 0) * currentPackages;
  const products = await productsForIngredient(ingredient, catalogRepository);
  return products
    .filter(
      (product) =>
        product.id !== requirement.product?.productId &&
        isReliableIngredientMatch(ingredient, product, requirement.brandConstraint) &&
        productPackageCapacity(product, requirement.unit) !== null,
    )
    .map((product) => {
      const ingredients = splitRequirementForProduct(
        preparation.ingredients,
        dayIndex,
        ingredientId,
        product,
      );
      const selected = ingredients.find(
        (item) =>
          item.ingredientId === ingredientId &&
          item.product?.productId === product.id &&
          item.usedIn.some((use) => use.dayIndex === dayIndex),
      );
      const next = rebuildPreparedWeekSelection(
        preparation,
        preparation.days,
        ingredients,
        list,
        now,
      );
      const evaluation = evaluateMealBudget(
        next.budgetCents,
        next.mealBudgetCents,
        ingredients,
        list,
        now,
      );
      const packageCount = selected?.purchaseQuantity ?? 0;
      const totalCostCents = (selected?.price?.amountCents ?? 0) * packageCount;
      const currentCustomization = preparation.customizations.find(
        (item) => item.dayIndex === dayIndex,
      ) ?? {
        dayIndex,
        baseRecipe: preparation.days.find((item) => item.dayIndex === dayIndex)!.recipe!,
        replacementRecipe: null,
        recipeBudgetDecision: { mode: "automaticPlanValidation" },
        productOverrides: [],
        ingredientOverrides: [],
        manualProductAdditions: [],
        updatedAt: now.toISOString(),
      };
      const customization: WeekMealCustomization = {
        ...currentCustomization,
        productOverrides: [
          ...currentCustomization.productOverrides.filter(
            (item) => item.ingredientId !== ingredientId,
          ),
          {
            ingredientId,
            productId: product.id,
            sku: product.sku,
            quantity: null,
            selectionSource: "automaticSuggestion",
            applicationMode: "automaticPlanValidation",
            budgetDecision: { mode: "automaticPlanValidation" },
            updatedAt: now.toISOString(),
          },
        ],
        updatedAt: now.toISOString(),
      };
      return {
        product,
        packageCount,
        totalCostCents,
        differenceCents: totalCostCents - currentTotal,
        nextMealPlanCostCents: evaluation.mealPlanKnownCostCents,
        mealBudgetCents: preparation.mealBudgetCents,
        withinMealBudget: mealBudgetAllowsPlan(evaluation),
        preparation: {
          ...next,
          customizations: withCustomization(preparation, customization),
        },
      };
    })
    .filter((item) => item.packageCount > 0 && item.totalCostCents > 0)
    .toSorted(
      (left, right) =>
        Number(!left.withinMealBudget) - Number(!right.withinMealBudget) ||
        left.totalCostCents - right.totalCostCents ||
        left.product.name.localeCompare(right.product.name, "nl-NL"),
    );
}

export async function replaceWeekProduct(
  preparation: WeekPreparation,
  dayIndex: number,
  ingredientId: string,
  productId: string,
  recipeRepository: RecipeRepository,
  catalogRepository: CatalogRepository,
  list: ActiveShoppingList = EMPTY_LIST,
  now: Date = new Date(),
): Promise<CustomizationResult> {
  const alternatives = await findProductAlternatives(
    preparation,
    dayIndex,
    ingredientId,
    recipeRepository,
    catalogRepository,
    list,
    now,
  );
  const alternative = alternatives.find((item) => item.product.id === productId);
  if (!alternative) return { ok: false, reason: "product_not_reliable" };
  return alternative.withinMealBudget
    ? { ok: true, preparation: alternative.preparation }
    : { ok: false, reason: "over_meal_budget" };
}

function validManualQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= 99;
}

function customizationForDay(
  preparation: WeekPreparation,
  day: PreparedDay,
  now: Date,
): WeekMealCustomization | null {
  if (!day.recipe) return null;
  return preparation.customizations.find(
    (item) => item.dayIndex === day.dayIndex,
  ) ?? {
    dayIndex: day.dayIndex,
    baseRecipe: day.recipe,
    replacementRecipe: null,
    recipeBudgetDecision: { mode: "automaticPlanValidation" },
    productOverrides: [],
    ingredientOverrides: [],
    manualProductAdditions: [],
    updatedAt: now.toISOString(),
  };
}

function splitRequirementForManualProduct(
  requirements: WeekIngredientRequirement[],
  dayIndex: number,
  ingredientId: string,
  product: Product,
  quantity: number,
): WeekIngredientRequirement[] {
  return requirements.flatMap((requirement) => {
    if (requirement.ingredientId !== ingredientId) return [requirement];
    const selectedUses = requirement.usedIn.filter(
      (use) => use.dayIndex === dayIndex,
    );
    if (selectedUses.length === 0) return [requirement];
    const otherUses = requirement.usedIn.filter(
      (use) => use.dayIndex !== dayIndex,
    );
    const selected = applyManualProductToRequirement(
      {
        ...requirement,
        usedIn: selectedUses,
      },
      product,
      quantity,
    );
    if (otherUses.length === 0) return [selected];
    const otherQuantity = otherUses.reduce(
      (total, use) => total + use.requiredQuantity,
      0,
    );
    return [
      {
        ...requirement,
        requiredQuantity: otherQuantity,
        purchaseQuantity: requirement.packageCapacity
          ? Math.max(1, Math.ceil(otherQuantity / requirement.packageCapacity))
          : null,
        usedIn: otherUses,
      },
      selected,
    ];
  });
}

function manualAdditionId(dayIndex: number, productId: string): string {
  return `manual-addition:${dayIndex}:${productId}`;
}

function manualAdditionRequirement(
  day: PreparedDay,
  product: Product,
  quantity: number,
): WeekIngredientRequirement | null {
  if (!day.recipe) return null;
  return applyManualProductToRequirement(
    {
      ingredientId: manualAdditionId(day.dayIndex, product.id),
      sourceKey: "manualProductAddition",
      name: product.name,
      unit: "piece",
      optional: false,
      servingsBase: 1,
      kind: "ingredient",
      brandConstraint: null,
      requiredQuantity: quantity,
      purchaseQuantity: null,
      packageCapacity: null,
      usedIn: [{
        recipeId: day.recipe.id,
        recipeName: day.recipe.name,
        dayIndex: day.dayIndex,
        requiredQuantity: quantity,
      }],
      product: null,
      price: null,
      productMatchMissing: false,
      packageCalculationMissing: false,
    },
    product,
    quantity,
  );
}

function budgetImpact(
  preparation: WeekPreparation,
  next: WeekPreparation,
  list: ActiveShoppingList,
  now: Date,
): ManualProductBudgetImpact {
  const baselineList = listWithoutCurrentWeekMealPlan(
    list,
    preparation.id,
    now,
  ) ?? EMPTY_LIST;
  const current = evaluateMealBudget(
    preparation.budgetCents,
    preparation.mealBudgetCents,
    preparation.ingredients,
    baselineList,
    now,
  );
  const updated = evaluateMealBudget(
    next.budgetCents,
    next.mealBudgetCents,
    next.ingredients,
    baselineList,
    now,
  );
  const mealBudgetOverageCents = next.mealBudgetCents === null
    ? 0
    : Math.max(0, updated.mealPlanKnownCostCents - next.mealBudgetCents);
  const weekBudgetOverageCents = next.budgetCents === null
    ? 0
    : Math.max(0, updated.totalKnownWeekCostCents - next.budgetCents);
  return {
    currentMealPlanCostCents: current.mealPlanKnownCostCents,
    nextMealPlanCostCents: updated.mealPlanKnownCostCents,
    mealPlanDifferenceCents:
      updated.mealPlanKnownCostCents - current.mealPlanKnownCostCents,
    mealBudgetCents: next.mealBudgetCents,
    mealBudgetOverageCents,
    currentTotalWeekCostCents: current.totalKnownWeekCostCents,
    nextTotalWeekCostCents: updated.totalKnownWeekCostCents,
    totalWeekDifferenceCents:
      updated.totalKnownWeekCostCents - current.totalKnownWeekCostCents,
    weekBudgetCents: next.budgetCents,
    weekBudgetOverageCents,
    weekBudgetRemainingCents: next.budgetCents === null
      ? null
      : Math.max(0, next.budgetCents - updated.totalKnownWeekCostCents),
    requiresBudgetOverride:
      mealBudgetOverageCents > 0 || weekBudgetOverageCents > 0,
  };
}

export function previewManualProductChoice(
  preparation: WeekPreparation,
  choice: ManualProductChoice,
  product: Product,
  list: ActiveShoppingList = EMPTY_LIST,
  now: Date = new Date(),
): ManualProductPreviewResult {
  if (!validManualQuantity(choice.quantity)) {
    return { ok: false, reason: "invalid_quantity" };
  }
  if (product.id !== choice.productId) {
    return { ok: false, reason: "product_not_found" };
  }
  if (product.supermarket !== "Hoogvliet" || product.isAvailable === false) {
    return { ok: false, reason: "source_unavailable" };
  }
  const day = preparation.days.find(
    (item) => item.dayIndex === choice.dayIndex,
  );
  if (!day || day.freeChoice || !day.recipe) {
    return { ok: false, reason: "day_not_found" };
  }
  const currentCustomization = customizationForDay(preparation, day, now);
  if (!currentCustomization) {
    return { ok: false, reason: "day_not_found" };
  }
  const timestamp = now.toISOString();
  const manualDecision: WeekBudgetDecision = {
    mode: "userConfirmedManualChoice",
  };
  let ingredients: WeekIngredientRequirement[];
  let customization: WeekMealCustomization;
  let currentIngredientName: string | null = null;

  if (choice.action === "replaceIngredient") {
    if (!choice.ingredientId) {
      return { ok: false, reason: "ingredient_not_found" };
    }
    const requirement = requirementForDay(
      preparation,
      choice.dayIndex,
      choice.ingredientId,
    );
    if (!requirement) {
      return { ok: false, reason: "ingredient_not_found" };
    }
    currentIngredientName = requirement.name;
    ingredients = splitRequirementForManualProduct(
      preparation.ingredients,
      choice.dayIndex,
      choice.ingredientId,
      product,
      choice.quantity,
    );
    customization = {
      ...currentCustomization,
      productOverrides: [
        ...currentCustomization.productOverrides.filter(
          (item) => item.ingredientId !== choice.ingredientId,
        ),
        {
          ingredientId: choice.ingredientId,
          productId: product.id,
          sku: product.sku,
          quantity: choice.quantity,
          selectionSource: choice.selectionSource,
          applicationMode: "explicitUserChoice",
          budgetDecision: manualDecision,
          updatedAt: timestamp,
        },
      ],
      updatedAt: timestamp,
    };
  } else {
    const addition = manualAdditionRequirement(day, product, choice.quantity);
    if (!addition || !addition.product || !addition.price) {
      return { ok: false, reason: "product_price_missing" };
    }
    const additionId = manualAdditionId(choice.dayIndex, product.id);
    ingredients = [
      ...preparation.ingredients.filter(
        (item) => item.ingredientId !== additionId,
      ),
      addition,
    ];
    customization = {
      ...currentCustomization,
      manualProductAdditions: [
        ...currentCustomization.manualProductAdditions.filter(
          (item) => item.id !== additionId,
        ),
        {
          id: additionId,
          product: addition.product,
          price: addition.price,
          quantity: choice.quantity,
          selectionSource: choice.selectionSource,
          applicationMode: "explicitUserChoice",
          budgetDecision: manualDecision,
          updatedAt: timestamp,
        },
      ],
      updatedAt: timestamp,
    };
  }

  const selectedRequirement = ingredients.find(
    (item) =>
      item.product?.productId === product.id &&
      item.usedIn.some((use) => use.dayIndex === choice.dayIndex),
  );
  if (!selectedRequirement?.price) {
    return { ok: false, reason: "product_price_missing" };
  }
  const customized = {
    ...preparation,
    customizations: withCustomization(preparation, customization),
  };
  const baselineList = removeMealPlanContributionsForWeek(
    list,
    preparation.id,
    now,
  );
  const next = rebuildPreparedWeekSelection(
    customized,
    customized.days,
    ingredients,
    baselineList,
    now,
  );
  const impact = budgetImpact(preparation, next, list, now);
  return {
    ok: true,
    preview: {
      choice,
      product,
      currentIngredientName,
      impact,
      preparation: next,
    },
  };
}

function productMutation(
  preparation: WeekPreparation,
  choice: ManualProductChoice,
): WeekBudgetMutation {
  if (choice.action === "replaceIngredient") {
    return {
      kind: "replaceIngredient",
      weekPreparationId: preparation.id,
      dayIndex: choice.dayIndex,
      ingredientId: choice.ingredientId!,
      productId: choice.productId,
      quantity: choice.quantity,
    };
  }
  return {
    kind: "addToMeal",
    weekPreparationId: preparation.id,
    dayIndex: choice.dayIndex,
    productId: choice.productId,
    quantity: choice.quantity,
  };
}

function applyBudgetDecision(
  preview: ManualProductChoicePreview,
  decision: WeekBudgetDecision,
  list: ActiveShoppingList,
  now: Date,
): WeekPreparation {
  const { choice } = preview;
  const customizations = preview.preparation.customizations.map(
    (customization) => {
      if (customization.dayIndex !== choice.dayIndex) return customization;
      if (choice.action === "replaceIngredient") {
        return {
          ...customization,
          productOverrides: customization.productOverrides.map((override) =>
            override.ingredientId === choice.ingredientId
              ? { ...override, budgetDecision: decision }
              : override,
          ),
        };
      }
      const additionId = manualAdditionId(choice.dayIndex, choice.productId);
      return {
        ...customization,
        manualProductAdditions: customization.manualProductAdditions.map(
          (addition) =>
            addition.id === additionId
              ? { ...addition, budgetDecision: decision }
              : addition,
        ),
      };
    },
  );
  const updated = { ...preview.preparation, customizations };
  const baselineList = removeMealPlanContributionsForWeek(
    list,
    updated.id,
    now,
  );
  return rebuildPreparedWeekSelection(
    updated,
    updated.days,
    updated.ingredients,
    baselineList,
    now,
  );
}

export function commitManualProductChoice(
  preparation: WeekPreparation,
  choice: ManualProductChoice,
  product: Product,
  approveBudgetOverride: boolean,
  list: ActiveShoppingList = EMPTY_LIST,
  now: Date = new Date(),
): ManualProductCommitResult {
  const result = previewManualProductChoice(
    preparation,
    choice,
    product,
    list,
    now,
  );
  if (!result.ok) return result;
  if (result.preview.impact.requiresBudgetOverride && !approveBudgetOverride) {
    return {
      ok: false,
      reason: "budget_override_required",
      preview: result.preview,
    };
  }
  const decision: WeekBudgetDecision = result.preview.impact.requiresBudgetOverride
    ? {
        mode: "userApprovedBudgetOverride",
        approvedAt: now.toISOString(),
        approvedMealPlanCostCents:
          result.preview.impact.nextMealPlanCostCents,
        approvedTotalWeekCostCents:
          result.preview.impact.nextTotalWeekCostCents,
        approvedMealBudgetCents: result.preview.impact.mealBudgetCents,
        approvedWeekBudgetCents: result.preview.impact.weekBudgetCents,
        approvedMutation: productMutation(preparation, choice),
      }
    : { mode: "userConfirmedManualChoice" };
  return {
    ok: true,
    preparation: applyBudgetDecision(result.preview, decision, list, now),
    impact: result.preview.impact,
  };
}
