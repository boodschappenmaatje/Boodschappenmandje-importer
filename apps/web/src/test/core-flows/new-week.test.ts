// @vitest-environment happy-dom
/** Route integration: real screens/providers, deterministic catalog and serialized
 * storage ports. The Next router alone is adapted; no business action is mocked. */
import { act, createElement as h, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { HomeDashboard } from "@/components/dashboard/HomeDashboard";
import { WeekPreparationView } from "@/components/week-preparation/WeekPreparationView";
import { FreeChoiceWeekView } from "@/components/week-preparation/FreeChoiceWeekView";
import { ActiveShoppingListView } from "@/components/shopping-list/ActiveShoppingListView";
import { BudgetDetailView } from "@/components/budget/BudgetDetailView";
import { BottomNavigation } from "@/components/BottomNavigation";
import { ActiveShoppingListProvider, useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { BudgetProvider, useBudget } from "@/features/budget/BudgetProvider";
import { WeekPreparationProvider, useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { decodeStoredWeekPreparation, encodeStoredWeekPreparation } from "@/services/week-preparation/indexeddb-storage";
import { decodeStoredActiveShoppingList, encodeStoredActiveShoppingList } from "@/services/shopping-list/indexeddb-storage";
import { saveBudgetSettings, loadBudgetSettings } from "@/services/budget/budget-settings-storage";
import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import type { RecipeCatalog } from "@/services/week-preparation/recipe-repository";
import type { Product } from "@/types/catalog";

const router = vi.hoisted(() => ({ path: "/", push: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => router.path, useRouter: () => router }));
const catalog: RecipeCatalog = {
  recipes: [{ id: "pasta", sourceKey: "pasta", name: "Groentepasta", normalizedName: "groentepasta", symbol: "fork.knife", preparationMinutes: 20, vegetarian: true, containsPork: false, kidFriendly: true, healthy: true, budgetTier: "economical" }],
  ingredients: ["Spaghetti", "Roerbakgroente"].map((name, i) => ({ id: String(i), sourceKey: name.toLowerCase(), name, normalizedName: name.toLowerCase(), defaultUnit: "g", category: "", aliases: [name] })),
  relations: [0, 1].map(i => ({ id: String(i), recipeId: "pasta", ingredientId: String(i), amountPerPerson: 100, unit: "g", position: i })),
};
const products: Product[] = catalog.ingredients.map(i => ({ id: i.id, sku: i.id, name: i.name, supermarket: "Hoogvliet", brand: null, category: i.id === "0" ? "Pasta" : "Groente", productType: null, packageText: "400 g", weightGrams: 400, imageUrl: null, sourceUrl: "https://example.test/product", isAvailable: true, updatedAt: "2026-09-16T12:00:00Z", currentPrice: { productId: i.id, price: 1.79, oldPrice: null, isOffer: false, offerText: null, validFrom: null, validUntil: null, fetchedAt: "2026-09-16T12:00:00Z", updatedAt: "2026-09-16T12:00:00Z" } }));
const repository: CatalogRepository = {
  getByIds: async ids => ({ products: products.filter(p => ids.includes(p.id)), priceStatus: "complete" }),
  search: async () => ({ products, priceStatus: "complete" }),
  query: async () => { throw Error("unexpected search"); }, getPage: async () => { throw Error("unexpected page"); },
  getFilterOptions: async () => ({ categories: [], brands: [] }),
};
let weekRecord: unknown;
let listRecord: unknown;
let failWeekLoad: boolean;
let failSave: boolean;
const weekStorage = {
  load: async () => { if (failWeekLoad) throw Error("unreadable storage"); return decodeStoredWeekPreparation(weekRecord); },
  save: async (week: Parameters<typeof encodeStoredWeekPreparation>[0]) => { if (failSave) throw Error("quota"); weekRecord = JSON.parse(JSON.stringify(encodeStoredWeekPreparation(week))); },
};
const listStorage = {
  load: async () => decodeStoredActiveShoppingList(listRecord),
  save: async (list: Parameters<typeof encodeStoredActiveShoppingList>[0]) => { listRecord = JSON.parse(JSON.stringify(encodeStoredActiveShoppingList(list))); },
};
let root: Root;
let container: HTMLDivElement;
function Routes() {
  const [path, setPath] = useState(router.path);
  useEffect(() => { router.push.mockImplementation((next: string) => { router.path = next; setPath(next); }); }, []);
  const week = useWeekPreparation(); const list = useActiveShoppingList(); const budget = useBudget();
  const url = new URL(path, "https://example.test");
  const value = url.searchParams.get("day");
  const initialDay = value !== null && /^[0-6]$/.test(value) ? Number(value) : null;
  const screen = url.pathname === "/" ? h(HomeDashboard) : url.pathname === "/lijst" ? h(ActiveShoppingListView) : url.pathname === "/budget" ? h(BudgetDetailView) : url.pathname === "/vrije-keuze" ? h(FreeChoiceWeekView, { initialDay }) : h(WeekPreparationView, { initialDay });
  return h("div", { onClickCapture: (event: React.MouseEvent) => {
    const anchor = (event.target as Element).closest("a");
    if (anchor) { event.preventDefault(); router.push(anchor.getAttribute("href")); }
  } }, screen, h(BottomNavigation), h("output", { "data-testid": "state" }, JSON.stringify({ week: week.preparation, list: list.list, budget: budget.result })));
}
async function settle() { await act(async () => { await new Promise(resolve => setTimeout(resolve, 20)); }); }
async function mount() {
  container = document.createElement("div"); document.body.append(container); root = createRoot(container);
  await act(async () => root.render(h(ActiveShoppingListProvider, { storage: listStorage },
    h(BudgetProvider, { storage: localStorage }, h(WeekPreparationProvider, { storage: weekStorage, recipeRepository: { loadCatalog: async () => catalog }, catalogRepository: repository }, h(Routes))))));
  await settle();
}
async function refresh() { await act(async () => root.unmount()); container.remove(); await mount(); }
async function click(label: string, selector = "button") {
  const element = [...container.querySelectorAll<HTMLElement>(selector)].find(e => !e.closest("[hidden]") && (e.getAttribute("aria-label") === label || e.textContent?.trim() === label));
  expect(element, label).toBeDefined(); expect((element as HTMLButtonElement).disabled).not.toBe(true);
  await act(async () => element!.click()); await settle();
}
async function input(selector: string, value: string) {
  const element = container.querySelector<HTMLInputElement | HTMLSelectElement>(selector)!;
  expect(element).not.toBeNull();
  await act(async () => {
    const prototype = element.tagName === "SELECT" ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")!.set!.call(element, value);
    element.dispatchEvent(new Event(element.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
  }); await settle();
}
async function generateWeek() {
  await click("Maak mijn week", "a"); await click("Start weekvoorbereiding");
  await input(".week-basic-fields label:nth-child(1) select", "4");
  await input(".week-basic-fields label:nth-child(2) select", "1");
  await input("#week-preparation-budget", "100,00"); await input("#week-preparation-meal-budget", "70,00");
  await click("Volgende"); await click("Pasta verhogen"); await click("Volgende"); await click("Volgende"); await click("Week voorbereiden");
  await vi.waitFor(() => expect(decodeStoredWeekPreparation(weekRecord)?.status).toBe("generated"));
  await settle();
  await click("Maak mijn lijst compleet");
}
beforeEach(() => {
  weekRecord = null; listRecord = null; failWeekLoad = false; failSave = false;
  localStorage.clear(); router.path = "/"; router.push.mockReset();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true); Element.prototype.scrollIntoView = vi.fn();
  // Deterministic integration tests must never query a live catalog/database.
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(Error("network forbidden in core integration")));
});
afterEach(async () => { if (root) await act(async () => root.unmount()); document.body.innerHTML = ""; vi.unstubAllGlobals(); });

it("blank Home → settings → generated Menu → linked list → Budget/Free choice → cold storage reopen", async () => {
  await mount(); await generateWeek();
  const generated = decodeStoredWeekPreparation(weekRecord)!;
  expect(generated).toMatchObject({ numberOfPeople: 4, numberOfDays: 1, budgetCents: 10000, mealBudgetCents: 7000, generation: { isMealBudgetComplete: true, mealPlanKnownCostCents: 358 } });
  expect(container.textContent).toContain("Groentepasta");
  await click("Meer Spaghetti");
  expect(container.querySelector('[aria-label="Benodigd Spaghetti"]')?.textContent).toContain("800 g");
  await click("Lijst", "nav[aria-label='Hoofdnavigatie'] a");
  expect(decodeStoredActiveShoppingList(listRecord)!.items.find(i => i.productId === "0")!.quantity).toBe(2);
  await click("Verlaag aantal Spaghetti");
  await click("Menu", "nav[aria-label='Hoofdnavigatie'] a");
  expect(container.querySelector('[aria-label="Benodigd Spaghetti"]')?.textContent).toContain("400 g");
  await click("Lijst", "nav[aria-label='Hoofdnavigatie'] a");
  await click("Productdetails Spaghetti"); await click("Losse verpakking toevoegen"); await click("Sluit productdetails");
  await click("Menu", "nav[aria-label='Hoofdnavigatie'] a"); await click("Meer Spaghetti");
  expect(decodeStoredActiveShoppingList(listRecord)!.items.find(i => i.productId === "0")!).toMatchObject({ quantity: 3, quantityContributions: { persistentQuantity: 1 } });
  const choices = decodeStoredWeekPreparation(weekRecord)!.customizations;
  await click("Budget", "nav[aria-label='Hoofdnavigatie'] a"); expect(container.textContent).toContain("7,16");
  await click("Menu", "nav[aria-label='Hoofdnavigatie'] a"); await click("Vrije keuze", "a");
  expect(container.textContent).toContain("Groentepasta");
  await refresh(); // providers receive no initial state; load/parse persisted records afresh
  expect(decodeStoredWeekPreparation(weekRecord)!.customizations).toEqual(choices);
  expect(decodeStoredWeekPreparation(weekRecord)!.generation!.mealPlanKnownCostCents).toBe(537);
  await click("Menu", "nav[aria-label='Hoofdnavigatie'] a");
  expect(container.querySelector('[aria-label="Benodigd Spaghetti"]')?.textContent).toContain("800 g");
  await click("Home", "nav[aria-label='Hoofdnavigatie'] a");
  expect(container.querySelector(".home-c-budget")?.textContent).toContain("7,16");
  expect(container.querySelector(".home-c-budget")?.textContent).toContain("5,37");
  expect(container.querySelector(".home-c-remaining")?.textContent).toContain("92,84");
  expect(container.querySelector(".home-c-list")?.textContent).toContain("2 producten");
  expect(container.querySelector(".home-c-meal")?.textContent).toContain("Groentepasta");
  await click("Pak je lijst erbij2 producten", "a");
  expect(router.path).toBe("/lijst");
  await click("Home", "nav[aria-label='Hoofdnavigatie'] a");
  await click("Bekijk je week", "a");
  expect(router.path).toBe("/week-voorbereiden");
  await click("Home", "nav[aria-label='Hoofdnavigatie'] a");
  await refresh();
  expect(container.querySelector(".home-c-remaining")?.textContent).toContain("92,84");
  await click("Weekinstellingen", "summary");
  await click("Nieuwe week"); await click("Annuleren");
  expect(decodeStoredWeekPreparation(weekRecord)!.customizations).toEqual(choices);
});

it("a failed week load preserves the persisted list and week instead of silently replacing them", async () => {
  await mount(); await generateWeek(); await click("Meer Spaghetti");
  const weekBefore = structuredClone(weekRecord); const listBefore = structuredClone(listRecord);
  failWeekLoad = true; await refresh();
  expect(container.textContent).toContain("Weekvoorbereiding niet beschikbaar");
  expect(weekRecord).toEqual(weekBefore); expect(listRecord).toEqual(listBefore);
  failWeekLoad = false; await refresh();
  expect(container.querySelector('[aria-label="Benodigd Spaghetti"]')?.textContent).toContain("800 g");
});

it("failed saving is visible and does not report a successful persisted choice", async () => {
  await mount(); await generateWeek(); const before = structuredClone(weekRecord);
  failSave = true; await click("Meer Spaghetti");
  expect(container.textContent).toContain("Je wijziging is zichtbaar, maar lokaal opslaan lukte niet.");
  expect(weekRecord).toEqual(before);
});


it.each([1, 3, 5, 7])("Home %i dagen → exacte Menu-dag opent ingrediënten en overleeft heropenen", async count => {
  await mount(); await generateWeek();
  const data = decodeStoredWeekPreparation(weekRecord)!;
  data.numberOfDays = count;
  data.categoryDistribution.pasta = count;
  data.days = Array.from({ length: count }, (_, dayIndex) => ({ ...data.days[0], dayIndex,
    recipe: { ...data.days[0].recipe!, name: `Groentepasta ${dayIndex + 1}` } }));
  data.ingredients = data.ingredients.map(ingredient => ({ ...ingredient,
    usedIn: data.days.map(day => ({ ...ingredient.usedIn[0], dayIndex: day.dayIndex, recipeName: day.recipe!.name })) }));
  saveBudgetSettings(localStorage, { ...loadBudgetSettings(localStorage), days: data.numberOfDays });
  weekRecord = encodeStoredWeekPreparation(data);
  router.path = "/"; await refresh();
  const cards = [...container.querySelectorAll<HTMLAnchorElement>(".home-c-day-card")];
  expect(cards).toHaveLength(count);
  expect(cards.map(card => card.querySelector(".home-c-day-label")!.textContent)).toEqual(["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag", "Zaterdag", "Zondag"].slice(0, count));
  cards.forEach((card, index) => {
    expect(card.textContent).toContain(`Groentepasta ${index + 1}`);
    expect(card.textContent).toContain("4 personen · €\u00a03,58");
  });
  const target = Math.min(2, count - 1);
  await act(async () => cards[target].click()); await settle();
  expect(router.path).toBe(`/week-voorbereiden?day=${target}`);
  const day = container.querySelector(`#menu-day-${target}`)!;
  expect(day.querySelector<HTMLDetailsElement>(".recipe-detail")!.open).toBe(true);
  expect(day.querySelector("summary")!.textContent).toContain(`Groentepasta ${target + 1}`);
  expect(container.querySelectorAll(".recipe-detail[open]")).toHaveLength(1);
  expect(day.querySelector('[aria-label="Benodigd Spaghetti"]')?.textContent).toContain("400 g");
  expect(day.querySelector('button[aria-label="Meer Spaghetti"]')).not.toBeNull();
  expect(day.querySelector('button[aria-label="Minder Spaghetti"]')).not.toBeNull();
  expect(day.querySelector(".compact-recipe-manage")?.textContent).toContain("Gerecht aanpassen");
  expect(document.activeElement).toBe(day.querySelector("summary"));
  await refresh();
  expect(container.querySelector<HTMLDetailsElement>(`#menu-day-${target} .recipe-detail`)!.open).toBe(true);
  await click("Home", "nav[aria-label='Hoofdnavigatie'] a");
  expect(container.querySelectorAll(".home-c-day-card")).toHaveLength(count);
});

it("Home Vrije keuze en lege dag openen hun eigen bestaande Menu/keuzeflow", async () => {
  await mount(); await generateWeek();
  const data = decodeStoredWeekPreparation(weekRecord)!;
  data.numberOfDays = 3; data.categoryDistribution = { ...data.categoryDistribution, pasta: 2, freeChoice: 1 };
  data.days.push({ dayIndex: 1, category: "freeChoice", freeChoice: true, recipeId: null, recipe: null, status: "freeChoice" },
    { dayIndex: 2, category: "pasta", freeChoice: false, recipeId: null, recipe: null, status: "categoryAssigned" });
  saveBudgetSettings(localStorage, { ...loadBudgetSettings(localStorage), days: data.numberOfDays });
  weekRecord = encodeStoredWeekPreparation(data); router.path = "/"; await refresh();
  await act(async () => container.querySelector<HTMLAnchorElement>('.home-c-day-card[href="/vrije-keuze?day=1"]')!.click()); await settle();
  expect(router.path).toBe("/vrije-keuze?day=1");
  expect(container.querySelector(".free-choice-target")?.textContent).toContain("Je kiest voor dag 2");
  await click("Gerecht kiezen");
  expect(container.querySelector('[aria-label="Vrije keuze dag 2"] input[type="search"]')).not.toBeNull();
  await click("Home", "nav[aria-label='Hoofdnavigatie'] a");
  await act(async () => container.querySelector<HTMLAnchorElement>('.home-c-day-card[href="/week-voorbereiden?day=2"]')!.click()); await settle();
  expect(router.path).toBe("/week-voorbereiden?day=2");
  const empty = container.querySelector("#menu-day-2")!;
  expect(empty.querySelector(".recipe-detail")).toBeNull();
  expect(empty.textContent).toContain("Woensdag");
  await act(async () => empty.querySelector<HTMLButtonElement>("button")!.click()); await settle();
  expect(container.querySelector('[aria-label="Vrije keuze dag 3"] input[type="search"]')).not.toBeNull();
  // Merely navigating to cards did not replace either other day.
  expect(decodeStoredWeekPreparation(weekRecord)!.days[0].recipe?.name).toBe("Groentepasta");
});

it("week wijzigen vervangt de Home-kaarten en bewaart de nieuwe dagindeling na refresh", async () => {
  await mount(); await generateWeek();
  await click("Weekinstellingen aanpassen");
  await input(".week-basic-fields label:nth-child(2) select", "3");
  await click("Volgende");
  await click("Vrije keuze verhogen"); await click("Vrije keuze verhogen");
  await click("Volgende"); await click("Volgende"); await click("Week voorbereiden");
  await settle();
  await click("Home", "nav[aria-label='Hoofdnavigatie'] a");
  expect(container.querySelectorAll(".home-c-day-card")).toHaveLength(3);
  expect(container.querySelectorAll('.home-c-day-card[href^="/vrije-keuze?day="]')).toHaveLength(2);
  await refresh();
  expect(container.querySelectorAll(".home-c-day-card")).toHaveLength(3);
  expect(decodeStoredWeekPreparation(weekRecord)?.numberOfDays).toBe(3);
});
