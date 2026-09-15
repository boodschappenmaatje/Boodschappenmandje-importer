import { describe, expect, it } from "vitest";

import { CatalogReadError } from "./catalog-repository";
import {
  catalogReadErrorMessage,
  mergeCatalogProducts,
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

  it("vertaalt configuratie- en netwerkfouten naar veilige Nederlandse tekst", () => {
    expect(
      catalogReadErrorMessage(new CatalogReadError("not-configured")),
    ).toBe("De productcatalogus is nog niet gekoppeld aan deze omgeving.");
    expect(catalogReadErrorMessage(new Error("gevoelige technische fout"))).toBe(
      "De producten konden nu niet worden geladen. Probeer het later opnieuw.",
    );
  });
});
