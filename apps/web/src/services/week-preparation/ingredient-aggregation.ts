import type { RecipeIngredient } from "@/types/catalog";
import type { RecipeCatalog } from "@/services/week-preparation/recipe-repository";
import type {
  PreparedDay,
  WeekIngredientRequirement,
  WeekIngredientUnit,
} from "@/types/week-preparation";

function baseQuantity(
  amount: number,
  unit: RecipeIngredient["unit"],
): { quantity: number; unit: WeekIngredientUnit } {
  if (unit === "kg") return { quantity: amount * 1000, unit: "g" };
  if (unit === "l") return { quantity: amount * 1000, unit: "ml" };
  return { quantity: amount, unit };
}

function roundedQuantity(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function aggregateWeekIngredients(
  days: PreparedDay[],
  numberOfPeople: number,
  catalog: RecipeCatalog,
): WeekIngredientRequirement[] {
  if (!Number.isInteger(numberOfPeople) || numberOfPeople < 1) return [];

  const ingredientById = new Map(
    catalog.ingredients.map((ingredient) => [ingredient.id, ingredient]),
  );
  const relationsByRecipe = Map.groupBy(
    catalog.relations,
    (relation) => relation.recipeId,
  );
  const aggregated = new Map<string, WeekIngredientRequirement>();

  for (const day of days) {
    if (!day.recipeId || !day.recipe) continue;
    for (const relation of relationsByRecipe.get(day.recipeId) ?? []) {
      const ingredient = ingredientById.get(relation.ingredientId);
      if (!ingredient) continue;

      const scaled = baseQuantity(
        relation.amountPerPerson * numberOfPeople,
        relation.unit,
      );
      const current = aggregated.get(ingredient.id);
      const use = {
        recipeId: day.recipe.id,
        recipeName: day.recipe.name,
      };

      if (current) {
        if (current.unit !== scaled.unit) {
          throw new Error("incompatible-ingredient-units");
        }
        current.requiredQuantity = roundedQuantity(
          current.requiredQuantity + scaled.quantity,
        );
        if (!current.usedIn.some((item) => item.recipeId === use.recipeId)) {
          current.usedIn.push(use);
        }
        continue;
      }

      aggregated.set(ingredient.id, {
        ingredientId: ingredient.id,
        sourceKey: ingredient.sourceKey,
        name: ingredient.name,
        unit: scaled.unit,
        optional: false,
        servingsBase: 1,
        requiredQuantity: roundedQuantity(scaled.quantity),
        purchaseQuantity: null,
        packageCapacity: null,
        usedIn: [use],
        product: null,
        price: null,
        productMatchMissing: false,
        packageCalculationMissing: false,
      });
    }
  }

  return [...aggregated.values()].toSorted((left, right) =>
    left.name.localeCompare(right.name, "nl-NL"),
  );
}

