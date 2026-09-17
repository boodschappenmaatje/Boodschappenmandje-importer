import { euroAmountToCents } from "@/services/budget/budget-engine";
import {
  productSearchRelevance,
  type CatalogRepository,
} from "@/services/catalog/catalog-repository";
import { resolveCurrentPrice } from "@/services/catalog/price";
import type { Product } from "@/types/catalog";
import type { RecipeIngredientDefinition } from "@/services/week-preparation/recipe-repository";
import {
  inferMealMixBrand,
} from "@/services/week-preparation/meal-mix-profiles";
import type {
  WeekIngredientRequirement,
  MealMixBrand,
  WeekIngredientUnit,
} from "@/types/week-preparation";

const KNOWN_CATEGORY_SIGNALS: Record<string, string[]> = {
  "Vlees": ["vlees", "gehakt", "kip", "worst", "spek", "burger", "tartaar", "shoarma"],
  "Vis": ["vis", "zalm", "tonijn", "kabeljauw", "garnaal"],
  "Groente": ["groente", "spinazie", "tomaat", "ui", "wortel", "kool", "paprika", "sla"],
  "Fruit": ["fruit", "appel", "banaan", "peer", "citroen"],
  "Zuivel & eieren": ["zuivel", "melk", "kaas", "feta", "room", "yoghurt", "ei"],
  "Pasta, rijst & granen": ["pasta", "rijst", "graan", "spaghetti", "macaroni", "noedel"],
  "Brood": ["brood", "bol", "wrap", "tortilla"],
  "Snacks": ["snack", "chips", "friet", "pizza", "nugget"],
  "Aardappel & zetmeel": ["aardappel", "zetmeel", "friet", "krieltjes", "puree"],
  "Sauzen & smaakmakers": ["saus", "smaakmaker", "kruiden", "pesto", "jus"],
  "Vegetarische proteïne": ["vegetarisch", "plantaardig", "vegan", "tofu", "falafel"],
  "Maaltijdcomponenten": ["maaltijd", "wereldgerecht", "pizza", "soep", "mix"],
  "Drinken": [
    "drank",
    "frisdrank",
    "sap",
    "fruitdrank",
    "vruchtensap",
    "smoothie",
    "limonade",
  ],
};

const INCOMPATIBLE_CATEGORIES: Record<string, string[]> = {
  "Vlees": ["Groente", "Fruit", "Vis"],
  "Vis": ["Vlees", "Groente", "Fruit"],
  "Groente": ["Vlees", "Vis", "Sauzen & smaakmakers", "Maaltijdcomponenten", "Drinken"],
  "Fruit": ["Vlees", "Vis", "Sauzen & smaakmakers", "Maaltijdcomponenten", "Drinken"],
  "Zuivel & eieren": ["Vlees", "Vis", "Groente", "Fruit"],
  "Brood": ["Vlees", "Vis", "Groente", "Fruit"],
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

function containsCategorySignal(value: string, signal: string): boolean {
  const normalizedSignal = normalize(signal);
  return normalize(value)
    .split(" ")
    .some(
      (token) =>
        token === normalizedSignal ||
        (normalizedSignal.length >= 4 && token.startsWith(normalizedSignal)),
    );
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

  const categorySegments = product.category?.split("/") ?? [];
  const categorySpecificSegments =
    categorySegments.length > 1 ? categorySegments.slice(1) : categorySegments;
  const contextWithoutProductType = normalize(
    [product.name, categorySegments.at(-1)].filter(Boolean).join(" "),
  );
  const productSpecificClassification = normalize(
    [
      product.name,
      product.productType,
      categorySegments.at(-1),
    ]
      .filter(Boolean)
      .join(" "),
  );
  const plantClassification = normalize(
    [
      product.name,
      product.productType,
      ...categorySpecificSegments,
    ]
      .filter(Boolean)
      .join(" "),
  );
  if (
    ingredient.category === "Vlees" &&
    ["vegetarisch", "plantaardig", "vegan", "vega"].some((signal) =>
      containsTerm(plantClassification, signal),
    )
  ) {
    return true;
  }
  const incompatibleCategories = new Set(
    INCOMPATIBLE_CATEGORIES[ingredient.category] ?? [],
  );
  const incompatibleSignals = Object.entries(KNOWN_CATEGORY_SIGNALS)
    .filter(([category]) => incompatibleCategories.has(category))
    .flatMap(([, signals]) => signals);
  const hasIncompatibleSpecificContext = incompatibleSignals.some((signal) =>
    containsCategorySignal(contextWithoutProductType, signal),
  );
  if (hasIncompatibleSpecificContext) return true;

  const hasExpectedSpecificContext = expectedSignals.some((signal) =>
    containsCategorySignal(contextWithoutProductType, signal),
  );
  if (hasExpectedSpecificContext) return false;

  return incompatibleSignals.some((signal) =>
    containsCategorySignal(productSpecificClassification, signal),
  );
}

function reliableTermMatch(
  ingredient: RecipeIngredientDefinition,
  product: Product,
): boolean {
  const terms = [...new Set([ingredient.name, ...ingredient.aliases].map(normalize))]
    .filter(Boolean);
  const name = normalize(product.name);
  return terms.some((term) => containsTerm(name, term));
}

const MEAL_MIX_STOP_WORDS = new Set([
  "knorr",
  "honig",
  "wereldgerechten",
  "wereldgerecht",
  "maaltijdpakket",
  "maaltijdmix",
  "mix",
  "basis",
  "voor",
]);

function reliableBrandedMealMixMatch(
  ingredient: RecipeIngredientDefinition,
  product: Product,
): boolean {
  const productName = normalize(product.name);
  return [ingredient.name, ...ingredient.aliases].some((candidate) => {
    const distinctiveTokens = normalize(candidate)
      .split(" ")
      .filter((token) => token.length >= 3 && !MEAL_MIX_STOP_WORDS.has(token));
    return (
      distinctiveTokens.length > 0 &&
      distinctiveTokens.every((token) => containsTerm(productName, token))
    );
  });
}

export function isReliableIngredientMatch(
  ingredient: RecipeIngredientDefinition,
  product: Product,
  brandConstraint: MealMixBrand | null = inferMealMixBrand(ingredient),
): boolean {
  const productBrand = normalize(product.brand);
  const productName = normalize(product.name);
  const requiredBrand = normalize(brandConstraint);
  const brandMatches =
    !requiredBrand ||
    productBrand === requiredBrand ||
    containsTerm(productName, requiredBrand);
  const termMatches =
    reliableTermMatch(ingredient, product) ||
    (Boolean(requiredBrand) && reliableBrandedMealMixMatch(ingredient, product));
  return (
    product.supermarket === "Hoogvliet" &&
    Boolean(product.id && product.sku) &&
    product.isAvailable !== false &&
    brandMatches &&
    termMatches &&
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
  if (!normalize(text)) return null;

  const dimensionCapacity = (
    units: RegExp,
    factors: Record<string, number>,
  ): number | null => {
    const multipack = new RegExp(
      `(\\d+)\\s*[x×]\\s*(\\d+(?:[.,]\\d+)?)\\s*(${units.source})\\b`,
      "i",
    ).exec(text);
    const match =
      multipack ??
      new RegExp(`(\\d+(?:[.,]\\d+)?)\\s*(${units.source})\\b`, "i").exec(text);
    if (!match) return null;
    const count = multipack ? packageNumber(match[1]) : 1;
    const amount = packageNumber(match[multipack ? 2 : 1]);
    const rawUnit = match[multipack ? 3 : 2].toLocaleLowerCase("nl-NL").replace(".", "");
    const factor = factors[rawUnit];
    return count && amount && factor ? count * amount * factor : null;
  };

  if (unit === "g") {
    return dimensionCapacity(/kg|kilogram|kilo|g|gr\.?|gram/, {
      kg: 1000,
      kilogram: 1000,
      kilo: 1000,
      g: 1,
      gr: 1,
      gram: 1,
    });
  }

  if (unit === "ml") {
    return dimensionCapacity(/milliliters?|ml|centiliters?|cl|deciliters?|dl|liters?|litres?|l/, {
      milliliter: 1,
      milliliters: 1,
      ml: 1,
      centiliter: 10,
      centiliters: 10,
      cl: 10,
      deciliter: 100,
      deciliters: 100,
      dl: 100,
      l: 1000,
      liter: 1000,
      liters: 1000,
      litre: 1000,
      litres: 1000,
    });
  }

  if (unit === "piece") {
    const multipack = /(\d+)\s*[x×]\s*(\d+)\s*(stuks?|st\.?|rollen?|zakjes?|pakjes?|porties?)\b/i.exec(text);
    if (multipack) {
      const packs = packageNumber(multipack[1]);
      const pieces = packageNumber(multipack[2]);
      return packs && pieces ? packs * pieces : null;
    }
    const match = /(\d+)\s*(stuks?|st\.?|rollen?|zakjes?|pakjes?|porties?)\b/i.exec(text);
    return match ? packageNumber(match[1]) : null;
  }

  return unit === "loaf" ? 1 : null;
}

export function productPackageCapacity(
  product: Product,
  unit: WeekIngredientUnit,
): number | null {
  const massUnit = unit === "g" || unit === "kg";
  const volumeUnit = unit === "ml" || unit === "l";
  const textCapacity = capacityFromText(
    [product.packageText, product.name].filter(Boolean).join(" "),
    massUnit ? "g" : volumeUnit ? "ml" : unit,
  );
  if (textCapacity !== null) {
    if (unit === "kg") return textCapacity / 1000;
    if (unit === "l") return textCapacity / 1000;
    return textCapacity;
  }
  if (massUnit && product.weightGrams && product.weightGrams > 0) {
    return unit === "kg" ? product.weightGrams / 1000 : product.weightGrams;
  }
  return null;
}

function matchScore(
  ingredient: RecipeIngredientDefinition,
  product: Product,
): number {
  const terms = [...new Set([ingredient.name, ...ingredient.aliases].map(normalize))]
    .filter(Boolean);
  const name = normalize(product.name);
  const type = normalize(product.productType);
  const category = normalize(product.category);
  let score = Math.max(
    0,
    ...[ingredient.name, ...ingredient.aliases].map((term) =>
      productSearchRelevance(product, term),
    ),
  );

  if (terms.some((term) => name === term)) score += 5_000;
  else if (terms.some((term) => name.startsWith(`${term} `))) score += 3_000;
  else if (terms.some((term) => containsTerm(name, term))) score += 1_500;
  if (terms.some((term) => type === term || containsTerm(type, term))) score += 1_000;
  if (terms.some((term) => category === term || containsTerm(category, term))) score += 500;
  if (product.currentPrice && resolveCurrentPrice(product.currentPrice)) score += 80;
  if (productPackageCapacity(product, "g") || product.packageText) score += 30;

  return score;
}

export function selectIngredientProduct(
  ingredient: RecipeIngredientDefinition,
  products: Product[],
  brandConstraint: MealMixBrand | null = inferMealMixBrand(ingredient),
  requiredUnit: WeekIngredientUnit | null = null,
): Product | null {
  const reliable = products.filter((product) =>
    isReliableIngredientMatch(ingredient, product, brandConstraint),
  );
  const compatiblePackages = requiredUnit
    ? reliable.filter(
        (product) => productPackageCapacity(product, requiredUnit) !== null,
      )
    : [];
  const candidates = compatiblePackages.length > 0 ? compatiblePackages : reliable;
  return (
    candidates
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

  const packageCapacity =
    requirement.kind === "mealMix"
      ? 1
      : productPackageCapacity(product, requirement.unit);
  const purchaseQuantity =
    packageCapacity === null
      ? null
      : Math.max(1, Math.ceil(requirement.requiredQuantity / packageCapacity));
  const resolvedPrice =
    product.currentPrice?.productId === product.id
      ? resolveCurrentPrice(product.currentPrice)
      : null;
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

export function combinedProductPurchaseQuantity(
  requirements: WeekIngredientRequirement[],
): number {
  if (requirements.length === 0) return 0;
  const first = requirements[0];
  const canCombineRequiredQuantity =
    first.packageCapacity !== null &&
    requirements.every(
      (item) =>
        item.unit === first.unit &&
        item.kind === first.kind &&
        item.packageCapacity === first.packageCapacity,
    );
  if (canCombineRequiredQuantity) {
    return Math.max(
      1,
      Math.ceil(
        requirements.reduce((total, item) => total + item.requiredQuantity, 0) /
          first.packageCapacity!,
      ),
    );
  }
  return requirements.reduce(
    (total, item) => total + (item.purchaseQuantity ?? 0),
    0,
  );
}

export type IngredientMatchFailureReason =
  | "no_catalog_product"
  | "low_confidence_match"
  | "category_mismatch"
  | "product_reference_invalid"
  | "matcher_failed";

export interface IngredientMatchDiagnostics {
  product: Product | null;
  candidates: Product[];
  failureReason: IngredientMatchFailureReason | null;
}

function ingredientMatchFailure(
  ingredient: RecipeIngredientDefinition,
  products: Product[],
  brandConstraint: MealMixBrand | null,
): IngredientMatchFailureReason {
  if (products.length === 0) return "no_catalog_product";

  const requiredBrand = normalize(brandConstraint);
  const stronglyRelated = products.filter((product) => {
    const brandMatches =
      !requiredBrand ||
      normalize(product.brand) === requiredBrand ||
      containsTerm(normalize(product.name), requiredBrand);
    return (
      brandMatches &&
      (reliableTermMatch(ingredient, product) ||
        (Boolean(requiredBrand) && reliableBrandedMealMixMatch(ingredient, product)))
    );
  });
  if (stronglyRelated.length === 0) return "low_confidence_match";
  if (stronglyRelated.every((product) => categoryConflicts(ingredient, product))) {
    return "category_mismatch";
  }
  if (stronglyRelated.some((product) => !product.id.trim() || !product.sku.trim())) {
    return "product_reference_invalid";
  }
  return "matcher_failed";
}

export async function searchIngredientProduct(
  repository: CatalogRepository,
  ingredient: RecipeIngredientDefinition,
  brandConstraint: MealMixBrand | null,
  requiredUnit: WeekIngredientUnit | null = null,
): Promise<IngredientMatchDiagnostics> {
  const terms = [...new Set([ingredient.name, ...ingredient.aliases])]
    .map((term) => term.trim())
    .filter((term) => term.length >= 2)
    .slice(0, 4);
  const found = new Map<string, Product>();

  for (const term of terms) {
    const result = await repository.search(term, { limit: 12 });
    for (const product of result.products) found.set(product.id, product);
    const match = selectIngredientProduct(
      ingredient,
      [...found.values()],
      brandConstraint,
      requiredUnit,
    );
    if (match) {
      return {
        product: match,
        candidates: [...found.values()],
        failureReason: null,
      };
    }
  }

  const candidates = [...found.values()];
  const product = selectIngredientProduct(
    ingredient,
    candidates,
    brandConstraint,
    requiredUnit,
  );
  return {
    product,
    candidates,
    failureReason: product
      ? null
      : ingredientMatchFailure(ingredient, candidates, brandConstraint),
  };
}

export interface WeekIngredientMatchDiagnostics extends IngredientMatchDiagnostics {
  requirement: WeekIngredientRequirement;
}

export async function matchWeekIngredientsWithDiagnostics(
  requirements: WeekIngredientRequirement[],
  ingredients: RecipeIngredientDefinition[],
  repository: CatalogRepository,
  concurrency = 6,
): Promise<WeekIngredientMatchDiagnostics[]> {
  const ingredientById = new Map(
    ingredients.map((ingredient) => [ingredient.id, ingredient]),
  );
  const result = new Array<WeekIngredientMatchDiagnostics>(requirements.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < requirements.length) {
      const index = nextIndex;
      nextIndex += 1;
      const requirement = requirements[index];
      const ingredient = ingredientById.get(requirement.ingredientId);
      if (!ingredient) {
        result[index] = {
          requirement: applyProductToRequirement(requirement, null),
          product: null,
          candidates: [],
          failureReason: "matcher_failed",
        };
        continue;
      }
      const diagnostic = await searchIngredientProduct(
        repository,
        ingredient,
        requirement.brandConstraint ?? inferMealMixBrand(ingredient),
        requirement.kind === "mealMix" ? null : requirement.unit,
      );
      result[index] = {
        ...diagnostic,
        requirement: applyProductToRequirement(requirement, diagnostic.product),
      };
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

export async function matchWeekIngredients(
  requirements: WeekIngredientRequirement[],
  ingredients: RecipeIngredientDefinition[],
  repository: CatalogRepository,
  concurrency = 6,
): Promise<WeekIngredientRequirement[]> {
  const diagnostics = await matchWeekIngredientsWithDiagnostics(
    requirements,
    ingredients,
    repository,
    concurrency,
  );
  return diagnostics.map((item) => item.requirement);
}
