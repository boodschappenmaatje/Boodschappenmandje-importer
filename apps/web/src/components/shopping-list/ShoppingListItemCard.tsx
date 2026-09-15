import type { CSSProperties } from "react";

import { Icon } from "@/components/Icon";
import { safeProductImageUrl } from "@/services/catalog/catalog-presentation";
import type { ShoppingListItem } from "@/types/shopping-list";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function imageStyle(imageUrl: string | null): CSSProperties | undefined {
  const safeUrl = safeProductImageUrl(imageUrl);
  return safeUrl
    ? { backgroundImage: `url(${JSON.stringify(safeUrl)})` }
    : undefined;
}

export function ShoppingListItemCard({
  item,
  onIncrease,
  onDecrease,
  onRemove,
}: {
  item: ShoppingListItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
}) {
  const productImageStyle = imageStyle(item.imageUrl);
  const description = [item.brand, item.packageText].filter(Boolean).join(" · ");

  return (
    <li className="shopping-item-card">
      <div
        className="shopping-item-image"
        data-has-image={Boolean(productImageStyle)}
        style={productImageStyle}
        role="img"
        aria-label={
          productImageStyle ? `Afbeelding van ${item.name}` : "Geen productafbeelding"
        }
      >
        {!productImageStyle ? <Icon name="products" size={24} /> : null}
      </div>

      <div className="shopping-item-copy">
        <h2>{item.name}</h2>
        {description ? <p>{description}</p> : null}
        {item.price ? (
          <div className="shopping-item-price">
            <strong>{euroFormatter.format(item.price.amount)}</strong>
            {item.price.freshness === "stale" ? (
              <span>Laatst bekende prijs</span>
            ) : null}
          </div>
        ) : (
          <span className="shopping-item-price-missing">
            Prijs tijdelijk niet beschikbaar
          </span>
        )}
      </div>

      <button
        className="shopping-remove"
        type="button"
        aria-label={`Verwijder ${item.name}`}
        onClick={onRemove}
      >
        <Icon name="trash" size={20} />
      </button>

      <div className="quantity-control" aria-label={`Aantal ${item.name}`}>
        <button
          type="button"
          aria-label={`Verlaag aantal ${item.name}`}
          disabled={item.quantity === 1}
          onClick={onDecrease}
        >
          <Icon name="minus" size={18} />
        </button>
        <output aria-live="polite" aria-label={`${item.quantity} stuks`}>
          {item.quantity}
        </output>
        <button
          type="button"
          aria-label={`Verhoog aantal ${item.name}`}
          onClick={onIncrease}
        >
          <Icon name="plus" size={18} />
        </button>
      </div>
    </li>
  );
}
