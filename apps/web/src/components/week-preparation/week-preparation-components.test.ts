import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import HomePage from "@/app/page";
import PrepareWeekPage from "@/app/week-voorbereiden/page";
import { NewWeekControl } from "@/components/week-preparation/NewWeekControl";
import { BudgetProvider } from "@/features/budget/BudgetProvider";
import { ActiveShoppingListProvider } from "@/features/shopping-list/ActiveShoppingListProvider";
import { WeekPreparationProvider } from "@/features/week-preparation/WeekPreparationProvider";
import {
  addCatalogProduct,
  createEmptyActiveShoppingList,
} from "@/services/shopping-list/shopping-list";
import {
  createWeekPreparation,
  prepareWeek,
  setCategoryCount,
  setMealBudgetCents,
} from "@/services/week-preparation/week-preparation";
import type { BudgetSettings } from "@/types/budget";
import type { Product } from "@/types/catalog";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type { WeekPreparation } from "@/types/week-preparation";

const NOW = new Date("2026-09-15T12:00:00Z");
const SETTINGS: BudgetSettings = {
  schemaVersion: 1,
  budgetCents: 10_000,
  people: 4,
  days: 6,
};

function product(price: number | null): Product {
  return {
    id: "week-product",
    supermarket: "Hoogvliet",
    sku: "week-sku",
    name: "Weekproduct",
    brand: null,
    category: null,
    productType: null,
    packageText: "1 stuk",
    weightGrams: null,
    imageUrl: null,
    sourceUrl: "https://example.com/week-product",
    isAvailable: true,
    updatedAt: NOW.toISOString(),
    currentPrice:
      price === null
        ? null
        : {
            productId: "week-product",
            price,
            oldPrice: null,
            isOffer: false,
            offerText: null,
            validFrom: null,
            validUntil: null,
            fetchedAt: NOW.toISOString(),
            updatedAt: NOW.toISOString(),
          },
  };
}

function list(price: number | null = 24.63): ActiveShoppingList {
  return addCatalogProduct(
    createEmptyActiveShoppingList(NOW),
    product(price),
    "catalog",
    NOW,
  );
}

function draft(): WeekPreparation {
  let preparation = createWeekPreparation(
    SETTINGS,
    { knownSubtotalCents: 2_463, unpricedItemCount: 0 },
    NOW,
    "week-component",
  );
  preparation = setMealBudgetCents(preparation, 5_000, NOW);
  preparation = setCategoryCount(preparation, "dutch", 2, NOW);
  preparation = setCategoryCount(preparation, "pasta", 1, NOW);
  preparation = setCategoryCount(preparation, "rice", 1, NOW);
  return preparation;
}

function ready(): WeekPreparation {
  let preparation = draft();
  preparation = setCategoryCount(preparation, "quick", 1, NOW);
  preparation = setCategoryCount(preparation, "comfort", 1, NOW);
  return prepareWeek(
    preparation,
    { knownSubtotalCents: 2_463, unpricedItemCount: 0 },
    NOW,
  );
}

function generated(): WeekPreparation {
  const preparation = ready();
  return {
    ...preparation,
    status: "generated",
    days: preparation.days.map((day, index) =>
      index === 0
        ? {
            ...day,
            recipeId: "recipe-spaghetti",
            recipe: {
              id: "recipe-spaghetti",
              sourceKey: "spaghetti-bolognese",
              name: "Spaghetti bolognese",
            },
            status: "recipeSelected" as const,
          }
        : {
            ...day,
            category: "freeChoice" as const,
            freeChoice: true,
            recipeId: null,
            recipe: null,
            status: "freeChoice" as const,
          },
    ),
    ingredients: [{
      ingredientId: "ingredient-ground-beef",
      sourceKey: "groundBeef",
      name: "rundergehakt",
      unit: "g",
      optional: false,
      servingsBase: 1,
      kind: "ingredient",
      brandConstraint: null,
      requiredQuantity: 700,
      purchaseQuantity: 2,
      packageCapacity: 500,
      usedIn: [{ recipeId: "recipe-spaghetti", recipeName: "Spaghetti bolognese", dayIndex: 0, requiredQuantity: 700 }],
      product: {
        productId: "real-product-id",
        sku: "871000000001",
        name: "Hoogvliet rundergehakt",
        brand: "Hoogvliet",
        packageText: "500 g",
        imageUrl: "https://cdn.hoogvliet.com/rundergehakt.webp",
        supermarket: "Hoogvliet",
        sourceUrl: "https://www.hoogvliet.com/product/871000000001",
      },
      price: {
        amountCents: 449,
        isOffer: false,
        updatedAt: NOW.toISOString(),
        freshness: "fresh",
      },
      productMatchMissing: false,
      packageCalculationMissing: false,
    }],
    generation: {
      generatedAt: NOW.toISOString(),
      knownPurchaseCostCents: 898,
      mealPlanKnownCostCents: 898,
      mealBudgetRemainingCents: 4_102,
      nonMealReservedCents: 5_000,
      totalKnownWeekCostCents: 898,
      mealBudgetStatus: "withinMealBudget",
      weekBudgetStatus: "underBudget",
      isMealBudgetComplete: true,
      mealBudgetCandidateCount: 1,
      mealBudgetRejectedCount: 0,
      matchedProductCount: 1,
      missingProductMatchCount: 0,
      missingPackageCalculationCount: 0,
      missingPriceCount: 0,
    },
  };
}

function incompleteGenerated(): WeekPreparation {
  const preparation = generated();
  return {
    ...preparation,
    status: "generationPartial",
    ingredients: [
      {
        ...preparation.ingredients[0],
        price: {
          ...preparation.ingredients[0].price!,
          amountCents: 2_294,
        },
      },
      {
        ...preparation.ingredients[0],
        ingredientId: "ingredient-missing",
        sourceKey: "missingIngredient",
        name: "ontbrekend product",
        requiredQuantity: 1,
        purchaseQuantity: null,
        packageCapacity: null,
        product: null,
        price: null,
        productMatchMissing: true,
        packageCalculationMissing: false,
      },
    ],
    generation: {
      ...preparation.generation!,
      knownPurchaseCostCents: 4_588,
      missingProductMatchCount: 1,
    },
  };
}

function budgetFailed(): WeekPreparation {
  const preparation = ready();
  return {
    ...preparation,
    status: "generationPartial",
    ingredients: [],
    generation: {
      generatedAt: NOW.toISOString(),
      knownPurchaseCostCents: 0,
      mealPlanKnownCostCents: 0,
      mealBudgetRemainingCents: null,
      nonMealReservedCents: 5_000,
      totalKnownWeekCostCents: 2_463,
      mealBudgetStatus: "noValidMealPlanWithinBudget",
      weekBudgetStatus: "underBudget",
      isMealBudgetComplete: false,
      mealBudgetCandidateCount: 120,
      mealBudgetRejectedCount: 48,
      readinessByCategory: [
        { category: "dutch", candidateCount: 32, readyCount: 17 },
        { category: "pasta", candidateCount: 19, readyCount: 10 },
        { category: "rice", candidateCount: 17, readyCount: 9 },
        { category: "quick", candidateCount: 52, readyCount: 21 },
        { category: "comfort", candidateCount: 50, readyCount: 21 },
      ],
      lowestCompleteMealPlanCostCents: 5_734,
      lowestCompleteMealPlanCostReliable: true,
      matchedProductCount: 0,
      missingProductMatchCount: 0,
      missingPackageCalculationCount: 0,
      missingPriceCount: 0,
    },
  };
}

function readinessFailed(): WeekPreparation {
  const preparation = budgetFailed();
  return {
    ...preparation,
    generation: {
      ...preparation.generation!,
      mealBudgetStatus: "incompleteValidation",
      readinessByCategory: preparation.generation!.readinessByCategory!.map((item) =>
        item.category === "pasta" ? { ...item, readyCount: 0 } : item,
      ),
      lowestCompleteMealPlanCostCents: null,
      lowestCompleteMealPlanCostReliable: true,
    },
  };
}

function generatedWithoutControlledImage(): WeekPreparation {
  const preparation = generated();
  return {
    ...preparation,
    days: preparation.days.map((day, index) =>
      index === 0
        ? {
            ...day,
            recipeId: "future-recipe",
            recipe: {
              id: "future-recipe",
              sourceKey: "future-recipe-without-image",
              name: "Nieuwe maaltijd zonder gecontroleerde foto",
            },
          }
        : day,
    ),
    ingredients: preparation.ingredients.map((ingredient) => ({
      ...ingredient,
      usedIn: ingredient.usedIn.map((use) => ({
        ...use,
        recipeId: "future-recipe",
        recipeName: "Nieuwe maaltijd zonder gecontroleerde foto",
      })),
    })),
  };
}

function generatedWithReplacementImage(): WeekPreparation {
  const preparation = generated();
  return {
    ...preparation,
    days: preparation.days.map((day, index) =>
      index === 0
        ? {
            ...day,
            recipeId: "recipe-spinazie-ei-aardappel",
            recipe: {
              id: "recipe-spinazie-ei-aardappel",
              sourceKey: "spinazie-ei-aardappel",
              name: "Aardappelen, spinazie en ei",
            },
          }
        : day,
    ),
    ingredients: preparation.ingredients.map((ingredient) => ({
      ...ingredient,
      ingredientId: "ingredient-spinazie",
      sourceKey: "spinach",
      name: "spinazie",
      usedIn: ingredient.usedIn.map((use) => ({
        ...use,
        recipeId: "recipe-spinazie-ei-aardappel",
        recipeName: "Aardappelen, spinazie en ei",
      })),
    })),
  };
}

function render(
  component: ReturnType<typeof createElement>,
  preparation: WeekPreparation | null,
  activeList: ActiveShoppingList = list(),
): string {
  return renderToStaticMarkup(
    createElement(
      ActiveShoppingListProvider,
      { initialList: activeList },
      createElement(
        BudgetProvider,
        { initialSettings: SETTINGS },
        createElement(
          WeekPreparationProvider,
          { initialPreparation: preparation },
          component,
        ),
      ),
    ),
  );
}

describe("PWA 10 weekvoorbereidingsweergaven", () => {
  it("start een concept bij Basis en opent een opgeslagen week direct bij Overzicht", () => {
    const draftHtml = render(createElement(PrepareWeekPage), draft());
    const savedHtml = render(createElement(PrepareWeekPage), generated());
    expect(draftHtml).toContain('aria-current="step"><span>1</span>Basis');
    expect(draftHtml).toMatch(/<section hidden="" class="dashboard-card week-distribution"/);
    expect(draftHtml).toMatch(/<section hidden="" class="dashboard-card week-preferences"/);
    expect(draftHtml).toContain('value="50,00"');
    expect(savedHtml).toContain('aria-current="step"><span>4</span>Overzicht');
    expect(savedHtml).toContain("Spaghetti bolognese");
    expect(savedHtml).toContain('class="compact-recipe-ingredients"');
  });
  it("toont zonder voorbereiding een veilige start en behoud van de bestaande lijst", () => {
    const html = render(createElement(PrepareWeekPage), null);
    expect(html).toContain("Start weekvoorbereiding");
    expect(html).toContain("1 product blijft volledig staan");
    expect(html).not.toContain("recept");
  });

  it("toont een gedeeltelijke voorbereiding en alle compacte categorie-steppers", () => {
    const html = render(createElement(PrepareWeekPage), draft());
    expect(html).toContain("Verdeel je week");
    expect(html).toContain("4 / 6");
    expect(html).toContain("Nog 2 dagen verdelen");
    expect(html).toContain("Hollandse kost");
    expect(html).toContain("Comfort / ongezonder");
    expect(html).toContain("Vrije keuze");
    expect(html).toContain('aria-label="Pasta verhogen"');
  });

  it("gebruikt de live PWA 9-lijstcontext en markeert ontbrekende prijzen", () => {
    const html = render(createElement(PrepareWeekPage), draft(), list(null));
    expect(html).toContain("Bekend totaal");
    expect(html).toContain("€ 0,00");
    expect(html).toContain("1 product zonder beschikbare prijs");
    expect(html).toContain("budgetruimte is daarom nog niet definitief");
    expect(html).not.toContain("100,00 over");
  });

  it("toont de PWA 11-overgang terwijl gerechten worden klaargezet", () => {
    const html = render(createElement(PrepareWeekPage), ready());
    expect(html).toContain("Je weekgerechten");
    expect(html).toContain("Klaar om te kiezen");
    expect(html).toContain("echte Hoogvliet-producten");
    expect(html).not.toContain("recipeId");
    expect(html).not.toContain("SKU");
  });

  it.each(["spaghetti-bolognese", "catalog-mix-honig-spaghetti", "custom-dish"])("opens %s as an inline Menu accordion without an editor or navigation link", sourceKey => {
    const preparation = generated();
    preparation.days[0] = { ...preparation.days[0], recipe: { ...preparation.days[0].recipe!, sourceKey } };
    const html = render(createElement(PrepareWeekPage), preparation);
    const summary = html.match(/<details class="recipe-detail"[^>]*><summary>([\s\S]*?)<\/summary>/)?.[1];
    expect(summary).toBeDefined();
    expect(summary).not.toContain("<a ");
    expect(html).toContain('class="compact-recipe-detail"');
    expect(html).not.toContain("Naam van je gerecht");
    expect(html).toContain('aria-current="page" href="/week-voorbereiden"');
  });

  it("toont gerecht, hoeveelheden, echte productmatch, kosten en lijstactie", () => {
    const html = render(createElement(PrepareWeekPage), generated());
    expect(html).toContain("Spaghetti bolognese");
    expect(html).toContain("4 personen");
    expect(html).toContain("700 g nodig");
    expect(html).toContain("Hoogvliet rundergehakt");
    expect(html).toContain("Hoogvliet · 500 g");
    expect(html).toContain("2 verpakkingen · € 8,98");
    expect(html).toContain("€ 2,25 per persoon");
    expect(html).toContain("Vervang gerecht");
    expect(html).toContain("compact-recipe-heading");
    expect(html).toContain("pasta-spaghetti-bolognese.webp");
    expect(html).toContain('src="https://cdn.hoogvliet.com/rundergehakt.webp"');
    expect(html).toContain('alt="Afbeelding van Hoogvliet rundergehakt"');
    expect(html).toContain("Nieuwe boodschappen");
    expect(html).toContain("Maak mijn lijst compleet");
    expect(html).not.toContain("871000000001");
    expect(html).not.toContain("real-product-id");
  });

  it("markeert een bewaard incompleet gerecht, blokkeert de CTA en toont minimaal boven budget", () => {
    const html = render(
      createElement(PrepareWeekPage),
      incompleteGenerated(),
      list(89.56),
    );

    expect(html).toContain("Dit gerecht is niet meer compleet beschikbaar");
    expect(html).toContain("Controleer eerst 1 onvolledig gerecht.");
    expect(html).toContain("Minimaal € 35,44 boven budget");
    expect(html).toContain(
      "Enkele producten zijn nog niet compleet bekend; het uiteindelijke bedrag kan hoger worden.",
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Maak mijn lijst compleet<\/button>/);
  });

  it("toont budgetfalen niet als ontbrekende READY recepten per categorie", () => {
    const html = render(createElement(PrepareWeekPage), budgetFailed());

    expect(html).toContain("De goedkoopste geldige combinatie voor deze verdeling kost € 57,34.");
    expect(html).toContain("Maaltijdbudget of dagen aanpassen");
    expect(html).toContain(
      "Er zijn complete gerechten beschikbaar, maar deze week past nog niet binnen je maaltijd-budget.",
    );
    expect(html).not.toContain(
      "Op dit moment is er geen compleet gerecht beschikbaar voor deze categorie.",
    );
    expect(html).toContain("Er is nog geen complete maaltijdweek binnen dit budget.");
    expect(html).toContain("Nog niet gepland");
  });

  it("reserveert de beschikbaarheidsmelding voor een categorie met nul READY recepten", () => {
    const html = render(createElement(PrepareWeekPage), readinessFailed());
    expect(html).toContain(
      "Op dit moment is er geen compleet gerecht beschikbaar voor deze categorie.",
    );
    expect(html).toContain(
      "Voor deze categorie zijn complete gerechten beschikbaar. De week is nog niet volledig samengesteld.",
    );
    expect(html).not.toContain("geen complete maaltijdweek beschikbaar");
  });

  it("maakt Home dynamisch voor geen week, draft en ready", () => {
    const emptyHtml = render(createElement(HomePage), null);
    const draftHtml = render(createElement(HomePage), draft());
    const readyHtml = render(createElement(HomePage), ready());

    expect(emptyHtml).toContain("Nog geen gerechten gekozen");
    expect(emptyHtml).toContain("Maak mijn week");
    expect(draftHtml).toContain("4 personen");
    expect(draftHtml).toContain("Weekinstellingen");
    expect(draftHtml).toContain("Maak mijn week");
    expect(readyHtml).toContain("Je week");
    expect(readyHtml).toContain("Maak mijn week");
  });

  it("behoudt Budget en boodschappenlijst op Home naast de weekkaarten", () => {
    const html = render(createElement(HomePage), draft());
    expect(html).toContain("Bekijk je weekbudget");
    expect(html).toContain("€ 24,63");
    expect(html).toContain("Pak je lijst erbij");
    expect(html).toContain('href="/lijst"');
  });

  it("toont het eerste gerecht compact met echte prijs en bijbehorende gerechtfoto", () => {
    const html = render(createElement(HomePage), generated());
    expect(html).toContain("home-c-meal");
    expect(html).toContain("Spaghetti bolognese");
    expect(html).toContain("€ 8,98");
    expect(html).toContain("pasta-spaghetti-bolognese.webp");
    expect(html).toContain('data-image-source="recipe"');
    expect(html).not.toContain("rundergehakt.webp&quot; class=\"meal-day-image");
    expect(html).toContain("Bekijk je week");
  });

  it("gebruikt op weekkaart en gerechtdetail dezelfde nette fallback bij een niet-gevalideerde foto", () => {
    const homeHtml = render(createElement(HomePage), generatedWithoutControlledImage());
    const weekHtml = render(createElement(PrepareWeekPage), generatedWithoutControlledImage());

    expect(homeHtml).toContain('data-image-source="placeholder"');
    expect(weekHtml).toContain('data-image-source="placeholder"');
    expect(weekHtml).toContain("compact-recipe-heading");
    expect(homeHtml).not.toContain("future-recipe-without-image.webp");
    expect(weekHtml).not.toContain("future-recipe-without-image.webp");
  });

  it("gebruikt op Home, weekmenu en detail exact dezelfde gevalideerde replacement", () => {
    const homeHtml = render(createElement(HomePage), generatedWithReplacementImage());
    const weekHtml = render(createElement(PrepareWeekPage), generatedWithReplacementImage());

    expect(homeHtml).toContain("dutch-potatoes-spinach-egg.webp");
    expect(weekHtml).toContain("dutch-potatoes-spinach-egg.webp");
    expect(homeHtml).toContain('alt="Gerecht: Aardappelen, spinazie en ei"');
    expect(weekHtml).toContain('alt="Gerecht: Aardappelen, spinazie en ei"');
    expect(weekHtml).toContain("compact-recipe-heading");
  });

  it("biedt Nieuwe week alleen bij de weekacties op Home aan", () => {
    const home = render(createElement(HomePage), generated());
    const menu = render(createElement(PrepareWeekPage), generated());
    expect(home).toContain("week-reset-button");
    expect(menu).not.toContain("week-reset-button");
  });

  it("vraagt bevestiging voordat een bestaande voorbereiding wordt vervangen", () => {
    const html = renderToStaticMarkup(
      createElement(NewWeekControl, {
        onStartNew: async () => undefined,
        initiallyConfirming: true,
      }),
    );
    expect(html).toContain("Nieuwe week starten bevestigen");
    expect(html).toContain("Je huidige week wordt vervangen");
    expect(html).toContain("Handmatige boodschappen blijven staan");
    expect(html).toContain("Ja, start nieuwe week");
    expect(html).toContain("Annuleren");
  });

  it("bevat compacte mobile-first regels en toegankelijke touch targets", () => {
    const css = readFileSync(
      new URL("../../app/globals.css", import.meta.url),
      "utf8",
    );
    expect(css).toContain(".category-steppers");
    expect(css).toContain("grid-template-columns: 44px 32px 44px");
    expect(css).toContain("height: 47px");
    expect(css).toContain("@media (max-width: 360px)");
  });
});
