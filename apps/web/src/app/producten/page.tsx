import type { Metadata } from "next";

import { PageIntro } from "@/components/PageIntro";
import { ProductCatalogPreview } from "@/components/ProductCatalogPreview";

export const metadata: Metadata = { title: "Producten" };

export default function ProductsPage() {
  return (
    <>
      <PageIntro eyebrow="Catalogus" title="Producten">
        Een veilige, read-only selectie uit de bestaande productcatalogus.
      </PageIntro>
      <ProductCatalogPreview />
    </>
  );
}
