export const BUDGET_SETTINGS_SCHEMA_VERSION = 1 as const;

export type BudgetStatus =
  | "noBudget"
  | "underBudget"
  | "exactlyBudget"
  | "overBudget"
  | "incompletePrices";

export interface BudgetSettings {
  schemaVersion: typeof BUDGET_SETTINGS_SCHEMA_VERSION;
  budgetCents: number | null;
  people: number | null;
  days: number | null;
}

export interface BudgetResult {
  budgetCents: number | null;
  knownSubtotalCents: number;
  remainingCents: number | null;
  overBudgetCents: number;
  percentageUsed: number | null;
  pricedItemCount: number;
  unpricedItemCount: number;
  isComplete: boolean;
  status: BudgetStatus;
}
