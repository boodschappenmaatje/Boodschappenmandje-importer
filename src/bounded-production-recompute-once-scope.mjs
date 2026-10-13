// Scope and dry-run validation for the separate one-shot write/verify workflow.
// Keep this independent from the Shanghai shared-scope read-only runner.
export const ALLOWED_RECIPE_IDS = Object.freeze([
  "4e60b9b6-abd3-46e7-b6a1-b10f73ccbec3",
  "baf31144-bb45-4c2b-aa2f-2f9be588b01c",
  "3bbe1561-d757-422e-aded-3d802310805c",
  "5726609e-82a3-4fa7-b5b0-dab78b2b59f1",
  "4f871e07-a684-4014-843a-f72a11b4c01d",
  "2825125a-4ec4-4fae-a5f3-b44be2afb0aa",
  "6a85d19f-5654-440b-b296-325c8f9fbd30",
]);
export const ALLOWED_MATCH_KEYS = Object.freeze([
  "meal-mix-ingredient:mix-supplement-hacheevlees:g:ingredient:generic",
  "meal-mix-ingredient:mix-supplement-tomaten:piece:ingredient:generic",
  "meal-mix-ingredient:mix-supplement-pitabroodjes:g:ingredient:generic",
]);
const PEOPLE_COUNTS = Object.freeze(Array.from({ length: 10 }, (_, index) => index + 1));
const SHA256 = /^[a-f0-9]{64}$/;

function fail(message) {
  throw new Error(message);
}

function stable(values) {
  return [...values].sort();
}

function sameValues(actual, expected) {
  return Array.isArray(actual) && JSON.stringify(stable(actual)) === JSON.stringify(stable(expected));
}

export function validateDryRun(plan) {
  if (!plan || typeof plan !== "object" || plan.blocked !== false || plan.reason !== null ||
      plan.transactional !== true || !SHA256.test(plan.planToken ?? "")) fail("dry-run-plan-blocked-or-incomplete");
  if (!sameValues(plan.requestedRecipeIds, ALLOWED_RECIPE_IDS) ||
      !sameValues(plan.resolvedRecipeIds, ALLOWED_RECIPE_IDS)) {
    fail("dry-run-recipe-scope-mismatch");
  }
  if (!sameValues(plan.requestedMatchKeys, ALLOWED_MATCH_KEYS)) fail("dry-run-matchkey-scope-mismatch");
  if (plan.plannedMatchWrites !== ALLOWED_MATCH_KEYS.length || plan.plannedReadinessWrites !== 70) {
    fail("dry-run-write-count-mismatch");
  }
  if (!Array.isArray(plan.unexpectedDependencies) || plan.unexpectedDependencies.length !== 0) {
    fail("dry-run-unexpected-dependencies");
  }
  if (!Array.isArray(plan.dependencyKeys) || plan.dependencyKeys.length < ALLOWED_MATCH_KEYS.length ||
      new Set(plan.dependencyKeys).size !== plan.dependencyKeys.length ||
      plan.dependencyKeys.some((key) => typeof key !== "string" ||
        !/^[A-Za-z0-9:_-]+:(g|kg|ml|l|piece|loaf):(ingredient|mealMix):[A-Za-z0-9_-]+$/.test(key)) ||
      !ALLOWED_MATCH_KEYS.every((key) => plan.dependencyKeys.includes(key))) {
    fail("dry-run-dependency-scope-invalid");
  }
  if (typeof plan.sourceRevision !== "string" || !/^\d+$/.test(plan.sourceRevision)) {
    fail("dry-run-source-revision-missing");
  }
  if (!Array.isArray(plan.casRevisions) || plan.casRevisions.length === 0 ||
      plan.casRevisions.some((entry) => !Array.isArray(entry) || entry.length !== 2 ||
        typeof entry[0] !== "string" || !entry[0] || typeof entry[1] !== "string" || !/^\d+$/.test(entry[1]))) {
    fail("dry-run-cas-revisions-invalid");
  }
  const expectedSubscribers = ALLOWED_RECIPE_IDS.flatMap((recipeId) => PEOPLE_COUNTS.map((peopleCount) => `${recipeId}:${peopleCount}`));
  const actualSubscribers = Array.isArray(plan.subscriberScope)
    ? plan.subscriberScope.map((entry) => `${entry?.recipeId}:${entry?.peopleCount}`)
    : [];
  if (!sameValues(actualSubscribers, expectedSubscribers) || actualSubscribers.length !== 70) {
    fail("dry-run-subscriber-scope-mismatch");
  }
  return plan;
}
