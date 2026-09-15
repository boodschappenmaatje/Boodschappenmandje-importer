import type { Metadata } from "next";

import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <>
      <PageIntro eyebrow="Geen verbinding" title="Je bent offline">
        De app-shell blijft beschikbaar. Volledige offline boodschappenfunctionaliteit
        en synchronisatie worden pas in een latere PWA-stap toegevoegd.
      </PageIntro>
    </>
  );
}
