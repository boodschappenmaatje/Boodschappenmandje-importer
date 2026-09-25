import { describe, expect, it } from "vitest";

import type { Product } from "@/types/catalog";

import {
  ShoppingListIdentityError,
  addCatalogProduct,
  calculateShoppingListTotal,
  createEmptyActiveShoppingList,
  decreaseQuantity,
  increaseQuantity,
  refreshShoppingListFromCatalog,
  removeShoppingListItem,
  restoreShoppingListItem,
} from "./shopping-list";

const NOW = "2026-09-15T10:00:00Z";

function product(
  id: string,
  sku: string,
  name: string,
  price: number | null = 2.5,
): Product {
  return {
    id,
    supermarket: "Hoogvliet",
    sku,
    name,
    brand: "Merk",
    category: "Categorie",
    productType: null,
    packageText: "1 stuk",
    weightGrams: null,
    imageUrl: null,
    sourceUrl: `https://example.com/${sku}`,
    isAvailable: true,
    updatedAt: NOW,
    currentPrice:
      price === null
        ? null
        : {
            productId: id,
            price,
            oldPrice: null,
            isOffer: false,
            offerText: null,
            validFrom: null,
            validUntil: null,
            fetchedAt: NOW,
            updatedAt: NOW,
          },
  };
}

describe("actieve boodschappenlijstmotor", () => {
  it("start leeg zonder verzonnen items of bedragen", () => {
    const list = createEmptyActiveShoppingList(NOW);
    expect(list.items).toEqual([]);
    expect(calculateShoppingListTotal(list).availableTotal).toBeNull();
  });

  it("voegt een echt catalogusproduct met bron en toekomstig usedIn-veld toe", () => {
    const list = addCatalogProduct(
      createEmptyActiveShoppingList(NOW),
      product("a", "sku-a", "Melk"),
      "catalog",
      NOW,
    );
    expect(list.items[0]).toMatchObject({
      productId: "a",
      sku: "sku-a",
      name: "Melk",
      quantity: 1,
      sources: ["catalog"],
      usedIn: [],
    });
  });

  it("dedupliceert op product-ID en SKU en verhoogt hetzelfde product naar twee", () => {
    const first = addCatalogProduct(
      createEmptyActiveShoppingList(NOW),
      product("a", "sku-a", "Melk"),
      "catalog",
      NOW,
    );
    const second = addCatalogProduct(first, product("a", "sku-a", "Melk"));
    expect(second.items).toHaveLength(1);
    expect(second.items[0].quantity).toBe(2);
  });

  it("maakt voor een ander product een aparte regel", () => {
    const first = addCatalogProduct(
      createEmptyActiveShoppingList(NOW),
      product("a", "sku-a", "Melk"),
    );
    const second = addCatalogProduct(first, product("b", "sku-b", "Brood"));
    expect(second.items.map((item) => item.productId)).toEqual(["a", "b"]);
  });

  it("weigert een conflicterende SKU voor hetzelfde product-ID", () => {
    const list = addCatalogProduct(
      createEmptyActiveShoppingList(NOW),
      product("a", "sku-a", "Melk"),
    );
    expect(() =>
      addCatalogProduct(list, product("a", "verkeerde-sku", "Ander product")),
    ).toThrow(ShoppingListIdentityError);
  });

  it("verhoogt, verlaagt en bewaakt minimumaantal één", () => {
    const list = addCatalogProduct(
      createEmptyActiveShoppingList(NOW),
      product("a", "sku-a", "Melk"),
    );
    const increased = increaseQuantity(list, "a");
    const decreased = decreaseQuantity(increased, "a");
    const minimum = decreaseQuantity(decreased, "a");
    expect(increased.items[0].quantity).toBe(2);
    expect(decreased.items[0].quantity).toBe(1);
    expect(minimum).toBe(decreased);
  });

  it("blijft lokaal bewerkbaar zonder netwerk- of catalogusresultaat", () => {
    let list = addCatalogProduct(
      createEmptyActiveShoppingList(NOW),
      product("a", "sku-a", "Melk"),
    );
    list = increaseQuantity(list, "a");
    const result = removeShoppingListItem(list, "a");
    expect(result.list.items).toEqual([]);
    expect(result.removed?.item.quantity).toBe(2);
  });

  it("verwijdert en herstelt hetzelfde item op dezelfde positie", () => {
    let list = addCatalogProduct(
      createEmptyActiveShoppingList(NOW),
      product("a", "sku-a", "Melk"),
    );
    list = addCatalogProduct(list, product("b", "sku-b", "Brood"));
    const result = removeShoppingListItem(list, "a");
    expect(result.list.items.map((item) => item.productId)).toEqual(["b"]);
    expect(result.removed).not.toBeNull();

    const restored = restoreShoppingListItem(result.list, result.removed!);
    expect(restored.items.map((item) => item.productId)).toEqual(["a", "b"]);
    expect(restored.items[0].quantity).toBe(1);
  });

  it("berekent prijs maal aantal en markeert een deels bekend totaal", () => {
    let list = addCatalogProduct(
      createEmptyActiveShoppingList(NOW),
      product("a", "sku-a", "Melk", 2.5),
    );
    list = increaseQuantity(list, "a");
    list = addCatalogProduct(list, product("b", "sku-b", "Brood", null));
    expect(calculateShoppingListTotal(list)).toEqual({
      availableTotal: 5,
      pricedItemCount: 1,
      missingPriceItemCount: 1,
      isPartial: true,
    });
  });

  it("ververst alleen exacte productidentiteiten en behoudt laatst bekende prijzen", () => {
    const original = addCatalogProduct(
      createEmptyActiveShoppingList(NOW),
      product("a", "sku-a", "Melk", 2.5),
    );
    const refreshed = refreshShoppingListFromCatalog(
      original,
      [product("a", "sku-a", "Melk", 2.75)],
      "2026-09-15T11:00:00Z",
    );
    expect(refreshed.items[0].price?.amount).toBe(2.75);

    const withoutPrice = refreshShoppingListFromCatalog(
      refreshed,
      [product("a", "sku-a", "Melk", null)],
      "2026-09-15T12:00:00Z",
    );
    expect(withoutPrice.items[0].price?.amount).toBe(2.75);

    const conflictingSku = refreshShoppingListFromCatalog(
      refreshed,
      [product("a", "andere-sku", "Verkeerd product", 9.99)],
      "2026-09-15T13:00:00Z",
    );
    expect(conflictingSku).toBe(refreshed);
    expect(conflictingSku.items[0].price?.amount).toBe(2.75);
  });

  it("laat een lopende bevestiging intact als periodieke cataloguscontrole niets heeft veranderd", () => {
    const selected = product("a", "sku-a", "Melk", 2.5);
    const original = addCatalogProduct(createEmptyActiveShoppingList(NOW), selected);
    const refreshed = refreshShoppingListFromCatalog(original, [selected], "2026-09-15T11:00:00Z");
    expect(refreshed).toBe(original);
    expect(refreshed.items[0]).toBe(original.items[0]);
    const newer = { ...selected, currentPrice: { ...selected.currentPrice!, price: 2.75, updatedAt: "2026-09-15T12:00:00Z" } };
    const changed = refreshShoppingListFromCatalog(refreshed, [newer], "2026-09-15T12:00:00Z");
    expect(changed).not.toBe(original);
    expect(changed.items[0].price?.amount).toBe(2.75);
    expect(changed.items[0].quantity).toBe(original.items[0].quantity);
  });
});
