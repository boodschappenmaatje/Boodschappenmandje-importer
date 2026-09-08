export const RECIPE_BUDGET_TIERS = Object.freeze([
  "economical", "standard", "premium",
]);

export function normalizeRecipeName(value) {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nl-NL")
    .replace(/&/g, " en ")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function validateBoolean(record, field) {
  if (typeof record[field] !== "boolean") {
    throw new Error(`Recept ${record.sourceKey || "(zonder ID)"} heeft geen geldige ${field}-waarde.`);
  }
}

function validatedRecipe(record) {
  const sourceKey = String(record?.sourceKey ?? "").trim();
  const name = String(record?.name ?? "").trim();
  const normalizedName = normalizeRecipeName(name);
  const symbol = String(record?.symbol ?? "").trim();
  const preparationMinutes = Number(record?.preparationMinutes);
  const budgetTier = String(record?.budgetTier ?? "").trim();

  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sourceKey)) {
    throw new Error(`Ongeldige stabiele recept-ID: ${sourceKey || "(leeg)"}`);
  }
  if (!normalizedName) throw new Error(`Recept ${sourceKey} heeft geen geldige naam.`);
  if (!symbol) throw new Error(`Recept ${sourceKey} heeft geen SF Symbol.`);
  if (!Number.isInteger(preparationMinutes) || preparationMinutes <= 0) {
    throw new Error(`Recept ${sourceKey} heeft geen geldige bereidingstijd.`);
  }
  if (!RECIPE_BUDGET_TIERS.includes(budgetTier)) {
    throw new Error(`Recept ${sourceKey} heeft een onbekend budgetniveau: ${budgetTier}`);
  }
  for (const field of ["vegetarian", "containsPork", "kidFriendly", "healthy"]) {
    validateBoolean(record, field);
  }

  return {
    sourceKey,
    name,
    normalizedName,
    symbol,
    preparationMinutes,
    vegetarian: record.vegetarian,
    containsPork: record.containsPork,
    kidFriendly: record.kidFriendly,
    healthy: record.healthy,
    budgetTier,
  };
}

/// Valideert alleen de centrale receptrecords van stap 5.1. Ingrediënten en
/// categorieën/tags worden bewust niet in dit model opgenomen; daarvoor zijn
/// de afzonderlijke relationele roadmapstappen 5.2 en 5.3 bedoeld.
export function prepareRecipeLibrary(records) {
  if (!Array.isArray(records)) throw new Error("Receptenbron moet een array zijn.");

  const bySourceKey = new Map();
  const normalizedNameOwner = new Map();
  for (const input of records) {
    const recipe = validatedRecipe(input);
    const nameOwner = normalizedNameOwner.get(recipe.normalizedName);
    if (nameOwner && nameOwner !== recipe.sourceKey) {
      throw new Error(
        `Dubbele genormaliseerde receptnaam '${recipe.normalizedName}' voor ${nameOwner} en ${recipe.sourceKey}.`,
      );
    }
    normalizedNameOwner.set(recipe.normalizedName, recipe.sourceKey);

    const previous = bySourceKey.get(recipe.sourceKey);
    if (previous && JSON.stringify(previous) !== JSON.stringify(recipe)) {
      throw new Error(`Conflicterend receptrecord voor ${recipe.sourceKey}.`);
    }
    if (!previous) bySourceKey.set(recipe.sourceKey, recipe);
  }

  return [...bySourceKey.values()]
    .sort((left, right) => left.sourceKey.localeCompare(right.sourceKey, "en"));
}

