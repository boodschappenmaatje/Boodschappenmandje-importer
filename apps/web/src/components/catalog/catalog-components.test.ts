import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { CatalogFilterSheet, categoryLabel } from "./CatalogFilterSheet";
import { CatalogProductCard } from "./CatalogProductCard";
import { CatalogSearchField } from "./CatalogSearchField";
import { catalogSearchInstruction, CATALOG_PAGE_SEARCH_DEBOUNCE_MS } from "./CatalogSearchView";
import type { Product } from "@/types/catalog";

const product: Product = {
  id: "product-1",
  supermarket: "Hoogvliet",
  sku: "sku-1",
  name: "Een bijzonder lange productnaam die op mobiel leesbaar moet blijven",
  brand: "Testmerk",
  category: "Dranken/Frisdrank",
  productType: "Cola",
  packageText: "1,5 liter",
  weightGrams: null,
  imageUrl: null,
  sourceUrl: "https://example.com/product",
  isAvailable: true,
  updatedAt: "2026-09-15T10:00:00Z",
  currentPrice: null,
};

describe("PWA 8 cataloguscomponenten", () => {
  it("houdt de zoekdebounce binnen de mobiele richtwaarde", () => {
    expect(CATALOG_PAGE_SEARCH_DEBOUNCE_MS).toBeGreaterThanOrEqual(250);
    expect(CATALOG_PAGE_SEARCH_DEBOUNCE_MS).toBeLessThanOrEqual(400);
    expect(catalogSearchInstruction("c")).toContain("1 teken");
    expect(catalogSearchInstruction("cola")).toBeNull();
  });

  it("biedt één toegankelijk mobiel zoekveld voor catalogus en selectiecontext", () => {
    const html = renderToStaticMarkup(
      createElement(CatalogSearchField, {
        value: "boomstam",
        placeholder: "Zoek producten",
        ariaLabel: "Zoek producten op naam, merk, verpakking of categorie",
        onChange: () => undefined,
        onClear: () => undefined,
        className: "manual-catalog-search-field",
      }),
    );

    expect(html).toContain('type="search"');
    expect(html).toContain('enterKeyHint="search"');
    expect(html).toContain("manual-catalog-search-field");
    expect(html).toContain("boomstam");
    expect(html).toContain("Wis zoekterm");
  });

  it("toont volledige productinformatie, ontbrekende prijs en lijststatus", () => {
    const html = renderToStaticMarkup(
      createElement(CatalogProductCard, {
        product,
        listQuantity: 2,
        isAdding: false,
        listReady: true,
        onAdd: () => undefined,
      }),
    );

    expect(html).toContain(product.name);
    expect(html).toContain("Testmerk · 1,5 liter");
    expect(html).toContain("Prijs tijdelijk niet beschikbaar");
    expect(html).toContain("Geen productafbeelding");
    expect(html).toContain("Op je lijst · 2");
    expect(html).toContain(`/producten/${product.id}`);
    expect(html).not.toContain("€ 0");
  });

  it("bedient een onafhankelijke catalogusbijdrage met de bestaande hoeveelheidacties", () => {
    const html = renderToStaticMarkup(createElement(CatalogProductCard, {
      product,
      listQuantity: 2,
      isAdding: false,
      listReady: true,
      independentQuantity: true,
      onAdd: () => undefined,
      onIncrease: () => undefined,
      onDecrease: () => undefined,
    }));

    expect(html).toContain('aria-label="Minder Een bijzonder lange productnaam die op mobiel leesbaar moet blijven"');
    expect(html).toContain('aria-label="Meer Een bijzonder lange productnaam die op mobiel leesbaar moet blijven"');
    expect(html).toContain("<span aria-live=\"polite\">2</span>");
    expect(html).not.toContain("Op je lijst · 2");
  });

  it("maakt echte categorie- en merkopties mobiel selecteerbaar", () => {
    const html = renderToStaticMarkup(
      createElement(CatalogFilterSheet, {
        open: true,
        query: {
          term: "cola",
          category: null,
          brand: null,
          offersOnly: false,
          maxPrice: null,
          sort: "relevance",
        },
        options: { categories: ["Dranken/Frisdrank"], brands: ["Testmerk"] },
        onApply: () => undefined,
        onClear: () => undefined,
        onClose: () => undefined,
      }),
    );

    expect(categoryLabel("Dranken/Frisdrank")).toBe("Frisdrank");
    expect(html).toContain("Filters en sortering");
    expect(html).toContain("Frisdrank");
    expect(html).toContain("Testmerk");
    expect(html).toContain("Alleen geldige aanbiedingen");
    expect(html).toContain("Prijs laag → hoog");
  });
});
