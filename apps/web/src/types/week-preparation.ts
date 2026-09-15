export const WEEK_PREPARATION_SCHEMA_VERSION = 1 as const;

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
export type WeekPreparationStatus = "draft" | "readyForGeneration";

export type CategoryDistribution = Record<MealCategory, number>;

export interface WeekPreferences {
  noVegetarian: boolean;
  quickImportant: boolean;
  healthyImportant: boolean;
  budgetImportant: boolean;
}

export interface PreparedDay {
  dayIndex: number;
  category: MealCategory;
  freeChoice: boolean;
  recipeId: null;
  status: "categoryAssigned";
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
  status: WeekPreparationStatus;
  listStrategy: "preserveAndComplete";
}

