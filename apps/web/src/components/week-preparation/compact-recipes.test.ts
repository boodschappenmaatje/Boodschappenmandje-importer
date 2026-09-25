import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { IngredientQuantityControl } from "./IngredientQuantityControl";
import { CompactRecipeDetail } from "./CompactRecipeDetail";
import { CustomDishEditor, customDishForOpening } from "./CustomDishEditor";
import { FreeChoiceWeekView } from "./FreeChoiceWeekView";
import { createWeekPreparation, distributeCategories } from "@/services/week-preparation/week-preparation";
import { recalculateMealBudgetSummary } from "@/services/week-preparation/week-generation";
import { createEmptyActiveShoppingList } from "@/services/shopping-list/shopping-list";
import type { WeekPreparation } from "@/types/week-preparation";
let current: WeekPreparation;
vi.mock("@/features/week-preparation/WeekPreparationProvider", () => ({ useWeekPreparation: () => ({ preparation: current, previewCustomDish: vi.fn(), matchCustomIngredient: vi.fn(), searchCatalogProducts: vi.fn() }) }));
function fixture(sourceKey = "custom-dish") {
  const base = createWeekPreparation({ schemaVersion: 1, people: 4, days: 6, budgetCents: 10000 }, { knownSubtotalCents: 0, unpricedItemCount: 0 });
  const recipe = { id: "recipe", sourceKey, name: "Pasta voor mijn gezin" };
  return { ...base, status: "generated" as const, categoryDistribution: { ...base.categoryDistribution, freeChoice: 6 },
    days: [{ dayIndex: 0, category: "freeChoice" as const, freeChoice: false, recipeId: recipe.id, recipe, status: "recipeSelected" as const }],
    ingredients: Array.from({ length: 7 }, (_, index) => ({ ingredientId: `i${index}`, sourceKey: "pasta", name: `Ingrediënt ${index}`, unit: "g" as const, optional: false, servingsBase: 1 as const, kind: "ingredient" as const, brandConstraint: null, requiredQuantity: 600, purchaseQuantity: 2, packageCapacity: 500, usedIn: [{ dayIndex: 0, recipeId: recipe.id, recipeName: recipe.name, requiredQuantity: 600 }], product: { productId: `p${index}`, sku: `${index}`, name: `G'woon product ${index}`, brand: null, packageText: "500 g", imageUrl: null, supermarket: "Hoogvliet", sourceUrl: "https://example.test" }, price: { amountCents: 100, isOffer: false, updatedAt: new Date().toISOString(), freshness: "fresh" as const }, productMatchMissing: false, packageCalculationMissing: false })) };
}
describe("PWA 14 Fix 1 compact view and separate editor", () => {
  it.each(["spaghetti-bolognese", "catalog-mix-honig-spaghetti", "custom-dish"])("uses compact read-only rows for %s", source => {
    const html = renderToStaticMarkup(createElement(CompactRecipeDetail, { preparation: fixture(source), dayIndex: 0 }));
    expect(html).toContain("compact-recipe-heading");
    expect(html).toContain("4 personen"); expect(html).toContain("€ 14,00"); expect(html).toContain("€ 3,50 per persoon");
    expect(html).toContain("600 g"); expect(html).toContain("2 × 500 g"); expect(html).toContain("Geen productafbeelding");
    expect(html).toContain("Toon alle ingrediënten (7)");
    expect(html.split('<details')[0]).not.toContain("Ingrediënt 5");
    expect(html).not.toContain("<input"); expect(html).not.toContain("<select"); expect(html).not.toContain("Ingrediënt verwijderen");
  });
  it("shows the actual overage instead of the zero-clamped remainder", () => {
    const preparation = recalculateMealBudgetSummary({ ...fixture(), mealBudgetCents: 1000, generation: {
      generatedAt: new Date().toISOString(), knownPurchaseCostCents: 1400, mealPlanKnownCostCents: 1400, mealBudgetRemainingCents: 0,
      nonMealReservedCents: 9000, totalKnownWeekCostCents: 1400, mealBudgetStatus: "overMealBudget", weekBudgetStatus: "underBudget", isMealBudgetComplete: true,
      mealBudgetCandidateCount: 0, mealBudgetRejectedCount: 0, matchedProductCount: 7, missingProductMatchCount: 0, missingPackageCalculationCount: 0, missingPriceCount: 0,
    } }, createEmptyActiveShoppingList());
    const html = renderToStaticMarkup(createElement(CompactRecipeDetail, { preparation, dayIndex: 0 }));
    expect(html).toContain("€ 4,00"); expect(html).toContain("boven budget"); expect(html).not.toContain("€ 0,00 over");
    const privateOnly = renderToStaticMarkup(createElement(CompactRecipeDetail, { preparation, dayIndex: 0, showBudget: false }));
    expect(privateOnly).not.toContain("Maaltijdbudget:");
  });
  it("shows the custom target people and warns for missing prices", () => {
    const preparation = fixture();
    current = { ...preparation, days: preparation.days.map(day => ({ ...day, customDish: { name: "Pasta", servings: 4, targetServings: 6, ingredients: [] } })), ingredients: preparation.ingredients.map(row => ({ ...row, price: null })) };
    const html = renderToStaticMarkup(createElement(CompactRecipeDetail, { preparation: current, dayIndex: 0 }));
    expect(html).toContain("6 personen"); expect(html).toContain("Prijs onvolledig"); expect(html).toContain("Prijs ontbreekt"); expect(html).not.toContain("€ 0,00");
  });
  it.each([false, true])("opens a separate full editor, saved recipe = %s", saved => {
    current = fixture();
    const html = renderToStaticMarkup(createElement(CustomDishEditor, { dayIndex: 0, initialDish: { name: "Mijn pasta", servings: 4, ...(saved ? { savedRecipeId: "saved" } : {}), ingredients: [] } }));
    expect(html).toContain(saved ? "Bewerk recept" : "Nieuw recept");
    expect(html).toContain("Naam van je gerecht"); expect(html).toContain("Aantal personen"); expect(html).toContain("Ingrediënt toevoegen"); expect(html).toContain("Bewaar mijn recept");
    expect(html).not.toContain('aria-label="Mijn recepten"');
  });
  it("saved detail requires an explicit edit action before showing fields", () => {
    current = fixture();
    const html = renderToStaticMarkup(createElement(CustomDishEditor, { dayIndex: 0, initialView: "detail", initialDish: { name: "Mijn pasta", savedRecipeId: "saved", servings: 4, ingredients: [] } }));
    expect(html).toContain(">Bewerk recept</button>"); expect(html).not.toContain("<fieldset"); expect(html).not.toContain("Naam van je gerecht");
  });
  it.each([1, 2, 4, 6, 7])("presents full %i-slot progress and only replacement choices at maximum", count => {
    current = fixture();
    current.categoryDistribution.freeChoice = count;
    current.days = distributeCategories(current.categoryDistribution, count).map(day => ({ ...day, freeChoice: false, recipeId: "recipe", recipe: { id: "recipe", sourceKey: "custom-dish", name: "Mijn pasta" } }));
    const html = renderToStaticMarkup(createElement(FreeChoiceWeekView));
    expect(html).toContain(`${count} van ${count} gekozen`); expect(html).toContain("Vervang een vrije keuze");
    expect(html).toContain("Mijn recepten"); expect(html).not.toContain("Voeg toe aan lijst");
    expect(html).toContain('aria-current="page" href="/vrije-keuze"');
  });
  it("shows all four home routes before slot selection, followed by selected meals", () => {
    current = fixture();
    const html = renderToStaticMarkup(createElement(FreeChoiceWeekView));
    for (const title of ["Gerecht kiezen", "Maaltijdmix kiezen", "Zelf maken", "Mijn recepten"]) expect(html).toContain(`aria-label="${title}"`);
    expect(html).toContain('class="free-choice-action-grid"');
    expect(html.indexOf('class="free-choice-action-grid"')).toBeLessThan(html.indexOf('aria-label="Al gekozen"'));
    expect(html).toContain('class="free-choice-selected-meal"');
    expect(html).toContain("Dag 1 · 4 personen");
    expect(html).not.toContain("<select");
  });
  it("retains recipe management while a reduced week awaits retention confirmation", () => {
    current = { ...fixture(), status: "draft" };
    const html = renderToStaticMarkup(createElement(FreeChoiceWeekView));
    expect(html).toContain('aria-label="Gerecht kiezen" disabled=""');
    expect(html).toContain('aria-label="Maaltijdmix kiezen" disabled=""');
    expect(html).not.toContain('aria-label="Mijn recepten" disabled');
    expect(html).not.toContain('aria-label="Zelf maken" disabled');
    expect(html).toContain("Je gekozen maaltijden blijven bewaard");
    expect(html).toContain("Pasta voor mijn gezin");
  });
  it("renders the screen detail with quantities separated from products and five initial rows", () => {
    const html = renderToStaticMarkup(createElement(CompactRecipeDetail, { preparation: fixture(), dayIndex: 0, presentation: "screen" }));
    expect(html).toContain('data-presentation="screen"');
    expect(html).toContain("Ingrediënten (5 van 7)");
    expect(html).toContain('class="compact-ingredient-quantity">600 g');
    expect(html.split('<details')[0].match(/class="compact-ingredient-quantity"/g)).toHaveLength(5);
    expect(html).not.toContain("<input");
  });
  it("groups explicit edit and add actions even while current prices load", () => {
    current = fixture();
    const html = renderToStaticMarkup(createElement(CustomDishEditor, { dayIndex: 0, initialView: "detail", initialDish: { name: "Mijn pasta", servings: 4, ingredients: [] } }));
    expect(html).toContain('class="recipe-screen-actions recipe-detail-actions"');
    expect(html).toContain('disabled="">Voeg toe aan lijst');
    expect(html).not.toContain("Naam van je gerecht");
  });

  it("preserves explicitly selected servings when moving a saved detail into a replacement slot", () => {
    const selected = { name: "Pasta", servings: 4, targetServings: 4, savedRecipeId: "saved", ingredients: [] };
    const olderDraft = { ...selected, targetServings: 6 };
    expect(customDishForOpening(selected, "detail", olderDraft, [])).toBe(selected);
    expect(customDishForOpening(selected, "editor", olderDraft, [])).toBe(olderDraft);
    expect(customDishForOpening(undefined, "editor", olderDraft, [])).toBe(olderDraft);
    expect(olderDraft.targetServings).toBe(6);
  });

});


describe("compact ingredient quantity controls", () => {
  it("labels each ingredient and shows the desired amount separately from packs", () => {
    const html = renderToStaticMarkup(createElement(CompactRecipeDetail, { preparation: fixture(), dayIndex: 0, onQuantityChange: vi.fn() }));
    expect(html).toContain('aria-label="Meer Ingrediënt 0"');
    expect(html).toContain('aria-label="Minder Ingrediënt 0"');
    expect(html).toContain('2 verpakkingen</output>');
    expect(html).toContain('Totaal voor recept: 600 g');
    expect(html).toContain('2 × 500 g');
  });
  it("disables minus at minimum and both buttons without reliable pricing or while busy", () => {
    const ingredient = fixture().ingredients[0];
    for (const input of [{...ingredient,price:null},ingredient]) {
      const html = renderToStaticMarkup(createElement(IngredientQuantityControl,{ingredient:input,dayIndex:0,busy:input===ingredient,onChange:vi.fn()}));
      expect(html.match(/disabled=""/g)).toHaveLength(2);
    }
    const minimum = {...ingredient,usedIn:ingredient.usedIn.map(use=>({...use,requiredQuantity:1}))};
    const html=renderToStaticMarkup(createElement(IngredientQuantityControl,{ingredient:minimum,dayIndex:0,busy:false,onChange:vi.fn()}));
    expect(html).toContain('aria-label="Minder Ingrediënt 0" disabled=""');
    expect(html).not.toContain('aria-label="Meer Ingrediënt 0" disabled=""');
  });
});
