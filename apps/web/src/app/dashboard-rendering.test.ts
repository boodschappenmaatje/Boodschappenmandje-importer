import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }),
  usePathname: () => "/ontdek",
  useSearchParams: () => new URLSearchParams(),
}));

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
import DiscoverPage from "./ontdek/page";

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

    expect(html).toContain("Slim kopen.");
    expect(html).toContain("Lekker eten.");
    expect(html).toContain("Ontdek &amp; bespaar");
    expect(html).toContain('href="/ontdek"');
    expect(html).toContain("Zoek producten...");
    expect(html).toContain('class="home-discovery-entry"');
    expect(html).toMatch(/home-discovery-store[\s\S]*?supermarket-selector[\s\S]*?home-discovery-search/);
    expect(html).toContain('placeholder="Zoek producten..."');
    expect(html).toContain("Zoek producten, merken of recepten</label>");
    expect(html).toContain('class="home-discovery-icon"');
    expect(html).toContain("Bekijk producten, aanbiedingen en categorieën");
    expect(html).not.toContain('type="submit" aria-label="Zoek producten"');
    expect(html).not.toContain("Goed geregeld.");
    expect(html).not.toContain("Wat eten we deze week?");
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

  it("opent Ontdek & bespaar met compacte winkelkeuze en de gedeelde cataloguszoeker", () => {
    const html = renderWithList(createElement(DiscoverPage));

    expect(html).toContain("Ontdek &amp; bespaar");
    expect(html).toContain("Jouw supermarkt");
    expect(html).toContain("Hoogvliet");
    expect(html).toContain("Aanbiedingen");
    expect(html).toContain("Voordelig kiezen");
    expect(html).toContain("Alle categorieën");
    expect(html).toContain('class="discover-header-mascot"');
    expect(html).toMatch(/discover-header[\s\S]*?discover-header-mascot/);
    expect(html).not.toContain("discover-welcome");
    expect(html.match(/<img[^>]*discover-header-mascot[^>]*>/g)).toHaveLength(1);
    expect(html).toContain("Zoek producten op naam, merk, verpakking of categorie");
    expect(html).not.toContain("provider");
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
