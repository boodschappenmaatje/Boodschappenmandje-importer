import { describe, expect, it } from "vitest";

import {
  mapCatalogRows,
  mapJoinedCatalogRows,
  mapPriceSortedCatalogRows,
  mapRankedCatalogRows,
} from "./catalog-mapper";

const product = {
  id: "product-a",
  supermarket: "Hoogvliet",
  sku: "SKU-A",
  name: "Volle melk",
  brand: "Voorbeeldmerk",
  category: "Zuivel",
  product_type: "Melk",
  package_text: "1 liter",
  weight_grams: null,
  image_url: null,
  source_url: "https://www.hoogvliet.com/product/voorbeeld",
  is_available: true,
  updated_at: "2026-09-14T12:00:00Z",
};

describe("mapCatalogRows", () => {
  it("koppelt een geldige prijs uitsluitend via exact product_id", () => {
    const result = mapCatalogRows([product], [
      {
        product_id: "product-a",
        price: "2.49",
        old_price: "2.79",
        is_offer: true,
        offer_text: "Aanbieding",
        valid_from: "2026-09-14",
        valid_until: "2026-09-20",
        fetched_at: "2026-09-14T12:00:00Z",
        updated_at: "2026-09-14T12:00:00Z",
      },
    ]);

    expect(result.products[0]?.currentPrice).toMatchObject({
      productId: "product-a",
      price: 2.49,
      oldPrice: 2.79,
      isOffer: true,
    });
  });

  it("gebruikt nooit de prijs van een andere product-ID of SKU", () => {
    const result = mapCatalogRows([product], [
      {
        product_id: "product-b",
        sku: "SKU-A",
        price: 9.99,
        is_offer: false,
      },
    ]);

    expect(result.products[0]?.currentPrice).toBeNull();
  });

  it("toont geen ongeldige of fictieve nulprijs", () => {
    const result = mapCatalogRows([product], [
      { product_id: "product-a", price: 0, is_offer: false },
    ]);

    expect(result.products[0]?.currentPrice).toBeNull();
  });

  it("kan producten tonen wanneer de prijsquery niet beschikbaar is", () => {
    const result = mapCatalogRows([product], [], "unavailable");

    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.currentPrice).toBeNull();
    expect(result.priceStatus).toBe("unavailable");
  });

  it("houdt ontbrekende optionele productvelden leeg zonder gegevens te verzinnen", () => {
    const result = mapCatalogRows(
      [
        {
          ...product,
          brand: null,
          package_text: null,
          image_url: null,
          weight_grams: null,
        },
      ],
      [],
    );

    expect(result.products[0]).toMatchObject({
      brand: null,
      packageText: null,
      imageUrl: null,
      weightGrams: null,
      currentPrice: null,
    });
  });
});

describe("mapJoinedCatalogRows", () => {
  it("neemt uit relationele prijsrecords alleen de nieuwste exacte product-FK", () => {
    const result = mapJoinedCatalogRows([
      {
        ...product,
        current_price: [
          {
            product_id: "product-a",
            price: 2.49,
            is_offer: false,
            fetched_at: "2026-09-14T10:00:00Z",
          },
          {
            product_id: "product-a",
            price: 2.59,
            is_offer: false,
            fetched_at: "2026-09-15T10:00:00Z",
          },
          {
            product_id: "product-b",
            price: 0.01,
            is_offer: true,
            fetched_at: "2026-09-16T10:00:00Z",
          },
        ],
      },
    ]);

    expect(result.products[0]?.currentPrice).toMatchObject({
      productId: "product-a",
      price: 2.59,
    });
  });
});

describe("mapPriceSortedCatalogRows", () => {
  it("behoudt de door de database gesorteerde prijsvolgorde en exacte FK", () => {
    const result = mapPriceSortedCatalogRows([
      {
        product_id: "product-a",
        price: 1.49,
        is_offer: false,
        fetched_at: "2026-09-15T10:00:00Z",
        product,
      },
      {
        product_id: "product-b",
        price: 2.49,
        is_offer: false,
        fetched_at: "2026-09-15T10:00:00Z",
        product: { ...product, id: "product-b", sku: "SKU-B" },
      },
    ]);

    expect(result.products.map((item) => item.id)).toEqual([
      "product-a",
      "product-b",
    ]);
    expect(result.products.map((item) => item.currentPrice?.price)).toEqual([
      1.49,
      2.49,
    ]);
  });
});

describe("mapRankedCatalogRows", () => {
  it("behoudt productidentiteit en koppelt de prijs met dezelfde product-id", () => {
    const result = mapRankedCatalogRows([
      {
        product_data: product,
        current_price: {
          product_id: "product-a",
          price: 1.29,
          is_offer: false,
          fetched_at: "2026-09-15T10:00:00Z",
        },
        relevance_score: 7200,
      },
    ]);

    expect(result.products).toHaveLength(1);
    expect(result.products[0]?.id).toBe("product-a");
    expect(result.products[0]?.sku).toBe("SKU-A");
    expect(result.products[0]?.currentPrice?.productId).toBe("product-a");
    expect(result.products[0]?.currentPrice?.price).toBe(1.29);
  });

  it("weigert een prijs van een andere product-id", () => {
    const result = mapRankedCatalogRows([
      {
        product_data: product,
        current_price: {
          product_id: "product-b",
          price: 9.99,
          is_offer: false,
        },
        relevance_score: 7200,
      },
    ]);

    expect(result.products[0]?.currentPrice).toBeNull();
  });
});
