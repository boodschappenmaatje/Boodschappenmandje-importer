import { describe, expect, it } from "vitest";

import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import {
  applyProductToRequirement,
  isReliableIngredientMatch,
  productPackageCapacity,
  selectIngredientProduct,
} from "@/services/week-preparation/product-matching";
import {
  evaluateRecipeReadiness,
  readyRecipeIds,
} from "@/services/week-preparation/recipe-readiness";
import { mealMixSupplementAliases } from "@/services/week-preparation/meal-mix-profiles";
import type {
  RecipeCatalog,
  RecipeIngredientDefinition,
} from "@/services/week-preparation/recipe-repository";
import { selectRecipesForDays } from "@/services/week-preparation/recipe-selection";
import type { Product, Recipe, RecipeIngredient } from "@/types/catalog";
import type { PreparedDay, WeekPreferences } from "@/types/week-preparation";

const NOW = "2026-09-17T12:00:00.000Z";
const RECIPE: Recipe = {
  id: "recipe-pasta",
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
const BEEF: RecipeIngredientDefinition = {
  id: "ingredient-beef",
  sourceKey: "groundBeef",
  name: "rundergehakt",
  normalizedName: "rundergehakt",
  defaultUnit: "grams",
  category: "Vlees",
  aliases: ["rundergehakt", "gehakt"],
};
const PARSLEY: RecipeIngredientDefinition = {
  id: "ingredient-parsley",
  sourceKey: "parsley",
  name: "peterselie",
  normalizedName: "peterselie",
  defaultUnit: "grams",
  category: "Groente",
  aliases: ["peterselie"],
};
const RELATION: RecipeIngredient = {
  id: "relation-beef",
  recipeId: RECIPE.id,
  ingredientId: BEEF.id,
  amountPerPerson: 175,
  unit: "g",
  position: 0,
  optional: false,
};
const PREFERENCES: WeekPreferences = {
  noVegetarian: false,
  quickImportant: false,
  healthyImportant: false,
  budgetImportant: false,
};

function product(
  input: Partial<Product> & Pick<Product, "id" | "sku" | "name">,
): Product {
  return {
    supermarket: "Hoogvliet",
    brand: "Hoogvliet",
    category: "Vlees",
    productType: "Rundergehakt",
    packageText: "500 g",
    weightGrams: 500,
    imageUrl: null,
    sourceUrl: `https://www.hoogvliet.com/product/${input.sku}`,
    isAvailable: true,
    updatedAt: NOW,
    currentPrice: {
      productId: input.id,
      price: 4.99,
      oldPrice: null,
      isOffer: false,
      offerText: null,
      validFrom: null,
      validUntil: null,
      fetchedAt: NOW,
      updatedAt: NOW,
    },
    ...input,
  };
}

function repository(
  search: (term: string) => Product[],
): CatalogRepository {
  return {
    async getPage() {
      return { products: [], priceStatus: "complete", page: 1, pageSize: 20, hasMore: false };
    },
    async getByIds() {
      return { products: [], priceStatus: "complete" };
    },
    async query(request = {}) {
      return {
        products: search(request.term ?? ""),
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
      return { products: search(term), priceStatus: "complete" };
    },
    async getFilterOptions() {
      return { categories: [], brands: [] };
    },
  };
}

function catalog(
  ingredients: RecipeIngredientDefinition[] = [BEEF],
  relations: RecipeIngredient[] = [RELATION],
  recipes: Recipe[] = [RECIPE],
): RecipeCatalog {
  return { recipes, ingredients, relations };
}

function matchingRepository(products: Product[]): CatalogRepository {
  return repository((term) => {
    const normalized = term.toLocaleLowerCase("nl-NL");
    return products.filter((item) =>
      [item.name, item.productType, item.category]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("nl-NL")
        .includes(normalized),
    );
  });
}

describe("Recipe Readiness Gate", () => {
  it.each(Array.from({ length: 10 }, (_, index) => index + 1))("herkent hacheevlees uit echte stoofriblap voor %i personen", async (people) => {
    const ingredient: RecipeIngredientDefinition = { id: "hachee", sourceKey: "mix-supplement-hacheevlees",
      name: "hacheevlees", normalizedName: "hacheevlees", defaultUnit: "g", category: "Vlees",
      aliases: ["hacheevlees", ...mealMixSupplementAliases("hacheevlees")] };
    const relation = { ...RELATION, ingredientId: ingredient.id, unit: "g" as const, amountPerPerson: 125 };
    const riblappen = product({ id: "riblappen", sku: "733659000", name: "Hoogvliet Riblappen",
      productType: "Varkensvlees", category: "Vlees, vis, vegetarisch/Rund-en varkensvlees/Stoofvlees",
      packageText: "Ca. 700 gram", weightGrams: 700,
      currentPrice: { productId: "riblappen", price: 14.34, oldPrice: null, isOffer: false,
        offerText: null, validFrom: null, validUntil: null, fetchedAt: NOW, updatedAt: NOW } });
    const gate = await evaluateRecipeReadiness([RECIPE], people,
      catalog([ingredient], [relation]), matchingRepository([riblappen]));
    expect(gate.recipes[0]).toMatchObject({ ready: true, problemCount: 0 });
    expect(gate.recipes[0].ingredients[0]).toMatchObject({ sku: "733659000",
      requiredQuantity: people * 125, reliableProductMatch: true, priceKnown: true, packageCalculable: true });
  });

  it.each(Array.from({ length: 10 }, (_, index) => index + 1))("houdt pita in stuks NOT_READY voor een eis van %i × 100 gram", async (people) => {
    const ingredient: RecipeIngredientDefinition = { id: "pita", sourceKey: "mix-supplement-pitabroodjes",
      name: "pitabroodjes", normalizedName: "pitabroodjes", defaultUnit: "g", category: "Brood",
      aliases: ["pitabroodjes", ...mealMixSupplementAliases("pitabroodjes")] };
    const relation = { ...RELATION, ingredientId: ingredient.id, unit: "g" as const, amountPerPerson: 100 };
    const pita = product({ id: "pita", sku: "675984000", name: "G'woon Pita broodjes",
      category: "Brood/Thuis afbakken/Afbakbroodjes", productType: "Broodjes", packageText: "10 stuk",
      weightGrams: null, currentPrice: { productId: "pita", price: 0.79, oldPrice: null,
        isOffer: false, offerText: null, validFrom: null, validUntil: null,
        fetchedAt: NOW, updatedAt: NOW } });
    const gate = await evaluateRecipeReadiness([RECIPE], people,
      catalog([ingredient], [relation]), matchingRepository([pita]));
    expect(gate.recipes[0]).toMatchObject({ ready: false, problemCount: 1 });
    expect(gate.recipes[0].ingredients[0]).toMatchObject({ sku: "675984000",
      requiredQuantity: people * 100, priceKnown: true, packageCalculable: false,
      reason: "package_unknown" });
  });
  it.each(Array.from({ length: 10 }, (_, index) => index + 1))("blokkeert %i-persoonsmix met verse tomaten zonder bekend stukaantal", async (people) => {
    const tomato: RecipeIngredientDefinition = {
      id: "mix-tomato", sourceKey: "mix-supplement-tomaten", name: "tomaten",
      normalizedName: "tomaten", defaultUnit: "piece", category: "Groente", aliases: ["tomaten", "trostomaten"],
    };
    const canned = product({ id: "canned", sku: "733141000", name: "Mutti Gepelde tomaten",
      category: "Internationale keuken, pasta, rijst/Italiaanse keuken/Tomatenbasis",
      productType: "Pasta", packageText: "400 gram", weightGrams: 400 });
    const small = product({ id: "small", sku: "070476000", name: "Cherry tomaten",
      category: "Aardappelen, groente, fruit/Groente/Tomaat, paprika",
      productType: "Aardappelen", packageText: "250 gram", weightGrams: 250 });
    const fresh = product({ id: "fresh", sku: "060936000", name: "Trostomaten",
      category: "Aardappelen, groente, fruit/Groente/Tomaat, paprika",
      productType: "Aardappelen", packageText: "500 gram", weightGrams: 500 });
    const relation = { ...RELATION, ingredientId: tomato.id, unit: "piece" as const, amountPerPerson: 1 };
    const gate = await evaluateRecipeReadiness([RECIPE], people,
      catalog([tomato], [relation]), repository(() => [canned, small, fresh]));
    expect(gate.recipes[0]).toMatchObject({ ready: false, problemCount: 1 });
    expect(gate.recipes[0].ingredients[0]).toMatchObject({
      sku: "060936000", requiredQuantity: people, priceKnown: true,
      packageCalculable: false, reason: "package_unknown", origin: "catalogCoverage",
    });
  });
  it("markeert een recept pas READY als alle verplichte controles slagen", async () => {
    const realProduct = product({ id: "product-beef", sku: "871000001", name: "Hoogvliet rundergehakt" });
    const gate = await evaluateRecipeReadiness(
      [RECIPE],
      4,
      catalog(),
      matchingRepository([realProduct]),
    );

    expect(gate.recipes[0]).toMatchObject({
      ready: true,
      requiredIngredientCount: 1,
      readyRequiredIngredientCount: 1,
      problemCount: 0,
    });
    expect(gate.recipes[0].ingredients[0]).toMatchObject({
      requiredQuantity: 700,
      catalogProductAvailable: true,
      reliableProductMatch: true,
      priceKnown: true,
      packageCalculable: true,
      sku: "871000001",
    });
  });

  it.each([
    {
      label: "ontbrekend catalogusproduct",
      products: [] as Product[],
      reason: "no_catalog_product",
      origin: "catalogCoverage",
    },
    {
      label: "te lage matchzekerheid",
      products: [product({ id: "product-vink", sku: "871000002", name: "Rundervinken", productType: "Rundervink" })],
      reason: "low_confidence_match",
      origin: "catalogCoverage",
    },
    {
      label: "categorieconflict",
      products: [product({ id: "product-spinach", sku: "871000003", name: "Spinazie fijn gehakt", category: "Groente", productType: "Spinazie" })],
      reason: "category_mismatch",
      origin: "catalogCoverage",
    },
    {
      label: "ontbrekende prijs",
      products: [product({ id: "product-no-price", sku: "871000004", name: "Rundergehakt", currentPrice: null })],
      reason: "missing_price",
      origin: "catalogCoverage",
    },
    {
      label: "nulprijs",
      products: [product({ id: "product-zero-price", sku: "871000006", name: "Rundergehakt", currentPrice: {
        productId: "product-zero-price", price: 0, oldPrice: null, isOffer: false, offerText: null,
        validFrom: null, validUntil: null, fetchedAt: NOW, updatedAt: NOW,
      } })],
      reason: "missing_price",
      origin: "catalogCoverage",
    },
    {
      label: "onbekende verpakking",
      products: [product({ id: "product-pieces", sku: "871000005", name: "Rundergehakt", packageText: "8 stuks", weightGrams: null })],
      reason: "package_unknown",
      origin: "catalogCoverage",
    },
  ])("blokkeert een required ingrediënt bij $label", async ({ products, reason, origin }) => {
    const gate = await evaluateRecipeReadiness(
      [RECIPE],
      4,
      catalog(),
      repository(() => products),
    );
    expect(gate.recipes[0].ready).toBe(false);
    expect(gate.recipes[0].ingredients[0]).toMatchObject({ reason, origin });
  });

  it("laat een ontbrekend optioneel ingrediënt toe", async () => {
    const optionalRelation: RecipeIngredient = {
      id: "relation-parsley",
      recipeId: RECIPE.id,
      ingredientId: PARSLEY.id,
      amountPerPerson: 2,
      unit: "g",
      position: 1,
      optional: true,
    };
    const realProduct = product({ id: "product-beef", sku: "871000006", name: "Rundergehakt" });
    const gate = await evaluateRecipeReadiness(
      [RECIPE],
      4,
      catalog([BEEF, PARSLEY], [RELATION, optionalRelation]),
      matchingRepository([realProduct]),
    );
    expect(gate.recipes[0]).toMatchObject({
      ready: true,
      requiredIngredientCount: 1,
      readyRequiredIngredientCount: 1,
      problemCount: 1,
    });
    expect(gate.recipes[0].ingredients.find((item) => item.sourceKey === "parsley")).toMatchObject({
      required: false,
      ready: false,
      reason: "no_catalog_product",
    });
  });

  it("hercontroleert tegen de actuele catalogus en keurt niet permanent af", async () => {
    const before = await evaluateRecipeReadiness([RECIPE], 4, catalog(), repository(() => []));
    const after = await evaluateRecipeReadiness(
      [RECIPE],
      4,
      catalog(),
      matchingRepository([
        product({ id: "product-later", sku: "871000007", name: "Rundergehakt" }),
      ]),
    );
    expect(before.recipes[0].ready).toBe(false);
    expect(after.recipes[0].ready).toBe(true);

    const day: PreparedDay = {
      dayIndex: 0,
      category: "pasta",
      freeChoice: false,
      recipeId: null,
      recipe: null,
      status: "categoryAssigned",
    };
    expect(
      selectRecipesForDays(
        [day],
        [RECIPE],
        PREFERENCES,
        "current-catalog",
        readyRecipeIds(before),
      )[0].recipeId,
    ).toBeNull();
    expect(
      selectRecipesForDays(
        [day],
        [RECIPE],
        PREFERENCES,
        "current-catalog",
        readyRecipeIds(after),
      )[0].recipeId,
    ).toBe(RECIPE.id);
  });

  it("filtert NOT READY kandidaten vóór selectie en gebruikt geen incomplete fallback", async () => {
    const second: Recipe = {
      ...RECIPE,
      id: "recipe-macaroni",
      sourceKey: "macaroni",
      name: "Macaroni",
      normalizedName: "macaroni",
    };
    const secondRelation: RecipeIngredient = {
      ...RELATION,
      id: "relation-second",
      recipeId: second.id,
    };
    const gate = await evaluateRecipeReadiness(
      [RECIPE, second],
      4,
      catalog([BEEF], [RELATION, secondRelation], [RECIPE, second]),
      matchingRepository([
        product({ id: "product-beef", sku: "871000008", name: "Rundergehakt" }),
      ]),
    );
    const day: PreparedDay = {
      dayIndex: 0,
      category: "pasta",
      freeChoice: false,
      recipeId: null,
      recipe: null,
      status: "categoryAssigned",
    };
    const selected = selectRecipesForDays(
      [day],
      [RECIPE, second],
      PREFERENCES,
      "week",
      readyRecipeIds(gate),
    );
    expect(selected[0].recipeId).not.toBeNull();

    const noFallback = selectRecipesForDays(
      [day],
      [RECIPE, second],
      PREFERENCES,
      "week",
      new Set(),
    );
    expect(noFallback[0]).toMatchObject({
      recipeId: null,
      recipe: null,
      status: "categoryAssigned",
    });
  });

  it("filtert een incomplete snelle tosti vóór selectie tussen meerdere READY kandidaten", async () => {
    const tosti: Recipe = {
      ...RECIPE,
      id: "recipe-luxe-tosti",
      sourceKey: "luxe-tosti-ham-kaas-tomaat",
      name: "Luxe tosti’s met ham, kaas en tomaat",
      normalizedName: "luxe tostis met ham kaas en tomaat",
      preparationMinutes: 15,
    };
    const quickOne: Recipe = {
      ...RECIPE,
      id: "recipe-quick-one",
      sourceKey: "snelle-gehaktschotel",
      name: "Snelle gehaktschotel",
      normalizedName: "snelle gehaktschotel",
      preparationMinutes: 20,
    };
    const quickTwo: Recipe = {
      ...RECIPE,
      id: "recipe-quick-two",
      sourceKey: "gehakt-wraps",
      name: "Gehaktwraps",
      normalizedName: "gehaktwraps",
      preparationMinutes: 20,
    };
    const ham: RecipeIngredientDefinition = {
      id: "ingredient-ham",
      sourceKey: "ham",
      name: "achterham",
      normalizedName: "achterham",
      defaultUnit: "grams",
      category: "Vleeswaren",
      aliases: ["achterham", "ham"],
    };
    const relations: RecipeIngredient[] = [
      {
        ...RELATION,
        id: "relation-tosti-ham",
        recipeId: tosti.id,
        ingredientId: ham.id,
      },
      { ...RELATION, id: "relation-quick-one", recipeId: quickOne.id },
      { ...RELATION, id: "relation-quick-two", recipeId: quickTwo.id },
    ];
    const recipes = [tosti, quickOne, quickTwo];
    const gate = await evaluateRecipeReadiness(
      recipes,
      4,
      catalog([BEEF, ham], relations, recipes),
      matchingRepository([
        product({ id: "product-ready-beef", sku: "871000011", name: "Rundergehakt" }),
      ]),
    );
    const readiness = new Map(gate.recipes.map((result) => [result.recipeId, result.ready]));
    expect(readiness.get(tosti.id)).toBe(false);
    expect(readiness.get(quickOne.id)).toBe(true);
    expect(readiness.get(quickTwo.id)).toBe(true);

    const selected = selectRecipesForDays(
      [{
        dayIndex: 0,
        category: "quick",
        freeChoice: false,
        recipeId: null,
        recipe: null,
        status: "categoryAssigned",
      }],
      recipes,
      PREFERENCES,
      "simple-and-fast",
      readyRecipeIds(gate),
    );

    expect(selected[0].recipeId).not.toBe(tosti.id);
    expect([quickOne.id, quickTwo.id]).toContain(selected[0].recipeId);
  });

  it("classificeert receptdata, matcherfailure en ongeldige referenties afzonderlijk", async () => {
    const noAliases = { ...BEEF, aliases: [] };
    const aliasGate = await evaluateRecipeReadiness(
      [RECIPE],
      4,
      catalog([noAliases]),
      repository(() => []),
    );
    expect(aliasGate.recipes[0].ingredients[0]).toMatchObject({
      reason: "alias_missing",
      origin: "recipeData",
    });

    const unavailable = product({
      id: "product-unavailable",
      sku: "871000009",
      name: "Rundergehakt",
      isAvailable: false,
    });
    const matcherGate = await evaluateRecipeReadiness(
      [RECIPE],
      4,
      catalog(),
      repository(() => [unavailable]),
    );
    expect(matcherGate.recipes[0].ingredients[0]).toMatchObject({
      reason: "matcher_failed",
      origin: "softwareOrMatching",
    });

    const invalidPriceReference = product({
      id: "product-invalid-reference",
      sku: "871000010",
      name: "Rundergehakt",
    });
    invalidPriceReference.currentPrice = {
      ...invalidPriceReference.currentPrice!,
      productId: "different-product",
    };
    const referenceGate = await evaluateRecipeReadiness(
      [RECIPE],
      4,
      catalog(),
      repository(() => [invalidPriceReference]),
    );
    expect(referenceGate.recipes[0].ingredients[0]).toMatchObject({
      reason: "product_reference_invalid",
      origin: "softwareOrMatching",
    });
  });
});

describe("generieke matching en verpakkingseenheden", () => {
  it("accepteert veilige samenstelling en korte meervoudsuitgang in productnamen", () => {
    const fishSchnitzel: RecipeIngredientDefinition = {
      ...BEEF,
      id: "ingredient-fish-schnitzel",
      sourceKey: "fishSchnitzel",
      name: "visschnitzel",
      normalizedName: "visschnitzel",
      category: "Vis",
      aliases: ["visschnitzel"],
    };
    const nachos: RecipeIngredientDefinition = {
      ...BEEF,
      id: "ingredient-nachos",
      sourceKey: "nachos",
      name: "tortillachips",
      normalizedName: "tortillachips",
      category: "Snacks",
      aliases: ["tortillachips"],
    };

    expect(isReliableIngredientMatch(fishSchnitzel, product({
      id: "product-visschnitzels",
      sku: "871000019",
      name: "Iglo Fish & Fun visschnitzels familieverpakking",
      category: "Vis",
      productType: "Visschnitzel",
    }))).toBe(true);
    expect(isReliableIngredientMatch(nachos, product({
      id: "product-tortilla-chips",
      sku: "871000020",
      name: "Santa Maria Tortilla chips salted",
      category: "Snacks/Chips",
      productType: "Tortilla chips",
    }))).toBe(true);
  });

  it("verruimt korte termen niet tot toevallige deelwoorden", () => {
    const cola: RecipeIngredientDefinition = {
      ...BEEF,
      id: "ingredient-cola",
      sourceKey: "cola",
      name: "cola",
      normalizedName: "cola",
      category: "Drinken",
      aliases: ["cola"],
    };
    expect(isReliableIngredientMatch(cola, product({
      id: "product-chocolate",
      sku: "871000021",
      name: "Pure chocolade",
      category: "Chocolade",
      productType: "Chocolade",
    }))).toBe(false);
  });

  it.each([
    ["gehakt", "Vlees"],
    ["kip", "Vlees"],
    ["pasta", "Pasta, rijst & granen"],
    ["rijst", "Pasta, rijst & granen"],
    ["aardappel", "Aardappel & zetmeel"],
    ["ui", "Groente"],
    ["paprika", "Groente"],
    ["tomatensaus", "Sauzen & smaakmakers"],
    ["melk", "Zuivel & eieren"],
    ["kaas", "Zuivel & eieren"],
    ["brood", "Brood"],
    ["friet", "Aardappel & zetmeel"],
  ])("matcht %s via hetzelfde alias- en categoriepad", (name, category) => {
    const ingredient: RecipeIngredientDefinition = {
      id: `ingredient-${name}`,
      sourceKey: name,
      name,
      normalizedName: name,
      defaultUnit: "grams",
      category,
      aliases: [name],
    };
    const catalogProduct = product({
      id: `product-${name}`,
      sku: `sku-${name}`,
      name: `Hoogvliet ${name}`,
      category,
      productType: name,
    });
    expect(isReliableIngredientMatch(ingredient, catalogProduct)).toBe(true);
  });

  it("gebruikt ook een onbekende gecureerde alias zonder productie-if", () => {
    const ingredient: RecipeIngredientDefinition = {
      id: "ingredient-generic",
      sourceKey: "generic",
      name: "plantaardige kruimels",
      normalizedName: "plantaardige kruimels",
      defaultUnit: "grams",
      category: "Vegetarische proteïne",
      aliases: ["tempeh flakes"],
    };
    const catalogProduct = product({
      id: "product-generic",
      sku: "871000011",
      name: "Tempeh flakes",
      category: "Vegetarische proteïne",
      productType: "Tempeh",
    });
    expect(isReliableIngredientMatch(ingredient, catalogProduct)).toBe(true);
  });

  it("behandelt de Hoogvliet-hoofdcategorie niet als vegetarisch productkenmerk", () => {
    const meatTaxonomy = "Vlees, vis, vegetarisch/Rund-en varkensvlees/Gehakt";
    const realBeef = product({
      id: "product-taxonomy-beef",
      sku: "871000012",
      name: "Hoogvliet Rundergehakt",
      category: meatTaxonomy,
      productType: "Gehakt",
    });
    const plantBased = product({
      id: "product-taxonomy-plant",
      sku: "871000013",
      name: "Redefine Plantaardig gehakt",
      category: "Vlees, vis, vegetarisch/Vegetarisch/Gehakt",
      productType: "Gehakt",
    });

    expect(isReliableIngredientMatch(BEEF, realBeef)).toBe(true);
    expect(isReliableIngredientMatch(BEEF, plantBased)).toBe(false);
  });

  it("wijst semantisch verkeerde maaltijd- en drankmatches generiek af", () => {
    const fruitIngredient: RecipeIngredientDefinition = {
      ...BEEF,
      id: "ingredient-mango",
      name: "mango",
      normalizedName: "mango",
      category: "Fruit",
      aliases: ["mango"],
    };
    const mangoDrink = product({
      id: "product-mango-drink",
      sku: "871000014",
      name: "Maaza Mango",
      category: "Frisdrank, sappen/Sappen, siropen/Fruitdrank, vruchtensappen",
      productType: "Sap",
    });
    const springOnion: RecipeIngredientDefinition = {
      ...BEEF,
      id: "ingredient-spring-onion",
      name: "bosui",
      normalizedName: "bosui",
      category: "Groente",
      aliases: ["bosui", "lente-ui"],
    };
    const soup = product({
      id: "product-soup",
      sku: "871000015",
      name: "Chinese tomatensoep met lente-ui",
      category: "Maaltijden/Soepen/Maaltijdsoep",
      productType: "Soep",
    });

    expect(isReliableIngredientMatch(fruitIngredient, mangoDrink)).toBe(false);
    expect(isReliableIngredientMatch(springOnion, soup)).toBe(false);
  });

  it("laat een specifieke categorie zwaarder wegen dan een grof producttype", () => {
    const cheese: RecipeIngredientDefinition = {
      ...BEEF,
      id: "ingredient-cheese",
      name: "geraspte kaas",
      normalizedName: "geraspte kaas",
      category: "Zuivel & eieren",
      aliases: ["geraspte kaas"],
    };
    const catalogProduct = product({
      id: "product-cheese",
      sku: "871000018",
      name: "Melkan Geraspte kaas belegen",
      category: "Kaas, vleeswaren, tapas/Kaas/Buitenlandse kaas/Specialiteiten",
      productType: "Vleeswaren",
      packageText: "175 gram",
      weightGrams: 175,
    });

    expect(isReliableIngredientMatch(cheese, catalogProduct)).toBe(true);
  });

  it("geeft bij gelijke matches voorrang aan een berekenbare verpakking", () => {
    const lettuce: RecipeIngredientDefinition = {
      ...BEEF,
      id: "ingredient-lettuce",
      name: "ijsbergsla",
      normalizedName: "ijsbergsla",
      category: "Groente",
      aliases: ["ijsbergsla"],
    };
    const onePiece = product({
      id: "product-lettuce-piece",
      sku: "871000016",
      name: "IJsbergsla",
      category: "Aardappelen, groente, fruit/Groente/Sla",
      productType: "Groente",
      packageText: "1 stuk",
      weightGrams: null,
    });
    const grams = product({
      id: "product-lettuce-grams",
      sku: "871000017",
      name: "IJsbergsla fijn",
      category: "Aardappelen, groente, fruit/Groente/Sla",
      productType: "Groente",
      packageText: "200 gram",
      weightGrams: 200,
    });

    expect(selectIngredientProduct(lettuce, [onePiece, grams], null, "g")?.id)
      .toBe(grams.id);
  });

  it.each([
    ["200 g", "g", 200],
    ["500 g", "g", 500],
    ["1 kg", "g", 1000],
    ["1 kg", "kg", 1],
    ["1 l", "ml", 1000],
    ["250 milliliter", "ml", 250],
    ["1 l", "l", 1],
    ["8 stuks", "piece", 8],
  ] as const)("leest %s betrouwbaar voor %s", (packageText, unit, expected) => {
    const packaged = product({
      id: `package-${packageText}-${unit}`,
      sku: `package-${unit}`,
      name: "Testproduct",
      packageText,
      weightGrams: null,
    });
    expect(productPackageCapacity(packaged, unit)).toBe(expected);
  });

  it.each([
    [190, "g", "200 g", 1],
    [700, "g", "500 g", 2],
    [500, "ml", "1 l", 1],
    [1500, "ml", "1 l", 2],
  ] as const)(
    "rondt %s %s bij verpakking %s naar %s verpakking(en) af",
    (requiredQuantity, unit, packageText, expected) => {
      const packaged = product({
        id: `package-count-${requiredQuantity}-${unit}`,
        sku: `package-count-${requiredQuantity}-${unit}`,
        name: unit === "ml" ? "Testmelk" : "Testproduct",
        packageText,
        weightGrams: null,
      });
      const requirement = {
        ingredientId: "ingredient-package",
        sourceKey: "package",
        name: "Testproduct",
        unit,
        optional: false,
        servingsBase: 1 as const,
        kind: "ingredient" as const,
        brandConstraint: null,
        requiredQuantity,
        purchaseQuantity: null,
        packageCapacity: null,
        usedIn: [],
        product: null,
        price: null,
        productMatchMissing: false,
        packageCalculationMissing: false,
      };
      expect(applyProductToRequirement(requirement, packaged).purchaseQuantity).toBe(expected);
    },
  );
});
