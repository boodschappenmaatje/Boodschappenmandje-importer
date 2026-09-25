import { reliablePriceCents } from "@/services/catalog/price";
import type { CustomDish, WeekIngredientRequirement, WeekIngredientUnit, WeekPreparation } from "@/types/week-preparation";
import { ingredientPackageContents, packageAmount, validPackageCount } from "./ingredient-packages";

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
    ingredient.product && reliablePriceCents(ingredient.price) &&
    ingredient.packageCapacity && !ingredient.productMatchMissing && !ingredient.packageCalculationMissing &&
    ingredient.sourceKey !== "manualProductAddition");
}

export function canAdjustIngredientPackages(ingredient: WeekIngredientRequirement, dayIndex: number): boolean {
  return canAdjustIngredient(ingredient, dayIndex) && ingredientPackageContents(ingredient) !== null;
}

export function customDishWithIngredientPackages(dish: CustomDish, dayIndex: number, ingredient: WeekIngredientRequirement, count: number): CustomDish | null {
  const contents = ingredientPackageContents(ingredient);
  if (!contents || !validPackageCount(count) || !ingredient.product) return null;
  const total = packageAmount(count, contents.capacity);
  if (total > MAX_INGREDIENT_QUANTITY) return null;
  return { ...dish, ingredients: dish.ingredients.map(row => {
    if (`custom:${dayIndex}:${row.id}` !== ingredient.ingredientId) return row;
    const conversion = (row.unit === "kg" && contents.unit === "g") || (row.unit === "l" && contents.unit === "ml") ? 1000 : 1;
    return { ...row, productId: ingredient.product!.productId, packageCount: count, quantity: total / conversion };
  }) };
}

/** Whole packages are the explicit source; people changes do not change this choice. */
export function withIngredientPackages(preparation: WeekPreparation, dayIndex: number, ingredientId: string, count: number): WeekPreparation | null {
  const day = preparation.days.find(item => item.dayIndex === dayIndex);
  const ingredient = preparation.ingredients.find(item => item.ingredientId === ingredientId && item.usedIn.some(use => use.dayIndex === dayIndex));
  if (!day?.recipe || !ingredient || !canAdjustIngredientPackages(ingredient, dayIndex) || !validPackageCount(count)) return null;
  const contents = ingredientPackageContents(ingredient)!;
  const quantity = packageAmount(count, contents.capacity);
  if (quantity > MAX_INGREDIENT_QUANTITY) return null;
  const current = preparation.customizations.find(item => item.dayIndex === dayIndex);
  const manualProduct = current?.productOverrides.find(item => item.ingredientId === ingredientId && item.selectionSource === "manualSearch");
  const customDish = day.customDish && !manualProduct ? customDishWithIngredientPackages(day.customDish, dayIndex, ingredient, count) : day.customDish;
  const productOverrides = current?.productOverrides ?? [];
  const customization = { ...(current ?? { dayIndex, baseRecipe: day.recipe, ingredientOverrides: [], manualProductAdditions: [], updatedAt: preparation.updatedAt }),
    replacementRecipe: day.recipe, recipeBudgetDecision: { mode: "userConfirmedManualChoice" as const },
    // Retain this exact product; a rematch must not reinterpret the package choice.
    productOverrides: day.customDish || productOverrides.some(item => item.ingredientId === ingredientId) ? productOverrides : [...productOverrides, {
      ingredientId, productId: ingredient.product!.productId, sku: ingredient.product!.sku, quantity: null,
      selectionSource: "automaticSuggestion" as const, applicationMode: "explicitUserChoice" as const,
      budgetDecision: { mode: "userConfirmedManualChoice" as const }, updatedAt: preparation.updatedAt,
    }],
    quantityOverrides: [ ...(current?.quantityOverrides ?? []).filter(item => item.ingredientId !== ingredientId),
      { ingredientId, recipeId: day.recipe.id, quantity, unit: contents.unit, people: preparation.numberOfPeople!, packageCount: count, productId: ingredient.product!.productId } ],
  };
  return { ...preparation, days: preparation.days.map(item => item === day ? { ...day, customDish: customDish ?? undefined } : item),
    customizations: [...preparation.customizations.filter(item => item.dayIndex !== dayIndex), customization] };
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

/** Preserve the recipe definition and remove only this day's explicit ingredient contribution. */
export function withIngredientExcluded(preparation: WeekPreparation, dayIndex: number, ingredientId: string): WeekPreparation | null {
  const day = preparation.days.find(item => item.dayIndex === dayIndex);
  const ingredient = preparation.ingredients.find(item => item.ingredientId === ingredientId && item.usedIn.some(use => use.dayIndex === dayIndex && use.recipeId === day?.recipeId));
  if (!day?.recipe || !ingredient?.product) return null;
  const current = preparation.customizations.find(item => item.dayIndex === dayIndex);
  const customization = { ...(current ?? { dayIndex, baseRecipe: day.recipe, productOverrides: [], ingredientOverrides: [], manualProductAdditions: [], updatedAt: preparation.updatedAt }),
    replacementRecipe: day.recipe, recipeBudgetDecision: { mode: "userConfirmedManualChoice" as const },
    excludedIngredients: [...(current?.excludedIngredients ?? []).filter(item => item.ingredientId !== ingredientId || item.recipeId !== day.recipeId),
      { ingredientId, recipeId: day.recipe.id, name: ingredient.name }],
  };
  return { ...preparation, customizations: [...preparation.customizations.filter(item => item.dayIndex !== dayIndex), customization] };
}

/** Apply after product selection so the same package calculator also handles product overrides. */
export function applyIngredientQuantityOverrides(preparation: WeekPreparation, ingredients: WeekIngredientRequirement[]): WeekIngredientRequirement[] {
  return ingredients.flatMap(ingredient => {
    const scoped = ingredient.usedIn.filter(use => !preparation.customizations.find(item => item.dayIndex === use.dayIndex)?.excludedIngredients?.some(item => item.ingredientId === ingredient.ingredientId && item.recipeId === use.recipeId)).map(use => {
      const override = preparation.customizations.find(item => item.dayIndex === use.dayIndex)?.quantityOverrides?.find(item => item.ingredientId === ingredient.ingredientId && item.recipeId === use.recipeId);
      if (!override) return { ingredient, use };
      if (override.packageCount) {
        const contents = ingredientPackageContents(ingredient);
        if (!contents || ingredient.product?.productId !== override.productId) return { ingredient: { ...ingredient, packageCalculationMissing: true, purchaseQuantity: null }, use: { ...use, requiredQuantity: override.quantity } };
        return { ingredient: { ...ingredient, unit: contents.unit, kind: "ingredient" as const, quantityIsPackageCount: false, packageCapacity: contents.capacity }, use: { ...use, requiredQuantity: packageAmount(override.packageCount, contents.capacity) } };
      }
      if (override.unit !== ingredient.unit) return { ingredient, use };
      const people = preparation.days.find(day => day.dayIndex === use.dayIndex)?.customDish?.targetServings ?? preparation.numberOfPeople ?? override.people;
      return { ingredient, use: { ...use, requiredQuantity: round(override.quantity * people / override.people) } };
    });
    return [...Map.groupBy(scoped, item => JSON.stringify([item.ingredient.unit, item.ingredient.kind, item.ingredient.packageCapacity, item.ingredient.packageCalculationMissing])).values()].map(group => {
      const base = group[0].ingredient;
      const usedIn = group.map(item => item.use);
      const requiredQuantity = round(usedIn.reduce((sum, use) => sum + use.requiredQuantity, 0));
      return { ...base, usedIn, requiredQuantity, purchaseQuantity: base.packageCapacity && !base.packageCalculationMissing ? Math.max(1, Math.ceil(requiredQuantity / base.packageCapacity - 1e-9)) : null };
    });
  });
}
