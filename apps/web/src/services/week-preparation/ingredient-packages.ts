import { productPackageCapacity } from "./product-matching";
import type { WeekIngredientRequirement, WeekIngredientUnit } from "@/types/week-preparation";

export const MAX_INGREDIENT_PACKAGES = 99;
export function validPackageCount(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 1 && Number(value) <= MAX_INGREDIENT_PACKAGES;
}
export function packageCountLabel(count: number): string {
  return `${count.toLocaleString("nl-NL")} ${count === 1 ? "verpakking" : "verpakkingen"}`;
}
export function stepPackageCount(count: number, direction: -1 | 1): number {
  return Math.max(1, Math.min(MAX_INGREDIENT_PACKAGES, count + direction));
}
/** The same parsed catalog capacity used by matching; never infer edible units from a pack count. */
export function ingredientPackageContents(ingredient: WeekIngredientRequirement): { capacity: number; unit: WeekIngredientUnit } | null {
  if (!ingredient.product || ingredient.packageCalculationMissing) return null;
  if (ingredient.kind === "mealMix" || ingredient.quantityIsPackageCount) {
    const product = { ...ingredient.product, weightGrams: ingredient.product.weightGrams ?? null };
    for (const unit of ["g", "ml", "piece"] as const) {
      const capacity = productPackageCapacity(product, unit);
      if (capacity !== null && Number.isFinite(capacity) && capacity > 0) return { capacity, unit };
    }
    return null;
  }
  // The existing loaf calculator assumes one loaf without parsing contents.
  // Keep that planner fallback, but do not expose it as verified package data.
  if (ingredient.unit === "loaf") return null;
  const capacity = ingredient.packageCapacity;
  return capacity !== null && Number.isFinite(capacity) && capacity > 0 ? { capacity, unit: ingredient.unit } : null;
}
export function ingredientPackagesForDay(ingredient: WeekIngredientRequirement, dayIndex: number): number | null {
  const use = ingredient.usedIn.find(item => item.dayIndex === dayIndex);
  if (!use || !ingredient.packageCapacity || !Number.isFinite(use.requiredQuantity)) return null;
  return Math.max(1, Math.ceil(use.requiredQuantity / ingredient.packageCapacity - 1e-9));
}
export function packageAmount(count: number, capacity: number): number {
  return Math.round(count * capacity * 1e6) / 1e6;
}

/** A mix/manual product's original amount already counts packages. */
export function ingredientRecipeAmount(ingredient: WeekIngredientRequirement, dayIndex: number): { quantity: number; unit: WeekIngredientUnit } {
  const quantity = ingredient.usedIn.find(use => use.dayIndex === dayIndex)?.requiredQuantity ?? ingredient.requiredQuantity;
  const contents = ingredientPackageContents(ingredient);
  return contents && (ingredient.kind === "mealMix" || ingredient.quantityIsPackageCount)
    ? { quantity: packageAmount(quantity, contents.capacity), unit: contents.unit }
    : { quantity, unit: ingredient.unit };
}
