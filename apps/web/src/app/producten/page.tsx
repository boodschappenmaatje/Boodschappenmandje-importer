import type { Metadata } from "next";

import { PageIntro } from "@/components/PageIntro";
import { ProductCatalogPreview } from "@/components/ProductCatalogPreview";

export const metadata: Metadata = { title: "Producten" };

export default function ProductsPage() {
  return (
    <>
      <PageIntro eyebrow="Catalogus" title="Producten">
        Zoek, vergelijk en voeg echte Hoogvliet-producten toe aan je lijst.
      </PageIntro>
      <ProductCatalogPreview />
    </>
  );
}
