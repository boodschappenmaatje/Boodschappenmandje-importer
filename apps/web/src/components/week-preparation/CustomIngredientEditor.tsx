"use client";

import { useEffect, useState } from "react";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { ProductThumbnail } from "@/components/ui/ProductThumbnail";
import { euroAmountToCents, formatCents } from "@/services/budget/budget-engine";
import { resolveCurrentPrice } from "@/services/catalog/price";
import { productPackageCapacity } from "@/services/week-preparation/product-matching";
import { customIngredientQuantity } from "@/services/week-preparation/custom-dish";
import type { CustomDish, CustomDishIngredient, WeekIngredientUnit } from "@/types/week-preparation";
import type { Product } from "@/types/catalog";

export function customProductPrice(product: Product): number | null {
  const price = product.currentPrice?.productId === product.id ? resolveCurrentPrice(product.currentPrice) : null;
  const cents = price ? euroAmountToCents(price.amount) : null;
  return product.isAvailable !== false && product.supermarket === "Hoogvliet" && product.sku.trim() && price?.freshness === "fresh" ? (cents !== null && cents > 0 ? cents : null) : null;
}

export function CustomIngredientEditor({ row, dish, refresh, onChange, onRemove }: {
  row: CustomDishIngredient; dish: CustomDish; refresh: number;
  onChange: (row: CustomDishIngredient) => void; onRemove: () => void;
}) {
  const { matchCustomIngredient, searchCatalogProducts } = useWeekPreparation();
  const [loaded, setLoaded] = useState<{ id: string; product: Product | null; refresh: number } | null>(null);
  const [search, setSearch] = useState(!row.productId);
  const [query, setQuery] = useState(row.productId ? "" : row.name);
  const [results, setResults] = useState<{ query: string; products: Product[] } | null>(null);
  const [message, setMessage] = useState("");
  const product = loaded?.id === row.productId && loaded?.refresh === refresh ? loaded.product : null;
  const loading = !!row.productId && (loaded?.id !== row.productId || loaded?.refresh !== refresh);
  useEffect(() => {
    if (!row.productId) return;
    let active = true;
    void matchCustomIngredient(row.name, row.unit, row.productId).then(found => {
      if (active) setLoaded({ id: row.productId!, product: found, refresh });
    }).catch(() => {
      if (active) { setLoaded({ id: row.productId!, product: null, refresh }); setMessage("Product ophalen lukt nu niet. Controleer je verbinding en probeer opnieuw."); }
    });
    return () => { active = false; };
  }, [row.productId, row.name, row.unit, refresh, matchCustomIngredient]);
  useEffect(() => {
    if (!search || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchCatalogProducts(query.trim(), controller.signal).then(products => {
        if (!controller.signal.aborted) { setResults({ query, products }); setMessage(products.length ? "" : "Geen producten gevonden. Probeer een andere zoekterm."); }
      }).catch(() => { if (!controller.signal.aborted) setMessage("Zoeken lukt nu niet. Probeer opnieuw."); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, search, searchCatalogProducts]);

  const available = product && product.isAvailable !== false && product.supermarket === "Hoogvliet" && !!product.sku.trim();
  const price = product ? customProductPrice(product) : null;
  const catalogCapacity = product ? productPackageCapacity(product, row.unit) : null;
  const capacity = catalogCapacity ?? row.packageCapacityOverride ?? null;
  const quantity = customIngredientQuantity(row, dish);
  const packages = capacity && quantity > 0 ? Math.max(1, Math.ceil(quantity / capacity)) : null;
  const products = results?.query === query ? results.products : [];
  function selectProduct(next: Product) {
    const unit = row.productId ? row.unit : (["g", "ml", "piece", "loaf"] as const).find(unit => productPackageCapacity(next, unit) !== null) ?? row.unit;
    onChange({ ...row, name: next.name.slice(0, 100), productId: next.id, unit, packageCapacityOverride: undefined });
    setLoaded({ id: next.id, product: next, refresh }); setSearch(false); setMessage("");
  }
  return <fieldset className="custom-ingredient-editor">
    <legend className="visually-hidden">{row.productId ? row.name : "Nieuw ingrediënt"}</legend>
    {row.productId ? <>
      <div className="custom-ingredient-main"><div className="custom-selected-product"><ProductThumbnail className="manual-product-image" imageUrl={product?.imageUrl ?? null} name={row.name} />
        <div><strong>{product?.name ?? row.name}</strong><p>{product?.packageText ?? "Verpakking onbekend"}{price !== null ? ` · ${formatCents(price)}` : ""}</p></div>
      </div>
      {packages !== null && price !== null && available ? <strong className="custom-ingredient-cost">{formatCents(packages * price)}</strong> : null}</div>
      {loading ? <p role="status">Actueel product ophalen…</p> : !available ? <p role="alert">Dit product is niet beschikbaar. Kies opnieuw een product.</p> : price === null ? <p role="alert">Voor dit ingrediënt ontbreekt een actuele geldige prijs. Kies een ander product of probeer later opnieuw.</p> : null}
      <div className="custom-ingredient-amount">
        <label><span className="visually-hidden">Benodigde hoeveelheid</span><input type="number" inputMode="decimal" min="0.001" max="100000" step="any" value={quantity || ""} onChange={event => onChange({ ...row, quantity: Number(event.target.value) * dish.servings / (dish.targetServings ?? dish.servings) })} /></label>
        <label><span className="visually-hidden">Eenheid</span><select value={row.unit} onChange={event => onChange({ ...row, unit: event.target.value as WeekIngredientUnit, packageCapacityOverride: undefined })}>
          {[["g", "gram"], ["kg", "kilo"], ["ml", "milliliter"], ["l", "liter"], ["piece", "stuks"], ["loaf", "broden"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select></label>
      </div>
      {available && catalogCapacity === null ? <label>Inhoud per verpakking ({row.unit === "piece" ? "stuks" : row.unit})
        <input type="number" inputMode="decimal" min="0.001" max="100000" step="any" value={row.packageCapacityOverride ?? ""} onChange={event => onChange({ ...row, packageCapacityOverride: Number(event.target.value) > 0 ? Number(event.target.value) : undefined })} />
        <span>We kunnen dit niet veilig omrekenen. Lees de inhoud op de verpakking of kies een andere eenheid/product.</span>
      </label> : null}
      {packages !== null && price !== null && available ? <p className="custom-package-summary">{packages} {packages === 1 ? "verpakking" : "verpakkingen"}{row.packageCapacityOverride && catalogCapacity === null ? " · inhoud zelf ingevuld" : ""}</p> : null}

    </> : null}
    {search ? <div>
      <label>Zoek product<input type="search" value={query} placeholder="Bijvoorbeeld spaghetti" onChange={event => {
        setQuery(event.target.value); setMessage("");
        if (!row.productId) onChange({ ...row, name: event.target.value.slice(0, 100) });
      }} /></label>
      {query.trim().length >= 2 && results?.query !== query && !message ? <p role="status">Producten zoeken…</p> : null}
      <ul className="custom-product-options">{products.map(option => {
        const cents = customProductPrice(option);
        const usable = option.isAvailable !== false && option.supermarket === "Hoogvliet" && !!option.sku.trim();
        return <li key={option.id}><button type="button" disabled={!usable || cents === null} onClick={() => selectProduct(option)}>
          <ProductThumbnail className="manual-product-image" imageUrl={option.imageUrl} name={option.name} />
          <span><strong>{option.name}</strong><span>{option.packageText ?? "Verpakking onbekend"}</span><span>{!usable ? "Niet beschikbaar" : cents !== null ? formatCents(cents) : "Actuele prijs ontbreekt"}</span></span>
        </button></li>;
      })}</ul>
      {row.productId ? <button type="button" onClick={() => setSearch(false)}>Vervangen annuleren</button> : null}
    </div> : null}
    {message ? <p role="status">{message}</p> : null}
    <div className="custom-ingredient-actions">
      {row.productId ? <button type="button" className="text-action" onClick={() => { setSearch(!search); setQuery(row.name); setMessage(""); }} aria-label="Ingrediënt vervangen">Vervang</button> : null}
      <button type="button" className="text-action" onClick={onRemove} aria-label="Ingrediënt verwijderen">Verwijder</button>
    </div>
  </fieldset>;
}
