import { describe, expect, it } from "vitest";

import { mapCatalogRows, mapJoinedCatalogRows } from "./catalog-mapper";

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
