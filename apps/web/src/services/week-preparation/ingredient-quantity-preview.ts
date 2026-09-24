import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import type { RecipeRepository } from "./recipe-repository";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type { WeekPreparation } from "@/types/week-preparation";
import { withIngredientQuantity } from "./ingredient-quantity";
import { budgetImpact, listWithoutCurrentWeekMealPlan, type RecipeAlternative } from "./meal-customization";
import { calculateDishCostSummary, revalidatePreparedWeek } from "./week-generation";

export async function previewIngredientQuantity(current: WeekPreparation, source: WeekPreparation, dayIndex: number, ingredientId: string, quantity: number, recipes: RecipeRepository, products: CatalogRepository, list: ActiveShoppingList, now = new Date()): Promise<RecipeAlternative | null> {
  if (current.id !== source.id || current.status === "draft") return null;
  const changed = withIngredientQuantity(source, dayIndex, ingredientId, quantity);
  const day = changed?.days.find(item => item.dayIndex === dayIndex);
  if (!changed || !day?.recipe) return null;
  const baseline = listWithoutCurrentWeekMealPlan(list, current.id, now)!;
  const candidate = { ...current,
    days: current.days.map(item => item.dayIndex === dayIndex ? day : item),
    customizations: [...current.customizations.filter(item => item.dayIndex !== dayIndex), ...changed.customizations.filter(item => item.dayIndex === dayIndex)],
  };
  const next = (await revalidatePreparedWeek(candidate, recipes, products, now, baseline)).preparation;
  const cost = calculateDishCostSummary(dayIndex, next.ingredients);
  if (!cost.complete || next.ingredients.some(item => item.usedIn.some(use => use.dayIndex === dayIndex) && !item.optional && (!item.price || item.price.amountCents <= 0 || item.price.freshness !== "fresh"))) return null;
  const currentCost = calculateDishCostSummary(dayIndex, current.ingredients).knownCostCents;
  const impact = budgetImpact(current, next, baseline, now);
  return { recipe: day.recipe, category: day.category === "freeChoice" ? "comfort" : day.category,
    currentDishCostCents: currentCost, alternativeDishCostCents: cost.knownCostCents, differenceCents: cost.knownCostCents - currentCost,
    nextMealPlanCostCents: impact.nextMealPlanCostCents, mealBudgetCents: impact.mealBudgetCents, withinMealBudget: !impact.requiresBudgetOverride,
    alreadyUsedInWeek: current.days.some(item => item.dayIndex !== dayIndex && item.recipeId === day.recipeId),
    impact, preparation: next, basePreparationUpdatedAt: current.updatedAt, validatedAt: now.toISOString() };
}
