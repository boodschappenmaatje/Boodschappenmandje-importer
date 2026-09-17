import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import { aggregateWeekIngredients } from "@/services/week-preparation/ingredient-aggregation";
import { mealMixProfileForRecipe } from "@/services/week-preparation/meal-mix-profiles";
import {
  applyProductToRequirement,
  matchWeekIngredientsWithDiagnostics,
  type IngredientMatchFailureReason,
  type WeekIngredientMatchDiagnostics,
} from "@/services/week-preparation/product-matching";
import type { RecipeCatalog } from "@/services/week-preparation/recipe-repository";
import type { Product, Recipe } from "@/types/catalog";
import type {
  PreparedDay,
  WeekIngredientRequirement,
  WeekIngredientUnit,
} from "@/types/week-preparation";

export type RecipeReadinessReason =
  | "ingredient_invalid"
  | "no_catalog_product"
  | "matcher_failed"
  | "low_confidence_match"
  | "missing_price"
  | "package_unknown"
  | "quantity_conversion_failed"
  | "product_reference_invalid"
  | "category_mismatch"
  | "alias_missing";

export type RecipeReadinessIssueOrigin =
  | "catalogCoverage"
  | "softwareOrMatching"
  | "recipeData";

export interface IngredientReadinessResult {
  ingredientId: string;
  sourceKey: string;
  name: string;
  required: boolean;
  requiredQuantity: number | null;
  unit: WeekIngredientUnit | null;
  ready: boolean;
  catalogProductAvailable: boolean;
  reliableProductMatch: boolean;
  priceKnown: boolean;
  packageCalculable: boolean;
  productId: string | null;
  sku: string | null;
  productName: string | null;
  reason: RecipeReadinessReason | null;
  origin: RecipeReadinessIssueOrigin | null;
}

export interface RecipeReadinessResult {
  recipeId: string;
  recipeSourceKey: string;
  recipeName: string;
  ready: boolean;
  requiredIngredientCount: number;
  readyRequiredIngredientCount: number;
  problemCount: number;
  ingredients: IngredientReadinessResult[];
}

export interface RecipeReadinessGateResult {
  recipes: RecipeReadinessResult[];
  matchedProductsByRequirement: ReadonlyMap<string, Product>;
}

function issueOrigin(
  reason: RecipeReadinessReason,
  requirement?: WeekIngredientRequirement,
  product?: Product | null,
): RecipeReadinessIssueOrigin {
  if (
    reason === "ingredient_invalid" ||
    reason === "quantity_conversion_failed" ||
    reason === "alias_missing"
  ) {
    return "recipeData";
  }
  if (
    reason === "matcher_failed" ||
    reason === "product_reference_invalid"
  ) {
    return "softwareOrMatching";
  }
  if (reason === "package_unknown" && requirement && product) {
    const text = `${product.packageText ?? ""} ${product.name}`.toLocaleLowerCase("nl-NL");
    const containsCompatibleUnit =
      (["g", "kg"].includes(requirement.unit) && /\b(?:kg|kilogram|kilo|g|gr|gram)\b/.test(text)) ||
      (["ml", "l"].includes(requirement.unit) && /\b(?:ml|cl|dl|l|liter|litre)\b/.test(text)) ||
      (requirement.unit === "piece" && /\b(?:stuks?|st|rollen?|zakjes?|pakjes?|porties?)\b/.test(text));
    return containsCompatibleUnit ? "softwareOrMatching" : "catalogCoverage";
  }
  return "catalogCoverage";
}

function readinessReasonFromMatch(
  reason: IngredientMatchFailureReason | null,
): RecipeReadinessReason {
  return reason ?? "matcher_failed";
}

export function recipeRequirementKey(
  requirement: Pick<
    WeekIngredientRequirement,
    "ingredientId" | "unit" | "kind" | "brandConstraint"
  >,
): string {
  return [
    requirement.ingredientId,
    requirement.unit,
    requirement.kind,
    requirement.brandConstraint ?? "generic",
  ].join(":");
}

function selectedDay(recipe: Recipe, dayIndex: number): PreparedDay {
  return {
    dayIndex,
    category: "quick",
    freeChoice: false,
    recipeId: recipe.id,
    recipe: {
      id: recipe.id,
      sourceKey: recipe.sourceKey,
      name: recipe.name,
    },
    status: "recipeSelected",
  };
}

function invalidIngredientResult(
  input: {
    ingredientId?: string;
    sourceKey?: string;
    name?: string;
    requiredQuantity?: number | null;
    unit?: WeekIngredientUnit | null;
    required?: boolean;
  },
  reason: "ingredient_invalid" | "quantity_conversion_failed" | "alias_missing",
): IngredientReadinessResult {
  return {
    ingredientId: input.ingredientId ?? "unknown",
    sourceKey: input.sourceKey ?? "unknown",
    name: input.name ?? "Onbekend ingrediënt",
    required: input.required ?? true,
    requiredQuantity: input.requiredQuantity ?? null,
    unit: input.unit ?? null,
    ready: false,
    catalogProductAvailable: false,
    reliableProductMatch: false,
    priceKnown: false,
    packageCalculable: false,
    productId: null,
    sku: null,
    productName: null,
    reason,
    origin: issueOrigin(reason),
  };
}

function resultForRequirement(
  requirement: WeekIngredientRequirement,
  match: WeekIngredientMatchDiagnostics,
): IngredientReadinessResult {
  const product = match.product;
  let reason: RecipeReadinessReason | null = null;

  if (!Number.isFinite(requirement.requiredQuantity) || requirement.requiredQuantity <= 0) {
    reason = "quantity_conversion_failed";
  } else if (!product) {
    reason = readinessReasonFromMatch(match.failureReason);
  } else if (!product.id.trim() || !product.sku.trim()) {
    reason = "product_reference_invalid";
  } else if (
    product.currentPrice &&
    product.currentPrice.productId !== product.id
  ) {
    reason = "product_reference_invalid";
  } else if (match.requirement.packageCalculationMissing) {
    reason = "package_unknown";
  } else if (!match.requirement.price) {
    reason = "missing_price";
  }

  return {
    ingredientId: requirement.ingredientId,
    sourceKey: requirement.sourceKey,
    name: requirement.name,
    required: !requirement.optional,
    requiredQuantity: requirement.requiredQuantity,
    unit: requirement.unit,
    ready: reason === null,
    catalogProductAvailable:
      Boolean(product) ||
      (match.candidates.length > 0 && match.failureReason === "matcher_failed"),
    reliableProductMatch: Boolean(product),
    priceKnown: Boolean(match.requirement.price),
    packageCalculable: match.requirement.purchaseQuantity !== null,
    productId: product?.id ?? null,
    sku: product?.sku ?? null,
    productName: product?.name ?? null,
    reason,
    origin: reason ? issueOrigin(reason, requirement, product) : null,
  };
}

function expectedIngredientProblems(
  recipe: Recipe,
  numberOfPeople: number,
  catalog: RecipeCatalog,
): IngredientReadinessResult[] {
  const ingredientById = new Map(
    catalog.ingredients.map((ingredient) => [ingredient.id, ingredient]),
  );
  const mealMix = mealMixProfileForRecipe(recipe.sourceKey);
  if (mealMix) {
    const expected = [
      mealMix.productIngredientSourceKey,
      ...mealMix.supplements.map((item) => item.sourceKey),
    ];
    const ingredientBySourceKey = new Map(
      catalog.ingredients.map((ingredient) => [ingredient.sourceKey, ingredient]),
    );
    return expected.flatMap((sourceKey) => {
      const ingredient = ingredientBySourceKey.get(sourceKey);
      if (ingredient) return [];
      return [invalidIngredientResult({ sourceKey, name: sourceKey }, "ingredient_invalid")];
    });
  }

  const relations = catalog.relations.filter(
    (relation) => relation.recipeId === recipe.id,
  );
  if (relations.length === 0) {
    return [
      invalidIngredientResult(
        { sourceKey: recipe.sourceKey, name: "Receptingrediënten" },
        "ingredient_invalid",
      ),
    ];
  }

  return relations.flatMap((relation) => {
    const ingredient = ingredientById.get(relation.ingredientId);
    if (!ingredient) {
      return [
        invalidIngredientResult(
          {
            ingredientId: relation.ingredientId,
            requiredQuantity: relation.amountPerPerson * numberOfPeople,
            unit: relation.unit,
            required: relation.optional !== true,
          },
          "ingredient_invalid",
        ),
      ];
    }
    if (ingredient.aliases.every((alias) => !alias.trim())) {
      return [
        invalidIngredientResult(
          {
            ingredientId: ingredient.id,
            sourceKey: ingredient.sourceKey,
            name: ingredient.name,
            requiredQuantity: relation.amountPerPerson * numberOfPeople,
            unit: relation.unit,
            required: relation.optional !== true,
          },
          "alias_missing",
        ),
      ];
    }
    if (
      !Number.isFinite(relation.amountPerPerson) ||
      relation.amountPerPerson <= 0 ||
      !Number.isInteger(numberOfPeople) ||
      numberOfPeople < 1
    ) {
      return [
        invalidIngredientResult(
          {
            ingredientId: ingredient.id,
            sourceKey: ingredient.sourceKey,
            name: ingredient.name,
            requiredQuantity: null,
            unit: relation.unit,
            required: relation.optional !== true,
          },
          "quantity_conversion_failed",
        ),
      ];
    }
    return [];
  });
}

export async function evaluateRecipeReadiness(
  recipes: Recipe[],
  numberOfPeople: number,
  catalog: RecipeCatalog,
  catalogRepository: CatalogRepository,
): Promise<RecipeReadinessGateResult> {
  const requirementsByRecipe = new Map<string, WeekIngredientRequirement[]>();
  const invalidByRecipe = new Map<string, IngredientReadinessResult[]>();
  const representativeRequirements = new Map<string, WeekIngredientRequirement>();

  recipes.forEach((recipe, index) => {
    const invalid = expectedIngredientProblems(recipe, numberOfPeople, catalog);
    let aggregated: WeekIngredientRequirement[] = [];
    try {
      aggregated = aggregateWeekIngredients(
        [selectedDay(recipe, index)],
        numberOfPeople,
        catalog,
      );
    } catch {
      invalid.push(
        invalidIngredientResult(
          { sourceKey: recipe.sourceKey, name: "Ingrediënthoeveelheden" },
          "quantity_conversion_failed",
        ),
      );
    }
    invalidByRecipe.set(recipe.id, invalid);
    const requirements = aggregated.filter(
      (requirement) =>
        !invalid.some(
          (problem) =>
            problem.ingredientId === requirement.ingredientId ||
            problem.sourceKey === requirement.sourceKey,
        ),
    );
    requirementsByRecipe.set(recipe.id, requirements);
    for (const requirement of requirements) {
      const key = recipeRequirementKey(requirement);
      if (!representativeRequirements.has(key)) {
        representativeRequirements.set(key, requirement);
      }
    }
  });

  const diagnostics = await matchWeekIngredientsWithDiagnostics(
    [...representativeRequirements.values()],
    catalog.ingredients,
    catalogRepository,
  );
  const diagnosticsByKey = new Map(
    diagnostics.map((item) => [recipeRequirementKey(item.requirement), item]),
  );
  const matchedProductsByRequirement = new Map<string, Product>();
  for (const [key, diagnostic] of diagnosticsByKey) {
    if (diagnostic.product) matchedProductsByRequirement.set(key, diagnostic.product);
  }

  const results = recipes.map((recipe) => {
    const ingredientResults = [
      ...(invalidByRecipe.get(recipe.id) ?? []),
      ...(requirementsByRecipe.get(recipe.id) ?? []).map((requirement) => {
        const diagnostic = diagnosticsByKey.get(recipeRequirementKey(requirement));
        if (!diagnostic) {
          return invalidIngredientResult(requirement, "ingredient_invalid");
        }
        const applied = applyProductToRequirement(requirement, diagnostic.product);
        return resultForRequirement(applied, { ...diagnostic, requirement: applied });
      }),
    ];
    const required = ingredientResults.filter((item) => item.required);
    const readyRequiredIngredientCount = required.filter((item) => item.ready).length;

    return {
      recipeId: recipe.id,
      recipeSourceKey: recipe.sourceKey,
      recipeName: recipe.name,
      ready:
        required.length > 0 && readyRequiredIngredientCount === required.length,
      requiredIngredientCount: required.length,
      readyRequiredIngredientCount,
      problemCount: ingredientResults.filter((item) => !item.ready).length,
      ingredients: ingredientResults,
    } satisfies RecipeReadinessResult;
  });

  return { recipes: results, matchedProductsByRequirement };
}

export function applyReadinessProducts(
  requirements: WeekIngredientRequirement[],
  gate: Pick<RecipeReadinessGateResult, "matchedProductsByRequirement">,
): WeekIngredientRequirement[] {
  return requirements.map((requirement) =>
    applyProductToRequirement(
      requirement,
      gate.matchedProductsByRequirement.get(recipeRequirementKey(requirement)) ?? null,
    ),
  );
}

export function readyRecipeIds(
  gate: Pick<RecipeReadinessGateResult, "recipes">,
): ReadonlySet<string> {
  return new Set(gate.recipes.filter((item) => item.ready).map((item) => item.recipeId));
}
