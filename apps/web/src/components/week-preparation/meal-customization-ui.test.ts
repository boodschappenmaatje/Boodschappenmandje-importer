import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

const controls = readFileSync(
  new URL("./MealCustomizationControls.tsx", import.meta.url),
  "utf8",
);
const provider = readFileSync(
  new URL("../../features/week-preparation/WeekPreparationProvider.tsx", import.meta.url),
  "utf8",
);
const styles = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);
const catalogSearch = readFileSync(
  new URL("../catalog/CatalogSearchView.tsx", import.meta.url),
  "utf8",
);
const layout = readFileSync(
  new URL("../../app/layout.tsx", import.meta.url),
  "utf8",
);

describe("PWA 12 compacte iPhone-customization", () => {
  it("houdt gerecht vervangen en handmatig toevoegen als twee duidelijke acties", () => {
    expect(controls).toContain(">Vervang gerecht</button>");
    expect(controls).toContain(">+ Voeg toe</button>");
    expect(controls).toContain("Bestaand ingrediënt vervangen");
    expect(controls).toContain("Toevoegen aan dit gerecht");
  });

  it("biedt per ingrediënt automatische voorstellen plus vrije cataloguszoeker", () => {
    expect(controls).toContain(">Vervang</button>");
    expect(controls).toContain("Meer alternatieven");
    expect(controls).toContain("Zelf zoeken");
    expect(controls).toContain("INITIAL_ALTERNATIVE_COUNT = 3");
    expect(controls).toContain("slice(0, showAll ? alternatives.length : INITIAL_ALTERNATIVE_COUNT)");
    expect(provider).toContain("pageSize: 12");
    expect(provider).toContain('sort: "relevance"');
    expect(provider).toContain("catalogRepository().query");
  });

  it("toont compacte rijen en pas bij bevestiging de volledige budgetimpact", () => {
    expect(controls).toContain("compact-product-list");
    expect(controls).toContain("compact-budget-status");
    expect(controls).toContain("Nieuwe maaltijdkosten:");
    expect(controls).toContain("boven je maaltijd-budget");
    expect(controls).toContain("boven je totale weekbudget");
    expect(controls).toContain('"Toch gebruiken"');
    expect(styles).toContain("grid-template-columns: 44px minmax(0, 1fr) auto");
  });

  it("muteert pas na de definitieve knop en laat annuleren alleen de flow sluiten", () => {
    expect(controls).toContain("week.applyManualProduct(");
    expect(controls).toContain('selectionSource: "automaticSuggestion"');
    expect(controls).toContain("week.applyExplicitRecipe(");
    expect(controls).toContain("onClick={onClose} disabled={week.customizationBusy}>Annuleren");
    expect(controls).not.toContain("Dit automatische alternatief blijft geblokkeerd");
    expect(controls).not.toContain("userApprovedBudgetOverride");
  });

  it("bereikt voor beide gerecht-CTA's dezelfde mutation en voorkomt dubbele taps", () => {
    expect(controls).toContain("if (!pending || confirmingRef.current) return");
    expect(controls).toContain("confirmingRef.current = true");
    expect(controls).toContain("await week.applyExplicitRecipe(");
    expect(controls).toContain("pending.impact.requiresBudgetOverride");
    expect(controls).toContain("disabled={confirming || week.customizationBusy}");
    expect(controls).toContain('"Controleren…"');
    expect(controls).toContain('"Toch gebruiken"');
    expect(controls).toContain('"Bevestig vervanging"');
  });

  it("houdt de selectie vast tot succes en toont een fout in plaats van stil te stoppen", () => {
    expect(controls).toContain("if (result.applied)");
    expect(controls).toContain("setOpen(false); setPending(null); setAlternatives([])");
    expect(controls).toContain('role="alert">{replacementFeedback}');
    expect(controls).toContain("Je huidige gerecht is behouden");
    expect(provider).toContain("listWithoutCurrentWeekMealPlan(");
    expect(provider).toContain("explicit recipe replacement failed");
  });

  it("hervalidateert dezelfde expliciete mutatie en vraagt bij prijswijziging opnieuw toestemming", () => {
    expect(provider).toContain("budgetOverrideReapprovalPreview(");
    expect(provider).toContain("reapproveCurrentBudgetOverride(");
    expect(provider).toContain("De prijs of hoeveelheid is gewijzigd");
  });

  it("gebruikt voor Producten, ingrediënt vervangen en toevoegen hetzelfde mobiele zoekveld", () => {
    expect(catalogSearch).toContain("<CatalogSearchField");
    expect(controls).toContain("<CatalogSearchField");
    expect(controls).toContain('className="manual-catalog-search-field"');
    expect(controls).toContain("fixedIngredientId={ingredientId}");
    expect(controls).toContain("ingredients={ingredients} onClose");
  });

  it("voorkomt iPhone focus-zoom en horizontale overflow zonder toegankelijkheids-hack", () => {
    expect(styles).toMatch(/\.manual-catalog-search-field input\s*\{[^}]*font-size:\s*16px/);
    expect(styles).toMatch(/\.catalog-search-field input\s*\{[^}]*font-size:\s*16px/);
    expect(styles).toMatch(/\.manual-product-flow\s*\{[^}]*overflow-x:\s*hidden/);
    expect(styles).toMatch(/\.compact-product-list\s*\{[^}]*overflow-x:\s*hidden/);
    expect(layout).toContain('width: "device-width"');
    expect(layout).toContain("initialScale: 1");
    expect(layout).not.toMatch(/userScalable|user-scalable|maximumScale/);
  });
});
