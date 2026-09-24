// @vitest-environment happy-dom
import { act, useEffect, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ActiveShoppingListProvider, useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { BudgetProvider, useBudget } from "@/features/budget/BudgetProvider";
import { WeekPreparationProvider, useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { ActiveShoppingListView } from "@/components/shopping-list/ActiveShoppingListView";
import { decodeStoredActiveShoppingList, encodeStoredActiveShoppingList } from "@/services/shopping-list/indexeddb-storage";
import { previewFreeChoice } from "@/services/week-preparation/free-choice";
import { commitExplicitRecipeAlternative } from "@/services/week-preparation/meal-customization";
import { MEAL_MIX_PROFILES, enrichIngredientsForMealMixes } from "@/services/week-preparation/meal-mix-profiles";
import { WeekPreparationView } from "./WeekPreparationView";
import { FreeChoiceWeekView } from "./FreeChoiceWeekView";
import { FreeChoiceControl } from "./FreeChoiceControl";
import { createWeekPreparation } from "@/services/week-preparation/week-preparation";
import { revalidatePreparedWeek } from "@/services/week-preparation/week-generation";
import { createEmptyActiveShoppingList, completeShoppingListFromWeek, adjustPersistentQuantity, addCatalogProduct } from "@/services/shopping-list/shopping-list";
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
let activeCatalog = catalog;
const recipes = { loadCatalog: async () => activeCatalog };
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
async function mount(mode: "Menu" | "Vrije keuze" | "Kiezen" | "Lijst") {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  const view = mode === "Lijst" ? h(ActiveShoppingListView) : mode === "Menu" ? h(WeekPreparationView) : mode === "Vrije keuze" ? h(FreeChoiceWeekView) : h(FreeChoiceControl, { dayIndex: 0, initialMode: "recipe" });
  await act(async () => root.render(h(ActiveShoppingListProvider, { initialList: savedList, storage: { load: async () => savedList, save: async list => { savedList = decodeStoredActiveShoppingList(encodeStoredActiveShoppingList(list))!; } } },
    h(BudgetProvider, { initialSettings: { schemaVersion: 1, people: savedWeek.numberOfPeople!, days: savedWeek.numberOfDays!, budgetCents: savedWeek.budgetCents! }, storage: localStorage },
      h(WeekPreparationProvider, { initialPreparation: savedWeek, recipeRepository: recipes, catalogRepository: repository, storage: { load: async () => savedWeek, save: async next => { savedWeek = decodeStoredWeekPreparation(encodeStoredWeekPreparation(next))!; } } }, h(Observe), view)))));
  await settle();
}
async function click(label: string) {
  const button = container.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);
  expect(button, label).not.toBeNull(); expect(button!.disabled).toBe(false);
  await act(async () => button!.click()); await settle();
}
beforeEach(async () => {
  activeCatalog = catalog;
  products = [product("0", "Spaghetti", false), product("1", "Roerbakgroente", true)];
  const base = createWeekPreparation({ schemaVersion: 1, people: 4, days: 1, budgetCents: 10000 }, { knownSubtotalCents: 0, unpricedItemCount: 0 }, now, "ui-week", 5000);
  savedWeek = (await revalidatePreparedWeek({ ...base, status: "generated", days: [{ dayIndex: 0, category: "pasta", freeChoice: false, recipeId: recipe.id, recipe, status: "recipeSelected" }] }, recipes, repository, now)).preparation;
  savedList = adjustPersistentQuantity(completeShoppingListFromWeek(createEmptyActiveShoppingList(now), savedWeek.ingredients, savedWeek.id), "0", 1);
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

async function reopen(mode: Parameters<typeof mount>[0]) {
  await act(async () => root.unmount()); container.remove(); await mount(mode);
}
async function clickText(text: string, itemName?: string) {
  const scope = itemName ? [...container.querySelectorAll('li.shopping-item-card')].find(row => row.querySelector('h2')?.textContent === itemName)! : container;
  const button = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === text)!;
  expect(button, text).toBeDefined(); expect(button.disabled).toBe(false);
  await act(async () => button.click()); await settle();
}
function ingredientUse(id: string, dayIndex = 0) { return currentWeek.ingredients.find(row => row.ingredientId === id && row.usedIn.some(use => use.dayIndex === dayIndex))!.usedIn.find(use => use.dayIndex === dayIndex)!; }
function cleanLinkedList() { savedList = completeShoppingListFromWeek(createEmptyActiveShoppingList(), savedWeek.ingredients, savedWeek.id); }

describe('bidirectional real shopping-list and recipe interaction', () => {
  it('list 1→2→1 changes canonical 400→800→400g, budgets and reopening in Menu/Free choice', async () => {
    cleanLinkedList(); await mount('Lijst'); await click('Verhoog aantal Spaghetti');
    expect(ingredientUse('0').requiredQuantity).toBe(800);
    expect(currentList.items.find(item => item.productId === '0')!.quantity).toBe(2);
    expect(total).toBe(537); expect(currentWeek.generation!.mealPlanKnownCostCents).toBe(537);
    await reopen('Menu'); expect(container.textContent).toContain('800 g');
    await reopen('Lijst'); await click('Verlaag aantal Spaghetti');
    expect(ingredientUse('0').requiredQuantity).toBe(400); expect(total).toBe(358);
    expect(currentWeek.generation!.mealPlanKnownCostCents).toBe(358);
    savedWeek.days[0].category = 'freeChoice'; await reopen('Vrije keuze'); expect(container.textContent).toContain('400 g');
    await click('Meer Spaghetti'); expect(currentList.items.find(item => item.productId === '0')!.quantity).toBe(2);
    await reopen('Lijst'); expect(currentList.items.find(item => item.productId === '0')!.quantity).toBe(2);
  });
  it('separates 1 recipe +1 loose → 2 recipe +1 loose =3, without implicit ownership', async () => {
    cleanLinkedList(); await mount('Lijst'); await clickText('Losse verpakking toevoegen', 'Spaghetti');
    expect(ingredientUse('0').requiredQuantity).toBe(400); expect(currentList.items.find(item => item.productId === '0')!.quantity).toBe(2);
    await click('Verhoog aantal Spaghetti'); expect(ingredientUse('0').requiredQuantity).toBe(400);
    await click('Meer Spaghetti voor Testpasta dag 1');
    const row = currentList.items.find(item => item.productId === '0')!;
    expect(row.quantity).toBe(3); expect(row.quantityContributions.persistentQuantity).toBe(1); expect(ingredientUse('0').requiredQuantity).toBe(800);
    await click('Minder losse Spaghetti'); expect(ingredientUse('0').requiredQuantity).toBe(800);
    expect(currentList.items.find(item => item.productId === '0')!.quantity).toBe(2);
    await reopen('Menu'); await click('Minder Spaghetti'); expect(currentList.items.find(item => item.productId === '0')!.quantity).toBe(1);
  });
  it('two recipes sharing a product require an explicit owner and only that day changes', async () => {
    const second = { ...recipe, id: 'second-recipe', name: 'Tweede pasta' };
    activeCatalog = { ...catalog, recipes: [recipe, second], relations: [...catalog.relations, ...catalog.relations.map(row => ({ ...row, id: `second-${row.id}`, recipeId: second.id }))] };
    savedWeek = (await revalidatePreparedWeek({ ...savedWeek, numberOfDays: 2, days: [...savedWeek.days, { ...savedWeek.days[0], dayIndex: 1, recipeId: second.id, recipe: second }] }, recipes, repository)).preparation;
    cleanLinkedList(); await mount('Lijst'); await click('Verhoog aantal Spaghetti');
    expect(ingredientUse('0', 0).requiredQuantity).toBe(400); expect(ingredientUse('0', 1).requiredQuantity).toBe(400);
    await click('Meer Spaghetti voor Tweede pasta dag 2');
    expect(ingredientUse('0', 0).requiredQuantity).toBe(400); expect(ingredientUse('0', 1).requiredQuantity).toBe(800);
    expect(currentList.items.find(item => item.productId === '0')!.quantity).toBe(3);
    await click('Minder Spaghetti voor Tweede pasta dag 2'); expect(currentList.items.find(item => item.productId === '0')!.quantity).toBe(2);
    expect(currentList.items[0].quantityContributions.mealPlans[0].ingredientLinks).toHaveLength(2);
  });
  it('manual-only quantity and deletion never change recipes', async () => {
    cleanLinkedList(); savedList = addCatalogProduct(savedList, product('manual', 'Los product', false)); await mount('Lijst');
    const choices = structuredClone(currentWeek.customizations);
    await click('Verhoog aantal Los product'); expect(currentList.items.find(item => item.productId === 'manual')!.quantity).toBe(2);
    await click('Verlaag aantal Los product'); await click('Verwijder Los product');
    expect(currentList.items.some(item => item.productId === 'manual')).toBe(false); expect(currentWeek.customizations).toEqual(choices);
  });
  it('minimum and remove cannot silently delete a required planned ingredient', async () => {
    cleanLinkedList(); await mount('Lijst');
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Verlaag aantal Spaghetti"]')!.disabled).toBe(true);
    await click('Verwijder Spaghetti'); expect(container.textContent).toContain('minimaal één verpakking');
    expect(currentList.items.find(item => item.productId === '0')!.quantity).toBe(1); expect(ingredientUse('0').requiredQuantity).toBe(400);
  });
  it('list package choice persists through people changes and planner refresh', async () => {
    cleanLinkedList(); await mount('Lijst'); await click('Verhoog aantal Spaghetti');
    await act(async () => root.unmount()); container.remove();
    savedWeek = (await revalidatePreparedWeek({ ...savedWeek, numberOfPeople: 2 }, recipes, repository)).preparation;
    await mount('Menu'); expect(ingredientUse('0').requiredQuantity).toBe(800);
    expect(currentList.items.find(item => item.productId === '0')!.quantity).toBe(2); expect(ingredientUse('1').requiredQuantity).toBe(200);
  });
  it('custom recipe uses the list command and persists its native package override', async () => {
    const base = { ...savedWeek, ingredients: [], customizations: [], days: [{ ...savedWeek.days[0], category: 'freeChoice' as const, freeChoice: true, recipeId: null, recipe: null, status: 'freeChoice' as const }] };
    const preview = await previewFreeChoice(base, 0, { customDish: { name: 'Eigen pasta', servings: 4, ingredients: [{ id: 'row', name: 'Spaghetti', productId: '0', quantity: 400, unit: 'g' }] } }, recipes, repository, createEmptyActiveShoppingList());
    const result = await commitExplicitRecipeAlternative(base, 0, preview!, false, recipes, repository, createEmptyActiveShoppingList());
    if (!result.ok) throw Error(result.reason); savedWeek = result.preparation;
    cleanLinkedList(); await mount('Lijst'); await click('Verhoog aantal Spaghetti');
    expect(currentWeek.days[0].customDish!.ingredients[0]).toMatchObject({ quantity: 800, packageCount: 2 });
    await reopen('Lijst'); await click('Verlaag aantal Spaghetti'); expect(currentWeek.days[0].customDish!.ingredients[0]).toMatchObject({ quantity: 400, packageCount: 1 });
  });
  it.each(['honig-macaroni', 'knorr-hokkien-mie'])('%s: list buttons update the exact meal-mix contribution', async sourceKey => {
    const profile = { ...MEAL_MIX_PROFILES.find(row => row.recipeSourceKey === sourceKey)!, productId: 'mix' };
    const mixRecipe = { ...recipe, id: 'mix-recipe', sourceKey }; const definitions = enrichIngredientsForMealMixes([], [profile]);
    activeCatalog = { recipes: [mixRecipe], ingredients: definitions, relations: [], mealMixProfiles: [profile] };
    products = definitions.map(def => ({ ...product(def.sourceKey === profile.productIngredientSourceKey ? 'mix' : def.id, def.name, true), brand: def.sourceKey === profile.productIngredientSourceKey ? profile.brand : null, category: def.category, productType: def.category, packageText: def.defaultUnit === 'piece' ? '1 stuk' : '400 g', weightGrams: def.defaultUnit === 'piece' ? null : 400 }));
    const base = { ...savedWeek, ingredients: [], customizations: [], days: [{ ...savedWeek.days[0], category: 'freeChoice' as const, freeChoice: true, recipeId: null, recipe: null, status: 'freeChoice' as const }] };
    const preview = await previewFreeChoice(base, 0, { recipeId: mixRecipe.id }, recipes, repository, createEmptyActiveShoppingList()); expect(preview).not.toBeNull();
    const result = await commitExplicitRecipeAlternative(base, 0, preview!, false, recipes, repository, createEmptyActiveShoppingList());
    if (!result.ok) throw Error(result.reason); savedWeek = result.preparation;
    cleanLinkedList(); await mount('Lijst'); const item = currentList.items.find(row => row.productId === 'mix')!; const before = item.quantity;
    await click(`Verhoog aantal ${item.name}`); expect(currentList.items.find(row => row.productId === 'mix')!.quantity).toBe(before + 1);
    expect(currentWeek.customizations[0].quantityOverrides!.find(row => row.productId === 'mix')!.packageCount).toBe(before + 1);
    await click(`Verlaag aantal ${item.name}`); expect(currentList.items.find(row => row.productId === 'mix')!.quantity).toBe(before);
  });
});

it('list over-budget preview can be cancelled without changing either quantity', async () => {
  savedWeek = { ...savedWeek, mealBudgetCents: 400 };
  cleanLinkedList(); await mount('Lijst'); await click('Verhoog aantal Spaghetti');
  expect(container.textContent).toContain('Boven budget'); expect(ingredientUse('0').requiredQuantity).toBe(400);
  expect(currentList.items.find(row => row.productId === '0')!.quantity).toBe(1);
  await clickText('Annuleren'); expect(ingredientUse('0').requiredQuantity).toBe(400); expect(total).toBe(358);
});

it('a choice made from the list automatically reprices without changing its count or manual extras', async () => {
  cleanLinkedList(); await mount('Lijst'); await click('Verhoog aantal Spaghetti'); await clickText('Losse verpakking toevoegen', 'Spaghetti');
  products = products.map(p => p.id === '0' ? { ...p, currentPrice: { ...p.currentPrice!, price: 1.99, fetchedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } } : p);
  await act(async () => window.dispatchEvent(new Event('focus'))); await settle();
  expect(ingredientUse('0').requiredQuantity).toBe(800); expect(currentWeek.generation!.mealPlanKnownCostCents).toBe(577);
  expect(total).toBe(776); expect(currentList.items.find(row => row.productId === '0')!).toMatchObject({ quantity: 3, quantityContributions: { persistentQuantity: 1 } });
});
