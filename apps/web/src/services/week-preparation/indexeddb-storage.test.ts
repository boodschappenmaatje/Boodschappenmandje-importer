import { describe, expect, it } from "vitest";

import {
  DATABASE_VERSION,
  SHOPPING_LIST_STORE_NAME,
  WEEK_PREPARATION_STORE_NAME,
  openBoodschappenmaatjeDatabase,
} from "@/services/storage/indexeddb";
import {
  decodeStoredActiveShoppingList,
  encodeStoredActiveShoppingList,
} from "@/services/shopping-list/indexeddb-storage";
import { createEmptyActiveShoppingList } from "@/services/shopping-list/shopping-list";
import { createWeekPreparation, setCategoryCount } from "@/services/week-preparation/week-preparation";
import type { WeekPreparation } from "@/types/week-preparation";

import {
  WeekPreparationStorageError,
  decodeStoredWeekPreparation,
  encodeStoredWeekPreparation,
  type WeekPreparationStorage,
} from "./indexeddb-storage";

class MemoryWeekStorage implements WeekPreparationStorage {
  stored: unknown = null;

  async load() {
    return decodeStoredWeekPreparation(this.stored);
  }

  async save(preparation: WeekPreparation) {
    this.stored = structuredClone(encodeStoredWeekPreparation(preparation));
  }
}

const SETTINGS = {
  schemaVersion: 1 as const,
  budgetCents: 10_000,
  people: 4,
  days: 6,
};
const NOW = new Date("2026-09-15T12:00:00Z");

describe("PWA 10 lokale persistentie", () => {
  it("bewaart en heropent een nieuwe voorbereiding", async () => {
    const storage = new MemoryWeekStorage();
    const preparation = createWeekPreparation(
      SETTINGS,
      { knownSubtotalCents: 2_463, unpricedItemCount: 0 },
      NOW,
      "week-persist",
    );
    await storage.save(preparation);
    await expect(storage.load()).resolves.toEqual(preparation);
  });

  it("bewaart een gedeeltelijke draft voor verdergaan na sluiten", async () => {
    const storage = new MemoryWeekStorage();
    const draft = setCategoryCount(
      createWeekPreparation(
        SETTINGS,
        { knownSubtotalCents: 0, unpricedItemCount: 0 },
        NOW,
        "week-draft",
      ),
      "dutch",
      2,
      NOW,
    );
    await storage.save(draft);
    await expect(storage.load()).resolves.toMatchObject({
      id: "week-draft",
      status: "draft",
      categoryDistribution: { dutch: 2 },
    });
  });

  it("bewaart gegenereerde gerechten, requirements, usedIn en productreferenties stabiel", async () => {
    const storage = new MemoryWeekStorage();
    const base = createWeekPreparation(
      { ...SETTINGS, days: 1 },
      { knownSubtotalCents: 0, unpricedItemCount: 0 },
      NOW,
      "week-generated",
    );
    const generated: WeekPreparation = {
      ...base,
      status: "generated",
      days: [{
        dayIndex: 0,
        category: "pasta",
        freeChoice: false,
        recipeId: "recipe-spaghetti",
        recipe: {
          id: "recipe-spaghetti",
          sourceKey: "spaghetti-bolognese",
          name: "Spaghetti bolognese",
        },
        status: "recipeSelected",
      }],
      ingredients: [{
        ingredientId: "ingredient-beef",
        sourceKey: "groundBeef",
        name: "rundergehakt",
        unit: "g",
        optional: false,
        servingsBase: 1,
        kind: "ingredient",
        brandConstraint: null,
        requiredQuantity: 700,
        purchaseQuantity: 2,
        packageCapacity: 500,
        usedIn: [{
          recipeId: "recipe-spaghetti",
          recipeName: "Spaghetti bolognese",
          dayIndex: 0,
          requiredQuantity: 700,
        }],
        product: {
          productId: "catalog-product-id",
          sku: "871000000001",
          name: "Hoogvliet rundergehakt",
          brand: "Hoogvliet",
          packageText: "500 g",
          imageUrl: null,
          supermarket: "Hoogvliet",
          sourceUrl: "https://www.hoogvliet.com/product/871000000001",
        },
        price: {
          amountCents: 449,
          isOffer: false,
          updatedAt: NOW.toISOString(),
          freshness: "fresh",
        },
        productMatchMissing: false,
        packageCalculationMissing: false,
      }],
      generation: {
        generatedAt: NOW.toISOString(),
        knownPurchaseCostCents: 898,
        mealPlanKnownCostCents: 898,
        mealBudgetRemainingCents: 4_102,
        nonMealReservedCents: 5_000,
        totalKnownWeekCostCents: 898,
        mealBudgetStatus: "withinMealBudget",
        weekBudgetStatus: "underBudget",
        isMealBudgetComplete: true,
        mealBudgetCandidateCount: 1,
        mealBudgetRejectedCount: 0,
        readinessByCategory: [
          { category: "pasta", candidateCount: 19, readyCount: 10 },
        ],
        lowestCompleteMealPlanCostCents: 898,
        lowestCompleteMealPlanCostReliable: true,
        matchedProductCount: 1,
        missingProductMatchCount: 0,
        missingPackageCalculationCount: 0,
        missingPriceCount: 0,
      },
    };
    await storage.save(generated);
    await expect(storage.load()).resolves.toEqual(generated);
  });

  it("vervangt alleen de voorbereiding bij een nieuwe week", async () => {
    const storage = new MemoryWeekStorage();
    const existingList = createEmptyActiveShoppingList(NOW);
    const encodedList = structuredClone(encodeStoredActiveShoppingList(existingList));
    const first = createWeekPreparation(
      SETTINGS,
      { knownSubtotalCents: 0, unpricedItemCount: 0 },
      NOW,
      "week-old",
    );
    const next = createWeekPreparation(
      SETTINGS,
      { knownSubtotalCents: 0, unpricedItemCount: 0 },
      new Date("2026-09-16T12:00:00Z"),
      "week-new",
    );
    await storage.save(first);
    await storage.save(next);
    await expect(storage.load()).resolves.toMatchObject({ id: "week-new" });
    expect(decodeStoredActiveShoppingList(encodedList)).toEqual(existingList);
  });

  it("breidt IndexedDB versioned uit met een aparte store en behoudt de bestaande lijststore", () => {
    expect(DATABASE_VERSION).toBe(2);
    expect(SHOPPING_LIST_STORE_NAME).toBe("shopping-lists");
    expect(WEEK_PREPARATION_STORE_NAME).toBe("week-preparations");
  });

  it("voegt bij een v1-upgrade alleen de ontbrekende weekstore toe", async () => {
    const createdStores: string[] = [];
    const database = {
      objectStoreNames: {
        contains: (name: string) => name === SHOPPING_LIST_STORE_NAME,
      },
      createObjectStore: (name: string) => {
        createdStores.push(name);
        return {};
      },
    };
    const request: Partial<IDBOpenDBRequest> = {};
    const factory = {
      open: (_name: string, version?: number) => {
        expect(version).toBe(2);
        queueMicrotask(() => {
          Object.defineProperty(request, "result", { value: database });
          const openRequest = request as IDBOpenDBRequest;
          openRequest.onupgradeneeded?.call(
            openRequest,
            new Event("upgradeneeded") as IDBVersionChangeEvent,
          );
          openRequest.onsuccess?.call(openRequest, new Event("success"));
        });
        return request as IDBOpenDBRequest;
      },
    } as IDBFactory;

    await openBoodschappenmaatjeDatabase(factory);
    expect(createdStores).toEqual([WEEK_PREPARATION_STORE_NAME]);
  });

  it("weigert onbekende toekomstige opslagversies zonder te overschrijven", () => {
    expect(() =>
      decodeStoredWeekPreparation({
        key: "active",
        schemaVersion: 99,
        preparation: {},
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WeekPreparationStorageError>>({
        code: "unsupported-version",
      }),
    );
  });

  it("migreert een bestaande PWA 10-week naar PWA 11 zonder dagkeuzes te verliezen", () => {
    const legacy = {
      schemaVersion: 1,
      id: "week-legacy",
      createdAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      numberOfPeople: 4,
      numberOfDays: 1,
      budgetCents: 10_000,
      existingListKnownSubtotalCents: 500,
      existingListUnpricedCount: 0,
      categoryDistribution: {
        dutch: 1,
        pasta: 0,
        rice: 0,
        quick: 0,
        healthy: 0,
        comfort: 0,
        vegetarian: 0,
        freeChoice: 0,
      },
      preferences: {
        noVegetarian: false,
        quickImportant: false,
        healthyImportant: false,
        budgetImportant: true,
      },
      days: [{
        dayIndex: 0,
        category: "dutch",
        freeChoice: false,
        recipeId: null,
        status: "categoryAssigned",
      }],
      status: "readyForGeneration",
      listStrategy: "preserveAndComplete",
    };
    expect(
      decodeStoredWeekPreparation({
        key: "active",
        schemaVersion: 1,
        preparation: legacy,
      }),
    ).toMatchObject({
      schemaVersion: 6,
      customizations: [],
      mealBudgetCents: null,
      id: "week-legacy",
      ingredients: [],
      generation: null,
      days: [{ category: "dutch", recipe: null }],
    });
  });

  it("migreert een bestaande PWA 11-versie 2 zonder het gekozen gerecht te wijzigen", () => {
    const base = createWeekPreparation(
      { ...SETTINGS, days: 1 },
      { knownSubtotalCents: 0, unpricedItemCount: 0 },
      NOW,
      "week-v2",
    );
    const legacy = JSON.parse(JSON.stringify({
      ...base,
      status: "generationPartial",
      days: [{
        dayIndex: 0,
        category: "pasta",
        freeChoice: false,
        recipeId: "recipe-spaghetti",
        recipe: { id: "recipe-spaghetti", sourceKey: "spaghetti-bolognese", name: "Spaghetti bolognese" },
        status: "recipeSelected",
      }],
      ingredients: [{
        ingredientId: "ingredient-beef",
        sourceKey: "groundBeef",
        name: "rundergehakt",
        unit: "g",
        optional: false,
        servingsBase: 1,
        kind: "ingredient",
        brandConstraint: null,
        requiredQuantity: 700,
        purchaseQuantity: null,
        packageCapacity: null,
        usedIn: [{ recipeId: "recipe-spaghetti", recipeName: "Spaghetti bolognese", dayIndex: 0, requiredQuantity: 700 }],
        product: null,
        price: null,
        productMatchMissing: true,
        packageCalculationMissing: false,
      }],
      generation: {
        generatedAt: NOW.toISOString(),
        knownPurchaseCostCents: 0,
        matchedProductCount: 0,
        missingProductMatchCount: 1,
        missingPackageCalculationCount: 0,
        missingPriceCount: 0,
      },
    })) as Record<string, unknown>;
    legacy.schemaVersion = 2;
    const ingredients = legacy.ingredients as Array<Record<string, unknown>>;
    for (const ingredient of ingredients) {
      delete ingredient.kind;
      delete ingredient.brandConstraint;
      const uses = ingredient.usedIn as Array<Record<string, unknown>>;
      for (const use of uses) {
        delete use.dayIndex;
        delete use.requiredQuantity;
      }
    }

    expect(
      decodeStoredWeekPreparation({
        key: "active",
        schemaVersion: 2,
        preparation: legacy,
      }),
    ).toMatchObject({
      schemaVersion: 6,
      customizations: [],
      mealBudgetCents: null,
      days: [{ recipe: { sourceKey: "spaghetti-bolognese" } }],
      ingredients: [{
        kind: "ingredient",
        brandConstraint: null,
        usedIn: [{ dayIndex: 0, requiredQuantity: 700 }],
      }],
    });
  });

  it("migreert schema v3 naar een expliciet nog in te stellen maaltijd-budget zonder de week te vervangen", () => {
    const base = createWeekPreparation(
      SETTINGS,
      { knownSubtotalCents: 0, unpricedItemCount: 0 },
      NOW,
      "week-v3",
    );
    const current: WeekPreparation = {
      ...base,
      status: "generated",
      generation: {
        generatedAt: NOW.toISOString(),
        knownPurchaseCostCents: 898,
        mealPlanKnownCostCents: 898,
        mealBudgetRemainingCents: null,
        nonMealReservedCents: null,
        totalKnownWeekCostCents: 898,
        mealBudgetStatus: "noMealBudget",
        weekBudgetStatus: "underBudget",
        isMealBudgetComplete: false,
        mealBudgetCandidateCount: 0,
        mealBudgetRejectedCount: 0,
        matchedProductCount: 1,
        missingProductMatchCount: 0,
        missingPackageCalculationCount: 0,
        missingPriceCount: 0,
      },
    };
    const legacy = structuredClone(current) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 3;
    delete legacy.mealBudgetCents;
    const generation = legacy.generation as Record<string, unknown>;
    for (const field of [
      "mealPlanKnownCostCents",
      "mealBudgetRemainingCents",
      "nonMealReservedCents",
      "totalKnownWeekCostCents",
      "mealBudgetStatus",
      "weekBudgetStatus",
      "isMealBudgetComplete",
      "mealBudgetCandidateCount",
      "mealBudgetRejectedCount",
    ]) delete generation[field];

    const migrated = decodeStoredWeekPreparation({
      key: "active",
      schemaVersion: 3,
      preparation: legacy,
    });
    expect(migrated).toMatchObject({
      schemaVersion: 6,
      customizations: [],
      mealBudgetCents: null,
      days: current.days,
      generation: {
        knownPurchaseCostCents: 898,
        mealPlanKnownCostCents: 898,
        mealBudgetStatus: "noMealBudget",
        isMealBudgetComplete: false,
      },
    });
  });

  it("migreert PWA 12 schema v5 naar typed automatische provenance", () => {
    const current = createWeekPreparation(
      { ...SETTINGS, days: 1 },
      { knownSubtotalCents: 0, unpricedItemCount: 0 },
      NOW,
      "week-v5-customization",
    );
    const legacy = structuredClone({
      ...current,
      customizations: [{
        dayIndex: 0,
        baseRecipe: {
          id: "recipe-spaghetti",
          sourceKey: "spaghetti-bolognese",
          name: "Spaghetti bolognese",
        },
        replacementRecipe: null,
        productOverrides: [{
          ingredientId: "ingredient-spaghetti",
          productId: "product-spaghetti",
          sku: "sku-product-spaghetti",
          updatedAt: NOW.toISOString(),
        }],
        ingredientOverrides: [],
        updatedAt: NOW.toISOString(),
      }],
    }) as unknown as Record<string, unknown>;
    legacy.schemaVersion = 5;

    expect(decodeStoredWeekPreparation({
      key: "active",
      schemaVersion: 5,
      preparation: legacy,
    })).toMatchObject({
      schemaVersion: 6,
      customizations: [{
        productOverrides: [{
          quantity: null,
          selectionSource: "automaticSuggestion",
          applicationMode: "automaticPlanValidation",
          budgetDecision: { mode: "automaticPlanValidation" },
        }],
        manualProductAdditions: [],
        recipeBudgetDecision: { mode: "automaticPlanValidation" },
      }],
    });
  });

  it("normaliseert bestaande IndexedDB v6-goedkeuringen zonder gebruikerskeuze te verliezen", () => {
    const base = createWeekPreparation(
      { ...SETTINGS, days: 1 },
      { knownSubtotalCents: 0, unpricedItemCount: 0 },
      NOW,
      "week-v6-existing-approval",
    );
    const legacy = structuredClone({
      ...base,
      mealBudgetCents: 500,
      customizations: [{
        dayIndex: 0,
        baseRecipe: {
          id: "recipe-spaghetti",
          sourceKey: "spaghetti-bolognese",
          name: "Spaghetti bolognese",
        },
        replacementRecipe: null,
        productOverrides: [{
          ingredientId: "ingredient-spaghetti",
          productId: "product-boomstam",
          sku: "sku-product-boomstam",
          quantity: 1,
          selectionSource: "manualSearch",
          budgetDecision: {
            mode: "userApprovedBudgetOverride",
            approvedAt: NOW.toISOString(),
            approvedMealPlanCostCents: 6_221,
            approvedTotalWeekCostCents: 6_221,
          },
          updatedAt: NOW.toISOString(),
        }],
        ingredientOverrides: [],
        manualProductAdditions: [],
        updatedAt: NOW.toISOString(),
      }],
    });

    expect(decodeStoredWeekPreparation({
      key: "active",
      schemaVersion: 6,
      preparation: legacy,
    })).toMatchObject({
      customizations: [{
        recipeBudgetDecision: { mode: "automaticPlanValidation" },
        productOverrides: [{
          applicationMode: "explicitUserChoice",
          budgetDecision: {
            mode: "userApprovedBudgetOverride",
            approvedMealBudgetCents: 500,
            approvedWeekBudgetCents: 10_000,
            approvedMutation: {
              kind: "replaceIngredient",
              weekPreparationId: "week-v6-existing-approval",
              dayIndex: 0,
              ingredientId: "ingredient-spaghetti",
              productId: "product-boomstam",
              quantity: 1,
            },
          },
        }],
      }],
    });
  });
});
