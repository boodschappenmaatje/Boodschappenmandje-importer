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

  it("hervalidateert dezelfde expliciete mutatie en vraagt bij prijswijziging opnieuw toestemming", () => {
    expect(provider).toContain("budgetOverrideReapprovalPreview(");
    expect(provider).toContain("reapproveCurrentBudgetOverride(");
    expect(provider).toContain("De prijs of hoeveelheid is gewijzigd");
  });
});
