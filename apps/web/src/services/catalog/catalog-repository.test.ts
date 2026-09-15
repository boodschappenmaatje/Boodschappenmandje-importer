import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CATALOG_SEARCH_LIMIT,
  DEFAULT_CATALOG_PAGE_SIZE,
  MIN_CATALOG_SEARCH_LENGTH,
  catalogSearchFilter,
  normalizeCatalogPageRequest,
  normalizeCatalogQueryRequest,
  normalizeCatalogSearchRequest,
  normalizeCatalogSearchText,
  productMatchesSearchTokens,
  productSearchRelevance,
  sortProductsForQuery,
  SupabaseCatalogRepository,
} from "./catalog-repository";
import type { Product } from "@/types/catalog";

function product(
  name: string,
  brand: string | null = null,
  category = "Frisdrank",
  productType: string | null = null,
  packageText = "1 liter",
): Product {
  return {
    id: name,
    supermarket: "Hoogvliet",
    sku: name,
    name,
    brand,
    category,
    productType,
    packageText,
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

  it("rangschikt productcontext generiek boven een bereidingsomschrijving", () => {
    const meat = product(
      "Hoogvliet Biologische mager rundergehakt",
      "Hoogvliet",
      "Vlees, vis, vegetarisch/Rund-en varkensvlees/Gehakt",
      "Gehakt",
      "250 gram",
    );
    const spinach = product(
      "G'woon Spinazie fijn gehakt",
      "G'woon",
      "Diepvries/Groente/Spinazie, andijvie",
      "Gehakt",
      "800 gram",
    );

    expect(productSearchRelevance(meat, "gehakt")).toBeGreaterThan(
      productSearchRelevance(spinach, "gehakt"),
    );
  });

  it.each([
    ["kip", product("Scharrel kipfilet naturel", null, "Vlees/Kip", "Kipfilet")],
    ["aardappel", product("Vastkokende aardappelen", null, "Groente/Aardappelen", "Aardappelen")],
    ["melk", product("G'woon volle melk", "G'woon", "Zuivel/Melk", "Melk")],
    ["kaas", product("Belegen kaas 48+", null, "Kaas", "Kaas")],
    ["brood", product("Volkoren brood", null, "Brood", "Brood")],
    ["chips", product("Naturel chips", null, "Snacks", "Chips")],
    ["pasta", product("Volkoren pasta penne", null, "Pasta en rijst", "Pasta")],
    ["spinazie", product("Spinazie fijn gesneden", null, "Groente/Spinazie", "Spinazie")],
    ["honig", product("Macaroni maaltijdmix", "Honig", "Maaltijdmix", "Maaltijdmix")],
  ])("vindt %s via dezelfde generieke tokenlogica", (term, item) => {
    expect(productMatchesSearchTokens(item, term)).toBe(true);
    expect(productSearchRelevance(item, term)).toBeGreaterThan(0);
  });

  it.each([
    ["mager rundergehakt", product("Biologische mager rundergehakt", null, "Vlees/Gehakt", "Gehakt")],
    ["coca cola zero", product("Coca-Cola zero sugar", "Coca-Cola", "Frisdrank", "Cola")],
    ["volle melk", product("G'woon volle melk", "G'woon", "Zuivel/Melk", "Melk")],
    ["kipfilet naturel", product("Scharrel kipfilet naturel", null, "Vlees/Kip", "Kipfilet")],
    ["aardappelen vastkokend", product("Aardappelen vastkokend", null, "Groente/Aardappelen", "Aardappelen")],
  ])("vereist alle betekenisvolle tokens voor %s", (term, item) => {
    expect(productMatchesSearchTokens(item, term)).toBe(true);
    expect(productMatchesSearchTokens(product("Losstaand product"), term)).toBe(false);
  });

  it("normaliseert accenten, apostroffen, koppeltekens en extra spaties", () => {
    expect(normalizeCatalogSearchText("  Crème-brûlée's  ")).toBe(
      "creme brulee s",
    );
    expect(productMatchesSearchTokens(product("Café crème-brûlée"), "CAFE creme")).toBe(true);
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

describe("centrale server-side zoekengine", () => {
  it("stuurt zoeken, filters, sortering en paginering naar één RPC", async () => {
    let calledFunction = "";
    let calledParameters: Record<string, unknown> = {};
    const client = {
      rpc(name: string, parameters: Record<string, unknown>) {
        calledFunction = name;
        calledParameters = parameters;
        return Promise.resolve({
          data: [
            {
              product_data: {
                id: "product-a",
                supermarket: "Hoogvliet",
                sku: "123456789",
                name: "Biologische mager rundergehakt",
                brand: "Hoogvliet",
                category: "Vlees/Gehakt",
                product_type: "Gehakt",
                package_text: "250 gram",
                weight_grams: 250,
                image_url: null,
                source_url: "https://www.hoogvliet.com/product/rundergehakt",
                is_available: true,
                updated_at: "2026-09-15T10:00:00Z",
              },
              current_price: null,
              relevance_score: 8000,
            },
          ],
          error: null,
        });
      },
    } as unknown as SupabaseClient;
    const repository = new SupabaseCatalogRepository(client);

    const result = await repository.query({
      term: "  GEHAKT ",
      page: 2,
      category: "Vlees/Gehakt",
      brand: "Hoogvliet",
      offersOnly: true,
      maxPrice: 5,
      sort: "price-asc",
      now: new Date("2026-09-15T12:00:00Z"),
    });

    expect(calledFunction).toBe("search_catalog_products_v2");
    expect(calledParameters).toMatchObject({
      p_term: "GEHAKT",
      p_page: 2,
      p_page_size: 20,
      p_category: "Vlees/Gehakt",
      p_brand: "Hoogvliet",
      p_offers_only: true,
      p_max_price: 5,
      p_sort: "price-asc",
      p_now: "2026-09-15",
    });
    expect(result.products[0]?.sku).toBe("123456789");
  });
});
