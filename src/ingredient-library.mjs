export const INGREDIENT_CATEGORIES = Object.freeze([
  "Groente",
  "Fruit",
  "Vlees",
  "Vis",
  "Vegetarische proteïne",
  "Zuivel & eieren",
  "Brood",
  "Pasta, rijst & granen",
  "Aardappel & zetmeel",
  "Sauzen & smaakmakers",
  "Maaltijdcomponenten",
  "Snacks",
  "Dranken",
  "Beleg",
  "Overig",
]);

export const INGREDIENT_UNITS = Object.freeze([
  "grams", "millilitres", "pieces", "litres", "loaves",
]);

export function normalizeIngredientName(value) {
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

function validatedRecord(record) {
  const sourceKey = String(record?.sourceKey ?? "").trim();
  const name = String(record?.name ?? "").trim();
  const normalizedName = normalizeIngredientName(name);
  const defaultUnit = String(record?.defaultUnit ?? "").trim();
  const category = String(record?.category ?? "").trim();

  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(sourceKey)) {
    throw new Error(`Ongeldige Ingredient-ID: ${sourceKey || "(leeg)"}`);
  }
  if (!normalizedName) throw new Error(`Ingrediënt ${sourceKey} heeft geen geldige naam.`);
  if (!INGREDIENT_UNITS.includes(defaultUnit)) {
    throw new Error(`Ingrediënt ${sourceKey} heeft een onbekende standaardeenheid: ${defaultUnit}`);
  }
  if (!INGREDIENT_CATEGORIES.includes(category)) {
    throw new Error(`Ingrediënt ${sourceKey} heeft een onbekende categorie: ${category}`);
  }

  return {
    sourceKey,
    name,
    normalizedName,
    defaultUnit,
    category,
    aliases: [name, ...(record.aliases ?? [])]
      .map((alias) => String(alias).trim())
      .filter(Boolean),
  };
}

/// Valideert en normaliseert de bestaande Swift Ingredient Library voor de
/// Supabase-seed. Deze functie singulariseert of synonymiseert niet agressief:
/// alleen expliciet aangeleverde aliases verwijzen naar hetzelfde ingrediënt.
export function prepareIngredientLibrary(records) {
  if (!Array.isArray(records)) throw new Error("Ingrediëntenbron moet een array zijn.");

  const bySourceKey = new Map();
  const canonicalOwner = new Map();

  for (const input of records) {
    const record = validatedRecord(input);
    const priorNameOwner = canonicalOwner.get(record.normalizedName);
    if (priorNameOwner && priorNameOwner !== record.sourceKey) {
      throw new Error(
        `Dubbele genormaliseerde ingrediëntnaam '${record.normalizedName}' voor ${priorNameOwner} en ${record.sourceKey}.`,
      );
    }
    canonicalOwner.set(record.normalizedName, record.sourceKey);

    const previous = bySourceKey.get(record.sourceKey);
    if (previous) {
      if (previous.normalizedName !== record.normalizedName
          || previous.defaultUnit !== record.defaultUnit
          || previous.category !== record.category) {
        throw new Error(`Conflicterende definitie voor Ingredient-ID ${record.sourceKey}.`);
      }
      previous.aliases.push(...record.aliases);
    } else {
      bySourceKey.set(record.sourceKey, record);
    }
  }

  const aliasOwner = new Map();
  const prepared = [...bySourceKey.values()]
    .sort((left, right) => left.sourceKey.localeCompare(right.sourceKey, "en"))
    .map((record) => {
      const aliases = new Map();
      for (const alias of record.aliases) {
        const normalizedAlias = normalizeIngredientName(alias);
        if (!normalizedAlias) continue;
        const priorOwner = aliasOwner.get(normalizedAlias);
        if (priorOwner && priorOwner !== record.sourceKey) {
          throw new Error(
            `Alias '${normalizedAlias}' verwijst zowel naar ${priorOwner} als ${record.sourceKey}.`,
          );
        }
        aliasOwner.set(normalizedAlias, record.sourceKey);
        if (!aliases.has(normalizedAlias)) aliases.set(normalizedAlias, alias);
      }
      return {
        ...record,
        aliases: [...aliases.entries()]
          .map(([normalizedAlias, alias]) => ({ alias, normalizedAlias }))
          .sort((left, right) => left.normalizedAlias.localeCompare(right.normalizedAlias, "nl")),
      };
    });

  return prepared;
}

