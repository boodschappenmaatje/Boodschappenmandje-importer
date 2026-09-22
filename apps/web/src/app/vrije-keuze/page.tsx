import type { Metadata } from "next";
import { FreeChoiceWeekView } from "@/components/week-preparation/FreeChoiceWeekView";
export const metadata: Metadata = { title: "Vrije keuze" };
export default async function FreeChoicePage({ searchParams }: { searchParams: Promise<{ day?: string }> }) {
  const { day } = await searchParams;
  const initialDay = day !== undefined && /^\d+$/.test(day) ? Number(day) : null;
  return <FreeChoiceWeekView initialDay={initialDay} />;
}
