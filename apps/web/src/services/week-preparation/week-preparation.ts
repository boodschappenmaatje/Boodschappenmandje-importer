import type { BudgetSettings } from "@/types/budget";
import {
  MEAL_CATEGORIES,
  WEEK_PREPARATION_SCHEMA_VERSION,
  type CategoryDistribution,
  type MealCategory,
  type PreparedDay,
  type WeekPreparation,
  type WeekPreferences,
} from "@/types/week-preparation";

export const MEAL_CATEGORY_LABELS: Record<MealCategory, string> = {
  dutch: "Hollandse kost",
  pasta: "Pasta",
  rice: "Rijst",
  quick: "Simpel & snel",
  healthy: "Gezond",
  comfort: "Comfort / ongezonder",
  vegetarian: "Vegetarisch",
  freeChoice: "Vrije keuze",
};

export const DEFAULT_WEEK_PREFERENCES: WeekPreferences = {
  noVegetarian: false,
  quickImportant: false,
  healthyImportant: false,
  budgetImportant: true,
};

export interface ExistingListContext {
  knownSubtotalCents: number;
  unpricedItemCount: number;
}

export interface DistributionProgress {
  assignedDays: number;
  targetDays: number;
  difference: number;
  state: "under" | "exact" | "over";
}

export function emptyCategoryDistribution(): CategoryDistribution {
  return {
    dutch: 0,
    pasta: 0,
    rice: 0,
    quick: 0,
    healthy: 0,
    comfort: 0,
    vegetarian: 0,
    freeChoice: 0,
  };
}

function createPreparationId(now: Date): string {
  const uuid = globalThis.crypto?.randomUUID?.();
  return uuid ? `week-${uuid}` : `week-${now.getTime()}`;
}

export function createWeekPreparation(
  settings: BudgetSettings,
  listContext: ExistingListContext,
  now: Date = new Date(),
  id: string = createPreparationId(now),
  mealBudgetCents: number | null = null,
): WeekPreparation {
  const timestamp = now.toISOString();
  return {
    schemaVersion: WEEK_PREPARATION_SCHEMA_VERSION,
    id,
    createdAt: timestamp,
    updatedAt: timestamp,
    numberOfPeople: settings.people,
    numberOfDays: settings.days,
    budgetCents: settings.budgetCents,
    mealBudgetCents:
      mealBudgetCents !== null &&
      mealBudgetCents >= 0 &&
      settings.budgetCents !== null &&
      mealBudgetCents <= settings.budgetCents
        ? mealBudgetCents
        : null,
    existingListKnownSubtotalCents: listContext.knownSubtotalCents,
    existingListUnpricedCount: listContext.unpricedItemCount,
    categoryDistribution: emptyCategoryDistribution(),
    preferences: DEFAULT_WEEK_PREFERENCES,
    days: [],
    ingredients: [],
    generation: null,
    customizations: [],
    status: "draft",
    listStrategy: "preserveAndComplete",
  };
}

function withUpdatedAt(
  preparation: WeekPreparation,
  now: Date,
  update: Partial<WeekPreparation>,
): WeekPreparation {
  return { ...preparation, ...update, updatedAt: now.toISOString() };
}

export function distributionProgress(
  distribution: CategoryDistribution,
  numberOfDays: number | null,
): DistributionProgress {
  const assignedDays = MEAL_CATEGORIES.reduce(
    (total, category) => total + distribution[category],
    0,
  );
  const targetDays = numberOfDays ?? 0;
  const difference = targetDays - assignedDays;
  return {
    assignedDays,
    targetDays,
    difference,
    state: difference === 0 ? "exact" : difference > 0 ? "under" : "over",
  };
}

export function updateWeekSettings(
  preparation: WeekPreparation,
  settings: Pick<BudgetSettings, "people" | "days" | "budgetCents">,
  now: Date = new Date(),
): WeekPreparation {
  const daysChanged = preparation.numberOfDays !== settings.days;
  const requiredSettingMissing =
    settings.people === null ||
    settings.days === null ||
    settings.budgetCents === null;
  const next = withUpdatedAt(preparation, now, {
    numberOfPeople: settings.people,
    numberOfDays: settings.days,
    budgetCents: settings.budgetCents,
    mealBudgetCents:
      settings.budgetCents !== null &&
      preparation.mealBudgetCents !== null &&
      preparation.mealBudgetCents <= settings.budgetCents
        ? preparation.mealBudgetCents
        : null,
  });
  if (daysChanged) {
    return {
      ...next,
      days: [],
      ingredients: [],
      generation: null,
      customizations: [],
      status: "draft",
    };
  }
  return requiredSettingMissing
    ? { ...next, ingredients: [], generation: null, customizations: [], status: "draft" }
    : next;
}

export function setMealBudgetCents(
  preparation: WeekPreparation,
  mealBudgetCents: number | null,
  now: Date = new Date(),
): WeekPreparation {
  const valid =
    mealBudgetCents === null ||
    (Number.isSafeInteger(mealBudgetCents) &&
      mealBudgetCents >= 0 &&
      preparation.budgetCents !== null &&
      mealBudgetCents <= preparation.budgetCents);
  if (!valid || preparation.mealBudgetCents === mealBudgetCents) return preparation;
  return withUpdatedAt(preparation, now, { mealBudgetCents });
}

export function updateListSnapshot(
  preparation: WeekPreparation,
  listContext: ExistingListContext,
  now: Date = new Date(),
): WeekPreparation {
  return withUpdatedAt(preparation, now, {
    existingListKnownSubtotalCents: listContext.knownSubtotalCents,
    existingListUnpricedCount: listContext.unpricedItemCount,
  });
}

export function setCategoryCount(
  preparation: WeekPreparation,
  category: MealCategory,
  count: number,
  now: Date = new Date(),
): WeekPreparation {
  if (!Number.isInteger(count) || count < 0 || count > 7) return preparation;
  if (preparation.categoryDistribution[category] === count) return preparation;
  return withUpdatedAt(preparation, now, {
    categoryDistribution: {
      ...preparation.categoryDistribution,
      [category]: count,
    },
    days: [],
    ingredients: [],
    generation: null,
    customizations: [],
    status: "draft",
  });
}

export function setWeekPreference<K extends keyof WeekPreferences>(
  preparation: WeekPreparation,
  preference: K,
  value: WeekPreferences[K],
  now: Date = new Date(),
): WeekPreparation {
  if (preparation.preferences[preference] === value) return preparation;
  return withUpdatedAt(preparation, now, {
    preferences: { ...preparation.preferences, [preference]: value },
  });
}

export function canPrepareWeek(preparation: WeekPreparation): boolean {
  return (
    preparation.numberOfPeople !== null &&
    preparation.numberOfPeople >= 1 &&
    preparation.numberOfPeople <= 12 &&
    preparation.numberOfDays !== null &&
    preparation.numberOfDays >= 1 &&
    preparation.numberOfDays <= 7 &&
    preparation.budgetCents !== null &&
    preparation.budgetCents > 0 &&
    preparation.mealBudgetCents !== null &&
    preparation.mealBudgetCents >= 0 &&
    preparation.mealBudgetCents <= preparation.budgetCents &&
    distributionProgress(
      preparation.categoryDistribution,
      preparation.numberOfDays,
    ).state === "exact"
  );
}

export function distributeCategories(
  distribution: CategoryDistribution,
  numberOfDays: number,
): PreparedDay[] {
  const progress = distributionProgress(distribution, numberOfDays);
  if (progress.state !== "exact") return [];

  const remaining = { ...distribution };
  const assigned: MealCategory[] = [];

  while (assigned.length < numberOfDays) {
    const previous = assigned.at(-1);
    const candidates = MEAL_CATEGORIES.filter(
      (category) => remaining[category] > 0,
    ).sort((left, right) => {
      const countDifference = remaining[right] - remaining[left];
      return countDifference || MEAL_CATEGORIES.indexOf(left) - MEAL_CATEGORIES.indexOf(right);
    });
    const next = candidates.find((category) => category !== previous) ?? candidates[0];
    if (!next) return [];
    assigned.push(next);
    remaining[next] -= 1;
  }

  return assigned.map((category, dayIndex) => ({
    dayIndex,
    category,
    freeChoice: category === "freeChoice",
    recipeId: null,
    recipe: null,
    status: category === "freeChoice" ? "freeChoice" : "categoryAssigned",
  }));
}

export function prepareWeek(
  preparation: WeekPreparation,
  listContext: ExistingListContext,
  now: Date = new Date(),
): WeekPreparation {
  if (!canPrepareWeek(preparation) || preparation.numberOfDays === null) {
    return preparation;
  }
  return withUpdatedAt(preparation, now, {
    existingListKnownSubtotalCents: listContext.knownSubtotalCents,
    existingListUnpricedCount: listContext.unpricedItemCount,
    days: distributeCategories(
      preparation.categoryDistribution,
      preparation.numberOfDays,
    ),
    status: "readyForGeneration",
  });
}

export function changePreparedDayCategory(
  preparation: WeekPreparation,
  dayIndex: number,
  category: MealCategory,
  now: Date = new Date(),
): WeekPreparation {
  if (!["readyForGeneration", "generated", "generationPartial"].includes(preparation.status)) {
    return preparation;
  }
  const currentDay = preparation.days.find((day) => day.dayIndex === dayIndex);
  if (!currentDay || currentDay.category === category) return preparation;

  const days = preparation.days.map((day) =>
    day.dayIndex === dayIndex
      ? {
          ...day,
          category,
          freeChoice: category === "freeChoice",
          recipeId: null,
          recipe: null,
          status: category === "freeChoice" ? "freeChoice" as const : "categoryAssigned" as const,
        }
      : day,
  );
  const categoryDistribution = emptyCategoryDistribution();
  for (const day of days) categoryDistribution[day.category] += 1;

  return withUpdatedAt(preparation, now, {
    days,
    categoryDistribution,
    ingredients: [],
    generation: null,
    status: "readyForGeneration",
  });
}
