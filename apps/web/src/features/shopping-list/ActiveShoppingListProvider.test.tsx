// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import {
  ActiveShoppingListProvider,
  useActiveShoppingList,
} from "@/features/shopping-list/ActiveShoppingListProvider";
import { addCatalogProduct, createEmptyActiveShoppingList } from "@/services/shopping-list/shopping-list";
import { supermarketShoppingListKey, type ShoppingListStorage } from "@/services/shopping-list/indexeddb-storage";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type { Product } from "@/types/catalog";
import type { SupermarketId } from "@/types/supermarket";

class ProviderListStorage implements ShoppingListStorage {
  private lists = new Map<SupermarketId, ActiveShoppingList>();

  seed(id: SupermarketId, list: ActiveShoppingList) {
    this.lists.set(id, structuredClone(list));
  }

  async load(id: SupermarketId = "hoogvliet") {
    return structuredClone(this.lists.get(id) ?? null);
  }

  async save(list: ActiveShoppingList, id: SupermarketId = "hoogvliet") {
    this.lists.set(id, structuredClone(list));
  }

  keys() {
    return [...this.lists.keys()].map(supermarketShoppingListKey).sort();
  }
}

const hoogvlietProduct: Product = {
  id: "hoogvliet-product", supermarket: "Hoogvliet", sku: "100000001", name: "Hoogvliet product",
  brand: null, category: null, productType: null, packageText: null, weightGrams: null,
  imageUrl: null, sourceUrl: "https://example.test/hoogvliet", isAvailable: true,
  updatedAt: "2026-10-13T10:00:00Z", currentPrice: null,
};
const ahProduct: Product = {
  ...hoogvlietProduct, id: "ah-product", supermarket: "Albert Heijn", sku: "200000002", name: "AH product",
  sourceUrl: "https://example.test/ah",
};

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function Probe() {
  const shoppingList = useActiveShoppingList();
  return h("div", null,
    h("span", { id: "active-store" }, shoppingList.supermarketId),
    h("span", { id: "active-products" }, shoppingList.list?.items.map(item => `${item.productId}:${item.quantity}`).join(",") ?? ""),
    h("button", { id: "switch-ah", onClick: () => { void shoppingList.setActiveSupermarket("ah"); } }, "AH"),
    h("button", { id: "switch-high", onClick: () => { void shoppingList.setActiveSupermarket("hoogvliet"); } }, "Hoogvliet"),
    h("button", { id: "increase-ah-product", onClick: () => { void shoppingList.increase("ah-product"); } }, "Meer AH"),
  );
}

async function render(storage: ShoppingListStorage) {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(h(ActiveShoppingListProvider, { storage }, h(Probe))));
  await vi.waitFor(() => expect(container?.querySelector("#active-store")?.textContent).toBeTruthy());
  await act(async () => { await Promise.resolve(); });
}

async function click(selector: string, expectedStore: string) {
  const button = container?.querySelector<HTMLButtonElement>(selector);
  if (!button) throw new Error(`button missing: ${selector}`);
  await act(async () => button.click());
  await vi.waitFor(() => expect(container?.querySelector("#active-store")?.textContent).toBe(expectedStore));
  await act(async () => { await Promise.resolve(); });
}

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  localStorage.clear();
  vi.unstubAllGlobals();
});

it("wisselt tussen providerlijsten zonder items te mengen en onthoudt de actieve keuze", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const storage = new ProviderListStorage();
  storage.seed("hoogvliet", addCatalogProduct(createEmptyActiveShoppingList(), hoogvlietProduct, "manual"));
  storage.seed("ah", addCatalogProduct(createEmptyActiveShoppingList(), ahProduct, "manual"));
  localStorage.setItem("boodschappenmaatje:active-supermarket", "hoogvliet");

  await render(storage);
  expect(container?.querySelector("#active-products")?.textContent).toBe("hoogvliet-product:1");
  await click("#switch-ah", "ah");
  expect(container?.querySelector("#active-store")?.textContent).toBe("ah");
  expect(container?.querySelector("#active-products")?.textContent).toBe("ah-product:1");
  expect(localStorage.getItem("boodschappenmaatje:active-supermarket")).toBe("ah");
  await click("#increase-ah-product", "ah");
  await click("#switch-high", "hoogvliet");
  expect(container?.querySelector("#active-products")?.textContent).toBe("hoogvliet-product:1");
  await click("#switch-ah", "ah");
  expect(container?.querySelector("#active-products")?.textContent).toBe("ah-product:2");

  await act(async () => root?.unmount());
  root = null;
  await render(storage);
  expect(container?.querySelector("#active-store")?.textContent).toBe("ah");
  expect(container?.querySelector("#active-products")?.textContent).toBe("ah-product:2");
  expect(storage.keys()).toEqual(["active:ah", "active:hoogvliet"]);
});

it("onthoudt een expliciete eerste Hoogvliet-keuze zonder de actieve lijst te vervangen", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const storage = new ProviderListStorage();
  storage.seed("hoogvliet", addCatalogProduct(createEmptyActiveShoppingList(), hoogvlietProduct, "manual"));
  await render(storage);

  expect(localStorage.getItem("boodschappenmaatje:active-supermarket")).toBeNull();
  expect(container?.querySelector("#active-products")?.textContent).toBe("hoogvliet-product:1");
  await click("#switch-high", "hoogvliet");
  expect(localStorage.getItem("boodschappenmaatje:active-supermarket")).toBe("hoogvliet");
  expect(container?.querySelector("#active-products")?.textContent).toBe("hoogvliet-product:1");
  expect(storage.keys()).toEqual(["active:hoogvliet"]);
});
