import { describe, expect, it } from "vitest";

import { createEmptyActiveShoppingList } from "@/services/shopping-list/shopping-list";
import { SHOPPING_LIST_SCHEMA_VERSION } from "@/types/shopping-list";

import {
  ShoppingListStorageError,
  decodeStoredActiveShoppingList,
  encodeStoredActiveShoppingList,
  type ShoppingListStorage,
} from "./indexeddb-storage";

class MemoryStorage implements ShoppingListStorage {
  private stored: unknown = null;

  async load() {
    return decodeStoredActiveShoppingList(this.stored);
  }

  async save(list: ReturnType<typeof createEmptyActiveShoppingList>) {
    this.stored = structuredClone(encodeStoredActiveShoppingList(list));
  }
}

describe("boodschappenlijstopslag", () => {
  it("bewaart en heropent dezelfde actieve lijst via het storagecontract", async () => {
    const storage = new MemoryStorage();
    const list = createEmptyActiveShoppingList("2026-09-15T10:00:00Z");
    await storage.save(list);
    await expect(storage.load()).resolves.toEqual(list);
  });

  it("legt de schema-versie expliciet naast de lijst vast", () => {
    const stored = encodeStoredActiveShoppingList(
      createEmptyActiveShoppingList("2026-09-15T10:00:00Z"),
    );
    expect(stored.schemaVersion).toBe(SHOPPING_LIST_SCHEMA_VERSION);
    expect(stored.list.schemaVersion).toBe(SHOPPING_LIST_SCHEMA_VERSION);
  });

  it("overschrijft onbekende toekomstige opslagversies niet stilzwijgend", () => {
    expect(() =>
      decodeStoredActiveShoppingList({
        key: "active",
        schemaVersion: 99,
        list: {},
      }),
    ).toThrowError(
      expect.objectContaining<Partial<ShoppingListStorageError>>({
        code: "unsupported-version",
      }),
    );
  });
});
