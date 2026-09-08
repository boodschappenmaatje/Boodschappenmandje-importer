import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { prepareRecipeIngredientRelations } from "../src/recipe-ingredients.mjs";

const mentionURL = new URL("../data/recipe-ingredients.json", import.meta.url);
const ingredientURL = new URL("../data/ingredients.json", import.meta.url);
const recipeURL = new URL("../data/recipes.json", import.meta.url);
const outputURL = new URL("../supabase/seeds/20260908_recipe_ingredients.sql", import.meta.url);

function sqlString(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

export function renderRecipeIngredientSeed({ mentions, ingredients, recipes }) {
  const prepared = prepareRecipeIngredientRelations({
    recipes: recipes.recipes,
    ingredients: ingredients.ingredients,
    mentions: mentions.mentions,
  });
  if (prepared.report.unmatched.length > 0) {
    const details = prepared.report.unmatched
      .map(({ recipeSourceKey, ingredientTerm }) => `${recipeSourceKey}: ${ingredientTerm}`)
      .join(", ");
    throw new Error(`Niet-gekoppelde receptingrediënten: ${details}`);
  }

  const rows = prepared.relations.map((relation) => `  (${[
    sqlString(relation.recipeSourceKey),
    sqlString(relation.ingredientSourceKey),
    relation.amountPerPerson,
    sqlString(relation.unit),
    relation.position,
  ].join(", ")})`).join(",\n");

  return `-- Gegenereerd uit data/recipe-ingredients.json. Bewerk de brondata, niet dit bestand.\n`
    + `-- ${prepared.report.generatedRelations} relaties voor ${prepared.report.recipesWithRelations} bestaande recepten.\n`
    + `-- Hoeveelheden zijn per persoon, conform IngredientNeed.amountPerPerson in Swift.\n`
    + `begin;\n\n`
    + `create temporary table recipe_ingredient_seed_data (\n`
    + `  recipe_source_key text not null,\n  ingredient_source_key text not null,\n`
    + `  amount_per_person numeric not null,\n  unit text not null,\n  position integer not null,\n`
    + `  primary key (recipe_source_key, position)\n) on commit drop;\n\n`
    + `insert into recipe_ingredient_seed_data (\n`
    + `  recipe_source_key, ingredient_source_key, amount_per_person, unit, position\n`
    + `) values\n${rows};\n\n`
    + `do $$\nbegin\n`
    + `  if (select count(*) from recipe_ingredient_seed_data) <> ${prepared.report.generatedRelations} then\n`
    + `    raise exception 'Onvolledige recipe_ingredients-brondata.';\n  end if;\n`
    + `  if exists (\n    select 1\n    from recipe_ingredient_seed_data seed\n`
    + `    left join public.recipes recipe on recipe.source_key = seed.recipe_source_key\n`
    + `    left join public.ingredients ingredient on ingredient.source_key = seed.ingredient_source_key\n`
    + `    where recipe.id is null or ingredient.id is null\n  ) then\n`
    + `    raise exception 'Recipe- of Ingredient-ID ontbreekt; seed is niet uitgevoerd.';\n  end if;\n`
    + `  if (\n    select count(distinct recipe_source_key)\n    from recipe_ingredient_seed_data\n  ) <> ${prepared.report.recipesWithRelations} then\n`
    + `    raise exception 'Niet alle recepten hebben ingrediëntrelaties.';\n  end if;\nend $$;\n\n`
    + `insert into public.recipe_ingredients (\n`
    + `  recipe_id, ingredient_id, amount_per_person, unit, position\n)\n`
    + `select recipe.id, ingredient.id, seed.amount_per_person, seed.unit, seed.position\n`
    + `from recipe_ingredient_seed_data seed\n`
    + `join public.recipes recipe on recipe.source_key = seed.recipe_source_key\n`
    + `join public.ingredients ingredient on ingredient.source_key = seed.ingredient_source_key\n`
    + `on conflict (recipe_id, position) do update set\n`
    + `  ingredient_id = excluded.ingredient_id,\n`
    + `  amount_per_person = excluded.amount_per_person,\n`
    + `  unit = excluded.unit,\n`
    + `  updated_at = now();\n\ncommit;\n`;
}

const [mentions, ingredients, recipes] = await Promise.all([
  readFile(mentionURL, "utf8").then(JSON.parse),
  readFile(ingredientURL, "utf8").then(JSON.parse),
  readFile(recipeURL, "utf8").then(JSON.parse),
]);
const rendered = renderRecipeIngredientSeed({ mentions, ingredients, recipes });

if (process.argv.includes("--check")) {
  const current = await readFile(outputURL, "utf8").catch(() => "");
  if (current !== rendered) {
    throw new Error("Recipe-ingredientseed is niet actueel. Voer npm run build:recipe-ingredient-seed uit.");
  }
} else {
  await writeFile(fileURLToPath(outputURL), rendered, "utf8");
  console.log(`Recipe-ingredientseed geschreven: ${mentions.mentions.length} bronregels.`);
}
