"use client";

import Link from "next/link";

import { Icon } from "@/components/Icon";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { distributionProgress } from "@/services/week-preparation/week-preparation";

export function HomeWeekPreparationCard() {
  const { status, preparation } = useWeekPreparation();
  const progress = preparation
    ? distributionProgress(
        preparation.categoryDistribution,
        preparation.numberOfDays,
      )
    : null;
  const hasWeek =
    preparation !== null &&
    ["readyForGeneration", "generating", "generated", "generationPartial", "generationError"].includes(preparation.status);
  const title =
    hasWeek
      ? "Bekijk je week"
      : preparation
        ? "Verder met voorbereiden"
        : "Week voorbereiden";
  const description =
    status === "loading"
      ? "Je week wordt geopend…"
      : preparation
        ? ["generated", "generationPartial"].includes(preparation.status)
          ? `${preparation.days.filter((day) => day.recipe !== null).length} gerechten gekozen`
          : preparation.status === "generating"
            ? "Gerechten worden gekozen…"
            : `${progress?.assignedDays ?? 0} van ${preparation.numberOfDays ?? 0} dagen verdeeld`
        : "Bereid je boodschappenweek rustig en slim voor.";

  return (
    <Link
      className="dashboard-action-card week-preparation-action-card"
      data-wide="true"
      href="/week-voorbereiden"
    >
      <span className="dashboard-action-icon">
        <Icon name="prepare" size={23} />
      </span>
      <span className="dashboard-action-copy">
        <strong>{title}</strong>
        <span>{description}</span>
      </span>
      <span className="dashboard-action-arrow">
        <Icon name="arrow" size={18} />
      </span>
    </Link>
  );
}
