import type { CustomDish, WeekIngredientRequirement, WeekIngredientUnit, WeekPreparation } from "@/types/week-preparation";

const round = (value: number) => Math.round(value * 1e6) / 1e6;
export const MAX_INGREDIENT_QUANTITY = 100000;

export function quantityMinimum(unit: WeekIngredientUnit): number {
  return unit === "kg" || unit === "l" ? 0.001 : 1;
}

export function quantityStep(unit: WeekIngredientUnit, quantity: number): number {
  if (unit === "piece" || unit === "loaf") return 1;
  if (unit === "kg" || unit === "l") return quantityStep(unit === "kg" ? "g" : "ml", quantity * 1000) / 1000;
  if (quantity < 10) return 1;
  if (quantity < 100) return unit === "ml" ? 5 : 10;
  return 50;
}

export function steppedIngredientQuantity(quantity: number, unit: WeekIngredientUnit, direction: -1 | 1): number {
  return round(Math.max(quantityMinimum(unit), Math.min(MAX_INGREDIENT_QUANTITY, quantity + direction * quantityStep(unit, quantity))));
}

export function canAdjustIngredient(ingredient: WeekIngredientRequirement, dayIndex: number): boolean {
  const use = ingredient.usedIn.find(item => item.dayIndex === dayIndex);
  return Boolean(use && Number.isFinite(use.requiredQuantity) && use.requiredQuantity > 0 &&
    ingredient.product && ingredient.price && ingredient.price.amountCents > 0 && ingredient.price.freshness === "fresh" &&
    ingredient.packageCapacity && !ingredient.productMatchMissing && !ingredient.packageCalculationMissing &&
    ingredient.sourceKey !== "manualProductAddition");
}

/** Store a native custom-recipe amount at its original serving count and unit. */
export function customDishWithIngredientQuantity(dish: CustomDish, dayIndex: number, ingredientId: string, quantity: number, unit: WeekIngredientUnit, people: number): CustomDish {
  return { ...dish, ingredients: dish.ingredients.map(row => {
    if (`custom:${dayIndex}:${row.id}` !== ingredientId) return row;
    const conversion = (row.unit === "kg" && unit === "g") || (row.unit === "l" && unit === "ml") ? 1000 : 1;
    return { ...row, quantity: round(quantity / conversion * dish.servings / (dish.targetServings ?? people)) };
  }) };
}

export function withIngredientQuantity(preparation: WeekPreparation, dayIndex: number, ingredientId: string, quantity: number): WeekPreparation | null {
  const day = preparation.days.find(item => item.dayIndex === dayIndex);
  const ingredient = preparation.ingredients.find(item => item.ingredientId === ingredientId && item.usedIn.some(use => use.dayIndex === dayIndex));
  if (!day?.recipe || !ingredient || !canAdjustIngredient(ingredient, dayIndex) || !Number.isFinite(quantity) || quantity < quantityMinimum(ingredient.unit) || quantity > MAX_INGREDIENT_QUANTITY) return null;
  const people = day.customDish?.targetServings ?? preparation.numberOfPeople;
  if (!people) return null;
  const current = preparation.customizations.find(item => item.dayIndex === dayIndex);
  const nativeCustomAmount = Boolean(day.customDish) && !current?.productOverrides.some(item => item.ingredientId === ingredientId && item.selectionSource === "manualSearch");
  // Reuse the existing explicit whole-recipe commit and budget approval path.
  const customization = { ...(current ?? {
    dayIndex, baseRecipe: day.recipe, productOverrides: [], ingredientOverrides: [], manualProductAdditions: [], updatedAt: preparation.updatedAt,
  }), replacementRecipe: day.recipe, recipeBudgetDecision: { mode: "userConfirmedManualChoice" as const },
    quantityOverrides: nativeCustomAmount ? current?.quantityOverrides : [
      ...(current?.quantityOverrides ?? []).filter(item => item.ingredientId !== ingredientId),
      { ingredientId, recipeId: day.recipe.id, quantity, unit: ingredient.unit, people },
    ],
  };
  return { ...preparation,
    days: nativeCustomAmount ? preparation.days.map(item => item === day ? { ...day, customDish: customDishWithIngredientQuantity(day.customDish!, dayIndex, ingredientId, quantity, ingredient.unit, people) } : item) : preparation.days,
    customizations: [...preparation.customizations.filter(item => item.dayIndex !== dayIndex), customization],
  };
}

/** Apply after product selection so the same package calculator also handles product overrides. */
export function applyIngredientQuantityOverrides(preparation: WeekPreparation, ingredients: WeekIngredientRequirement[]): WeekIngredientRequirement[] {
  return ingredients.map(ingredient => {
    let changed = false;
    const usedIn = ingredient.usedIn.map(use => {
      const override = preparation.customizations.find(item => item.dayIndex === use.dayIndex)?.quantityOverrides?.find(item => item.ingredientId === ingredient.ingredientId && item.recipeId === use.recipeId && item.unit === ingredient.unit);
      if (!override) return use;
      changed = true;
      const people = preparation.days.find(day => day.dayIndex === use.dayIndex)?.customDish?.targetServings ?? preparation.numberOfPeople ?? override.people;
      return { ...use, requiredQuantity: round(override.quantity * people / override.people) };
    });
    if (!changed) return ingredient;
    const requiredQuantity = round(usedIn.reduce((sum, use) => sum + use.requiredQuantity, 0));
    return { ...ingredient, usedIn, requiredQuantity,
      purchaseQuantity: ingredient.packageCapacity ? Math.max(1, Math.ceil(requiredQuantity / ingredient.packageCapacity)) : null };
  });
}
