import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import { aggregateWeekIngredients } from "@/services/week-preparation/ingredient-aggregation";
import { evaluateMealBudget, mealBudgetAllowsPlan } from "@/services/week-preparation/meal-budget";
import { enrichIngredientsForMealMixes } from "@/services/week-preparation/meal-mix-profiles";
import {
  applyProductToRequirement,
  isReliableIngredientMatch,
  productPackageCapacity,
} from "@/services/week-preparation/product-matching";
import {
  applyReadinessProducts,
  evaluateRecipeReadiness,
  readyRecipeIds,
} from "@/services/week-preparation/recipe-readiness";
import type {
  RecipeCatalog,
  RecipeIngredientDefinition,
  RecipeRepository,
} from "@/services/week-preparation/recipe-repository";
import {
  rankedReadyRecipesForDay,
  suitableRecipes,
} from "@/services/week-preparation/recipe-selection";
import {
  calculateDishCostSummary,
  rebuildPreparedWeekSelection,
} from "@/services/week-preparation/week-generation";
import type { Product, Recipe } from "@/types/catalog";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type {
  PreparedDay,
  RecipeMealCategory,
  SelectedRecipeReference,
  WeekIngredientRequirement,
  WeekMealCustomization,
  WeekPreparation,
} from "@/types/week-preparation";

const EMPTY_LIST: ActiveShoppingList = {
  schemaVersion: 2,
  startedAt: "1970-01-01T00:00:00.000Z",
  updatedAt: "1970-01-01T00:00:00.000Z",
  items: [],
};

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
  preparation: WeekPreparation;
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
    productOverrides: [],
    ingredientOverrides: [],
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
    customization.ingredientOverrides.length === 0;
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
  readiness: Awaited<ReturnType<typeof evaluateRecipeReadiness>>;
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
  const readiness = await evaluateRecipeReadiness(
    [...evaluatedRecipes.values()],
    preparation.numberOfPeople,
    catalog,
    catalogRepository,
  );
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
  readiness: Awaited<ReturnType<typeof evaluateRecipeReadiness>>,
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
    preparation: {
      ...next,
      customizations: withCustomization(
        preparation,
        customizationForRecipe(preparation, day, recipe, now),
      ),
    },
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
    .filter((alternative) => alternative.withinMealBudget)
    .toSorted(
      (left, right) =>
        Number(left.alreadyUsedInWeek) - Number(right.alreadyUsedInWeek) ||
        left.alternativeDishCostCents - right.alternativeDishCostCents ||
        left.recipe.name.localeCompare(right.recipe.name, "nl-NL"),
    );
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
        productOverrides: [],
        ingredientOverrides: [],
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
