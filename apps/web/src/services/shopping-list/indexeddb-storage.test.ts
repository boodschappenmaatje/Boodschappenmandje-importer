import { describe, expect, it } from "vitest";

import {
  addCatalogProduct,
  createEmptyActiveShoppingList,
} from "@/services/shopping-list/shopping-list";
import type { Product } from "@/types/catalog";
import type { ActiveShoppingList, ShoppingListItem } from "@/types/shopping-list";
import { SHOPPING_LIST_SCHEMA_VERSION } from "@/types/shopping-list";
import type { SupermarketId } from "@/types/supermarket";

import {
  ShoppingListStorageError,
  decodeStoredActiveShoppingList,
  decodeStoredProviderShoppingList,
  encodeStoredActiveShoppingList,
  encodeStoredProviderShoppingList,
  resolveProviderShoppingListLoad,
  supermarketShoppingListKey,
  type ShoppingListStorage,
} from "./indexeddb-storage";

class MemoryStorage implements ShoppingListStorage {
  private stored = new Map<string, unknown>();

  async load(supermarketId: SupermarketId = "hoogvliet") {
    const targetKey = supermarketShoppingListKey(supermarketId);
    const resolution = resolveProviderShoppingListLoad(
      this.stored.get(targetKey),
      supermarketId === "hoogvliet" ? this.stored.get("active") : undefined,
      supermarketId,
    );
    if (resolution.migratedRecord) this.stored.set(targetKey, resolution.migratedRecord);
    if (resolution.removeLegacy) this.stored.delete("active");
    return resolution.list;
  }

  async save(list: ReturnType<typeof createEmptyActiveShoppingList>, supermarketId: SupermarketId = "hoogvliet") {
    this.stored.set(supermarketShoppingListKey(supermarketId), structuredClone(encodeStoredProviderShoppingList(list, supermarketId)));
  }

  seedLegacy(record: unknown) {
    this.stored.set("active", structuredClone(record));
  }

  keys() {
    return [...this.stored.keys()].sort();
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

  it("migreert de oude lijst naar Hoogvliet met alle gebruikers- en receptdata intact", () => {
    const original = createEmptyActiveShoppingList("2026-09-15T10:00:00Z");
    const list: ActiveShoppingList = {
      ...original,
      items: [{
        checked: true,
        category: "Zuivel",
        productId: "shared-product",
        sku: "123456789",
        name: "Bestaand product",
        brand: "Merk",
        packageText: "2 stuks",
        imageUrl: "https://example.com/image.webp",
        quantity: 3,
        quantityContributions: {
          persistentQuantity: 1,
          mealPlans: [{
            weekPreparationId: "week-a",
            quantity: 2,
            usedIn: ["Gerecht A"],
            ingredientLinks: [{
              weekPreparationId: "week-a",
              dayIndex: 1,
              recipeId: "recipe-a",
              ingredientId: "ingredient-a",
              productId: "shared-product",
              sku: "123456789",
            }],
          }],
        },
        price: {
          productId: "shared-product",
          sku: "123456789",
          amount: 2.5,
          isOffer: true,
          updatedAt: "2026-09-15T09:00:00Z",
          freshness: "fresh" as const,
          provider: "Hoogvliet",
          validFrom: null,
          validUntil: null,
        },
        sources: ["catalog", "manual", "weekPreparation", "suggestion", "recurring"],
        usedIn: ["Gerecht A"],
        createdAt: "2026-09-15T10:00:00Z",
        updatedAt: "2026-09-15T10:05:00Z",
      }],
    };
    const oldRecord = encodeStoredActiveShoppingList(list);

    const firstLoad = resolveProviderShoppingListLoad(undefined, oldRecord, "hoogvliet");
    expect(firstLoad.list).toEqual(list);
    expect(firstLoad.migratedRecord).toEqual(encodeStoredProviderShoppingList(list, "hoogvliet"));
    expect(firstLoad.removeLegacy).toBe(true);

    const secondLoad = resolveProviderShoppingListLoad(firstLoad.migratedRecord, undefined, "hoogvliet");
    expect(secondLoad.list).toEqual(list);
    expect(secondLoad.migratedRecord).toBeNull();
    expect(secondLoad.removeLegacy).toBe(false);
  });

  it("houdt providerlijsten op afzonderlijke IndexedDB-sleutels", () => {
    const hoogvlietList = createEmptyActiveShoppingList("2026-09-15T10:00:00Z");
    const ahList = addCatalogProduct(hoogvlietList, {
      id: "ah-product", supermarket: "Albert Heijn", sku: "ah-sku", name: "AH product",
      brand: null, category: null, productType: null, packageText: null, weightGrams: null,
      imageUrl: null, sourceUrl: "https://example.com/ah-product", isAvailable: true,
      updatedAt: "2026-09-15T10:00:00Z", currentPrice: null,
    }, "catalog");
    const hoogvlietStored = encodeStoredProviderShoppingList(hoogvlietList, "hoogvliet");
    const ahStored = encodeStoredProviderShoppingList(ahList, "ah");

    expect(hoogvlietStored.key).toBe("active:hoogvliet");
    expect(ahStored.key).toBe("active:ah");
    expect(decodeStoredProviderShoppingList(hoogvlietStored, "hoogvliet")).toEqual(hoogvlietList);
    expect(decodeStoredProviderShoppingList(ahStored, "ah")).toEqual(ahList);
    expect(() => decodeStoredProviderShoppingList(ahStored, "hoogvliet")).toThrowError(
      expect.objectContaining({ code: "invalid-data" }),
    );
  });

  it("migreert de bestaande opslag eenmaal en wisselen raakt de andere providerlijst niet", async () => {
    const storage = new MemoryStorage();
    const oldList = createEmptyActiveShoppingList("2026-09-15T10:00:00Z");
    const oldItem: ShoppingListItem = {
      productId: "old-product", sku: "old-sku", name: "Bestaand", brand: null,
      packageText: null, imageUrl: null, quantity: 1, price: null, sources: ["manual"],
      usedIn: [], createdAt: "2026-09-15T10:00:00Z", updatedAt: "2026-09-15T10:00:00Z",
      quantityContributions: { persistentQuantity: 1, mealPlans: [] },
    };
    const preserved = { ...oldList, items: [oldItem] };
    storage.seedLegacy(encodeStoredActiveShoppingList(preserved));

    await expect(storage.load("hoogvliet")).resolves.toEqual(preserved);
    await expect(storage.load("hoogvliet")).resolves.toEqual(preserved);
    expect(storage.keys()).toEqual(["active:hoogvliet"]);

    const otherList = createEmptyActiveShoppingList("2026-09-16T10:00:00Z");
    await storage.save(otherList, "ah");
    expect(await storage.load("hoogvliet")).toEqual(preserved);
    expect(await storage.load("ah")).toEqual(otherList);
    expect(storage.keys()).toEqual(["active:ah", "active:hoogvliet"]);
  });

  it("faalt gesloten als de legacy-lijst en Hoogvliet-lijst allebei bestaan", () => {
    const list = createEmptyActiveShoppingList("2026-09-15T10:00:00Z");
    expect(() => resolveProviderShoppingListLoad(
      encodeStoredProviderShoppingList(list, "hoogvliet"),
      encodeStoredActiveShoppingList(list),
      "hoogvliet",
    )).toThrowError(expect.objectContaining({ code: "invalid-data" }));
    expect(supermarketShoppingListKey("ah")).toBe("active:ah");
  });
});
