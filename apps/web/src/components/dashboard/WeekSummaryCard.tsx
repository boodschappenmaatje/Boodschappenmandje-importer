import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import type { WeekSummary } from "@/features/dashboard/dashboard-state";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

function availableWeekFacts(week: WeekSummary) {
  return [
    week.people === undefined ? null : `${week.people} personen`,
    week.days === undefined ? null : `${week.days} dagen`,
    week.supermarket ?? null,
  ].filter((value): value is string => Boolean(value));
}

export function WeekSummaryCard({ week }: { week: WeekSummary | null }) {
  const facts = week ? availableWeekFacts(week) : [];
  const hasBudgetForecast =
    week?.budget !== undefined && week.expectedTotal !== undefined;

  return (
    <section className="dashboard-card week-summary-card" aria-labelledby="week-title">
      <div className="dashboard-card-heading">
        <div>
          <p className="card-eyebrow">Overzicht</p>
          <h2 id="week-title">Deze week</h2>
        </div>
        <span className="card-status">Week</span>
      </div>

      {!week ? (
        <EmptyState icon="week" title="Je hebt nog geen boodschappenweek gestart">
          Begin straks met je dagen, huishouden en budget.
        </EmptyState>
      ) : (
        <div className="week-details">
          {facts.length ? <p className="week-facts">{facts.join(" · ")}</p> : null}
          {hasBudgetForecast ? (
            <div className="budget-summary">
              <span>Verwacht</span>
              <strong>{euroFormatter.format(week.expectedTotal ?? 0)}</strong>
              <span>van {euroFormatter.format(week.budget ?? 0)}</span>
              <progress
                aria-label="Verwacht deel van het weekbudget"
                max={week.budget}
                value={Math.min(week.expectedTotal ?? 0, week.budget ?? 0)}
              />
            </div>
          ) : null}
        </div>
      )}

      <Link className="primary-action" href="/week-voorbereiden">
        Start mijn week
      </Link>
    </section>
  );
}
