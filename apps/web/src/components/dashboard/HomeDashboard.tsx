"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { HomeWeekSlider } from "./HomeWeekSlider";
import { SupermarketSelector } from "@/components/supermarket/SupermarketSelector";
import { NewWeekControl } from "@/components/week-preparation/NewWeekControl";
import { useBudget } from "@/features/budget/BudgetProvider";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { formatCents } from "@/services/budget/budget-engine";
import { calculateWeekBudgetSummary } from "@/services/week-preparation/week-generation";
import "./home-option-c.css";

function Chevron() {
  return <svg width="20" height="24" viewBox="0 0 20 24" fill="none" aria-hidden="true"><path d="m7 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
function Cart({ basket = false }: { basket?: boolean }) {
  return <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{basket ? <path d="m3 9 2 11h14l2-11ZM8 9l3-6M16 9l-3-6M9 12v5M15 12v5" /> : <><path d="M2 3h3l3 12h11l3-9H6M8 18h11" /><circle cx="9" cy="21" r="1" fill="currentColor" /><circle cx="18" cy="21" r="1" fill="currentColor" /></>}</svg>;
}
function BudgetRow({ label, planned, limit, complete, icon }: {
  label: string; planned: number | null; limit: number | null; complete: boolean; icon: "week" | "meals";
}) {
  const over = planned !== null && limit !== null && planned > limit;
  const percentage = planned !== null && limit !== null && limit > 0 ? Math.min(100, Math.max(0, planned / limit * 100)) : 0;
  const amount = planned === null ? "Nog onbekend" : `${formatCents(planned)}${complete ? "" : " bekend"}`;
  return <div className="home-c-budget-row" data-over={over}>
    <span className="home-c-budget-icon"><Icon name={icon === "week" ? "budget" : "menu"} size={27} /></span>
    <div className="home-c-budget-row-content">
      <div className="home-c-budget-label"><span>{icon === "week" ? "Weekbudget" : "Maaltijdbudget"}</span><strong>{amount}</strong><span className="home-c-limit">van {limit === null ? "niet ingesteld" : formatCents(limit)}</span></div>
      <div className="home-c-meter"><div className="home-c-progress" role="progressbar" aria-label={`${label}: gepland budget`} aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={planned !== null && limit !== null && limit > 0 ? percentage : undefined}
        aria-valuetext={`${amount}; budget ${limit === null ? "niet ingesteld" : formatCents(limit)}${over ? "; boven budget" : ""}`}>
        <span style={{ width: `${percentage}%` }} />
      </div>{planned !== null && limit !== null && limit > 0 ? <span className="home-c-percentage" aria-hidden="true">{Math.round(percentage)}%</span> : null}</div>
      {over ? <small className="home-c-budget-warning">{formatCents(planned! - limit!)} boven {icon === "meals" ? "maaltijdbudget" : "weekbudget"}</small> : null}
    </div>
  </div>;
}
export function HomeDashboard() {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState("");
  const budget = useBudget();
  const shoppingList = useActiveShoppingList();
  const week = useWeekPreparation();
  const preparation = week.preparation;
  const loading = week.status === "loading" || shoppingList.status === "loading" || budget.status === "loading";
  const weekBudget = preparation && shoppingList.list ? calculateWeekBudgetSummary(preparation, shoppingList.list) : null;
  const budgetCents = budget.settings.budgetCents;
  const plannedCents = weekBudget?.knownTotalCents ?? budget.result.knownSubtotalCents;
  const unavailable = week.status === "error" || shoppingList.status === "error";
  const pricesComplete = !unavailable && (weekBudget?.isComplete ?? budget.result.isComplete);
  const remainingCents = budgetCents !== null && pricesComplete ? Math.max(0, budgetCents - plannedCents) : null;
  const overBudgetCents = budgetCents === null ? 0 : Math.max(0, plannedCents - budgetCents);
  const count = shoppingList.list?.items.length ?? 0;
  const generation = preparation?.generation;
  const hasWeek = Boolean(generation);
  const mealCount = preparation?.days.filter(day => day.recipe && !day.freeChoice).length ?? 0;
  return <div className="home-c" aria-busy={loading}>
    <section className="home-c-hero" aria-labelledby="home-c-title">
      <h1 id="home-c-title"><span className="home-c-hello">Slim kopen.</span><span className="home-c-hello">Lekker eten.</span></h1>
      <div className="home-c-character" aria-hidden="true">
        <Image className="home-c-mascot" src="/branding/maatje-home-c.webp" alt="" width={1280} height={1280} sizes="200px" priority />
      </div>
    </section>
    <div className="home-discovery-entry">
      <div className="home-discovery-store"><SupermarketSelector /></div>
      <form className="home-discovery-search" onSubmit={(event) => {
        event.preventDefault();
        const term = searchTerm.trim();
        router.push(term ? `/ontdek?q=${encodeURIComponent(term)}` : "/ontdek");
      }}>
        <label className="visually-hidden" htmlFor="home-discovery-query">Zoek producten, merken of recepten</label>
        <Icon name="search" size={22} />
        <input id="home-discovery-query" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Zoek producten, merken of recepten..." />
        <button type="submit" aria-label="Zoek producten">Zoek</button>
      </form>
      <Link className="home-discovery-link" href="/ontdek"><span><strong>Ontdek &amp; bespaar</strong><small>Bekijk producten, aanbiedingen en categorieën</small></span><Chevron /></Link>
    </div>
    {unavailable ? <p role="alert">Je gegevens konden niet worden geopend. Probeer opnieuw via Menu of Lijst.</p> : null}
    <Link className="home-c-budget" href="/budget" aria-label="Bekijk je weekbudget">
      <span className="home-c-budget-chevron"><Chevron /></span>
      {!loading && budgetCents === null ? <p className="home-c-price-note">Stel een weekbudget in</p> : null}
      <BudgetRow label="Week" icon="week" planned={loading || unavailable ? null : plannedCents} limit={budgetCents} complete={pricesComplete} />
      <BudgetRow label="Maaltijden" icon="meals" planned={loading || unavailable ? null : generation?.mealPlanKnownCostCents ?? (hasWeek ? null : 0)} limit={preparation?.mealBudgetCents ?? null} complete={generation?.isMealBudgetComplete ?? !hasWeek} />
      {!loading && !pricesComplete ? <p className="home-c-price-note">Er ontbreken prijzen. Het resterende budget is nog niet bekend.</p> : null}
    </Link>
    <HomeWeekSlider preparation={preparation} loading={loading} />
    <Link className="home-c-list" href="/lijst"><span className="home-c-cart"><Cart /></span><span className="home-c-list-copy"><strong>Naar je boodschappenlijst</strong></span><Chevron /></Link>
    <section className="home-c-facts" aria-label="Je week in het kort">
      <Link className="home-c-fact" href="/lijst" aria-label={loading || unavailable ? "Boodschappenlijst openen" : `${count} ${count === 1 ? "product" : "producten"} op je lijst`}><span className="home-c-fact-icon"><Cart /></span><span><strong>{loading || unavailable ? "–" : count}</strong><small>{count === 1 ? "product" : "producten"} op je lijst</small></span><Chevron /></Link>
      <Link className="home-c-fact" href="/week-voorbereiden"><span className="home-c-fact-icon"><Icon name="menu" size={24} /></span><span><strong>{loading || unavailable ? "–" : mealCount}</strong><small>{mealCount === 1 ? "maaltijd" : "maaltijden"} gepland</small></span><Chevron /></Link>
      <Link className="home-c-fact" href="/budget"><span className="home-c-fact-icon"><Icon name="budget" size={25} /></span><span className="home-c-remaining" data-compact={budgetCents === null || !pricesComplete || loading} data-over={overBudgetCents > 0}>
        <strong>{loading ? "Laden…" : budgetCents === null ? "Nog geen budget" : !pricesComplete ? "Nog onbekend" : formatCents(overBudgetCents || remainingCents || 0)}</strong>
        <small>{budgetCents === null ? "Stel je budget in" : !pricesComplete ? "Weekruimte" : <><span>{overBudgetCents > 0 ? "boven budget" : "over"}</span> deze week</>}</small>
      </span><Chevron /></Link>
    </section>
    <Link className="home-c-week" href="/week-voorbereiden" aria-label={hasWeek ? "Bekijk je week" : "Maak mijn week"}><span className="home-c-fact-icon"><Icon name="week" size={29} /></span><span><strong>{mealCount > 0 ? "Goed bezig!" : "Je week begint hier"}</strong><small>{loading ? "Je week wordt geopend…" : mealCount > 0 ? `Je hebt ${mealCount} ${mealCount === 1 ? "maaltijd" : "maaltijden"} gepland` : "Maak mijn week"}</small><span className="home-c-sr-only">{hasWeek ? "Bekijk je week" : "Maak mijn week"}</span></span><Chevron /></Link>
    <details className="home-c-settings"><summary>Weekinstellingen</summary><div className="home-c-settings-content"><p>{preparation?.numberOfPeople ?? budget.settings.people ?? "–"} personen · {preparation?.numberOfDays ?? "–"} dagen · Hoogvliet</p>
      <Link href="/week-voorbereiden">Wijzig je weekinstellingen <Chevron /></Link>
      {week.status === "ready" && shoppingList.status === "ready" ? <NewWeekControl onStartNew={async () => { await week.startNewPreparation(); router.push("/week-voorbereiden"); }} /> : null}
    </div></details>
  </div>;
}
