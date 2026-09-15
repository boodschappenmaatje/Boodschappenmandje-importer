import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  Ingredient,
  Recipe,
  RecipeIngredient,
  UUID,
} from "@/types/catalog";

export interface RecipeIngredientDefinition extends Ingredient {
  aliases: string[];
}

export interface RecipeCatalog {
  recipes: Recipe[];
  ingredients: RecipeIngredientDefinition[];
  relations: RecipeIngredient[];
}

export interface RecipeRepository {
  loadCatalog(signal?: AbortSignal): Promise<RecipeCatalog>;
}

export type RecipeReadErrorCode =
  | "not-configured"
  | "recipes-unavailable"
  | "invalid-response";

export class RecipeReadError extends Error {
  constructor(readonly code: RecipeReadErrorCode) {
    super(code);
    this.name = "RecipeReadError";
  }
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(row: UnknownRecord, field: string): string | null {
  const value = row[field];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function positiveNumber(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function mapRecipe(value: unknown): Recipe | null {
  if (!isRecord(value)) return null;
  const id = requiredString(value, "id");
  const sourceKey = requiredString(value, "source_key");
  const name = requiredString(value, "name");
  const normalizedName = requiredString(value, "normalized_name");
  const symbol = requiredString(value, "symbol");
  const preparationMinutes = positiveNumber(value.preparation_minutes);
  const budgetTier = requiredString(value, "budget_tier");
  if (
    !id ||
    !sourceKey ||
    !name ||
    !normalizedName ||
    !symbol ||
    !preparationMinutes ||
    !["economical", "standard", "premium"].includes(budgetTier ?? "")
  ) {
    return null;
  }
  return {
    id,
    sourceKey,
    name,
    normalizedName,
    symbol,
    preparationMinutes,
    vegetarian: value.vegetarian === true,
    containsPork: value.contains_pork === true,
    kidFriendly: value.kid_friendly === true,
    healthy: value.healthy === true,
    budgetTier: budgetTier as Recipe["budgetTier"],
  };
}

function mapIngredient(value: unknown): Ingredient | null {
  if (!isRecord(value)) return null;
  const id = requiredString(value, "id");
  const sourceKey = requiredString(value, "source_key");
  const name = requiredString(value, "name");
  const normalizedName = requiredString(value, "normalized_name");
  const defaultUnit = requiredString(value, "default_unit");
  const category = requiredString(value, "category");
  if (!id || !sourceKey || !name || !normalizedName || !defaultUnit || !category) {
    return null;
  }
  return { id, sourceKey, name, normalizedName, defaultUnit, category };
}

const RECIPE_UNITS = new Set<RecipeIngredient["unit"]>([
  "g",
  "kg",
  "ml",
  "l",
  "piece",
  "loaf",
]);

function mapRelation(value: unknown): RecipeIngredient | null {
  if (!isRecord(value)) return null;
  const id = requiredString(value, "id");
  const recipeId = requiredString(value, "recipe_id");
  const ingredientId = requiredString(value, "ingredient_id");
  const amountPerPerson = positiveNumber(value.amount_per_person);
  const position =
    Number.isInteger(value.position) && Number(value.position) >= 0
      ? Number(value.position)
      : null;
  const unit = requiredString(value, "unit") as RecipeIngredient["unit"] | null;
  if (
    !id ||
    !recipeId ||
    !ingredientId ||
    !amountPerPerson ||
    position === null ||
    !unit ||
    !RECIPE_UNITS.has(unit)
  ) {
    return null;
  }
  return { id, recipeId, ingredientId, amountPerPerson, unit, position };
}

export class SupabaseRecipeRepository implements RecipeRepository {
  constructor(private readonly client: SupabaseClient) {}

  async loadCatalog(signal?: AbortSignal): Promise<RecipeCatalog> {
    let recipesQuery = this.client
      .from("recipes")
      .select(
        "id,source_key,name,normalized_name,symbol,preparation_minutes,vegetarian,contains_pork,kid_friendly,healthy,budget_tier",
      )
      .order("source_key", { ascending: true });
    let ingredientsQuery = this.client
      .from("ingredients")
      .select("id,source_key,name,normalized_name,default_unit,category")
      .order("source_key", { ascending: true });
    let aliasesQuery = this.client
      .from("ingredient_aliases")
      .select("ingredient_id,alias,normalized_alias")
      .order("normalized_alias", { ascending: true });
    let relationsQuery = this.client
      .from("recipe_ingredients")
      .select("id,recipe_id,ingredient_id,amount_per_person,unit,position")
      .order("recipe_id", { ascending: true })
      .order("position", { ascending: true });

    if (signal) {
      recipesQuery = recipesQuery.abortSignal(signal);
      ingredientsQuery = ingredientsQuery.abortSignal(signal);
      aliasesQuery = aliasesQuery.abortSignal(signal);
      relationsQuery = relationsQuery.abortSignal(signal);
    }

    const [recipesResult, ingredientsResult, aliasesResult, relationsResult] =
      await Promise.all([
        recipesQuery,
        ingredientsQuery,
        aliasesQuery,
        relationsQuery,
      ]);

    if (
      recipesResult.error ||
      ingredientsResult.error ||
      aliasesResult.error ||
      relationsResult.error
    ) {
      throw new RecipeReadError("recipes-unavailable");
    }
    if (
      !Array.isArray(recipesResult.data) ||
      !Array.isArray(ingredientsResult.data) ||
      !Array.isArray(aliasesResult.data) ||
      !Array.isArray(relationsResult.data)
    ) {
      throw new RecipeReadError("invalid-response");
    }

    const recipes = recipesResult.data.map(mapRecipe).filter((item): item is Recipe => item !== null);
    const ingredients = ingredientsResult.data
      .map(mapIngredient)
      .filter((item): item is Ingredient => item !== null);
    const relations = relationsResult.data
      .map(mapRelation)
      .filter((item): item is RecipeIngredient => item !== null);
    const aliasesByIngredient = new Map<UUID, string[]>();

    for (const value of aliasesResult.data) {
      if (!isRecord(value)) continue;
      const ingredientId = requiredString(value, "ingredient_id");
      const alias =
        requiredString(value, "alias") ?? requiredString(value, "normalized_alias");
      if (!ingredientId || !alias) continue;
      aliasesByIngredient.set(ingredientId, [
        ...(aliasesByIngredient.get(ingredientId) ?? []),
        alias,
      ]);
    }

    if (
      recipes.length !== recipesResult.data.length ||
      ingredients.length !== ingredientsResult.data.length ||
      relations.length !== relationsResult.data.length
    ) {
      throw new RecipeReadError("invalid-response");
    }

    const recipeIds = new Set(recipes.map((recipe) => recipe.id));
    const ingredientIds = new Set(ingredients.map((ingredient) => ingredient.id));
    if (
      relations.some(
        (relation) =>
          !recipeIds.has(relation.recipeId) ||
          !ingredientIds.has(relation.ingredientId),
      )
    ) {
      throw new RecipeReadError("invalid-response");
    }

    return {
      recipes,
      ingredients: ingredients.map((ingredient) => ({
        ...ingredient,
        aliases: [...new Set([
          ingredient.name,
          ...(aliasesByIngredient.get(ingredient.id) ?? []),
        ])],
      })),
      relations,
    };
  }
}

export function createRecipeRepository(): RecipeRepository {
  const client = getSupabaseBrowserClient();
  if (!client) throw new RecipeReadError("not-configured");
  return new SupabaseRecipeRepository(client);
}

