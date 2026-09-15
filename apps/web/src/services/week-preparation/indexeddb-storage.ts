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
  type WeekPreparation,
  type WeekPreferences,
} from "@/types/week-preparation";

const ACTIVE_PREPARATION_KEY = "active";

interface StoredWeekPreparationV1 {
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
  return (
    isRecord(value) &&
    Number.isInteger(value.dayIndex) &&
    Number(value.dayIndex) >= 0 &&
    Number(value.dayIndex) <= 6 &&
    isCategory(value.category) &&
    typeof value.freeChoice === "boolean" &&
    value.recipeId === null &&
    value.status === "categoryAssigned"
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
    ["draft", "readyForGeneration"].includes(String(value.status)) &&
    value.listStrategy === "preserveAndComplete"
  );
}

export function decodeStoredWeekPreparation(value: unknown): WeekPreparation | null {
  if (value === undefined || value === null) return null;
  if (!isRecord(value)) throw new WeekPreparationStorageError("invalid-data");
  if (value.schemaVersion !== WEEK_PREPARATION_SCHEMA_VERSION) {
    throw new WeekPreparationStorageError("unsupported-version");
  }
  if (
    value.key !== ACTIVE_PREPARATION_KEY ||
    !isPreparation(value.preparation)
  ) {
    throw new WeekPreparationStorageError("invalid-data");
  }
  return value.preparation;
}

export function encodeStoredWeekPreparation(
  preparation: WeekPreparation,
): StoredWeekPreparationV1 {
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

