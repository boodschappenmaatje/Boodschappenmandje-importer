"use client";

import Link from "next/link";

import { Icon } from "@/components/Icon";
import { useBudget } from "@/features/budget/BudgetProvider";
import { formatCents } from "@/services/budget/budget-engine";
import {
  budgetOutcomeLabel,
  missingPriceLabel,
} from "@/services/budget/budget-presentation";

export function HomeBudgetCard() {
  const { status, result } = useBudget();
  const hasBudget = result.budgetCents !== null;
  const progressValue = Math.min(100, result.percentageUsed ?? 0);

  return (
    <Link className="dashboard-action-card budget-action-card" href="/budget">
      <span className="dashboard-action-icon">
        <Icon name="budget" size={23} />
      </span>
      <span className="dashboard-action-copy">
        <strong>Budget</strong>
        {status === "loading" ? (
          <span>Budget openen…</span>
        ) : !hasBudget ? (
          <span>Budget instellen</span>
        ) : (
          <>
            <span className="home-budget-amount">
              {formatCents(result.knownSubtotalCents)} bekend besteed van{" "}
              {formatCents(result.budgetCents ?? 0)}
            </span>
            <span className="home-budget-outcome">
              {budgetOutcomeLabel(result)}
            </span>
            {result.unpricedItemCount > 0 ? (
              <span>{missingPriceLabel(result.unpricedItemCount)}</span>
            ) : null}
            <progress
              aria-label="Deel van het weekbudget bekend besteed"
              max={100}
              value={progressValue}
            />
          </>
        )}
      </span>
      <span className="dashboard-action-arrow">
        <Icon name="arrow" size={18} />
      </span>
    </Link>
  );
}
