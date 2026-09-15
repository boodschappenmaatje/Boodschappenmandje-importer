import { formatCents } from "@/services/budget/budget-engine";
import type { BudgetResult } from "@/types/budget";

export function missingPriceLabel(count: number): string {
  return (
    count +
    " " +
    (count === 1
      ? "product zonder beschikbare prijs"
      : "producten zonder beschikbare prijs")
  );
}

export function budgetOutcomeLabel(result: BudgetResult): string {
  switch (result.status) {
    case "noBudget":
      return "Budget instellen";
    case "underBudget":
      return formatCents(result.remainingCents ?? 0) + " over";
    case "exactlyBudget":
      return "Precies op budget";
    case "overBudget":
      return formatCents(result.overBudgetCents) + " boven budget";
    case "incompletePrices":
      return result.overBudgetCents > 0
        ? "Minimaal " + formatCents(result.overBudgetCents) + " boven budget"
        : "Totaal nog niet compleet";
  }
}
