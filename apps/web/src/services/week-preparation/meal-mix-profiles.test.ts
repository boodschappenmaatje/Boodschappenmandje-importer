import { describe, expect, it } from "vitest";

import ingredientSource from "../../../../../data/ingredients.json";
import recipeSource from "../../../../../data/recipes.json";
import {
  MEAL_MIX_PROFILES,
  enrichIngredientsForMealMixes,
  inferMealMixBrand,
  mealMixProfileForRecipe,
} from "@/services/week-preparation/meal-mix-profiles";
import { aggregateWeekIngredients } from "@/services/week-preparation/ingredient-aggregation";
import {
  applyProductToRequirement,
  combinedProductPurchaseQuantity,
  isReliableIngredientMatch,
  productPackageCapacity,
  selectIngredientProduct,
} from "@/services/week-preparation/product-matching";
import { calculateDishCostSummary } from "@/services/week-preparation/week-generation";
import type { RecipeCatalog, RecipeIngredientDefinition } from "@/services/week-preparation/recipe-repository";
import type { Product, Recipe } from "@/types/catalog";
import type { WeekIngredientRequirement } from "@/types/week-preparation";

const NOW = "2026-09-15T12:00:00.000Z";

function product(input: Partial<Product> & Pick<Product, "id" | "sku" | "name">): Product {
  return {
    supermarket: "Hoogvliet",
    brand: null,
    category: "Maaltijdmixen",
    productType: "Maaltijdpakket",
    packageText: null,
    weightGrams: null,
    imageUrl: "https://cdn.hoogvliet.com/product.webp",
    sourceUrl: `https://www.hoogvliet.com/product/${input.sku}`,
    isAvailable: true,
    updatedAt: NOW,
    currentPrice: null,
    ...input,
  };
}

function requirement(
  requiredQuantity: number,
  unit: WeekIngredientRequirement["unit"],
): WeekIngredientRequirement {
  return {
    ingredientId: "ingredient",
    sourceKey: "ingredient",
    name: "ingrediënt",
    unit,
    optional: false,
    servingsBase: 1,
    kind: "ingredient",
    brandConstraint: null,
    requiredQuantity,
    purchaseQuantity: null,
    packageCapacity: null,
    usedIn: [{
      recipeId: "recipe",
      recipeName: "Gerecht",
      dayIndex: 0,
      requiredQuantity,
    }],
    product: null,
    price: null,
    productMatchMissing: false,
    packageCalculationMissing: false,
  };
}

describe("merkgebonden maaltijdmixprofielen", () => {
  it("bevat acht Knorr- en twee Honig-profielen met gevalideerde bron", () => {
    expect(MEAL_MIX_PROFILES).toHaveLength(10);
    expect(MEAL_MIX_PROFILES.filter((item) => item.brand === "Knorr")).toHaveLength(8);
    expect(MEAL_MIX_PROFILES.filter((item) => item.brand === "Honig")).toHaveLength(2);
    expect(MEAL_MIX_PROFILES.every((item) => item.verificationStatus === "verified")).toBe(true);
    expect(MEAL_MIX_PROFILES.every((item) => item.sourceUrl.startsWith("https://"))).toBe(true);
    const recipeKeys = new Set(recipeSource.recipes.map((item) => item.sourceKey));
    const ingredientKeys = new Set(ingredientSource.ingredients.map((item) => item.sourceKey));
    expect(MEAL_MIX_PROFILES.every((item) => recipeKeys.has(item.recipeSourceKey))).toBe(true);
    expect(MEAL_MIX_PROFILES.every((item) => ingredientKeys.has(item.productIngredientSourceKey))).toBe(true);
  });

  it.each([
    [2, 1, 150],
    [4, 2, 300],
    [6, 2, 450],
  ])("schaalt Knorr-lasagne voor %i personen", (people, packages, beefGrams) => {
    const recipe: Recipe = {
      id: "recipe-lasagne",
      sourceKey: "knorr-lasagne-bolognese",
      name: "Knorr Italiaanse lasagne bolognese",
      normalizedName: "knorr italiaanse lasagne bolognese",
      symbol: "fork.knife",
      preparationMinutes: 50,
      vegetarian: false,
      containsPork: false,
      kidFriendly: true,
      healthy: false,
      budgetTier: "standard",
    };
    const ingredients = enrichIngredientsForMealMixes([{
      id: "mix-lasagne",
      sourceKey: "knorrLasagne",
      name: "Knorr Wereldgerechten Italiaanse Lasagne Bolognese",
      normalizedName: "knorr wereldgerechten italiaanse lasagne bolognese",
      defaultUnit: "grams",
      category: "Maaltijdcomponenten",
      aliases: [],
    }]);
    const catalog: RecipeCatalog = { recipes: [recipe], ingredients, relations: [] };
    const result = aggregateWeekIngredients([{
      dayIndex: 0,
      category: "pasta",
      freeChoice: false,
      recipeId: recipe.id,
      recipe: { id: recipe.id, sourceKey: recipe.sourceKey, name: recipe.name },
      status: "recipeSelected",
    }], people, catalog);

    expect(result.filter((item) => item.kind === "mealMix")).toHaveLength(1);
    expect(result.find((item) => item.kind === "mealMix")).toMatchObject({
      requiredQuantity: packages,
      unit: "piece",
      brandConstraint: "Knorr",
    });
    expect(result.find((item) => item.sourceKey === "groundBeef")?.requiredQuantity).toBe(beefGrams);
    expect(result.find((item) => item.sourceKey === "magereMelk")?.requiredQuantity).toBeCloseTo(
      (400 * people) / 3,
      2,
    );
  });

  it("voegt dezelfde maaltijdmix over twee dagen één keer samen met twee echte relaties", () => {
    const profile = mealMixProfileForRecipe("knorr-lasagne-bolognese")!;
    const recipe: Recipe = {
      id: "recipe-lasagne",
      sourceKey: profile.recipeSourceKey,
      name: "Knorr Italiaanse lasagne bolognese",
      normalizedName: "knorr italiaanse lasagne bolognese",
      symbol: "fork.knife",
      preparationMinutes: 50,
      vegetarian: false,
      containsPork: false,
      kidFriendly: true,
      healthy: false,
      budgetTier: "standard",
    };
    const ingredients = enrichIngredientsForMealMixes([{
      id: "mix-lasagne",
      sourceKey: profile.productIngredientSourceKey,
      name: profile.productName,
      normalizedName: profile.productName.toLocaleLowerCase("nl-NL"),
      defaultUnit: "grams",
      category: "Maaltijdcomponenten",
      aliases: [],
    }]);
    const days = [0, 1].map((dayIndex) => ({
      dayIndex,
      category: "pasta" as const,
      freeChoice: false,
      recipeId: recipe.id,
      recipe: { id: recipe.id, sourceKey: recipe.sourceKey, name: recipe.name },
      status: "recipeSelected" as const,
    }));
    const result = aggregateWeekIngredients(
      days,
      3,
      { recipes: [recipe], ingredients, relations: [] },
    );
    const mixes = result.filter((item) => item.kind === "mealMix");

    expect(mixes).toHaveLength(1);
    expect(mixes[0].requiredQuantity).toBe(2);
    expect(mixes[0].usedIn).toHaveLength(2);
    expect(mixes[0].usedIn.map((item) => item.dayIndex)).toEqual([0, 1]);
  });

  it("houdt Knorr en Honig ook voor toekomstige catalogusproducten strikt gescheiden", () => {
    const knorrIngredient: RecipeIngredientDefinition = {
      id: "future-knorr",
      sourceKey: "futureKnorrSpaghetti",
      name: "Knorr Mix voor Spaghetti Bolognese",
      normalizedName: "knorr mix voor spaghetti bolognese",
      defaultUnit: "grams",
      category: "Maaltijdcomponenten",
      aliases: ["Knorr Mix voor Spaghetti Bolognese"],
    };
    const honigIngredient: RecipeIngredientDefinition = {
      ...knorrIngredient,
      id: "future-honig",
      sourceKey: "futureHonigSpaghetti",
      name: "Honig Mix voor Spaghetti Bolognese",
      normalizedName: "honig mix voor spaghetti bolognese",
      aliases: ["Honig Mix voor Spaghetti Bolognese"],
    };
    const knorr = product({
      id: "knorr-product",
      sku: "knorr-sku",
      name: "Knorr Mix voor Spaghetti Bolognese",
      brand: "Knorr",
    });
    const honig = product({
      id: "honig-product",
      sku: "honig-sku",
      name: "Honig Mix voor Spaghetti Bolognese",
      brand: "Honig",
    });

    expect(inferMealMixBrand(knorrIngredient)).toBe("Knorr");
    expect(inferMealMixBrand(honigIngredient)).toBe("Honig");
    expect(isReliableIngredientMatch(knorrIngredient, honig)).toBe(false);
    expect(isReliableIngredientMatch(honigIngredient, knorr)).toBe(false);
    expect(selectIngredientProduct(knorrIngredient, [honig, knorr])?.id).toBe(knorr.id);
    expect(selectIngredientProduct(honigIngredient, [knorr, honig])?.id).toBe(honig.id);
  });

  it("berekent massa en inhoud steeds naar boven en mengt dimensies niet", () => {
    const pack200 = product({ id: "g200", sku: "g200", name: "Product 200 gram", packageText: "200 gram" });
    const pack500 = product({ id: "g500", sku: "g500", name: "Product 500 g", packageText: "500 g" });
    const bottle = product({ id: "l1", sku: "l1", name: "Product 1 liter", packageText: "1 liter" });
    const pieces = product({ id: "pieces", sku: "pieces", name: "Product 8 stuks", packageText: "8 stuks" });
    const multipack = product({
      id: "multipack",
      sku: "multipack",
      name: "Product voordeelpak",
      packageText: "2 x 200 g",
      weightGrams: 200,
    });

    expect(applyProductToRequirement(requirement(190, "g"), pack200).purchaseQuantity).toBe(1);
    expect(applyProductToRequirement(requirement(700, "g"), pack500).purchaseQuantity).toBe(2);
    expect(applyProductToRequirement(requirement(500, "ml"), bottle).purchaseQuantity).toBe(1);
    expect(applyProductToRequirement(requirement(1500, "ml"), bottle).purchaseQuantity).toBe(2);
    expect(applyProductToRequirement(requirement(192, "g"), product({
      id: "g192",
      sku: "g192",
      name: "Product 192 g",
      packageText: "192 g",
    })).purchaseQuantity).toBe(1);
    expect(applyProductToRequirement(requirement(400, "g"), product({
      id: "g400",
      sku: "g400",
      name: "Product 400 g",
      packageText: "400 g",
    })).purchaseQuantity).toBe(1);
    expect(productPackageCapacity(pieces, "g")).toBeNull();
    expect(productPackageCapacity(multipack, "g")).toBe(400);
  });

  it("rekent twee canonieke regels voor hetzelfde echte product als één gezamenlijke behoefte", () => {
    const pack = product({
      id: "shared-beef",
      sku: "shared-beef",
      name: "Rundergehakt 500 g",
      packageText: "500 g",
    });
    const first = applyProductToRequirement(requirement(300, "g"), pack);
    const second = applyProductToRequirement({
      ...requirement(700, "g"),
      ingredientId: "ingredient-alias",
      sourceKey: "groundBeefAlias",
    }, pack);

    expect(first.purchaseQuantity).toBe(1);
    expect(second.purchaseQuantity).toBe(2);
    expect(combinedProductPurchaseQuantity([first, second])).toBe(2);
  });

  it("maakt complete en gedeeltelijke dagkosten expliciet", () => {
    const priced = applyProductToRequirement(
      requirement(700, "g"),
      product({
        id: "beef",
        sku: "beef",
        name: "Rundergehakt 500 g",
        packageText: "500 g",
        currentPrice: {
          productId: "beef",
          price: 4.49,
          oldPrice: null,
          isOffer: false,
          offerText: null,
          validFrom: null,
          validUntil: null,
          fetchedAt: NOW,
          updatedAt: NOW,
        },
      }),
    );
    expect(calculateDishCostSummary(0, [priced])).toEqual({
      knownCostCents: 898,
      missingProductCount: 0,
      complete: true,
    });
    expect(calculateDishCostSummary(0, [priced, requirement(1, "piece")])).toEqual({
      knownCostCents: 898,
      missingProductCount: 1,
      complete: false,
    });
  });

  it("presenteert de mix als product naast een consumentvriendelijke gerechtnaam", () => {
    expect(mealMixProfileForRecipe("knorr-lasagne-bolognese")).toMatchObject({
      dishName: "Lasagne bolognese",
      productName: "Knorr Wereldgerechten Italiaanse Lasagne Bolognese",
      brand: "Knorr",
    });
  });
});
