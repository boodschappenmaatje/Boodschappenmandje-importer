import type { Metadata } from "next";

import { EmptyState } from "@/components/EmptyState";
import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "Week voorbereiden" };

export default function PrepareWeekPage() {
  return (
    <>
      <PageIntro eyebrow="Deze week" title="Bereid je boodschappenweek voor">
        Bepaal straks wat je nodig hebt; recepten en budget blijven daarbij ondersteunend.
      </PageIntro>
      <section className="dashboard-card route-empty-card">
        <EmptyState icon="prepare" title="Klaar voor de volgende stap">
          De slimme weekvoorbereiding wordt hier aangesloten. Er is nog niets aangemaakt of gewijzigd.
        </EmptyState>
      </section>
    </>
  );
}
