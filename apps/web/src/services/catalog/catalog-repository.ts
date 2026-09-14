import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { mapCatalogRows } from "@/services/catalog/catalog-mapper";
import type { CatalogPreviewResult } from "@/types/catalog";

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
  getPreview(limit?: number, signal?: AbortSignal): Promise<CatalogPreviewResult>;
}

export class SupabaseCatalogRepository implements CatalogRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getPreview(
    limit = 10,
    signal?: AbortSignal,
  ): Promise<CatalogPreviewResult> {
    const safeLimit = Math.max(1, Math.min(10, Math.trunc(limit)));
    let productQuery = this.client
      .from("products")
      .select(PRODUCT_FIELDS)
      .eq("supermarket", "Hoogvliet")
      .order("name", { ascending: true })
      .limit(safeLimit);

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
}

export function createCatalogRepository(): CatalogRepository {
  const client = getSupabaseBrowserClient();
  if (!client) {
    throw new CatalogReadError("not-configured");
  }

  return new SupabaseCatalogRepository(client);
}
