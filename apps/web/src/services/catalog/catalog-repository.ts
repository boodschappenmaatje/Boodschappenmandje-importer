import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import {
  mapCatalogRows,
  mapJoinedCatalogRows,
  mapPriceSortedCatalogRows,
  mapRankedCatalogRows,
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
import {
  DEFAULT_SUPERMARKET_ID,
  SUPERMARKETS,
  type SupermarketId,
} from "@/types/supermarket";

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
  tokens: string[];
  patterns: string[];
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
  searchFilter: string | null;
  requiresPriceRelation: boolean;
}

const SEARCH_FIELDS = [
  "name",
  "brand",
  "package_text",
  "category",
  "product_type",
] as const;

export function normalizeCatalogSearchText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nl-NL")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function searchTokens(value: string): string[] {
  const normalized = normalizeCatalogSearchText(value);
  return normalized ? normalized.split(" ") : [];
}

function databaseWordStartPatterns(tokens: string[]): string[] {
  const phrase = tokens.join("%");
  // PostgREST ILIKE heeft geen betrouwbare woordgrensoperator in een OR-filter.
  // Deze begrensde patronen dekken een begin en de gebruikelijke scheidingstekens
  // in productnamen, merken en categorieën. Zo matcht cola wel Coca-Cola, maar
  // niet de letterreeks in chocola/chocolade.
  return [
    `${phrase}%`,
    `% ${phrase}%`,
    `%-${phrase}%`,
    `%/${phrase}%`,
    `%>${phrase}%`,
    `%(${phrase}%`,
    `%[${phrase}%`,
  ];
}

export function catalogSearchFilter(
  search: NormalizedCatalogSearchRequest,
): string {
  return SEARCH_FIELDS.flatMap((field) =>
    search.patterns.map((pattern) => `${field}.ilike.${pattern}`),
  ).join(",");
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
  const tokens = searchTokens(normalizedTerm);
  if (tokens.join("").length < MIN_CATALOG_SEARCH_LENGTH) return null;

  const requestedLimit = Number.isFinite(request.limit)
    ? Math.trunc(request.limit ?? CATALOG_SEARCH_LIMIT)
    : CATALOG_SEARCH_LIMIT;

  return {
    term: normalizedTerm,
    tokens,
    patterns: databaseWordStartPatterns(tokens),
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
    searchFilter: normalizedSearch ? catalogSearchFilter(normalizedSearch) : null,
    requiresPriceRelation:
      query.offersOnly ||
      query.maxPrice !== null ||
      query.sort === "price-asc" ||
      query.sort === "price-desc",
  };
}

interface FieldSearchMetrics {
  matchedTokens: number;
  tokenScore: number;
  allTokens: boolean;
  exactPhrase: boolean;
  startsWithPhrase: boolean;
  endsWithPhrase: boolean;
  positionScore: number;
  tokenCount: number;
}

function fieldSearchMetrics(
  value: string | null,
  queryTokens: string[],
  exactTokenPoints: number,
  prefixTokenPoints: number,
): FieldSearchMetrics {
  const valueTokens = searchTokens(value ?? "");
  const phrase = queryTokens.join(" ");
  const normalizedValue = valueTokens.join(" ");
  let matchedTokens = 0;
  let tokenScore = 0;
  let positionScore = 0;

  for (const queryToken of queryTokens) {
    const position = valueTokens.findIndex((valueToken) =>
      valueToken.startsWith(queryToken),
    );
    if (position < 0) continue;
    matchedTokens += 1;
    tokenScore += valueTokens[position] === queryToken
      ? exactTokenPoints
      : prefixTokenPoints;
    positionScore += Math.max(0, 280 - position * 45);
  }

  return {
    matchedTokens,
    tokenScore,
    allTokens: queryTokens.length > 0 && matchedTokens === queryTokens.length,
    exactPhrase: normalizedValue === phrase,
    startsWithPhrase:
      normalizedValue === phrase || normalizedValue.startsWith(`${phrase} `),
    endsWithPhrase:
      normalizedValue === phrase || normalizedValue.endsWith(` ${phrase}`),
    positionScore,
    tokenCount: valueTokens.length,
  };
}

export function productMatchesSearchTokens(product: Product, term: string): boolean {
  const queryTokens = searchTokens(term);
  if (queryTokens.length === 0) return true;
  const searchableFields = [
    product.name,
    product.brand,
    product.category,
    product.productType,
    product.packageText,
  ].filter((value): value is string => Boolean(value));

  return queryTokens.every((queryToken) =>
    searchableFields.some((value) =>
      searchTokens(value).some((valueToken) => valueToken.startsWith(queryToken)),
    ),
  );
}

export function productSearchRelevance(product: Product, term: string): number {
  const queryTokens = searchTokens(term);
  if (queryTokens.length === 0 || !productMatchesSearchTokens(product, term)) return 0;

  const name = fieldSearchMetrics(product.name, queryTokens, 260, 190);
  const productType = fieldSearchMetrics(product.productType, queryTokens, 240, 180);
  const category = fieldSearchMetrics(product.category, queryTokens, 220, 160);
  const brand = fieldSearchMetrics(product.brand, queryTokens, 230, 170);
  const packageText = fieldSearchMetrics(product.packageText, queryTokens, 60, 35);

  return 1200
    + (name.exactPhrase ? 4000 : 0)
    + (name.startsWithPhrase && !name.exactPhrase ? 2800 : 0)
    + (productType.exactPhrase ? 2600 : 0)
    + (category.endsWithPhrase ? 2400 : 0)
    + (brand.exactPhrase ? 2400 : 0)
    + name.tokenScore
    + productType.tokenScore
    + category.tokenScore
    + brand.tokenScore
    + packageText.tokenScore
    + name.positionScore
    + (name.allTokens ? 1300 : 0)
    + (productType.allTokens ? 1200 : 0)
    + (category.allTokens ? 1100 : 0)
    + (brand.allTokens ? 1150 : 0)
    + (packageText.allTokens ? 150 : 0)
    + (name.allTokens && productType.allTokens ? 350 : 0)
    + (productType.allTokens && category.allTokens ? 2500 : 0)
    + (name.allTokens && category.allTokens ? 700 : 0)
    + (name.allTokens && name.tokenCount > 0
      ? Math.round(400 * queryTokens.length / name.tokenCount)
      : 0);
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

function matchesNormalizedSearch(product: Product, query: CatalogQuery): boolean {
  return !query.term || productMatchesSearchTokens(product, query.term);
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
  | "unsupported-provider"
  | "products-unavailable"
  | "invalid-response";

export class CatalogReadError extends Error {
  constructor(readonly code: CatalogReadErrorCode) {
    super(code);
    this.name = "CatalogReadError";
  }
}

export interface CatalogRepository {
  invalidateProducts?(productIds: string[]): void;
  /** Full candidate set for quantity-aware planning; the UI search stays compact. */
  searchCandidates?(term: string): Promise<CatalogProductsResult>;
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
  private candidateCatalog: { expiresAt: number; result: Promise<CatalogProductsResult> } | null = null;
  private readonly supermarketId: SupermarketId;
  private readonly now: () => number;

  constructor(
    private readonly client: SupabaseClient,
    supermarketOrNow: SupermarketId | (() => number) = DEFAULT_SUPERMARKET_ID,
    now = Date.now,
  ) {
    this.supermarketId = typeof supermarketOrNow === "string"
      ? supermarketOrNow
      : DEFAULT_SUPERMARKET_ID;
    this.now = typeof supermarketOrNow === "function" ? supermarketOrNow : now;
    if (!SUPERMARKETS[this.supermarketId]?.catalogSupported) {
      throw new CatalogReadError("unsupported-provider");
    }
  }

  private get supermarketName(): string {
    return SUPERMARKETS[this.supermarketId].name;
  }

  invalidateProducts(productIds: string[]): void {
    if (productIds.length) this.candidateCatalog = null;
  }

  async searchCandidates(term: string): Promise<CatalogProductsResult> {
    if (!normalizeCatalogSearchRequest(term)) return { products: [], priceStatus: "complete" };
    // The planner needs every candidate, not interactive relevance pages. Ranking
    // the entire catalog again for each 20-row page caused database timeouts.
    // Read one shared, short-lived catalog snapshot; use the existing token and
    // ingredient matchers. Producten/manual search retain their ranked RPC.
    const timestamp = this.now();
    if (!this.candidateCatalog || this.candidateCatalog.expiresAt <= timestamp) {
      const result = this.loadCandidateCatalog().catch((error: unknown) => {
        if (this.candidateCatalog?.result === result) this.candidateCatalog = null;
        throw error;
      });
      this.candidateCatalog = { expiresAt: timestamp + 60_000, result };
    }
    const snapshot = await this.candidateCatalog.result;
    return { ...snapshot, products: snapshot.products.filter(product => productMatchesSearchTokens(product, term)) };
  }

  private async loadCandidateCatalog(): Promise<CatalogProductsResult> {
    const products = new Map<string, Product>();
    let priceStatus: CatalogProductsResult["priceStatus"] = "complete";
    const batchSize = 250;
    for (let start = 0; ; start += batchSize) {
      const { data, error } = await this.client.from("products")
        .select(`${PRODUCT_FIELDS},current_price:product_prices(${PRICE_FIELDS})`)
        .eq("supermarket", this.supermarketName).order("id", { ascending: true })
        .range(start, start + batchSize - 1);
      if (error) throw new CatalogReadError("products-unavailable");
      if (!Array.isArray(data)) throw new CatalogReadError("invalid-response");
      const mapped = mapJoinedCatalogRows(data);
      for (const product of mapped.products) products.set(product.id, product);
      if (mapped.priceStatus !== "complete") priceStatus = mapped.priceStatus;
      if (data.length < batchSize) break;
    }
    return { products: [...products.values()], priceStatus };
  }

  async query(request: CatalogQueryRequest = {}): Promise<CatalogQueryPageResult> {
    const normalized = normalizeCatalogQueryRequest(request);
    const {
      page,
      pageSize,
      rangeStart,
      rangeEnd,
      query,
      searchFilter,
      requiresPriceRelation,
    } = normalized;

    // Iedere zoekende consumer gebruikt dezelfde server-side ranking. De RPC
    // rangschikt de volledige gefilterde set vóór paginering; Producten en de
    // compacte lijstzoeker kunnen daardoor niet uiteenlopen.
    if (query.term && query.sort !== "price-asc" && query.sort !== "price-desc") {
      let rankedQuery = this.client.rpc("search_catalog_products_v2", {
        p_term: query.term,
        p_page: page,
        p_page_size: pageSize,
        p_category: query.category,
        p_brand: query.brand,
        p_offers_only: query.offersOnly,
        p_max_price: query.maxPrice,
        p_sort: query.sort,
        p_now: (request.now ?? new Date()).toISOString().slice(0, 10),
      });
      if (request.signal) rankedQuery = rankedQuery.abortSignal(request.signal);

      const { data: rankedRows, error: rankedError } = await rankedQuery;
      if (rankedError) throw new CatalogReadError("products-unavailable");
      if (!Array.isArray(rankedRows)) throw new CatalogReadError("invalid-response");

      const hasMore = rankedRows.length > pageSize;
      const mapped = mapRankedCatalogRows(rankedRows.slice(0, pageSize));
      return {
        products: mapped.products,
        priceStatus: mapped.priceStatus,
        page,
        pageSize,
        hasMore,
        query,
      };
    }

    if (query.sort === "price-asc" || query.sort === "price-desc") {
      let priceQuery = this.client
        .from("product_prices")
        .select(`${PRICE_FIELDS},product:products!inner(${PRODUCT_FIELDS})`)
        .eq("product.supermarket", this.supermarketName)
        .gt("price", 0);

      if (searchFilter) {
        priceQuery = priceQuery.or(searchFilter, { referencedTable: "product" });
      }
      if (query.category) priceQuery = priceQuery.eq("product.category", query.category);
      if (query.brand) priceQuery = priceQuery.eq("product.brand", query.brand);
      if (query.maxPrice !== null) priceQuery = priceQuery.lte("price", query.maxPrice);
      if (query.offersOnly) {
        const today = (request.now ?? new Date()).toISOString().slice(0, 10);
        priceQuery = priceQuery
          .eq("is_offer", true)
          .or(`valid_from.is.null,valid_from.lte.${today}`)
          .or(`valid_until.is.null,valid_until.gte.${today}`);
      }

      priceQuery = priceQuery
        .order("price", { ascending: query.sort === "price-asc" })
        .order("product_id", { ascending: true })
        .range(rangeStart, rangeEnd);
      if (request.signal) priceQuery = priceQuery.abortSignal(request.signal);

      const { data: priceRows, error: priceError } = await priceQuery;
      if (priceError) throw new CatalogReadError("products-unavailable");
      if (!Array.isArray(priceRows)) throw new CatalogReadError("invalid-response");

      const hasMore = priceRows.length > pageSize;
      const mapped = mapPriceSortedCatalogRows(priceRows.slice(0, pageSize));
      return {
        products: mapped.products.filter(
          (product) =>
            matchesNormalizedSearch(product, query) &&
            (!query.offersOnly ||
              (product.currentPrice !== null &&
                isOfferActive(product.currentPrice, request.now))),
        ),
        priceStatus: mapped.priceStatus,
        page,
        pageSize,
        hasMore,
        query,
      };
    }

    const priceRelation = requiresPriceRelation
      ? `current_price:product_prices!inner(${PRICE_FIELDS})`
      : `current_price:product_prices(${PRICE_FIELDS})`;

    let productQuery = this.client
      .from("products")
      .select(`${PRODUCT_FIELDS},${priceRelation}`)
      .eq("supermarket", this.supermarketName);

    if (searchFilter) {
      productQuery = productQuery.or(searchFilter);
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
        .gt("current_price.price", 0)
        .or(`valid_from.is.null,valid_from.lte.${today}`, {
          referencedTable: "current_price",
        })
        .or(`valid_until.is.null,valid_until.gte.${today}`, {
          referencedTable: "current_price",
        });
    }

    productQuery = productQuery
      .order("name", { ascending: true })
      .order("id", { ascending: true });

    productQuery = productQuery.range(rangeStart, rangeEnd);
    if (request.signal) productQuery = productQuery.abortSignal(request.signal);

    const { data: productRows, error: productError } = await productQuery;
    if (productError) throw new CatalogReadError("products-unavailable");
    if (!Array.isArray(productRows)) throw new CatalogReadError("invalid-response");

    const hasMore = productRows.length > pageSize;
    const mapped = mapJoinedCatalogRows(productRows.slice(0, pageSize));
    const products = sortProductsForQuery(
      mapped.products.filter((product) => matchesNormalizedSearch(product, query)),
      query,
    ).filter(
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
      .eq("supermarket", this.supermarketName)
      .in("id", uniqueIds)
      .order("name", { ascending: true })
      .order("id", { ascending: true });
    let priceQuery = this.client
      .from("product_prices")
      .select(PRICE_FIELDS)
      .in("product_id", uniqueIds);

    if (signal) {
      productQuery = productQuery.abortSignal(signal);
      priceQuery = priceQuery.abortSignal(signal);
    }
    const [productResult, priceResult] = await Promise.all([
      productQuery,
      priceQuery,
    ]);
    const { data: productRows, error: productError } = productResult;
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
    const { data: priceRows, error: priceError } = priceResult;
    if (priceError || !Array.isArray(priceRows)) {
      return mapCatalogRows(productRows, [], "unavailable");
    }
    return mapCatalogRows(productRows, priceRows);
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
      .eq("supermarket", this.supermarketName)
      .limit(CATALOG_FILTER_SAMPLE_LIMIT);

    if (search) {
      facetQuery = facetQuery.or(catalogSearchFilter(search));
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

export function createCatalogRepository(
  supermarketId: SupermarketId = DEFAULT_SUPERMARKET_ID,
): CatalogRepository {
  if (!SUPERMARKETS[supermarketId]?.catalogSupported) {
    throw new CatalogReadError("unsupported-provider");
  }
  const client = getSupabaseBrowserClient();
  if (!client) throw new CatalogReadError("not-configured");
  return new SupabaseCatalogRepository(client, supermarketId);
}
