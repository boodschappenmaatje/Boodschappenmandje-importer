import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  AI_GENERATED_RECIPE_IMAGE_COUNT,
  AI_GENERATED_RECIPE_IMAGE_IDS,
  CATEGORY_FALLBACK_IMAGE_COUNT,
  DISH_IMAGE_KEYS,
  RECIPE_IMAGE_KEYS,
  SPECIFIC_RECIPE_IMAGE_COUNT,
  evaluateRecipeImageHealth,
  evaluateRecipeImageQuality,
  recipeImageFor,
  type RecipeImageContext,
} from "@/services/week-preparation/recipe-images";
import { recipeCategories } from "@/services/week-preparation/recipe-selection";
import type { Recipe } from "@/types/catalog";

interface RecipeSource {
  sourceKey: string;
  name: string;
  symbol: string;
  preparationMinutes: number;
  vegetarian: boolean;
  containsPork: boolean;
  kidFriendly: boolean;
  healthy: boolean;
  budgetTier: Recipe["budgetTier"];
}

interface RecipeData {
  recipes: RecipeSource[];
}

interface IngredientSource {
  sourceKey: string;
  name: string;
  category: string;
}

interface IngredientData {
  ingredients: IngredientSource[];
}

interface MentionData {
  mentions: Array<{
    recipeSourceKey: string;
    ingredientTerm: string;
    position: number;
    optional?: boolean;
  }>;
}

const recipeData = JSON.parse(
  readFileSync(new URL("../../../../../data/recipes.json", import.meta.url), "utf8"),
) as RecipeData;
const ingredientData = JSON.parse(
  readFileSync(new URL("../../../../../data/ingredients.json", import.meta.url), "utf8"),
) as IngredientData;
const mentionData = JSON.parse(
  readFileSync(new URL("../../../../../data/recipe-ingredients.json", import.meta.url), "utf8"),
) as MentionData;
const ingredientsBySourceKey = new Map(
  ingredientData.ingredients.map((ingredient) => [ingredient.sourceKey, ingredient]),
);

function contextForRecipe(recipeSourceKey: string): RecipeImageContext {
  const source = recipeData.recipes.find((recipe) => recipe.sourceKey === recipeSourceKey);
  if (!source) throw new Error(`Unknown recipe ${recipeSourceKey}`);
  const recipe: Recipe = {
    ...source,
    id: source.sourceKey,
    normalizedName: source.name.toLocaleLowerCase("nl-NL"),
  };
  return {
    recipeSourceKey,
    recipeName: recipe.name,
    categories: recipeCategories(recipe),
    ingredients: mentionData.mentions
      .filter((mention) => mention.recipeSourceKey === recipeSourceKey)
      .map((mention) => {
        const ingredient = ingredientsBySourceKey.get(mention.ingredientTerm);
        return {
          sourceKey: mention.ingredientTerm,
          name: ingredient?.name ?? mention.ingredientTerm,
          category: ingredient?.category ?? null,
          position: mention.position,
          optional: mention.optional === true,
        };
      }),
  };
}

const allContexts = recipeData.recipes.map((recipe) =>
  contextForRecipe(recipe.sourceKey),
);

describe("Recipe Image Quality Gate", () => {
  it("controleert alle 100 bestaande receptkandidaten via één centrale typed gate", () => {
    const scan = evaluateRecipeImageHealth(allContexts);

    expect(recipeData.recipes).toHaveLength(100);
    expect(SPECIFIC_RECIPE_IMAGE_COUNT).toBe(100);
    expect(scan.summary.total).toBe(100);
    expect(scan.summary).toEqual({
      total: 100,
      imagePresent: 100,
      verified: 98,
      likelyMatch: 2,
      needsReview: 0,
      mismatch: 0,
      missing: 0,
      fallbackNeeded: 0,
    });
    expect(scan.recipes).toHaveLength(100);
    expect(
      recipeData.recipes.filter(
        ({ sourceKey }) => !RECIPE_IMAGE_KEYS[sourceKey as keyof typeof RECIPE_IMAGE_KEYS],
      ),
    ).toEqual([]);
  });

  it("verwijst uitsluitend naar aanwezige geoptimaliseerde WebP-assets", () => {
    for (const key of DISH_IMAGE_KEYS) {
      expect(
        existsSync(new URL(`../../../public/images/dishes/${key}.webp`, import.meta.url)),
        key,
      ).toBe(true);
    }
  });

  it("wijst in de generieke gate een bloemkoolfoto af voor aardappelen, spinazie en ei", () => {
    const result = evaluateRecipeImageQuality({
      ...contextForRecipe("spinazie-ei-aardappel"),
      recipeSourceKey: "cauliflower-potatoes",
    });

    expect(result).toMatchObject({
      imageKey: "dutch-cauliflower-potatoes-egg",
      status: "mismatch",
      accepted: false,
      fallbackNeeded: true,
    });
    expect(result.issues).toContain("primary_ingredient_conflict");
  });

  it("koppelt alle 14 gegen de gate gevalideerde AI-replacements aan de stabiele recipe-id", () => {
    expect(AI_GENERATED_RECIPE_IMAGE_COUNT).toBe(14);

    for (const recipeId of AI_GENERATED_RECIPE_IMAGE_IDS) {
      const context = contextForRecipe(recipeId);
      const result = evaluateRecipeImageQuality(context);
      const asset = recipeImageFor(context);

      expect(result.accepted, recipeId).toBe(true);
      expect(result.fallbackNeeded, recipeId).toBe(false);
      expect(asset, recipeId).toMatchObject({
        source: "recipe",
        metadata: {
          recipeId,
          sourceType: "generated",
          status: "approved",
          version: 2,
          updatedAt: "2026-09-17",
        },
      });
    }
  });

  it.each([
    "spaghetti-bolognese",
    "macaroni",
    "honig-nasi-speciaal",
    "boerenkool-rookworst",
    "chicken-rice",
    "beef-wraps",
    "broodje-hamburger",
    "hotdogs",
    "vegetarian-chili",
    "luxe-tosti-avond",
  ])("accepteert een semantisch passende gecontroleerde afbeelding voor %s", (sourceKey) => {
    const result = evaluateRecipeImageQuality(contextForRecipe(sourceKey));
    expect(["verified", "likely_match"]).toContain(result.status);
    expect(result.accepted).toBe(true);
    expect(recipeImageFor(contextForRecipe(sourceKey))).not.toBeNull();
  });

  it.each([
    {
      sourceKey: "spaghetti-bolognese",
      recipeName: "Lasagne bolognese",
      ingredients: ["lasagnebladen", "groundBeef", "tomatoSauce"],
    },
    {
      sourceKey: "spaghetti-bolognese",
      recipeName: "Nasi met kip",
      ingredients: ["rice", "chicken", "stirFryVegetables"],
    },
    {
      sourceKey: "hotdogs",
      recipeName: "Hamburger met friet",
      ingredients: ["hamburgers", "hamburgerbroodjes", "fries"],
    },
  ])("wijst een duidelijk ander gerecht generiek af: $recipeName", (fixture) => {
    const base = contextForRecipe(fixture.sourceKey);
    const context: RecipeImageContext = {
      ...base,
      recipeName: fixture.recipeName,
      ingredients: fixture.ingredients.map((sourceKey, position) => {
        const ingredient = ingredientsBySourceKey.get(sourceKey);
        return {
          sourceKey,
          name: ingredient?.name ?? sourceKey,
          category: ingredient?.category ?? null,
          position,
        };
      }),
    };

    expect(evaluateRecipeImageQuality(context)).toMatchObject({
      status: "mismatch",
      accepted: false,
      fallbackNeeded: true,
    });
  });

  it("gebruikt voor een toekomstig recept zonder gecontroleerde mapping de nette placeholder", () => {
    const context: RecipeImageContext = {
      recipeSourceKey: "toekomstig-pastagerecht",
      recipeName: "Nieuwe pasta met groente",
      categories: ["pasta"],
      ingredients: [
        { sourceKey: "penne", name: "penne", category: "Pasta, rijst & granen", position: 0 },
        { sourceKey: "courgette", name: "courgette", category: "Groente", position: 1 },
      ],
    };

    expect(CATEGORY_FALLBACK_IMAGE_COUNT).toBe(0);
    expect(evaluateRecipeImageQuality(context)).toMatchObject({
      status: "missing",
      accepted: false,
      fallbackNeeded: true,
    });
    expect(recipeImageFor(context)).toBeNull();
  });
});
