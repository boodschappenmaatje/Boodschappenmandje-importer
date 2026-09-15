import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";
import BudgetPage from "@/app/budget/page";
import ListPage from "@/app/lijst/page";
import { BudgetProvider } from "@/features/budget/BudgetProvider";
import { ActiveShoppingListProvider } from "@/features/shopping-list/ActiveShoppingListProvider";
import { WeekPreparationProvider } from "@/features/week-preparation/WeekPreparationProvider";
import {
  addCatalogProduct,
  createEmptyActiveShoppingList,
} from "@/services/shopping-list/shopping-list";
import type { BudgetSettings } from "@/types/budget";
import type { Product } from "@/types/catalog";
import type { ActiveShoppingList } from "@/types/shopping-list";

const NOW = "2026-09-15T12:00:00Z";
const SETTINGS: BudgetSettings = {
  schemaVersion: 1,
  budgetCents: 10_000,
  people: 4,
  days: 7,
};

function product(price: number | null): Product {
  return {
    id: "product-1",
    supermarket: "Hoogvliet",
    sku: "sku-1",
    name: "Testproduct",
    brand: null,
    category: null,
    productType: null,
    packageText: "1 stuk",
    weightGrams: null,
    imageUrl: null,
    sourceUrl: "https://example.com/product",
    isAvailable: true,
    updatedAt: NOW,
    currentPrice:
      price === null
        ? null
        : {
            productId: "product-1",
            price,
            oldPrice: null,
            isOffer: false,
            offerText: null,
            validFrom: null,
            validUntil: null,
            fetchedAt: NOW,
            updatedAt: NOW,
          },
  };
}

function activeList(price: number | null): ActiveShoppingList {
  return addCatalogProduct(
    createEmptyActiveShoppingList(NOW),
    product(price),
    "catalog",
    NOW,
  );
}

function render(
  component: ReturnType<typeof createElement>,
  list: ActiveShoppingList,
  settings: BudgetSettings = SETTINGS,
): string {
  return renderToStaticMarkup(
    createElement(
      ActiveShoppingListProvider,
      { initialList: list },
      createElement(
        BudgetProvider,
        { initialSettings: settings },
        createElement(
          WeekPreparationProvider,
          { initialPreparation: null },
          component,
        ),
      ),
    ),
  );
}

describe("PWA 9 budgetweergaven", () => {
  it("toont op Home een echte compacte budgetkaart", () => {
    const html = render(createElement(HomePage), activeList(10));
    expect(html).toContain("€");
    expect(html).toContain("bekend besteed van");
    expect(html).toContain("90,00");
    expect(html).toContain('href="/budget"');
    expect(html).toContain("<progress");
  });

  it("toont Budgetdetail met totaalinformatie en wijzigvelden", () => {
    const html = render(createElement(BudgetPage), activeList(10));
    expect(html).toContain("Bekend lijsttotaal");
    expect(html).toContain("Geprijsde producten");
    expect(html).toContain("Producten zonder prijs");
    expect(html).toContain("Bedrag in euro");
    expect(html).toContain("Personen");
    expect(html).toContain("Dagen");
    expect(html).toContain("Budget per dag");
  });

  it("toont ontbrekende prijs zonder een betrouwbaar resterend bedrag te claimen", () => {
    const html = render(createElement(BudgetPage), activeList(null));
    expect(html).toContain("1 product zonder beschikbare prijs");
    expect(html).toContain("resterend eindbedrag is daarom nog niet betrouwbaar");
    expect(html).not.toContain("100,00 over");
  });

  it("toont in Mijn boodschappen een compacte live budgetsummary", () => {
    const html = render(createElement(ListPage), activeList(10));
    expect(html).toContain("list-budget-summary");
    expect(html).toContain("bekend van");
    expect(html).toContain("90,00");
  });

  it("toont zonder budget alleen een bewuste instelactie", () => {
    const html = render(createElement(HomePage), activeList(10), {
      ...SETTINGS,
      budgetCents: null,
    });
    expect(html).toContain("Budget instellen");
    expect(html).not.toContain("bekend besteed van");
  });

  it("behoudt compacte mobiele layoutregels", () => {
    const css = readFileSync(
      new URL("../../app/globals.css", import.meta.url),
      "utf8",
    );
    expect(css).toContain("@media (max-width: 360px)");
    expect(css).toContain(".list-budget-summary");
    expect(css).toContain(".budget-facts");
  });
});
