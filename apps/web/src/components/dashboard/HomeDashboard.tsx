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
import { QuickActionCard } from "@/components/ui/QuickActionCard";

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
    <div className="home-dashboard">
      <section className="week-hero-card" aria-labelledby="home-week-title">
        <div className="week-hero-heading">
          <div>
            <Icon name="week" size={24} />
            <h1 id="home-week-title">Jouw week</h1>
          </div>
          <Link href="/week-voorbereiden">Wijzig</Link>
        </div>

        <div className="week-hero-facts" aria-label="Weekinstellingen">
          <span><Icon name="users" size={20} />{budget.settings.people ?? "–"} personen</span>
          <span><Icon name="week" size={20} />{budget.settings.days ?? "–"} dagen</span>
          <span><Icon name="store" size={20} />Hoogvliet</span>
        </div>

        <Link className="home-budget-link" href="/budget" aria-label="Bekijk je weekbudget">
          <div className="week-budget-metrics">
            <div>
              <span>Weekbudget</span>
              <strong>{budgetCents === null ? "Niet ingesteld" : formatCents(budgetCents)}</strong>
            </div>
            <div>
              <span>Gepland</span>
              <strong>{formatCents(plannedCents)}{!pricesComplete ? " bekend" : ""}</strong>
            </div>
            <div data-tone={overBudgetCents > 0 ? "danger" : "success"}>
              <span>{overBudgetCents > 0 ? "Boven" : "Over"}</span>
              <strong>
                {budgetCents === null
                  ? "–"
                  : !pricesComplete
                    ? "Nog onbekend"
                    : formatCents(overBudgetCents || remainingCents || 0)}
              </strong>
            </div>
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
              const dayIngredients = preparation!.ingredients.filter((ingredient) =>
                ingredient.usedIn.some((use) => use.dayIndex === day.dayIndex),
              );
              // A product photo is not automatically a truthful photo of the dish. Only
              // branded meal-mix artwork is suitable here; generic dishes keep the fallback.
              const image =
                dayIngredients.find((item) => item.kind === "mealMix" && item.product?.imageUrl)
                  ?.product?.imageUrl ?? null;
              return (
                <MealDayCard
                  key={day.dayIndex}
                  day={DAY_LABELS[day.dayIndex] ?? `Dag ${day.dayIndex + 1}`}
                  title={day.freeChoice ? "Vrije keuze" : day.recipe?.name ?? "Gerecht kiezen"}
                  knownCostCents={day.freeChoice || cost.knownCostCents === 0 ? null : cost.knownCostCents}
                  complete={cost.complete}
                  imageUrl={image}
                  active={index === 0}
                />
              );
            })}
          </div>
        )}
      </section>

      <Link className="home-primary-action" href="/week-voorbereiden">
        <Icon name="prepare" size={25} />
        <strong>{generatedDays.length ? "Menu aanpassen" : "Menu maken"}</strong>
        <Icon name="arrow" size={21} />
      </Link>

      <div className="home-quick-actions" aria-label="Snelkoppelingen">
        <QuickActionCard
          href="/lijst"
          icon="list"
          label="Boodschappenlijst"
          detail={shoppingList.list ? `${shoppingList.list.items.length} ${shoppingList.list.items.length === 1 ? "product" : "producten"}` : undefined}
        />
        <QuickActionCard href="/meer" icon="history" label="Geschiedenis" />
      </div>

      <MaatjeTipCard>
        {preparation?.preferences.budgetImportant
          ? "Je hebt gekozen voor ‘Budget belangrijk’. We kiezen daarom vooral lekkere én voordelige gerechten."
          : "Bereid je week vooraf en houd tijdens het boodschappen doen rustig zicht op je budget."}
      </MaatjeTipCard>
    </div>
  );
}
