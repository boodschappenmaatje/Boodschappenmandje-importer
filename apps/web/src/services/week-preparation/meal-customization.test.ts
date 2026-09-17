import { describe, expect, it } from "vitest";

import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import {
  completeShoppingListFromWeek,
  addCatalogProduct,
  createEmptyActiveShoppingList,
} from "@/services/shopping-list/shopping-list";
import {
  findRecipeAlternatives,
  replaceWeekRecipe,
} from "@/services/week-preparation/meal-customization";
import {
  decodeStoredWeekPreparation,
  encodeStoredWeekPreparation,
} from "@/services/week-preparation/indexeddb-storage";
import type {
  RecipeCatalog,
  RecipeRepository,
} from "@/services/week-preparation/recipe-repository";
import { revalidatePreparedWeek } from "@/services/week-preparation/week-generation";
import { createWeekPreparation } from "@/services/week-preparation/week-preparation";
import type { Product, Recipe } from "@/types/catalog";
import type { ActiveShoppingList } from "@/types/shopping-list";

const NOW = new Date("2026-09-17T12:00:00Z");
const recipe = (id: string, sourceKey: string, name: string): Recipe => ({
  id,
  sourceKey,
  name,
  normalizedName: name.toLocaleLowerCase("nl-NL"),
  symbol: "fork.knife",
  preparationMinutes: 20,
  vegetarian: false,
  containsPork: false,
  kidFriendly: true,
  healthy: false,
  budgetTier: "economical",
});
const SPAGHETTI = recipe("recipe-spaghetti", "spaghetti", "Spaghetti bolognese");
const MACARONI = recipe("recipe-macaroni", "macaroni", "Macaroni met groente");
const PENNE = recipe("recipe-penne", "penne", "Penne met groente");
const EXPENSIVE = recipe("recipe-expensive", "pasta-premium", "Pasta premium");
const RICE = recipe("recipe-rice", "rijst-groente", "Rijst met groente");
const NOT_READY = recipe("recipe-lasagne", "lasagne", "Lasagne zonder product");

const catalog: RecipeCatalog = {
  recipes: [SPAGHETTI, MACARONI, PENNE, EXPENSIVE, RICE, NOT_READY],
  ingredients: [
    { id: "ingredient-spaghetti", sourceKey: "spaghetti", name: "spaghetti", normalizedName: "spaghetti", defaultUnit: "g", category: "Pasta, rijst & granen", aliases: ["spaghetti"] },
    { id: "ingredient-macaroni", sourceKey: "macaroni", name: "macaroni", normalizedName: "macaroni", defaultUnit: "g", category: "Pasta, rijst & granen", aliases: ["macaroni"] },
    { id: "ingredient-penne", sourceKey: "penne", name: "penne", normalizedName: "penne", defaultUnit: "g", category: "Pasta, rijst & granen", aliases: ["penne"] },
    { id: "ingredient-expensive", sourceKey: "premiumPasta", name: "premium pasta", normalizedName: "premium pasta", defaultUnit: "g", category: "Pasta, rijst & granen", aliases: ["premium pasta"] },
    { id: "ingredient-rice", sourceKey: "rice", name: "rijst", normalizedName: "rijst", defaultUnit: "g", category: "Pasta, rijst & granen", aliases: ["rijst"] },
    { id: "ingredient-tomato", sourceKey: "tomato", name: "tomaten", normalizedName: "tomaten", defaultUnit: "g", category: "Groente & fruit/Groente", aliases: ["tomaten"] },
    { id: "ingredient-lasagne", sourceKey: "lasagne", name: "lasagnebladen", normalizedName: "lasagnebladen", defaultUnit: "g", category: "Pasta, rijst & granen", aliases: ["lasagnebladen"] },
  ],
  relations: [
    { id: "relation-spaghetti", recipeId: SPAGHETTI.id, ingredientId: "ingredient-spaghetti", amountPerPerson: 100, unit: "g", position: 0 },
    { id: "relation-spaghetti-tomato", recipeId: SPAGHETTI.id, ingredientId: "ingredient-tomato", amountPerPerson: 100, unit: "g", position: 1 },
    { id: "relation-macaroni", recipeId: MACARONI.id, ingredientId: "ingredient-macaroni", amountPerPerson: 100, unit: "g", position: 0 },
    { id: "relation-macaroni-tomato", recipeId: MACARONI.id, ingredientId: "ingredient-tomato", amountPerPerson: 100, unit: "g", position: 1 },
    { id: "relation-penne", recipeId: PENNE.id, ingredientId: "ingredient-penne", amountPerPerson: 100, unit: "g", position: 0 },
    { id: "relation-penne-tomato", recipeId: PENNE.id, ingredientId: "ingredient-tomato", amountPerPerson: 100, unit: "g", position: 1 },
    { id: "relation-expensive", recipeId: EXPENSIVE.id, ingredientId: "ingredient-expensive", amountPerPerson: 100, unit: "g", position: 0 },
    { id: "relation-expensive-tomato", recipeId: EXPENSIVE.id, ingredientId: "ingredient-tomato", amountPerPerson: 100, unit: "g", position: 1 },
    { id: "relation-rice", recipeId: RICE.id, ingredientId: "ingredient-rice", amountPerPerson: 100, unit: "g", position: 0 },
    { id: "relation-lasagne", recipeId: NOT_READY.id, ingredientId: "ingredient-lasagne", amountPerPerson: 100, unit: "g", position: 0 },
  ],
};

function product(id: string, name: string, cents: number): Product {
  return {
    id,
    sku: `sku-${id}`,
    name,
    supermarket: "Hoogvliet",
    brand: "G'woon",
    category: "Pasta, rijst & granen/Pasta",
    productType: "Pasta",
    packageText: "500 g",
    weightGrams: 500,
    imageUrl: null,
    sourceUrl: `https://example.test/${id}`,
    isAvailable: true,
    updatedAt: NOW.toISOString(),
    currentPrice: {
      productId: id,
      price: cents / 100,
      oldPrice: null,
      isOffer: false,
      offerText: null,
      validFrom: null,
      validUntil: null,
      fetchedAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
    },
  };
}

const products = [
  product("product-spaghetti", "G'woon spaghetti", 149),
  product("product-macaroni", "G'woon macaroni", 129),
  product("product-penne", "G'woon penne", 139),
  product("product-expensive", "G'woon premium pasta", 699),
  product("product-rice", "G'woon rijst", 119),
  product("product-tomato", "G'woon tomaten", 99),
];

const recipeRepository: RecipeRepository = { async loadCatalog() { return catalog; } };
function repositoryFor(currentProducts: () => Product[] = () => products): CatalogRepository {
  return {
    async getPage() { return { products: currentProducts(), priceStatus: "complete", page: 1, pageSize: 20, hasMore: false }; },
    async getByIds(ids) { return { products: currentProducts().filter((item) => ids.includes(item.id)), priceStatus: "complete" }; },
    async query() { throw new Error("unused"); },
    async search(term) { return { products: currentProducts().filter((item) => item.name.toLowerCase().includes(term.toLowerCase())), priceStatus: "complete" }; },
    async getFilterOptions() { return { categories: [], brands: [] }; },
  };
}
const catalogRepository = repositoryFor();
const list: ActiveShoppingList = {
  schemaVersion: 2,
  startedAt: NOW.toISOString(),
  updatedAt: NOW.toISOString(),
  items: [],
};

async function preparedWeek() {
  const base = createWeekPreparation(
    { schemaVersion: 1, people: 4, days: 1, budgetCents: 10_000 },
    { knownSubtotalCents: 0, unpricedItemCount: 0 },
    NOW,
    "week-pwa12",
  );
  const selected = {
    ...base,
    mealBudgetCents: 500,
    days: [{
      dayIndex: 0,
      category: "pasta" as const,
      freeChoice: false,
      recipeId: SPAGHETTI.id,
      recipe: { id: SPAGHETTI.id, sourceKey: SPAGHETTI.sourceKey, name: SPAGHETTI.name },
      status: "recipeSelected" as const,
    }],
    status: "generated" as const,
  };
  return (await revalidatePreparedWeek(selected, recipeRepository, catalogRepository, NOW, list)).preparation;
}

describe("PWA 12 maaltijdcustomization", () => {
  it("biedt alleen actuele READY alternatieven uit dezelfde categorie aan", async () => {
    const alternatives = await findRecipeAlternatives(
      await preparedWeek(), 0, recipeRepository, catalogRepository, list, NOW,
    );
    expect(alternatives.map((item) => item.recipe.id)).toEqual([
      MACARONI.id,
      PENNE.id,
    ]);
    expect(alternatives[0]).toMatchObject({ withinMealBudget: true, alreadyUsedInWeek: false });
    expect(alternatives.map((item) => item.recipe.id)).not.toContain(SPAGHETTI.id);
    expect(alternatives.map((item) => item.recipe.id)).not.toContain(EXPENSIVE.id);
    expect(alternatives.map((item) => item.recipe.id)).not.toContain(RICE.id);
    expect(alternatives.map((item) => item.recipe.id)).not.toContain(NOT_READY.id);
  });

  it("vervangt atomair, bewaart de basisreferentie en herberekent integer-centkosten", async () => {
    const original = await preparedWeek();
    const result = await replaceWeekRecipe(
      original, 0, MACARONI.id, recipeRepository, catalogRepository, list, NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preparation.days[0].recipeId).toBe(MACARONI.id);
    expect(result.preparation.generation?.mealPlanKnownCostCents).toBe(228);
    expect(result.preparation.customizations[0]).toMatchObject({
      dayIndex: 0,
      baseRecipe: { id: SPAGHETTI.id },
      replacementRecipe: { id: MACARONI.id },
    });
  });

  it("weigert een NOT READY recept opnieuw vlak voor bevestiging", async () => {
    const result = await replaceWeekRecipe(
      await preparedWeek(), 0, NOT_READY.id, recipeRepository, catalogRepository, list, NOW,
    );
    expect(result).toEqual({ ok: false, reason: "recipe_not_ready" });
  });

  it("weigert een andere categorie en een READY gerecht boven het harde maaltijd-budget", async () => {
    const original = await preparedWeek();
    await expect(
      replaceWeekRecipe(
        original, 0, RICE.id, recipeRepository, catalogRepository, list, NOW,
      ),
    ).resolves.toEqual({ ok: false, reason: "wrong_category" });
    await expect(
      replaceWeekRecipe(
        original, 0, EXPENSIVE.id, recipeRepository, catalogRepository, list, NOW,
      ),
    ).resolves.toEqual({ ok: false, reason: "over_meal_budget" });
  });

  it("hervalidateert actuele prijzen bij bevestigen en weigert een stale alternatief", async () => {
    let liveProducts = products;
    const liveRepository = repositoryFor(() => liveProducts);
    const original = await preparedWeek();
    const shown = await findRecipeAlternatives(
      original, 0, recipeRepository, liveRepository, list, NOW,
    );
    expect(shown.map((item) => item.recipe.id)).toContain(MACARONI.id);

    liveProducts = products.map((item) =>
      item.id === "product-macaroni"
        ? product("product-macaroni", "G'woon macaroni", 799)
        : item,
    );
    await expect(
      replaceWeekRecipe(
        original, 0, MACARONI.id, recipeRepository, liveRepository, list, NOW,
      ),
    ).resolves.toEqual({ ok: false, reason: "over_meal_budget" });
  });

  it("behandelt annuleren als een no-op en laat Vrije keuze ongemoeid", async () => {
    const original = await preparedWeek();
    const snapshot = structuredClone(original);
    await findRecipeAlternatives(
      original, 0, recipeRepository, catalogRepository, list, NOW,
    );
    expect(original).toEqual(snapshot);

    const freeChoice = {
      ...original,
      days: [{
        dayIndex: 0,
        category: "freeChoice" as const,
        freeChoice: true,
        recipeId: null,
        recipe: null,
        status: "freeChoice" as const,
      }],
    };
    await expect(
      findRecipeAlternatives(
        freeChoice, 0, recipeRepository, catalogRepository, list, NOW,
      ),
    ).resolves.toEqual([]);
    await expect(
      replaceWeekRecipe(
        freeChoice, 0, MACARONI.id, recipeRepository, catalogRepository, list, NOW,
      ),
    ).resolves.toEqual({ ok: false, reason: "current_recipe_missing" });
  });

  it("rangschikt een nog niet gebruikt recipeId vóór een herhaling", async () => {
    const firstDay = await preparedWeek();
    const twoDays = {
      ...firstDay,
      numberOfDays: 2,
      mealBudgetCents: 1_000,
      days: [
        firstDay.days[0],
        {
          dayIndex: 1,
          category: "pasta" as const,
          freeChoice: false,
          recipeId: MACARONI.id,
          recipe: { id: MACARONI.id, sourceKey: MACARONI.sourceKey, name: MACARONI.name },
          status: "recipeSelected" as const,
        },
      ],
    };
    const revalidated = await revalidatePreparedWeek(
      twoDays, recipeRepository, catalogRepository, NOW, list,
    );
    const alternatives = await findRecipeAlternatives(
      revalidated.preparation,
      0,
      recipeRepository,
      catalogRepository,
      list,
      NOW,
    );
    expect(alternatives[0].recipe.id).toBe(PENNE.id);
    expect(alternatives.find((item) => item.recipe.id === MACARONI.id))
      .toMatchObject({ alreadyUsedInWeek: true });
  });

  it("synchroniseert alleen mealPlan-bijdragen en blijft idempotent", async () => {
    const original = await preparedWeek();
    const tomato = products.find((item) => item.id === "product-tomato")!;
    const manualList = addCatalogProduct(
      createEmptyActiveShoppingList(NOW), tomato, "manual", NOW,
    );
    const completedOriginal = completeShoppingListFromWeek(
      manualList, original.ingredients, original.id, NOW,
    );
    const result = await replaceWeekRecipe(
      original,
      0,
      MACARONI.id,
      recipeRepository,
      catalogRepository,
      completedOriginal,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const synchronized = completeShoppingListFromWeek(
      completedOriginal,
      result.preparation.ingredients,
      result.preparation.id,
      NOW,
    );
    expect(synchronized.items.some((item) => item.productId === "product-spaghetti"))
      .toBe(false);
    expect(synchronized.items.find((item) => item.productId === "product-macaroni"))
      .toMatchObject({
        quantity: 1,
        usedIn: [MACARONI.name],
        quantityContributions: {
          persistentQuantity: 0,
          mealPlans: [{ weekPreparationId: original.id, quantity: 1 }],
        },
      });
    expect(synchronized.items.find((item) => item.productId === "product-tomato"))
      .toMatchObject({
        quantity: 2,
        usedIn: [MACARONI.name],
        quantityContributions: {
          persistentQuantity: 1,
          mealPlans: [{ weekPreparationId: original.id, quantity: 1 }],
        },
      });
    expect(
      completeShoppingListFromWeek(
        synchronized,
        result.preparation.ingredients,
        result.preparation.id,
        NOW,
      ),
    ).toEqual(synchronized);
  });

  it("bewaart de vervanging bij sluiten en heropenen zonder het oude gerecht terug te zetten", async () => {
    const result = await replaceWeekRecipe(
      await preparedWeek(),
      0,
      MACARONI.id,
      recipeRepository,
      catalogRepository,
      list,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reopened = decodeStoredWeekPreparation(
      structuredClone(encodeStoredWeekPreparation(result.preparation)),
    );
    expect(reopened).toMatchObject({
      schemaVersion: 5,
      budgetCents: 10_000,
      mealBudgetCents: 500,
      days: [{ recipeId: MACARONI.id }],
      customizations: [{
        baseRecipe: { id: SPAGHETTI.id },
        replacementRecipe: { id: MACARONI.id },
      }],
    });
    expect(reopened?.days.some((day) => day.recipeId === SPAGHETTI.id)).toBe(false);
  });
});
