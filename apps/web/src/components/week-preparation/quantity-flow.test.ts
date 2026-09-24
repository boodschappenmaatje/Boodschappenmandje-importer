// @vitest-environment happy-dom
import { act, useEffect, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveShoppingListProvider, useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { BudgetProvider, useBudget } from "@/features/budget/BudgetProvider";
import { WeekPreparationProvider, useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { WeekPreparationView } from "./WeekPreparationView";
import { FreeChoiceWeekView } from "./FreeChoiceWeekView";
import { FreeChoiceControl } from "./FreeChoiceControl";
import { createWeekPreparation } from "@/services/week-preparation/week-preparation";
import { revalidatePreparedWeek } from "@/services/week-preparation/week-generation";
import { createEmptyActiveShoppingList, completeShoppingListFromWeek, increaseQuantity } from "@/services/shopping-list/shopping-list";
import { decodeStoredWeekPreparation, encodeStoredWeekPreparation } from "@/services/week-preparation/indexeddb-storage";
import type { WeekPreparation } from "@/types/week-preparation";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type { Product, Recipe } from "@/types/catalog";
import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import type { RecipeCatalog } from "@/services/week-preparation/recipe-repository";

const now = new Date();
const recipe: Recipe = { id: "pasta-recipe", sourceKey: "pasta", name: "Testpasta", normalizedName: "testpasta", symbol: "fork.knife", preparationMinutes: 20, vegetarian: true, containsPork: false, kidFriendly: true, healthy: false, budgetTier: "economical" };
function product(id: string, name: string, old: boolean): Product {
  const date = new Date(now.getTime() - (old ? 9 * 86400000 : 0)).toISOString();
  return { id, sku: id, name, supermarket: "Hoogvliet", brand: null, category: null, productType: null, packageText: "400 g", weightGrams: 400, imageUrl: null, sourceUrl: "https://example.test/product", isAvailable: true, updatedAt: date, currentPrice: { productId: id, price: 1.79, oldPrice: null, isOffer: false, offerText: null, validFrom: null, validUntil: null, fetchedAt: date, updatedAt: date } };
}
let products: Product[];
const catalog: RecipeCatalog = { recipes: [recipe], ingredients: ["Spaghetti", "Roerbakgroente"].map((name, index) => ({ id: String(index), sourceKey: name.toLowerCase(), name, normalizedName: name.toLowerCase(), defaultUnit: "g", category: "", aliases: [name] })), relations: [0, 1].map(index => ({ id: String(index), recipeId: recipe.id, ingredientId: String(index), amountPerPerson: 100, unit: "g", position: index })) };
const recipes = { loadCatalog: async () => catalog };
const repository: CatalogRepository = { getByIds: async ids => ({ products: products.filter(p => ids.includes(p.id)), priceStatus: "complete" }), search: async () => ({ products, priceStatus: "complete" }), query: async () => { throw Error("unused"); }, getPage: async () => { throw Error("unused"); }, getFilterOptions: async () => ({ categories: [], brands: [] }) };
let root: Root;
let container: HTMLDivElement;
let savedWeek: WeekPreparation;
let savedList: ActiveShoppingList;
let currentWeek: WeekPreparation;
let currentList: ActiveShoppingList;
let total: number;
function Observe() {
  const week = useWeekPreparation().preparation!;
  const list = useActiveShoppingList().list!;
  const cost = useBudget().result.knownSubtotalCents;
  useEffect(() => { currentWeek = week; currentList = list; total = cost; }, [week, list, cost]);
  return null;
}
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); }
async function mount(mode: "Menu" | "Vrije keuze" | "Kiezen") {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  const view = mode === "Menu" ? h(WeekPreparationView) : mode === "Vrije keuze" ? h(FreeChoiceWeekView) : h(FreeChoiceControl, { dayIndex: 0, initialMode: "recipe" });
  await act(async () => root.render(h(ActiveShoppingListProvider, { initialList: savedList, storage: { load: async () => savedList, save: async list => { savedList = structuredClone(list); } } },
    h(BudgetProvider, { initialSettings: { schemaVersion: 1, people: 4, days: 1, budgetCents: 10000 }, storage: localStorage },
      h(WeekPreparationProvider, { initialPreparation: savedWeek, recipeRepository: recipes, catalogRepository: repository, storage: { load: async () => savedWeek, save: async next => { savedWeek = decodeStoredWeekPreparation(encodeStoredWeekPreparation(next))!; } } }, h(Observe), view)))));
  await settle();
}
async function click(label: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(button, label).not.toBeNull(); expect(button!.disabled).toBe(false);
  await act(async () => button!.click()); await settle();
}
beforeEach(async () => {
  products = [product("0", "Spaghetti", false), product("1", "Roerbakgroente", true)];
  const base = createWeekPreparation({ schemaVersion: 1, people: 4, days: 1, budgetCents: 10000 }, { knownSubtotalCents: 0, unpricedItemCount: 0 }, now, "ui-week", 5000);
  savedWeek = (await revalidatePreparedWeek({ ...base, status: "generated", days: [{ dayIndex: 0, category: "pasta", freeChoice: false, recipeId: recipe.id, recipe, status: "recipeSelected" }] }, recipes, repository, now)).preparation;
  savedList = increaseQuantity(completeShoppingListFromWeek(createEmptyActiveShoppingList(now), savedWeek.ingredients, savedWeek.id), "0");
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.innerHTML = ""; vi.unstubAllGlobals(); });

describe("real Menu and Free choice click handlers with stale required ingredient", () => {
  it.each(["Menu", "Vrije keuze"] as const)("%s: 1 → 2 → 1 updates quantity, totals, list and persisted choice", async mode => {
    if (mode === "Vrije keuze") savedWeek.days[0].category = "freeChoice";
    await mount(mode);
    const baseCost = currentWeek.generation!.mealPlanKnownCostCents;
    await click("Meer Spaghetti");
    expect(currentWeek.ingredients.find(i => i.ingredientId === "0")!).toMatchObject({ requiredQuantity: 800, purchaseQuantity: 2 });
    expect(container.textContent).toContain("800 g");
    expect(currentWeek.generation!.mealPlanKnownCostCents).toBe(baseCost + 179);
    expect(total).toBe(baseCost + 358); // extra manually added list package retained
    expect(currentList.items.find(p => p.productId === "0")!.quantity).toBe(3);
    await act(async () => root.unmount()); container.remove();
    await mount(mode);
    expect(currentWeek.ingredients.find(i => i.ingredientId === "0")!.purchaseQuantity).toBe(2);
    await click("Minder Spaghetti");
    expect(currentWeek.ingredients.find(i => i.ingredientId === "0")!).toMatchObject({ requiredQuantity: 400, purchaseQuantity: 1 });
    expect(container.textContent).toContain("400 g");
    expect(currentList.items.find(p => p.productId === "0")!.quantity).toBe(2);
    expect(currentWeek.generation!.mealPlanKnownCostCents).toBe(baseCost);
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Minder Spaghetti"]')!.disabled).toBe(true);
  });
  it("Vrije keuze search → detail: real buttons adjust pending packs then commit the selection", async () => {
    savedWeek = { ...savedWeek, ingredients: [], customizations: [], days: [{ dayIndex: 0, category: "freeChoice", freeChoice: true, recipe: null, recipeId: null, status: "freeChoice" }] };
    savedList = createEmptyActiveShoppingList();
    await mount("Kiezen");
    const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, "Testpasta");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 400)); });
    const result = [...container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent?.includes("Testpasta"))!;
    expect(result.disabled).toBe(false);
    await act(async () => result.click());
    await click("Meer Spaghetti");
    expect(container.querySelector('[aria-label="Benodigd Spaghetti"]')!.textContent).toContain("800 g");
    await click("Minder Spaghetti");
    expect(container.querySelector('[aria-label="Benodigd Spaghetti"]')!.textContent).toContain("400 g");
    await click("Meer Roerbakgroente"); // this product itself has the old positive price
    expect(container.querySelector('[aria-label="Benodigd Roerbakgroente"]')!.textContent).toContain("800 g");
    const add = [...container.querySelectorAll<HTMLButtonElement>("button")].find(button => button.textContent === "Voeg toe aan lijst")!;
    await act(async () => add.click()); await settle();
    expect(currentWeek.ingredients.find(i => i.ingredientId === "1")!.purchaseQuantity).toBe(2);
    expect(currentList.items.find(p => p.productId === "1")!.quantity).toBe(2);
    expect(total).toBe(537);
  });
  it("automatically activates newer €1.99 on focus while 2 chosen packages and manual list quantity stay", async () => {
    await mount("Menu"); await click("Meer Spaghetti");
    const choices = structuredClone(currentWeek.customizations);
    products = products.map(p => p.id === "0" ? { ...p, currentPrice: { ...p.currentPrice!, price: 1.99, fetchedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } } : p);
    await act(async () => { window.dispatchEvent(new Event("focus")); }); await settle();
    expect(currentWeek.ingredients.find(i => i.ingredientId === "0")!).toMatchObject({ requiredQuantity: 800, purchaseQuantity: 2, price: { amountCents: 199 } });
    expect(currentWeek.customizations).toEqual(choices);
    expect(currentWeek.generation!.mealPlanKnownCostCents).toBe(2 * 199 + 179);
    expect(total).toBe(3 * 199 + 179);
    expect(savedWeek.ingredients.find(i => i.ingredientId === "0")!.price!.amountCents).toBe(199);
  });
});
