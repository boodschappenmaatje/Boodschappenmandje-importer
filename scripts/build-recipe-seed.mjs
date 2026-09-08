import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { prepareRecipeLibrary } from "../src/recipe-library.mjs";

const inputURL = new URL("../data/recipes.json", import.meta.url);
const outputURL = new URL("../supabase/seeds/20260908_recipes.sql", import.meta.url);

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlBoolean(value) {
  return value ? "true" : "false";
}

export function renderRecipeSeed(source) {
  const recipes = prepareRecipeLibrary(source.recipes);
  const rows = recipes.map((recipe) => `  (${[
    sqlString(recipe.sourceKey),
    sqlString(recipe.name),
    sqlString(recipe.normalizedName),
    sqlString(recipe.symbol),
    recipe.preparationMinutes,
    sqlBoolean(recipe.vegetarian),
    sqlBoolean(recipe.containsPork),
    sqlBoolean(recipe.kidFriendly),
    sqlBoolean(recipe.healthy),
    sqlString(recipe.budgetTier),
  ].join(", ")})`).join(",\n");

  return `-- Gegenereerd uit data/recipes.json. Bewerk de JSON-bron, niet dit bestand.\n`
    + `-- ${recipes.length} bestaande recepten uit BoodschappenMaatje; ingrediënten en tags volgen later.\n`
    + `begin;\n\n`
    + `create temporary table recipe_seed_data (\n`
    + `  source_key text primary key,\n  name text not null,\n  normalized_name text not null,\n`
    + `  symbol text not null,\n  preparation_minutes integer not null,\n`
    + `  vegetarian boolean not null,\n  contains_pork boolean not null,\n`
    + `  kid_friendly boolean not null,\n  healthy boolean not null,\n`
    + `  budget_tier text not null\n) on commit drop;\n\n`
    + `insert into recipe_seed_data (\n`
    + `  source_key, name, normalized_name, symbol, preparation_minutes,\n`
    + `  vegetarian, contains_pork, kid_friendly, healthy, budget_tier\n`
    + `) values\n${rows};\n\n`
    + `insert into public.recipes (\n`
    + `  source_key, name, normalized_name, symbol, preparation_minutes,\n`
    + `  vegetarian, contains_pork, kid_friendly, healthy, budget_tier\n`
    + `)\nselect\n`
    + `  source_key, name, normalized_name, symbol, preparation_minutes,\n`
    + `  vegetarian, contains_pork, kid_friendly, healthy, budget_tier\n`
    + `from recipe_seed_data\n`
    + `on conflict (source_key) do update set\n`
    + `  name = excluded.name,\n  normalized_name = excluded.normalized_name,\n`
    + `  symbol = excluded.symbol,\n  preparation_minutes = excluded.preparation_minutes,\n`
    + `  vegetarian = excluded.vegetarian,\n  contains_pork = excluded.contains_pork,\n`
    + `  kid_friendly = excluded.kid_friendly,\n  healthy = excluded.healthy,\n`
    + `  budget_tier = excluded.budget_tier,\n  updated_at = now();\n\n`
    + `commit;\n`;
}

const source = JSON.parse(await readFile(inputURL, "utf8"));
const rendered = renderRecipeSeed(source);

if (process.argv.includes("--check")) {
  const current = await readFile(outputURL, "utf8").catch(() => "");
  if (current !== rendered) {
    throw new Error("Receptenseed is niet actueel. Voer npm run build:recipe-seed uit.");
  }
} else {
  await writeFile(fileURLToPath(outputURL), rendered, "utf8");
  console.log(`Receptenseed geschreven: ${source.recipes.length} bronrecords.`);
}

