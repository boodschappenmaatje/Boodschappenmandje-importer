import type { Metadata } from "next";

import { PageIntro } from "@/components/PageIntro";
import { WeekPreparationView } from "@/components/week-preparation/WeekPreparationView";

export const metadata: Metadata = { title: "Week voorbereiden" };

export default async function PrepareWeekPage({ searchParams }: { searchParams: Promise<{ day?: string | string[] }> }) {
  const { day } = await searchParams;
  const initialDay = typeof day === "string" && /^[0-6]$/.test(day) ? Number(day) : null;
  return (
    <>
      <PageIntro eyebrow="Deze week" title="Bereid je boodschappenweek voor">
        Verdeel je dagen op basis van je huishouden, budget en bestaande boodschappenlijst.
      </PageIntro>
      <WeekPreparationView key={initialDay ?? "overview"} initialDay={initialDay} />
    </>
  );
}
