import type { PlannedIngredientLink, ShoppingListItem } from "@/types/shopping-list";
import type { WeekIngredientRequirement, WeekPreparation } from "@/types/week-preparation";
import { canAdjustIngredientPackages } from "@/services/week-preparation/ingredient-quantity";
import { ingredientPackagesForDay } from "@/services/week-preparation/ingredient-packages";
import { ingredientLinksForWeek } from "./shopping-list";

export interface RecipeContributionTarget {
  link: PlannedIngredientLink;
  recipeName: string;
  ingredient: WeekIngredientRequirement;
  packages: number;
  adjustable: boolean;
}

export function sameIngredientLink(a: PlannedIngredientLink, b: PlannedIngredientLink): boolean {
  return a.weekPreparationId === b.weekPreparationId && a.dayIndex === b.dayIndex && a.recipeId === b.recipeId &&
    a.ingredientId === b.ingredientId && a.productId === b.productId && a.sku === b.sku;
}

/** Resolve ownership through the actual week contribution, never by SKU alone. */
export function recipeContributionTargets(item: ShoppingListItem, week: WeekPreparation | null): { targets: RecipeContributionTarget[]; unresolved: boolean } {
  const targets: RecipeContributionTarget[] = [];
  let unresolved = false;
  for (const contribution of item.quantityContributions.mealPlans) {
    if (!week || contribution.weekPreparationId !== week.id || !["generated", "generationPartial"].includes(week.status)) { unresolved = true; continue; }
    const requirements = week.ingredients.filter(row => row.product?.productId === item.productId && row.product.sku === item.sku);
    // Older persisted lists know the exact week but not the ingredient address.
    // Reconstruct only within that week, and keep unrelated origins untouched.
    const links = contribution.ingredientLinks ?? ingredientLinksForWeek(requirements, week.id);
    if (!links.length) unresolved = true;
    for (const link of links) {
      const day = week.days.find(day => day.dayIndex === link.dayIndex && day.recipeId === link.recipeId);
      const ingredient = requirements.find(row => row.ingredientId === link.ingredientId && row.usedIn.some(use => use.dayIndex === link.dayIndex && use.recipeId === link.recipeId));
      if (link.weekPreparationId !== week.id || link.productId !== item.productId || link.sku !== item.sku || !day?.recipe || !ingredient) { unresolved = true; continue; }
      const packages = ingredientPackagesForDay(ingredient, link.dayIndex);
      if (packages === null) { unresolved = true; continue; }
      if (!targets.some(target => sameIngredientLink(target.link, link))) targets.push({ link, recipeName: day.recipe.name, ingredient, packages, adjustable: canAdjustIngredientPackages(ingredient, link.dayIndex) });
    }
  }
  return { targets, unresolved };
}
