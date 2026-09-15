import { describe, expect, it } from "vitest";

import {
  CATALOG_SEARCH_LIMIT,
  DEFAULT_CATALOG_PAGE_SIZE,
  MIN_CATALOG_SEARCH_LENGTH,
  catalogSearchFilter,
  normalizeCatalogPageRequest,
  normalizeCatalogQueryRequest,
  normalizeCatalogSearchRequest,
  productMatchesSearchTokens,
  productSearchRelevance,
  sortProductsForQuery,
} from "./catalog-repository";
import type { Product } from "@/types/catalog";

function product(
  name: string,
  brand: string | null = null,
  category = "Frisdrank",
): Product {
  return {
    id: name,
    supermarket: "Hoogvliet",
    sku: name,
    name,
    brand,
    category,
    productType: null,
    packageText: "1 liter",
    weightGrams: null,
    imageUrl: null,
    sourceUrl: "https://example.com/product",
    isAvailable: true,
    updatedAt: "2026-09-15T10:00:00Z",
    currentPrice: null,
  };
}

describe("cataloguspaginering", () => {
  it("laadt standaard de eerste twintig plus één kijkrecord", () => {
    expect(normalizeCatalogPageRequest()).toEqual({
      page: 1,
      pageSize: DEFAULT_CATALOG_PAGE_SIZE,
      rangeStart: 0,
      rangeEnd: 20,
    });
  });

  it("berekent een stabiele tweede pagina", () => {
    expect(normalizeCatalogPageRequest({ page: 2, pageSize: 20 })).toEqual({
      page: 2,
      pageSize: 20,
      rangeStart: 20,
      rangeEnd: 40,
    });
  });

  it("begrensd een ongeldige aanvraag veilig", () => {
    expect(normalizeCatalogPageRequest({ page: -4, pageSize: 999 })).toEqual({
      page: 1,
      pageSize: 20,
      rangeStart: 0,
      rangeEnd: 20,
    });
  });
});

describe("catalogusquery", () => {
  it("normaliseert filters, maximumprijs, sortering en serverpaginering", () => {
    const normalized = normalizeCatalogQueryRequest({
      term: "  CoLa  ",
      category: " Frisdrank ",
      brand: " Merk ",
      offersOnly: true,
      maxPrice: 3.5,
      sort: "price-asc",
      page: 2,
    });

    expect(normalized.query).toEqual({
      term: "CoLa",
      category: "Frisdrank",
      brand: "Merk",
      offersOnly: true,
      maxPrice: 3.5,
      sort: "price-asc",
    });
    expect(normalized.rangeStart).toBe(20);
    expect(normalized.rangeEnd).toBe(40);
    expect(normalized.requiresPriceRelation).toBe(true);
  });

  it("rangschikt een duidelijke naamtreffer boven een toevallige merkmatch", () => {
    const exact = product("Cola");
    const contains = product("Suikervrije cola groot");
    const brandOnly = product("Bruiswater", "Cola Fabriek");

    expect(productSearchRelevance(exact, "cola")).toBeGreaterThan(
      productSearchRelevance(contains, "cola"),
    );
    expect(
      sortProductsForQuery([brandOnly, contains, exact], {
        term: "COLA",
        category: null,
        brand: null,
        offersOnly: false,
        maxPrice: null,
        sort: "relevance",
      }),
    ).toEqual([exact, contains, brandOnly]);
  });

  it("matcht cola als afzonderlijk woord of woordbegin", () => {
    expect(
      productMatchesSearchTokens(product("First Choice Cola regular"), "cola"),
    ).toBe(true);
    expect(
      productMatchesSearchTokens(product("Coca-Cola zero sugar"), "COLA"),
    ).toBe(true);
  });

  it("matcht cola niet uitsluitend als letters binnen chocola of chocolade", () => {
    expect(
      productMatchesSearchTokens(
        product("Danerolles chocoladedeeg", "Danerolles", "Bakken"),
        "cola",
      ),
    ).toBe(false);
    expect(
      productMatchesSearchTokens(
        product("De Heer chocolade bloemen", "De Heer", "Chocolade"),
        "cola",
      ),
    ).toBe(false);
  });

  it("houdt kipproducten en het merk Honig case-insensitive vindbaar", () => {
    expect(
      productMatchesSearchTokens(product("Scharrel kipfilet", null, "Vlees"), "KIP"),
    ).toBe(true);
    expect(
      productMatchesSearchTokens(product("Macaroni maaltijdmix", "Honig", "Maaltijdmix"), "honig"),
    ).toBe(true);
  });

  it("bouwt een databasefilter op woordbegin in plaats van vrije substring", () => {
    const search = normalizeCatalogSearchRequest("cola");
    expect(search).not.toBeNull();
    const filter = catalogSearchFilter(search!);

    expect(filter).toContain("name.ilike.cola%");
    expect(filter).toContain("name.ilike.% cola%");
    expect(filter).toContain("name.ilike.%-cola%");
    expect(filter).not.toContain("name.ilike.%cola%");
  });
});

describe("catalogus zoeken", () => {
  it("start pas vanaf de minimale zoeklengte", () => {
    expect(MIN_CATALOG_SEARCH_LENGTH).toBe(2);
    expect(normalizeCatalogSearchRequest(" a ")).toBeNull();
    expect(normalizeCatalogSearchRequest("   ")).toBeNull();
  });

  it("maakt een begrensd databasepatroon voor productnaam of merk", () => {
    expect(normalizeCatalogSearchRequest("  Coca Cola  ")).toEqual({
      term: "Coca Cola",
      tokens: ["coca", "cola"],
      patterns: [
        "coca%cola%",
        "% coca%cola%",
        "%-coca%cola%",
        "%/coca%cola%",
        "%>coca%cola%",
        "%(coca%cola%",
        "%[coca%cola%",
      ],
      limit: CATALOG_SEARCH_LIMIT,
    });
  });

  it("laat filteroperatoren niet vrij in de PostgREST-expressie", () => {
    expect(normalizeCatalogSearchRequest("1,5 l_(test)")).toEqual({
      term: "1,5 l_(test)",
      tokens: ["1", "5", "l", "test"],
      patterns: [
        "1%5%l%test%",
        "% 1%5%l%test%",
        "%-1%5%l%test%",
        "%/1%5%l%test%",
        "%>1%5%l%test%",
        "%(1%5%l%test%",
        "%[1%5%l%test%",
      ],
      limit: CATALOG_SEARCH_LIMIT,
    });
  });

  it("begrensd het eerste zoekresultaat zonder catalogusdownload", () => {
    expect(normalizeCatalogSearchRequest("melk", { limit: 500 })?.limit).toBe(
      CATALOG_SEARCH_LIMIT,
    );
  });
});
