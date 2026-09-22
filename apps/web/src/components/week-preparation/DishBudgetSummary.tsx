import { useId, useRef } from "react";
import { formatCents } from "@/services/budget/budget-engine";
import { calculateDishCostSummary } from "@/services/week-preparation/week-generation";
import type { WeekPreparation } from "@/types/week-preparation";
import { DishIngredients } from "@/components/week-preparation/DishIngredients";

export function DishBudgetSummary({ preparation, dayIndex, expandable = false }: {
  preparation: WeekPreparation;
  dayIndex: number;
  expandable?: boolean;
}) {
  const details = useRef<HTMLDetailsElement>(null);
  const detailsId = useId();
  const ingredients = preparation.ingredients.filter((item) => item.usedIn.some((use) => use.dayIndex === dayIndex));
  const cost = calculateDishCostSummary(dayIndex, preparation.ingredients);
  const remaining = preparation.generation?.mealBudgetRemainingCents ?? null;
  return <div className="dish-budget-summary">
    <p>{preparation.numberOfPeople} personen</p>
    <p className="recipe-cost-summary" data-complete={cost.complete}>
      <strong>Totaal gerecht: {!cost.complete && cost.knownCostCents === 0 ? "nog niet bekend" : formatCents(cost.knownCostCents)}</strong>
      {!cost.complete ? `${cost.knownCostCents > 0 ? " bekend" : ""} · totaal nog onvolledig` : null}
    </p>
    {remaining !== null ? <p>Maaltijdbudget na keuze: {formatCents(remaining)} over{!preparation.generation?.isMealBudgetComplete ? " · voorlopig" : ""}</p> : null}
    <p>Benodigd: {new Set(ingredients.map((item) => item.product?.productId ?? item.ingredientId)).size} producten</p>
    {expandable ? <>
      <button type="button" className="text-action" aria-controls={detailsId} onClick={() => { if (details.current) details.current.open = true; details.current?.scrollIntoView({ block: "start" }); }}>Bekijk ingrediënten</button>
      <details ref={details} id={detailsId}>
        <summary>Ingrediënten en producten</summary>
        <DishIngredients ingredients={ingredients} dayIndex={dayIndex} />
      </details>
    </> : null}
  </div>;
}
