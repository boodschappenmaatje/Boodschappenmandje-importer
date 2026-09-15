import type { Metadata } from "next";

import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "Lijst" };

export default function ListPage() {
  return (
    <>
      <PageIntro eyebrow="Hoofdonderdeel" title="Mijn boodschappen">
        Deze route is voorbereid voor de migratie van de actieve slimme lijst.
      </PageIntro>
      <section className="placeholder-card">
        <h2>Nog niet gemigreerd</h2>
        <p>Er worden in PWA 2 bewust nog geen lijstgegevens gelezen of geschreven.</p>
      </section>
    </>
  );
}
