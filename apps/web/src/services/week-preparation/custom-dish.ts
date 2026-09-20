import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import type { RecipeCatalog, RecipeIngredientDefinition } from "@/services/week-preparation/recipe-repository";
import { applyProductToRequirement, searchIngredientProduct } from "@/services/week-preparation/product-matching";
import type { CustomDish, WeekPreparation, WeekIngredientRequirement } from "@/types/week-preparation";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("nl-NL").trim();

export function validCustomDish(value: unknown): value is CustomDish {
  if (!value || typeof value !== "object") return false;
  const dish = value as CustomDish;
  return typeof dish.name === "string" && dish.name.trim().length > 0 && dish.name.length <= 100 &&
    Number.isInteger(dish.servings) && dish.servings >= 1 && dish.servings <= 12 &&
    Array.isArray(dish.ingredients) && dish.ingredients.length > 0 && dish.ingredients.length <= 40 &&
    new Set(dish.ingredients.map((row) => row?.id)).size === dish.ingredients.length &&
    dish.ingredients.every((row) => row && typeof row.id === "string" && row.id.length > 0 &&
      typeof row.name === "string" && row.name.trim().length > 0 && row.name.length <= 100 &&
      Number.isFinite(row.quantity) && row.quantity > 0 && row.quantity <= 100000 &&
      ["g", "kg", "ml", "l", "piece", "loaf"].includes(row.unit) &&
      (row.productId === null || typeof row.productId === "string"));
}

export function customIngredientDefinition(name: string, id: string, catalog: RecipeCatalog): RecipeIngredientDefinition {
  const canonical = catalog.ingredients.find((item) =>
    [item.name, item.normalizedName, item.sourceKey, ...item.aliases].some((alias) => normalize(alias) === normalize(name)),
  );
  return canonical ? { ...canonical, id } : {
    id, sourceKey: id, name: name.trim(), normalizedName: normalize(name), defaultUnit: "piece", category: "", aliases: [name.trim()],
  };
}

/** Uses the same canonical matcher, package calculation and price validation as the planner. */
export async function matchCustomDishes(preparation: WeekPreparation, catalog: RecipeCatalog, repository: CatalogRepository): Promise<WeekIngredientRequirement[]> {
  const result: WeekIngredientRequirement[] = [];
  for (const day of preparation.days) {
    if (!day.customDish || !day.recipe || !validCustomDish(day.customDish)) continue;
    for (const row of day.customDish.ingredients) {
      const id = `custom:${day.dayIndex}:${row.id}`;
      const definition = customIngredientDefinition(row.name, id, catalog);
      const quantity = row.quantity * (preparation.numberOfPeople ?? day.customDish.servings) / day.customDish.servings;
      const unit = row.unit === "kg" ? "g" : row.unit === "l" ? "ml" : row.unit;
      const requiredQuantity = quantity * (row.unit === "kg" || row.unit === "l" ? 1000 : 1);
      const product = row.productId
        ? (await repository.getByIds([row.productId])).products.find((item) => item.id === row.productId && item.isAvailable !== false && item.supermarket === "Hoogvliet") ?? null
        : (await searchIngredientProduct(repository, definition, null, unit)).product;
      result.push(applyProductToRequirement({
        ingredientId: id, sourceKey: definition.sourceKey, name: row.name, unit, optional: false,
        servingsBase: 1, kind: "ingredient", brandConstraint: null, requiredQuantity,
        purchaseQuantity: null, packageCapacity: null,
        usedIn: [{ recipeId: day.recipe.id, recipeName: day.recipe.name, dayIndex: day.dayIndex, requiredQuantity }],
        product: null, price: null, productMatchMissing: true, packageCalculationMissing: true,
      }, product));
    }
  }
  return result;
}
