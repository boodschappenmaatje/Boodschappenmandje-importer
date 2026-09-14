"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";

import { Icon } from "@/components/Icon";
import {
  CatalogReadError,
  createCatalogRepository,
} from "@/services/catalog/catalog-repository";
import type { CatalogPreviewResult, Product } from "@/types/catalog";

type ViewState =
  | { status: "loading" }
  | { status: "loaded"; result: CatalogPreviewResult }
  | { status: "error"; message: string };

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function userMessage(error: unknown): string {
  if (error instanceof CatalogReadError && error.code === "not-configured") {
    return "De productcatalogus is nog niet gekoppeld aan deze omgeving.";
  }

  return "De producten konden nu niet worden geladen. Probeer het later opnieuw.";
}

function safeImageStyle(imageUrl: string | null): CSSProperties | undefined {
  if (!imageUrl) {
    return undefined;
  }

  try {
    const url = new URL(imageUrl);
    if (url.protocol !== "https:") {
      return undefined;
    }
    return { backgroundImage: `url(${JSON.stringify(url.toString())})` };
  } catch {
    return undefined;
  }
}

function Price({ product }: { product: Product }) {
  const price = product.currentPrice;
  if (!price) {
    return <span className="product-price-missing">Prijs niet beschikbaar</span>;
  }

  const pricePerKilogram =
    product.weightGrams && product.weightGrams > 0
      ? (price.price * 1000) / product.weightGrams
      : null;

  return (
    <div className="product-price-block">
      <div className="product-price-line">
        <strong>{euroFormatter.format(price.price)}</strong>
        {price.isOffer && price.oldPrice && price.oldPrice > price.price ? (
          <s>{euroFormatter.format(price.oldPrice)}</s>
        ) : null}
      </div>
      {pricePerKilogram ? (
        <span>{euroFormatter.format(pricePerKilogram)} / kg</span>
      ) : null}
      {price.isOffer && price.offerText ? (
        <span className="offer-label">{price.offerText}</span>
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

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      try {
        const result = await createCatalogRepository().getPreview(
          10,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          setState({ status: "loaded", result });
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          setState({ status: "error", message: userMessage(error) });
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

  if (state.result.products.length === 0) {
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

  return (
    <section className="catalog-preview" aria-labelledby="catalog-heading">
      <div className="section-heading">
        <h2 id="catalog-heading">Uit de actuele catalogus</h2>
        <span>Maximaal 10 producten</span>
      </div>
      {state.result.priceStatus === "unavailable" ? (
        <p className="catalog-notice" role="status">
          Producten zijn geladen; prijsinformatie is tijdelijk niet beschikbaar.
        </p>
      ) : null}
      <div className="product-grid">
        {state.result.products.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </section>
  );
}
