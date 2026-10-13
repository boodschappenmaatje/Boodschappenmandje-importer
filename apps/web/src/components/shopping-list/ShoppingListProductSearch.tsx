"use client";

import { ProductThumbnail } from "@/components/ui/ProductThumbnail";

import { useEffect, useRef, useState } from "react";

import { CatalogFilterSheet } from "@/components/catalog/CatalogFilterSheet";
import { Icon } from "@/components/Icon";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import {
  CATALOG_SEARCH_LIMIT,
  MIN_CATALOG_SEARCH_LENGTH,
  createCatalogRepository,
  normalizeCatalogSearchRequest,
} from "@/services/catalog/catalog-repository";
import {
  DEFAULT_CATALOG_QUERY,
  activeCatalogFilters,
  clearCatalogFilters,
} from "@/services/catalog/catalog-search-state";
import { resolveCurrentPrice } from "@/services/catalog/price";
import type {
  CatalogFilterOptions,
  CatalogQuery,
  Product,
} from "@/types/catalog";

export const CATALOG_SEARCH_DEBOUNCE_MS = 325;

const EMPTY_FILTER_OPTIONS: CatalogFilterOptions = {
  categories: [],
  brands: [],
};

export function shouldRunListProductSearch(query: CatalogQuery): boolean {
  return (
    normalizeCatalogSearchRequest(query.term) !== null ||
    query.category !== null ||
    query.brand !== null ||
    query.offersOnly ||
    query.maxPrice !== null ||
    query.sort !== "relevance"
  );
}

export type ProductSearchViewState =
  | { status: "prompt" }
  | { status: "searching" }
  | { status: "loaded"; products: Product[]; priceStatus: "complete" | "unavailable" }
  | { status: "offline" }
  | { status: "error" };

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});


function SearchResultCard({
  product,
  quantity,
  isAdding,
  listReady,
  onAdd,
}: {
  product: Product;
  quantity: number;
  isAdding: boolean;
  listReady: boolean;
  onAdd: () => void;
}) {
  const price = resolveCurrentPrice(product.currentPrice);
  const description = [product.brand, product.packageText].filter(Boolean).join(" · ");

  return (
    <li className="search-result-card">
      <ProductThumbnail className="search-result-image" imageUrl={product.imageUrl} name={product.name} />
      <div className="search-result-copy">
        <h3>{product.name}</h3>
        {description ? <p>{description}</p> : null}
        <div className="search-result-price">
          {price ? <strong>{euroFormatter.format(price.amount)}</strong> : <span>Geen prijs</span>}
          {price?.isOffer ? <span className="compact-offer-label">Actie</span> : null}
        </div>
      </div>
      <button
        className="search-result-add"
        type="button"
        disabled={!listReady || isAdding}
        aria-label={`Voeg ${product.name} toe aan boodschappenlijst`}
        onClick={onAdd}
      >
        <Icon name="plus" size={18} />
        <span>{isAdding ? "Bezig…" : quantity > 0 ? "Nog één" : "Toevoegen"}</span>
      </button>
    </li>
  );
}

export function ProductSearchResults({
  state,
  listReady,
  addingProductId,
  quantityFor,
  onAdd,
}: {
  state: ProductSearchViewState;
  listReady: boolean;
  addingProductId: string | null;
  quantityFor: (productId: string) => number;
  onAdd: (product: Product) => void;
}) {
  if (state.status === "prompt") {
    return (
      <div className="search-empty-state" role="status">
        <Icon name="products" size={28} />
        <p>Typ minimaal {MIN_CATALOG_SEARCH_LENGTH} tekens om een product te zoeken.</p>
      </div>
    );
  }

  if (state.status === "searching") {
    return (
      <div className="search-empty-state" role="status" aria-live="polite" aria-busy="true">
        <span className="catalog-spinner" aria-hidden="true" />
        <p>Producten zoeken…</p>
      </div>
    );
  }

  if (state.status === "offline") {
    return (
      <div className="search-empty-state" data-kind="error" role="status">
        <Icon name="cloud" size={28} />
        <p>Zoeken heeft internet nodig. Je bestaande lijst blijft offline bruikbaar.</p>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div className="search-empty-state" data-kind="error" role="status">
        <Icon name="cloud" size={28} />
        <p>Producten zoeken lukt nu niet. Probeer het straks opnieuw.</p>
      </div>
    );
  }

  if (state.products.length === 0) {
    return (
      <div className="search-empty-state" role="status">
        <Icon name="products" size={28} />
        <p>Geen producten gevonden. Probeer een andere naam of een merk.</p>
      </div>
    );
  }

  return (
    <>
      {state.priceStatus === "unavailable" ? (
        <p className="search-price-notice" role="status">
          Producten gevonden; prijzen zijn tijdelijk niet beschikbaar.
        </p>
      ) : null}
      <ul className="search-results" aria-label="Gevonden producten">
        {state.products.map((product) => (
          <SearchResultCard
            key={product.id}
            product={product}
            quantity={quantityFor(product.id)}
            isAdding={addingProductId === product.id}
            listReady={listReady}
            onAdd={() => onAdd(product)}
          />
        ))}
      </ul>
    </>
  );
}

export function ShoppingListProductSearch({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const shoppingList = useActiveShoppingList();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState<CatalogQuery>(DEFAULT_CATALOG_QUERY);
  const [filterOptions, setFilterOptions] =
    useState<CatalogFilterOptions>(EMPTY_FILTER_OPTIONS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [online, setOnline] = useState(() =>
    typeof window === "undefined" ? true : window.navigator.onLine,
  );
  const [state, setState] = useState<ProductSearchViewState>({ status: "prompt" });
  const [addingProductId, setAddingProductId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const updateOnlineState = () => {
      const nextOnline = window.navigator.onLine;
      setOnline(nextOnline);
      if (shouldRunListProductSearch(query)) {
        setState(nextOnline ? { status: "searching" } : { status: "offline" });
      }
    };
    window.addEventListener("online", updateOnlineState);
    window.addEventListener("offline", updateOnlineState);
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("online", updateOnlineState);
      window.removeEventListener("offline", updateOnlineState);
    };
  }, [open, query]);

  useEffect(() => {
    if (!open) return;
    if (!shouldRunListProductSearch(query) || !online) return;

    const controller = new AbortController();
    const debounceTimer = window.setTimeout(async () => {
      try {
        const result = await createCatalogRepository(shoppingList.supermarketId).query({
          ...query,
          page: 1,
          pageSize: CATALOG_SEARCH_LIMIT,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setState({
            status: "loaded",
            products: result.products,
            priceStatus: result.priceStatus,
          });
        }
      } catch {
        if (!controller.signal.aborted) {
          setState(window.navigator.onLine ? { status: "error" } : { status: "offline" });
        }
      }
    }, CATALOG_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [online, open, query, shoppingList.supermarketId]);

  useEffect(() => {
    if (!open || !online) return;
    const controller = new AbortController();
    const debounceTimer = window.setTimeout(async () => {
      try {
        const normalized = normalizeCatalogSearchRequest(query.term);
        const result = await createCatalogRepository(shoppingList.supermarketId).getFilterOptions({
          term: normalized?.term ?? "",
          category: query.category,
          signal: controller.signal,
        });
        if (!controller.signal.aborted) {
          setFilterOptions({
            categories:
              query.category && !result.categories.includes(query.category)
                ? [query.category, ...result.categories]
                : result.categories,
            brands:
              query.brand && !result.brands.includes(query.brand)
                ? [query.brand, ...result.brands]
                : result.brands,
          });
        }
      } catch {
        if (!controller.signal.aborted) setFilterOptions(EMPTY_FILTER_OPTIONS);
      }
    }, CATALOG_SEARCH_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(debounceTimer);
      controller.abort();
    };
  }, [online, open, query.brand, query.category, query.term, shoppingList.supermarketId]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  async function addProduct(product: Product) {
    if (shoppingList.status !== "ready" || addingProductId) return;
    const previousQuantity = shoppingList.quantityFor(product.id);
    setAddingProductId(product.id);
    setFeedback(null);
    try {
      await shoppingList.addProduct(product);
      setFeedback(
        previousQuantity > 0
          ? `Aantal aangepast naar ${previousQuantity + 1}`
          : `${product.name} toegevoegd`,
      );
    } catch {
      setFeedback("Dit product kon niet veilig worden toegevoegd.");
    } finally {
      setAddingProductId(null);
    }
  }

  const activeFilters = activeCatalogFilters(query);

  return (
    <section
      className="product-search-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="product-search-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="product-search-header">
        <div>
          <p>Jouw boodschappenlijst</p>
          <h2 id="product-search-title">Zoek en voeg product toe</h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Sluit product zoeken">
          Sluiten
        </button>
      </div>

      <div className="product-search-query-tools">
        <div className="product-search-controls">
          <div className="product-search-field">
            <Icon name="products" size={20} />
            <input
              ref={inputRef}
              type="search"
              value={query.term}
              onChange={(event) => {
                const nextQuery = { ...query, term: event.target.value };
                setQuery(nextQuery);
                setState(
                  !shouldRunListProductSearch(nextQuery)
                    ? { status: "prompt" }
                    : window.navigator.onLine
                      ? { status: "searching" }
                      : { status: "offline" },
                );
                setFeedback(null);
              }}
              placeholder="Zoek op product of merk"
              aria-label="Zoek op productnaam of merk"
              autoComplete="off"
              enterKeyHint="search"
              spellCheck="false"
            />
          </div>
          <button
            className="catalog-filter-button product-search-filter-button"
            type="button"
            aria-label={`Open filters${activeFilters.length ? `, ${activeFilters.length} actief` : ""}`}
            onClick={() => setFiltersOpen(true)}
          >
            Filters
            {activeFilters.length ? <span>{activeFilters.length}</span> : null}
          </button>
        </div>

        {activeFilters.length ? (
          <div className="catalog-active-filters" aria-label="Actieve filters">
            {activeFilters.map((filter) => (
              <button
                key={filter.key}
                type="button"
                aria-label={`Verwijder filter ${filter.label}`}
                onClick={() => {
                  const nextQuery: CatalogQuery = { ...query };
                  if (filter.key === "offersOnly") nextQuery.offersOnly = false;
                  else nextQuery[filter.key] = null;
                  setQuery(nextQuery);
                  setState(
                    shouldRunListProductSearch(nextQuery)
                      ? window.navigator.onLine
                        ? { status: "searching" }
                        : { status: "offline" }
                      : { status: "prompt" },
                  );
                }}
              >
                {filter.label} <span aria-hidden="true">×</span>
              </button>
            ))}
            <button
              className="catalog-clear-inline"
              type="button"
              onClick={() => {
                const nextQuery = clearCatalogFilters(query);
                setQuery(nextQuery);
                setState(
                  shouldRunListProductSearch(nextQuery)
                    ? window.navigator.onLine
                      ? { status: "searching" }
                      : { status: "offline" }
                    : { status: "prompt" },
                );
              }}
            >
              Wis filters
            </button>
          </div>
        ) : null}
      </div>

      {feedback ? (
        <p className="search-add-feedback" role="status" aria-live="polite">
          {feedback}
        </p>
      ) : null}

      <div className="product-search-results">
        <ProductSearchResults
          state={state}
          listReady={shoppingList.status === "ready"}
          addingProductId={addingProductId}
          quantityFor={shoppingList.quantityFor}
          onAdd={(product) => void addProduct(product)}
        />
      </div>

      <button className="product-search-done" type="button" onClick={onClose}>
        Klaar, terug naar mijn lijst
      </button>

      <CatalogFilterSheet
        open={filtersOpen}
        query={query}
        options={filterOptions}
        onClose={() => setFiltersOpen(false)}
        onClear={() => {
          const nextQuery = clearCatalogFilters(query);
          setQuery(nextQuery);
          setState(
            shouldRunListProductSearch(nextQuery)
              ? window.navigator.onLine
                ? { status: "searching" }
                : { status: "offline" }
              : { status: "prompt" },
          );
          setFiltersOpen(false);
        }}
        onApply={(nextQuery) => {
          setQuery(nextQuery);
          setState(
            shouldRunListProductSearch(nextQuery)
              ? window.navigator.onLine
                ? { status: "searching" }
                : { status: "offline" }
              : { status: "prompt" },
          );
          setFiltersOpen(false);
        }}
      />
    </section>
  );
}
