import type { Metadata } from "next";

import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "Producten" };

export default function ProductsPage() {
  return (
    <>
      <PageIntro eyebrow="Catalogus" title="Producten">
        Deze route wordt later gekoppeld aan de bestaande Supabase-productcatalogus.
      </PageIntro>
      <section className="placeholder-card">
        <h2>Veilige voorbereiding</h2>
        <p>De huidige Hoogvliet-importer blijft de server-side datastroom verzorgen.</p>
      </section>
    </>
  );
}
