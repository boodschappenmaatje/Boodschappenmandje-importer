"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { CatalogFilterSheet } from "@/components/catalog/CatalogFilterSheet";
import { CatalogProductCard } from "@/components/catalog/CatalogProductCard";
import { CatalogSearchField } from "@/components/catalog/CatalogSearchField";
import { Icon } from "@/components/Icon";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import {
  DEFAULT_CATALOG_PAGE_SIZE,
  MIN_CATALOG_SEARCH_LENGTH,
  createCatalogRepository,
} from "@/services/catalog/catalog-repository";
import {
  activeCatalogFilters,
  catalogQueryFromSearchParams,
  catalogQueryToSearchParams,
  clearCatalogFilters,
} from "@/services/catalog/catalog-search-state";
import {
  catalogReadErrorMessage,
  mergeCatalogProducts,
} from "@/services/catalog/catalog-presentation";
import type {
  CatalogFilterOptions,
  CatalogQuery,
  Product,
} from "@/types/catalog";

export const CATALOG_PAGE_SEARCH_DEBOUNCE_MS = 325;

type CatalogViewState =
  | { status: "loading" }
  | {
      status: "loaded";
      products: Product[];
      nextPage: number;
      hasMore: boolean;
      priceStatus: "complete" | "unavailable";
    }
  | { status: "error"; message: string };

const EMPTY_FILTER_OPTIONS: CatalogFilterOptions = {
  categories: [],
  brands: [],
};

export function catalogSearchInstruction(term: string): string | null {
  const trimmed = term.trim();
  if (trimmed.length === 0 || trimmed.length >= MIN_CATALOG_SEARCH_LENGTH) return null;
  return `Typ nog ${MIN_CATALOG_SEARCH_LENGTH - trimmed.length} teken om te zoeken.`;
}

export function CatalogSearchView() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamKey = searchParams.toString();
  const query = useMemo(
    () => catalogQueryFromSearchParams(new URLSearchParams(searchParamKey)),
    [searchParamKey],
  );
  const queryKey = JSON.stringify(query);
  const shoppingList = useActiveShoppingList();
  const [draftTerm, setDraftTerm] = useState(query.term);
  const [state, setState] = useState<CatalogViewState>({ status: "loading" });
  const [filters, setFilters] = useState<CatalogFilterOptions>(EMPTY_FILTER_OPTIONS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const [isAddingProductId, setIsAddingProductId] = useState<string | null>(null);
  const [addMessage, setAddMessage] = useState<string | null>(null);
  const loadMoreController = useRef<AbortController | null>(null);

  const updateQuery = useCallback(
    (nextQuery: CatalogQuery) => {
      const params = catalogQueryToSearchParams(nextQuery);
      const nextSearch = params.toString();
      if (nextSearch === searchParamKey) return;
      router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParamKey],
  );

  useEffect(() => {
    const trimmed = draftTerm.trim().replace(/\s+/g, " ").slice(0, 80);
    const nextTerm = trimmed.length >= MIN_CATALOG_SEARCH_LENGTH ? trimmed : "";
    if (nextTerm === query.term) return;
    const timer = window.setTimeout(() => {
      updateQuery({ ...query, term: nextTerm });
    }, CATALOG_PAGE_SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [draftTerm, query, updateQuery]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      setState({ status: "loading" });
      setLoadMoreError(null);
      try {
        const result = await createCatalogRepository(shoppingList.supermarketId).query({
          ...query,
          page: 1,
          pageSize: DEFAULT_CATALOG_PAGE_SIZE,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setState({
            status: "loaded",
            products: result.products,
            nextPage: 2,
            hasMore: result.hasMore,
            priceStatus: result.priceStatus,
          });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: catalogReadErrorMessage(error) });
        }
      }
    }

    void loadProducts();
    return () => controller.abort();
  }, [query, queryKey, shoppingList.supermarketId]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadFilters() {
      try {
        const result = await createCatalogRepository(shoppingList.supermarketId).getFilterOptions({
          term: query.term,
          category: query.category,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setFilters({
            categories: query.category && !result.categories.includes(query.category)
              ? [query.category, ...result.categories]
              : result.categories,
            brands: query.brand && !result.brands.includes(query.brand)
              ? [query.brand, ...result.brands]
              : result.brands,
          });
        }
      } catch {
        if (!controller.signal.aborted) setFilters(EMPTY_FILTER_OPTIONS);
      }
    }
    void loadFilters();
    return () => controller.abort();
  }, [query.brand, query.category, query.term, shoppingList.supermarketId]);

  async function loadMore() {
    if (state.status !== "loaded" || !state.hasMore || isLoadingMore) return;
    loadMoreController.current?.abort();
    const controller = new AbortController();
    loadMoreController.current = controller;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await createCatalogRepository(shoppingList.supermarketId).query({
        ...query,
        page: state.nextPage,
        pageSize: DEFAULT_CATALOG_PAGE_SIZE,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setState((current) =>
          current.status === "loaded"
            ? {
                status: "loaded",
                products: mergeCatalogProducts(current.products, result.products),
                nextPage: result.page + 1,
                hasMore: result.hasMore,
                priceStatus:
                  current.priceStatus === "unavailable" || result.priceStatus === "unavailable"
                    ? "unavailable"
                    : "complete",
              }
            : current,
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) setLoadMoreError(catalogReadErrorMessage(error));
    } finally {
      if (!controller.signal.aborted) setIsLoadingMore(false);
    }
  }

  async function addProduct(product: Product) {
    if (shoppingList.status !== "ready" || isAddingProductId) return;
    const previousQuantity = shoppingList.quantityFor(product.id);
    setIsAddingProductId(product.id);
    setAddMessage(null);
    try {
      await shoppingList.addProduct(product);
      setAddMessage(
        previousQuantity > 0
          ? `Toegevoegd — aantal nu ${previousQuantity + 1}`
          : `${product.name} toegevoegd`,
      );
    } catch {
      setAddMessage("Dit product kon niet veilig aan je lijst worden toegevoegd.");
    } finally {
      setIsAddingProductId(null);
    }
  }

  const activeFilters = activeCatalogFilters(query);
  const instruction = catalogSearchInstruction(draftTerm);

  return (
    <section className="catalog-search" aria-labelledby="catalog-heading">
      <div className="catalog-search-toolbar">
        <CatalogSearchField
          value={draftTerm}
          placeholder="Zoek producten"
          ariaLabel="Zoek producten op naam, merk, verpakking of categorie"
          onChange={(event) => setDraftTerm(event.target.value)}
          onClear={() => {
            setDraftTerm("");
            updateQuery({ ...query, term: "" });
          }}
        />
        <button
          className="catalog-filter-button"
          type="button"
          aria-label={`Open filters${activeFilters.length ? `, ${activeFilters.length} actief` : ""}`}
          onClick={() => setFiltersOpen(true)}
        >
          Filters
          {activeFilters.length ? <span>{activeFilters.length}</span> : null}
        </button>
      </div>

      {instruction ? <p className="catalog-search-hint">{instruction}</p> : null}

      {activeFilters.length ? (
        <div className="catalog-active-filters" aria-label="Actieve filters">
          {activeFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => {
                const cleared: CatalogQuery = { ...query };
                if (filter.key === "offersOnly") cleared.offersOnly = false;
                else cleared[filter.key] = null;
                updateQuery(cleared);
              }}
              aria-label={`Verwijder filter ${filter.label}`}
            >
              {filter.label} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button
            className="catalog-clear-inline"
            type="button"
            onClick={() => updateQuery(clearCatalogFilters(query))}
          >
            Wis filters
          </button>
        </div>
      ) : null}

      <div className="catalog-result-heading">
        <div>
          <p>Hoogvliet-catalogus</p>
          <h2 id="catalog-heading">
            {query.term ? `Resultaten voor “${query.term}”` : "Producten ontdekken"}
          </h2>
        </div>
        {state.status === "loaded" ? <span>{state.products.length} geladen</span> : null}
      </div>

      {state.status === "loading" ? (
        <div className="catalog-skeletons" aria-live="polite" aria-busy="true">
          <span className="visually-hidden">Producten laden</span>
          {[0, 1, 2].map((item) => <span key={item} className="catalog-skeleton" />)}
        </div>
      ) : null}

      {state.status === "error" ? (
        <div className="catalog-state" data-kind="error" role="status">
          <span className="status-icon"><Icon name="cloud" /></span>
          <div><h2>Catalogus tijdelijk niet beschikbaar</h2><p>{state.message}</p></div>
        </div>
      ) : null}

      {state.status === "loaded" && state.priceStatus === "unavailable" ? (
        <p className="catalog-notice" role="status">
          Producten zijn geladen; prijsinformatie is tijdelijk niet beschikbaar.
        </p>
      ) : null}

      {shoppingList.status === "error" ? (
        <p className="catalog-notice" role="status">
          Je lokale lijst kan nu niet worden geopend. De catalogus blijft beschikbaar.
        </p>
      ) : null}

      {addMessage ? (
        <p className="product-add-feedback" role="status" aria-live="polite">
          {addMessage}
        </p>
      ) : null}

      {state.status === "loaded" && state.products.length === 0 ? (
        <div className="catalog-no-results" role="status">
          <Icon name="products" size={30} />
          <h2>Geen producten gevonden</h2>
          <p>Pas je zoekterm aan of wis de actieve filters.</p>
          {activeFilters.length ? (
            <button type="button" onClick={() => updateQuery(clearCatalogFilters(query))}>
              Wis filters
            </button>
          ) : null}
        </div>
      ) : null}

      {state.status === "loaded" && state.products.length > 0 ? (
        <>
          <div className="product-grid">
            {state.products.map((product) => (
              <CatalogProductCard
                key={product.id}
                product={product}
                listQuantity={shoppingList.quantityFor(product.id)}
                isAdding={isAddingProductId === product.id}
                listReady={shoppingList.status === "ready"}
                onAdd={() => void addProduct(product)}
              />
            ))}
          </div>
          {loadMoreError ? (
            <p className="catalog-inline-error" role="status">
              Meer producten laden lukte niet. Je huidige resultaten blijven zichtbaar.
            </p>
          ) : null}
          {state.hasMore ? (
            <button
              className="catalog-load-more"
              type="button"
              disabled={isLoadingMore}
              onClick={() => void loadMore()}
            >
              {isLoadingMore ? "Meer producten laden…" : "Meer producten laden"}
            </button>
          ) : (
            <p className="catalog-end">Alle beschikbare resultaten zijn geladen.</p>
          )}
        </>
      ) : null}

      <CatalogFilterSheet
        open={filtersOpen}
        query={query}
        options={filters}
        onClose={() => setFiltersOpen(false)}
        onClear={() => {
          updateQuery(clearCatalogFilters(query));
          setFiltersOpen(false);
        }}
        onApply={(nextQuery) => {
          updateQuery(nextQuery);
          setFiltersOpen(false);
        }}
      />
    </section>
  );
}
