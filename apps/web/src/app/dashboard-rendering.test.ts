import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActiveShoppingListProvider } from "@/features/shopping-list/ActiveShoppingListProvider";
import { BudgetProvider } from "@/features/budget/BudgetProvider";
import { WeekPreparationProvider } from "@/features/week-preparation/WeekPreparationProvider";
import { DEFAULT_BUDGET_SETTINGS } from "@/services/budget/budget-settings-storage";
import {
  addCatalogProduct,
  createEmptyActiveShoppingList,
} from "@/services/shopping-list/shopping-list";
import type { Product } from "@/types/catalog";

import HomePage from "./page";
import ListPage from "./lijst/page";

const product: Product = {
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
  updatedAt: "2026-09-15T10:00:00Z",
  currentPrice: null,
};

function renderWithList(component: ReturnType<typeof createElement>, withProduct = false) {
  const emptyList = createEmptyActiveShoppingList("2026-09-15T10:00:00Z");
  const list = withProduct
    ? addCatalogProduct(emptyList, product, "catalog", "2026-09-15T10:01:00Z")
    : emptyList;
  return renderToStaticMarkup(
    createElement(
      ActiveShoppingListProvider,
      { initialList: list },
      createElement(
        BudgetProvider,
        { initialSettings: DEFAULT_BUDGET_SETTINGS },
        createElement(
          WeekPreparationProvider,
          { initialPreparation: null },
          component,
        ),
      ),
    ),
  );
}

describe("dashboard rendering", () => {
  it("toont echte productnavigatie en lege kernstates zonder technische migratietekst", () => {
    const html = renderWithList(createElement(HomePage));

    expect(html).toContain("Deze week");
    expect(html).toContain("Nog geen week voorbereid");
    expect(html).toContain("Mijn boodschappen");
    expect(html).toContain("Nog geen actieve boodschappenlijst");
    expect(html).toContain('href="/producten"');
    expect(html).not.toContain("PWA-fundament");
    expect(html).not.toContain("mobiele testbasis");
    expect(html).not.toContain("€");
  });

  it("geeft de lege lijst een veilige ingang naar weekvoorbereiding", () => {
    const html = renderWithList(createElement(ListPage));

    expect(html).toContain("Je boodschappenlijst is nog leeg");
    expect(html).toContain('href="/producten"');
  });

  it("toont echte actieve-lijstinformatie en de veilige vervolgactie op Home", () => {
    const html = renderWithList(createElement(HomePage), true);

    expect(html).toContain("<strong>1</strong> product op je lijst");
    expect(html).toContain("Verder met mijn lijst");
    expect(html).not.toContain("€ 0,00");
  });
});
