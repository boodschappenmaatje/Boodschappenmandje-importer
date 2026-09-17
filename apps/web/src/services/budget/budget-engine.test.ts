import { describe, expect, it } from "vitest";

import {
  calculateBudget,
  euroAmountToCents,
  parseDutchEuroInput,
} from "@/services/budget/budget-engine";
import {
  addCatalogProduct,
  createEmptyActiveShoppingList,
  increaseQuantity,
  removeShoppingListItem,
} from "@/services/shopping-list/shopping-list";
import type { Product } from "@/types/catalog";
import type {
  ActiveShoppingList,
  ShoppingListItem,
  ShoppingListPriceReference,
} from "@/types/shopping-list";

const NOW = new Date("2026-09-15T12:00:00Z");

function price(
  amount: number,
  options: Partial<ShoppingListPriceReference> = {},
): ShoppingListPriceReference {
  return {
    productId: "product",
    sku: "sku",
    amount,
    isOffer: false,
    updatedAt: "2026-09-15T06:00:00Z",
    freshness: "fresh",
    provider: "Hoogvliet",
    ...options,
  };
}

function item(
  id: string,
  amount: number | null,
  quantity = 1,
  options: Partial<ShoppingListPriceReference> = {},
): ShoppingListItem {
  return {
    productId: id,
    sku: "sku-" + id,
    name: "Product " + id,
    brand: null,
    packageText: null,
    imageUrl: null,
    quantity,
    quantityContributions: { persistentQuantity: quantity, mealPlans: [] },
    price:
      amount === null
        ? null
        : price(amount, {
            productId: id,
            sku: "sku-" + id,
            ...options,
          }),
    sources: ["catalog"],
    usedIn: [],
    createdAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  };
}

function list(...items: ShoppingListItem[]): ActiveShoppingList {
  return {
    schemaVersion: 2,
    startedAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
    items,
  };
}

function product(id: string, amount: number): Product {
  return {
    id,
    supermarket: "Hoogvliet",
    sku: "sku-" + id,
    name: "Product " + id,
    brand: null,
    category: null,
    productType: null,
    packageText: null,
    weightGrams: null,
    imageUrl: null,
    sourceUrl: "https://example.com/" + id,
    isAvailable: true,
    updatedAt: NOW.toISOString(),
    currentPrice: {
      productId: id,
      price: amount,
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

describe("Nederlandse budgetinvoer", () => {
  it.each([
    ["100", 10_000],
    ["100,00", 10_000],
    ["75,50", 7_550],
    [" 75,5 ", 7_550],
  ])("leest %s als integer centen", (input, expected) => {
    expect(parseDutchEuroInput(input)).toBe(expected);
  });

  it.each(["", "0", "0,00", "-10", "10.50", "10,999", "abc"])(
    "weigert ongeldige invoer %s",
    (input) => expect(parseDutchEuroInput(input)).toBeNull(),
  );
});

describe("centrale budgetmotor", () => {
  it("ondersteunt geen budget en een lege lijst", () => {
    expect(calculateBudget(null, list(), NOW)).toMatchObject({
      budgetCents: null,
      knownSubtotalCents: 0,
      remainingCents: null,
      status: "noBudget",
      isComplete: true,
    });
  });

  it("berekent één product en quantity groter dan één in centen", () => {
    expect(calculateBudget(1_000, list(item("a", 2.49, 3)), NOW)).toMatchObject({
      knownSubtotalCents: 747,
      remainingCents: 253,
      pricedItemCount: 1,
      unpricedItemCount: 0,
      status: "underBudget",
    });
  });

  it("berekent meerdere producten zonder floating-point optelling", () => {
    const result = calculateBudget(
      2_000,
      list(item("a", 0.1), item("b", 0.2), item("c", 10.01)),
      NOW,
    );
    expect(result.knownSubtotalCents).toBe(1_031);
    expect(euroAmountToCents(10.01)).toBe(1_001);
  });

  it.each([
    [501, "underBudget", 1],
    [500, "exactlyBudget", 0],
    [499, "overBudget", 0],
  ] as const)("onderscheidt totaal %i correct", (budget, status, remaining) => {
    const result = calculateBudget(budget, list(item("a", 5)), NOW);
    expect(result.status).toBe(status);
    expect(result.remainingCents).toBe(remaining);
    expect(result.overBudgetCents).toBe(status === "overBudget" ? 1 : 0);
  });

  it("maakt resterend budget onbekend zodra een prijs ontbreekt", () => {
    expect(
      calculateBudget(10_000, list(item("a", 72.18), item("b", null)), NOW),
    ).toMatchObject({
      knownSubtotalCents: 7_218,
      remainingCents: null,
      unpricedItemCount: 1,
      isComplete: false,
      status: "incompletePrices",
    });
  });

  it("telt meerdere ontbrekende prijzen en meldt aantoonbaar minimaal boven budget", () => {
    expect(
      calculateBudget(
        10_000,
        list(item("a", 108.27), item("b", null), item("c", null)),
        NOW,
      ),
    ).toMatchObject({
      knownSubtotalCents: 10_827,
      overBudgetCents: 827,
      remainingCents: null,
      unpricedItemCount: 2,
      status: "incompletePrices",
    });
  });

  it("gebruikt een geldige actieprijs", () => {
    const result = calculateBudget(
      1_000,
      list(
        item("a", 3.5, 1, {
          isOffer: true,
          validFrom: "2026-09-14",
          validUntil: "2026-09-16",
        }),
      ),
      NOW,
    );
    expect(result.knownSubtotalCents).toBe(350);
    expect(result.unpricedItemCount).toBe(0);
  });

  it("gebruikt een verlopen actieprijs niet als betrouwbare prijs", () => {
    const result = calculateBudget(
      1_000,
      list(
        item("a", 3.5, 1, {
          isOffer: true,
          validFrom: "2026-09-01",
          validUntil: "2026-09-14",
        }),
      ),
      NOW,
    );
    expect(result.knownSubtotalCents).toBe(0);
    expect(result.unpricedItemCount).toBe(1);
    expect(result.status).toBe("incompletePrices");
  });

  it("berekent percentage ook boven honderd", () => {
    expect(calculateBudget(1_000, list(item("a", 12.5)), NOW).percentageUsed).toBe(
      125,
    );
  });

  it("herberekent bij toevoegen, quantity, deduplicatie en verwijderen", () => {
    let active = createEmptyActiveShoppingList(NOW);
    active = addCatalogProduct(active, product("a", 2.5), "catalog", NOW);
    expect(calculateBudget(1_000, active, NOW).knownSubtotalCents).toBe(250);
    active = increaseQuantity(active, "a", NOW);
    expect(calculateBudget(1_000, active, NOW).knownSubtotalCents).toBe(500);
    active = addCatalogProduct(active, product("a", 2.5), "catalog", NOW);
    expect(calculateBudget(1_000, active, NOW).knownSubtotalCents).toBe(750);
    active = removeShoppingListItem(active, "a", NOW).list;
    expect(calculateBudget(1_000, active, NOW).knownSubtotalCents).toBe(0);
  });
});
