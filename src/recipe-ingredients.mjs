import {
  normalizeIngredientName,
  prepareIngredientLibrary,
} from "./ingredient-library.mjs";
import { prepareRecipeLibrary } from "./recipe-library.mjs";

export const RECIPE_INGREDIENT_UNITS = Object.freeze([
  "g", "kg", "ml", "l", "piece", "loaf",
]);

const UNIT_ALIASES = new Map([
  ["g", "g"], ["gr", "g"], ["gram", "g"], ["grams", "g"],
  ["kg", "kg"], ["kilogram", "kg"], ["kilograms", "kg"],
  ["ml", "ml"], ["milliliter", "ml"], ["milliliters", "ml"],
  ["millilitre", "ml"], ["millilitres", "ml"],
  ["l", "l"], ["liter", "l"], ["liters", "l"],
  ["litre", "l"], ["litres", "l"],
  ["stuk", "piece"], ["stuks", "piece"], ["piece", "piece"], ["pieces", "piece"],
  ["brood", "loaf"], ["loaf", "loaf"], ["loaves", "loaf"],
]);

export function normalizeRecipeIngredientUnit(value) {
  const normalized = String(value ?? "").trim().toLocaleLowerCase("nl-NL");
  const unit = UNIT_ALIASES.get(normalized);
  if (!unit) throw new Error(`Onbekende receptingrediënt-eenheid: ${value || "(leeg)"}`);
  return unit;
}

function makeIngredientLookup(records) {
  const ingredients = prepareIngredientLibrary(records);
  const bySourceKey = new Map();
  const byExactName = new Map();
  const byNormalizedName = new Map();
  const byAlias = new Map();

  for (const ingredient of ingredients) {
    bySourceKey.set(ingredient.sourceKey, ingredient);
    byExactName.set(ingredient.name, ingredient);
    byNormalizedName.set(ingredient.normalizedName, ingredient);
    for (const alias of ingredient.aliases) {
      if (alias.normalizedAlias !== ingredient.normalizedName) {
        byAlias.set(alias.normalizedAlias, ingredient);
      }
    }
  }
  return { ingredients, bySourceKey, byExactName, byNormalizedName, byAlias };
}

export function matchIngredientTerm(term, lookup, semanticMappings = {}) {
  const original = String(term ?? "").trim();
  if (!original) return { method: "unmatched", ingredient: null };

  const exact = lookup.bySourceKey.get(original) ?? lookup.byExactName.get(original);
  if (exact) return { method: "exact", ingredient: exact };

  const normalized = normalizeIngredientName(original);
  const canonical = lookup.byNormalizedName.get(normalized);
  if (canonical) return { method: "normalized", ingredient: canonical };

  const alias = lookup.byAlias.get(normalized);
  if (alias) return { method: "alias", ingredient: alias };

  const semanticTarget = semanticMappings[original] ?? semanticMappings[normalized];
  const semantic = semanticTarget ? lookup.bySourceKey.get(semanticTarget) : null;
  if (semantic) return { method: "semantic", ingredient: semantic };

  return { method: "unmatched", ingredient: null };
}

/// Maakt de relationele stap-5.2-data. De Swift-bron bevat hoeveelheden per
/// persoon; die betekenis wordt expliciet behouden en niet omgerekend naar een
/// verzonnen standaardportie. Producten, SKU's en prijzen horen niet in deze laag.
export function prepareRecipeIngredientRelations({
  recipes: recipeRecords,
  ingredients: ingredientRecords,
  mentions,
  semanticMappings = {},
}) {
  if (!Array.isArray(mentions)) throw new Error("Receptingrediëntenbron moet een array zijn.");

  const recipes = prepareRecipeLibrary(recipeRecords);
  const recipeBySourceKey = new Map(recipes.map((recipe) => [recipe.sourceKey, recipe]));
  const lookup = makeIngredientLookup(ingredientRecords);
  const seenPositions = new Set();
  const matchCounts = { exact: 0, normalized: 0, alias: 0, semantic: 0, unmatched: 0 };
  const unmatched = [];
  const relations = [];

  for (const mention of mentions) {
    const recipeSourceKey = String(mention?.recipeSourceKey ?? "").trim();
    const ingredientTerm = String(mention?.ingredientTerm ?? "").trim();
    const amountPerPerson = Number(mention?.amountPerPerson);
    const position = Number(mention?.position);
    const recipe = recipeBySourceKey.get(recipeSourceKey);

    if (!recipe) throw new Error(`Onbekende recept-ID in ingrediëntregel: ${recipeSourceKey || "(leeg)"}`);
    if (!Number.isFinite(amountPerPerson) || amountPerPerson <= 0) {
      throw new Error(`Ongeldige hoeveelheid voor ${recipeSourceKey}/${ingredientTerm || "(leeg)"}.`);
    }
    if (!Number.isInteger(position) || position < 0) {
      throw new Error(`Ongeldige positie voor ${recipeSourceKey}/${ingredientTerm || "(leeg)"}.`);
    }

    const positionKey = `${recipeSourceKey}:${position}`;
    if (seenPositions.has(positionKey)) {
      throw new Error(`Dubbele receptpositie in brondata: ${positionKey}`);
    }
    seenPositions.add(positionKey);

    const match = matchIngredientTerm(ingredientTerm, lookup, semanticMappings);
    matchCounts[match.method] += 1;
    if (!match.ingredient) {
      unmatched.push({ recipeSourceKey, recipeName: recipe.name, ingredientTerm, position });
      continue;
    }

    relations.push({
      recipeSourceKey,
      ingredientSourceKey: match.ingredient.sourceKey,
      amountPerPerson,
      unit: normalizeRecipeIngredientUnit(mention.unit ?? match.ingredient.defaultUnit),
      position,
      matchMethod: match.method,
    });
  }

  const recipesWithRelations = new Set(relations.map(({ recipeSourceKey }) => recipeSourceKey));
  const recipesWithoutRelations = recipes
    .filter(({ sourceKey }) => !recipesWithRelations.has(sourceKey))
    .map(({ sourceKey, name }) => ({ sourceKey, name }));

  return {
    recipes,
    ingredients: lookup.ingredients,
    relations,
    report: {
      rawMentions: mentions.length,
      generatedRelations: relations.length,
      matchCounts,
      unmatched,
      distinctIngredients: new Set(relations.map(({ ingredientSourceKey }) => ingredientSourceKey)).size,
      recipesWithRelations: recipesWithRelations.size,
      recipesWithoutRelations,
      units: [...new Set(relations.map(({ unit }) => unit))].sort(),
    },
  };
}
