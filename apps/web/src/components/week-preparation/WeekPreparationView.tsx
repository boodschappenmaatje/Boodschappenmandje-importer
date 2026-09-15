"use client";

import { useState, type FormEvent } from "react";

import { NewWeekControl } from "@/components/week-preparation/NewWeekControl";
import { useBudget } from "@/features/budget/BudgetProvider";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import {
  centsToDutchInput,
  formatCents,
  parseDutchEuroInput,
} from "@/services/budget/budget-engine";
import {
  budgetOutcomeLabel,
  missingPriceLabel,
} from "@/services/budget/budget-presentation";
import {
  MEAL_CATEGORY_LABELS,
  canPrepareWeek,
  distributionProgress,
} from "@/services/week-preparation/week-preparation";
import { MEAL_CATEGORIES, type MealCategory } from "@/types/week-preparation";

const PEOPLE_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const DAY_OPTIONS = Array.from({ length: 7 }, (_, index) => index + 1);
const DAY_LABELS = [
  "Maandag",
  "Dinsdag",
  "Woensdag",
  "Donderdag",
  "Vrijdag",
  "Zaterdag",
  "Zondag",
] as const;

function listCountLabel(count: number): string {
  return `${count} ${count === 1 ? "product" : "producten"}`;
}

export function WeekPreparationView() {
  const budget = useBudget();
  const shoppingList = useActiveShoppingList();
  const week = useWeekPreparation();
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  if (week.status === "loading" || budget.status === "loading") {
    return (
      <p className="week-preparation-loading" role="status">
        Je weekvoorbereiding wordt geopend…
      </p>
    );
  }

  if (week.status === "error") {
    return (
      <section className="dashboard-card week-storage-error" role="alert">
        <h2>Weekvoorbereiding niet beschikbaar</h2>
        <p>{week.persistenceWarning}</p>
        <p>Je bestaande boodschappenlijst en budget zijn niet gewijzigd.</p>
      </section>
    );
  }

  const itemCount = shoppingList.list?.items.length ?? 0;

  if (!week.preparation) {
    return (
      <section className="dashboard-card week-start-card" aria-labelledby="week-start-title">
        <div>
          <p className="card-eyebrow">Nieuwe voorbereiding</p>
          <h2 id="week-start-title">Bereid je boodschappenweek voor</h2>
        </div>
        <p>
          Je begint met je huishouden, dagen en verdeling. Je huidige lijst met{" "}
          {listCountLabel(itemCount)} blijft volledig staan.
        </p>
        <button className="primary-action" type="button" onClick={week.startPreparation}>
          Start weekvoorbereiding
        </button>
      </section>
    );
  }

  const preparation = week.preparation;
  const progress = distributionProgress(
    preparation.categoryDistribution,
    preparation.numberOfDays,
  );
  const displayedBudget =
    budgetDraft ??
    (budget.settings.budgetCents === null
      ? ""
      : centsToDutchInput(budget.settings.budgetCents));
  const ready = canPrepareWeek(preparation);

  function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseDutchEuroInput(displayedBudget);
    if (cents === null) {
      setBudgetError("Vul een geldig bedrag in, bijvoorbeeld 100 of 75,50.");
      return;
    }
    week.setBudgetCents(cents);
    setBudgetDraft(centsToDutchInput(cents));
    setBudgetError(null);
  }

  const progressMessage =
    preparation.numberOfDays === null
      ? "Kies eerst het aantal dagen"
      : progress.state === "under"
        ? `Nog ${progress.difference} ${progress.difference === 1 ? "dag" : "dagen"} verdelen`
        : progress.state === "over"
          ? `${Math.abs(progress.difference)} ${Math.abs(progress.difference) === 1 ? "dag" : "dagen"} te veel gekozen`
          : "Alle dagen zijn verdeeld";

  return (
    <div className="week-preparation-flow">
      {week.persistenceWarning ? (
        <p className="catalog-notice" role="status">
          {week.persistenceWarning}
        </p>
      ) : null}

      {preparation.status === "readyForGeneration" ? (
        <section className="dashboard-card prepared-week-overview" aria-labelledby="prepared-week-title">
          <div className="dashboard-card-heading">
            <div>
              <p className="card-eyebrow">Deze week</p>
              <h2 id="prepared-week-title">Je week is voorbereid</h2>
            </div>
            <span className="card-status">Klaar</span>
          </div>
          <p className="prepared-week-lead">
            De volgende stap vult de dagen met passende gerechten en producten.
          </p>
          <p className="week-facts">
            {preparation.numberOfPeople} personen · {preparation.numberOfDays} dagen ·{" "}
            {budget.settings.budgetCents === null
              ? "geen budget"
              : `${formatCents(budget.settings.budgetCents)} budget`}
          </p>
          <ol className="prepared-days">
            {preparation.days.map((day) => (
              <li key={day.dayIndex}>
                <label htmlFor={`prepared-day-${day.dayIndex}`}>
                  <span>{DAY_LABELS[day.dayIndex]}</span>
                  <select
                    id={`prepared-day-${day.dayIndex}`}
                    value={day.category}
                    onChange={(event) =>
                      week.changeDayCategory(
                        day.dayIndex,
                        event.target.value as MealCategory,
                      )
                    }
                  >
                    {MEAL_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {MEAL_CATEGORY_LABELS[category]}
                      </option>
                    ))}
                  </select>
                </label>
              </li>
            ))}
          </ol>
          <div className="week-next-step">
            <strong>Klaar voor gerechten</strong>
            <span>
              Je bestaande lijst blijft staan; later worden alleen ontbrekende producten toegevoegd.
            </span>
          </div>
        </section>
      ) : null}

      <section className="dashboard-card current-list-context" aria-labelledby="current-list-title">
        <div className="dashboard-card-heading">
          <div>
            <p className="card-eyebrow">Blijft behouden</p>
            <h2 id="current-list-title">Je huidige boodschappenlijst</h2>
          </div>
          <strong>{listCountLabel(itemCount)}</strong>
        </div>
        <div className="current-list-amount">
          <span>Bekend totaal</span>
          <strong>{formatCents(budget.result.knownSubtotalCents)}</strong>
        </div>
        {budget.result.unpricedItemCount > 0 ? (
          <p className="week-budget-warning" role="status">
            {missingPriceLabel(budget.result.unpricedItemCount)}. Beschikbare budgetruimte is daarom nog niet definitief.
          </p>
        ) : budget.result.budgetCents === null ? (
          <p className="week-budget-note">Stel een budget in om je beschikbare ruimte te zien.</p>
        ) : (
          <p className="week-budget-space">
            Nog beschikbaar voor je week: <strong>{budgetOutcomeLabel(budget.result)}</strong>
          </p>
        )}
      </section>

      <section className="dashboard-card week-basics" aria-labelledby="week-basics-title">
        <div>
          <p className="card-eyebrow">Stap 1</p>
          <h2 id="week-basics-title">Huishouden en budget</h2>
        </div>
        <div className="week-basic-fields">
          <label>
            <span>Personen</span>
            <select
              value={budget.settings.people ?? ""}
              onChange={(event) =>
                week.setNumberOfPeople(
                  event.target.value ? Number(event.target.value) : null,
                )
              }
            >
              <option value="">Kies</option>
              {PEOPLE_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Dagen</span>
            <select
              value={budget.settings.days ?? ""}
              onChange={(event) =>
                week.setNumberOfDays(
                  event.target.value ? Number(event.target.value) : null,
                )
              }
            >
              <option value="">Kies</option>
              {DAY_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <form className="week-budget-form" onSubmit={saveBudget}>
          <label htmlFor="week-preparation-budget">Weekbudget in euro&apos;s</label>
          <div className="budget-input-row">
            <span aria-hidden="true">€</span>
            <input
              id="week-preparation-budget"
              inputMode="decimal"
              autoComplete="off"
              placeholder="100,00"
              value={displayedBudget}
              onChange={(event) => {
                setBudgetDraft(event.target.value);
                setBudgetError(null);
              }}
              aria-invalid={budgetError ? "true" : "false"}
              aria-describedby={budgetError ? "week-budget-error" : undefined}
            />
            <button type="submit">Bewaren</button>
          </div>
          {budgetError ? (
            <p id="week-budget-error" className="budget-input-error" role="alert">
              {budgetError}
            </p>
          ) : (
            <p className="budget-input-help">Dit is hetzelfde budget als op Budget.</p>
          )}
        </form>
      </section>

      <section className="dashboard-card week-preferences" aria-labelledby="week-preferences-title">
        <div>
          <p className="card-eyebrow">Voorkeuren</p>
          <h2 id="week-preferences-title">Wat is belangrijk?</h2>
        </div>
        <div className="preference-list">
          <label>
            <input
              type="checkbox"
              checked={preparation.preferences.noVegetarian}
              onChange={(event) => week.setPreference("noVegetarian", event.target.checked)}
            />
            <span><strong>Geen vegetarische gerechten</strong><small>Vegetarisch wordt niet automatisch voorgesteld; bewust kiezen blijft mogelijk.</small></span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={preparation.preferences.quickImportant}
              onChange={(event) => week.setPreference("quickImportant", event.target.checked)}
            />
            <span><strong>Eenvoudig en snel belangrijk</strong></span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={preparation.preferences.healthyImportant}
              onChange={(event) => week.setPreference("healthyImportant", event.target.checked)}
            />
            <span><strong>Gezond belangrijk</strong></span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={preparation.preferences.budgetImportant}
              onChange={(event) => week.setPreference("budgetImportant", event.target.checked)}
            />
            <span><strong>Budget belangrijk</strong></span>
          </label>
        </div>
      </section>

      <section className="dashboard-card week-distribution" aria-labelledby="week-distribution-title">
        <div className="dashboard-card-heading">
          <div>
            <p className="card-eyebrow">Stap 2</p>
            <h2 id="week-distribution-title">Verdeel je week</h2>
          </div>
          <strong aria-label={`${progress.assignedDays} van ${progress.targetDays} dagen verdeeld`}>
            {progress.assignedDays} / {progress.targetDays}
          </strong>
        </div>
        <div className="category-steppers">
          {MEAL_CATEGORIES.map((category) => {
            const count = preparation.categoryDistribution[category];
            return (
              <div className="category-stepper" key={category}>
                <span>{MEAL_CATEGORY_LABELS[category]}</span>
                <div role="group" aria-label={`${MEAL_CATEGORY_LABELS[category]} dagen`}>
                  <button
                    type="button"
                    aria-label={`${MEAL_CATEGORY_LABELS[category]} verlagen`}
                    disabled={count === 0}
                    onClick={() => week.adjustCategory(category, -1)}
                  >−</button>
                  <output aria-live="polite">{count}</output>
                  <button
                    type="button"
                    aria-label={`${MEAL_CATEGORY_LABELS[category]} verhogen`}
                    disabled={count === 7}
                    onClick={() => week.adjustCategory(category, 1)}
                  >+</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="distribution-progress" data-state={progress.state} role="status">
          <progress
            aria-label="Voortgang verdeling van je week"
            max={preparation.numberOfDays ?? 1}
            value={Math.min(
              progress.assignedDays,
              preparation.numberOfDays ?? 0,
            )}
          />
          <strong>{progressMessage}</strong>
        </div>
        <button
          className="primary-action"
          type="button"
          disabled={!ready}
          onClick={week.confirmPreparation}
        >
          Week voorbereiden
        </button>
        {!ready && progress.state === "exact" ? (
          <p className="week-required-note" role="status">
            Kies personen, dagen en een budget om verder te gaan.
          </p>
        ) : null}
      </section>

      <NewWeekControl
        onStartNew={() => {
          week.startNewPreparation();
          setBudgetDraft(null);
        }}
      />
    </div>
  );
}
