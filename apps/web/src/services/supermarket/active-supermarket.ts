import {
  DEFAULT_SUPERMARKET_ID,
  isSupermarketId,
  type SupermarketId,
} from "@/types/supermarket";

export const ACTIVE_SUPERMARKET_STORAGE_KEY = "boodschappenmaatje:active-supermarket";

export interface SupermarketPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function activeSupermarketFromStorage(
  storage: SupermarketPreferenceStorage,
): SupermarketId {
  let value: string | null;
  try {
    value = storage.getItem(ACTIVE_SUPERMARKET_STORAGE_KEY);
  } catch {
    return DEFAULT_SUPERMARKET_ID;
  }

  if (value === null) return DEFAULT_SUPERMARKET_ID;
  if (isSupermarketId(value)) return value;

  try {
    storage.setItem(ACTIVE_SUPERMARKET_STORAGE_KEY, DEFAULT_SUPERMARKET_ID);
  } catch {
    // Onleesbare voorkeuren mogen het openen van de bestaande lijst niet blokkeren.
  }
  return DEFAULT_SUPERMARKET_ID;
}

export function persistActiveSupermarket(
  storage: SupermarketPreferenceStorage,
  id: SupermarketId,
): void {
  storage.setItem(ACTIVE_SUPERMARKET_STORAGE_KEY, id);
}

export function browserSupermarketPreferenceStorage(): SupermarketPreferenceStorage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}
