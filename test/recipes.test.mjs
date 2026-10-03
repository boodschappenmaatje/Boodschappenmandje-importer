import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  normalizeRecipeName,
  prepareRecipeLibrary,
  RECIPE_BUDGET_TIERS,
} from "../src/recipe-library.mjs";

const source = JSON.parse(
  await readFile(new URL("../data/recipes.json", import.meta.url), "utf8"),
);
const recipes = prepareRecipeLibrary(source.recipes);

test("bestaande Swift-bron bevat exact 100 valide unieke receptrecords", () => {
  assert.deepEqual(source.source, {
    swiftRecipes: 100,
    legacyRecipes: 15,
    expandedRecipes: 85,
    uniqueRecipeIDs: 100,
    uniqueNormalizedNames: 100,
    duplicateRecipeIDs: 0,
    duplicateNormalizedNames: 0,
    missingNames: 0,
    hasPreparationInstructions: false,
    hasStandardServings: false,
    hasStoredRecipePrice: false,
  });
  assert.equal(recipes.length, 100);
  assert.equal(new Set(recipes.map(({ sourceKey }) => sourceKey)).size, 100);
  assert.equal(new Set(recipes.map(({ normalizedName }) => normalizedName)).size, 100);
});

test("receptnormalisatie is veilig hoofdletter-, accent-, leesteken- en spatie-ongevoelig", () => {
  assert.equal(normalizeRecipeName("  KIPSATÉ met FRIET "), "kipsate met friet");
  assert.equal(normalizeRecipeName("Luxe tosti’s"), "luxe tostis");
  assert.equal(normalizeRecipeName("Aardappel-preiovenschotel"), "aardappel preiovenschotel");
});

test("een herhaald identiek bronrecord maakt geen tweede recept", () => {
  const recipe = recipes.find(({ sourceKey }) => sourceKey === "spaghetti-bolognese");
  assert.equal(prepareRecipeLibrary([recipe, { ...recipe }]).length, 1);
});

test("een kleine schrijfvariant met een andere ID wordt als mogelijk duplicaat geweigerd", () => {
  const base = recipes.find(({ sourceKey }) => sourceKey === "spaghetti-bolognese");
  assert.throws(
    () => prepareRecipeLibrary([
      base,
      { ...base, sourceKey: "spaghetti-bolognese-kopie", name: "  SPAGHETTI BOLOGNESE " },
    ]),
    /Dubbele genormaliseerde receptnaam/,
  );
});

test("bestaande receptnamen en inhoudelijke varianten blijven intact", () => {
  const byID = new Map(recipes.map((recipe) => [recipe.sourceKey, recipe]));
  assert.equal(byID.get("spaghetti-bolognese").name, "Spaghetti bolognese");
  assert.equal(byID.get("macaroni").name, "Macaroni met gehakt en groente");
  assert.equal(byID.get("honig-macaroni").name, "Honig macaroni met gehakt en groente");
  assert.notEqual(byID.get("macaroni").normalizedName, byID.get("honig-macaroni").normalizedName);
});

test("lege en technisch ongeldige receptrecords worden gedetecteerd", () => {
  const valid = recipes[0];
  assert.throws(() => prepareRecipeLibrary([{ ...valid, name: " " }]), /geen geldige naam/);
  assert.throws(() => prepareRecipeLibrary([{ ...valid, sourceKey: "geen geldige id" }]), /recept-ID/);
  assert.throws(() => prepareRecipeLibrary([{ ...valid, preparationMinutes: 0 }]), /bereidingstijd/);
  assert.throws(() => prepareRecipeLibrary([{ ...valid, vegetarian: null }]), /vegetarian/);
  assert.throws(() => prepareRecipeLibrary([{ ...valid, budgetTier: "goedkoop" }]), /budgetniveau/);
});

test("alle bestaande filtervelden en budgetniveaus zijn geldig", () => {
  assert.ok(recipes.every(({ budgetTier }) => RECIPE_BUDGET_TIERS.includes(budgetTier)));
  assert.equal(recipes.filter(({ vegetarian }) => vegetarian).length, 32);
  assert.equal(recipes.filter(({ containsPork }) => containsPork).length, 8);
  assert.equal(recipes.filter(({ kidFriendly }) => kidFriendly).length, 91);
  assert.equal(recipes.filter(({ healthy }) => healthy).length, 52);
});

test("de eerder verplichte gerechtgroepen zijn aanwezig zonder nieuwe recepten toe te voegen", () => {
  const names = recipes.map(({ name }) => normalizeRecipeName(name));
  const expectedPatterns = [
    /patat|friet/, /shoarma/, /kapsalon/, /hamburger|cheeseburger/, /pizza/,
    /kipnuggets/, /hotdog/, /pannenkoek/, /tosti/, /wrap/, /taco/, /nacho/,
    /macaroni/, /spaghetti bolognese/, /lasagne/, /nasi/, /bami/, /kip.*rijst|rijst.*kip/,
    /stamppot/, /hutspot/, /boerenkool/, /gehaktbal/, /ovenschotel/,
  ];
  for (const pattern of expectedPatterns) {
    assert.ok(names.some((name) => pattern.test(name)), `Ontbrekende gerechtgroep: ${pattern}`);
  }
  assert.ok(recipes.some(({ vegetarian }) => vegetarian));
  assert.ok(recipes.some(({ healthy }) => healthy));
});

test("stap-5.1-data bevat geen ingrediëntarray, tags, instructies, porties of vaste prijs", () => {
  const allowedKeys = [
    "sourceKey", "name", "symbol", "preparationMinutes", "vegetarian",
    "containsPork", "kidFriendly", "healthy", "budgetTier",
  ].sort();
  for (const recipe of source.recipes) {
    assert.deepEqual(Object.keys(recipe).sort(), allowedKeys);
  }
});

test("recipes-migratie gebruikt stabiele UUID's en blijft klaar voor een latere koppeltabel", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260908121109_create_recipes.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /create table if not exists public\.recipes/i);
  assert.match(migration, /id uuid primary key default gen_random_uuid\(\)/i);
  assert.match(migration, /unique \(source_key\)/i);
  assert.match(migration, /unique \(normalized_name\)/i);
  assert.match(migration, /preparation_minutes integer not null/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /for select[\s\S]*to anon, authenticated/i);
  assert.doesNotMatch(migration, /create table[^;]*recipe_ingredients/i);
  assert.doesNotMatch(migration, /alter table public\.(ingredients|ingredient_aliases|products|product_prices)/i);
  assert.doesNotMatch(migration, /delete\s+from|drop\s+table/i);
});

test("receptenseed bevat exact 100 records en is idempotent zonder andere tabellen te wijzigen", async () => {
  const seed = await readFile(
    new URL("../supabase/seeds/20260908_recipes.sql", import.meta.url),
    "utf8",
  );
  assert.match(seed, /100 bestaande recepten uit BoodschappenMaatje/);
  assert.equal((seed.match(/^  \('/gm) ?? []).length, 100);
  assert.match(seed, /on conflict \(source_key\) do update/i);
  assert.doesNotMatch(seed, /delete\s+from|truncate|drop\s+table/i);
  assert.doesNotMatch(seed, /public\.(ingredients|ingredient_aliases|products|product_prices)/i);
  assert.doesNotMatch(seed, /\b(price|ingredient_id|amount|category|tag)\b/i);
});

