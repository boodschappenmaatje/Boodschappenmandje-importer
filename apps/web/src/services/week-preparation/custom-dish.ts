import { reliablePriceCents } from "@/services/catalog/price";
import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import type { RecipeCatalog, RecipeIngredientDefinition } from "@/services/week-preparation/recipe-repository";
import { applyProductToRequirement, searchIngredientProduct } from "@/services/week-preparation/product-matching";
import type { CustomDish, WeekPreparation, WeekIngredientRequirement, CustomDishIngredient } from "@/types/week-preparation";
import { validPackageCount, packageAmount } from "./ingredient-packages";

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("nl-NL").trim();

export function validCustomDish(value: unknown): value is CustomDish {
  if (!value || typeof value !== "object") return false;
  const dish = value as CustomDish;
  return typeof dish.name === "string" && dish.name.trim().length > 0 && dish.name.length <= 100 &&
    Number.isInteger(dish.servings) && dish.servings >= 1 && dish.servings <= 12 &&
    (dish.targetServings === undefined || (Number.isInteger(dish.targetServings) && dish.targetServings >= 1 && dish.targetServings <= 12)) &&
    (dish.savedRecipeId === undefined || (typeof dish.savedRecipeId === "string" && dish.savedRecipeId.length > 0 && dish.savedRecipeId.length <= 100)) &&
    Array.isArray(dish.ingredients) && dish.ingredients.length > 0 && dish.ingredients.length <= 40 &&
    new Set(dish.ingredients.map((row) => row?.id)).size === dish.ingredients.length &&
    dish.ingredients.every((row) => row && typeof row.id === "string" && row.id.length > 0 &&
      typeof row.name === "string" && row.name.trim().length > 0 && row.name.length <= 100 &&
      Number.isFinite(row.quantity) && row.quantity > 0 && row.quantity <= 100000 &&
      (row.packageCount === undefined || (validPackageCount(row.packageCount) && typeof row.productId === "string" && row.productId.length > 0)) &&
      ["g", "kg", "ml", "l", "piece", "loaf"].includes(row.unit) &&
      (row.productId === null || (typeof row.productId === "string" && row.productId.length > 0)) &&
      (row.packageCapacityOverride === undefined || (Number.isFinite(row.packageCapacityOverride) && row.packageCapacityOverride > 0 && row.packageCapacityOverride <= 100000)));
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
  const ids = [...new Set(preparation.days.flatMap(day => day.customDish?.ingredients.map(row => row.productId).filter((id): id is string => !!id) ?? []))];
  const selected = new Map((ids.length ? (await repository.getByIds(ids)).products : []).map(product => [product.id, product]));
  for (const day of preparation.days) {
    if (!day.customDish || !day.recipe || !validCustomDish(day.customDish)) continue;
    for (const row of day.customDish.ingredients) {
      const id = `custom:${day.dayIndex}:${row.id}`;
      const definition = customIngredientDefinition(row.name, id, catalog);
      const quantity = customIngredientQuantity(row, day.customDish, preparation.numberOfPeople ?? day.customDish.servings);
      const unit = row.unit === "kg" ? "g" : row.unit === "l" ? "ml" : row.unit;
      const requiredQuantity = quantity * (row.unit === "kg" || row.unit === "l" ? 1000 : 1);
      const product = row.productId
        ? selected.get(row.productId) ?? null
        : (await searchIngredientProduct(repository, definition, null, unit, requiredQuantity)).product;
      result.push(applyCustomProduct({
        ingredientId: id, sourceKey: definition.sourceKey, name: row.name, unit, optional: false,
        servingsBase: 1, kind: "ingredient", brandConstraint: null, requiredQuantity,
        purchaseQuantity: null, packageCapacity: null,
        usedIn: [{ recipeId: day.recipe.id, recipeName: day.recipe.name, dayIndex: day.dayIndex, requiredQuantity }],
        product: null, price: null, productMatchMissing: true, packageCalculationMissing: true,
      }, row, product));
    }
  }
  return result;
}

/** Round conversion noise only, never round the number of required pieces. */
export function customIngredientQuantity(row: CustomDishIngredient, dish: CustomDish, householdPeople = dish.servings): number {
  if (row.packageCount !== undefined) return row.quantity;
  return Math.round(row.quantity * (dish.targetServings ?? householdPeople) / dish.servings * 1e9) / 1e9;
}

export function applyCustomProduct(requirement: WeekIngredientRequirement, row: CustomDishIngredient, product: import("@/types/catalog").Product | null): WeekIngredientRequirement {
  const available = product && product.isAvailable !== false && product.supermarket === "Hoogvliet" && product.sku.trim() ? product : null;
  const applied = applyProductToRequirement(requirement, available);
  const matched = { ...applied, price: reliablePriceCents(applied.price) ? applied.price : null };
  // An explicit content override is only valid for the exact selected product.
  // Prefer current catalog packaging when it can be read safely.
  if (!available || matched.packageCapacity !== null || !row.packageCapacityOverride || row.productId !== available.id) return applyCustomPackageCount(matched, row);
  const factor = row.unit === "kg" || row.unit === "l" ? 1000 : 1;
  const capacity = row.packageCapacityOverride * factor;
  return applyCustomPackageCount({ ...matched, packageCapacity: capacity, purchaseQuantity: Math.max(1, Math.ceil(requirement.requiredQuantity / capacity)), packageCalculationMissing: false }, row);
}

function applyCustomPackageCount(requirement: WeekIngredientRequirement, row: CustomDishIngredient): WeekIngredientRequirement {
  if (!row.packageCount) return requirement;
  if (!requirement.packageCapacity || requirement.product?.productId !== row.productId) return { ...requirement, purchaseQuantity: null, packageCalculationMissing: true };
  const requiredQuantity = packageAmount(row.packageCount, requirement.packageCapacity);
  return { ...requirement, requiredQuantity, purchaseQuantity: row.packageCount, usedIn: requirement.usedIn.map(use => ({ ...use, requiredQuantity })) };
}

/** Keep the stored custom row's derived amount aligned with current product contents. */
export function refreshCustomPackageAmounts(preparation: WeekPreparation, ingredients: WeekIngredientRequirement[]): WeekPreparation {
  return { ...preparation, days: preparation.days.map(day => !day.customDish ? day : { ...day, customDish: { ...day.customDish, ingredients: day.customDish.ingredients.map(row => {
    if (!row.packageCount) return row;
    const requirement = ingredients.find(item => item.ingredientId === `custom:${day.dayIndex}:${row.id}` && !item.packageCalculationMissing);
    const use = requirement?.usedIn.find(item => item.dayIndex === day.dayIndex);
    if (!use) return row;
    return { ...row, quantity: use.requiredQuantity / (row.unit === "kg" || row.unit === "l" ? 1000 : 1) };
  }) } }) };
}
