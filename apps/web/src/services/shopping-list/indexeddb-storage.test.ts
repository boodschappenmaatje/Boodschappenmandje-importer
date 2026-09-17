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

  it("laadt een bestaande lijst zonder reset en bewaart de huidige schema-versie", async () => {
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
    expect((await storage.load())?.schemaVersion).toBe(2);
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

  it("migreert een v1 handmatig item naar een blijvende hoeveelheid", () => {
    const migrated = decodeStoredActiveShoppingList({
      key: "active",
      schemaVersion: 1,
      list: {
        schemaVersion: 1,
        startedAt: "2026-09-15T10:00:00Z",
        updatedAt: "2026-09-15T10:00:00Z",
        items: [{
          productId: "manual-product",
          sku: "manual-sku",
          name: "Handmatig product",
          brand: null,
          packageText: "1 stuk",
          imageUrl: null,
          quantity: 2,
          price: null,
          sources: ["manual"],
          usedIn: [],
          createdAt: "2026-09-15T10:00:00Z",
          updatedAt: "2026-09-15T10:00:00Z",
        }],
      },
    });
    expect(migrated).toMatchObject({
      schemaVersion: 2,
      items: [{
        quantity: 2,
        quantityContributions: { persistentQuantity: 2, mealPlans: [] },
      }],
    });
  });

  it("migreert een puur v1-weekitem naar een veilig opruimbare legacy-bijdrage", () => {
    const migrated = decodeStoredActiveShoppingList({
      key: "active",
      schemaVersion: 1,
      list: {
        schemaVersion: 1,
        startedAt: "2026-09-15T10:00:00Z",
        updatedAt: "2026-09-15T10:00:00Z",
        items: [{
          productId: "meal-product",
          sku: "meal-sku",
          name: "Maaltijdproduct",
          brand: null,
          packageText: "500 g",
          imageUrl: null,
          quantity: 2,
          price: null,
          sources: ["weekPreparation", "recipe"],
          usedIn: ["Oud gerecht"],
          createdAt: "2026-09-15T10:00:00Z",
          updatedAt: "2026-09-15T10:00:00Z",
        }],
      },
    });
    expect(migrated?.items[0].quantityContributions).toEqual({
      persistentQuantity: 0,
      mealPlans: [{
        weekPreparationId: null,
        quantity: 2,
        usedIn: ["Oud gerecht"],
      }],
    });
  });

  it("behoudt een onreconstrueerbaar gemengd v1-aantal conservatief als gebruikershoeveelheid", () => {
    const migrated = decodeStoredActiveShoppingList({
      key: "active",
      schemaVersion: 1,
      list: {
        schemaVersion: 1,
        startedAt: "2026-09-15T10:00:00Z",
        updatedAt: "2026-09-15T10:00:00Z",
        items: [{
          productId: "mixed-product",
          sku: "mixed-sku",
          name: "Gemengd product",
          brand: null,
          packageText: "1 kg",
          imageUrl: null,
          quantity: 3,
          price: null,
          sources: ["manual", "weekPreparation", "recipe"],
          usedIn: ["Oud gerecht"],
          createdAt: "2026-09-15T10:00:00Z",
          updatedAt: "2026-09-15T10:00:00Z",
        }],
      },
    });
    expect(migrated?.items[0]).toMatchObject({
      quantity: 3,
      sources: ["manual"],
      usedIn: [],
      quantityContributions: { persistentQuantity: 3, mealPlans: [] },
    });
  });
});
