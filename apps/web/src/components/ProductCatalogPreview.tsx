"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";

import { Icon } from "@/components/Icon";
import {
  DEFAULT_CATALOG_PAGE_SIZE,
  createCatalogRepository,
} from "@/services/catalog/catalog-repository";
import {
  catalogReadErrorMessage,
  mergeCatalogProducts,
  priceUpdatedLabel,
  safeProductImageUrl,
} from "@/services/catalog/catalog-presentation";
import {
  getPricePerKilogram,
  resolveCurrentPrice,
} from "@/services/catalog/price";
import type { Product } from "@/types/catalog";

type ViewState =
  | { status: "loading" }
  | {
      status: "loaded";
      products: Product[];
      nextPage: number;
      hasMore: boolean;
      priceStatus: "complete" | "unavailable";
    }
  | { status: "error"; message: string };

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function safeImageStyle(imageUrl: string | null): CSSProperties | undefined {
  const safeUrl = safeProductImageUrl(imageUrl);
  if (!safeUrl) {
    return undefined;
  }
  return { backgroundImage: `url(${JSON.stringify(safeUrl)})` };
}

function Price({ product }: { product: Product }) {
  const price = resolveCurrentPrice(product.currentPrice);
  if (!price) {
    return (
      <span className="product-price-missing">
        Prijs tijdelijk niet beschikbaar
      </span>
    );
  }

  const pricePerKilogram = getPricePerKilogram(product, price);
  const updatedLabel = priceUpdatedLabel(price);

  return (
    <div className="product-price-block">
      {price.isOffer ? (
        <span className="offer-label">{price.offerText ?? "Aanbieding"}</span>
      ) : null}
      <div className="product-price-line">
        <strong>{euroFormatter.format(price.amount)}</strong>
        {price.comparisonPrice ? (
          <s>{euroFormatter.format(price.comparisonPrice)}</s>
        ) : null}
      </div>
      {pricePerKilogram ? (
        <span>{euroFormatter.format(pricePerKilogram)} / kg</span>
      ) : null}
      {updatedLabel ? (
        <span className="product-price-updated" data-freshness={price.freshness}>
          {updatedLabel}
        </span>
      ) : null}
    </div>
  );
}

function ProductCard({ product }: { product: Product }) {
  const imageStyle = safeImageStyle(product.imageUrl);
  const description = [product.brand, product.packageText]
    .filter(Boolean)
    .join(" · ");

  return (
    <article className="product-card">
      <div
        className="product-image"
        data-has-image={Boolean(imageStyle)}
        style={imageStyle}
        role="img"
        aria-label={imageStyle ? `Afbeelding van ${product.name}` : "Geen productafbeelding"}
      >
        {!imageStyle ? <Icon name="products" size={27} /> : null}
      </div>
      <div className="product-details">
        <p className="product-category">
          {product.category ?? product.productType ?? product.supermarket}
        </p>
        <h2>{product.name}</h2>
        {description ? <p className="product-description">{description}</p> : null}
        <Price product={product} />
      </div>
    </article>
  );
}

export function ProductCatalogPreview() {
  const [state, setState] = useState<ViewState>({ status: "loading" });
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);
  const loadMoreController = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const result = await createCatalogRepository().getPage({
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
          setState({
            status: "error",
            message: catalogReadErrorMessage(error),
          });
        }
      }
    }

    void loadProducts();
    return () => controller.abort();
  }, []);

  if (state.status === "loading") {
    return (
      <section className="catalog-state" aria-live="polite" aria-busy="true">
        <span className="catalog-spinner" aria-hidden="true" />
        <div>
          <h2>Producten laden</h2>
          <p>De bestaande catalogus wordt veilig opgehaald.</p>
        </div>
      </section>
    );
  }

  if (state.status === "error") {
    return (
      <section className="catalog-state" data-kind="error" role="status">
        <span className="status-icon"><Icon name="cloud" /></span>
        <div>
          <h2>Catalogus tijdelijk niet beschikbaar</h2>
          <p>{state.message}</p>
        </div>
      </section>
    );
  }

  if (state.products.length === 0) {
    return (
      <section className="catalog-state" role="status">
        <span className="status-icon"><Icon name="products" /></span>
        <div>
          <h2>Nog geen producten gevonden</h2>
          <p>De catalogus bevat momenteel geen beschikbare resultaten.</p>
        </div>
      </section>
    );
  }

  async function loadMore() {
    if (state.status !== "loaded" || !state.hasMore || isLoadingMore) {
      return;
    }

    loadMoreController.current?.abort();
    const controller = new AbortController();
    loadMoreController.current = controller;
    setIsLoadingMore(true);
    setLoadMoreError(null);

    try {
      const result = await createCatalogRepository().getPage({
        page: state.nextPage,
        pageSize: DEFAULT_CATALOG_PAGE_SIZE,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        setState((current) =>
          current.status === "loaded"
            ? {
                status: "loaded",
                products: mergeCatalogProducts(
                  current.products,
                  result.products,
                ),
                nextPage: result.page + 1,
                hasMore: result.hasMore,
                priceStatus:
                  current.priceStatus === "unavailable" ||
                  result.priceStatus === "unavailable"
                    ? "unavailable"
                    : "complete",
              }
            : current,
        );
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setLoadMoreError(catalogReadErrorMessage(error));
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLoadingMore(false);
      }
    }
  }

  return (
    <section className="catalog-preview" aria-labelledby="catalog-heading">
      <div className="section-heading">
        <h2 id="catalog-heading">Hoogvliet-producten</h2>
        <span>{state.products.length} geladen</span>
      </div>
      {state.priceStatus === "unavailable" ? (
        <p className="catalog-notice" role="status">
          Producten zijn geladen; prijsinformatie is tijdelijk niet beschikbaar.
        </p>
      ) : null}
      <div className="product-grid">
        {state.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {loadMoreError ? (
        <p className="catalog-inline-error" role="status">
          Meer producten laden lukte niet. Je huidige producten blijven zichtbaar.
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
        <p className="catalog-end">Alle beschikbare producten zijn geladen.</p>
      )}
    </section>
  );
}
