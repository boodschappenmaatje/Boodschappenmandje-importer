import type { WeekIngredientRequirement } from "@/types/week-preparation";
import { canAdjustIngredientPackages } from "@/services/week-preparation/ingredient-quantity";

import { ingredientPackageContents, ingredientPackagesForDay, MAX_INGREDIENT_PACKAGES, packageCountLabel, stepPackageCount } from "@/services/week-preparation/ingredient-packages";

export function ingredientQuantityLabel(quantity: number, unit: WeekIngredientRequirement["unit"]): string {
  const amount = quantity.toLocaleString("nl-NL", { maximumFractionDigits: 3 });
  if (unit === "piece") return `${amount} ${quantity === 1 ? "stuk" : "stuks"}`;
  if (unit === "loaf") return `${amount} ${quantity === 1 ? "brood" : "broden"}`;
  return `${amount} ${unit}`;
}

export function IngredientQuantityControl({ ingredient, dayIndex, busy, onChange }: {
  ingredient: WeekIngredientRequirement; dayIndex: number; busy: boolean; onChange: (ingredientId: string, quantity: number) => void;
}) {
  const count = ingredientPackagesForDay(ingredient, dayIndex);
  if (count === null || !ingredientPackageContents(ingredient)) return <span className="compact-ingredient-quantity">Verpakkingsinhoud onbekend</span>;
  const eligible = canAdjustIngredientPackages(ingredient, dayIndex);
  return <div className="ingredient-quantity-control" role="group" aria-label={`Verpakkingen ${ingredient.name}`}>
    <button type="button" aria-label={`Minder ${ingredient.name}`} disabled={busy || !eligible || count <= 1} onClick={() => onChange(ingredient.ingredientId, stepPackageCount(count, -1))}>−</button>
    <output aria-label={`Verpakkingen ${ingredient.name}`}>{packageCountLabel(count)}</output>
    <button type="button" aria-label={`Meer ${ingredient.name}`} disabled={busy || !eligible || count >= MAX_INGREDIENT_PACKAGES} onClick={() => onChange(ingredient.ingredientId, stepPackageCount(count, 1))}>+</button>
  </div>;
}
