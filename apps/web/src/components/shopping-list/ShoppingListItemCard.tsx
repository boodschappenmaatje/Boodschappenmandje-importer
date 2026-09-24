
import type { ReactNode } from "react";
import { ProductThumbnail } from "@/components/ui/ProductThumbnail";


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

export function ShoppingListItemCard({ item, onToggleChecked, onOpenDetails, originSummary, quantityControls, children }: {
  item: ShoppingListItem;
  onToggleChecked: () => void;
  onOpenDetails: () => void;
  originSummary: ReactNode;
  quantityControls: ReactNode;
  children?: ReactNode;
}) {
  const price = item.price && Number.isFinite(item.price.amount) && item.price.amount > 0 ? item.price : null;
  return <li className="shopping-item-card compact-shopping-row" data-checked={Boolean(item.checked)}>
    <label className="ux-check-item"><input type="checkbox" checked={Boolean(item.checked)} onChange={onToggleChecked} aria-label={`Afvinken ${item.name}`} /><span className="visually-hidden">{item.name}</span></label>
    <button type="button" className="shopping-product-open" aria-label={`Productdetails ${item.name}`} aria-haspopup="dialog" onClick={onOpenDetails}>
      <ProductThumbnail className="shopping-item-image" imageUrl={item.imageUrl} name={item.name} />
      <span className="shopping-item-copy">
        <span className="shopping-item-name">{item.name}</span>
        <span className="shopping-item-meta">{item.packageText ? <span>{item.packageText} · </span> : null}<strong>{price ? euroFormatter.format(price.amount) : "Prijs onbekend"}</strong>{price?.isOffer ? <span className="compact-offer-label">Actie</span> : null}</span>
      </span>
      <span className="shopping-detail-chevron" aria-hidden="true">›</span>
    </button>
    <div className="shopping-row-bottom">{originSummary}{quantityControls}</div>
    {children}
  </li>;
}
