import { Suspense } from "react";

import { CatalogSearchView } from "@/components/catalog/CatalogSearchView";

function CatalogLoadingFallback() {
  return (
    <section className="catalog-state" aria-live="polite" aria-busy="true">
      <span className="catalog-spinner" aria-hidden="true" />
      <div>
        <h2>Producten laden</h2>
        <p>De Hoogvliet-catalogus wordt veilig opgehaald.</p>
      </div>
    </section>
  );
}

export function ProductCatalogPreview() {
  return (
    <Suspense fallback={<CatalogLoadingFallback />}>
      <CatalogSearchView />
    </Suspense>
  );
}
