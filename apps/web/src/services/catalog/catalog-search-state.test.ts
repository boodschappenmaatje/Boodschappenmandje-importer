import { describe, expect, it } from "vitest";

import {
  DEFAULT_CATALOG_QUERY,
  activeCatalogFilters,
  catalogQueryFromSearchParams,
  catalogQueryToSearchParams,
  clearCatalogFilters,
} from "./catalog-search-state";

describe("catalogus URL-state", () => {
  it("leest zoekterm, filters en sortering uit de URL", () => {
    const query = catalogQueryFromSearchParams(
      new URLSearchParams(
        "q=cola&category=Frisdrank&brand=Hoogvliet&offer=1&max=3%2C50&sort=price-asc",
      ),
    );

    expect(query).toEqual({
      term: "cola",
      category: "Frisdrank",
      brand: "Hoogvliet",
      offersOnly: true,
      maxPrice: 3.5,
      sort: "price-asc",
    });
  });

  it("schrijft alleen actieve state en kan die verliesvrij teruglezen", () => {
    const query = {
      ...DEFAULT_CATALOG_QUERY,
      term: "kip",
      category: "Vlees/Kip",
      offersOnly: true,
      sort: "name-asc" as const,
    };
    const params = catalogQueryToSearchParams(query);

    expect(catalogQueryFromSearchParams(params)).toEqual(query);
    expect(params.has("brand")).toBe(false);
    expect(params.has("max")).toBe(false);
  });

  it("weigert ongeldige sortering en maximumprijs", () => {
    const query = catalogQueryFromSearchParams(
      new URLSearchParams("sort=database-hack&max=-1"),
    );
    expect(query.sort).toBe("relevance");
    expect(query.maxPrice).toBeNull();
  });

  it("toont actieve filterchips en wist filters zonder de zoekterm te verliezen", () => {
    const query = {
      term: "cola",
      category: "Dranken/Frisdrank",
      brand: "Merk",
      offersOnly: true,
      maxPrice: 4,
      sort: "price-desc" as const,
    };
    expect(activeCatalogFilters(query).map((filter) => filter.label)).toEqual([
      "Frisdrank",
      "Merk",
      "In de aanbieding",
      "Max. € 4,00",
    ]);
    expect(clearCatalogFilters(query)).toEqual({
      ...DEFAULT_CATALOG_QUERY,
      term: "cola",
    });
  });
});
