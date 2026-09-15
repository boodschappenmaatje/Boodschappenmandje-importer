import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

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
        : day,
    ),
    ingredients: [{
      ingredientId: "ingredient-ground-beef",
      sourceKey: "groundBeef",
      name: "rundergehakt",
      unit: "g",
      optional: false,
      servingsBase: 1,
      requiredQuantity: 700,
      purchaseQuantity: 2,
      packageCapacity: 500,
      usedIn: [{ recipeId: "recipe-spaghetti", recipeName: "Spaghetti bolognese" }],
      product: {
        productId: "real-product-id",
        sku: "871000000001",
        name: "Hoogvliet rundergehakt",
        brand: "Hoogvliet",
        packageText: "500 g",
        imageUrl: null,
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
      matchedProductCount: 1,
      missingProductMatchCount: 0,
      missingPackageCalculationCount: 0,
      missingPriceCount: 0,
    },
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

  it("toont gerecht, hoeveelheden, echte productmatch, kosten en lijstactie", () => {
    const html = render(createElement(PrepareWeekPage), generated());
    expect(html).toContain("Spaghetti bolognese");
    expect(html).toContain("4 personen");
    expect(html).toContain("700 g nodig");
    expect(html).toContain("Hoogvliet rundergehakt · 500 g");
    expect(html).toContain("2 verpakkingen · € 8,98");
    expect(html).toContain("Nieuwe boodschappen");
    expect(html).toContain("Maak mijn lijst compleet");
    expect(html).not.toContain("871000000001");
    expect(html).not.toContain("real-product-id");
  });

  it("maakt Home dynamisch voor geen week, draft en ready", () => {
    const emptyHtml = render(createElement(HomePage), null);
    const draftHtml = render(createElement(HomePage), draft());
    const readyHtml = render(createElement(HomePage), ready());

    expect(emptyHtml).toContain("Nog geen week voorbereid");
    expect(emptyHtml).toContain("Week voorbereiden");
    expect(draftHtml).toContain("4 van 6 dagen verdeeld");
    expect(draftHtml).toContain("Verder met voorbereiden");
    expect(draftHtml).toContain("Verder met deze week");
    expect(readyHtml).toContain("6 dagen voorbereid");
    expect(readyHtml).toContain("Klaar om gerechten te kiezen");
    expect(readyHtml).toContain("Bekijk je week");
  });

  it("behoudt Budget en Mijn boodschappen op Home naast de weekkaarten", () => {
    const html = render(createElement(HomePage), draft());
    expect(html).toContain("Budget");
    expect(html).toContain("€ 24,63 bekend besteed van");
    expect(html).toContain("Mijn boodschappen");
    expect(html).toContain("1</strong> product op je lijst");
  });

  it("vraagt bevestiging voordat een bestaande voorbereiding wordt vervangen", () => {
    const html = renderToStaticMarkup(
      createElement(NewWeekControl, {
        onStartNew: () => undefined,
        initiallyConfirming: true,
      }),
    );
    expect(html).toContain("Nieuwe week starten bevestigen");
    expect(html).toContain("Je huidige weekvoorbereiding wordt vervangen");
    expect(html).toContain("Je actieve boodschappenlijst blijft staan");
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
