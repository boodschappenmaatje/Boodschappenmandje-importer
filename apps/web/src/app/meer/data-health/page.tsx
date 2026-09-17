import type { Metadata } from "next";

import { PageIntro } from "@/components/PageIntro";
import { DataHealthView } from "@/components/week-preparation/DataHealthView";

export const metadata: Metadata = { title: "Data Health" };

export default function DataHealthPage() {
  return (
    <>
      <PageIntro eyebrow="Interne controle" title="Data Health">
        Controleer welke recepten vandaag volledig uitvoerbaar zijn met de actuele catalogus.
      </PageIntro>
      <DataHealthView />
    </>
  );
}
