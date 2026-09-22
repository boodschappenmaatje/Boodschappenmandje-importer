import type { KeyValueStorage } from "@/services/budget/budget-settings-storage";
import { validCustomDish } from "./custom-dish";
import type { CustomDish } from "@/types/week-preparation";

export const MY_RECIPES_KEY = "boodschappenmaatje:my-recipes:v1";
export interface SavedCustomRecipe {
  schemaVersion: 1;
  id: string;
  dish: CustomDish;
  photo: { kind: "fallback" };
  createdAt: string;
  updatedAt: string;
}
export const customDraftKey = (weekId: string, dayIndex: number) => `boodschappenmaatje:custom-draft:v1:${weekId}:${dayIndex}`;

/** Incomplete input is deliberately persisted too, but never treated as ready. */
export function validCustomDraft(value: unknown): value is CustomDish {
  if (!value || typeof value !== "object") return false;
  const dish = value as CustomDish;
  return typeof dish.name === "string" && dish.name.length <= 100 &&
    Array.isArray(dish.ingredients) && dish.ingredients.length <= 40 &&
    dish.ingredients.every(row => row && typeof row.name === "string" && row.name.length <= 100 && Number.isFinite(row.quantity) && row.quantity >= 0) &&
    validCustomDish({ ...dish, name: dish.name.trim() || "Concept", ingredients: dish.ingredients.length
      ? dish.ingredients.map(row => ({ ...row, name: row.name.trim() || "Ingrediënt", quantity: row.quantity || 1 }))
      : [{ id: "empty", name: "Concept", quantity: 1, unit: "piece", productId: null }] });
}

function cleanDish(dish: CustomDish): CustomDish {
  // Whitelist only recipe inputs: never persist product/price snapshots as truth.
  return {
    name: dish.name, servings: dish.servings,
    ...(dish.savedRecipeId ? { savedRecipeId: dish.savedRecipeId } : {}),
    ...(dish.targetServings !== undefined ? { targetServings: dish.targetServings } : {}),
    ingredients: dish.ingredients.map(row => ({ id: row.id, name: row.name, quantity: row.quantity, unit: row.unit, productId: row.productId,
      ...(row.packageCapacityOverride !== undefined ? { packageCapacityOverride: row.packageCapacityOverride } : {}) })),
  };
}

export function loadCustomDraft(storage: KeyValueStorage, key: string): CustomDish | null {
  const raw = storage.getItem(key);
  if (!raw) return null;
  const record = JSON.parse(raw);
  if (record?.schemaVersion !== 1 || !validCustomDraft(record.dish)) throw new Error("invalid-custom-draft");
  return cleanDish(record.dish);
}
export function saveCustomDraft(storage: KeyValueStorage, key: string, dish: CustomDish): void {
  if (!validCustomDraft(dish)) throw new Error("invalid-custom-draft");
  storage.setItem(key, JSON.stringify({ schemaVersion: 1, dish: cleanDish(dish) }));
}

export function loadMyRecipes(storage: KeyValueStorage): SavedCustomRecipe[] {
  const raw = storage.getItem(MY_RECIPES_KEY);
  if (!raw) return [];
  const data = JSON.parse(raw);
  if (data?.schemaVersion !== 1 || !Array.isArray(data.recipes) ||
    !data.recipes.every((entry: SavedCustomRecipe) => entry?.schemaVersion === 1 && typeof entry.id === "string" && entry.id.length > 0 &&
      validCustomDish(entry.dish) && entry.dish.savedRecipeId === entry.id && entry.photo?.kind === "fallback" &&
      typeof entry.createdAt === "string" && Number.isFinite(Date.parse(entry.createdAt)) && typeof entry.updatedAt === "string" && Number.isFinite(Date.parse(entry.updatedAt))) ||
    new Set(data.recipes.map((entry: SavedCustomRecipe) => entry.id)).size !== data.recipes.length) throw new Error("invalid-my-recipes");
  return data.recipes.map((entry: SavedCustomRecipe) => ({ schemaVersion: 1, id: entry.id, dish: cleanDish(entry.dish), photo: { kind: "fallback" }, createdAt: entry.createdAt, updatedAt: entry.updatedAt }));
}

export function saveMyRecipe(storage: KeyValueStorage, dish: CustomDish, id: string, now = new Date()): SavedCustomRecipe {
  if (!validCustomDish(dish) || !id || id.length > 100 || dish.ingredients.some(row => !row.productId)) throw new Error("invalid-custom-recipe");
  // Fresh read prevents a stale tab from dropping recipes saved by another tab.
  const existing = loadMyRecipes(storage);
  const prior = existing.find(entry => entry.id === id);
  const record: SavedCustomRecipe = { schemaVersion: 1, id, dish: cleanDish({ ...dish, savedRecipeId: id }), photo: { kind: "fallback" }, createdAt: prior?.createdAt ?? now.toISOString(), updatedAt: now.toISOString() };
  storage.setItem(MY_RECIPES_KEY, JSON.stringify({ schemaVersion: 1, recipes: [record, ...existing.filter(entry => entry.id !== id)] }));
  return record;
}

/** A restored draft is only dirty when its inputs differ from its saved recipe. */
export function customDraftHasChanges(dish: CustomDish, recipes: SavedCustomRecipe[]): boolean {
  if (!dish.name && dish.ingredients.length === 0) return false;
  const saved = recipes.find(entry => entry.id === dish.savedRecipeId);
  return !saved || JSON.stringify(cleanDish(dish)) !== JSON.stringify(cleanDish(saved.dish));
}
