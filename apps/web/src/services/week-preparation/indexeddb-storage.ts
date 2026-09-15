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
} from "@/types/week-preparation";

const ACTIVE_PREPARATION_KEY = "active";

interface StoredWeekPreparationV2 {
  key: typeof ACTIVE_PREPARATION_KEY;
  schemaVersion: typeof WEEK_PREPARATION_SCHEMA_VERSION;
  preparation: WeekPreparation;
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
    typeof value.recipeName === "string"
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

function isGeneration(value: unknown): boolean {
  return (
    value === null ||
    (isRecord(value) &&
      typeof value.generatedAt === "string" &&
      Number.isSafeInteger(value.knownPurchaseCostCents) &&
      Number(value.knownPurchaseCostCents) >= 0 &&
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
    ["draft", "readyForGeneration", "generating", "generated", "generationPartial", "generationError"].includes(String(value.status)) &&
    value.listStrategy === "preserveAndComplete"
  );
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
    existingListKnownSubtotalCents: Number(value.existingListKnownSubtotalCents),
    existingListUnpricedCount: Number(value.existingListUnpricedCount),
    categoryDistribution: value.categoryDistribution,
    preferences: value.preferences,
    days,
    ingredients: [],
    generation: null,
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
): StoredWeekPreparationV2 {
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

