import { describe, expect, it } from "vitest";

import {
  getPriceFreshness,
  getPricePerKilogram,
  isOfferActive,
  resolveCurrentPrice,
} from "./price";
import type { Product, ProductPrice } from "@/types/catalog";

const now = new Date("2026-09-14T12:00:00Z");

const regularPrice: ProductPrice = {
  productId: "product-a",
  price: 2.49,
  oldPrice: null,
  isOffer: false,
  offerText: null,
  validFrom: null,
  validUntil: null,
  fetchedAt: "2026-09-14T02:17:00Z",
  updatedAt: "2026-09-14T02:17:00Z",
};

describe("actuele prijs", () => {
  it("gebruikt de positieve, door de importer opgeslagen normale prijs", () => {
    expect(resolveCurrentPrice(regularPrice, now)).toMatchObject({
      amount: 2.49,
      isOffer: false,
      comparisonPrice: null,
      freshness: "fresh",
    });
  });

  it("markeert een aantoonbaar geldige actie en toont de oude prijs alleen als vergelijking", () => {
    const offer: ProductPrice = {
      ...regularPrice,
      price: 1.99,
      oldPrice: 2.49,
      isOffer: true,
      offerText: "25% korting",
      validFrom: "2026-09-10",
      validUntil: "2026-09-16",
    };

    expect(isOfferActive(offer, now)).toBe(true);
    expect(resolveCurrentPrice(offer, now)).toMatchObject({
      amount: 1.99,
      comparisonPrice: 2.49,
      isOffer: true,
      offerText: "25% korting",
    });
  });

  it("presenteert een verlopen actie niet langer als aanbieding", () => {
    const expiredOffer: ProductPrice = {
      ...regularPrice,
      price: 1.99,
      oldPrice: 2.49,
      isOffer: true,
      offerText: "Verlopen actie",
      validUntil: "2026-09-13",
    };

    expect(resolveCurrentPrice(expiredOffer, now)).toMatchObject({
      amount: 1.99,
      comparisonPrice: null,
      isOffer: false,
      offerText: null,
    });
  });

  it("maakt nooit een nulprijs of ontbrekende prijs", () => {
    expect(resolveCurrentPrice(null, now)).toBeNull();
    expect(
      resolveCurrentPrice({ ...regularPrice, price: 0 }, now),
    ).toBeNull();
  });

  it("markeert data na de importerweek als mogelijk verouderd", () => {
    const stale = {
      ...regularPrice,
      fetchedAt: "2026-09-05T02:17:00Z",
    };
    expect(getPriceFreshness(stale, now)).toBe("stale");
  });

  it("berekent alleen een kiloprijs bij een gestructureerd gewicht", () => {
    const product = {
      weightGrams: 500,
    } as Product;
    const resolved = resolveCurrentPrice(regularPrice, now);

    expect(resolved && getPricePerKilogram(product, resolved)).toBe(4.98);
    expect(
      resolved &&
        getPricePerKilogram({ ...product, weightGrams: null }, resolved),
    ).toBeNull();
  });
});
