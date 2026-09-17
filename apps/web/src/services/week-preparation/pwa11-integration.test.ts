import { describe, expect, it } from "vitest";

import recipeSource from "../../../../../data/recipes.json";
import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import { completeShoppingListFromWeek } from "@/services/shopping-list/shopping-list";
import { aggregateWeekIngredients } from "@/services/week-preparation/ingredient-aggregation";
import {
  applyProductToRequirement,
  isReliableIngredientMatch,
  productPackageCapacity,
  selectIngredientProduct,
} from "@/services/week-preparation/product-matching";
import type {
  RecipeCatalog,
  RecipeRepository,
} from "@/services/week-preparation/recipe-repository";
import {
  recipeCategories,
  selectRecipesForDays,
} from "@/services/week-preparation/recipe-selection";
import {
  calculateWeekBudgetSummary,
  generatePreparedWeek,
  refreshGeneratedWeek,
  revalidatePreparedWeek,
} from "@/services/week-preparation/week-generation";
import {
  createWeekPreparation,
  prepareWeek,
  setCategoryCount,
} from "@/services/week-preparation/week-preparation";
import type { Product, Recipe } from "@/types/catalog";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type {
  PreparedDay,
  WeekIngredientRequirement,
  WeekPreferences,
} from "@/types/week-preparation";

const NOW = new Date("2026-09-15T12:00:00Z");
const PREFERENCES: WeekPreferences = {
  noVegetarian: false,
  quickImportant: false,
  healthyImportant: false,
  budgetImportant: true,
};

function product(
  input: Partial<Product> & Pick<Product, "id" | "sku" | "name">,
): Product {
  return {
    supermarket: "Hoogvliet",
    brand: "Hoogvliet",
    category: null,
    productType: null,
    packageText: null,
    weightGrams: null,
    imageUrl: null,
    sourceUrl: `https://www.hoogvliet.com/product/${input.sku}`,
    isAvailable: true,
    updatedAt: NOW.toISOString(),
    currentPrice: null,
    ...input,
  };
}

const BEEF = product({
  id: "11111111-1111-4111-8111-111111111111",
  sku: "871000000001",
  name: "Hoogvliet rundergehakt",
  category: "Vlees",
  productType: "Rundergehakt",
  packageText: "500 g",
  weightGrams: 500,
  currentPrice: {
    productId: "11111111-1111-4111-8111-111111111111",
    price: 4.49,
    oldPrice: null,
    isOffer: false,
    offerText: null,
    validFrom: null,
    validUntil: null,
    fetchedAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  },
});

const ONIONS = product({
  id: "22222222-2222-4222-8222-222222222222",
  sku: "871000000002",
  name: "Uien voordeelzak",
  category: "Groente",
  productType: "Uien",
  packageText: "1 kg",
  weightGrams: 1000,
  currentPrice: {
    productId: "22222222-2222-4222-8222-222222222222",
    price: 1.5,
    oldPrice: 1.99,
    isOffer: true,
    offerText: "Actie",
    validFrom: "2026-09-01",
    validUntil: "2026-09-30",
    fetchedAt: NOW.toISOString(),
    updatedAt: NOW.toISOString(),
  },
});

const SPINACH = product({
  id: "33333333-3333-4333-8333-333333333333",
  sku: "871000000003",
  name: "Spinazie fijn gehakt",
  category: "Groente",
  productType: "Spinazie",
  packageText: "450 g",
  weightGrams: 450,
});

const RECIPE: Recipe = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  sourceKey: "spaghetti-bolognese",
  name: "Spaghetti bolognese",
  normalizedName: "spaghetti bolognese",
  symbol: "fork.knife",
  preparationMinutes: 30,
  vegetarian: false,
  containsPork: false,
  kidFriendly: true,
  healthy: false,
  budgetTier: "standard",
};

const INGREDIENTS: RecipeCatalog["ingredients"] = [
  {
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    sourceKey: "groundBeef",
    name: "rundergehakt",
    normalizedName: "rundergehakt",
    defaultUnit: "grams",
    category: "Vlees",
    aliases: ["rundergehakt", "gehakt"],
  },
  {
    id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    sourceKey: "onion",
    name: "uien",
    normalizedName: "uien",
    defaultUnit: "grams",
    category: "Groente",
    aliases: ["uien", "ui"],
  },
];

const CATALOG: RecipeCatalog = {
  recipes: [RECIPE],
  ingredients: INGREDIENTS,
  relations: [
    {
      id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
      recipeId: RECIPE.id,
      ingredientId: INGREDIENTS[0].id,
      amountPerPerson: 175,
      unit: "g",
      position: 0,
    },
    {
      id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
      recipeId: RECIPE.id,
      ingredientId: INGREDIENTS[1].id,
      amountPerPerson: 50,
      unit: "g",
      position: 1,
    },
  ],
};

function catalogRepository(
  products: Product[],
): CatalogRepository {
  const matching = (term: string) =>
    products.filter((item) =>
      [item.name, item.category, item.productType]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("nl-NL")
        .includes(term.toLocaleLowerCase("nl-NL")),
    );
  return {
    async getPage() {
      return { products, priceStatus: "complete", page: 1, pageSize: 20, hasMore: false };
    },
    async getByIds(productIds) {
      return {
        products: products.filter((item) => productIds.includes(item.id)),
        priceStatus: "complete",
      };
    },
    async query(request = {}) {
      return {
        products: matching(request.term ?? ""),
        priceStatus: "complete",
        page: 1,
        pageSize: 20,
        hasMore: false,
        query: {
          term: request.term ?? "",
          category: null,
          brand: null,
          offersOnly: false,
          maxPrice: null,
          sort: "relevance",
        },
      };
    },
    async search(term) {
      return { products: matching(term), priceStatus: "complete" };
    },
    async getFilterOptions() {
      return { categories: [], brands: [] };
    },
  };
}

function preparedWeek() {
  let preparation = createWeekPreparation(
    { schemaVersion: 1, budgetCents: 10_000, people: 4, days: 1 },
    { knownSubtotalCents: 0, unpricedItemCount: 0 },
    NOW,
    "week-pwa-11",
  );
  preparation = setCategoryCount(preparation, "pasta", 1, NOW);
  return prepareWeek(
    preparation,
    { knownSubtotalCents: 0, unpricedItemCount: 0 },
    NOW,
  );
}

describe("PWA 11 recepten, ingrediënten, producten en budget", () => {
  it("hergebruikt exact 100 recepten en dekt iedere automatische weekcategorie breed", () => {
    const recipes = recipeSource.recipes.map((item) => ({
      ...item,
      id: item.sourceKey,
      budgetTier: item.budgetTier as Recipe["budgetTier"],
      normalizedName: item.name.toLocaleLowerCase("nl-NL"),
    }));
    expect(recipes).toHaveLength(100);
    for (const category of [
      "dutch",
      "pasta",
      "rice",
      "quick",
      "healthy",
      "comfort",
      "vegetarian",
    ] as const) {
      expect(
        recipes.filter((recipe) => recipeCategories(recipe).includes(category)).length,
        `meerdere recepten voor ${category}`,
      ).toBeGreaterThan(1);
    }
  });

  it("kiest passend, respecteert geen-vega, vermijdt dubbelen en vult vrije keuze niet", () => {
    const vegetarianQuick: Recipe = {
      ...RECIPE,
      id: "vegetarian",
      sourceKey: "vegetarian-pasta",
      name: "Vegetarische pasta",
      normalizedName: "vegetarische pasta",
      vegetarian: true,
      preparationMinutes: 15,
    };
    const secondPasta: Recipe = {
      ...RECIPE,
      id: "second",
      sourceKey: "macaroni",
      name: "Macaroni met gehakt",
      normalizedName: "macaroni met gehakt",
    };
    const days: PreparedDay[] = [
      { dayIndex: 0, category: "pasta", freeChoice: false, recipeId: null, recipe: null, status: "categoryAssigned" },
      { dayIndex: 1, category: "pasta", freeChoice: false, recipeId: null, recipe: null, status: "categoryAssigned" },
      { dayIndex: 2, category: "freeChoice", freeChoice: true, recipeId: null, recipe: null, status: "freeChoice" },
    ];
    const selected = selectRecipesForDays(
      days,
      [RECIPE, secondPasta, vegetarianQuick],
      { ...PREFERENCES, noVegetarian: true, quickImportant: true },
      "stable-week",
      new Set([RECIPE.id, secondPasta.id, vegetarianQuick.id]),
    );
    expect(selected[0].recipe?.id).not.toBe(selected[1].recipe?.id);
    expect(selected.slice(0, 2).every((day) => day.recipe?.id !== "vegetarian")).toBe(true);
    expect(selected[2]).toMatchObject({
      recipeId: null,
      recipe: null,
      status: "freeChoice",
    });
  });

  it("schaalt per persoon, combineert canonieke ingrediënten en bewaart echte usedIn", () => {
    const secondRecipe: Recipe = {
      ...RECIPE,
      id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
      sourceKey: "macaroni",
      name: "Macaroni",
      normalizedName: "macaroni",
    };
    const catalog: RecipeCatalog = {
      ...CATALOG,
      recipes: [RECIPE, secondRecipe],
      relations: [
        ...CATALOG.relations,
        {
          id: "99999999-9999-4999-8999-999999999999",
          recipeId: secondRecipe.id,
          ingredientId: INGREDIENTS[1].id,
          amountPerPerson: 25,
          unit: "g",
          position: 0,
        },
      ],
    };
    const requirements = aggregateWeekIngredients(
      [
        { dayIndex: 0, category: "pasta", freeChoice: false, recipeId: RECIPE.id, recipe: { id: RECIPE.id, sourceKey: RECIPE.sourceKey, name: RECIPE.name }, status: "recipeSelected" },
        { dayIndex: 1, category: "pasta", freeChoice: false, recipeId: secondRecipe.id, recipe: { id: secondRecipe.id, sourceKey: secondRecipe.sourceKey, name: secondRecipe.name }, status: "recipeSelected" },
      ],
      4,
      catalog,
    );
    const onion = requirements.find((item) => item.sourceKey === "onion");
    expect(onion).toMatchObject({
      requiredQuantity: 300,
      unit: "g",
      optional: false,
      servingsBase: 1,
      kind: "ingredient",
      brandConstraint: null,
    });
    expect(onion?.usedIn.map((item) => item.recipeName)).toEqual([
      "Spaghetti bolognese",
      "Macaroni",
    ]);
  });

  it("weigert spinazie fijn gehakt voor een vleesingrediënt en kiest een echte SKU", () => {
    expect(isReliableIngredientMatch(INGREDIENTS[0], SPINACH)).toBe(false);
    expect(selectIngredientProduct(INGREDIENTS[0], [SPINACH, BEEF])).toMatchObject({
      id: BEEF.id,
      sku: BEEF.sku,
    });
  });

  it("berekent 700 g uit twee verpakkingen van 500 g en bewaart requiredQuantity", () => {
    const requirement: WeekIngredientRequirement = {
      ingredientId: INGREDIENTS[0].id,
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
      usedIn: [{ recipeId: RECIPE.id, recipeName: RECIPE.name, dayIndex: 0, requiredQuantity: 700 }],
      product: null,
      price: null,
      productMatchMissing: false,
      packageCalculationMissing: false,
    };
    expect(productPackageCapacity(BEEF, "g")).toBe(500);
    expect(applyProductToRequirement(requirement, BEEF)).toMatchObject({
      requiredQuantity: 700,
      purchaseQuantity: 2,
      packageCapacity: 500,
      product: { productId: BEEF.id, sku: BEEF.sku },
      price: { amountCents: 449, isOffer: false },
    });
    expect(applyProductToRequirement(requirement, null)).toMatchObject({
      productMatchMissing: true,
      price: null,
    });
  });

  it("doorloopt de volledige keten en maakt de lijst exact idempotent compleet", async () => {
    const recipeRepository: RecipeRepository = {
      async loadCatalog() {
        return CATALOG;
      },
    };
    const generated = await generatePreparedWeek(
      preparedWeek(),
      recipeRepository,
      catalogRepository([BEEF, ONIONS]),
      NOW,
    );
    expect(generated.status).toBe("generated");
    expect(generated.days[0].recipe?.name).toBe("Spaghetti bolognese");
    expect(generated.ingredients).toHaveLength(2);
    expect(generated.generation).toMatchObject({
      knownPurchaseCostCents: 1048,
      missingProductMatchCount: 0,
      missingPriceCount: 0,
    });

    const manualProduct = product({
      id: "77777777-7777-4777-8777-777777777777",
      sku: "871000000007",
      name: "Cola",
      packageText: "1,5 l",
      currentPrice: {
        productId: "77777777-7777-4777-8777-777777777777",
        price: 2,
        oldPrice: null,
        isOffer: false,
        offerText: null,
        validFrom: null,
        validUntil: null,
        fetchedAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      },
    });
    const baseList = completeShoppingListFromWeek(
      {
        schemaVersion: 1,
        startedAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        items: [{
          productId: manualProduct.id,
          sku: manualProduct.sku,
          name: manualProduct.name,
          brand: manualProduct.brand,
          packageText: manualProduct.packageText,
          imageUrl: null,
          quantity: 1,
          price: {
            productId: manualProduct.id,
            sku: manualProduct.sku,
            amount: 2,
            isOffer: false,
            updatedAt: NOW.toISOString(),
            freshness: "fresh",
            provider: "Hoogvliet",
          },
          sources: ["manual"],
          usedIn: [],
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        }],
      },
      generated.ingredients,
      NOW,
    );
    const secondRun = completeShoppingListFromWeek(
      baseList,
      generated.ingredients,
      new Date("2026-09-15T13:00:00Z"),
    );
    expect(secondRun).toEqual(baseList);
    expect(baseList.items).toHaveLength(3);
    expect(baseList.items.find((item) => item.productId === BEEF.id)).toMatchObject({
      quantity: 2,
      usedIn: ["Spaghetti bolognese"],
      sources: ["weekPreparation", "recipe"],
    });
    expect(baseList.items.find((item) => item.productId === manualProduct.id)?.sources).toEqual(["manual"]);

    const budget = calculateWeekBudgetSummary(
      generated,
      {
        schemaVersion: 1,
        startedAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
        items: [],
      },
      NOW,
    );
    expect(budget).toMatchObject({
      newKnownCostCents: 1048,
      knownTotalCents: 1048,
      remainingCents: 8952,
      isComplete: true,
    });
  });

  it("zet een gerecht met een ontbrekende verplichte match niet automatisch in de week", async () => {
    const recipeRepository: RecipeRepository = {
      async loadCatalog() {
        return CATALOG;
      },
    };
    const generated = await generatePreparedWeek(
      preparedWeek(),
      recipeRepository,
      catalogRepository([BEEF]),
      NOW,
    );
    expect(generated.status).toBe("generationPartial");
    expect(generated.generation).toMatchObject({
      matchedProductCount: 0,
      missingProductMatchCount: 0,
      knownPurchaseCostCents: 0,
    });
    expect(generated.days[0]).toMatchObject({
      recipeId: null,
      recipe: null,
      status: "categoryAssigned",
    });
    expect(generated.ingredients).toEqual([]);

    const originalList: ActiveShoppingList = {
      schemaVersion: 1,
      startedAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      items: [],
    };
    expect(completeShoppingListFromWeek(originalList, generated.ingredients, NOW)).toEqual(
      originalList,
    );
  });

  it("behoudt een handmatig hoger aantal en verhoogt alleen bij echte extra weekbehoefte", () => {
    const requirement = applyProductToRequirement(
      {
        ingredientId: INGREDIENTS[0].id,
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
        usedIn: [{ recipeId: RECIPE.id, recipeName: RECIPE.name, dayIndex: 0, requiredQuantity: 700 }],
        product: null,
        price: null,
        productMatchMissing: false,
        packageCalculationMissing: false,
      },
      BEEF,
    );
    const list: ActiveShoppingList = {
      schemaVersion: 1,
      startedAt: NOW.toISOString(),
      updatedAt: NOW.toISOString(),
      items: [{
        productId: BEEF.id,
        sku: BEEF.sku,
        name: BEEF.name,
        brand: BEEF.brand,
        packageText: BEEF.packageText,
        imageUrl: null,
        quantity: 3,
        price: null,
        sources: ["manual"],
        usedIn: [],
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      }],
    };
    const completed = completeShoppingListFromWeek(list, [requirement], NOW);
    expect(completed.items[0].quantity).toBe(3);
    expect(completed.items[0].sources).toEqual(["manual", "weekPreparation", "recipe"]);
  });

  it("hercontroleert vóór lijstaanvulling en verwijdert een bestaand gerecht niet stilzwijgend", async () => {
    const recipeRepository: RecipeRepository = {
      async loadCatalog() {
        return CATALOG;
      },
    };
    const generated = await generatePreparedWeek(
      preparedWeek(),
      recipeRepository,
      catalogRepository([BEEF, ONIONS]),
      NOW,
    );
    const validation = await revalidatePreparedWeek(
      generated,
      recipeRepository,
      catalogRepository([BEEF]),
      new Date("2026-09-15T13:00:00Z"),
    );

    expect(validation.ready).toBe(false);
    expect(validation.preparation.status).toBe("generationPartial");
    expect(validation.preparation.days[0].recipe).toEqual(generated.days[0].recipe);
    expect(
      validation.preparation.ingredients.find((item) => item.sourceKey === "onion"),
    ).toMatchObject({ productMatchMissing: true, price: null });
  });

  it("revalideert ook een oude opgeslagen week zonder ingrediëntsnapshot", async () => {
    const recipeRepository: RecipeRepository = {
      async loadCatalog() {
        return CATALOG;
      },
    };
    const oldWeek: ReturnType<typeof preparedWeek> = {
      ...preparedWeek(),
      status: "generated",
      days: [{
        dayIndex: 0,
        category: "pasta",
        freeChoice: false,
        recipeId: RECIPE.id,
        recipe: { id: RECIPE.id, sourceKey: RECIPE.sourceKey, name: RECIPE.name },
        status: "recipeSelected",
      }],
      ingredients: [],
      generation: null,
    };

    const refreshed = await refreshGeneratedWeek(
      oldWeek,
      recipeRepository,
      catalogRepository([BEEF]),
      new Date("2026-09-15T14:00:00Z"),
    );

    expect(refreshed.days[0].recipeId).toBe(RECIPE.id);
    expect(refreshed.status).toBe("generationPartial");
    expect(refreshed.ingredients).toHaveLength(2);
  });
});
