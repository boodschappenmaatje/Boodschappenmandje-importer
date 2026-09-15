import type { PriceFreshness, UUID } from "@/types/catalog";

export const WEEK_PREPARATION_SCHEMA_VERSION = 3 as const;

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

export interface PreparedDay {
  dayIndex: number;
  category: MealCategory;
  freeChoice: boolean;
  recipeId: UUID | null;
  recipe: SelectedRecipeReference | null;
  status: "categoryAssigned" | "recipeSelected" | "freeChoice";
}

export type WeekIngredientUnit = "g" | "kg" | "ml" | "l" | "piece" | "loaf";

export interface WeekIngredientUse {
  recipeId: UUID;
  recipeName: string;
  dayIndex: number;
  requiredQuantity: number;
}

export interface WeekProductReference {
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
  matchedProductCount: number;
  missingProductMatchCount: number;
  missingPackageCalculationCount: number;
  missingPriceCount: number;
}

export interface WeekPreparation {
  schemaVersion: typeof WEEK_PREPARATION_SCHEMA_VERSION;
  id: string;
  createdAt: string;
  updatedAt: string;
  numberOfPeople: number | null;
  numberOfDays: number | null;
  budgetCents: number | null;
  existingListKnownSubtotalCents: number;
  existingListUnpricedCount: number;
  categoryDistribution: CategoryDistribution;
  preferences: WeekPreferences;
  days: PreparedDay[];
  ingredients: WeekIngredientRequirement[];
  generation: WeekGenerationSummary | null;
  status: WeekPreparationStatus;
  listStrategy: "preserveAndComplete";
}
