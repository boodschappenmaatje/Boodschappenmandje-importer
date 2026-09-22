import type {
  CatalogRepository,
  CatalogSearchRequest,
} from "@/services/catalog/catalog-repository";
import type {
  RecipeCatalog,
  RecipeRepository,
} from "@/services/week-preparation/recipe-repository";
import {
  type RecipeReadinessGateResult,
  type RecipeReadinessResult,
} from "@/services/week-preparation/recipe-readiness";
import {
  resolveRecipeReadiness,
  type PersistentRecipeReadinessRepository,
} from "@/services/week-preparation/persistent-readiness-cache";
import type { Product, Recipe } from "@/types/catalog";
import type { WeekPreparation } from "@/types/week-preparation";

export const PLANNING_CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  expiresAt: number;
  value: Promise<T>;
}

export interface PlanningCacheOptions {
  ttlMs?: number;
  now?: () => number;
  persistentRepository?: PersistentRecipeReadinessRepository | null;
}

interface ReadinessBucket {
  expiresAt: number;
  recipes: Map<string, RecipeReadinessResult>;
  matchedProductsByRequirement: Map<string, Product>;
  candidatesByRequirement: Map<string, { ingredient: RecipeCatalog["ingredients"][number]; products: Product[] }>;
  pending: Promise<void> | null;
}

interface WeekSnapshotEntry {
  expiresAt: number;
  value: WeekPreparation;
}

export interface CachedRecipeReadiness {
  gate: RecipeReadinessGateResult;
  hitCount: number;
  missCount: number;
}

export interface WeekPlanningSnapshotCache {
  prepareCatalog(
    sourceCatalog: RecipeCatalog,
    prepare: () => RecipeCatalog,
  ): RecipeCatalog;
  evaluateReadiness(
    sourceCatalog: RecipeCatalog,
    recipes: Recipe[],
    numberOfPeople: number,
    preparedCatalog: RecipeCatalog,
    catalogRepository: CatalogRepository,
  ): Promise<CachedRecipeReadiness>;
  getWeek(
    sourceCatalog: RecipeCatalog,
    key: string,
  ): WeekPreparation | null;
  setWeek(
    sourceCatalog: RecipeCatalog,
    key: string,
    preparation: WeekPreparation,
  ): void;
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
    ...(source.searchCandidates ? { searchCandidates: (term: string) => cached(
      searches, `all:${searchKey(term, {})}`, () => source.searchCandidates!(term), now, ttlMs,
    ) } : {}),
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

/**
 * Keeps the expensive derived planning data next to the existing repository
 * request cache. A catalog object is the snapshot identity: once the recipe
 * repository refreshes, the WeakMap key changes and READY/week snapshots can
 * no longer be reused accidentally.
 */
export function createWeekPlanningSnapshotCache(
  options: PlanningCacheOptions = {},
): WeekPlanningSnapshotCache {
  const ttlMs = options.ttlMs ?? PLANNING_CACHE_TTL_MS;
  const now = options.now ?? Date.now;
  const persistentRepository = options.persistentRepository ?? null;
  const preparedCatalogs = new WeakMap<RecipeCatalog, RecipeCatalog>();
  const readinessByCatalog = new WeakMap<
    RecipeCatalog,
    Map<number, ReadinessBucket>
  >();
  const weeksByCatalog = new WeakMap<
    RecipeCatalog,
    Map<string, WeekSnapshotEntry>
  >();

  function readinessBucket(
    sourceCatalog: RecipeCatalog,
    numberOfPeople: number,
  ): ReadinessBucket {
    let byPeople = readinessByCatalog.get(sourceCatalog);
    if (!byPeople) {
      byPeople = new Map();
      readinessByCatalog.set(sourceCatalog, byPeople);
    }
    const timestamp = now();
    const existing = byPeople.get(numberOfPeople);
    if (existing && existing.expiresAt > timestamp) return existing;
    const created: ReadinessBucket = {
      expiresAt: timestamp + ttlMs,
      recipes: new Map(),
      matchedProductsByRequirement: new Map(),
      candidatesByRequirement: new Map(),
      pending: null,
    };
    byPeople.set(numberOfPeople, created);
    return created;
  }

  async function fillMissingReadiness(
    bucket: ReadinessBucket,
    recipes: Recipe[],
    numberOfPeople: number,
    preparedCatalog: RecipeCatalog,
    catalogRepository: CatalogRepository,
  ): Promise<{ persistentHits: number; fallbackCount: number }> {
    if (bucket.pending) await bucket.pending;
    const missing = recipes.filter((recipe) => !bucket.recipes.has(recipe.id));
    if (missing.length === 0) return { persistentHits: 0, fallbackCount: 0 };

    let persistentHits = 0;
    let fallbackCount = missing.length;
    bucket.pending = resolveRecipeReadiness(
      missing,
      numberOfPeople,
      preparedCatalog,
      catalogRepository,
      persistentRepository,
      new Date(now()),
    ).then((resolution) => {
      persistentHits = resolution.persistentHitCount;
      fallbackCount = resolution.fallbackCount;
      for (const result of resolution.gate.recipes) {
        bucket.recipes.set(result.recipeId, result);
      }
      for (const [key, product] of resolution.gate.matchedProductsByRequirement) {
        bucket.matchedProductsByRequirement.set(key, product);
      }
      for (const [key, candidates] of resolution.gate.candidatesByRequirement ?? []) bucket.candidatesByRequirement.set(key, candidates);
    });
    try {
      await bucket.pending;
    } finally {
      bucket.pending = null;
    }
    return { persistentHits, fallbackCount };
  }

  return {
    prepareCatalog(sourceCatalog, prepare) {
      const existing = preparedCatalogs.get(sourceCatalog);
      if (existing) return existing;
      const prepared = prepare();
      preparedCatalogs.set(sourceCatalog, prepared);
      return prepared;
    },
    async evaluateReadiness(
      sourceCatalog,
      recipes,
      numberOfPeople,
      preparedCatalog,
      catalogRepository,
    ) {
      const bucket = readinessBucket(sourceCatalog, numberOfPeople);
      const hitCount = recipes.filter((recipe) =>
        bucket.recipes.has(recipe.id),
      ).length;
      const fill = await fillMissingReadiness(
        bucket,
        recipes,
        numberOfPeople,
        preparedCatalog,
        catalogRepository,
      );
      return {
        gate: {
          recipes: recipes.flatMap((recipe) => {
            const result = bucket.recipes.get(recipe.id);
            return result ? [result] : [];
          }),
          matchedProductsByRequirement: new Map(
            bucket.matchedProductsByRequirement,
          ),
          candidatesByRequirement: new Map(bucket.candidatesByRequirement),
        },
        hitCount: hitCount + fill.persistentHits,
        missCount: fill.fallbackCount,
      };
    },
    getWeek(sourceCatalog, key) {
      const byKey = weeksByCatalog.get(sourceCatalog);
      const existing = byKey?.get(key);
      if (!existing) return null;
      if (existing.expiresAt <= now()) {
        byKey?.delete(key);
        return null;
      }
      return existing.value;
    },
    setWeek(sourceCatalog, key, preparation) {
      let byKey = weeksByCatalog.get(sourceCatalog);
      if (!byKey) {
        byKey = new Map();
        weeksByCatalog.set(sourceCatalog, byKey);
      }
      byKey.set(key, {
        expiresAt: now() + ttlMs,
        value: preparation,
      });
    },
  };
}
