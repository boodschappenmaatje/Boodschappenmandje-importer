import type { RecipeIngredient } from "@/types/catalog";
import {
  mealMixProfileForRecipe,
} from "@/services/week-preparation/meal-mix-profiles";
import type { RecipeCatalog } from "@/services/week-preparation/recipe-repository";
import type {
  PreparedDay,
  MealMixBrand,
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

interface CatalogAggregationIndex {
  ingredientById: Map<string, RecipeCatalog["ingredients"][number]>;
  ingredientBySourceKey: Map<string, RecipeCatalog["ingredients"][number]>;
  relationsByRecipe: Map<string, RecipeCatalog["relations"]>;
}

const aggregationIndexes = new WeakMap<RecipeCatalog, CatalogAggregationIndex>();

function aggregationIndex(catalog: RecipeCatalog): CatalogAggregationIndex {
  const cached = aggregationIndexes.get(catalog);
  if (cached) return cached;
  const created = {
    ingredientById: new Map(
      catalog.ingredients.map((ingredient) => [ingredient.id, ingredient]),
    ),
    ingredientBySourceKey: new Map(
      catalog.ingredients.map((ingredient) => [ingredient.sourceKey, ingredient]),
    ),
    relationsByRecipe: Map.groupBy(
      catalog.relations,
      (relation) => relation.recipeId,
    ),
  };
  aggregationIndexes.set(catalog, created);
  return created;
}

export function aggregateWeekIngredients(
  days: PreparedDay[],
  numberOfPeople: number,
  catalog: RecipeCatalog,
): WeekIngredientRequirement[] {
  if (!Number.isInteger(numberOfPeople) || numberOfPeople < 1) return [];

  const { ingredientById, ingredientBySourceKey, relationsByRecipe } =
    aggregationIndex(catalog);
  const aggregated = new Map<string, WeekIngredientRequirement>();

  function addRequirement(
    day: PreparedDay,
    ingredientId: string,
    sourceKey: string,
    name: string,
    quantity: number,
    unit: WeekIngredientUnit,
    kind: WeekIngredientRequirement["kind"],
    brandConstraint: MealMixBrand | null,
    optional = false,
  ) {
    const scaledQuantity = roundedQuantity(quantity);
    const current = aggregated.get(ingredientId);
    const recipeName =
      mealMixProfileForRecipe(day.recipe?.sourceKey ?? "")?.dishName ??
      day.recipe?.name ??
      "Gerecht";
    const use = {
      recipeId: day.recipeId!,
      recipeName,
      dayIndex: day.dayIndex,
      requiredQuantity: scaledQuantity,
    };

    if (current) {
      if (current.unit !== unit || current.kind !== kind) {
        throw new Error("incompatible-ingredient-units");
      }
      current.requiredQuantity = roundedQuantity(
        current.requiredQuantity + scaledQuantity,
      );
      // Zodra één gerecht dit ingrediënt verplicht maakt, is de gezamenlijke
      // weekbehoefte eveneens verplicht.
      current.optional = current.optional && optional;
      const existingUse = current.usedIn.find(
        (item) => item.dayIndex === day.dayIndex && item.recipeId === use.recipeId,
      );
      if (existingUse) {
        existingUse.requiredQuantity = roundedQuantity(
          existingUse.requiredQuantity + scaledQuantity,
        );
      } else {
        current.usedIn.push(use);
      }
      return;
    }

    aggregated.set(ingredientId, {
      ingredientId,
      sourceKey,
      name,
      unit,
      optional,
      servingsBase: 1,
      kind,
      brandConstraint,
      requiredQuantity: scaledQuantity,
      purchaseQuantity: null,
      packageCapacity: null,
      usedIn: [use],
      product: null,
      price: null,
      productMatchMissing: false,
      packageCalculationMissing: false,
    });
  }

  for (const day of days) {
    if (!day.recipeId || !day.recipe) continue;
    const mealMix = mealMixProfileForRecipe(day.recipe.sourceKey, catalog.mealMixProfiles);
    if (mealMix) {
      const mixIngredient = ingredientBySourceKey.get(
        mealMix.productIngredientSourceKey,
      );
      if (mixIngredient) {
        addRequirement(
          day,
          mixIngredient.id,
          mixIngredient.sourceKey,
          mealMix.productName,
          Math.ceil(numberOfPeople / mealMix.servingsPerPackage),
          "piece",
          "mealMix",
          mealMix.brand,
          false,
        );
      }

      for (const supplement of mealMix.supplements) {
        const ingredient = ingredientBySourceKey.get(supplement.sourceKey);
        if (!ingredient) continue;
        addRequirement(
          day,
          ingredient.id,
          ingredient.sourceKey,
          supplement.name,
          (supplement.quantity * numberOfPeople) / (mealMix.supplementServings ?? mealMix.servingsPerPackage),
          supplement.unit,
          "ingredient",
          null,
          false,
        );
      }
      continue;
    }

    for (const relation of relationsByRecipe.get(day.recipeId) ?? []) {
      const ingredient = ingredientById.get(relation.ingredientId);
      if (!ingredient) continue;

      const scaled = baseQuantity(
        relation.amountPerPerson * numberOfPeople,
        relation.unit,
      );
      addRequirement(
        day,
        ingredient.id,
        ingredient.sourceKey,
        ingredient.name,
        scaled.quantity,
        scaled.unit,
        "ingredient",
        null,
        relation.optional === true,
      );
    }
  }

  return [...aggregated.values()].toSorted((left, right) =>
    left.name.localeCompare(right.name, "nl-NL"),
  );
}
