"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/Icon";
import { DishImage } from "@/components/ui/DishImage";
import { NewWeekControl } from "@/components/week-preparation/NewWeekControl";
import { useBudget } from "@/features/budget/BudgetProvider";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { formatCents } from "@/services/budget/budget-engine";
import { calculateDishCostSummary, calculateWeekBudgetSummary } from "@/services/week-preparation/week-generation";
import { mealMixProfileForRecipe } from "@/services/week-preparation/meal-mix-profiles";
import { recipeImageFor } from "@/services/week-preparation/recipe-images";
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
    <span className="home-c-budget-icon">{icon === "week" ? <Cart basket /> : <Icon name="menu" size={27} />}</span>
    <div className="home-c-budget-row-content">
      <div className="home-c-budget-label"><span>{label}</span><span><strong>{amount}</strong> / {limit === null ? "niet ingesteld" : formatCents(limit)}</span></div>
      <div className="home-c-progress" role="progressbar" aria-label={`${label}: gepland budget`} aria-valuemin={0} aria-valuemax={100}
        aria-valuenow={planned !== null && limit !== null && limit > 0 ? percentage : undefined}
        aria-valuetext={`${amount}; budget ${limit === null ? "niet ingesteld" : formatCents(limit)}${over ? "; boven budget" : ""}`}>
        <span style={{ width: `${percentage}%` }} />
      </div>
      {over ? <small className="home-c-budget-warning">{formatCents(planned! - limit!)} boven {icon === "meals" ? "maaltijdbudget" : "weekbudget"}</small> : null}
    </div>
  </div>;
}
export function HomeDashboard() {
  const router = useRouter();
  const budget = useBudget();
  const shoppingList = useActiveShoppingList();
  const week = useWeekPreparation();
  const preparation = week.preparation;
  const loading = week.status === "loading" || shoppingList.status === "loading" || budget.status === "loading";
  const weekBudget = preparation && shoppingList.list ? calculateWeekBudgetSummary(preparation, shoppingList.list) : null;
  const budgetCents = budget.settings.budgetCents;
  const plannedCents = weekBudget?.knownTotalCents ?? budget.result.knownSubtotalCents;
  const pricesComplete = weekBudget?.isComplete ?? budget.result.isComplete;
  const remainingCents = budgetCents !== null && pricesComplete ? Math.max(0, budgetCents - plannedCents) : null;
  const overBudgetCents = budgetCents === null ? 0 : Math.max(0, plannedCents - budgetCents);
  const generatedDays = preparation?.days.filter(day => day.recipe || day.freeChoice) ?? [];
  // Existing week state has no calendar dates. Show the first actual dish in menu order.
  const nextDay = generatedDays.find(day => day.recipe && !day.freeChoice);
  const title = nextDay?.recipe ? mealMixProfileForRecipe(nextDay.recipe.sourceKey)?.dishName ?? nextDay.recipe.name : null;
  const cost = nextDay && preparation ? calculateDishCostSummary(nextDay.dayIndex, preparation.ingredients) : null;
  const image = nextDay?.recipe && preparation ? recipeImageFor({
    recipeSourceKey: nextDay.recipe.sourceKey, recipeName: title!,
    categories: nextDay.category === "freeChoice" ? [] : [nextDay.category],
    ingredients: preparation.ingredients.filter(i => i.usedIn.some(use => use.dayIndex === nextDay.dayIndex)),
  }) : null;
  const people = nextDay?.customDish?.targetServings ?? preparation?.numberOfPeople;
  const count = shoppingList.list?.items.length ?? 0;
  const generation = preparation?.generation;
  const hasWeek = Boolean(generation);
  const ready = hasWeek && generatedDays.length > 0 && generatedDays.every(day => day.recipe && !day.freeChoice);
  return <div className="home-c" aria-busy={loading}>
    <section className="home-c-hero" aria-labelledby="home-c-title">
      <h1 id="home-c-title"><span className="home-c-hello">Hoi!</span><span>Je week</span><span>{ready ? "staat klaar." : "begint hier."}</span></h1>
      <div className="home-c-character" aria-hidden="true"><span className="home-c-speech">Samen<br />binnen<br />budget!</span>
        <Image className="home-c-mascot" src="/branding/maatje-home-c.webp" alt="" width={1280} height={1280} sizes="200px" priority />
      </div>
    </section>
    <Link className="home-c-budget" href="/budget" aria-label="Bekijk je weekbudget">
      <h2>Deze week</h2>
      <div className="home-c-remaining" data-compact={budgetCents === null || !pricesComplete || loading} data-over={overBudgetCents > 0}>
        <strong>{loading ? "Even laden…" : budgetCents === null ? "Nog geen budget" : !pricesComplete ? "Nog onbekend" : formatCents(overBudgetCents || remainingCents || 0)}</strong>
        {!loading && budgetCents !== null && pricesComplete ? <span>{overBudgetCents > 0 ? "boven budget" : "over"}</span> : null}
      </div>
      {!loading && budgetCents === null ? <p className="home-c-price-note">Stel een weekbudget in</p> : null}
      <BudgetRow label="Week" icon="week" planned={loading ? null : plannedCents} limit={budgetCents} complete={pricesComplete} />
      <BudgetRow label="Maaltijden" icon="meals" planned={loading ? null : generation?.mealPlanKnownCostCents ?? (hasWeek ? null : 0)} limit={preparation?.mealBudgetCents ?? null} complete={generation?.isMealBudgetComplete ?? !hasWeek} />
      {!loading && !pricesComplete ? <p className="home-c-price-note">Er ontbreken prijzen. Het resterende budget is nog niet bekend.</p> : null}
    </Link>
    <Link className="home-c-meal" href="/week-voorbereiden">
      <DishImage asset={image} className="home-c-meal-image" sizes="(max-width: 360px) 88px, 120px" title={title ?? "Gerecht kiezen"} />
      <span className="home-c-meal-copy"><small>{loading ? "Je week wordt geopend…" : title ? "Eerst op je menu" : "Jouw menu"}</small><strong>{title ?? "Nog geen gerechten gekozen"}</strong>
        <span>{title ? <>{people ?? "–"} {people === 1 ? "persoon" : "personen"} · {cost && cost.knownCostCents > 0 ? `${formatCents(cost.knownCostCents)}${cost.complete ? "" : " bekend"}` : "Prijs nog onbekend"}</> : "Kies wat je deze week wilt eten"}</span>
      </span><Chevron />
    </Link>
    <Link className="home-c-list" href="/lijst"><span className="home-c-cart"><Cart /></span><span className="home-c-list-copy"><strong>Pak je lijst erbij</strong><small>{loading ? "Lijst wordt geopend…" : `${count} ${count === 1 ? "product" : "producten"}`}</small></span><Chevron /></Link>
    <Link className="home-c-week" href="/week-voorbereiden"><Icon name="week" size={23} /><span>{hasWeek ? "Bekijk je week" : "Maak mijn week"}</span><Chevron /></Link>
    <details className="home-c-settings"><summary>Weekinstellingen</summary><div className="home-c-settings-content"><p>{preparation?.numberOfPeople ?? budget.settings.people ?? "–"} personen · {preparation?.numberOfDays ?? "–"} dagen · Hoogvliet</p>
      <Link href="/week-voorbereiden">Wijzig je weekinstellingen <Chevron /></Link>
      {week.status === "ready" && shoppingList.status === "ready" ? <NewWeekControl onStartNew={async () => { await week.startNewPreparation(); router.push("/week-voorbereiden"); }} /> : null}
    </div></details>
  </div>;
}
