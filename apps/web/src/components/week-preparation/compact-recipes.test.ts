import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CompactRecipeDetail } from "./CompactRecipeDetail";
import { CustomDishEditor } from "./CustomDishEditor";
import { FreeChoiceWeekView } from "./FreeChoiceWeekView";
import { createWeekPreparation, distributeCategories } from "@/services/week-preparation/week-preparation";
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
});
