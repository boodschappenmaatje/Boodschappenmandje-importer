import { euroAmountToCents } from "@/services/budget/budget-engine";
import {
  productSearchRelevance,
  type CatalogRepository,
} from "@/services/catalog/catalog-repository";
import { resolveCurrentPrice } from "@/services/catalog/price";
import type { Product } from "@/types/catalog";
import type { RecipeIngredientDefinition } from "@/services/week-preparation/recipe-repository";
import type {
  WeekIngredientRequirement,
  WeekIngredientUnit,
} from "@/types/week-preparation";

const KNOWN_CATEGORY_SIGNALS: Record<string, string[]> = {
  "Vlees": ["vlees", "gehakt", "kip", "worst", "spek", "burger", "tartaar", "shoarma"],
  "Vis": ["vis", "zalm", "tonijn", "kabeljauw", "garnaal"],
  "Groente": ["groente", "spinazie", "tomaat", "ui", "wortel", "kool", "paprika", "sla"],
  "Fruit": ["fruit", "appel", "banaan", "peer", "citroen"],
  "Zuivel & eieren": ["zuivel", "melk", "kaas", "room", "yoghurt", "ei"],
  "Pasta, rijst & granen": ["pasta", "rijst", "graan", "spaghetti", "macaroni", "noedel"],
  "Brood": ["brood", "bol", "wrap", "tortilla"],
  "Snacks": ["snack", "chips", "friet", "pizza", "nugget"],
};

function normalize(value: string | null): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("nl-NL")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsTerm(value: string, term: string): boolean {
  if (!value || !term) return false;
  return (` ${value} `).includes(` ${term} `) || value.startsWith(`${term} `);
}

function categoryConflicts(
  ingredient: RecipeIngredientDefinition,
  product: Product,
): boolean {
  const expectedSignals = KNOWN_CATEGORY_SIGNALS[ingredient.category];
  if (!expectedSignals) return false;

  const classification = normalize(
    [product.category, product.productType].filter(Boolean).join(" "),
  );
  if (!classification) return false;

  const expected = expectedSignals.some((signal) =>
    containsTerm(classification, normalize(signal)),
  );
  if (expected) return false;

  const belongsToOtherKnownCategory = Object.entries(KNOWN_CATEGORY_SIGNALS)
    .filter(([category]) => category !== ingredient.category)
    .some(([, signals]) =>
      signals.some((signal) => containsTerm(classification, normalize(signal))),
    );
  return belongsToOtherKnownCategory;
}

function reliableTermMatch(
  ingredient: RecipeIngredientDefinition,
  product: Product,
): boolean {
  const terms = [...new Set([ingredient.name, ...ingredient.aliases].map(normalize))]
    .filter(Boolean);
  const name = normalize(product.name);
  const productType = normalize(product.productType);
  const category = normalize(product.category);

  return terms.some(
    (term) =>
      containsTerm(name, term) ||
      containsTerm(productType, term) ||
      containsTerm(category, term),
  );
}

export function isReliableIngredientMatch(
  ingredient: RecipeIngredientDefinition,
  product: Product,
): boolean {
  return (
    product.supermarket === "Hoogvliet" &&
    Boolean(product.id && product.sku) &&
    product.isAvailable !== false &&
    reliableTermMatch(ingredient, product) &&
    !categoryConflicts(ingredient, product)
  );
}

function packageNumber(value: string): number | null {
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) && number > 0 ? number : null;
}

function capacityFromText(
  text: string,
  unit: WeekIngredientUnit,
): number | null {
  const normalized = normalize(text);
  if (!normalized) return null;

  if (unit === "g") {
    const match = /(\d+(?:[.,]\d+)?)\s*(kg|g)\b/i.exec(text);
    const amount = match ? packageNumber(match[1]) : null;
    if (!match || amount === null) return null;
    return match[2].toLocaleLowerCase("nl-NL") === "kg" ? amount * 1000 : amount;
  }

  if (unit === "ml") {
    const match = /(\d+(?:[.,]\d+)?)\s*(ml|cl|dl|l)\b/i.exec(text);
    const amount = match ? packageNumber(match[1]) : null;
    if (!match || amount === null) return null;
    const factor = { ml: 1, cl: 10, dl: 100, l: 1000 }[
      match[2].toLocaleLowerCase("nl-NL") as "ml" | "cl" | "dl" | "l"
    ];
    return amount * factor;
  }

  if (unit === "piece") {
    const match = /(\d+)\s*(stuks?|st\.?|rollen?|zakjes?|pakjes?|porties?)\b/i.exec(text);
    return match ? packageNumber(match[1]) : null;
  }

  return unit === "loaf" ? 1 : null;
}

export function productPackageCapacity(
  product: Product,
  unit: WeekIngredientUnit,
): number | null {
  if (unit === "g" && product.weightGrams && product.weightGrams > 0) {
    return product.weightGrams;
  }
  return capacityFromText(
    [product.packageText, product.name].filter(Boolean).join(" "),
    unit,
  );
}

function matchScore(
  ingredient: RecipeIngredientDefinition,
  product: Product,
): number {
  const primary = normalize(ingredient.name);
  const name = normalize(product.name);
  const type = normalize(product.productType);
  const category = normalize(product.category);
  let score = productSearchRelevance(product, ingredient.name);

  if (name === primary) score += 5_000;
  else if (name.startsWith(`${primary} `)) score += 3_000;
  else if (containsTerm(name, primary)) score += 1_500;
  if (type === primary || containsTerm(type, primary)) score += 1_000;
  if (category === primary || containsTerm(category, primary)) score += 500;
  if (product.currentPrice && resolveCurrentPrice(product.currentPrice)) score += 80;
  if (productPackageCapacity(product, "g") || product.packageText) score += 30;

  return score;
}

export function selectIngredientProduct(
  ingredient: RecipeIngredientDefinition,
  products: Product[],
): Product | null {
  return (
    products
      .filter((product) => isReliableIngredientMatch(ingredient, product))
      .toSorted(
        (left, right) =>
          matchScore(ingredient, right) - matchScore(ingredient, left) ||
          left.name.localeCompare(right.name, "nl-NL") ||
          left.id.localeCompare(right.id),
      )[0] ?? null
  );
}

export function applyProductToRequirement(
  requirement: WeekIngredientRequirement,
  product: Product | null,
): WeekIngredientRequirement {
  if (!product) {
    return {
      ...requirement,
      purchaseQuantity: null,
      packageCapacity: null,
      product: null,
      price: null,
      productMatchMissing: true,
      packageCalculationMissing: false,
    };
  }

  const packageCapacity = productPackageCapacity(product, requirement.unit);
  const purchaseQuantity =
    packageCapacity === null
      ? null
      : Math.max(1, Math.ceil(requirement.requiredQuantity / packageCapacity));
  const resolvedPrice = resolveCurrentPrice(product.currentPrice);
  const amountCents = resolvedPrice
    ? euroAmountToCents(resolvedPrice.amount)
    : null;

  return {
    ...requirement,
    purchaseQuantity,
    packageCapacity,
    product: {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      brand: product.brand,
      packageText: product.packageText,
      imageUrl: product.imageUrl,
      supermarket: product.supermarket,
      sourceUrl: product.sourceUrl,
    },
    price:
      resolvedPrice && amountCents !== null
        ? {
            amountCents,
            isOffer: resolvedPrice.isOffer,
            updatedAt: resolvedPrice.updatedAt,
            freshness: resolvedPrice.freshness,
          }
        : null,
    productMatchMissing: false,
    packageCalculationMissing: purchaseQuantity === null,
  };
}

async function searchIngredient(
  repository: CatalogRepository,
  ingredient: RecipeIngredientDefinition,
): Promise<Product | null> {
  const terms = [...new Set([ingredient.name, ...ingredient.aliases])]
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 4);
  const found = new Map<string, Product>();

  for (const term of terms) {
    const result = await repository.search(term, { limit: 12 });
    for (const product of result.products) found.set(product.id, product);
    const match = selectIngredientProduct(ingredient, [...found.values()]);
    if (match) return match;
  }

  return selectIngredientProduct(ingredient, [...found.values()]);
}

export async function matchWeekIngredients(
  requirements: WeekIngredientRequirement[],
  ingredients: RecipeIngredientDefinition[],
  repository: CatalogRepository,
  concurrency = 6,
): Promise<WeekIngredientRequirement[]> {
  const ingredientById = new Map(
    ingredients.map((ingredient) => [ingredient.id, ingredient]),
  );
  const result = new Array<WeekIngredientRequirement>(requirements.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < requirements.length) {
      const index = nextIndex;
      nextIndex += 1;
      const requirement = requirements[index];
      const ingredient = ingredientById.get(requirement.ingredientId);
      if (!ingredient) {
        result[index] = applyProductToRequirement(requirement, null);
        continue;
      }
      const product = await searchIngredient(repository, ingredient);
      result[index] = applyProductToRequirement(requirement, product);
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(Math.max(1, concurrency), requirements.length || 1) },
      () => worker(),
    ),
  );
  return result;
}
