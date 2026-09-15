import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  mapCatalogRows,
  mapJoinedCatalogRows,
} from "@/services/catalog/catalog-mapper";
import { DEFAULT_CATALOG_QUERY } from "@/services/catalog/catalog-search-state";
import { isOfferActive } from "@/services/catalog/price";
import type {
  CatalogFilterOptions,
  CatalogPageResult,
  CatalogProductsResult,
  CatalogQuery,
  CatalogQueryPageResult,
  CatalogSort,
  Product,
} from "@/types/catalog";

export const DEFAULT_CATALOG_PAGE_SIZE = 20;
export const MAX_CATALOG_PAGE_SIZE = 20;
export const MIN_CATALOG_SEARCH_LENGTH = 2;
export const CATALOG_SEARCH_LIMIT = 12;
export const CATALOG_FILTER_SAMPLE_LIMIT = 750;

export interface CatalogPageRequest {
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

export interface CatalogSearchRequest {
  limit?: number;
  signal?: AbortSignal;
}

export interface CatalogQueryRequest extends CatalogPageRequest {
  term?: string;
  category?: string | null;
  brand?: string | null;
  offersOnly?: boolean;
  maxPrice?: number | null;
  sort?: CatalogSort;
  now?: Date;
}

export interface CatalogFilterOptionsRequest {
  term?: string;
  category?: string | null;
  signal?: AbortSignal;
}

export interface NormalizedCatalogSearchRequest {
  term: string;
  pattern: string;
  limit: number;
}

export interface NormalizedCatalogPageRequest {
  page: number;
  pageSize: number;
  rangeStart: number;
  rangeEnd: number;
}

export interface NormalizedCatalogQueryRequest
  extends NormalizedCatalogPageRequest {
  query: CatalogQuery;
  pattern: string | null;
  requiresPriceRelation: boolean;
}

const VALID_SORTS = new Set<CatalogSort>([
  "relevance",
  "price-asc",
  "price-desc",
  "name-asc",
]);

export function normalizeCatalogPageRequest(
  request: CatalogPageRequest = {},
): NormalizedCatalogPageRequest {
  const requestedPage = Number.isFinite(request.page) ? Math.trunc(request.page ?? 1) : 1;
  const requestedPageSize = Number.isFinite(request.pageSize)
    ? Math.trunc(request.pageSize ?? DEFAULT_CATALOG_PAGE_SIZE)
    : DEFAULT_CATALOG_PAGE_SIZE;
  const page = Math.max(1, requestedPage);
  const pageSize = Math.max(1, Math.min(MAX_CATALOG_PAGE_SIZE, requestedPageSize));
  const rangeStart = (page - 1) * pageSize;

  return {
    page,
    pageSize,
    rangeStart,
    // Eén extra record bepaalt of er een volgende pagina is.
    rangeEnd: rangeStart + pageSize,
  };
}

export function normalizeCatalogSearchRequest(
  term: string,
  request: CatalogSearchRequest = {},
): NormalizedCatalogSearchRequest | null {
  const normalizedTerm = term.trim().replace(/\s+/g, " ").slice(0, 80);
  if (normalizedTerm.length < MIN_CATALOG_SEARCH_LENGTH) return null;

  // Houd PostgREST-operatoren buiten de filterwaarde. Woorden en cijfers blijven
  // behouden; tussenliggende tekens worden een wildcard zodat o.a. "1,5 liter"
  // bruikbaar zoekt zonder een vrije filterexpressie op te bouwen.
  const safeParts = normalizedTerm.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (safeParts.join("").length < MIN_CATALOG_SEARCH_LENGTH) return null;

  const requestedLimit = Number.isFinite(request.limit)
    ? Math.trunc(request.limit ?? CATALOG_SEARCH_LIMIT)
    : CATALOG_SEARCH_LIMIT;

  return {
    term: normalizedTerm,
    pattern: `%${safeParts.join("%")}%`,
    limit: Math.max(1, Math.min(CATALOG_SEARCH_LIMIT, requestedLimit)),
  };
}

function optionalFilter(value: string | null | undefined): string | null {
  const normalized = value?.trim().slice(0, 120) ?? "";
  return normalized || null;
}

export function normalizeCatalogQueryRequest(
  request: CatalogQueryRequest = {},
): NormalizedCatalogQueryRequest {
  const page = normalizeCatalogPageRequest(request);
  const normalizedSearch = normalizeCatalogSearchRequest(request.term ?? "", {
    limit: page.pageSize,
  });
  const requestedMaximum = request.maxPrice;
  const maxPrice =
    typeof requestedMaximum === "number" &&
    Number.isFinite(requestedMaximum) &&
    requestedMaximum > 0
      ? Math.min(requestedMaximum, 9999)
      : null;
  const sort =
    request.sort && VALID_SORTS.has(request.sort)
      ? request.sort
      : DEFAULT_CATALOG_QUERY.sort;
  const query: CatalogQuery = {
    term: normalizedSearch?.term ?? "",
    category: optionalFilter(request.category),
    brand: optionalFilter(request.brand),
    offersOnly: request.offersOnly === true,
    maxPrice,
    sort,
  };

  return {
    ...page,
    query,
    pattern: normalizedSearch?.pattern ?? null,
    requiresPriceRelation:
      query.offersOnly ||
      query.maxPrice !== null ||
      query.sort === "price-asc" ||
      query.sort === "price-desc",
  };
}

export function productSearchRelevance(product: Product, term: string): number {
  const needle = term.trim().toLocaleLowerCase("nl-NL");
  if (!needle) return 0;
  const name = product.name.toLocaleLowerCase("nl-NL");
  const brand = product.brand?.toLocaleLowerCase("nl-NL") ?? "";
  const category = product.category?.toLocaleLowerCase("nl-NL") ?? "";
  const packageText = product.packageText?.toLocaleLowerCase("nl-NL") ?? "";

  if (name === needle) return 100;
  if (name.startsWith(`${needle} `) || name.startsWith(`${needle}-`)) return 90;
  if (brand === needle) return 80;
  if (name.includes(needle)) return 70;
  if (brand.startsWith(needle)) return 60;
  if (brand.includes(needle)) return 50;
  if (category.includes(needle)) return 30;
  if (packageText.includes(needle)) return 20;
  return 0;
}

export function sortProductsForQuery(
  products: Product[],
  query: CatalogQuery,
): Product[] {
  if (!query.term || query.sort !== "relevance") return products;
  return products.toSorted((left, right) => {
    const score =
      productSearchRelevance(right, query.term) -
      productSearchRelevance(left, query.term);
    return score || left.name.localeCompare(right.name, "nl-NL") || left.id.localeCompare(right.id);
  });
}

const PRODUCT_FIELDS = [
  "id",
  "supermarket",
  "sku",
  "name",
  "brand",
  "category",
  "product_type",
  "package_text",
  "weight_grams",
  "image_url",
  "source_url",
  "is_available",
  "updated_at",
].join(",");

const PRICE_FIELDS = [
  "product_id",
  "price",
  "old_price",
  "is_offer",
  "offer_text",
  "valid_from",
  "valid_until",
  "fetched_at",
  "updated_at",
].join(",");

const FACET_FIELDS = "brand,category,product_type";

export type CatalogReadErrorCode =
  | "not-configured"
  | "products-unavailable"
  | "invalid-response";

export class CatalogReadError extends Error {
  constructor(readonly code: CatalogReadErrorCode) {
    super(code);
    this.name = "CatalogReadError";
  }
}

export interface CatalogRepository {
  getPage(request?: CatalogPageRequest): Promise<CatalogPageResult>;
  getByIds(productIds: string[], signal?: AbortSignal): Promise<CatalogProductsResult>;
  query(request?: CatalogQueryRequest): Promise<CatalogQueryPageResult>;
  search(term: string, request?: CatalogSearchRequest): Promise<CatalogProductsResult>;
  getFilterOptions(request?: CatalogFilterOptionsRequest): Promise<CatalogFilterOptions>;
}

function valuesFromFacetRows(
  rows: unknown[],
  field: "brand" | "category" | "product_type",
): string[] {
  const values = new Set<string>();
  for (const row of rows) {
    if (typeof row !== "object" || row === null || !(field in row)) continue;
    const value = (row as Record<string, unknown>)[field];
    if (typeof value === "string" && value.trim()) values.add(value.trim());
  }
  return [...values].sort((left, right) => left.localeCompare(right, "nl-NL"));
}

export class SupabaseCatalogRepository implements CatalogRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async pricesForProducts(
    productRows: unknown[],
    productIds: string[],
    signal?: AbortSignal,
  ): Promise<CatalogProductsResult> {
    let priceQuery = this.client
      .from("product_prices")
      .select(PRICE_FIELDS)
      .in("product_id", productIds);

    if (signal) priceQuery = priceQuery.abortSignal(signal);
    const { data: priceRows, error: priceError } = await priceQuery;
    if (priceError || !Array.isArray(priceRows)) {
      return mapCatalogRows(productRows, [], "unavailable");
    }
    return mapCatalogRows(productRows, priceRows);
  }

  async query(request: CatalogQueryRequest = {}): Promise<CatalogQueryPageResult> {
    const normalized = normalizeCatalogQueryRequest(request);
    const {
      page,
      pageSize,
      rangeStart,
      rangeEnd,
      query,
      pattern,
      requiresPriceRelation,
    } = normalized;
    const priceRelation = requiresPriceRelation
      ? `current_price:product_prices!inner(${PRICE_FIELDS})`
      : `current_price:product_prices(${PRICE_FIELDS})`;

    let productQuery = this.client
      .from("products")
      .select(`${PRODUCT_FIELDS},${priceRelation}`)
      .eq("supermarket", "Hoogvliet");

    if (pattern) {
      productQuery = productQuery.or(
        `name.ilike.${pattern},brand.ilike.${pattern},package_text.ilike.${pattern},category.ilike.${pattern},product_type.ilike.${pattern}`,
      );
    }
    if (query.category) productQuery = productQuery.eq("category", query.category);
    if (query.brand) productQuery = productQuery.eq("brand", query.brand);
    if (query.maxPrice !== null) {
      productQuery = productQuery.lte("current_price.price", query.maxPrice);
    }
    if (query.offersOnly) {
      const today = (request.now ?? new Date()).toISOString().slice(0, 10);
      productQuery = productQuery
        .eq("current_price.is_offer", true)
        .or(`valid_from.is.null,valid_from.lte.${today}`, {
          referencedTable: "current_price",
        })
        .or(`valid_until.is.null,valid_until.gte.${today}`, {
          referencedTable: "current_price",
        });
    }

    if (query.sort === "price-asc" || query.sort === "price-desc") {
      productQuery = productQuery
        .order("price", {
          ascending: query.sort === "price-asc",
          nullsFirst: false,
          referencedTable: "current_price",
        })
        .order("name", { ascending: true })
        .order("id", { ascending: true });
    } else {
      productQuery = productQuery
        .order("name", { ascending: true })
        .order("id", { ascending: true });
    }

    productQuery = productQuery.range(rangeStart, rangeEnd);
    if (request.signal) productQuery = productQuery.abortSignal(request.signal);

    const { data: productRows, error: productError } = await productQuery;
    if (productError) throw new CatalogReadError("products-unavailable");
    if (!Array.isArray(productRows)) throw new CatalogReadError("invalid-response");

    const hasMore = productRows.length > pageSize;
    const mapped = mapJoinedCatalogRows(productRows.slice(0, pageSize));
    const products = sortProductsForQuery(mapped.products, query).filter(
      (product) =>
        !query.offersOnly ||
        (product.currentPrice !== null &&
          isOfferActive(product.currentPrice, request.now)),
    );

    return {
      products,
      priceStatus: mapped.priceStatus,
      page,
      pageSize,
      hasMore,
      query,
    };
  }

  async getPage(request: CatalogPageRequest = {}): Promise<CatalogPageResult> {
    return this.query({ ...request, sort: "name-asc" });
  }

  async getByIds(
    productIds: string[],
    signal?: AbortSignal,
  ): Promise<CatalogProductsResult> {
    const uniqueIds = [...new Set(productIds.filter(Boolean))].slice(0, 100);
    if (uniqueIds.length === 0) return { products: [], priceStatus: "complete" };

    let productQuery = this.client
      .from("products")
      .select(PRODUCT_FIELDS)
      .eq("supermarket", "Hoogvliet")
      .in("id", uniqueIds)
      .order("name", { ascending: true })
      .order("id", { ascending: true });

    if (signal) productQuery = productQuery.abortSignal(signal);
    const { data: productRows, error: productError } = await productQuery;
    if (productError) throw new CatalogReadError("products-unavailable");
    if (!Array.isArray(productRows)) throw new CatalogReadError("invalid-response");
    if (productRows.length === 0) return { products: [], priceStatus: "complete" };

    const returnedIds = productRows
      .map((row) =>
        typeof row === "object" && row !== null && "id" in row
          ? (row as { id?: unknown }).id
          : null,
      )
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    if (returnedIds.length === 0) throw new CatalogReadError("invalid-response");
    return this.pricesForProducts(productRows, returnedIds, signal);
  }

  async search(
    term: string,
    request: CatalogSearchRequest = {},
  ): Promise<CatalogProductsResult> {
    const normalized = normalizeCatalogSearchRequest(term, request);
    if (!normalized) return { products: [], priceStatus: "complete" };
    const result = await this.query({
      term: normalized.term,
      page: 1,
      pageSize: normalized.limit,
      sort: "relevance",
      signal: request.signal,
    });
    return { products: result.products, priceStatus: result.priceStatus };
  }

  async getFilterOptions(
    request: CatalogFilterOptionsRequest = {},
  ): Promise<CatalogFilterOptions> {
    const search = normalizeCatalogSearchRequest(request.term ?? "");
    let facetQuery = this.client
      .from("products")
      .select(FACET_FIELDS)
      .eq("supermarket", "Hoogvliet")
      .limit(CATALOG_FILTER_SAMPLE_LIMIT);

    if (search) {
      facetQuery = facetQuery.or(
        `name.ilike.${search.pattern},brand.ilike.${search.pattern},package_text.ilike.${search.pattern},category.ilike.${search.pattern},product_type.ilike.${search.pattern}`,
      );
    }
    if (request.category) facetQuery = facetQuery.eq("category", request.category);
    if (request.signal) facetQuery = facetQuery.abortSignal(request.signal);

    const { data, error } = await facetQuery;
    if (error || !Array.isArray(data)) throw new CatalogReadError("products-unavailable");

    const categories = valuesFromFacetRows(data, "category");
    const productTypes = valuesFromFacetRows(data, "product_type");
    return {
      categories: categories.length > 0 ? categories : productTypes,
      brands: valuesFromFacetRows(data, "brand").slice(0, 40),
    };
  }
}

export function createCatalogRepository(): CatalogRepository {
  const client = getSupabaseBrowserClient();
  if (!client) throw new CatalogReadError("not-configured");
  return new SupabaseCatalogRepository(client);
}
