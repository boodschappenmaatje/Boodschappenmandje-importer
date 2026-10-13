import { describe, expect, it } from "vitest";

import {
  ACTIVE_SUPERMARKET_STORAGE_KEY,
  activeSupermarketFromStorage,
  persistActiveSupermarket,
  type SupermarketPreferenceStorage,
} from "./active-supermarket";

class MemoryPreferenceStorage implements SupermarketPreferenceStorage {
  values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("actieve supermarktvoorkeur", () => {
  it("onthoudt een expliciete supermarktkeuze na een nieuwe appstart", () => {
    const storage = new MemoryPreferenceStorage();
    persistActiveSupermarket(storage, "hoogvliet");

    expect(activeSupermarketFromStorage(storage)).toBe("hoogvliet");
    expect(storage.getItem(ACTIVE_SUPERMARKET_STORAGE_KEY)).toBe("hoogvliet");
  });

  it("valt bij een onbekende opgeslagen provider veilig terug op Hoogvliet", () => {
    const storage = new MemoryPreferenceStorage();
    storage.setItem(ACTIVE_SUPERMARKET_STORAGE_KEY, "unknown-store");

    expect(activeSupermarketFromStorage(storage)).toBe("hoogvliet");
    expect(storage.getItem(ACTIVE_SUPERMARKET_STORAGE_KEY)).toBe("hoogvliet");
  });

  it("valt veilig terug op Hoogvliet wanneer de voorkeur niet leesbaar is", () => {
    const storage: SupermarketPreferenceStorage = {
      getItem: () => { throw new Error("storage-blocked"); },
      setItem: () => { throw new Error("storage-blocked"); },
    };
    expect(activeSupermarketFromStorage(storage)).toBe("hoogvliet");
  });
});
