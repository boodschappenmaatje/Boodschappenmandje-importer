"use client";

import { useState, type FormEvent } from "react";

import { useBudget } from "@/features/budget/BudgetProvider";
import {
  centsToDutchInput,
  formatCents,
  parseDutchEuroInput,
} from "@/services/budget/budget-engine";
import {
  budgetOutcomeLabel,
  missingPriceLabel,
} from "@/services/budget/budget-presentation";

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
  const [draft, setDraft] = useState<{
    sourceCents: number | null;
    value: string;
  } | null>(null);
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

  const dailyBudget =
    settings.budgetCents !== null && settings.days !== null
      ? Math.round(settings.budgetCents / settings.days)
      : null;
  const perPersonDailyBudget =
    dailyBudget !== null && settings.people !== null
      ? Math.round(dailyBudget / settings.people)
      : null;

  return (
    <div className="budget-detail">
      {persistenceWarning ? (
        <p className="catalog-notice" role="status">
          {persistenceWarning}
        </p>
      ) : null}

      <section className="dashboard-card budget-overview" aria-labelledby="budget-overview-title">
        <div className="dashboard-card-heading">
          <div>
            <p className="card-eyebrow">Actuele berekening</p>
            <h2 id="budget-overview-title">Weekbudget</h2>
          </div>
          {settings.budgetCents === null ? null : (
            <strong>{formatCents(settings.budgetCents)}</strong>
          )}
        </div>

        {settings.budgetCents === null ? (
          <p className="budget-empty-message">
            Stel je weekbudget in. Je boodschappenlijst blijft ongewijzigd.
          </p>
        ) : (
          <>
            <dl className="budget-facts">
              <div>
                <dt>Bekend lijsttotaal</dt>
                <dd>{formatCents(result.knownSubtotalCents)}</dd>
              </div>
              <div>
                <dt>Status</dt>
                <dd>{budgetOutcomeLabel(result)}</dd>
              </div>
              <div>
                <dt>Geprijsde producten</dt>
                <dd>{result.pricedItemCount}</dd>
              </div>
              <div>
                <dt>Producten zonder prijs</dt>
                <dd>{result.unpricedItemCount}</dd>
              </div>
            </dl>
            <progress
              aria-label="Deel van het weekbudget bekend besteed"
              max={100}
              value={Math.min(100, result.percentageUsed ?? 0)}
            />
            <p className="budget-percentage">
              {result.percentageUsed}% van het budget is bekend besteed.
            </p>
            {result.unpricedItemCount > 0 ? (
              <p className="budget-incomplete" role="status">
                {missingPriceLabel(result.unpricedItemCount)}. Een resterend
                eindbedrag is daarom nog niet betrouwbaar.
              </p>
            ) : null}
          </>
        )}
      </section>

      <section className="dashboard-card budget-settings-card" aria-labelledby="budget-settings-title">
        <h2 id="budget-settings-title">Budget instellen</h2>
        <form onSubmit={saveBudget}>
          <label htmlFor="week-budget">Bedrag in euro&apos;s</label>
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
                setDraft({
                  sourceCents: settings.budgetCents,
                  value: event.target.value,
                });
                setInputError(null);
              }}
              aria-invalid={inputError ? "true" : "false"}
              aria-describedby={inputError ? "budget-input-error" : undefined}
            />
            <button type="submit">Bewaren</button>
          </div>
          {inputError ? (
            <p id="budget-input-error" className="budget-input-error" role="alert">
              {inputError}
            </p>
          ) : (
            <p className="budget-input-help">Gebruik bijvoorbeeld 100 of 75,50.</p>
          )}
        </form>

        {settings.budgetCents === null ? null : confirmReset ? (
          <div className="budget-reset-confirm" role="group" aria-label="Budget verwijderen bevestigen">
            <p>Alleen het budget verwijderen? Je boodschappenlijst blijft staan.</p>
            <button
              type="button"
              onClick={() => {
                resetBudget();
                setDraft(null);
                setConfirmReset(false);
              }}
            >
              Ja, verwijder budget
            </button>
            <button type="button" onClick={() => setConfirmReset(false)}>
              Annuleren
            </button>
          </div>
        ) : (
          <button
            className="budget-reset-button"
            type="button"
            onClick={() => setConfirmReset(true)}
          >
            Budget verwijderen
          </button>
        )}
      </section>

      <section className="dashboard-card household-settings" aria-labelledby="household-settings-title">
        <div>
          <p className="card-eyebrow">Voor PWA 10</p>
          <h2 id="household-settings-title">Huishouden en dagen</h2>
          <p>Deze instellingen veranderen je lijst nog niet automatisch.</p>
        </div>
        <div className="household-fields">
          <label>
            <span>Personen</span>
            <select
              value={settings.people ?? ""}
              onChange={(event) =>
                setPeople(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Niet ingesteld</option>
              {range(12).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Dagen</span>
            <select
              value={settings.days ?? ""}
              onChange={(event) =>
                setDays(event.target.value ? Number(event.target.value) : null)
              }
            >
              <option value="">Niet ingesteld</option>
              {range(7).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
        </div>
        {dailyBudget === null ? null : (
          <div className="informative-budget-split">
            <p>
              Budget per dag <strong>{formatCents(dailyBudget)}</strong>
            </p>
            {perPersonDailyBudget === null ? null : (
              <p>
                Per persoon per dag{" "}
                <strong>{formatCents(perPersonDailyBudget)}</strong>
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
