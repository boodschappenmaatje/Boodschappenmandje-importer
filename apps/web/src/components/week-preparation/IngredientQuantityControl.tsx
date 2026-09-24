import type { WeekIngredientRequirement } from "@/types/week-preparation";
import { canAdjustIngredient, MAX_INGREDIENT_QUANTITY, quantityMinimum, steppedIngredientQuantity } from "@/services/week-preparation/ingredient-quantity";

export function ingredientQuantityLabel(quantity: number, unit: WeekIngredientRequirement["unit"]): string {
  const amount = quantity.toLocaleString("nl-NL", { maximumFractionDigits: 3 });
  if (unit === "piece") return `${amount} ${quantity === 1 ? "stuk" : "stuks"}`;
  if (unit === "loaf") return `${amount} ${quantity === 1 ? "brood" : "broden"}`;
  return `${amount} ${unit}`;
}

export function IngredientQuantityControl({ ingredient, dayIndex, busy, onChange }: {
  ingredient: WeekIngredientRequirement; dayIndex: number; busy: boolean; onChange: (ingredientId: string, quantity: number) => void;
}) {
  const quantity = ingredient.usedIn.find(use => use.dayIndex === dayIndex)?.requiredQuantity ?? ingredient.requiredQuantity;
  const eligible = canAdjustIngredient(ingredient, dayIndex);
  return <div className="ingredient-quantity-control" role="group" aria-label={`Hoeveelheid ${ingredient.name}`}>
    <button type="button" aria-label={`Minder ${ingredient.name}`} disabled={busy || !eligible || quantity <= quantityMinimum(ingredient.unit)} onClick={() => onChange(ingredient.ingredientId, steppedIngredientQuantity(quantity, ingredient.unit, -1))}>−</button>
    <output aria-label={`Benodigd ${ingredient.name}`}>{ingredientQuantityLabel(quantity, ingredient.unit)}</output>
    <button type="button" aria-label={`Meer ${ingredient.name}`} disabled={busy || !eligible || quantity >= MAX_INGREDIENT_QUANTITY} onClick={() => onChange(ingredient.ingredientId, steppedIngredientQuantity(quantity, ingredient.unit, 1))}>+</button>
  </div>;
}
