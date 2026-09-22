"use client";

import Link from "next/link";

import { Icon } from "@/components/Icon";
import { useBudget } from "@/features/budget/BudgetProvider";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { formatCents } from "@/services/budget/budget-engine";
import {
  calculateDishCostSummary,
  calculateWeekBudgetSummary,
} from "@/services/week-preparation/week-generation";
import { BudgetProgress } from "@/components/ui/BudgetProgress";
import { BudgetStatusCard } from "@/components/ui/BudgetStatusCard";
import { MaatjeTipCard } from "@/components/ui/MaatjeTipCard";
import { MealDayCard } from "@/components/ui/MealDayCard";


const DAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"] as const;

export function HomeDashboard() {
  const budget = useBudget();
  const shoppingList = useActiveShoppingList();
  const week = useWeekPreparation();
  const preparation = week.preparation;
  const weekBudget =
    preparation && shoppingList.list
      ? calculateWeekBudgetSummary(preparation, shoppingList.list)
      : null;
  const budgetCents = budget.settings.budgetCents;
  const plannedCents = weekBudget?.knownTotalCents ?? budget.result.knownSubtotalCents;
  const pricesComplete = weekBudget?.isComplete ?? budget.result.isComplete;
  const remainingCents =
    budgetCents !== null && pricesComplete
      ? Math.max(0, budgetCents - plannedCents)
      : null;
  const overBudgetCents =
    budgetCents === null ? 0 : Math.max(0, plannedCents - budgetCents);
  const generatedDays = preparation?.days.filter((day) => day.recipe || day.freeChoice) ?? [];

  return (
    <div className="home-dashboard ux-home">
      <header className="ux-greeting"><h1>Hallo, fijn dat je er bent</h1><p>Rustig overzicht voor jouw boodschappenweek.</p></header>
      <section className="week-hero-card" aria-labelledby="home-week-title">
        <div className="week-hero-heading">
          <div>
            <Icon name="week" size={24} />
            <h2 id="home-week-title">Jouw week</h2>
          </div>
          <Link href="/week-voorbereiden">Wijzig</Link>
        </div>

        <div className="week-hero-facts" aria-label="Weekinstellingen">
          <span><Icon name="users" size={20} />{budget.settings.people ?? "–"} personen</span>
          <span><Icon name="week" size={20} />{generatedDays.filter((day) => !day.freeChoice).length} maaltijden</span>
          <span><Icon name="store" size={20} />Hoogvliet</span>
        </div>

        <Link className="home-budget-link" href="/budget" aria-label="Bekijk je weekbudget">
          <span className="home-budget-link-heading">
            <span><Icon name="budget" size={19} />Bekijk weekbudget</span>
            <Icon name="arrow" size={18} />
          </span>
          <div className="ux-budget-hero" data-tone={overBudgetCents > 0 ? "danger" : "success"}>
            <strong>{budgetCents === null ? "Nog geen budget" : !pricesComplete ? "Nog onbekend" : formatCents(overBudgetCents || remainingCents || 0)}</strong>
            <span>{overBudgetCents > 0 ? "boven budget" : "over voor deze week"}</span>
            <small>{formatCents(plannedCents)}{!pricesComplete ? " bekend" : " gepland"}{budgetCents !== null ? ` van ${formatCents(budgetCents)}` : ""}</small>
          </div>
          <BudgetProgress
            budgetCents={budgetCents}
            plannedCents={plannedCents}
            complete={pricesComplete}
            showLabel={false}
          />
          <p className="week-budget-helper">
            Inclusief ruimte voor brood, drinken, fruit en andere weekboodschappen.
          </p>
        </Link>
        <BudgetStatusCard
          budgetCents={budgetCents}
          plannedCents={plannedCents}
          complete={pricesComplete}
        />
      </section>

      <div className="ux-home-actions">
        <Link className="home-primary-action" href="/lijst"><Icon name="list" size={24} /><span><strong>Verder met mijn lijst</strong><small>{shoppingList.list?.items.length ?? 0} {(shoppingList.list?.items.length ?? 0) === 1 ? "product" : "producten"}</small></span><Icon name="arrow" size={20} /></Link>
        <Link className="ux-secondary-action" href="/week-voorbereiden"><Icon name="week" size={22} />Maak mijn week</Link>
      </div>

      <section className="home-week-section" aria-labelledby="this-week-title">
        <div className="home-section-heading">
          <h2 id="this-week-title">Deze week</h2>
          <Link href="/week-voorbereiden">Bekijk week <span aria-hidden="true">›</span></Link>
        </div>

        {week.status === "loading" ? (
          <p className="home-week-loading">Je week wordt geopend…</p>
        ) : generatedDays.length === 0 ? (
          <Link className="empty-week-strip" href="/week-voorbereiden">
            <Icon name="prepare" size={25} />
            <span><strong>Nog geen gerechten gekozen</strong>Bereid je week voor om hier je menu te zien.</span>
            <Icon name="arrow" size={18} />
          </Link>
        ) : (
          <div className="meal-day-scroller">
            {generatedDays.map((day, index) => {
              const cost = calculateDishCostSummary(day.dayIndex, preparation!.ingredients);
              const dayIngredients = preparation!.ingredients
                .filter((ingredient) =>
                  ingredient.usedIn.some((use) => use.dayIndex === day.dayIndex),
                )
                .map((ingredient) => ({
                  sourceKey: ingredient.sourceKey,
                  name: ingredient.name,
                  optional: ingredient.optional,
                }));
              return (
                <MealDayCard
                  key={day.dayIndex}
                  day={DAY_LABELS[day.dayIndex] ?? `Dag ${day.dayIndex + 1}`}
                  title={day.freeChoice ? "Vrije keuze" : day.recipe?.name ?? "Gerecht kiezen"}
                  knownCostCents={day.freeChoice || cost.knownCostCents === 0 ? null : cost.knownCostCents}
                  complete={cost.complete}
                  recipeSourceKey={day.recipe?.sourceKey ?? null}
                  category={day.category}
                  ingredients={dayIngredients}
                  active={index === 0}
                />
              );
            })}
          </div>
        )}
      </section>

      <MaatjeTipCard>
        {preparation?.preferences.budgetImportant
          ? "Je hebt gekozen voor ‘Budget belangrijk’. We kiezen daarom vooral lekkere én voordelige gerechten."
          : "Bereid je week vooraf en houd tijdens het boodschappen doen rustig zicht op je budget."}
      </MaatjeTipCard>
    </div>
  );
}
