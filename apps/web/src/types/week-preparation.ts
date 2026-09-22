import type { PriceFreshness, UUID } from "@/types/catalog";
import type { BudgetStatus } from "@/types/budget";

export const WEEK_PREPARATION_SCHEMA_VERSION = 6 as const;

export const MEAL_CATEGORIES = [
  "dutch",
  "pasta",
  "rice",
  "quick",
  "healthy",
  "comfort",
  "vegetarian",
  "freeChoice",
] as const;

export type MealCategory = (typeof MEAL_CATEGORIES)[number];
export type RecipeMealCategory = Exclude<MealCategory, "freeChoice">;
export type MealMixBrand = "Knorr" | "Honig";
export type WeekPreparationStatus =
  | "draft"
  | "readyForGeneration"
  | "generating"
  | "generated"
  | "generationPartial"
  | "generationError";

export const MEAL_BUDGET_STATUSES = [
  "noMealBudget",
  "withinMealBudget",
  "exactlyMealBudget",
  "overMealBudget",
  "incompleteValidation",
  "noValidMealPlanWithinBudget",
] as const;

export type MealBudgetStatus = (typeof MEAL_BUDGET_STATUSES)[number];

export type CategoryDistribution = Record<MealCategory, number>;

export interface WeekPreferences {
  noVegetarian: boolean;
  quickImportant: boolean;
  healthyImportant: boolean;
  budgetImportant: boolean;
}

export interface SelectedRecipeReference {
  id: UUID;
  sourceKey: string;
  name: string;
}

export type WeekProductSelectionSource =
  | "automaticSuggestion"
  | "manualSearch";

export type WeekProductApplicationMode =
  | "automaticPlanValidation"
  | "explicitUserChoice";

export type WeekBudgetMutation =
  | {
      kind: "replaceIngredient";
      weekPreparationId: string;
      dayIndex: number;
      ingredientId: UUID;
      productId: UUID;
      quantity: number;
    }
  | {
      kind: "addToMeal";
      weekPreparationId: string;
      dayIndex: number;
      productId: UUID;
      quantity: number;
    }
  | {
      kind: "replaceRecipe";
      weekPreparationId: string;
      dayIndex: number;
      recipeId: UUID;
    };

export type WeekBudgetDecision =
  | { mode: "automaticPlanValidation" }
  | { mode: "userConfirmedManualChoice" }
  | {
      mode: "userApprovedBudgetOverride";
      approvedAt: string;
      approvedMealPlanCostCents: number;
      approvedTotalWeekCostCents: number;
      approvedMealBudgetCents: number | null;
      approvedWeekBudgetCents: number | null;
      approvedMutation: WeekBudgetMutation;
    };

export interface WeekProductOverride {
  ingredientId: UUID;
  productId: UUID;
  sku: string;
  quantity: number | null;
  selectionSource: WeekProductSelectionSource;
  applicationMode: WeekProductApplicationMode;
  budgetDecision: WeekBudgetDecision;
  updatedAt: string;
}

export interface WeekIngredientOverride {
  ingredientId: UUID;
  substituteIngredientId: UUID;
  substituteSourceKey: string;
  quantityMultiplier: number;
  updatedAt: string;
}

export interface WeekManualProductAddition {
  id: string;
  product: WeekProductReference;
  price: WeekPriceSnapshot;
  quantity: number;
  selectionSource: WeekProductSelectionSource;
  applicationMode: WeekProductApplicationMode;
  budgetDecision: WeekBudgetDecision;
  updatedAt: string;
}

export interface WeekMealCustomization {
  dayIndex: number;
  baseRecipe: SelectedRecipeReference;
  replacementRecipe: SelectedRecipeReference | null;
  recipeBudgetDecision: WeekBudgetDecision;
  productOverrides: WeekProductOverride[];
  ingredientOverrides: WeekIngredientOverride[];
  manualProductAdditions: WeekManualProductAddition[];
  updatedAt: string;
}

export interface PreparedDay {
  customDish?: CustomDish;
  dayIndex: number;
  category: MealCategory;
  freeChoice: boolean;
  recipeId: UUID | null;
  recipe: SelectedRecipeReference | null;
  status: "categoryAssigned" | "recipeSelected" | "freeChoice";
}

export interface CustomDishIngredient {
  id: string;
  name: string;
  quantity: number;
  unit: WeekIngredientUnit;
  productId: string | null;
}

export interface CustomDish {
  name: string;
  servings: number;
  ingredients: CustomDishIngredient[];
}

export type WeekIngredientUnit = "g" | "kg" | "ml" | "l" | "piece" | "loaf";

export interface WeekIngredientUse {
  recipeId: UUID;
  recipeName: string;
  dayIndex: number;
  requiredQuantity: number;
}

export interface WeekProductReference {
  category?: string | null;
  productId: UUID;
  sku: string;
  name: string;
  brand: string | null;
  packageText: string | null;
  imageUrl: string | null;
  supermarket: string;
  sourceUrl: string;
}

export interface WeekPriceSnapshot {
  amountCents: number;
  isOffer: boolean;
  updatedAt: string | null;
  freshness: PriceFreshness;
}

export interface WeekIngredientRequirement {
  ingredientId: UUID;
  sourceKey: string;
  name: string;
  unit: WeekIngredientUnit;
  optional: boolean;
  servingsBase: 1;
  kind: "ingredient" | "mealMix";
  brandConstraint: MealMixBrand | null;
  requiredQuantity: number;
  purchaseQuantity: number | null;
  packageCapacity: number | null;
  usedIn: WeekIngredientUse[];
  product: WeekProductReference | null;
  price: WeekPriceSnapshot | null;
  productMatchMissing: boolean;
  packageCalculationMissing: boolean;
}

export interface WeekGenerationSummary {
  generatedAt: string;
  knownPurchaseCostCents: number;
  mealPlanKnownCostCents: number;
  mealBudgetRemainingCents: number | null;
  nonMealReservedCents: number | null;
  totalKnownWeekCostCents: number;
  mealBudgetStatus: MealBudgetStatus;
  weekBudgetStatus: BudgetStatus;
  isMealBudgetComplete: boolean;
  mealBudgetCandidateCount: number;
  mealBudgetRejectedCount: number;
  readinessByCategory?: WeekCategoryReadinessSummary[];
  lowestCompleteMealPlanCostCents?: number | null;
  lowestCompleteMealPlanCostReliable?: boolean;
  matchedProductCount: number;
  missingProductMatchCount: number;
  missingPackageCalculationCount: number;
  missingPriceCount: number;
}

export interface WeekCategoryReadinessSummary {
  category: RecipeMealCategory;
  candidateCount: number;
  readyCount: number;
}

export interface WeekPreparation {
  schemaVersion: typeof WEEK_PREPARATION_SCHEMA_VERSION;
  id: string;
  createdAt: string;
  updatedAt: string;
  numberOfPeople: number | null;
  numberOfDays: number | null;
  budgetCents: number | null;
  mealBudgetCents: number | null;
  existingListKnownSubtotalCents: number;
  existingListUnpricedCount: number;
  categoryDistribution: CategoryDistribution;
  preferences: WeekPreferences;
  days: PreparedDay[];
  ingredients: WeekIngredientRequirement[];
  generation: WeekGenerationSummary | null;
  customizations: WeekMealCustomization[];
  status: WeekPreparationStatus;
  listStrategy: "preserveAndComplete";
}
