import {
  WEEK_PREPARATION_STORE_NAME,
  openBoodschappenmaatjeDatabase,
} from "@/services/storage/indexeddb";
import {
  MEAL_CATEGORIES,
  WEEK_PREPARATION_SCHEMA_VERSION,
  type CategoryDistribution,
  type MealCategory,
  type PreparedDay,
  type WeekIngredientRequirement,
  type WeekPreferences,
  type WeekPreparation,
  type WeekMealCustomization,
} from "@/types/week-preparation";
import { mealMixProfileForIngredient } from "@/services/week-preparation/meal-mix-profiles";

const ACTIVE_PREPARATION_KEY = "active";

interface StoredWeekPreparationV6 {
  key: typeof ACTIVE_PREPARATION_KEY;
  schemaVersion: typeof WEEK_PREPARATION_SCHEMA_VERSION;
  preparation: WeekPreparation;
}

function isBudgetDecision(value: unknown): boolean {
  if (!isRecord(value) || typeof value.mode !== "string") return false;
  if (
    value.mode === "automaticPlanValidation" ||
    value.mode === "userConfirmedManualChoice"
  ) {
    return true;
  }
  return (
    value.mode === "userApprovedBudgetOverride" &&
    typeof value.approvedAt === "string" &&
    Number.isSafeInteger(value.approvedMealPlanCostCents) &&
    Number(value.approvedMealPlanCostCents) >= 0 &&
    Number.isSafeInteger(value.approvedTotalWeekCostCents) &&
    Number(value.approvedTotalWeekCostCents) >= 0
  );
}

function isRecipeReference(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.sourceKey === "string" &&
    typeof value.name === "string"
  );
}

function isCustomization(value: unknown): value is WeekMealCustomization {
  return (
    isRecord(value) &&
    Number.isInteger(value.dayIndex) &&
    Number(value.dayIndex) >= 0 &&
    Number(value.dayIndex) <= 6 &&
    isRecipeReference(value.baseRecipe) &&
    (value.replacementRecipe === null || isRecipeReference(value.replacementRecipe)) &&
    Array.isArray(value.productOverrides) &&
    value.productOverrides.every(
      (override) =>
        isRecord(override) &&
        typeof override.ingredientId === "string" &&
        typeof override.productId === "string" &&
        typeof override.sku === "string" &&
        (override.quantity === null ||
          (Number.isInteger(override.quantity) &&
            Number(override.quantity) >= 1 &&
            Number(override.quantity) <= 99)) &&
        ["automaticSuggestion", "manualSearch"].includes(
          String(override.selectionSource),
        ) &&
        isBudgetDecision(override.budgetDecision) &&
        typeof override.updatedAt === "string",
    ) &&
    Array.isArray(value.ingredientOverrides) &&
    value.ingredientOverrides.every(
      (override) =>
        isRecord(override) &&
        typeof override.ingredientId === "string" &&
        typeof override.substituteIngredientId === "string" &&
        typeof override.substituteSourceKey === "string" &&
        typeof override.quantityMultiplier === "number" &&
        Number.isFinite(override.quantityMultiplier) &&
        Number(override.quantityMultiplier) > 0 &&
        typeof override.updatedAt === "string",
    ) &&
    Array.isArray(value.manualProductAdditions) &&
    value.manualProductAdditions.every(
      (addition) =>
        isRecord(addition) &&
        typeof addition.id === "string" &&
        isProductReference(addition.product) &&
        isPriceSnapshot(addition.price) &&
        Number.isInteger(addition.quantity) &&
        Number(addition.quantity) >= 1 &&
        Number(addition.quantity) <= 99 &&
        isBudgetDecision(addition.budgetDecision) &&
        typeof addition.updatedAt === "string",
    ) &&
    typeof value.updatedAt === "string"
  );
}

export type WeekPreparationStorageErrorCode =
  | "not-supported"
  | "open-failed"
  | "read-failed"
  | "write-failed"
  | "invalid-data"
  | "unsupported-version";

export class WeekPreparationStorageError extends Error {
  constructor(readonly code: WeekPreparationStorageErrorCode) {
    super(code);
    this.name = "WeekPreparationStorageError";
  }
}

export interface WeekPreparationStorage {
  load(): Promise<WeekPreparation | null>;
  save(preparation: WeekPreparation): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableIntegerInRange(
  value: unknown,
  minimum: number,
  maximum: number,
): boolean {
  return value === null || (Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum);
}

function isCategory(value: unknown): value is MealCategory {
  return MEAL_CATEGORIES.includes(value as MealCategory);
}

function isDistribution(value: unknown): value is CategoryDistribution {
  return (
    isRecord(value) &&
    MEAL_CATEGORIES.every(
      (category) =>
        Number.isInteger(value[category]) &&
        Number(value[category]) >= 0 &&
        Number(value[category]) <= 7,
    )
  );
}

function isPreferences(value: unknown): value is WeekPreferences {
  return (
    isRecord(value) &&
    typeof value.noVegetarian === "boolean" &&
    typeof value.quickImportant === "boolean" &&
    typeof value.healthyImportant === "boolean" &&
    typeof value.budgetImportant === "boolean"
  );
}

function isPreparedDay(value: unknown): value is PreparedDay {
  if (
    !isRecord(value) ||
    !Number.isInteger(value.dayIndex) ||
    Number(value.dayIndex) < 0 ||
    Number(value.dayIndex) > 6 ||
    !isCategory(value.category) ||
    typeof value.freeChoice !== "boolean"
  ) {
    return false;
  }
  const recipeValid =
    value.recipe === null ||
    (isRecord(value.recipe) &&
      typeof value.recipe.id === "string" &&
      typeof value.recipe.sourceKey === "string" &&
      typeof value.recipe.name === "string");
  return (
    (value.recipeId === null || typeof value.recipeId === "string") &&
    recipeValid &&
    ["categoryAssigned", "recipeSelected", "freeChoice"].includes(
      String(value.status),
    )
  );
}

function isUse(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.recipeId === "string" &&
    typeof value.recipeName === "string" &&
    Number.isInteger(value.dayIndex) &&
    Number(value.dayIndex) >= 0 &&
    Number(value.dayIndex) <= 6 &&
    typeof value.requiredQuantity === "number" &&
    Number.isFinite(value.requiredQuantity) &&
    Number(value.requiredQuantity) > 0
  );
}

function isProductReference(value: unknown): boolean {
  return (
    isRecord(value) &&
    typeof value.productId === "string" &&
    typeof value.sku === "string" &&
    typeof value.name === "string" &&
    (value.brand === null || typeof value.brand === "string") &&
    (value.packageText === null || typeof value.packageText === "string") &&
    (value.imageUrl === null || typeof value.imageUrl === "string") &&
    typeof value.supermarket === "string" &&
    typeof value.sourceUrl === "string"
  );
}

function isPriceSnapshot(value: unknown): boolean {
  return (
    isRecord(value) &&
    Number.isSafeInteger(value.amountCents) &&
    Number(value.amountCents) > 0 &&
    typeof value.isOffer === "boolean" &&
    (value.updatedAt === null || typeof value.updatedAt === "string") &&
    ["fresh", "stale", "unknown"].includes(String(value.freshness))
  );
}

function isIngredient(value: unknown): value is WeekIngredientRequirement {
  return (
    isRecord(value) &&
    typeof value.ingredientId === "string" &&
    typeof value.sourceKey === "string" &&
    typeof value.name === "string" &&
    ["g", "kg", "ml", "l", "piece", "loaf"].includes(String(value.unit)) &&
    typeof value.optional === "boolean" &&
    value.servingsBase === 1 &&
    ["ingredient", "mealMix"].includes(String(value.kind)) &&
    (value.brandConstraint === null ||
      ["Knorr", "Honig"].includes(String(value.brandConstraint))) &&
    typeof value.requiredQuantity === "number" &&
    Number.isFinite(value.requiredQuantity) &&
    Number(value.requiredQuantity) > 0 &&
    (value.purchaseQuantity === null ||
      (Number.isInteger(value.purchaseQuantity) &&
        Number(value.purchaseQuantity) > 0)) &&
    (value.packageCapacity === null ||
      (typeof value.packageCapacity === "number" &&
        Number.isFinite(value.packageCapacity) &&
        Number(value.packageCapacity) > 0)) &&
    Array.isArray(value.usedIn) &&
    value.usedIn.every(isUse) &&
    (value.product === null || isProductReference(value.product)) &&
    (value.price === null || isPriceSnapshot(value.price)) &&
    typeof value.productMatchMissing === "boolean" &&
    typeof value.packageCalculationMissing === "boolean"
  );
}

function migrateV2Preparation(value: unknown): WeekPreparation | null {
  if (!isRecord(value) || value.schemaVersion !== 2 || !Array.isArray(value.ingredients)) {
    return null;
  }
  const people = Number(value.numberOfPeople);
  const days = Array.isArray(value.days) ? value.days : [];
  const ingredients = value.ingredients.map((raw) => {
    if (!isRecord(raw) || typeof raw.sourceKey !== "string") return raw;
    const profile = mealMixProfileForIngredient(raw.sourceKey);
    const legacyUses = Array.isArray(raw.usedIn) ? raw.usedIn : [];
    const useCount = Math.max(1, legacyUses.length);
    const migratedQuantity =
      profile && Number.isInteger(people) && people > 0
        ? Math.ceil(people / profile.servingsPerPackage)
        : Number(raw.requiredQuantity);
    return {
      ...raw,
      unit: profile ? "piece" : raw.unit,
      kind: profile ? "mealMix" : "ingredient",
      brandConstraint: profile?.brand ?? null,
      requiredQuantity: migratedQuantity,
      purchaseQuantity:
        profile && raw.product !== null ? migratedQuantity : raw.purchaseQuantity,
      packageCapacity: profile && raw.product !== null ? 1 : raw.packageCapacity,
      packageCalculationMissing:
        profile && raw.product !== null ? false : raw.packageCalculationMissing,
      usedIn: legacyUses.map((use, index) => {
        if (!isRecord(use)) return use;
        const matchingDays = days.filter(
          (day) => isRecord(day) && day.recipeId === use.recipeId,
        );
        const matchingDay = matchingDays[index] ?? matchingDays[0];
        return {
          ...use,
          dayIndex:
            isRecord(matchingDay) && Number.isInteger(matchingDay.dayIndex)
              ? Number(matchingDay.dayIndex)
              : 0,
          requiredQuantity: migratedQuantity / useCount,
        };
      }),
    };
  });
  const migrated = {
    ...value,
    schemaVersion: 3,
    ingredients,
  };
  return migrateV3Preparation(migrated);
}

function migrateV3Preparation(value: unknown): WeekPreparation | null {
  if (!isRecord(value) || value.schemaVersion !== 3) return null;
  const generation = value.generation;
  const migratedGeneration =
    generation === null
      ? null
      : isRecord(generation)
        ? {
            ...generation,
            mealPlanKnownCostCents: Number(generation.knownPurchaseCostCents ?? 0),
            mealBudgetRemainingCents: null,
            nonMealReservedCents: null,
            totalKnownWeekCostCents: Number(generation.knownPurchaseCostCents ?? 0),
            mealBudgetStatus: "noMealBudget",
            weekBudgetStatus: "incompletePrices",
            isMealBudgetComplete: false,
            mealBudgetCandidateCount: 0,
            mealBudgetRejectedCount: 0,
          }
        : generation;
  const migrated = {
    ...value,
    schemaVersion: WEEK_PREPARATION_SCHEMA_VERSION,
    mealBudgetCents: null,
    generation: migratedGeneration,
  };
  return isPreparation(migrated) ? migrated : null;
}

function isGeneration(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.generatedAt === "string" &&
      Number.isSafeInteger(value.knownPurchaseCostCents) &&
      Number(value.knownPurchaseCostCents) >= 0 &&
      Number.isSafeInteger(value.mealPlanKnownCostCents) &&
      Number(value.mealPlanKnownCostCents) >= 0 &&
      (value.mealBudgetRemainingCents === null ||
        (Number.isSafeInteger(value.mealBudgetRemainingCents) && Number(value.mealBudgetRemainingCents) >= 0)) &&
      (value.nonMealReservedCents === null ||
        (Number.isSafeInteger(value.nonMealReservedCents) && Number(value.nonMealReservedCents) >= 0)) &&
      Number.isSafeInteger(value.totalKnownWeekCostCents) &&
      Number(value.totalKnownWeekCostCents) >= 0 &&
      ["noMealBudget", "withinMealBudget", "exactlyMealBudget", "overMealBudget", "incompleteValidation", "noValidMealPlanWithinBudget"].includes(String(value.mealBudgetStatus)) &&
      ["noBudget", "underBudget", "exactlyBudget", "overBudget", "incompletePrices"].includes(String(value.weekBudgetStatus)) &&
      typeof value.isMealBudgetComplete === "boolean" &&
      Number.isInteger(value.mealBudgetCandidateCount) && Number(value.mealBudgetCandidateCount) >= 0 &&
      Number.isInteger(value.mealBudgetRejectedCount) && Number(value.mealBudgetRejectedCount) >= 0 &&
      (value.readinessByCategory === undefined ||
        (Array.isArray(value.readinessByCategory) &&
          value.readinessByCategory.every(
            (item) =>
              isRecord(item) &&
              MEAL_CATEGORIES.filter((category) => category !== "freeChoice").includes(
                item.category as Exclude<MealCategory, "freeChoice">,
              ) &&
              Number.isInteger(item.candidateCount) &&
              Number(item.candidateCount) >= 0 &&
              Number.isInteger(item.readyCount) &&
              Number(item.readyCount) >= 0 &&
              Number(item.readyCount) <= Number(item.candidateCount),
          ))) &&
      (value.lowestCompleteMealPlanCostCents === undefined ||
        value.lowestCompleteMealPlanCostCents === null ||
        (Number.isSafeInteger(value.lowestCompleteMealPlanCostCents) &&
          Number(value.lowestCompleteMealPlanCostCents) >= 0)) &&
      (value.lowestCompleteMealPlanCostReliable === undefined ||
        typeof value.lowestCompleteMealPlanCostReliable === "boolean") &&
      ["matchedProductCount", "missingProductMatchCount", "missingPackageCalculationCount", "missingPriceCount"].every(
        (field) =>
          Number.isInteger(value[field]) && Number(value[field]) >= 0,
      ))
  );
}

function isPreparation(value: unknown): value is WeekPreparation {
  if (!isRecord(value)) return false;
  return (
    value.schemaVersion === WEEK_PREPARATION_SCHEMA_VERSION &&
    typeof value.id === "string" &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string" &&
    isNullableIntegerInRange(value.numberOfPeople, 1, 12) &&
    isNullableIntegerInRange(value.numberOfDays, 1, 7) &&
    (value.budgetCents === null || (Number.isSafeInteger(value.budgetCents) && Number(value.budgetCents) > 0)) &&
    (value.mealBudgetCents === null ||
      (Number.isSafeInteger(value.mealBudgetCents) &&
        Number(value.mealBudgetCents) >= 0 &&
        value.budgetCents !== null &&
        Number(value.mealBudgetCents) <= Number(value.budgetCents))) &&
    Number.isSafeInteger(value.existingListKnownSubtotalCents) &&
    Number(value.existingListKnownSubtotalCents) >= 0 &&
    Number.isInteger(value.existingListUnpricedCount) &&
    Number(value.existingListUnpricedCount) >= 0 &&
    isDistribution(value.categoryDistribution) &&
    isPreferences(value.preferences) &&
    Array.isArray(value.days) &&
    value.days.every(isPreparedDay) &&
    Array.isArray(value.ingredients) &&
    value.ingredients.every(isIngredient) &&
    isGeneration(value.generation) &&
    Array.isArray(value.customizations) &&
    value.customizations.every(isCustomization) &&
    ["draft", "readyForGeneration", "generating", "generated", "generationPartial", "generationError"].includes(String(value.status)) &&
    value.listStrategy === "preserveAndComplete"
  );
}

function migrateV4Preparation(value: unknown): WeekPreparation | null {
  if (!isRecord(value) || value.schemaVersion !== 4) return null;
  const migrated = {
    ...value,
    schemaVersion: WEEK_PREPARATION_SCHEMA_VERSION,
    customizations: [],
  };
  return isPreparation(migrated) ? migrated : null;
}

function migrateV5Preparation(value: unknown): WeekPreparation | null {
  if (!isRecord(value) || value.schemaVersion !== 5) return null;
  const customizations = Array.isArray(value.customizations)
    ? value.customizations.map((customization) => {
        if (!isRecord(customization)) return customization;
        const productOverrides = Array.isArray(customization.productOverrides)
          ? customization.productOverrides.map((override) =>
              isRecord(override)
                ? {
                    ...override,
                    quantity: null,
                    selectionSource: "automaticSuggestion",
                    budgetDecision: { mode: "automaticPlanValidation" },
                  }
                : override,
            )
          : customization.productOverrides;
        return {
          ...customization,
          productOverrides,
          manualProductAdditions: [],
        };
      })
    : value.customizations;
  const migrated = {
    ...value,
    schemaVersion: WEEK_PREPARATION_SCHEMA_VERSION,
    customizations,
  };
  return isPreparation(migrated) ? migrated : null;
}

function migrateV1Preparation(value: unknown): WeekPreparation | null {
  if (!isRecord(value) || value.schemaVersion !== 1) return null;
  if (
    typeof value.id !== "string" ||
    typeof value.createdAt !== "string" ||
    typeof value.updatedAt !== "string" ||
    !isNullableIntegerInRange(value.numberOfPeople, 1, 12) ||
    !isNullableIntegerInRange(value.numberOfDays, 1, 7) ||
    (value.budgetCents !== null &&
      (!Number.isSafeInteger(value.budgetCents) || Number(value.budgetCents) <= 0)) ||
    !Number.isSafeInteger(value.existingListKnownSubtotalCents) ||
    Number(value.existingListKnownSubtotalCents) < 0 ||
    !Number.isInteger(value.existingListUnpricedCount) ||
    Number(value.existingListUnpricedCount) < 0 ||
    !isDistribution(value.categoryDistribution) ||
    !isPreferences(value.preferences) ||
    !Array.isArray(value.days) ||
    !["draft", "readyForGeneration"].includes(String(value.status)) ||
    value.listStrategy !== "preserveAndComplete"
  ) {
    return null;
  }

  const days: PreparedDay[] = [];
  for (const legacyDay of value.days) {
    if (
      !isRecord(legacyDay) ||
      !Number.isInteger(legacyDay.dayIndex) ||
      Number(legacyDay.dayIndex) < 0 ||
      Number(legacyDay.dayIndex) > 6 ||
      !isCategory(legacyDay.category) ||
      typeof legacyDay.freeChoice !== "boolean" ||
      legacyDay.recipeId !== null
    ) {
      return null;
    }
    days.push({
      dayIndex: Number(legacyDay.dayIndex),
      category: legacyDay.category,
      freeChoice: legacyDay.freeChoice,
      recipeId: null,
      recipe: null,
      status: legacyDay.freeChoice ? "freeChoice" : "categoryAssigned",
    });
  }

  return {
    schemaVersion: WEEK_PREPARATION_SCHEMA_VERSION,
    id: value.id,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    numberOfPeople: value.numberOfPeople as number | null,
    numberOfDays: value.numberOfDays as number | null,
    budgetCents: value.budgetCents as number | null,
    mealBudgetCents: null,
    existingListKnownSubtotalCents: Number(value.existingListKnownSubtotalCents),
    existingListUnpricedCount: Number(value.existingListUnpricedCount),
    categoryDistribution: value.categoryDistribution,
    preferences: value.preferences,
    days,
    ingredients: [],
    generation: null,
    customizations: [],
    status: value.status as "draft" | "readyForGeneration",
    listStrategy: "preserveAndComplete",
  };
}

export function decodeStoredWeekPreparation(value: unknown): WeekPreparation | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) throw new WeekPreparationStorageError("invalid-data");
  if (value.key !== ACTIVE_PREPARATION_KEY) {
    throw new WeekPreparationStorageError("invalid-data");
  }
  if (value.schemaVersion === 1) {
    const migrated = migrateV1Preparation(value.preparation);
    if (!migrated) throw new WeekPreparationStorageError("invalid-data");
    return migrated;
  }
  if (value.schemaVersion === 2) {
    const migrated = migrateV2Preparation(value.preparation);
    if (!migrated) throw new WeekPreparationStorageError("invalid-data");
    return migrated;
  }
  if (value.schemaVersion === 3) {
    const migrated = migrateV3Preparation(value.preparation);
    if (!migrated) throw new WeekPreparationStorageError("invalid-data");
    return migrated;
  }
  if (value.schemaVersion === 4) {
    const migrated = migrateV4Preparation(value.preparation);
    if (!migrated) throw new WeekPreparationStorageError("invalid-data");
    return migrated;
  }
  if (value.schemaVersion === 5) {
    const migrated = migrateV5Preparation(value.preparation);
    if (!migrated) throw new WeekPreparationStorageError("invalid-data");
    return migrated;
  }
  if (value.schemaVersion !== WEEK_PREPARATION_SCHEMA_VERSION) {
    throw new WeekPreparationStorageError("unsupported-version");
  }
  if (!isPreparation(value.preparation)) {
    throw new WeekPreparationStorageError("invalid-data");
  }
  return value.preparation;
}

export function encodeStoredWeekPreparation(
  preparation: WeekPreparation,
): StoredWeekPreparationV6 {
  return {
    key: ACTIVE_PREPARATION_KEY,
    schemaVersion: WEEK_PREPARATION_SCHEMA_VERSION,
    preparation,
  };
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new WeekPreparationStorageError("read-failed"));
  });
}

function transactionComplete(
  transaction: IDBTransaction,
  code: "read-failed" | "write-failed",
): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new WeekPreparationStorageError(code));
    transaction.onabort = () => reject(new WeekPreparationStorageError(code));
  });
}

export class IndexedDbWeekPreparationStorage implements WeekPreparationStorage {
  constructor(private readonly factory: IDBFactory) {}

  private async openDatabase(): Promise<IDBDatabase> {
    try {
      return await openBoodschappenmaatjeDatabase(this.factory);
    } catch {
      throw new WeekPreparationStorageError("open-failed");
    }
  }

  async load(): Promise<WeekPreparation | null> {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(
        WEEK_PREPARATION_STORE_NAME,
        "readonly",
      );
      const request = transaction
        .objectStore(WEEK_PREPARATION_STORE_NAME)
        .get(ACTIVE_PREPARATION_KEY);
      const [stored] = await Promise.all([
        requestResult<unknown>(request),
        transactionComplete(transaction, "read-failed"),
      ]);
      return decodeStoredWeekPreparation(stored);
    } finally {
      database.close();
    }
  }

  async save(preparation: WeekPreparation): Promise<void> {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(
        WEEK_PREPARATION_STORE_NAME,
        "readwrite",
      );
      transaction
        .objectStore(WEEK_PREPARATION_STORE_NAME)
        .put(encodeStoredWeekPreparation(preparation));
      await transactionComplete(transaction, "write-failed");
    } finally {
      database.close();
    }
  }
}

export function createIndexedDbWeekPreparationStorage(): WeekPreparationStorage {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new WeekPreparationStorageError("not-supported");
  }
  return new IndexedDbWeekPreparationStorage(window.indexedDB);
}
