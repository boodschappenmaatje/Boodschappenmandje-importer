import {
  calculateBudget,
  shoppingListPriceCents,
} from "@/services/budget/budget-engine";
import { combinedProductPurchaseQuantity } from "@/services/week-preparation/product-matching";
import type { BudgetStatus } from "@/types/budget";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type {
  MealBudgetStatus,
  WeekIngredientRequirement,
} from "@/types/week-preparation";

export interface MealBudgetEvaluation {
  weekBudgetCents: number | null;
  mealBudgetCents: number | null;
  mealPlanKnownCostCents: number;
  existingMealListCostCents: number;
  existingNonMealKnownCostCents: number;
  newMealCostCents: number;
  mealBudgetRemainingCents: number | null;
  nonMealReservedCents: number | null;
  totalKnownWeekCostCents: number;
  mealBudgetStatus: MealBudgetStatus;
  weekBudgetStatus: BudgetStatus;
  isMealBudgetComplete: boolean;
  missingMealRequirementCount: number;
  newMealPackageCount: number;
}

function weekStatus(
  budgetCents: number | null,
  knownTotalCents: number,
  complete: boolean,
): BudgetStatus {
  if (budgetCents === null) return "noBudget";
  if (knownTotalCents > budgetCents) return "overBudget";
  if (!complete) return "incompletePrices";
  if (knownTotalCents === budgetCents) return "exactlyBudget";
  return "underBudget";
}

function mealStatus(
  mealBudgetCents: number | null,
  mealPlanKnownCostCents: number,
  complete: boolean,
): MealBudgetStatus {
  if (mealBudgetCents === null) return "noMealBudget";
  if (!complete) return "incompleteValidation";
  if (mealPlanKnownCostCents > mealBudgetCents) return "overMealBudget";
  if (mealPlanKnownCostCents === mealBudgetCents) return "exactlyMealBudget";
  return "withinMealBudget";
}

export function evaluateMealBudget(
  weekBudgetCents: number | null,
  mealBudgetCents: number | null,
  ingredients: WeekIngredientRequirement[],
  list: ActiveShoppingList,
  now: Date = new Date(),
): MealBudgetEvaluation {
  const existingBudget = calculateBudget(weekBudgetCents, list, now);
  const existingByProduct = new Map(
    list.items.map((item) => [item.productId, item]),
  );
  const grouped = Map.groupBy(
    ingredients.filter(
      (ingredient) =>
        ingredient.product &&
        ingredient.purchaseQuantity !== null &&
        (!ingredient.optional || ingredient.price !== null),
    ),
    (ingredient) => ingredient.product!.productId,
  );
  const incompleteRequirements = ingredients.filter(
    (ingredient) =>
      !ingredient.optional &&
      (ingredient.product === null ||
        ingredient.productMatchMissing ||
        ingredient.purchaseQuantity === null ||
        ingredient.packageCalculationMissing ||
        ingredient.price === null),
  ).length;

  let mealPlanKnownCostCents = 0;
  let existingMealListCostCents = 0;
  let newMealCostCents = 0;
  let newMealPackageCount = 0;

  for (const [productId, requirements] of grouped) {
    const representative = requirements.find((item) => item.price !== null);
    const priceCents = representative?.price?.amountCents ?? null;
    const packagesNeeded = combinedProductPurchaseQuantity(requirements);
    if (priceCents === null || packagesNeeded <= 0) continue;

    const existingItem = existingByProduct.get(productId);
    const existingPackages = Math.min(existingItem?.quantity ?? 0, packagesNeeded);
    const newPackages = Math.max(0, packagesNeeded - existingPackages);
    mealPlanKnownCostCents += priceCents * packagesNeeded;
    newMealCostCents += priceCents * newPackages;
    newMealPackageCount += newPackages;

    if (existingItem) {
      const existingPriceCents = shoppingListPriceCents(existingItem.price, now);
      if (existingPriceCents !== null) {
        existingMealListCostCents += existingPriceCents * existingPackages;
      }
    }
  }

  const isMealBudgetComplete = incompleteRequirements === 0;
  const totalKnownWeekCostCents =
    existingBudget.knownSubtotalCents + newMealCostCents;
  const totalComplete =
    isMealBudgetComplete && existingBudget.unpricedItemCount === 0;
  const status = mealStatus(
    mealBudgetCents,
    mealPlanKnownCostCents,
    isMealBudgetComplete,
  );

  return {
    weekBudgetCents,
    mealBudgetCents,
    mealPlanKnownCostCents,
    existingMealListCostCents,
    existingNonMealKnownCostCents: Math.max(
      0,
      existingBudget.knownSubtotalCents - existingMealListCostCents,
    ),
    newMealCostCents,
    mealBudgetRemainingCents:
      mealBudgetCents !== null && isMealBudgetComplete
        ? Math.max(0, mealBudgetCents - mealPlanKnownCostCents)
        : null,
    nonMealReservedCents:
      weekBudgetCents !== null && mealBudgetCents !== null
        ? Math.max(0, weekBudgetCents - mealBudgetCents)
        : null,
    totalKnownWeekCostCents,
    mealBudgetStatus: status,
    weekBudgetStatus: weekStatus(
      weekBudgetCents,
      totalKnownWeekCostCents,
      totalComplete,
    ),
    isMealBudgetComplete,
    missingMealRequirementCount: incompleteRequirements,
    newMealPackageCount,
  };
}

export function mealBudgetAllowsPlan(
  evaluation: MealBudgetEvaluation,
): boolean {
  return (
    evaluation.isMealBudgetComplete &&
    (evaluation.mealBudgetStatus === "withinMealBudget" ||
      evaluation.mealBudgetStatus === "exactlyMealBudget")
  );
}
