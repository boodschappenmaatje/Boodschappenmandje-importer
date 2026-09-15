import type { Metadata } from "next";

import { CatalogStatusView } from "@/components/catalog/CatalogStatusView";
import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "Catalogusstatus" };

export default function CatalogStatusPage() {
  return (
    <>
      <PageIntro eyebrow="Meer" title="Catalogusstatus">
        Bekijk hoe de Hoogvliet-catalogus automatisch groeit en actueel blijft.
      </PageIntro>
      <CatalogStatusView />
    </>
  );
}
