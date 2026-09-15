import { describe, expect, it } from "vitest";

import {
  DEFAULT_CATALOG_PAGE_SIZE,
  normalizeCatalogPageRequest,
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
