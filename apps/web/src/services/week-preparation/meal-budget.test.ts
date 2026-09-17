import { describe, expect, it } from "vitest";

import { parseDutchEuroInputAllowZero } from "@/services/budget/budget-engine";
import {
  evaluateMealBudget,
  mealBudgetAllowsPlan,
} from "@/services/week-preparation/meal-budget";
import type { ActiveShoppingList, ShoppingListItem } from "@/types/shopping-list";
import type { WeekIngredientRequirement } from "@/types/week-preparation";

const NOW = new Date("2026-09-17T12:00:00Z");

function requirement(
  id: string,
  productId: string,
  purchaseQuantity: number | null,
  priceCents: number | null,
  options: Partial<WeekIngredientRequirement> = {},
): WeekIngredientRequirement {
  return {
    ingredientId: id,
    sourceKey: id,
    name: id,
    unit: "g",
    optional: false,
    servingsBase: 1,
    kind: "ingredient",
    brandConstraint: null,
    requiredQuantity: (purchaseQuantity ?? 1) * 500,
    purchaseQuantity,
    packageCapacity: purchaseQuantity === null ? null : 500,
    usedIn: [{ recipeId: "recipe", recipeName: "Gerecht", dayIndex: 0, requiredQuantity: 500 }],
    product: productId
      ? {
          productId,
          sku: `sku-${productId}`,
          name: `Product ${productId}`,
          brand: null,
          packageText: "500 g",
          imageUrl: null,
          supermarket: "Hoogvliet",
          sourceUrl: `https://example.test/${productId}`,
        }
      : null,
    price: priceCents === null
      ? null
      : { amountCents: priceCents, isOffer: false, updatedAt: NOW.toISOString(), freshness: "fresh" },
    productMatchMissing: !productId,
    packageCalculationMissing: purchaseQuantity === null,
    ...options,
  };
}

function item(productId: string, quantity: number, price = 2): ShoppingListItem {
  return {
    productId,
    sku: `sku-${productId}`,
    name: `Product ${productId}`,
    brand: null,
    packageText: "500 g",
    imageUrl: null,
    quantity,
    quantityContributions: { persistentQuantity: quantity, mealPlans: [] },
    price: {
      productId,
      sku: `sku-${productId}`,
      amount: price,
      isOffer: false,
      updatedAt: NOW.toISOString(),
      freshness: "fresh",
      provider: "Hoogvliet",
    },
    sources: ["manual"],
    usedIn: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

function list(items: ShoppingListItem[] = []): ActiveShoppingList {
  return {
    schemaVersion: 2,
    startedAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    items,
  };
}

describe("Meal Budget Gate", () => {
  it("rekent uitsluitend met integer cents, inclusief €0,10 + €0,20", () => {
    expect(parseDutchEuroInputAllowZero("0")).toBe(0);
    expect(parseDutchEuroInputAllowZero("0,10")! + parseDutchEuroInputAllowZero("0,20")!).toBe(30);
  });

  it("onderscheidt het maaltijdmaximum van de gereserveerde overige ruimte", () => {
    const result = evaluateMealBudget(
      10_000,
      5_000,
      [requirement("rice", "rice-product", 2, 400)],
      list(),
      NOW,
    );
    expect(result).toMatchObject({
      mealPlanKnownCostCents: 800,
      newMealCostCents: 800,
      mealBudgetRemainingCents: 4_200,
      nonMealReservedCents: 5_000,
      mealBudgetStatus: "withinMealBudget",
      weekBudgetStatus: "underBudget",
      isMealBudgetComplete: true,
    });
    expect(mealBudgetAllowsPlan(result)).toBe(true);
  });

  it("rekent een exact bestaand maaltijdproduct niet opnieuw als nieuwe aankoop", () => {
    const result = evaluateMealBudget(
      10_000,
      5_000,
      [requirement("beef", "beef-product", 2, 449)],
      list([item("beef-product", 2, 4.49), item("cola", 1, 2)]),
      NOW,
    );
    expect(result).toMatchObject({
      mealPlanKnownCostCents: 898,
      existingMealListCostCents: 898,
      existingNonMealKnownCostCents: 200,
      newMealCostCents: 0,
      totalKnownWeekCostCents: 1_098,
      newMealPackageCount: 0,
    });
  });

  it("combineert gedeelde productbehoefte en telt alleen ontbrekende verpakkingen", () => {
    const first = requirement("onion-a", "onion-product", 1, 150, { requiredQuantity: 400, packageCapacity: 1_000 });
    const second = requirement("onion-b", "onion-product", 1, 150, { requiredQuantity: 400, packageCapacity: 1_000 });
    const result = evaluateMealBudget(10_000, 5_000, [first, second], list(), NOW);
    expect(result.mealPlanKnownCostCents).toBe(150);
    expect(result.newMealPackageCount).toBe(1);
  });

  it("wijst een complete maaltijd boven de harde grens af", () => {
    const result = evaluateMealBudget(
      10_000,
      500,
      [requirement("beef", "beef-product", 2, 449)],
      list(),
      NOW,
    );
    expect(result.mealBudgetStatus).toBe("overMealBudget");
    expect(mealBudgetAllowsPlan(result)).toBe(false);
  });

  it("keurt ontbrekende prijs of verpakking nooit als goedkoop plan goed", () => {
    const missingPrice = evaluateMealBudget(
      10_000,
      5_000,
      [requirement("beef", "beef-product", 1, null)],
      list(),
      NOW,
    );
    const missingPackage = evaluateMealBudget(
      10_000,
      5_000,
      [requirement("rice", "rice-product", null, 250)],
      list(),
      NOW,
    );
    expect(missingPrice.mealBudgetStatus).toBe("incompleteValidation");
    expect(missingPackage.mealBudgetStatus).toBe("incompleteValidation");
    expect(mealBudgetAllowsPlan(missingPrice)).toBe(false);
    expect(mealBudgetAllowsPlan(missingPackage)).toBe(false);
  });

  it("laat een ontbrekend optioneel ingrediënt toe maar telt een koopbaar optioneel product wel mee", () => {
    const missingOptional = requirement("parsley", "", null, null, { optional: true });
    const pricedOptional = requirement("cheese", "cheese-product", 1, 175, { optional: true });
    const result = evaluateMealBudget(
      10_000,
      5_000,
      [requirement("rice", "rice-product", 1, 250), missingOptional, pricedOptional],
      list(),
      NOW,
    );
    expect(result.isMealBudgetComplete).toBe(true);
    expect(result.mealPlanKnownCostCents).toBe(425);
    expect(mealBudgetAllowsPlan(result)).toBe(true);
  });

  it("meldt totale overschrijding door bestaande handmatige boodschappen zonder ze als maaltijdkosten te classificeren", () => {
    const result = evaluateMealBudget(
      1_000,
      500,
      [requirement("rice", "rice-product", 1, 250)],
      list([item("cola", 1, 10.5)]),
      NOW,
    );
    expect(result.mealBudgetStatus).toBe("withinMealBudget");
    expect(result.weekBudgetStatus).toBe("overBudget");
    expect(result.existingNonMealKnownCostCents).toBe(1_050);
  });
});
