"use client";
import Link from "next/link";
import { useState } from "react";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { freeChoiceProgress } from "@/services/week-preparation/week-preparation";
import { FreeChoiceControl } from "./FreeChoiceControl";
import { CustomDishEditor } from "./CustomDishEditor";
import { CompactRecipeDetail } from "./CompactRecipeDetail";
import { MealRouteNavigation } from "./MealRouteNavigation";

export function FreeChoiceWeekView({ initialDay = null }: { initialDay?: number | null }) {
  const week = useWeekPreparation();
  const [selectedDay, setSelectedDay] = useState<number | null>(initialDay);
  const [library, setLibrary] = useState(false);
  const preparation = week.preparation;
  if (!preparation) return <><MealRouteNavigation current="free" /><p>Bereid eerst je week voor om vrije keuzes in te vullen.</p><Link href="/week-voorbereiden">Week voorbereiden</Link></>;
  const progress = freeChoiceProgress(preparation);
  const day = preparation.status !== "draft" ? preparation.days.find(item => item.dayIndex === selectedDay && item.category === "freeChoice") : null;
  if (library) return <CustomDishEditor dayIndex={-1} initialView="library" onClose={() => setLibrary(false)} />;
  return <div className="free-choice-week">
    <MealRouteNavigation current="free" />
    <header><h2>Vrije keuzes deze week</h2><p role="status">{progress.chosen} van {progress.total} gekozen</p>
      {progress.total > 0 ? <progress aria-label="Gekozen vrije maaltijden" value={Math.min(progress.chosen, progress.total)} max={progress.total} /> : null}</header>
    {progress.needsRetention || preparation.status === "draft" ? <p>Bevestig eerst je aangepaste weekverdeling. Je gekozen maaltijden blijven bewaard. <Link href="/week-voorbereiden">Weekinstellingen</Link></p> : <>
      {progress.remaining === 0 ? <p>Alle vrije-keuzeplekken zijn gevuld. Je kunt een vrije keuze vervangen of je recepten bekijken en beheren.</p> : null}
      <label>Vrije-keuzeplek<select value={day?.dayIndex ?? ""} disabled={week.customizationBusy} onChange={event => setSelectedDay(event.target.value === "" ? null : Number(event.target.value))}>
        <option value="">{progress.remaining ? "Kies een plek" : "Vervang een vrije keuze"}</option>
        {preparation.days.filter(item => item.category === "freeChoice").map(item => <option key={item.dayIndex} value={item.dayIndex}>Dag {item.dayIndex + 1} · {item.recipe?.name ?? "Nog vrij"}</option>)}
      </select></label>
      {day ? <section key={day.dayIndex}>
        {day.recipe ? <details className="compact-selected-recipe"><summary>Huidige keuze: {day.recipe.name}</summary><CompactRecipeDetail preparation={preparation} dayIndex={day.dayIndex} /></details> : null}
        <FreeChoiceControl dayIndex={day.dayIndex} />
      </section> : null}
    </>}
    {!day ? <button type="button" onClick={() => setLibrary(true)}>Mijn recepten</button> : null}
  </div>;
}
