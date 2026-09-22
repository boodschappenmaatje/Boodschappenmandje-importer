import { describe, expect, it } from "vitest";
import type { Product } from "@/types/catalog";
import { calculateBudget } from "@/services/budget/budget-engine";
import { addCatalogProduct, calculateShoppingListTotal, createEmptyActiveShoppingList, groupShoppingListItems, increaseQuantity, refreshShoppingListFromCatalog, removeShoppingListItem, restoreShoppingListItem, toggleShoppingListItem } from "./shopping-list";
import { decodeStoredActiveShoppingList, encodeStoredActiveShoppingList } from "./indexeddb-storage";

const product: Product = { id: "ux-paprika", sku: "ux-sku", name: "Paprika", brand: null, category: "Groente/Fruitgroente", productType: null, packageText: "1 stuk", imageUrl: null, weightGrams: null, supermarket: "Hoogvliet", sourceUrl: "https://example.com/paprika", isAvailable: true, updatedAt: new Date().toISOString(), currentPrice: { productId: "ux-paprika", price: 1.19, oldPrice: null, isOffer: false, offerText: null, fetchedAt: new Date().toISOString(), updatedAt: new Date().toISOString(), validFrom: null, validUntil: null } };
const list = () => addCatalogProduct(createEmptyActiveShoppingList(), product);

describe("direct afvinken met behoud van PWA 9–13", () => {
  it("bewaart afvinken bij heropenen zonder nieuw opslagschema", () => {
    const checked = toggleShoppingListItem(list(), product.id);
    expect(decodeStoredActiveShoppingList(encodeStoredActiveShoppingList(checked))).toEqual(checked);
    expect(checked.schemaVersion).toBe(2);
    expect(checked.items[0].checked).toBe(true);
  });
  it("opent oude items zonder checkveld zonder dataverlies", () => {
    const old = list();
    delete old.items[0].checked;
    delete old.items[0].category;
    expect(decodeStoredActiveShoppingList(encodeStoredActiveShoppingList(old))).toEqual(old);
    expect(groupShoppingListItems(old.items, "remaining")[0][1]).toHaveLength(1);
  });
  it("verandert geen bedragen of bijdrage-eigendom door afvinken", () => {
    const before = list();
    const after = toggleShoppingListItem(before, product.id);
    expect(calculateShoppingListTotal(after)).toEqual(calculateShoppingListTotal(before));
    expect(calculateBudget(10000, after)).toEqual(calculateBudget(10000, before));
    expect(after.items[0].quantityContributions).toEqual(before.items[0].quantityContributions);
    expect(after.items[0].sources).toEqual(before.items[0].sources);
  });
  it("toont dezelfde producten in precies één statusfilter", () => {
    const checked = toggleShoppingListItem(list(), product.id);
    expect(groupShoppingListItems(checked.items, "remaining")).toEqual([]);
    expect(groupShoppingListItems(checked.items, "checked")[0][0]).toBe("Groente");
    expect(groupShoppingListItems(checked.items, "all")[0][1]).toHaveLength(1);
    expect(groupShoppingListItems(toggleShoppingListItem(checked, product.id).items, "remaining")[0][1]).toHaveLength(1);
  });
  it("houdt afvinken vast tijdens prijsrefresh", () => {
    const checked = toggleShoppingListItem(list(), product.id);
    expect(refreshShoppingListFromCatalog(checked, [product]).items[0].checked).toBe(true);
  });
  it("zet een verhoogd of opnieuw toegevoegd product terug bij nog te halen", () => {
    const checked = toggleShoppingListItem(list(), product.id);
    expect(increaseQuantity(checked, product.id).items[0].checked).toBe(false);
    expect(addCatalogProduct(checked, product).items[0].checked).toBe(false);
  });
  it("behoudt de checkstatus bij verwijderen en ongedaan maken", () => {
    const checked = toggleShoppingListItem(list(), product.id);
    const removed = removeShoppingListItem(checked, product.id);
    expect(restoreShoppingListItem(removed.list, removed.removed!).items[0].checked).toBe(true);
  });
  it("weigert corrupte nieuwe velden en negeert een onbekend product-ID", () => {
    const before = list();
    expect(toggleShoppingListItem(before, "missing")).toBe(before);
    expect(() => decodeStoredActiveShoppingList({ ...encodeStoredActiveShoppingList(before), list: { ...before, items: [{ ...before.items[0], checked: "yes" }] } })).toThrow();
  });
});
