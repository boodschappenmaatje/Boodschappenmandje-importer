import { formatCents } from "@/services/budget/budget-engine";

export function BudgetProgress({
  budgetCents,
  plannedCents,
  complete,
  showLabel = true,
}: {
  budgetCents: number | null;
  plannedCents: number;
  complete: boolean;
  showLabel?: boolean;
}) {
  const percentage = budgetCents
    ? Math.min(100, Math.max(0, (plannedCents / budgetCents) * 100))
    : 0;

  return (
    <div className="budget-progress" data-over={Boolean(budgetCents && plannedCents > budgetCents)}>
      <div
        className="budget-progress-track"
        role="progressbar"
        aria-label="Gepland deel van het weekbudget"
        aria-valuemin={0}
        aria-valuemax={budgetCents ?? 0}
        aria-valuenow={Math.min(plannedCents, budgetCents ?? plannedCents)}
      >
        <span style={{ width: `${percentage}%` }} />
      </div>
      {showLabel && budgetCents ? (
        <p>
          {formatCents(plannedCents)} van {formatCents(budgetCents)} gepland
          {!complete ? " · gedeeltelijk bekend" : ""}
        </p>
      ) : null}
    </div>
  );
}
