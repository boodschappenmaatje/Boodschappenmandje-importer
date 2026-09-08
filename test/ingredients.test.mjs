import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  INGREDIENT_CATEGORIES,
  normalizeIngredientName,
  prepareIngredientLibrary,
} from "../src/ingredient-library.mjs";

const source = JSON.parse(
  await readFile(new URL("../data/ingredients.json", import.meta.url), "utf8"),
);
const library = prepareIngredientLibrary(source.ingredients);

test("inventaris bevat alle bestaande centrale ingrediënten zonder ontbrekende recept-ID's", () => {
  assert.equal(source.source.swiftDefinitions, 140);
  assert.equal(source.source.legacyDefinitions, 34);
  assert.equal(source.source.expandedDefinitions, 106);
  assert.equal(source.source.rawRecipeMentions, 403);
  assert.equal(source.source.uniqueRecipeIngredientIDs, 114);
  assert.equal(source.source.unusedSubstitutionCandidateDefinitions, 26);
  assert.equal(library.length, 140);
  assert.equal(new Set(library.map(({ sourceKey }) => sourceKey)).size, 140);
});

test("normalisatie is hoofdletter-, diakritisch-, koppelteken- en spatie-ongevoelig", () => {
  assert.equal(normalizeIngredientName("  KIPSATÉ  "), "kipsate");
  assert.equal(normalizeIngredientName("half-om-half   gehakt"), "half om half gehakt");
  assert.equal(normalizeIngredientName("Zuivel & Eieren"), "zuivel en eieren");
  assert.equal(normalizeIngredientName("Burrito's"), "burritos");
});

test("herhaalde identieke definitie maakt geen tweede ingrediënt", () => {
  const one = {
    sourceKey: "onion", name: "Ui", defaultUnit: "pieces", category: "Groente", aliases: ["uien"],
  };
  const prepared = prepareIngredientLibrary([
    one,
    { ...one, name: " ui ", aliases: ["UI", "uien"] },
  ]);
  assert.equal(prepared.length, 1);
  assert.deepEqual(prepared[0].aliases.map(({ normalizedAlias }) => normalizedAlias), ["ui", "uien"]);
});

test("verschillende Ingredient-ID's mogen niet stil tot één canonieke naam samensmelten", () => {
  assert.throws(
    () => prepareIngredientLibrary([
      { sourceKey: "first", name: "Ui", defaultUnit: "pieces", category: "Groente" },
      { sourceKey: "second", name: " ui ", defaultUnit: "pieces", category: "Groente" },
    ]),
    /Dubbele genormaliseerde ingrediëntnaam/,
  );
});

test("expliciete schrijfvarianten verwijzen centraal naar hetzelfde ingrediënt", () => {
  const byID = new Map(library.map((item) => [item.sourceKey, item]));
  assert.deepEqual(
    byID.get("corn").aliases.map(({ normalizedAlias }) => normalizedAlias),
    ["mais", "maiskorrels"],
  );
  assert.ok(byID.get("kipsate").aliases.some(({ normalizedAlias }) => normalizedAlias === "kipsate"));
  assert.ok(byID.get("halfAndHalfMincedMeat").aliases.some(
    ({ normalizedAlias }) => normalizedAlias === "half om half gehakt",
  ));
  assert.ok(byID.get("onion").aliases.some(({ normalizedAlias }) => normalizedAlias === "ui"));
});

test("inhoudelijk verschillende ingrediënten blijven afzonderlijk", () => {
  const byID = new Map(library.map((item) => [item.sourceKey, item]));
  assert.notEqual(byID.get("chicken").normalizedName, byID.get("chickenThigh").normalizedName);
  assert.notEqual(byID.get("rice").normalizedName, byID.get("jasmijnRijst").normalizedName);
  assert.notEqual(byID.get("groundBeef").normalizedName, byID.get("mixedMincedMeat").normalizedName);
});

test("alle ingrediënten hebben alleen centrale toegestane categorieën en eenheden", () => {
  assert.ok(library.every(({ category }) => INGREDIENT_CATEGORIES.includes(category)));
  assert.ok(library.every(({ aliases }) => aliases.length >= 1));
  assert.equal(library.filter(({ category }) => category === "Overig").length, 0);
});

test("migratie maakt een stabiele read-only ingrediëntenlaag zonder producttabellen te wijzigen", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260908_create_ingredients.sql", import.meta.url),
    "utf8",
  );
  assert.match(migration, /create table if not exists public\.ingredients/i);
  assert.match(migration, /id uuid primary key default gen_random_uuid\(\)/i);
  assert.match(migration, /unique \(source_key\)/i);
  assert.match(migration, /unique \(normalized_name\)/i);
  assert.match(migration, /references public\.ingredients\(id\)/i);
  assert.match(migration, /enable row level security/i);
  assert.match(migration, /for select[\s\S]*to anon, authenticated/i);
  assert.match(migration, /revoke insert, update, delete/i);
  assert.doesNotMatch(migration, /alter table public\.(products|product_prices)/i);
  assert.doesNotMatch(migration, /\b(sku|price|amount_per_person)\b/i);
  assert.doesNotMatch(migration, /delete\s+from|drop\s+table/i);
});

test("gegenereerde seed is volledig, idempotent en verwijdert geen bestaande data", async () => {
  const seed = await readFile(
    new URL("../supabase/seeds/20260908_ingredients.sql", import.meta.url),
    "utf8",
  );
  assert.match(seed, /140 bestaande centrale IngredientDefinition-items/);
  assert.match(seed, /on conflict \(source_key\) do update/i);
  assert.match(seed, /on conflict \(normalized_alias\) do update/i);
  assert.match(seed, /join public\.ingredients ingredient using \(source_key\)/i);
  assert.match(seed, /raise exception 'Een genormaliseerde alias is al gekoppeld aan een ander ingrediënt\.'/i);
  assert.doesNotMatch(seed, /delete\s+from|truncate|drop\s+table|public\.(products|product_prices)/i);
  assert.equal((seed.match(/\('(?:[^']|'')+', '(?:[^']|'')+', '(?:[^']|'')+', '(?:[^']|'')+', '(?:[^']|'')+'\)/g) ?? []).length, 140);
});

