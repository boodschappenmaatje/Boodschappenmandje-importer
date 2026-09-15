"use client";

import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { useBudget } from "@/features/budget/BudgetProvider";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { formatCents } from "@/services/budget/budget-engine";
import { distributionProgress } from "@/services/week-preparation/week-preparation";

export function HomeWeekSummaryCard() {
  const { settings } = useBudget();
  const { status, preparation } = useWeekPreparation();
  const progress = preparation
    ? distributionProgress(
        preparation.categoryDistribution,
        preparation.numberOfDays,
      )
    : null;
  const hasDishes =
    preparation !== null &&
    ["generated", "generationPartial"].includes(preparation.status);

  return (
    <section className="dashboard-card week-summary-card" aria-labelledby="week-title">
      <div className="dashboard-card-heading">
        <div>
          <p className="card-eyebrow">Overzicht</p>
          <h2 id="week-title">Deze week</h2>
        </div>
        <span className="card-status">Week</span>
      </div>

      {status === "loading" ? (
        <p className="shopping-list-loading" role="status">
          Je week wordt geopend…
        </p>
      ) : !preparation ? (
        <EmptyState icon="week" title="Nog geen week voorbereid">
          Je gewone boodschappenlijst blijft altijd direct bruikbaar.
        </EmptyState>
      ) : (
        <div className="week-details">
          <p className="week-facts">
            {preparation.numberOfPeople ?? "–"} personen ·{" "}
            {preparation.numberOfDays ?? "–"} dagen
            {settings.budgetCents === null
              ? ""
              : ` · ${formatCents(settings.budgetCents)} budget`}
          </p>
          <strong className="week-home-status">
            {hasDishes
              ? `${preparation.days.filter((day) => day.recipe !== null).length} gerechten gekozen`
              : preparation.status === "generating"
                ? "Gerechten worden gekozen"
                : preparation.status === "readyForGeneration"
                  ? `${preparation.numberOfDays} dagen voorbereid`
              : `${progress?.assignedDays ?? 0} van ${preparation.numberOfDays ?? 0} dagen verdeeld`}
          </strong>
          {hasDishes ? (
            <span className="week-ready-label">Week bevat gerechten</span>
          ) : preparation.status === "readyForGeneration" ? (
            <span className="week-ready-label">Klaar om gerechten te kiezen</span>
          ) : null}
        </div>
      )}

      <Link className="primary-action" href="/week-voorbereiden">
        {preparation && ["readyForGeneration", "generating", "generated", "generationPartial", "generationError"].includes(preparation.status)
          ? "Bekijk je week"
          : preparation
            ? "Verder met deze week"
            : "Week voorbereiden"}
      </Link>
    </section>
  );
}
