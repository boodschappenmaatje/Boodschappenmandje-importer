"use client";
import Link from "next/link";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { ProductThumbnail } from "@/components/ui/ProductThumbnail";
import { formatCents } from "@/services/budget/budget-engine";
import type { ShoppingListItem } from "@/types/shopping-list";

export function ShoppingListDetails({ item, onClose, children }: { item: ShoppingListItem; onClose: () => void; children: ReactNode }) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus();
    return () => { document.body.style.overflow = overflow; if (previous?.isConnected) previous.focus(); };
  }, []);
  const price = item.price && Number.isFinite(item.price.amount) && item.price.amount > 0 ? item.price : null;
  const date = price?.updatedAt ? new Date(price.updatedAt) : null;
  return <div className="shopping-detail-backdrop" onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div ref={panel} className="shopping-detail-panel" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={event => {
      if (event.key === "Escape") { event.stopPropagation(); onClose(); }
      if (event.key === "Tab") {
        const controls = [...panel.current!.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]')];
        const first = controls[0]; const last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }}>
      <header className="shopping-detail-header"><h2 id={titleId}>Productdetails</h2><button type="button" onClick={onClose} aria-label="Sluit productdetails">Sluiten</button></header>
      <div className="shopping-detail-body">
        <div className="shopping-detail-product">
          <ProductThumbnail className="shopping-item-image" imageUrl={item.imageUrl} name={item.name} />
          <div><h3>{item.name}</h3><p>{item.packageText}</p><strong>{price ? formatCents(Math.round(price.amount * 100)) : "Prijs tijdelijk niet beschikbaar"}</strong>{price?.isOffer ? <span className="compact-offer-label">Actie</span> : null}</div>
        </div>
        <p className="shopping-detail-total"><span>{item.quantity} {item.quantity === 1 ? "verpakking" : "verpakkingen"} op je lijst</span><strong>{price ? `Totaal ${formatCents(Math.round(price.amount * 100) * item.quantity)}` : "Totaal onbekend"}</strong></p>
        {children}
        <section className="shopping-product-info" aria-label="Productinformatie"><h3>Productinformatie</h3><dl>
          {item.brand ? <><dt>Merk</dt><dd>{item.brand}</dd></> : null}
          <dt>Inhoud</dt><dd>{item.packageText || "Niet bekend"}</dd>
          <dt>Prijs per verpakking</dt><dd>{price ? formatCents(Math.round(price.amount * 100)) : "Niet beschikbaar"}</dd>
          <dt>Prijsinformatie</dt><dd>{price ? price.freshness === "stale" ? "Laatst bekende prijs" : "Actuele prijs" : "Geen betrouwbare prijs"}</dd>
          {date && Number.isFinite(date.getTime()) ? <><dt>Laatst bijgewerkt</dt><dd>{date.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}</dd></> : null}
        </dl><Link href={`/producten/${item.productId}`}>Bekijk productinformatie <span aria-hidden="true">›</span></Link></section>
      </div>
    </div>
  </div>;
}
