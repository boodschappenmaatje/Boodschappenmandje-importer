import type { CatalogQuery, CatalogSort } from "@/types/catalog";

export const DEFAULT_CATALOG_QUERY: CatalogQuery = {
  term: "",
  category: null,
  brand: null,
  offersOnly: false,
  maxPrice: null,
  sort: "relevance",
};

const CATALOG_SORTS = new Set<CatalogSort>([
  "relevance",
  "price-asc",
  "price-desc",
  "name-asc",
]);

type SearchParamsReader = Pick<URLSearchParams, "get">;

function optionalValue(value: string | null): string | null {
  const normalized = value?.trim().slice(0, 120) ?? "";
  return normalized || null;
}

function positivePrice(value: string | null): number | null {
  if (!value) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 9999) : null;
}

export function catalogQueryFromSearchParams(
  searchParams: SearchParamsReader,
): CatalogQuery {
  const requestedSort = searchParams.get("sort") as CatalogSort | null;

  return {
    term: searchParams.get("q")?.trim().replace(/\s+/g, " ").slice(0, 80) ?? "",
    category: optionalValue(searchParams.get("category")),
    brand: optionalValue(searchParams.get("brand")),
    offersOnly: searchParams.get("offer") === "1",
    maxPrice: positivePrice(searchParams.get("max")),
    sort:
      requestedSort && CATALOG_SORTS.has(requestedSort)
        ? requestedSort
        : "relevance",
  };
}

export function catalogQueryToSearchParams(query: CatalogQuery): URLSearchParams {
  const params = new URLSearchParams();
  if (query.term) params.set("q", query.term);
  if (query.category) params.set("category", query.category);
  if (query.brand) params.set("brand", query.brand);
  if (query.offersOnly) params.set("offer", "1");
  if (query.maxPrice !== null) params.set("max", String(query.maxPrice));
  if (query.sort !== "relevance") params.set("sort", query.sort);
  return params;
}

export function activeCatalogFilters(query: CatalogQuery): Array<{
  key: keyof Pick<CatalogQuery, "category" | "brand" | "offersOnly" | "maxPrice">;
  label: string;
}> {
  const filters: Array<{
    key: keyof Pick<CatalogQuery, "category" | "brand" | "offersOnly" | "maxPrice">;
    label: string;
  }> = [];

  if (query.category) {
    const segments = query.category.split("/").filter(Boolean);
    filters.push({ key: "category", label: segments.at(-1) ?? query.category });
  }
  if (query.brand) filters.push({ key: "brand", label: query.brand });
  if (query.offersOnly) filters.push({ key: "offersOnly", label: "In de aanbieding" });
  if (query.maxPrice !== null) {
    filters.push({
      key: "maxPrice",
      label: `Max. € ${query.maxPrice.toLocaleString("nl-NL", { minimumFractionDigits: 2 })}`,
    });
  }
  return filters;
}

export function clearCatalogFilters(query: CatalogQuery): CatalogQuery {
  return {
    ...DEFAULT_CATALOG_QUERY,
    term: query.term,
  };
}
