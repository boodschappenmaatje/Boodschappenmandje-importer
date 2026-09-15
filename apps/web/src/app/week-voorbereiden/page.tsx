import type { Metadata } from "next";

import { PageIntro } from "@/components/PageIntro";
import { WeekPreparationView } from "@/components/week-preparation/WeekPreparationView";

export const metadata: Metadata = { title: "Week voorbereiden" };

export default function PrepareWeekPage() {
  return (
    <>
      <PageIntro eyebrow="Deze week" title="Bereid je boodschappenweek voor">
        Verdeel je dagen op basis van je huishouden, budget en bestaande boodschappenlijst.
      </PageIntro>
      <WeekPreparationView />
    </>
  );
}
