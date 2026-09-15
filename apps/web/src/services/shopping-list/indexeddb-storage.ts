import {
  SHOPPING_LIST_SCHEMA_VERSION,
  type ActiveShoppingList,
  type ShoppingListItem,
  type ShoppingListItemSource,
  type ShoppingListPriceReference,
} from "@/types/shopping-list";
import {
  SHOPPING_LIST_STORE_NAME,
  openBoodschappenmaatjeDatabase,
} from "@/services/storage/indexeddb";

const ACTIVE_LIST_KEY = "active";

interface StoredActiveShoppingListV1 {
  key: typeof ACTIVE_LIST_KEY;
  schemaVersion: typeof SHOPPING_LIST_SCHEMA_VERSION;
  list: ActiveShoppingList;
}

export type ShoppingListStorageErrorCode =
  | "not-supported"
  | "open-failed"
  | "read-failed"
  | "write-failed"
  | "invalid-data"
  | "unsupported-version";

export class ShoppingListStorageError extends Error {
  constructor(readonly code: ShoppingListStorageErrorCode) {
    super(code);
    this.name = "ShoppingListStorageError";
  }
}

export interface ShoppingListStorage {
  load(): Promise<ActiveShoppingList | null>;
  save(list: ActiveShoppingList): Promise<void>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isItemSource(value: unknown): value is ShoppingListItemSource {
  return [
    "manual",
    "catalog",
    "weekPreparation",
    "recipe",
    "suggestion",
  ].includes(String(value));
}

function isPriceReference(value: unknown): value is ShoppingListPriceReference {
  if (!isRecord(value)) return false;
  return (
    typeof value.productId === "string" &&
    typeof value.sku === "string" &&
    typeof value.amount === "number" &&
    Number.isFinite(value.amount) &&
    value.amount > 0 &&
    typeof value.isOffer === "boolean" &&
    isNullableString(value.updatedAt) &&
    ["fresh", "stale", "unknown"].includes(String(value.freshness)) &&
    typeof value.provider === "string" &&
    (value.validFrom === undefined || isNullableString(value.validFrom)) &&
    (value.validUntil === undefined || isNullableString(value.validUntil))
  );
}

function isShoppingListItem(value: unknown): value is ShoppingListItem {
  if (!isRecord(value)) return false;
  return (
    typeof value.productId === "string" &&
    isNullableString(value.sku) &&
    typeof value.name === "string" &&
    isNullableString(value.brand) &&
    isNullableString(value.packageText) &&
    isNullableString(value.imageUrl) &&
    Number.isInteger(value.quantity) &&
    Number(value.quantity) >= 1 &&
    (value.price === null || isPriceReference(value.price)) &&
    Array.isArray(value.sources) &&
    value.sources.every(isItemSource) &&
    Array.isArray(value.usedIn) &&
    value.usedIn.every((item) => typeof item === "string") &&
    typeof value.createdAt === "string" &&
    typeof value.updatedAt === "string"
  );
}

export function decodeStoredActiveShoppingList(
  value: unknown,
): ActiveShoppingList | null {
  if (value === undefined || value === null) {
    return null;
  }
  if (!isRecord(value)) {
    throw new ShoppingListStorageError("invalid-data");
  }
  if (value.schemaVersion !== SHOPPING_LIST_SCHEMA_VERSION) {
    throw new ShoppingListStorageError("unsupported-version");
  }

  const list = value.list;
  if (
    value.key !== ACTIVE_LIST_KEY ||
    !isRecord(list) ||
    list.schemaVersion !== SHOPPING_LIST_SCHEMA_VERSION ||
    typeof list.startedAt !== "string" ||
    typeof list.updatedAt !== "string" ||
    !Array.isArray(list.items) ||
    !list.items.every(isShoppingListItem)
  ) {
    throw new ShoppingListStorageError("invalid-data");
  }

  return list as unknown as ActiveShoppingList;
}

export function encodeStoredActiveShoppingList(
  list: ActiveShoppingList,
): StoredActiveShoppingListV1 {
  return {
    key: ACTIVE_LIST_KEY,
    schemaVersion: SHOPPING_LIST_SCHEMA_VERSION,
    list,
  };
}

function requestResult<T>(
  request: IDBRequest<T>,
  code: ShoppingListStorageErrorCode,
): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new ShoppingListStorageError(code));
  });
}

function transactionComplete(
  transaction: IDBTransaction,
  code: ShoppingListStorageErrorCode,
): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(new ShoppingListStorageError(code));
    transaction.onabort = () => reject(new ShoppingListStorageError(code));
  });
}

export class IndexedDbShoppingListStorage implements ShoppingListStorage {
  constructor(private readonly factory: IDBFactory) {}

  private async openDatabase(): Promise<IDBDatabase> {
    try {
      return await openBoodschappenmaatjeDatabase(this.factory);
    } catch {
      throw new ShoppingListStorageError("open-failed");
    }
  }

  async load(): Promise<ActiveShoppingList | null> {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(SHOPPING_LIST_STORE_NAME, "readonly");
      const request = transaction
        .objectStore(SHOPPING_LIST_STORE_NAME)
        .get(ACTIVE_LIST_KEY);
      const [stored] = await Promise.all([
        requestResult<unknown>(request, "read-failed"),
        transactionComplete(transaction, "read-failed"),
      ]);
      return decodeStoredActiveShoppingList(stored);
    } finally {
      database.close();
    }
  }

  async save(list: ActiveShoppingList): Promise<void> {
    const database = await this.openDatabase();
    try {
      const transaction = database.transaction(SHOPPING_LIST_STORE_NAME, "readwrite");
      transaction
        .objectStore(SHOPPING_LIST_STORE_NAME)
        .put(encodeStoredActiveShoppingList(list));
      await transactionComplete(transaction, "write-failed");
    } finally {
      database.close();
    }
  }
}

export function createIndexedDbShoppingListStorage(): ShoppingListStorage {
  if (typeof window === "undefined" || !window.indexedDB) {
    throw new ShoppingListStorageError("not-supported");
  }
  return new IndexedDbShoppingListStorage(window.indexedDB);
}
