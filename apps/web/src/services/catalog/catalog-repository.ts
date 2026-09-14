import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapCatalogRows } from "@/services/catalog/catalog-mapper";
import type { CatalogPageResult } from "@/types/catalog";

export const DEFAULT_CATALOG_PAGE_SIZE = 20;
export const MAX_CATALOG_PAGE_SIZE = 20;

export interface CatalogPageRequest {
  page?: number;
  pageSize?: number;
  signal?: AbortSignal;
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
}

export class SupabaseCatalogRepository implements CatalogRepository {
  constructor(private readonly client: SupabaseClient) {}

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

    let priceQuery = this.client
      .from("product_prices")
      .select(PRICE_FIELDS)
      .in("product_id", productIds);

    if (signal) {
      priceQuery = priceQuery.abortSignal(signal);
    }

    const { data: priceRows, error: priceError } = await priceQuery;
    if (priceError || !Array.isArray(priceRows)) {
      return {
        ...mapCatalogRows(pageRows, [], "unavailable"),
        page,
        pageSize,
        hasMore,
      };
    }

    return {
      ...mapCatalogRows(pageRows, priceRows),
      page,
      pageSize,
      hasMore,
    };
  }
}

export function createCatalogRepository(): CatalogRepository {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new CatalogReadError("not-configured");
  }

  return new SupabaseCatalogRepository(client);
}
