import { ProductThumbnail } from "@/components/ui/ProductThumbnail";

import Link from "next/link";

import { Icon } from "@/components/Icon";
import {
  priceUpdatedLabel,
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
  onIncrease,
  onDecrease,
  detailHref,
  independentQuantity = false,
}: {
  product: Product;
  listQuantity: number;
  isAdding: boolean;
  listReady: boolean;
  onAdd: () => void;
  onIncrease?: () => void;
  onDecrease?: () => void;
  detailHref?: string;
  independentQuantity?: boolean;
}) {
  const description = [product.brand, product.packageText].filter(Boolean).join(" · ");

  return (
    <article className={independentQuantity && listQuantity > 0 ? "product-card ux-product-row has-quantity" : "product-card ux-product-row"}>
      <Link
        className="product-detail-link"
        href={detailHref ?? `/producten/${encodeURIComponent(product.id)}`}
        aria-label={`Bekijk ${product.name}`}
      >
        <ProductThumbnail className="product-image" imageUrl={product.imageUrl} name={product.name} />
        <div className="product-details">
          <h2>{product.name}</h2>
          {description ? <p className="product-description">{description}</p> : null}
          <CatalogPriceBlock product={product} />
        </div>
      </Link>
      <div className="product-add-row">
        {listQuantity > 0 && independentQuantity && onIncrease && onDecrease ? (
          <div className="catalog-quantity" aria-label={`${product.name}, aantal ${listQuantity}`}>
            <button type="button" disabled={!listReady || isAdding || listQuantity <= 1} aria-label={`Minder ${product.name}`} onClick={onDecrease}>−</button>
            <span aria-live="polite">{listQuantity}</span>
            <button type="button" disabled={!listReady || isAdding} aria-label={`Meer ${product.name}`} onClick={onIncrease}>+</button>
          </div>
        ) : (
          <button
            className="product-add-button"
            type="button"
            disabled={!listReady || isAdding}
            aria-label={`${listQuantity > 0 ? "Voeg nog een" : "Voeg"} ${product.name} toe aan boodschappenlijst`}
            onClick={onAdd}
          >
            <Icon name="plus" size={18} />
            <span className="visually-hidden">{isAdding ? "Toevoegen…" : "Toevoegen"}</span>
          </button>
        )}
        {listQuantity > 0 && !independentQuantity ? <span className="product-list-quantity">Op je lijst · {listQuantity}</span> : null}
      </div>
    </article>
  );
}
