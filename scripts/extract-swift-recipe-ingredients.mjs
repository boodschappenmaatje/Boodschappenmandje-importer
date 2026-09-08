import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const outputURL = new URL("../data/recipe-ingredients.json", import.meta.url);
const ingredientURL = new URL("../data/ingredients.json", import.meta.url);
const recipeURL = new URL("../data/recipes.json", import.meta.url);

function cliValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function balancedCalls(text, marker) {
  const calls = [];
  let searchFrom = 0;
  while (true) {
    const markerIndex = text.indexOf(marker, searchFrom);
    if (markerIndex < 0) break;
    const openIndex = markerIndex + marker.length - 1;
    let depth = 0;
    let quote = null;
    let escaped = false;
    let endIndex = -1;
    for (let index = openIndex; index < text.length; index += 1) {
      const character = text[index];
      if (quote) {
        if (escaped) escaped = false;
        else if (character === "\\") escaped = true;
        else if (character === quote) quote = null;
        continue;
      }
      if (character === '"' || character === "'") {
        quote = character;
      } else if (character === "(") {
        depth += 1;
      } else if (character === ")") {
        depth -= 1;
        if (depth === 0) {
          endIndex = index + 1;
          break;
        }
      }
    }
    if (endIndex < 0) throw new Error(`Niet-afgesloten Swift-aanroep bij teken ${markerIndex}.`);
    calls.push(text.slice(markerIndex, endIndex));
    searchFrom = endIndex;
  }
  return calls;
}

function parseAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Ongeldige Swift-hoeveelheid: ${value}`);
  return amount;
}

function extractLegacyRecipes(source) {
  const start = source.indexOf("static let recipes: [Recipe] = [");
  const end = source.indexOf("] + ExpandedRecipeCatalog.recipes", start);
  if (start < 0 || end < 0) throw new Error("Catalog.recipes kon niet worden afgebakend.");
  return balancedCalls(source.slice(start, end), "Recipe(").map((call) => {
    const id = call.match(/\bid:\s*"([^"]+)"/)?.[1];
    const ingredients = [...call.matchAll(/need\("([^"]+)",\s*([0-9]+(?:\.[0-9]+)?)\)/g)]
      .map((match) => ({ ingredientTerm: match[1], amountPerPerson: parseAmount(match[2]) }));
    if (!id || ingredients.length === 0) throw new Error("Ongeldig legacy-recept in Catalog.swift.");
    return { id, ingredients };
  });
}

function extractExpandedRecipes(source) {
  const start = source.indexOf("static let recipes: [Recipe] = [");
  const end = source.indexOf("private static func ingredient(", start);
  if (start < 0 || end < 0) throw new Error("ExpandedRecipeCatalog.recipes kon niet worden afgebakend.");
  return balancedCalls(source.slice(start, end), "meal(").map((call) => {
    const id = call.match(/^meal\(\s*"([^"]+)"/)?.[1];
    const ingredients = [...call.matchAll(/\("([^"]+)",\s*([0-9]+(?:\.[0-9]+)?)\)/g)]
      .map((match) => ({ ingredientTerm: match[1], amountPerPerson: parseAmount(match[2]) }));
    if (!id || ingredients.length === 0) throw new Error("Ongeldig uitgebreid recept in ExpandedRecipeCatalog.swift.");
    return { id, ingredients };
  });
}

export async function extractSwiftRecipeIngredients(swiftRoot) {
  const [catalogSource, expandedSource, ingredientSource, recipeSource] = await Promise.all([
    readFile(resolve(swiftRoot, "Sources/AppModule/Catalog.swift"), "utf8"),
    readFile(resolve(swiftRoot, "Sources/AppModule/ExpandedRecipeCatalog.swift"), "utf8"),
    readFile(ingredientURL, "utf8").then(JSON.parse),
    readFile(recipeURL, "utf8").then(JSON.parse),
  ]);

  const legacy = extractLegacyRecipes(catalogSource);
  const expanded = extractExpandedRecipes(expandedSource);
  const extracted = [...legacy, ...expanded];
  const unitByIngredient = new Map(
    ingredientSource.ingredients.map(({ sourceKey, defaultUnit }) => [sourceKey, defaultUnit]),
  );
  const expectedRecipeIDs = recipeSource.recipes.map(({ sourceKey }) => sourceKey);
  const extractedRecipeIDs = extracted.map(({ id }) => id);
  if (JSON.stringify(extractedRecipeIDs) !== JSON.stringify(expectedRecipeIDs)) {
    throw new Error("Swift-receptvolgorde/IDs wijken af van data/recipes.json.");
  }

  const mentions = extracted.flatMap(({ id, ingredients }) => ingredients.map((ingredient, position) => {
    const unit = unitByIngredient.get(ingredient.ingredientTerm);
    if (!unit) throw new Error(`Ingredient-ID ${ingredient.ingredientTerm} ontbreekt in de centrale bibliotheek.`);
    return { recipeSourceKey: id, ...ingredient, unit, position };
  }));

  return {
    schemaVersion: 1,
    source: {
      swiftRecipes: extracted.length,
      legacyRecipes: legacy.length,
      expandedRecipes: expanded.length,
      rawRecipeIngredientMentions: mentions.length,
      uniqueRecipeIngredientIDs: new Set(mentions.map(({ ingredientTerm }) => ingredientTerm)).size,
      hasFreeTextAmounts: false,
      quantityBasis: "per_person",
    },
    mentions,
  };
}

const swiftRoot = cliValue(
  "--swift-root",
  fileURLToPath(new URL("../../BoodschappenMaatje.swiftpm", import.meta.url)),
);
const extracted = await extractSwiftRecipeIngredients(swiftRoot);
await writeFile(fileURLToPath(outputURL), `${JSON.stringify(extracted, null, 2)}\n`, "utf8");
console.log(
  `Receptingrediënten geëxtraheerd: ${extracted.source.swiftRecipes} recepten, `
  + `${extracted.source.rawRecipeIngredientMentions} regels.`,
);
