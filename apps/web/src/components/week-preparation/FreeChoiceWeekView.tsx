"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { Icon } from "@/components/Icon";
import { DishImage } from "@/components/ui/DishImage";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { freeChoiceProgress } from "@/services/week-preparation/week-preparation";
import { calculateDishCostSummary } from "@/services/week-preparation/week-generation";
import { recipeImageFor } from "@/services/week-preparation/recipe-images";
import { formatCents } from "@/services/budget/budget-engine";
import type { CustomDish } from "@/types/week-preparation";
import { FreeChoiceControl, type FreeChoiceRoute } from "./FreeChoiceControl";
import { CustomDishEditor } from "./CustomDishEditor";
import { CompactRecipeDetail } from "./CompactRecipeDetail";
import { MealRouteNavigation } from "./MealRouteNavigation";

const routes = [
  { mode: "recipe", title: "Gerecht kiezen", description: "Kies een passend gerecht", icon: "menu" },
  { mode: "mix", title: "Maaltijdmix kiezen", description: "Complete mixen en boxen", icon: "bowl" },
  { mode: "custom", title: "Zelf maken", description: "Stel je eigen recept samen", icon: "chef" },
  { mode: "library", title: "Mijn recepten", description: "Jouw opgeslagen recepten", icon: "book" },
] as const;

export function FreeChoiceWeekView({ initialDay = null }: { initialDay?: number | null }) {
  const week = useWeekPreparation();
  const actionGrid = useRef<HTMLDivElement>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(initialDay);
  const [mode, setMode] = useState<FreeChoiceRoute | null>(null);
  const [choosingSlot, setChoosingSlot] = useState(false);
  const [pendingDish, setPendingDish] = useState<CustomDish | undefined>();
  const preparation = week.preparation;
  if (!preparation) return <><MealRouteNavigation current="free" /><p>Bereid eerst je week voor om vrije keuzes in te vullen.</p><Link href="/week-voorbereiden">Week voorbereiden</Link></>;
  const progress = freeChoiceProgress(preparation);
  const ready = preparation.status !== "draft" && !progress.needsRetention;
  const slots = preparation.days.filter(item => item.category === "freeChoice");
  const chosen = slots.filter(item => item.recipe);
  const day = ready ? slots.find(item => item.dayIndex === selectedDay) ?? slots.find(item => !item.recipe) : undefined;
  function close() { setMode(null); setChoosingSlot(false); setSelectedDay(null); setPendingDish(undefined); }
  function chooseRoute(next: FreeChoiceRoute) {
    if (day) setSelectedDay(day.dayIndex);
    setMode(next);
    setChoosingSlot((next === "recipe" || next === "mix") && !day);
  }
  if (mode && !choosingSlot) {
    if (mode === "custom" || mode === "library") return <CustomDishEditor key={`${day?.dayIndex ?? -1}:${mode}`} dayIndex={day?.dayIndex ?? -1}
      initialDish={pendingDish} initialView={pendingDish ? "detail" : mode === "library" ? "library" : "editor"} onClose={close}
      onChooseSlot={dish => { setPendingDish(dish); setChoosingSlot(true); }} />;
    if (day) return <FreeChoiceControl dayIndex={day.dayIndex} initialMode={mode} onClose={close} />;
  }
  return <div className="free-choice-week">
    <MealRouteNavigation current="free" />
    <header className="free-choice-progress"><div><h2>Vrije keuze deze week</h2><p role="status">{progress.chosen} van {progress.total} gekozen</p></div>
      {progress.total > 0 ? <progress aria-label="Gekozen vrije maaltijden" value={Math.min(progress.chosen, progress.total)} max={progress.total} /> : null}
      <p>Kies wat bij jullie past. Je kunt altijd later nog wijzigen.</p>
    </header>
    <div ref={actionGrid} className="free-choice-action-grid" aria-label="Wat wil je toevoegen?">
      {routes.map(route => <button type="button" key={route.mode} aria-label={route.title} disabled={week.customizationBusy || (!ready && (route.mode === "recipe" || route.mode === "mix"))} onClick={() => chooseRoute(route.mode)}>
        <span className="free-choice-action-icon" data-route={route.mode}><Icon name={route.icon} size={27} /></span>
        <strong>{route.title}</strong><span className="free-choice-action-description">{route.description}</span><Icon name="arrow" size={18} />
      </button>)}
    </div>
    {!ready ? <p>Bevestig eerst je aangepaste weekverdeling. Je gekozen maaltijden blijven bewaard. <Link href="/week-voorbereiden">Weekinstellingen</Link></p> : null}
    {ready && progress.remaining === 0 ? <p className="free-choice-full">Alle plekken zijn gevuld. Je recepten blijven beschikbaar. <button type="button" className="text-action" onClick={() => { setMode(null); setChoosingSlot(true); }}>Vervang een vrije keuze</button></p> : null}
    {choosingSlot ? <section className="free-choice-slot-picker" aria-label="Vervang een vrije keuze">
      <h3>Welke vrije keuze wil je vervangen?</h3>
      {!ready || !slots.length ? <p>Pas eerst je <Link href="/week-voorbereiden">weekinstellingen</Link> aan om een vrije-keuzeplek beschikbaar te maken.</p> : <label>Vrije-keuzeplek<select value="" disabled={week.customizationBusy} onChange={event => { if (event.target.value !== "") { setSelectedDay(Number(event.target.value)); setChoosingSlot(false); } }}>
        <option value="">Kies een plek</option>{slots.map(item => <option key={item.dayIndex} value={item.dayIndex}>Dag {item.dayIndex + 1} · {item.recipe?.name ?? "Nog vrij"}</option>)}
      </select></label>}
      <button type="button" className="text-action" onClick={close}>Annuleren</button>
    </section> : null}
    {selectedDay !== null && day && !mode ? <p className="free-choice-target">Je kiest voor dag {day.dayIndex + 1}{day.recipe ? ` · vervangt ${day.recipe.name}` : ""}. Kies hierboven een route.</p> : null}
    <section className="free-choice-selected" aria-label="Al gekozen">
      <header><h3>Al gekozen</h3><span>{progress.chosen} van {progress.total}</span></header>
      {chosen.length ? chosen.map(item => {
        const cost = calculateDishCostSummary(item.dayIndex, preparation.ingredients);
        const ingredients = preparation.ingredients.filter(row => row.usedIn.some(use => use.dayIndex === item.dayIndex));
        return <details key={item.dayIndex} className="free-choice-selected-meal">
          <summary><DishImage asset={recipeImageFor({ recipeSourceKey: item.recipe!.sourceKey, recipeName: item.recipe!.name, categories: [], ingredients })} title={item.recipe!.name} className="recipe-summary-image" sizes="48px" />
            <span><strong>{item.recipe!.name}</strong><small>Dag {item.dayIndex + 1} · {item.customDish?.targetServings ?? preparation.numberOfPeople} personen</small></span>
            <strong>{cost.complete ? formatCents(cost.knownCostCents) : "Prijs onvolledig"}</strong><span className="meal-chevron" aria-hidden="true">›</span>
          </summary>
          <CompactRecipeDetail preparation={preparation} dayIndex={item.dayIndex} />
          <button type="button" className="text-action" disabled={!ready || week.customizationBusy} onClick={() => { setSelectedDay(item.dayIndex); setChoosingSlot(false); actionGrid.current?.querySelector("button")?.focus(); }}>Deze vrije keuze vervangen</button>
        </details>;
      }) : <p>Je hebt nog geen vrije maaltijden gekozen.</p>}
    </section>
  </div>;
}
