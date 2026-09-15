import { describe, expect, it } from "vitest";

import {
  CATALOG_SEARCH_LIMIT,
  DEFAULT_CATALOG_PAGE_SIZE,
  MIN_CATALOG_SEARCH_LENGTH,
  normalizeCatalogPageRequest,
  normalizeCatalogSearchRequest,
} from "./catalog-repository";

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

describe("catalogus zoeken", () => {
  it("start pas vanaf de minimale zoeklengte", () => {
    expect(MIN_CATALOG_SEARCH_LENGTH).toBe(2);
    expect(normalizeCatalogSearchRequest(" a ")).toBeNull();
    expect(normalizeCatalogSearchRequest("   ")).toBeNull();
  });

  it("maakt een begrensd databasepatroon voor productnaam of merk", () => {
    expect(normalizeCatalogSearchRequest("  Coca Cola  ")).toEqual({
      term: "Coca Cola",
      pattern: "%Coca%Cola%",
      limit: CATALOG_SEARCH_LIMIT,
    });
  });

  it("laat filteroperatoren niet vrij in de PostgREST-expressie", () => {
    expect(normalizeCatalogSearchRequest("1,5 l_(test)")).toEqual({
      term: "1,5 l_(test)",
      pattern: "%1%5%l%test%",
      limit: CATALOG_SEARCH_LIMIT,
    });
  });

  it("begrensd het eerste zoekresultaat zonder catalogusdownload", () => {
    expect(normalizeCatalogSearchRequest("melk", { limit: 500 })?.limit).toBe(
      CATALOG_SEARCH_LIMIT,
    );
  });
});
