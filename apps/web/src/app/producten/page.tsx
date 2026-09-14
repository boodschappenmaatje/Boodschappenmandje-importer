import type { Metadata } from "next";

import { PageIntro } from "@/components/PageIntro";
import { ProductCatalogPreview } from "@/components/ProductCatalogPreview";

export const metadata: Metadata = { title: "Producten" };

export default function ProductsPage() {
  return (
    <>
      <PageIntro eyebrow="Catalogus" title="Producten">
        Bekijk echte Hoogvliet-producten en de laatst opgehaalde prijsinformatie.
      </PageIntro>
      <ProductCatalogPreview />
    </>
  );
}
