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
const repository: CatalogRepository = { getByIds: async ids => ({ products: products.filter(p => ids.includes(p.id)), priceStatus: "complete" }), search: async () => ({ products, priceStatus: "complete" }), query: async (request = {}) => ({ products: products.filter(p => p.name.toLowerCase().includes((request.term ?? "").toLowerCase())), priceStatus: "complete", page: 1, pageSize: 12, hasMore: false, query: { term: request.term ?? "", category: null, brand: null, offersOnly: false, maxPrice: null, sort: "relevance" } }), getPage: async () => { throw Error("unused"); }, getFilterOptions: async () => ({ categories: [], brands: [] }) };
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
  localStorage.removeItem("boodschappenmaatje:collapsed-list-categories");
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
  const scope = itemName ? [...container.querySelectorAll('li.shopping-item-card')].find(row => row.querySelector('.shopping-item-name')?.textContent === itemName)! : container;
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
    cleanLinkedList(); await mount('Lijst'); await click('Productdetails Spaghetti'); await clickText('Losse verpakking toevoegen', 'Spaghetti');
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
    await click('Verlaag aantal Los product'); await click('Productdetails Los product'); await click('Verwijder Los product');
    expect(currentList.items.some(item => item.productId === 'manual')).toBe(false); expect(currentWeek.customizations).toEqual(choices);
  });
  it('minimum and remove cannot silently delete a required planned ingredient', async () => {
    cleanLinkedList(); await mount('Lijst');
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="Verlaag aantal Spaghetti"]')!.disabled).toBe(true);
    await click('Productdetails Spaghetti'); await click('Verwijder Spaghetti'); expect(container.textContent).toContain('minimaal één verpakking');
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
    cleanLinkedList(); await mount('Lijst');
    expect(container.querySelector('[aria-label="Herkomst Spaghetti"]')!.textContent).toBe('Eigen recept');
    await click('Productdetails Spaghetti');
    expect(container.querySelector('[role="dialog"]')!.textContent).toContain('Eigen recept · dag 1');
    await click('Sluit productdetails'); await click('Verhoog aantal Spaghetti');
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
  cleanLinkedList(); await mount('Lijst'); await click('Verhoog aantal Spaghetti'); await click('Productdetails Spaghetti'); await clickText('Losse verpakking toevoegen', 'Spaghetti');
  products = products.map(p => p.id === '0' ? { ...p, currentPrice: { ...p.currentPrice!, price: 1.99, fetchedAt: new Date().toISOString(), updatedAt: new Date().toISOString() } } : p);
  await act(async () => window.dispatchEvent(new Event('focus'))); await settle();
  expect(ingredientUse('0').requiredQuantity).toBe(800); expect(currentWeek.generation!.mealPlanKnownCostCents).toBe(577);
  expect(total).toBe(776); expect(currentList.items.find(row => row.productId === '0')!).toMatchObject({ quantity: 3, quantityContributions: { persistentQuantity: 1 } });
});

describe('compact list presentation preserves linked state', () => {
  it('details are on demand, expose source/price/date, close with Escape and restore focus', async () => {
    cleanLinkedList(); await mount('Lijst');
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).not.toContain('Losse verpakking toevoegen');
    expect(container.querySelector('[aria-label="Herkomst Spaghetti"]')!.textContent).toBe('Testpasta');
    const opener = container.querySelector<HTMLButtonElement>('[aria-label="Productdetails Spaghetti"]')!;
    opener.focus(); await click('Productdetails Spaghetti');
    const dialog = container.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Productinformatie');
    expect(dialog.textContent).toContain('Laatst bijgewerkt');
    expect(dialog.textContent).toContain('400 g');
    expect(dialog.textContent).toContain('Menu · dag 1');
    expect(dialog.textContent).toContain('1,79');
    expect(document.body.style.overflow).toBe('hidden');
    const close = dialog.querySelector<HTMLButtonElement>('[aria-label="Sluit productdetails"]')!;
    expect(document.activeElement).toBe(close);
    await act(async () => close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(document.activeElement).toBe(opener); expect(document.body.style.overflow).not.toBe('hidden');
    await click('Productdetails Spaghetti'); await click('Sluit productdetails');
    expect(currentList.items.find(item => item.productId === '0')!.quantity).toBe(1);
  });
  it('checkbox persists and status/origin filters intersect without altering quantities or totals', async () => {
    savedList = addCatalogProduct(savedList, product('manual', 'Los product', false));
    await mount('Lijst'); const before = total;
    const check = container.querySelector<HTMLInputElement>('[aria-label="Afvinken Spaghetti"]')!;
    await act(async () => check.click()); await settle();
    expect(currentList.items.find(item => item.productId === '0')!.checked).toBe(true);
    await clickText('Overig');
    expect(container.querySelector('[aria-label="Productdetails Spaghetti"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Productdetails Los product"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="Productdetails Roerbakgroente"]')).toBeNull();
    await clickText('Maaltijden');
    expect(container.querySelector('[aria-label="Productdetails Los product"]')).toBeNull();
    const select = container.querySelector<HTMLSelectElement>('select[aria-label="Boodschappen filteren"]')!;
    await act(async () => { select.value = 'checked'; select.dispatchEvent(new Event('change', { bubbles: true })); });
    expect(container.querySelectorAll('li.shopping-item-card')).toHaveLength(1);
    expect(total).toBe(before);
    await reopen('Lijst'); expect(container.querySelector<HTMLInputElement>('[aria-label="Afvinken Spaghetti"]')!.checked).toBe(true);
    expect(currentList.items).toHaveLength(3);
  });
  it('manual details quantity, remove and undo preserve the existing recipe choices', async () => {
    cleanLinkedList(); savedList = addCatalogProduct(savedList, product('manual', 'Los product', true)); await mount('Lijst');
    const choices = structuredClone(currentWeek.customizations);
    await click('Productdetails Los product');
    expect(container.querySelector('[role="dialog"]')!.textContent).toContain('Laatst bekende prijs');
    await click('Verhoog aantal Los product in details');
    expect(currentList.items.find(item => item.productId === 'manual')!.quantity).toBe(2);
    await click('Verwijder Los product'); expect(container.querySelector('[role="dialog"]')).toBeNull();
    await clickText('Ongedaan maken');
    expect(currentList.items.find(item => item.productId === 'manual')!.quantity).toBe(2);
    expect(currentWeek.customizations).toEqual(choices);
  });
});


describe("PR28 iPhone vervanging en categorieën", () => {
  it.each([
    ["Kipfilet", "Boomstammetjes", "600 g", 600],
    ["Spaghetti", "Rijst", "1 kg", 1000],
    ["Melk", "Havermelk", "1 l", null],
  ] as const)("%s → %s: echte zoek/gebruik-click, naam/foto/hoeveelheid/prijs/lijst en heropenen", async (oldName, newName, packageText, weightGrams) => {
    activeCatalog = { ...catalog, ingredients: catalog.ingredients.map((item, i) => i ? item : { ...item, name: oldName, normalizedName: oldName.toLowerCase(), aliases: [oldName] }) };
    products[0] = { ...products[0], name: oldName };
    const replacement = { ...product("replacement", `Hoogvliet ${newName}`, false), brand: "Hoogvliet", imageUrl: "https://example.test/new-product.jpg", packageText, weightGrams, currentPrice: { ...product("replacement", newName, false).currentPrice!, price: 2.49 } };
    products.push(replacement);
    savedWeek = (await revalidatePreparedWeek(savedWeek, recipes, repository)).preparation;
    savedList = adjustPersistentQuantity(completeShoppingListFromWeek(createEmptyActiveShoppingList(), savedWeek.ingredients, savedWeek.id), "0", 1);
    await mount("Menu");
    const originalRow = [...container.querySelectorAll('.recipe-ingredients > li')].find(row => row.querySelector('strong')?.textContent === oldName)!;
    await act(async () => originalRow.querySelector<HTMLButtonElement>('button')!.click()); await settle();
    await clickText("Zelf zoeken");
    const input = container.querySelector<HTMLInputElement>('input[aria-label="Zoek producten op naam, merk, verpakking of categorie"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, newName);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    });
    await act(async () => { await new Promise(resolve => setTimeout(resolve, 380)); });
    const result = container.querySelector<HTMLButtonElement>('ul[aria-label="Zoekresultaten"] button')!;
    expect(result.textContent).toContain(newName);
    await act(async () => result.click()); await clickText("Gebruiken");
    const chosen = () => currentWeek.ingredients.find(item => item.ingredientId === "0")!;
    expect(chosen()).toMatchObject({ name: newName, purchaseQuantity: 1, price: { amountCents: 249 }, product: { productId: "replacement", name: `Hoogvliet ${newName}`, imageUrl: replacement.imageUrl, packageText } });
    expect(currentWeek.generation!.mealPlanKnownCostCents).toBe(428);
    expect(total).toBe(607); // explicit loose original product remains protected
    expect(container.querySelector(`img[alt="Afbeelding van Hoogvliet ${newName}"]`)).not.toBeNull();
    expect(container.querySelector(`[aria-label="Benodigd ${oldName}"]`)).toBeNull();
    await reopen("Lijst");
    expect(currentList.items.find(item => item.productId === "replacement")!.quantity).toBe(1);
    expect(currentList.items.find(item => item.productId === "0")!.quantityContributions.persistentQuantity).toBe(1);
    await click(`Verhoog aantal Hoogvliet ${newName}`);
    await reopen("Menu");
    expect(chosen().name).toBe(newName);
    expect(container.querySelector(`[aria-label="Benodigd ${newName}"]`)!.textContent).toContain(weightGrams === 600 ? "1.200 g" : weightGrams === 1000 ? "2.000 g" : "2.000 ml");
    await click(`Minder ${newName}`);
    expect(currentList.items.find(item => item.productId === "replacement")!.quantity).toBe(1);
    expect(currentWeek.generation!.mealPlanKnownCostCents).toBe(428);
    expect(catalog.ingredients[0].name).toBe("Spaghetti");
  });

  it("alle categorieën onafhankelijk, met tellers, filters, checkbox en heropenen zonder datamutatie", async () => {
    const categories = ["Aardappelen, groente, fruit", "Vlees, vis, kip", "Zuivel, eieren", "Brood, beleg"];
    for (let index = 2; index < 4; index++) {
      const extra = product(String(index), `Los product ${index}`, false); products.push(extra);
      savedList = addCatalogProduct(savedList, extra);
    }
    savedList.items = savedList.items.map((item, index) => ({ ...item, category: categories[index], checked: index === 0 }));
    await mount("Lijst");
    const before = JSON.stringify(currentList.items), beforeTotal = total;
    const toggle = (category: string) => [...container.querySelectorAll<HTMLButtonElement>('.shopping-category-toggle')].find(button => button.textContent?.includes(category))!;
    for (const category of categories) {
      expect(toggle(category).querySelector("small")!.textContent).toBe("1");
      await act(async () => toggle(category).click());
      expect(toggle(category).getAttribute("aria-expanded")).toBe("false");
    }
    await act(async () => toggle(categories[1]).click());
    expect(toggle(categories[0]).getAttribute("aria-expanded")).toBe("false");
    expect(toggle(categories[1]).getAttribute("aria-expanded")).toBe("true");
    await clickText("Maaltijden"); await clickText("Overig"); await clickText("Alles");
    const filter = container.querySelector<HTMLSelectElement>('select[aria-label="Boodschappen filteren"]')!;
    await act(async () => { filter.value = "checked"; filter.dispatchEvent(new Event("change", { bubbles: true })); });
    expect(toggle(categories[0]).getAttribute("aria-expanded")).toBe("false");
    await reopen("Lijst");
    expect(toggle(categories[0]).getAttribute("aria-expanded")).toBe("false");
    expect(toggle(categories[1]).getAttribute("aria-expanded")).toBe("true");
    expect(JSON.stringify(currentList.items)).toBe(before); expect(total).toBe(beforeTotal);
  });
});

it('Meer alternatieven en Zelf zoeken zijn echte bedienbare knoppen met behoud van de zoekflow', async () => {
  products.push(...Array.from({ length: 4 }, (_, i) => ({ ...product(`alt-${i}`, `Spaghetti variant ${i}`, false), currentPrice: { ...product(`alt-${i}`, '', false).currentPrice!, price: 2 + i } })));
  await mount('Menu');
  const row = [...container.querySelectorAll('.recipe-ingredients > li')].find(item => item.querySelector('strong')?.textContent === 'Spaghetti')!;
  await act(async () => row.querySelector<HTMLButtonElement>('button')!.click()); await settle();
  const more = [...row.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Meer alternatieven')!;
  expect(more.classList.contains('compact-choice-button')).toBe(true);
  expect(row.querySelectorAll('.compact-product-list > li')).toHaveLength(3);
  await act(async () => more.click());
  expect(row.querySelectorAll('.compact-product-list > li')).toHaveLength(4);
  const search = [...row.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent === 'Zelf zoeken')!;
  expect(search.classList.contains('compact-choice-button')).toBe(true);
  await act(async () => search.click());
  expect(row.querySelector('input[type="search"]')).not.toBeNull();
});

it('onhaalbaar automatisch budget bewaart bestaande week/lijst en biedt werkende herstelacties', async () => {
  savedWeek = { ...savedWeek, mealBudgetCents: 1, categoryDistribution: { ...savedWeek.categoryDistribution, pasta: 1 } };
  await mount('Menu');
  const beforeDays = structuredClone(currentWeek.days), beforeItems = structuredClone(currentList.items);
  await clickText('Zoek een week binnen budget');
  expect(currentWeek.days).toEqual(beforeDays);
  expect(currentList.items).toEqual(beforeItems);
  expect(currentWeek.mealBudgetCents).toBe(1);
  expect(container.textContent).toContain('De goedkoopste geldige combinatie');
  expect(container.textContent).toContain('Je bestaande gerechten en boodschappenlijst zijn behouden');
  expect(container.querySelector('a[href="/vrije-keuze"]')).not.toBeNull();
  expect(container.textContent).toContain('Testpasta');
  await clickText('Maaltijdbudget of dagen aanpassen');
  expect(container.querySelector('.week-basics')!.hasAttribute('hidden')).toBe(false);
  await reopen('Lijst'); expect(currentList.items).toEqual(beforeItems);
});

it('een lege budgetgeblokkeerde week houdt READY gerechten selecteerbaar via expliciete handmatige keuze', async () => {
  const { generatePreparedWeek } = await import('@/services/week-preparation/week-generation');
  savedWeek = await generatePreparedWeek({ ...savedWeek, status: 'readyForGeneration', mealBudgetCents: 1, days: savedWeek.days.map(day => ({ ...day, recipeId: null, recipe: null, status: 'categoryAssigned' })) }, recipes, repository);
  await mount('Menu');
  const before = structuredClone(currentList.items);
  await clickText('Bekijk gerechten voor deze dag');
  expect(currentList.items).toEqual(before);
  const input = container.querySelector<HTMLInputElement>('input[type="search"]')!;
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'Testpasta');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 380)); });
  const result = [...container.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.includes('Testpasta'))!;
  expect(result.disabled).toBe(false);
  await act(async () => result.click());
  expect(container.textContent).toContain('Toch toevoegen aan lijst');
  expect(currentWeek.days[0].recipe).toBeNull();
  await clickText('Toch toevoegen aan lijst');
  expect(currentWeek.days[0].recipe?.name).toBe('Testpasta');
  expect(currentWeek.generation!.mealBudgetStatus).toBe('overMealBudget');
  expect(currentWeek.customizations[0].recipeBudgetDecision.mode).toBe('userApprovedBudgetOverride');
});
