import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

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
  it("toont de mockup-home met veilige lege week zonder technische migratietekst", () => {
    const html = renderWithList(createElement(HomePage));

    expect(html).toContain("Goed geregeld.");
    expect(html).toContain("Wat eten we deze week?");
    expect(html).toContain("Je week");
    expect(html).toContain("Weekbudget");
    expect(html).toContain("Nog geen gerechten gekozen");
    expect(html).toContain("Naar je boodschappenlijst");
    expect(html).toContain('href="/budget"');
    expect(html).toContain("Bekijk je weekbudget");
    expect(html).toContain('aria-label="Bekijk je weekbudget"');
    expect(html).toContain('href="/week-voorbereiden"');
    expect(html).not.toContain("PWA-fundament");
    expect(html).not.toContain("mobiele testbasis");
  });

  it("geeft de lege lijst een veilige ingang naar weekvoorbereiding", () => {
    const html = renderWithList(createElement(ListPage));

    expect(html).toContain("Je boodschappenlijst is nog leeg");
    expect(html).toContain('href="/producten"');
  });

  it("toont echte actieve-lijstinformatie in de compacte Home-snelkoppeling", () => {
    const html = renderWithList(createElement(HomePage), true);

    expect(html).toContain("Naar je boodschappenlijst");
    expect(html).toContain("1 product");
    expect(html).toContain("€ 0,00 bekend");
  });
});
