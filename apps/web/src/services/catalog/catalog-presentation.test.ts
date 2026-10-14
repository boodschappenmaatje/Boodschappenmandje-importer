import { describe, expect, it } from "vitest";

import { CatalogReadError } from "./catalog-repository";
import {
  catalogReadErrorMessage,
  mergeCatalogProducts,
  productsWithPositivePrices,
  safeProductImageUrl,
} from "./catalog-presentation";
import type { Product } from "@/types/catalog";

describe("cataloguspresentatie", () => {
  it("accepteert alleen veilige HTTPS-productafbeeldingen", () => {
    expect(safeProductImageUrl("https://cdn.example/product.png")).toBe(
      "https://cdn.example/product.png",
    );
    expect(safeProductImageUrl("http://cdn.example/product.png")).toBeNull();
    expect(safeProductImageUrl(null)).toBeNull();
  });

  it("voegt pagina's samen zonder dubbele product-ID's", () => {
    const first = { id: "a" } as Product;
    const duplicate = { id: "a", name: "Niet gebruiken" } as Product;
    const second = { id: "b" } as Product;

    expect(mergeCatalogProducts([first], [duplicate, second])).toEqual([
      first,
      second,
    ]);
  });

  it("toont alleen producten met een betrouwbare positieve actuele prijs", () => {
    const base = { id: "p", name: "Product" } as Product;
    const price = (amount: number) => ({
      productId: "p", price: amount, oldPrice: null, isOffer: false, offerText: null,
      validFrom: null, validUntil: null, fetchedAt: "2026-10-14T08:00:00Z", updatedAt: null,
    });
    expect(productsWithPositivePrices([
      { ...base, id: "priced", currentPrice: price(1.25) },
      { ...base, id: "zero", currentPrice: price(0) },
      { ...base, id: "missing", currentPrice: null },
    ]).map((product) => product.id)).toEqual(["priced"]);
  });

  it("vertaalt configuratie- en netwerkfouten naar veilige Nederlandse tekst", () => {
    expect(
      catalogReadErrorMessage(new CatalogReadError("not-configured")),
    ).toBe("De productcatalogus is nog niet gekoppeld aan deze omgeving.");
    expect(catalogReadErrorMessage(new Error("gevoelige technische fout"))).toBe(
      "De producten konden nu niet worden geladen. Probeer het later opnieuw.",
    );
  });
});
