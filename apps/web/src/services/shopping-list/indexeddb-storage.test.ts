import { describe, expect, it } from "vitest";

import {
  addCatalogProduct,
  createEmptyActiveShoppingList,
} from "@/services/shopping-list/shopping-list";
import type { Product } from "@/types/catalog";
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

  it("laadt een bestaande PWA 7-lijst zonder reset of schemawijziging", async () => {
    const storage = new MemoryStorage();
    const existingProduct: Product = {
      id: "existing-product",
      supermarket: "Hoogvliet",
      sku: "existing-sku",
      name: "Bestaand product",
      brand: null,
      category: null,
      productType: null,
      packageText: "1 stuk",
      weightGrams: null,
      imageUrl: null,
      sourceUrl: "https://example.com/product",
      isAvailable: true,
      updatedAt: "2026-09-15T10:00:00Z",
      currentPrice: null,
    };
    const existingList = addCatalogProduct(
      createEmptyActiveShoppingList("2026-09-15T10:00:00Z"),
      existingProduct,
      "catalog",
      "2026-09-15T10:01:00Z",
    );

    await storage.save(existingList);
    await expect(storage.load()).resolves.toEqual(existingList);
    expect((await storage.load())?.schemaVersion).toBe(1);
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
