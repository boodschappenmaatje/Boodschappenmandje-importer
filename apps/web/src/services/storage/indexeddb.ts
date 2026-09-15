export const DATABASE_NAME = "boodschappenmaatje";
export const DATABASE_VERSION = 2;
export const SHOPPING_LIST_STORE_NAME = "shopping-lists";
export const WEEK_PREPARATION_STORE_NAME = "week-preparations";

function ensureStores(database: IDBDatabase): void {
  if (!database.objectStoreNames.contains(SHOPPING_LIST_STORE_NAME)) {
    database.createObjectStore(SHOPPING_LIST_STORE_NAME, { keyPath: "key" });
  }
  if (!database.objectStoreNames.contains(WEEK_PREPARATION_STORE_NAME)) {
    database.createObjectStore(WEEK_PREPARATION_STORE_NAME, { keyPath: "key" });
  }
}

export function openBoodschappenmaatjeDatabase(
  factory: IDBFactory,
): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => ensureStores(request.result);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("indexeddb-open-failed"));
    request.onblocked = () => reject(new Error("indexeddb-open-blocked"));
  });
}

