"use client";

import Link from "next/link";

import { useBudget } from "@/features/budget/BudgetProvider";
import { formatCents } from "@/services/budget/budget-engine";
import {
  budgetOutcomeLabel,
  missingPriceLabel,
} from "@/services/budget/budget-presentation";

export function ListBudgetSummary() {
  const { status, result } = useBudget();
  if (status === "loading") return null;

  if (result.budgetCents === null) {
    return (
      <Link className="list-budget-summary" href="/budget">
        <span>Weekbudget</span>
        <strong>Budget instellen</strong>
      </Link>
    );
  }

  return (
    <Link className="list-budget-summary" href="/budget">
      <span>
        {formatCents(result.knownSubtotalCents)} bekend van{" "}
        {formatCents(result.budgetCents)}
        {result.unpricedItemCount > 0
          ? " · " + missingPriceLabel(result.unpricedItemCount)
          : ""}
      </span>
      <strong>{budgetOutcomeLabel(result)}</strong>
    </Link>
  );
}
