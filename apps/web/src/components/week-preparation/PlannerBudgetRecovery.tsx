import Link from "next/link";
import { formatCents } from "@/services/budget/budget-engine";
import type { WeekPreparation } from "@/types/week-preparation";

export function PlannerBudgetRecovery({ attempt, preserved = false, onSettings, onDistribution, onManual }: {
  attempt: WeekPreparation; preserved?: boolean; onSettings: () => void; onDistribution: () => void; onManual: () => void;
}) {
  const summary = attempt.generation;
  const lowest = summary?.lowestCompleteMealPlanCostCents;
  const meals = attempt.days.filter(day => !day.freeChoice || day.recipe).length;
  return <div className="week-generation-warning" role="status">
    <p>{summary?.mealBudgetStatus === "incompleteValidation"
      ? "Voor deze verdeling zijn nog niet alle gerechten compleet beschikbaar."
      : `We hebben verschillende combinaties doorgerekend. ${meals} maaltijden plannen binnen ${formatCents(attempt.mealBudgetCents ?? 0)} is daarmee niet gelukt.`}</p>
    {lowest != null && lowest > 0 ? <p>{summary?.lowestCompleteMealPlanCostReliable
      ? `De goedkoopste geldige combinatie voor deze verdeling kost ${formatCents(lowest)}.`
      : `De voordeligste complete combinatie die we hebben gevonden kost ${formatCents(lowest)}. Een andere combinatie kan nog goedkoper zijn.`}</p> : null}
    <p>{preserved ? "Je bestaande gerechten en boodschappenlijst zijn behouden." : "Je boodschappenlijst is behouden. Kies zelf een gerecht of pas je instellingen aan."} We verhogen je budget nooit automatisch.</p>
    <div className="planner-recovery-actions">
      <button type="button" className="compact-choice-button" onClick={onSettings}>Maaltijdbudget of dagen aanpassen</button>
      <button type="button" className="compact-choice-button" onClick={onDistribution}>Maaltijdverdeling aanpassen</button>
      <Link className="compact-choice-button" href={preserved ? "#prepared-week-title" : "/vrije-keuze"} onClick={onManual}>{preserved ? "Zelf gerechten aanpassen" : "Zelf maaltijden kiezen"}</Link>
    </div>
    {preserved ? <p>Open hieronder het gerecht dat je wilt aanpassen. Je kunt het gerecht of een ingrediënt vervangen.</p> : null}
  </div>;
}
