"use client";
import { useRef, useState } from "react";
import { useActiveShoppingList } from "./ActiveShoppingListProvider";
import { useBudget } from "@/features/budget/BudgetProvider";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { adjustPersistentQuantity } from "@/services/shopping-list/shopping-list";
import { calculateBudget } from "@/services/budget/budget-engine";
import type { ManualProductBudgetImpact } from "@/services/week-preparation/meal-customization";
import type { ActiveShoppingList } from "@/types/shopping-list";

/** Only an independent contribution changes. It never mutates a recipe or grants planner approval. */
export function useIndependentPackageMutation(productId: string) {
  const list = useActiveShoppingList();
  const budget = useBudget();
  const week = useWeekPreparation();
  const [pending, setPending] = useState<{ impact: ManualProductBudgetImpact; source: ActiveShoppingList } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  async function change(delta: -1 | 1, confirmed = false) {
    if (inFlight.current) return;
    const source = list.getCurrentList();
    if (!source) return;
    const current = calculateBudget(budget.settings.budgetCents, source);
    const next = calculateBudget(budget.settings.budgetCents, adjustPersistentQuantity(source, productId, delta));
    if (delta > 0 && next.overBudgetCents > 0 && (!confirmed || pending?.source !== source || pending.impact.weekBudgetCents !== budget.settings.budgetCents)) {
      const meal = week.preparation?.generation?.mealPlanKnownCostCents ?? 0;
      const mealBudget = week.preparation?.mealBudgetCents ?? null;
      setPending({ source, impact: {
        currentMealPlanCostCents: meal, nextMealPlanCostCents: meal, mealPlanDifferenceCents: 0,
        mealBudgetCents: mealBudget, mealBudgetOverageCents: mealBudget === null ? 0 : Math.max(0, meal - mealBudget),
        currentTotalWeekCostCents: current.knownSubtotalCents, nextTotalWeekCostCents: next.knownSubtotalCents,
        totalWeekDifferenceCents: next.knownSubtotalCents - current.knownSubtotalCents,
        weekBudgetCents: next.budgetCents, weekBudgetOverageCents: next.overBudgetCents,
        weekBudgetRemainingCents: next.remainingCents, requiresBudgetOverride: true,
      } });
      return;
    }
    inFlight.current = true; setBusy(true); setMessage("");
    try { await list.adjustIndependent(productId, delta); setPending(null); }
    catch { setMessage("Aanpassen lukt nu niet. Probeer opnieuw."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return { change, confirm: () => change(1, true), cancel: () => setPending(null),
    pending, busy, blocked: busy || Boolean(pending), message };
}
