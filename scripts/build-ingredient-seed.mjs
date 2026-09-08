import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { prepareIngredientLibrary } from "../src/ingredient-library.mjs";

const inputURL = new URL("../data/ingredients.json", import.meta.url);
const outputURL = new URL("../supabase/seeds/20260908_ingredients.sql", import.meta.url);

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function renderIngredientSeed(source) {
  const ingredients = prepareIngredientLibrary(source.ingredients);
  const ingredientRows = ingredients.map((item) => `  (${[
    item.sourceKey, item.name, item.normalizedName, item.defaultUnit, item.category,
  ].map(sqlString).join(", ")})`).join(",\n");
  const aliasRows = ingredients.flatMap((item) => item.aliases.map((alias) => `  (${[
    item.sourceKey, alias.alias, alias.normalizedAlias,
  ].map(sqlString).join(", ")})`)).join(",\n");

  return `-- Gegenereerd uit data/ingredients.json. Bewerk de JSON-bron, niet dit bestand.\n`
    + `-- ${ingredients.length} bestaande centrale IngredientDefinition-items uit BoodschappenMaatje.\n`
    + `begin;\n\n`
    + `create temporary table ingredient_seed_data (\n`
    + `  source_key text primary key,\n  name text not null,\n  normalized_name text not null,\n`
    + `  default_unit text not null,\n  category text not null\n) on commit drop;\n\n`
    + `insert into ingredient_seed_data (source_key, name, normalized_name, default_unit, category) values\n`
    + `${ingredientRows};\n\n`
    + `insert into public.ingredients (source_key, name, normalized_name, default_unit, category)\n`
    + `select source_key, name, normalized_name, default_unit, category\nfrom ingredient_seed_data\n`
    + `on conflict (source_key) do update set\n`
    + `  name = excluded.name,\n  normalized_name = excluded.normalized_name,\n`
    + `  default_unit = excluded.default_unit,\n  category = excluded.category,\n  updated_at = now();\n\n`
    + `create temporary table ingredient_alias_seed_data (\n`
    + `  source_key text not null,\n  alias text not null,\n  normalized_alias text not null\n) on commit drop;\n\n`
    + `insert into ingredient_alias_seed_data (source_key, alias, normalized_alias) values\n`
    + `${aliasRows};\n\n`
    + `do $$\nbegin\n`
    + `  if exists (\n`
    + `    select 1\n    from ingredient_alias_seed_data seed\n`
    + `    join public.ingredient_aliases existing using (normalized_alias)\n`
    + `    join public.ingredients owner on owner.id = existing.ingredient_id\n`
    + `    where owner.source_key <> seed.source_key\n  ) then\n`
    + `    raise exception 'Een genormaliseerde alias is al gekoppeld aan een ander ingrediënt.';\n`
    + `  end if;\nend $$;\n\n`
    + `insert into public.ingredient_aliases (ingredient_id, alias, normalized_alias)\n`
    + `select ingredient.id, seed.alias, seed.normalized_alias\n`
    + `from ingredient_alias_seed_data seed\n`
    + `join public.ingredients ingredient using (source_key)\n`
    + `on conflict (normalized_alias) do update set\n`
    + `  alias = excluded.alias,\n  updated_at = now()\n`
    + `where public.ingredient_aliases.ingredient_id = excluded.ingredient_id;\n\n`
    + `commit;\n`;
}

const source = JSON.parse(await readFile(inputURL, "utf8"));
const rendered = renderIngredientSeed(source);

if (process.argv.includes("--check")) {
  const current = await readFile(outputURL, "utf8").catch(() => "");
  if (current !== rendered) {
    throw new Error("Ingrediëntenseed is niet actueel. Voer npm run build:ingredient-seed uit.");
  }
} else {
  await writeFile(fileURLToPath(outputURL), rendered, "utf8");
  console.log(`Ingrediëntenseed geschreven: ${source.ingredients.length} bronrecords.`);
}

