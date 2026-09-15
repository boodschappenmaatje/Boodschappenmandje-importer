import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { ActiveShoppingListProvider } from "@/features/shopping-list/ActiveShoppingListProvider";
import { createEmptyActiveShoppingList } from "@/services/shopping-list/shopping-list";
import type { Product } from "@/types/catalog";

import {
  CATALOG_SEARCH_DEBOUNCE_MS,
  ProductSearchResults,
  ShoppingListProductSearch,
  shouldRunListProductSearch,
} from "./ShoppingListProductSearch";

const product: Product = {
  id: "product-1",
  supermarket: "Hoogvliet",
  sku: "sku-1",
  name: "Cola zonder suiker",
  brand: "Testmerk",
  category: "Frisdrank",
  productType: null,
  packageText: "1,5 liter",
  weightGrams: null,
  imageUrl: null,
  sourceUrl: "https://example.com/product",
  isAvailable: true,
  updatedAt: "2026-09-15T10:00:00Z",
  currentPrice: {
    productId: "product-1",
    price: 2.49,
    oldPrice: null,
    isOffer: false,
    offerText: null,
    validFrom: null,
    validUntil: null,
    fetchedAt: "2026-09-15T10:00:00Z",
    updatedAt: "2026-09-15T10:00:00Z",
  },
};

describe("zoeken vanuit de actieve lijst", () => {
  it("toont het zoekveld en start zonder remote resultaten", () => {
    const html = renderToStaticMarkup(
      createElement(
        ActiveShoppingListProvider,
        { initialList: createEmptyActiveShoppingList() },
        createElement(ShoppingListProductSearch, {
          open: true,
          onClose: () => undefined,
        }),
      ),
    );

    expect(html).toContain("Zoek en voeg product toe");
    expect(html).toContain("Zoek op product of merk");
    expect(html).toContain("Typ minimaal 2 tekens");
    expect(html).toContain("Open filters");
  });

  it("kan vanuit de lijst zoeken met dezelfde PWA 8-filterquery", () => {
    expect(
      shouldRunListProductSearch({
        term: "",
        category: "Frisdrank",
        brand: null,
        offersOnly: true,
        maxPrice: 3,
        sort: "price-asc",
      }),
    ).toBe(true);
    expect(
      shouldRunListProductSearch({
        term: "",
        category: null,
        brand: null,
        offersOnly: false,
        maxPrice: null,
        sort: "relevance",
      }),
    ).toBe(false);
  });

  it("gebruikt een korte debounce binnen de afgesproken marge", () => {
    expect(CATALOG_SEARCH_DEBOUNCE_MS).toBeGreaterThanOrEqual(250);
    expect(CATALOG_SEARCH_DEBOUNCE_MS).toBeLessThanOrEqual(400);
  });

  it("toont compacte echte zoekresultaten met toevoegen", () => {
    const html = renderToStaticMarkup(
      createElement(ProductSearchResults, {
        state: { status: "loaded", products: [product], priceStatus: "complete" },
        listReady: true,
        addingProductId: null,
        quantityFor: () => 0,
        onAdd: () => undefined,
      }),
    );

    expect(html).toContain(product.name);
    expect(html).toContain("Testmerk · 1,5 liter");
    expect(html).toContain("2,49");
    expect(html).toContain("Geen productafbeelding");
    expect(html).toContain(`Voeg ${product.name} toe aan boodschappenlijst`);
  });

  it("toont offline een rustige melding zonder de lijst te blokkeren", () => {
    const html = renderToStaticMarkup(
      createElement(ProductSearchResults, {
        state: { status: "offline" },
        listReady: true,
        addingProductId: null,
        quantityFor: () => 0,
        onAdd: () => undefined,
      }),
    );
    expect(html).toContain("Zoeken heeft internet nodig");
    expect(html).toContain("bestaande lijst blijft offline bruikbaar");
  });

  it("verzint geen prijs voor een zoekresultaat zonder prijs", () => {
    const html = renderToStaticMarkup(
      createElement(ProductSearchResults, {
        state: {
          status: "loaded",
          products: [{ ...product, currentPrice: null }],
          priceStatus: "complete",
        },
        listReady: true,
        addingProductId: null,
        quantityFor: () => 0,
        onAdd: () => undefined,
      }),
    );
    expect(html).toContain("Geen prijs");
    expect(html).not.toContain("0,00");
  });
});
