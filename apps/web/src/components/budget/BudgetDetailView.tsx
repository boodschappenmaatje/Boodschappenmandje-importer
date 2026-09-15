"use client";

import Link from "next/link";
import { useState, type CSSProperties, type FormEvent } from "react";

import { Icon } from "@/components/Icon";
import { MaatjeMascot } from "@/components/MaatjeMascot";
import { BudgetProgress } from "@/components/ui/BudgetProgress";
import { useBudget } from "@/features/budget/BudgetProvider";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import {
  centsToDutchInput,
  formatCents,
  parseDutchEuroInput,
} from "@/services/budget/budget-engine";
import { calculateWeekBudgetSummary } from "@/services/week-preparation/week-generation";

function range(length: number): number[] {
  return Array.from({ length }, (_, index) => index + 1);
}

export function BudgetDetailView() {
  const {
    status,
    settings,
    result,
    persistenceWarning,
    setBudgetCents,
    resetBudget,
    setPeople,
    setDays,
  } = useBudget();
  const shoppingList = useActiveShoppingList();
  const week = useWeekPreparation();
  const [draft, setDraft] = useState<{ sourceCents: number | null; value: string } | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const input =
    draft?.sourceCents === settings.budgetCents
      ? draft.value
      : settings.budgetCents === null
        ? ""
        : centsToDutchInput(settings.budgetCents);

  function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseDutchEuroInput(input);
    if (cents === null) {
      setInputError("Vul een geldig bedrag in, bijvoorbeeld 100 of 75,50.");
      return;
    }
    setBudgetCents(cents);
    setDraft({ sourceCents: cents, value: centsToDutchInput(cents) });
    setInputError(null);
  }

  if (status === "loading") {
    return <p className="budget-loading">Je budget wordt geopend…</p>;
  }

  const weekBudget =
    week.preparation && shoppingList.list
      ? calculateWeekBudgetSummary(week.preparation, shoppingList.list)
      : null;
  const budgetCents = settings.budgetCents;
  const plannedCents = weekBudget?.knownTotalCents ?? result.knownSubtotalCents;
  const existingCents = weekBudget?.existingListKnownSubtotalCents ?? result.knownSubtotalCents;
  const mealCents = weekBudget?.newKnownCostCents ?? 0;
  const complete = weekBudget?.isComplete ?? result.isComplete;
  const remainingCents =
    budgetCents !== null && complete ? Math.max(0, budgetCents - plannedCents) : 0;
  const overBudgetCents =
    budgetCents === null ? 0 : Math.max(0, plannedCents - budgetCents);
  const missingCount =
    (weekBudget?.existingListUnpricedCount ?? result.unpricedItemCount) +
    (weekBudget?.newUnpricedRequirementCount ?? 0);
  const chartTotal = Math.max(budgetCents ?? 0, plannedCents, 1);
  const mealEnd = (mealCents / chartTotal) * 360;
  const listEnd = ((mealCents + existingCents) / chartTotal) * 360;
  const freeEnd = ((mealCents + existingCents + remainingCents) / chartTotal) * 360;
  const chartStyle = {
    "--meal-end": `${Math.min(360, mealEnd)}deg`,
    "--list-end": `${Math.min(360, listEnd)}deg`,
    "--free-end": `${Math.min(360, freeEnd)}deg`,
  } as CSSProperties;
  const budgetImportant = week.preparation?.preferences.budgetImportant ?? false;
  const noVegetarian = week.preparation?.preferences.noVegetarian ?? false;

  return (
    <div className="budget-screen">
      <header className="screen-navigation-header">
        <Link href="/" aria-label="Terug naar Home"><Icon name="back" size={25} />Terug</Link>
        <h1>Weekbudget</h1>
        <span aria-hidden="true" />
      </header>

      {persistenceWarning ? <p className="catalog-notice" role="status">{persistenceWarning}</p> : null}

      <section className="budget-visual-card" aria-labelledby="budget-breakdown-title">
        <h2 id="budget-breakdown-title" className="visually-hidden">Dynamische budgetverdeling</h2>
        <div className="budget-chart-layout">
          <div className="budget-donut" style={chartStyle}>
            <div>
              <strong>{formatCents(plannedCents)}</strong>
              <span>gepland</span>
            </div>
          </div>
          <dl className="budget-legend">
            <div><dt><i data-color="meal" />Avondmaaltijden</dt><dd>{formatCents(mealCents)}</dd></div>
            <div><dt><i data-color="list" />Boodschappenlijst</dt><dd>{formatCents(existingCents)}</dd></div>
            {budgetCents !== null && complete ? (
              <div><dt><i data-color="free" />Nog vrij</dt><dd>{formatCents(remainingCents)}</dd></div>
            ) : null}
            {missingCount > 0 ? (
              <div><dt><i data-color="unknown" />Nog niet geprijsd</dt><dd>{missingCount}</dd></div>
            ) : null}
          </dl>
        </div>

        <div className="budget-detail-totals">
          <div><span>Totaal weekbudget</span><strong>{budgetCents === null ? "–" : formatCents(budgetCents)}</strong></div>
          <div><span>Gepland</span><strong>{formatCents(plannedCents)}</strong></div>
          <div data-tone={overBudgetCents > 0 ? "danger" : "success"}>
            <span>{overBudgetCents > 0 ? "Boven budget" : "Nog over"}</span>
            <strong>{budgetCents === null || !complete ? "–" : formatCents(overBudgetCents || remainingCents)}</strong>
          </div>
        </div>

        <BudgetProgress budgetCents={budgetCents} plannedCents={plannedCents} complete={complete} />

        <p className="budget-flex-note">
          <Icon name="info" size={20} />
          <span>We houden automatisch rekening met een realistische verdeling van je budget, zodat je genoeg overhoudt voor de hele week.</span>
        </p>
      </section>

      <section className="preferences-card" aria-labelledby="preferences-title">
        <div className="preferences-heading">
          <h2 id="preferences-title">Voorkeuren</h2>
          <Link href="/week-voorbereiden">Wijzig</Link>
        </div>
        <div className="preference-row">
          <Icon name="budget" size={23} />
          <div><strong>Budget belangrijk</strong><span>{budgetImportant ? "We kiezen vooral voordelige gerechten en producten." : "Uitgeschakeld"}</span></div>
        </div>
        <div className="preference-row">
          <Icon name="prepare" size={23} />
          <div><strong>Geen vegetarische gerechten</strong><span>{noVegetarian ? "Ingeschakeld" : "Uitgeschakeld"}</span></div>
        </div>
        <div className="preference-row"><Icon name="users" size={23} /><div><strong>{settings.people ?? "–"} personen</strong></div></div>
        <div className="preference-row"><Icon name="week" size={23} /><div><strong>{settings.days ?? "–"} dagen</strong></div></div>
        <div className="preference-row"><Icon name="store" size={23} /><div><strong>Hoogvliet</strong><span>Actuele prijzen waar mogelijk</span></div></div>
      </section>

      <section className="maatje-feedback-card" data-tone={overBudgetCents > 0 ? "danger" : "success"}>
        <MaatjeMascot size="medium" />
        <div>
          <strong>{overBudgetCents > 0 ? "Even bijsturen" : complete ? "Goed bezig!" : "Bijna compleet"}</strong>
          <p>
            {overBudgetCents > 0
              ? `Je zit ${formatCents(overBudgetCents)} boven je budget.`
              : complete
                ? "Je houdt mooi zicht op je budget en de ruimte voor extra’s."
                : "Nog niet alle prijzen zijn bekend; het bekende bedrag staat alvast klaar."}
          </p>
        </div>
      </section>

      <details className="budget-edit-panel">
        <summary>Budget en weekinstellingen wijzigen</summary>
        <div className="budget-edit-content">
          <form onSubmit={saveBudget}>
            <label htmlFor="week-budget">Weekbudget in euro&apos;s</label>
            <div className="budget-input-row">
              <span aria-hidden="true">€</span>
              <input
                id="week-budget"
                name="week-budget"
                inputMode="decimal"
                autoComplete="off"
                placeholder="100,00"
                value={input}
                onChange={(event) => {
                  setDraft({ sourceCents: settings.budgetCents, value: event.target.value });
                  setInputError(null);
                }}
                aria-invalid={inputError ? "true" : "false"}
                aria-describedby={inputError ? "budget-input-error" : undefined}
              />
              <button type="submit">Bewaren</button>
            </div>
            {inputError ? <p id="budget-input-error" className="budget-input-error" role="alert">{inputError}</p> : null}
          </form>

          <div className="household-fields">
            <label><span>Personen</span><select value={settings.people ?? ""} onChange={(event) => setPeople(event.target.value ? Number(event.target.value) : null)}><option value="">Niet ingesteld</option>{range(12).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
            <label><span>Dagen</span><select value={settings.days ?? ""} onChange={(event) => setDays(event.target.value ? Number(event.target.value) : null)}><option value="">Niet ingesteld</option>{range(7).map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>

          {settings.budgetCents === null ? null : confirmReset ? (
            <div className="budget-reset-confirm" role="group" aria-label="Budget verwijderen bevestigen">
              <p>Alleen het budget verwijderen? Je boodschappenlijst blijft staan.</p>
              <button type="button" onClick={() => { resetBudget(); setDraft(null); setConfirmReset(false); }}>Ja, verwijder budget</button>
              <button type="button" onClick={() => setConfirmReset(false)}>Annuleren</button>
            </div>
          ) : (
            <button className="budget-reset-button" type="button" onClick={() => setConfirmReset(true)}>Budget verwijderen</button>
          )}
        </div>
      </details>
    </div>
  );
}
