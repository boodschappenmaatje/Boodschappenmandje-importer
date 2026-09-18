import type {
  CatalogRepository,
  CatalogSearchRequest,
} from "@/services/catalog/catalog-repository";
import type {
  RecipeCatalog,
  RecipeRepository,
} from "@/services/week-preparation/recipe-repository";

export const PLANNING_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  expiresAt: number;
  value: Promise<T>;
}

interface PlanningCacheOptions {
  ttlMs?: number;
  now?: () => number;
}

function cached<T>(
  cache: Map<string, CacheEntry<T>>,
  key: string,
  load: () => Promise<T>,
  now: () => number,
  ttlMs: number,
): Promise<T> {
  const timestamp = now();
  const existing = cache.get(key);
  if (existing && existing.expiresAt > timestamp) return existing.value;

  const value = load().catch((error: unknown) => {
    cache.delete(key);
    throw error;
  });
  cache.set(key, { expiresAt: timestamp + ttlMs, value });
  return value;
}

/**
 * Reuses the immutable recipe definitions during a normal app session. The
 * short TTL prevents navigation and a second planning action from repeating
 * four Supabase reads, while still allowing curated recipe changes to appear.
 */
export function createCachedRecipeRepository(
  source: RecipeRepository,
  options: PlanningCacheOptions = {},
): RecipeRepository {
  const ttlMs = options.ttlMs ?? PLANNING_CACHE_TTL_MS;
  const now = options.now ?? Date.now;
  const cache = new Map<string, CacheEntry<RecipeCatalog>>();

  return {
    loadCatalog(signal) {
      if (signal) return source.loadCatalog(signal);
      return cached(cache, "catalog", () => source.loadCatalog(), now, ttlMs);
    },
  };
}

function searchKey(term: string, request: CatalogSearchRequest): string {
  return JSON.stringify([
    term.trim().replace(/\s+/g, " ").toLocaleLowerCase("nl-NL"),
    request.limit ?? null,
  ]);
}

/**
 * Product matching repeatedly asks for the same ingredient terms. Cache only
 * those planning reads (and exact-id refreshes); the interactive Producten
 * query remains delegated so its pagination and abort behaviour are unchanged.
 */
export function createCachedCatalogRepository(
  source: CatalogRepository,
  options: PlanningCacheOptions = {},
): CatalogRepository {
  const ttlMs = options.ttlMs ?? PLANNING_CACHE_TTL_MS;
  const now = options.now ?? Date.now;
  const searches = new Map<
    string,
    CacheEntry<Awaited<ReturnType<CatalogRepository["search"]>>>
  >();
  const productsByIds = new Map<
    string,
    CacheEntry<Awaited<ReturnType<CatalogRepository["getByIds"]>>>
  >();

  return {
    getPage: (request) => source.getPage(request),
    query: (request) => source.query(request),
    getFilterOptions: (request) => source.getFilterOptions(request),
    search(term, request = {}) {
      if (request.signal) return source.search(term, request);
      const key = searchKey(term, request);
      return cached(
        searches,
        key,
        () => source.search(term, request),
        now,
        ttlMs,
      );
    },
    getByIds(productIds, signal) {
      if (signal) return source.getByIds(productIds, signal);
      const ids = [...new Set(productIds.filter(Boolean))].toSorted();
      const key = ids.join("|");
      return cached(
        productsByIds,
        key,
        () => source.getByIds(ids),
        now,
        ttlMs,
      );
    },
  };
}
