import Link from "next/link";
import type { CSSProperties } from "react";

import { Icon } from "@/components/Icon";
import {
  priceUpdatedLabel,
  safeProductImageUrl,
} from "@/services/catalog/catalog-presentation";
import {
  getPricePerKilogram,
  resolveCurrentPrice,
} from "@/services/catalog/price";
import type { Product } from "@/types/catalog";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export function catalogProductImageStyle(
  imageUrl: string | null,
): CSSProperties | undefined {
  const safeUrl = safeProductImageUrl(imageUrl);
  return safeUrl ? { backgroundImage: `url(${JSON.stringify(safeUrl)})` } : undefined;
}

export function CatalogPriceBlock({
  product,
  detail = false,
}: {
  product: Product;
  detail?: boolean;
}) {
  const price = resolveCurrentPrice(product.currentPrice);
  if (!price) {
    return <span className="product-price-missing">Prijs tijdelijk niet beschikbaar</span>;
  }

  const pricePerKilogram = getPricePerKilogram(product, price);
  const updatedLabel = priceUpdatedLabel(price);

  return (
    <div className={detail ? "product-price-block product-price-detail" : "product-price-block"}>
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
      {detail && updatedLabel ? (
        <span className="product-price-updated" data-freshness={price.freshness}>
          {updatedLabel}
        </span>
      ) : null}
    </div>
  );
}

export function CatalogProductCard({
  product,
  listQuantity,
  isAdding,
  listReady,
  onAdd,
}: {
  product: Product;
  listQuantity: number;
  isAdding: boolean;
  listReady: boolean;
  onAdd: () => void;
}) {
  const imageStyle = catalogProductImageStyle(product.imageUrl);
  const description = [product.brand, product.packageText].filter(Boolean).join(" · ");

  return (
    <article className="product-card ux-product-row">
      <Link
        className="product-detail-link"
        href={`/producten/${encodeURIComponent(product.id)}`}
        aria-label={`Bekijk ${product.name}`}
      >
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
          <h2>{product.name}</h2>
          {description ? <p className="product-description">{description}</p> : null}
          <CatalogPriceBlock product={product} />
        </div>
      </Link>
      <div className="product-add-row">
        <button
          className="product-add-button"
          type="button"
          disabled={!listReady || isAdding}
          aria-label={`Voeg ${product.name} toe aan boodschappenlijst`}
          onClick={onAdd}
        >
          <Icon name="plus" size={18} />
          <span className="visually-hidden">{isAdding ? "Toevoegen…" : "Toevoegen"}</span>
        </button>
        {listQuantity > 0 ? (
          <span className="product-list-quantity">Op je lijst · {listQuantity}</span>
        ) : null}
      </div>
    </article>
  );
}
