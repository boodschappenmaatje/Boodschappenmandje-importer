import { describe, expect, it } from "vitest";

import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import {
  completeShoppingListFromWeek,
  addCatalogProduct,
  createEmptyActiveShoppingList,
  removeMealPlanContributionsForWeek,
} from "@/services/shopping-list/shopping-list";
import {
  commitExplicitRecipeChoice,
  commitManualProductChoice,
  findProductAlternatives,
  findRecipeAlternatives,
  listWithoutCurrentWeekMealPlan,
  previewManualProductChoice,
  replaceWeekProduct,
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
import {
  budgetOverrideReapprovalPreview,
  reapproveCurrentBudgetOverride,
  revalidatePreparedWeek,
} from "@/services/week-preparation/week-generation";
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
const BOOMSTAM = product("product-boomstam", "G'woon boomstammetjes", 699);
const LUXE_SPAGHETTI = product("product-luxe-spaghetti", "G'woon spaghetti luxe", 199);

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
  it("biedt actuele READY alternatieven uit dezelfde categorie met budgetstatus aan", async () => {
    const alternatives = await findRecipeAlternatives(
      await preparedWeek(), 0, recipeRepository, catalogRepository, list, NOW,
    );
    expect(alternatives.map((item) => item.recipe.id)).toEqual([
      MACARONI.id,
      PENNE.id,
      EXPENSIVE.id,
    ]);
    expect(alternatives[0]).toMatchObject({ withinMealBudget: true, alreadyUsedInWeek: false });
    expect(alternatives.map((item) => item.recipe.id)).not.toContain(SPAGHETTI.id);
    expect(alternatives.find((item) => item.recipe.id === EXPENSIVE.id))
      .toMatchObject({ withinMealBudget: false });
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

  it("scheidt een automatische blokkade van een expliciet gekozen receptalternatief", async () => {
    const original = await preparedWeek();
    await expect(
      replaceWeekRecipe(
        original, 0, EXPENSIVE.id, recipeRepository, catalogRepository, list, NOW,
      ),
    ).resolves.toEqual({ ok: false, reason: "over_meal_budget" });

    const cancelled = await commitExplicitRecipeChoice(
      original,
      0,
      EXPENSIVE.id,
      false,
      recipeRepository,
      catalogRepository,
      list,
      NOW,
    );
    expect(cancelled).toMatchObject({
      ok: false,
      reason: "budget_override_required",
      preview: { alternative: { withinMealBudget: false } },
    });
    expect(original.customizations).toEqual([]);

    const approved = await commitExplicitRecipeChoice(
      original,
      0,
      EXPENSIVE.id,
      true,
      recipeRepository,
      catalogRepository,
      list,
      NOW,
    );
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.preparation.customizations[0]).toMatchObject({
      replacementRecipe: { id: EXPENSIVE.id },
      recipeBudgetDecision: {
        mode: "userApprovedBudgetOverride",
        approvedMutation: {
          kind: "replaceRecipe",
          weekPreparationId: original.id,
          dayIndex: 0,
          recipeId: EXPENSIVE.id,
        },
      },
    });
    const validation = await revalidatePreparedWeek(
      approved.preparation,
      recipeRepository,
      catalogRepository,
      NOW,
      list,
    );
    expect(validation.ready).toBe(true);
    expect(validation.preparation.generation?.mealBudgetStatus)
      .toBe("overMealBudget");
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

  it("bevestigt een gerecht binnen budget tegen de lijst zonder oude weekbijdragen", async () => {
    const original = { ...await preparedWeek(), budgetCents: 300 };
    const completedOriginal = completeShoppingListFromWeek(
      createEmptyActiveShoppingList(NOW),
      original.ingredients,
      original.id,
      NOW,
    );
    const committed = await commitExplicitRecipeChoice(
      original,
      0,
      MACARONI.id,
      false,
      recipeRepository,
      catalogRepository,
      listWithoutCurrentWeekMealPlan(completedOriginal, original.id, NOW),
      NOW,
    );
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;

    const validated = await revalidatePreparedWeek(
      committed.preparation,
      recipeRepository,
      catalogRepository,
      NOW,
      listWithoutCurrentWeekMealPlan(completedOriginal, original.id, NOW),
    );
    expect(validated.ready).toBe(true);
    expect(validated.preparation.days[0].recipeId).toBe(MACARONI.id);

    const synchronized = completeShoppingListFromWeek(
      completedOriginal,
      validated.preparation.ingredients,
      validated.preparation.id,
      NOW,
    );
    expect(synchronized.items.some((item) => item.productId === "product-spaghetti"))
      .toBe(false);
    expect(synchronized.items.find((item) => item.productId === "product-macaroni"))
      .toMatchObject({ usedIn: [MACARONI.name] });
    expect(completeShoppingListFromWeek(
      synchronized,
      validated.preparation.ingredients,
      validated.preparation.id,
      NOW,
    )).toEqual(synchronized);
  });

  it("past een expliciet goedgekeurde gerechtoverschrijding na definitieve revalidatie toe", async () => {
    const original = await preparedWeek();
    const completedOriginal = completeShoppingListFromWeek(
      createEmptyActiveShoppingList(NOW),
      original.ingredients,
      original.id,
      NOW,
    );
    const baselineList = listWithoutCurrentWeekMealPlan(
      completedOriginal,
      original.id,
      NOW,
    );
    const committed = await commitExplicitRecipeChoice(
      original,
      0,
      EXPENSIVE.id,
      true,
      recipeRepository,
      catalogRepository,
      baselineList,
      NOW,
    );
    expect(committed.ok).toBe(true);
    if (!committed.ok) return;

    const withOldWeekStillCounted = await revalidatePreparedWeek(
      committed.preparation,
      recipeRepository,
      catalogRepository,
      NOW,
      completedOriginal,
    );
    expect(withOldWeekStillCounted.ready).toBe(false);

    const validated = await revalidatePreparedWeek(
      committed.preparation,
      recipeRepository,
      catalogRepository,
      NOW,
      baselineList,
    );
    expect(validated.ready).toBe(true);
    expect(validated.preparation.days[0].recipeId).toBe(EXPENSIVE.id);
    expect(validated.preparation.generation?.mealBudgetStatus)
      .toBe("overMealBudget");
    expect(validated.preparation.customizations[0].recipeBudgetDecision)
      .toMatchObject({
        mode: "userApprovedBudgetOverride",
        approvedMutation: {
          kind: "replaceRecipe",
          weekPreparationId: original.id,
          dayIndex: 0,
          recipeId: EXPENSIVE.id,
        },
      });
    const reopened = decodeStoredWeekPreparation(
      structuredClone(encodeStoredWeekPreparation(validated.preparation)),
    );
    expect(reopened?.days[0].recipeId).toBe(EXPENSIVE.id);
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
      schemaVersion: 6,
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

  it("houdt de harde budgetgrens voor automatische productvoorstellen intact", async () => {
    const automaticRepository = repositoryFor(() => [...products, BOOMSTAM]);
    const original = await preparedWeek();
    const alternatives = await findProductAlternatives(
      original,
      0,
      "ingredient-spaghetti",
      recipeRepository,
      automaticRepository,
      list,
      NOW,
    );
    expect(alternatives.some((item) => item.product.id === BOOMSTAM.id)).toBe(false);

    const semanticButExpensive = product(
      "product-expensive-spaghetti",
      "G'woon spaghetti voordeel",
      699,
    );
    const expensiveRepository = repositoryFor(() => [...products, semanticButExpensive]);
    const expensiveAlternatives = await findProductAlternatives(
      original,
      0,
      "ingredient-spaghetti",
      recipeRepository,
      expensiveRepository,
      list,
      NOW,
    );
    expect(expensiveAlternatives.find((item) => item.product.id === semanticButExpensive.id))
      .toMatchObject({ withinMealBudget: false });
    await expect(
      replaceWeekProduct(
        original,
        0,
        "ingredient-spaghetti",
        semanticButExpensive.id,
        recipeRepository,
        expensiveRepository,
        list,
        NOW,
      ),
    ).resolves.toEqual({ ok: false, reason: "over_meal_budget" });
  });

  it("behandelt een aangetikt automatisch voorstel als expliciete gebruikerskeuze", async () => {
    const original = await preparedWeek();
    const semanticButExpensive = product(
      "product-expensive-spaghetti-explicit",
      "G'woon spaghetti voordeel",
      799,
    );
    const choice = {
      action: "replaceIngredient" as const,
      dayIndex: 0,
      ingredientId: "ingredient-spaghetti",
      productId: semanticButExpensive.id,
      quantity: 1,
      selectionSource: "automaticSuggestion" as const,
    };
    const cancelled = commitManualProductChoice(
      original,
      choice,
      semanticButExpensive,
      false,
      list,
      NOW,
    );
    expect(cancelled).toMatchObject({
      ok: false,
      reason: "budget_override_required",
    });
    expect(original.customizations).toEqual([]);

    const approved = commitManualProductChoice(
      original,
      choice,
      semanticButExpensive,
      true,
      list,
      NOW,
    );
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.preparation.customizations[0].productOverrides[0])
      .toMatchObject({
        selectionSource: "automaticSuggestion",
        applicationMode: "explicitUserChoice",
        budgetDecision: {
          mode: "userApprovedBudgetOverride",
          approvedMutation: {
            kind: "replaceIngredient",
            weekPreparationId: original.id,
            dayIndex: 0,
            ingredientId: "ingredient-spaghetti",
            productId: semanticButExpensive.id,
            quantity: 1,
          },
        },
      });
    const validation = await revalidatePreparedWeek(
      approved.preparation,
      recipeRepository,
      repositoryFor(() => [...products, semanticButExpensive]),
      NOW,
      list,
    );
    expect(validation.ready).toBe(true);
    expect(validation.preparation.status).toBe("generated");
    expect(validation.preparation.generation?.mealBudgetStatus)
      .toBe("overMealBudget");
    expect(budgetOverrideReapprovalPreview(validation.preparation)).toBeNull();
    const completed = completeShoppingListFromWeek(
      list,
      validation.preparation.ingredients,
      validation.preparation.id,
      NOW,
    );
    expect(completeShoppingListFromWeek(
      completed,
      validation.preparation.ingredients,
      validation.preparation.id,
      NOW,
    )).toEqual(completed);
    const secondValidation = await revalidatePreparedWeek(
      validation.preparation,
      recipeRepository,
      repositoryFor(() => [...products, semanticButExpensive]),
      NOW,
      completed,
    );
    expect(secondValidation.ready).toBe(true);
    expect(budgetOverrideReapprovalPreview(secondValidation.preparation))
      .toBeNull();
  });

  it("berekent exacte dubbele budgetimpact en vereist expliciete toestemming boven budget", async () => {
    const original = { ...await preparedWeek(), budgetCents: 700 };
    const snapshot = structuredClone(original);
    const choice = {
      action: "replaceIngredient" as const,
      dayIndex: 0,
      ingredientId: "ingredient-spaghetti",
      productId: BOOMSTAM.id,
      quantity: 1,
      selectionSource: "manualSearch" as const,
    };
    const preview = previewManualProductChoice(original, choice, BOOMSTAM, list, NOW);
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;
    expect(preview.preview.impact).toMatchObject({
      currentMealPlanCostCents: 248,
      nextMealPlanCostCents: 798,
      mealPlanDifferenceCents: 550,
      mealBudgetOverageCents: 298,
      currentTotalWeekCostCents: 248,
      nextTotalWeekCostCents: 798,
      totalWeekDifferenceCents: 550,
      weekBudgetOverageCents: 98,
      requiresBudgetOverride: true,
    });
    expect(original).toEqual(snapshot);

    const cancelled = commitManualProductChoice(
      original,
      choice,
      BOOMSTAM,
      false,
      list,
      NOW,
    );
    expect(cancelled).toMatchObject({ ok: false, reason: "budget_override_required" });
    expect(original).toEqual(snapshot);

    const approved = commitManualProductChoice(
      original,
      choice,
      BOOMSTAM,
      true,
      list,
      NOW,
    );
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    expect(approved.preparation.customizations[0].productOverrides[0])
      .toMatchObject({
        selectionSource: "manualSearch",
        applicationMode: "explicitUserChoice",
        quantity: 1,
        budgetDecision: {
          mode: "userApprovedBudgetOverride",
          approvedMealPlanCostCents: 798,
          approvedTotalWeekCostCents: 798,
          approvedMutation: {
            kind: "replaceIngredient",
            weekPreparationId: original.id,
            dayIndex: 0,
            ingredientId: "ingredient-spaghetti",
            productId: BOOMSTAM.id,
            quantity: 1,
          },
        },
      });
  });

  it("staat een bewuste inhoudelijk andere keuze toe en rapporteert goedkoper of duurder binnen budget", async () => {
    const original = await preparedWeek();
    const unrelatedChoice = {
      action: "replaceIngredient" as const,
      dayIndex: 0,
      ingredientId: "ingredient-spaghetti",
      productId: "product-rice",
      quantity: 1,
      selectionSource: "manualSearch" as const,
    };
    const cheaper = commitManualProductChoice(
      original,
      unrelatedChoice,
      products.find((item) => item.id === "product-rice")!,
      false,
      list,
      NOW,
    );
    expect(cheaper.ok).toBe(true);
    if (!cheaper.ok) return;
    expect(cheaper.impact).toMatchObject({
      mealPlanDifferenceCents: -30,
      nextMealPlanCostCents: 218,
      requiresBudgetOverride: false,
    });
    expect(cheaper.preparation.ingredients.find(
      (item) => item.ingredientId === "ingredient-spaghetti",
    )?.product?.productId).toBe("product-rice");

    const dearer = previewManualProductChoice(
      original,
      { ...unrelatedChoice, productId: LUXE_SPAGHETTI.id },
      LUXE_SPAGHETTI,
      list,
      NOW,
    );
    expect(dearer.ok && dearer.preview.impact).toMatchObject({
      mealPlanDifferenceCents: 50,
      nextMealPlanCostCents: 298,
      mealBudgetOverageCents: 0,
      requiresBudgetOverride: false,
    });
  });

  it("voegt een vrij product met quantity en typed provenance aan het gerecht en de lijst toe", async () => {
    const original = { ...await preparedWeek(), mealBudgetCents: 2_000 };
    const result = commitManualProductChoice(
      original,
      {
        action: "addToMeal",
        dayIndex: 0,
        ingredientId: null,
        productId: BOOMSTAM.id,
        quantity: 2,
        selectionSource: "manualSearch",
      },
      BOOMSTAM,
      false,
      list,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preparation.customizations[0].manualProductAdditions[0])
      .toMatchObject({
        id: `manual-addition:0:${BOOMSTAM.id}`,
        quantity: 2,
        budgetDecision: { mode: "userConfirmedManualChoice" },
      });
    expect(result.preparation.ingredients.find(
      (item) => item.ingredientId === `manual-addition:0:${BOOMSTAM.id}`,
    )).toMatchObject({
      purchaseQuantity: 2,
      product: { productId: BOOMSTAM.id },
      usedIn: [{ recipeId: SPAGHETTI.id, recipeName: SPAGHETTI.name, dayIndex: 0 }],
    });
    const synchronized = completeShoppingListFromWeek(
      list,
      result.preparation.ingredients,
      result.preparation.id,
      NOW,
    );
    expect(synchronized.items.find((item) => item.productId === BOOMSTAM.id))
      .toMatchObject({
        quantity: 2,
        usedIn: [SPAGHETTI.name],
        quantityContributions: {
          persistentQuantity: 0,
          mealPlans: [{ weekPreparationId: original.id, quantity: 2 }],
        },
      });
    const reopened = decodeStoredWeekPreparation(
      structuredClone(encodeStoredWeekPreparation(result.preparation)),
    );
    expect(reopened?.customizations[0].manualProductAdditions[0])
      .toMatchObject({ quantity: 2, product: { productId: BOOMSTAM.id } });
    const validation = await revalidatePreparedWeek(
      reopened!,
      recipeRepository,
      repositoryFor(() => [...products, BOOMSTAM]),
      NOW,
      list,
    );
    expect(validation.ready).toBe(true);
    expect(validation.preparation.ingredients.find(
      (item) => item.ingredientId === `manual-addition:0:${BOOMSTAM.id}`,
    )).toMatchObject({ purchaseQuantity: 2, usedIn: [{ dayIndex: 0 }] });
  });

  it("synchroniseert handmatige vervanging idempotent en behoudt mixed manual/mealPlan", async () => {
    const original = { ...await preparedWeek(), mealBudgetCents: 2_000 };
    const manualList = addCatalogProduct(
      createEmptyActiveShoppingList(NOW),
      BOOMSTAM,
      "manual",
      NOW,
    );
    const completedOriginal = completeShoppingListFromWeek(
      manualList,
      original.ingredients,
      original.id,
      NOW,
    );
    const result = commitManualProductChoice(
      original,
      {
        action: "replaceIngredient",
        dayIndex: 0,
        ingredientId: "ingredient-spaghetti",
        productId: BOOMSTAM.id,
        quantity: 1,
        selectionSource: "manualSearch",
      },
      BOOMSTAM,
      false,
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
    expect(synchronized.items.find((item) => item.productId === BOOMSTAM.id))
      .toMatchObject({
        quantity: 2,
        sources: ["manual", "weekPreparation", "recipe"],
        usedIn: [SPAGHETTI.name],
        quantityContributions: {
          persistentQuantity: 1,
          mealPlans: [{ weekPreparationId: original.id, quantity: 1 }],
        },
      });
    expect(completeShoppingListFromWeek(
      synchronized,
      result.preparation.ingredients,
      result.preparation.id,
      NOW,
    )).toEqual(synchronized);

    const cleaned = removeMealPlanContributionsForWeek(
      synchronized,
      original.id,
      NOW,
    );
    expect(cleaned.items.find((item) => item.productId === BOOMSTAM.id))
      .toMatchObject({
        quantity: 1,
        sources: ["manual"],
        usedIn: [],
        quantityContributions: { persistentQuantity: 1, mealPlans: [] },
      });
    expect(cleaned.items.some((item) => item.productId === "product-tomato"))
      .toBe(false);
  });

  it("bewaart handmatige quantity, usedIn en budgettoestemming bij heropenen en revalidatie", async () => {
    const original = await preparedWeek();
    const result = commitManualProductChoice(
      original,
      {
        action: "replaceIngredient",
        dayIndex: 0,
        ingredientId: "ingredient-spaghetti",
        productId: BOOMSTAM.id,
        quantity: 2,
        selectionSource: "manualSearch",
      },
      BOOMSTAM,
      true,
      list,
      NOW,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const reopened = decodeStoredWeekPreparation(
      structuredClone(encodeStoredWeekPreparation(result.preparation)),
    );
    expect(reopened?.customizations[0].productOverrides[0]).toMatchObject({
      quantity: 2,
      selectionSource: "manualSearch",
      applicationMode: "explicitUserChoice",
      budgetDecision: { mode: "userApprovedBudgetOverride" },
    });
    const liveRepository = repositoryFor(() => [...products, BOOMSTAM]);
    const validation = await revalidatePreparedWeek(
      reopened!,
      recipeRepository,
      liveRepository,
      NOW,
      list,
    );
    expect(validation.ready).toBe(true);
    expect(validation.preparation.status).toBe("generated");
    expect(validation.preparation.ingredients.find(
      (item) => item.ingredientId === "ingredient-spaghetti",
    )).toMatchObject({
      purchaseQuantity: 2,
      product: { productId: BOOMSTAM.id },
      usedIn: [{ dayIndex: 0, requiredQuantity: 2 }],
    });

    const changedPrice = product(
      BOOMSTAM.id,
      BOOMSTAM.name,
      799,
    );
    const refreshed = await revalidatePreparedWeek(
      validation.preparation,
      recipeRepository,
      repositoryFor(() => [...products, changedPrice]),
      NOW,
      list,
    );
    expect(refreshed.ready).toBe(false);
    expect(refreshed.preparation.generation).toMatchObject({
      mealPlanKnownCostCents: 1_697,
      mealBudgetStatus: "overMealBudget",
    });
    const reapproval = budgetOverrideReapprovalPreview(refreshed.preparation);
    expect(reapproval).toMatchObject({
      mutation: { quantity: 2, productId: BOOMSTAM.id },
      previouslyApprovedMealPlanCostCents: 1_497,
      currentMealPlanCostCents: 1_697,
      mealPlanDifferenceCents: 200,
    });
    const reapproved = reapproveCurrentBudgetOverride(
      refreshed.preparation,
      reapproval!,
      new Date("2026-09-17T12:05:00Z"),
    );
    expect(reapproved).not.toBeNull();
    const afterReapproval = await revalidatePreparedWeek(
      reapproved!,
      recipeRepository,
      repositoryFor(() => [...products, changedPrice]),
      NOW,
      list,
    );
    expect(afterReapproval.ready).toBe(true);

    const unavailable = await revalidatePreparedWeek(
      validation.preparation,
      recipeRepository,
      repositoryFor(() => [
        ...products,
        { ...BOOMSTAM, isAvailable: false },
      ]),
      NOW,
      list,
    );
    expect(unavailable.ready).toBe(false);
    expect(unavailable.preparation.ingredients.find(
      (item) => item.ingredientId === "ingredient-spaghetti",
    )).toMatchObject({ product: null, productMatchMissing: true });
  });

  it("laat een goedkeuring voor één verpakking niet vijf verpakkingen goedkeuren", async () => {
    const original = await preparedWeek();
    const approved = commitManualProductChoice(
      original,
      {
        action: "replaceIngredient",
        dayIndex: 0,
        ingredientId: "ingredient-spaghetti",
        productId: BOOMSTAM.id,
        quantity: 1,
        selectionSource: "manualSearch",
      },
      BOOMSTAM,
      true,
      list,
      NOW,
    );
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;
    const quantityChanged = structuredClone(approved.preparation);
    quantityChanged.customizations[0].productOverrides[0].quantity = 5;

    const validation = await revalidatePreparedWeek(
      quantityChanged,
      recipeRepository,
      repositoryFor(() => [...products, BOOMSTAM]),
      NOW,
      list,
    );
    expect(validation.ready).toBe(false);
    expect(validation.preparation.generation).toMatchObject({
      mealPlanKnownCostCents: 3_594,
      mealBudgetStatus: "overMealBudget",
    });
    expect(budgetOverrideReapprovalPreview(validation.preparation))
      .toMatchObject({
        mutation: {
          kind: "replaceIngredient",
          productId: BOOMSTAM.id,
          quantity: 5,
        },
      });
  });

  it("weigert handmatige gerechtproducten voor Vrije keuze zonder mutatie", async () => {
    const original = await preparedWeek();
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
    const snapshot = structuredClone(freeChoice);
    expect(previewManualProductChoice(
      freeChoice,
      {
        action: "addToMeal",
        dayIndex: 0,
        ingredientId: null,
        productId: BOOMSTAM.id,
        quantity: 1,
        selectionSource: "manualSearch",
      },
      BOOMSTAM,
      list,
      NOW,
    )).toEqual({ ok: false, reason: "day_not_found" });
    expect(freeChoice).toEqual(snapshot);
  });
});
