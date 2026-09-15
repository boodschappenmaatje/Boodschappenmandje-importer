import { Icon } from "@/components/Icon";
import { formatCents } from "@/services/budget/budget-engine";

export function BudgetStatusCard({
  budgetCents,
  plannedCents,
  complete,
}: {
  budgetCents: number | null;
  plannedCents: number;
  complete: boolean;
}) {
  if (budgetCents === null) {
    return (
      <div className="budget-status-card" data-tone="info">
        <Icon name="info" size={20} />
        <span>Stel een weekbudget in om je vrije ruimte te zien.</span>
      </div>
    );
  }

  if (!complete) {
    return (
      <div className="budget-status-card" data-tone="warning">
        <Icon name="info" size={20} />
        <span>Een deel is bekend; ontbrekende prijzen tellen nog niet mee.</span>
      </div>
    );
  }

  if (plannedCents > budgetCents) {
    return (
      <div className="budget-status-card" data-tone="danger">
        <Icon name="info" size={20} />
        <span>
          Je zit {formatCents(plannedCents - budgetCents)} boven je budget. Bekijk
          goedkopere alternatieven.
        </span>
      </div>
    );
  }

  const remaining = budgetCents - plannedCents;
  const tight = remaining <= budgetCents * 0.1;
  return (
    <div className="budget-status-card" data-tone={tight ? "warning" : "success"}>
      <Icon name={tight ? "info" : "check"} size={20} />
      <span>
        {tight
          ? "Je zit bijna aan je budget."
          : "Je menu en boodschappen passen binnen je budget!"}
      </span>
    </div>
  );
}
