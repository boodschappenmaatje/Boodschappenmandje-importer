import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { prepareIngredientLibrary } from "../src/ingredient-library.mjs";
import {
  matchIngredientTerm,
  normalizeRecipeIngredientUnit,
  prepareRecipeIngredientRelations,
} from "../src/recipe-ingredients.mjs";

const [mentionSource, ingredientSource, recipeSource] = await Promise.all([
  readFile(new URL("../data/recipe-ingredients.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/ingredients.json", import.meta.url), "utf8").then(JSON.parse),
  readFile(new URL("../data/recipes.json", import.meta.url), "utf8").then(JSON.parse),
]);

const prepared = prepareRecipeIngredientRelations({
  recipes: recipeSource.recipes,
  ingredients: ingredientSource.ingredients,
  mentions: mentionSource.mentions,
});

function lookupForTests() {
  const ingredients = prepareIngredientLibrary(ingredientSource.ingredients);
  return {
    bySourceKey: new Map(ingredients.map((item) => [item.sourceKey, item])),
    byExactName: new Map(ingredients.map((item) => [item.name, item])),
    byNormalizedName: new Map(ingredients.map((item) => [item.normalizedName, item])),
    byAlias: new Map(ingredients.flatMap((item) => item.aliases
      .filter((alias) => alias.normalizedAlias !== item.normalizedName)
      .map((alias) => [alias.normalizedAlias, item]))),
  };
}

test("alle 100 Swift-recepten leveren samen exact 403 relationele ingrediëntregels", () => {
  assert.deepEqual(mentionSource.source, {
    swiftRecipes: 100,
    legacyRecipes: 15,
    expandedRecipes: 85,
    rawRecipeIngredientMentions: 403,
    uniqueRecipeIngredientIDs: 114,
    hasFreeTextAmounts: false,
    quantityBasis: "per_person",
  });
  assert.equal(prepared.recipes.length, 100);
  assert.equal(prepared.relations.length, 403);
  assert.equal(prepared.report.distinctIngredients, 114);
  assert.equal(prepared.report.recipesWithRelations, 100);
  assert.deepEqual(prepared.report.recipesWithoutRelations, []);
});

test("werkelijke Ingredient-ID's matchen exact; er zijn geen geforceerde of unmatched koppelingen", () => {
  assert.deepEqual(prepared.report.matchCounts, {
    exact: 403,
    normalized: 0,
    alias: 0,
    semantic: 0,
    unmatched: 0,
  });
  assert.deepEqual(prepared.report.unmatched, []);
  assert.ok(prepared.relations.every(({ matchMethod }) => matchMethod === "exact"));
});

test("de vaste matchvolgorde ondersteunt exact, veilige normalisatie en bestaande aliases", () => {
  const lookup = lookupForTests();
  assert.equal(matchIngredientTerm("groundBeef", lookup).method, "exact");
  assert.equal(matchIngredientTerm(" KIPSATÉ ", lookup).method, "normalized");
  const alias = matchIngredientTerm("UI", lookup);
  assert.equal(alias.method, "alias");
  assert.equal(alias.ingredient.sourceKey, "onion");
  assert.equal(matchIngredientTerm("kipfilet die niet bestaat", lookup).method, "unmatched");
});

test("onbekende termen worden gerapporteerd en nooit fuzzy aan een ingrediënt gekoppeld", () => {
  const result = prepareRecipeIngredientRelations({
    recipes: recipeSource.recipes,
    ingredients: ingredientSource.ingredients,
    mentions: [{
      recipeSourceKey: "spaghetti-bolognese",
      ingredientTerm: "mysterieproduct",
      amountPerPerson: 1,
      unit: "pieces",
      position: 0,
    }],
  });
  assert.equal(result.relations.length, 0);
  assert.equal(result.report.matchCounts.unmatched, 1);
  assert.deepEqual(result.report.unmatched, [{
    recipeSourceKey: "spaghetti-bolognese",
    recipeName: "Spaghetti bolognese",
    ingredientTerm: "mysterieproduct",
    position: 0,
  }]);
});

test("hoeveelheid per persoon en oorspronkelijke positie blijven exact behouden", () => {
  const source = mentionSource.mentions.find((item) => (
    item.recipeSourceKey === "spaghetti-bolognese" && item.ingredientTerm === "carrot"
  ));
  const relation = prepared.relations.find((item) => (
    item.recipeSourceKey === "spaghetti-bolognese" && item.ingredientSourceKey === "carrot"
  ));
  assert.equal(source.amountPerPerson, 75);
  assert.equal(relation.amountPerPerson, source.amountPerPerson);
  assert.equal(relation.position, source.position);
  assert.ok(prepared.relations.every(({ amountPerPerson }) => amountPerPerson > 0));
});

test("eenheden worden alleen via veilige equivalente schrijfwijzen genormaliseerd", () => {
  assert.equal(normalizeRecipeIngredientUnit("grams"), "g");
  assert.equal(normalizeRecipeIngredientUnit("gr"), "g");
  assert.equal(normalizeRecipeIngredientUnit("millilitres"), "ml");
  assert.equal(normalizeRecipeIngredientUnit("stuks"), "piece");
  assert.equal(normalizeRecipeIngredientUnit("litres"), "l");
  assert.equal(normalizeRecipeIngredientUnit("loaves"), "loaf");
  assert.throws(() => normalizeRecipeIngredientUnit("handvol"), /Onbekende/);
  assert.deepEqual(prepared.report.units, ["g", "l", "loaf", "ml", "piece"]);
});

test("posities zijn per recept uniek en aaneengesloten", () => {
  const grouped = Map.groupBy(prepared.relations, ({ recipeSourceKey }) => recipeSourceKey);
  for (const relations of grouped.values()) {
    assert.deepEqual(relations.map(({ position }) => position), relations.map((_, index) => index));
  }
  assert.equal(new Set(prepared.relations.map((item) => `${item.recipeSourceKey}:${item.position}`)).size, 403);
});

test("een technisch dubbele positie wordt geweigerd, maar dezelfde Ingredient-ID kan bewust twee posities innemen", () => {
  const first = mentionSource.mentions[0];
  assert.throws(() => prepareRecipeIngredientRelations({
    recipes: recipeSource.recipes,
    ingredients: ingredientSource.ingredients,
    mentions: [first, { ...first }],
  }), /Dubbele receptpositie/);

  const repeatedIngredient = prepareRecipeIngredientRelations({
    recipes: recipeSource.recipes,
    ingredients: ingredientSource.ingredients,
    mentions: [first, { ...first, position: 1 }],
  });
  assert.equal(repeatedIngredient.relations.length, 2);
});

test("recipe_ingredients-migratie gebruikt UUID-foreign keys en beschermt bestaande tabellen", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260908_create_recipe_ingredients.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /id uuid primary key default gen_random_uuid\(\)/i);
  assert.match(migration, /recipe_id uuid not null references public\.recipes\(id\)/i);
  assert.match(migration, /ingredient_id uuid not null references public\.ingredients\(id\)/i);
  assert.match(migration, /amount_per_person numeric not null/i);
  assert.match(migration, /unique \(recipe_id, position\)/i);
  assert.match(migration, /position >= 0/i);
  assert.match(migration, /enable row level security/i);
  assert.doesNotMatch(migration, /alter table public\.(recipes|ingredients|ingredient_aliases|products|product_prices)/i);
  assert.doesNotMatch(migration, /\b(sku|price|product_type|tag)\b/i);
  assert.doesNotMatch(migration, /delete\s+from|drop\s+table/i);
});

test("seed koppelt via stabiele bronkeys naar UUID's en is idempotent zonder verweesde relaties", async () => {
  const seed = await readFile(
    new URL("../supabase/seeds/20260908_recipe_ingredients.sql", import.meta.url),
    "utf8",
  );
  assert.match(seed, /403 relaties voor 100 bestaande recepten/);
  assert.equal((seed.match(/^  \('/gm) ?? []).length, 403);
  assert.match(seed, /join public\.recipes recipe on recipe\.source_key = seed\.recipe_source_key/i);
  assert.match(seed, /join public\.ingredients ingredient on ingredient\.source_key = seed\.ingredient_source_key/i);
  assert.match(seed, /on conflict \(recipe_id, position\) do update/i);
  assert.match(seed, /where recipe\.id is null or ingredient\.id is null/i);
  assert.doesNotMatch(seed, /delete\s+from|truncate|drop\s+table/i);
  assert.doesNotMatch(seed, /public\.(products|product_prices|ingredient_aliases)/i);
  assert.doesNotMatch(seed, /\b(sku|price|product_type|tag)\b/i);
});

test("bestaande bibliotheken blijven compleet en relaties bevatten geen productkoppeling", () => {
  const ingredients = prepareIngredientLibrary(ingredientSource.ingredients);
  assert.equal(recipeSource.recipes.length, 100);
  assert.equal(ingredients.length, 140);
  assert.equal(ingredients.flatMap(({ aliases }) => aliases).length, 205);
  assert.ok(prepared.relations.every((relation) => (
    !Object.hasOwn(relation, "productID")
    && !Object.hasOwn(relation, "sku")
    && !Object.hasOwn(relation, "price")
  )));
});
