import { describe, expect, it } from "vitest";

import { calculateBudget } from "@/services/budget/budget-engine";
import { createWeekPreparation } from "@/services/week-preparation/week-preparation";
import type { Product } from "@/types/catalog";
import type { WeekIngredientRequirement } from "@/types/week-preparation";

import {
  addCatalogProduct,
  completeShoppingListFromWeek,
  createEmptyActiveShoppingList,
  removeMealPlanContributionsForWeek,
} from "./shopping-list";
import {
  decodeStoredActiveShoppingList,
  encodeStoredActiveShoppingList,
} from "./indexeddb-storage";

const NOW = new Date("2026-09-18T08:00:00Z");
const WEEK_A = "week-a";
const WEEK_B = "week-b";

function product(id: string, price = 2): Product {
  return {
    id,
    supermarket: "Hoogvliet",
    sku: `sku-${id}`,
    name: `Product ${id}`,
    brand: "Merk",
    category: "Categorie",
    productType: null,
    packageText: "500 g",
    weightGrams: 500,
    imageUrl: null,
    sourceUrl: `https://example.test/${id}`,
    isAvailable: true,
    updatedAt: NOW.toISOString(),
    currentPrice: {
      productId: id,
      price,
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

function requirement(
  item: Product,
  purchaseQuantity: number,
  recipeName = "Gerecht A",
): WeekIngredientRequirement {
  return {
    ingredientId: `ingredient-${item.id}`,
    sourceKey: item.id,
    name: item.name,
    unit: "g",
    optional: false,
    servingsBase: 1,
    kind: "ingredient",
    brandConstraint: null,
    requiredQuantity: purchaseQuantity * 500,
    purchaseQuantity,
    packageCapacity: 500,
    usedIn: [{
      recipeId: `recipe-${recipeName}`,
      recipeName,
      dayIndex: 0,
      requiredQuantity: purchaseQuantity * 500,
    }],
    product: {
      productId: item.id,
      sku: item.sku,
      name: item.name,
      brand: item.brand,
      packageText: item.packageText,
      imageUrl: item.imageUrl,
      supermarket: item.supermarket,
      sourceUrl: item.sourceUrl,
    },
    price: {
      amountCents: Math.round((item.currentPrice?.price ?? 0) * 100),
      isOffer: false,
      updatedAt: item.updatedAt,
      freshness: "fresh",
    },
    productMatchMissing: false,
    packageCalculationMissing: false,
  };
}

describe("nieuwe-week boodschappenlijstlifecycle", () => {
  it("verwijdert een item dat uitsluitend uit het oude maaltijdplan kwam", () => {
    const item = product("boerenkool");
    const completed = completeShoppingListFromWeek(
      createEmptyActiveShoppingList(NOW),
      [requirement(item, 2, "Boerenkoolstamppot")],
      WEEK_A,
      NOW,
    );

    expect(removeMealPlanContributionsForWeek(completed, WEEK_A, NOW).items).toEqual([]);
  });

  it.each(["manual", "suggestion", "recurring"] as const)(
    "behoudt een %s-bijdrage bij een nieuwe maaltijdweek",
    (source) => {
      const item = product(source);
      const list = addCatalogProduct(
        createEmptyActiveShoppingList(NOW),
        item,
        source,
        NOW,
      );
      expect(removeMealPlanContributionsForWeek(list, WEEK_A, NOW)).toEqual(list);
    },
  );

  it("bouwt bij gemengde herkomst alleen de oude weekbijdrage en usedIn af", () => {
    const potatoes = product("aardappelen", 3);
    const manual = addCatalogProduct(
      createEmptyActiveShoppingList(NOW),
      potatoes,
      "manual",
      NOW,
    );
    const completed = completeShoppingListFromWeek(
      manual,
      [requirement(potatoes, 2, "Hutspot")],
      WEEK_A,
      NOW,
    );
    expect(completed.items[0]).toMatchObject({
      quantity: 3,
      sources: ["manual", "weekPreparation", "recipe"],
      usedIn: ["Hutspot"],
      quantityContributions: {
        persistentQuantity: 1,
        mealPlans: [{ weekPreparationId: WEEK_A, quantity: 2 }],
      },
    });

    const cleaned = removeMealPlanContributionsForWeek(completed, WEEK_A, NOW);
    expect(cleaned.items[0]).toMatchObject({
      quantity: 1,
      sources: ["manual"],
      usedIn: [],
      quantityContributions: { persistentQuantity: 1, mealPlans: [] },
    });
  });

  it("raakt bijdragen van een andere week-id niet", () => {
    const rice = product("rijst");
    const weekA = completeShoppingListFromWeek(
      createEmptyActiveShoppingList(NOW),
      [requirement(rice, 1, "Nasi")],
      WEEK_A,
      NOW,
    );
    const bothWeeks = completeShoppingListFromWeek(
      weekA,
      [requirement(rice, 2, "Kip kerrie")],
      WEEK_B,
      NOW,
    );
    const cleaned = removeMealPlanContributionsForWeek(bothWeeks, WEEK_A, NOW);
    expect(cleaned.items[0]).toMatchObject({
      quantity: 2,
      usedIn: ["Kip kerrie"],
      quantityContributions: {
        mealPlans: [{ weekPreparationId: WEEK_B, quantity: 2 }],
      },
    });
  });

  it("herberekent het PWA 9-budget direct na opschoning", () => {
    const meal = product("maaltijd", 25);
    const manual = product("cola", 2);
    let list = addCatalogProduct(
      createEmptyActiveShoppingList(NOW),
      manual,
      "manual",
      NOW,
    );
    list = completeShoppingListFromWeek(
      list,
      [requirement(meal, 2)],
      WEEK_A,
      NOW,
    );
    expect(calculateBudget(10_000, list, NOW).knownSubtotalCents).toBe(5_200);

    const cleaned = removeMealPlanContributionsForWeek(list, WEEK_A, NOW);
    expect(calculateBudget(10_000, cleaned, NOW)).toMatchObject({
      knownSubtotalCents: 200,
      remainingCents: 9_800,
      status: "underBudget",
    });
  });

  it("blijft opgeschoond na opslaan, sluiten en opnieuw openen", () => {
    const meal = product("rookworst");
    const completed = completeShoppingListFromWeek(
      createEmptyActiveShoppingList(NOW),
      [requirement(meal, 1, "Zuurkoolstamppot")],
      WEEK_A,
      NOW,
    );
    const cleaned = removeMealPlanContributionsForWeek(completed, WEEK_A, NOW);
    const reopened = decodeStoredActiveShoppingList(
      structuredClone(encodeStoredActiveShoppingList(cleaned)),
    );
    expect(reopened?.items).toEqual([]);
  });

  it("doorloopt Week A → reset → Week B zonder resten of dubbeltelling", () => {
    const potatoes = product("aardappelen");
    const cola = product("cola");
    let weekA = addCatalogProduct(
      createEmptyActiveShoppingList(NOW),
      cola,
      "manual",
      NOW,
    );
    weekA = completeShoppingListFromWeek(
      weekA,
      [requirement(potatoes, 2, "Hutspot")],
      WEEK_A,
      NOW,
    );
    const reset = removeMealPlanContributionsForWeek(weekA, WEEK_A, NOW);
    const weekB = completeShoppingListFromWeek(
      reset,
      [requirement(potatoes, 1, "Aardappelen met groente")],
      WEEK_B,
      NOW,
    );
    expect(weekB.items.map((item) => item.productId)).toEqual(["cola", "aardappelen"]);
    expect(weekB.items.find((item) => item.productId === "aardappelen")).toMatchObject({
      quantity: 1,
      usedIn: ["Aardappelen met groente"],
    });
  });

  it("behoudt handmatige aardappelen en voegt daarna alleen Week B toe", () => {
    const potatoes = product("aardappelen");
    const manual = addCatalogProduct(
      createEmptyActiveShoppingList(NOW),
      potatoes,
      "manual",
      NOW,
    );
    const weekA = completeShoppingListFromWeek(
      manual,
      [requirement(potatoes, 2, "Hutspot")],
      WEEK_A,
      NOW,
    );
    const reset = removeMealPlanContributionsForWeek(weekA, WEEK_A, NOW);
    const weekB = completeShoppingListFromWeek(
      reset,
      [requirement(potatoes, 1, "Andijviestamppot")],
      WEEK_B,
      NOW,
    );
    expect(reset.items[0].quantity).toBe(1);
    expect(weekB.items[0]).toMatchObject({
      quantity: 2,
      quantityContributions: {
        persistentQuantity: 1,
        mealPlans: [{ weekPreparationId: WEEK_B, quantity: 1 }],
      },
    });
  });

  it("blijft idempotent en vervangt een nieuwe generatie voor dezelfde week", () => {
    const meal = product("gehakt");
    const first = completeShoppingListFromWeek(
      createEmptyActiveShoppingList(NOW),
      [requirement(meal, 2)],
      WEEK_A,
      NOW,
    );
    expect(
      completeShoppingListFromWeek(first, [requirement(meal, 2)], WEEK_A, NOW),
    ).toEqual(first);

    const regenerated = completeShoppingListFromWeek(
      first,
      [requirement(meal, 1, "Nieuw gerecht")],
      WEEK_A,
      NOW,
    );
    expect(regenerated.items[0]).toMatchObject({
      quantity: 1,
      usedIn: ["Nieuw gerecht"],
    });
  });

  it("maakt een nieuwe voorbereiding met nieuwe id en zonder oude maaltijdkosten", () => {
    const oldWeek = createWeekPreparation(
      { schemaVersion: 1, budgetCents: 10_000, people: 4, days: 7 },
      { knownSubtotalCents: 5_000, unpricedItemCount: 0 },
      NOW,
      WEEK_A,
      5_000,
    );
    const next = createWeekPreparation(
      { schemaVersion: 1, budgetCents: 10_000, people: 4, days: 7 },
      { knownSubtotalCents: 0, unpricedItemCount: 0 },
      new Date("2026-09-18T09:00:00Z"),
      WEEK_B,
      oldWeek.mealBudgetCents,
    );
    expect(next).toMatchObject({
      id: WEEK_B,
      mealBudgetCents: 5_000,
      generation: null,
      ingredients: [],
      days: [],
      status: "draft",
      existingListKnownSubtotalCents: 0,
    });
  });
});
