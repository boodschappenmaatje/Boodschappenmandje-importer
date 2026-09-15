import { useEffect, useState } from "react";

import type { CatalogFilterOptions, CatalogQuery, CatalogSort } from "@/types/catalog";

export function categoryLabel(value: string): string {
  const segments = value.split("/").filter(Boolean);
  return segments.at(-1) ?? value;
}

export function CatalogFilterSheet({
  open,
  query,
  options,
  onApply,
  onClear,
  onClose,
}: {
  open: boolean;
  query: CatalogQuery;
  options: CatalogFilterOptions;
  onApply: (query: CatalogQuery) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) return null;

  return (
    <CatalogFilterPanel
      key={JSON.stringify(query)}
      query={query}
      options={options}
      onApply={onApply}
      onClear={onClear}
      onClose={onClose}
    />
  );
}

function CatalogFilterPanel({
  query,
  options,
  onApply,
  onClear,
  onClose,
}: {
  query: CatalogQuery;
  options: CatalogFilterOptions;
  onApply: (query: CatalogQuery) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(query);

  return (
    <section
      className="catalog-filter-sheet"
      role="dialog"
      aria-modal="true"
      aria-labelledby="catalog-filter-title"
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div className="catalog-filter-panel">
        <header className="catalog-filter-header">
          <div>
            <p>Verfijn je resultaten</p>
            <h2 id="catalog-filter-title">Filters en sortering</h2>
          </div>
          <button type="button" onClick={onClose}>Sluiten</button>
        </header>

        <div className="catalog-filter-fields">
          <label>
            <span>Categorie</span>
            <select
              value={draft.category ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  category: event.target.value || null,
                  brand: null,
                }))
              }
            >
              <option value="">Alle categorieën</option>
              {options.categories.map((category) => (
                <option key={category} value={category}>{categoryLabel(category)}</option>
              ))}
            </select>
          </label>

          <label>
            <span>Merk</span>
            <select
              value={draft.brand ?? ""}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  brand: event.target.value || null,
                }))
              }
            >
              <option value="">Alle merken</option>
              {options.brands.map((brand) => <option key={brand} value={brand}>{brand}</option>)}
            </select>
          </label>

          <label>
            <span>Sorteren</span>
            <select
              value={draft.sort}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  sort: event.target.value as CatalogSort,
                }))
              }
            >
              <option value="relevance">Relevantie</option>
              <option value="price-asc">Prijs laag → hoog</option>
              <option value="price-desc">Prijs hoog → laag</option>
              <option value="name-asc">Naam A → Z</option>
            </select>
          </label>

          <label>
            <span>Maximumprijs</span>
            <div className="catalog-price-input">
              <span aria-hidden="true">€</span>
              <input
                type="number"
                min="0.01"
                max="9999"
                step="0.01"
                inputMode="decimal"
                placeholder="Geen maximum"
                value={draft.maxPrice ?? ""}
                onChange={(event) => {
                  const value = Number(event.target.value);
                  setDraft((current) => ({
                    ...current,
                    maxPrice:
                      event.target.value && Number.isFinite(value) && value > 0
                        ? value
                        : null,
                  }));
                }}
              />
            </div>
          </label>

          <label className="catalog-checkbox-row">
            <input
              type="checkbox"
              checked={draft.offersOnly}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  offersOnly: event.target.checked,
                }))
              }
            />
            <span>Alleen geldige aanbiedingen</span>
          </label>
        </div>

        <div className="catalog-filter-actions">
          <button className="catalog-clear-button" type="button" onClick={onClear}>
            Wis filters
          </button>
          <button
            className="catalog-apply-button"
            type="button"
            onClick={() => onApply(draft)}
          >
            Toon resultaten
          </button>
        </div>
      </div>
    </section>
  );
}
