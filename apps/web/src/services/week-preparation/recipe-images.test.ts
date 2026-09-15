import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import {
  CATEGORY_FALLBACK_IMAGE_COUNT,
  CATEGORY_IMAGE_KEYS,
  DISH_IMAGE_KEYS,
  RECIPE_IMAGE_KEYS,
  SPECIFIC_RECIPE_IMAGE_COUNT,
  recipeImageFor,
} from "@/services/week-preparation/recipe-images";

interface RecipeData {
  recipes: Array<{ sourceKey: string; name: string }>;
}

const recipeData = JSON.parse(
  readFileSync(new URL("../../../../../data/recipes.json", import.meta.url), "utf8"),
) as RecipeData;

describe("gecontroleerde gerechtafbeeldingen", () => {
  it("heeft voor alle 100 bestaande recepten een expliciete typed mapping", () => {
    expect(recipeData.recipes).toHaveLength(100);
    expect(SPECIFIC_RECIPE_IMAGE_COUNT).toBe(100);
    expect(recipeData.recipes.filter(({ sourceKey }) => !RECIPE_IMAGE_KEYS[sourceKey as keyof typeof RECIPE_IMAGE_KEYS])).toEqual([]);
  });

  it("verwijst uitsluitend naar aanwezige geoptimaliseerde WebP-assets", () => {
    for (const key of DISH_IMAGE_KEYS) {
      expect(
        existsSync(new URL(`../../../public/images/dishes/${key}.webp`, import.meta.url)),
        key,
      ).toBe(true);
    }
  });

  it("biedt zeven categorie-fallbacks voor toekomstige recepten", () => {
    expect(CATEGORY_FALLBACK_IMAGE_COUNT).toBe(7);
    expect(Object.keys(CATEGORY_IMAGE_KEYS).toSorted()).toEqual([
      "comfort",
      "dutch",
      "healthy",
      "pasta",
      "quick",
      "rice",
      "vegetarian",
    ]);
    expect(recipeImageFor("toekomstig-pastagerecht", "pasta")).toMatchObject({
      key: "pasta-spaghetti-bolognese",
      source: "category",
    });
  });

  it("gebruikt de BoodschappenMaatje-placeholder pas na recipe en categorie", () => {
    expect(recipeImageFor("spaghetti-bolognese", "pasta")).toMatchObject({
      key: "pasta-spaghetti-bolognese",
      source: "recipe",
    });
    expect(recipeImageFor(null, "freeChoice")).toBeNull();
  });
});
