
import type { ReactNode } from "react";
import { ProductThumbnail } from "@/components/ui/ProductThumbnail";

import { Icon } from "@/components/Icon";
import type { ShoppingListItem } from "@/types/shopping-list";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});


function normalizedCopy(value: string): string {
  return value.trim().toLocaleLowerCase("nl-NL").replace(/\s+/g, " ");
}

export function shoppingListItemDescription(item: ShoppingListItem): string {
  const normalizedName = normalizedCopy(item.name);
  return [item.brand, item.packageText]
    .filter((value): value is string => Boolean(value?.trim()))
    .filter((value) => !normalizedName.includes(normalizedCopy(value)))
    .join(" · ");
}

export function shoppingListUsedInLabel(usedIn: string[]): string | null {
  if (usedIn.length === 0) return null;
  if (usedIn.length === 1) return `Voor: ${usedIn[0]}`;
  return `Voor ${usedIn.length} maaltijden`;
}

export function ShoppingListItemCard({
  item,
  onIncrease,
  onDecrease,
  onRemove,
  onToggleChecked,
  quantityControls,
}: {
  item: ShoppingListItem;
  onIncrease: () => void;
  onDecrease: () => void;
  onRemove: () => void;
  onToggleChecked?: () => void;
  quantityControls?: ReactNode;
}) {
  const description = shoppingListItemDescription(item);
  const usedInLabel = shoppingListUsedInLabel(item.usedIn);

  return (
    <li className="shopping-item-card ux-shopping-row" data-checked={Boolean(item.checked)}>
      <label className="ux-check-item"><input type="checkbox" checked={Boolean(item.checked)} onChange={onToggleChecked} aria-label={`Afvinken ${item.name}`} /><span className="visually-hidden">{item.name}</span></label>
      <ProductThumbnail className="shopping-item-image" imageUrl={item.imageUrl} name={item.name} />

      <div className="shopping-item-copy">
        <h2>{item.name}</h2>
        {description ? <p>{description}</p> : null}
        {item.price ? (
          <div className="shopping-item-price">
            <strong>{euroFormatter.format(item.price.amount)}</strong>
            {item.price.isOffer ? (
              <span className="compact-offer-label">Actie</span>
            ) : null}
            {item.price.freshness === "stale" ? (
              <span>Laatst bekend</span>
            ) : null}
          </div>
        ) : (
          <span className="shopping-item-price-missing">
            Prijs tijdelijk niet beschikbaar
          </span>
        )}
        {usedInLabel ? <details className="ux-item-source"><summary>Voor je maaltijden</summary><p>{usedInLabel}</p></details> : null}
      </div>

      <button
        className="shopping-remove"
        type="button"
        aria-label={`Verwijder ${item.name}`}
        onClick={onRemove}
      >
        <Icon name="trash" size={20} />
      </button>

      {quantityControls ?? <div className="quantity-control" aria-label={`Aantal ${item.name}`}>
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
      </div>}
    </li>
  );
}
