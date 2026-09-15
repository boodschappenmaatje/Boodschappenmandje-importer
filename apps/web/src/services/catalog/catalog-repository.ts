import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapCatalogRows } from "@/services/catalog/catalog-mapper";
import type { CatalogPageResult, CatalogProductsResult } from "@/types/catalog";

export const DEFAULT_CATALOG_PAGE_SIZE = 20;
export const MAX_CATALOG_PAGE_SIZE = 20;
export const MIN_CATALOG_SEARCH_LENGTH = 2;
export const CATALOG_SEARCH_LIMIT = 12;

export interface CatalogPageRequest {
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
}

export interface CatalogSearchRequest {
  limit?: number;
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
  if (normalizedTerm.length < MIN_CATALOG_SEARCH_LENGTH) {
    return null;
  }

  // Houd PostgREST-operatoren buiten de filterwaarde. Woorden en cijfers blijven
  // behouden; tussenliggende tekens worden een wildcard zodat o.a. "1,5 liter"
  // nog steeds bruikbaar zoekt zonder een vrije filterexpressie op te bouwen.
  const safeParts = normalizedTerm.match(/[\p{L}\p{N}]+/gu) ?? [];
  if (safeParts.join("").length < MIN_CATALOG_SEARCH_LENGTH) {
    return null;
  }

  const requestedLimit = Number.isFinite(request.limit)
    ? Math.trunc(request.limit ?? CATALOG_SEARCH_LIMIT)
    : CATALOG_SEARCH_LIMIT;

  return {
    term: normalizedTerm,
    pattern: `%${safeParts.join("%")}%`,
    limit: Math.max(1, Math.min(CATALOG_SEARCH_LIMIT, requestedLimit)),
  };
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
  search(term: string, request?: CatalogSearchRequest): Promise<CatalogProductsResult>;
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

    if (signal) {
      priceQuery = priceQuery.abortSignal(signal);
    }

    const { data: priceRows, error: priceError } = await priceQuery;
    if (priceError || !Array.isArray(priceRows)) {
      return mapCatalogRows(productRows, [], "unavailable");
    }

    return mapCatalogRows(productRows, priceRows);
  }

  async getPage(request: CatalogPageRequest = {}): Promise<CatalogPageResult> {
    const { page, pageSize, rangeStart, rangeEnd } =
      normalizeCatalogPageRequest(request);
    const { signal } = request;
    let productQuery = this.client
      .from("products")
      .select(PRODUCT_FIELDS)
      .eq("supermarket", "Hoogvliet")
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(rangeStart, rangeEnd);

    if (signal) {
      productQuery = productQuery.abortSignal(signal);
    }

    const { data: productRows, error: productError } = await productQuery;
    if (productError) {
      throw new CatalogReadError("products-unavailable");
    }
    if (!Array.isArray(productRows)) {
      throw new CatalogReadError("invalid-response");
    }
    if (productRows.length === 0) {
      return {
        products: [],
        priceStatus: "complete",
        page,
        pageSize,
        hasMore: false,
      };
    }

    const hasMore = productRows.length > pageSize;
    const pageRows = productRows.slice(0, pageSize);

    const productIds = pageRows
      .map((row) =>
        typeof row === "object" && row !== null && "id" in row
          ? (row as { id?: unknown }).id
          : null,
      )
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    if (productIds.length === 0) {
      throw new CatalogReadError("invalid-response");
    }

    return {
      ...(await this.pricesForProducts(pageRows, productIds, signal)),
      page,
      pageSize,
      hasMore,
    };
  }

  async getByIds(
    productIds: string[],
    signal?: AbortSignal,
  ): Promise<CatalogProductsResult> {
    const uniqueIds = [...new Set(productIds.filter(Boolean))].slice(0, 100);
    if (uniqueIds.length === 0) {
      return { products: [], priceStatus: "complete" };
    }

    let productQuery = this.client
      .from("products")
      .select(PRODUCT_FIELDS)
      .eq("supermarket", "Hoogvliet")
      .in("id", uniqueIds)
      .order("name", { ascending: true })
      .order("id", { ascending: true });

    if (signal) {
      productQuery = productQuery.abortSignal(signal);
    }

    const { data: productRows, error: productError } = await productQuery;
    if (productError) {
      throw new CatalogReadError("products-unavailable");
    }
    if (!Array.isArray(productRows)) {
      throw new CatalogReadError("invalid-response");
    }
    if (productRows.length === 0) {
      return { products: [], priceStatus: "complete" };
    }

    const returnedIds = productRows
      .map((row) =>
        typeof row === "object" && row !== null && "id" in row
          ? (row as { id?: unknown }).id
          : null,
      )
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    if (returnedIds.length === 0) {
      throw new CatalogReadError("invalid-response");
    }

    return this.pricesForProducts(productRows, returnedIds, signal);
  }

  async search(
    term: string,
    request: CatalogSearchRequest = {},
  ): Promise<CatalogProductsResult> {
    const normalized = normalizeCatalogSearchRequest(term, request);
    if (!normalized) {
      return { products: [], priceStatus: "complete" };
    }

    let productQuery = this.client
      .from("products")
      .select(PRODUCT_FIELDS)
      .eq("supermarket", "Hoogvliet")
      .or(`name.ilike.${normalized.pattern},brand.ilike.${normalized.pattern}`)
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .limit(normalized.limit);

    if (request.signal) {
      productQuery = productQuery.abortSignal(request.signal);
    }

    const { data: productRows, error: productError } = await productQuery;
    if (productError) {
      throw new CatalogReadError("products-unavailable");
    }
    if (!Array.isArray(productRows)) {
      throw new CatalogReadError("invalid-response");
    }
    if (productRows.length === 0) {
      return { products: [], priceStatus: "complete" };
    }

    const productIds = productRows
      .map((row) =>
        typeof row === "object" && row !== null && "id" in row
          ? (row as { id?: unknown }).id
          : null,
      )
      .filter((id): id is string => typeof id === "string" && id.length > 0);

    if (productIds.length === 0) {
      throw new CatalogReadError("invalid-response");
    }

    return this.pricesForProducts(productRows, productIds, request.signal);
  }
}

export function createCatalogRepository(): CatalogRepository {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new CatalogReadError("not-configured");
  }

  return new SupabaseCatalogRepository(client);
}
