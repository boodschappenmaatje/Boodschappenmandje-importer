import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

export const PRODUCTION_ORIGIN = "https://boodschappenmaatje-pwa.vercel.app";
export const ENDPOINT_PATH = "/api/internal/planner-readiness/bounded-refresh";
export const ALLOWED_RECIPE_IDS = Object.freeze([
  "0dd9fbc7-6fa9-4b50-ab47-b1fa1e4cca8d",
  "17966cab-93ca-4364-b99c-c6fe7aff36ac",
  "189d9b3c-073a-43c7-8930-8191b22421bb",
  "2825125a-4ec4-4fae-a5f3-b44be2afb0aa",
  "39189d5d-21c6-4d57-a462-f95b63c0dda5",
  "3bbe1561-d757-422e-aded-3d802310805c",
  "4f871e07-a684-4014-843a-f72a11b4c01d",
  "5c655d2e-97f1-4d8c-8b97-10881e5589b0",
  "672ea259-71bc-446f-881c-8e59cf675fe2",
  "6a85d19f-5654-440b-b296-325c8f9fbd30",
  "6bb5396c-ee59-46bd-bb75-12f68c142fc2",
  "7ba39ebe-a057-4044-a47b-f9e79e2ef52f",
  "8f8c6883-2a58-4671-b5c4-13cd588d72ba",
  "ac562f36-fa92-4540-9e2d-4e073ca6b989",
  "af9c3407-a24d-4142-b8b6-cc18bc63defd",
  "bd423b61-4eb8-458e-8d32-bb64a9b38bda",
  "c4ace2a9-237b-4884-93d4-12fdc066274b",
  "c6903433-cfd0-4c97-ae1f-350f1625636b",
  "de621d70-dab9-4ad0-9747-43605a34af2a",
  "e33fcd95-34c9-471d-befe-76095b9d96e9",
]);
export const ALLOWED_MATCH_KEYS = Object.freeze([
  "meal-mix-ingredient:mix-supplement-olie:ml:ingredient:generic",
  "meal-mix-ingredient:mix-supplement-ui:piece:ingredient:generic",
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
  if (plan.plannedMatchWrites !== ALLOWED_MATCH_KEYS.length || plan.plannedReadinessWrites !== 200) {
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
  if (!sameValues(actualSubscribers, expectedSubscribers) || actualSubscribers.length !== 200) {
    fail("dry-run-subscriber-scope-mismatch");
  }
  return plan;
}

function validateEndpointAndAuth(env) {
  if (env.PLANNER_CACHE_BASE_URL?.trim() !== PRODUCTION_ORIGIN) fail("production-origin-mismatch");
  const token = env.PLANNER_CACHE_ADMIN_TOKEN?.trim();
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!token || /\s/.test(token) || !bypass) fail("production-auth-secret-missing-or-invalid");
  return { token, bypass, url: `${PRODUCTION_ORIGIN}${ENDPOINT_PATH}` };
}

async function postJson(fetchImpl, url, headers, payload) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
    cache: "no-store",
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    fail(`production-response-invalid-http-${response.status}`);
  }
  if (!response.ok) fail(`production-request-failed-http-${response.status}`);
  return data;
}

function scopeLines(plan) {
  const lines = [
    "## READ ONLY — NO REPAIR",
    "",
    `- Endpoint: POST ${ENDPOINT_PATH}`,
    `- Recipes (${plan.requestedRecipeIds.length}): ${plan.requestedRecipeIds.join(", ")}`,
    `- Match keys (${plan.requestedMatchKeys.length}): ${plan.requestedMatchKeys.join(", ")}`,
    `- Dependency keys (${plan.dependencyKeys.length}): ${plan.dependencyKeys.join(", ")}`,
    `- Subscribers: ${plan.subscriberScope.length}; unexpected: ${plan.unexpectedDependencies.length}`,
    `- Planned writes: ${plan.plannedMatchWrites} match + ${plan.plannedReadinessWrites} readiness rows`,
    `- Source revision: ${plan.sourceRevision}; CAS revision entries: ${plan.casRevisions.length}`,
    "- Plan token: present; value withheld",
    "",
  ];
  return lines.join("\n");
}

export async function runBoundedRecompute({ env = process.env, fetchImpl = fetch, summaryPath = env.GITHUB_STEP_SUMMARY } = {}) {
  const { token, bypass, url } = validateEndpointAndAuth(env);
  const headers = {
    authorization: `Bearer ${token}`,
    "x-vercel-protection-bypass": bypass,
    "content-type": "application/json",
    accept: "application/json",
  };
  const plan = validateDryRun(await postJson(fetchImpl, url, headers, {
    recipeIds: [...ALLOWED_RECIPE_IDS],
    matchKeys: [...ALLOWED_MATCH_KEYS],
    mode: "dry-run",
  }));
  if (summaryPath) await appendFile(summaryPath, `${scopeLines(plan)}\n- Runner: dry-run only; no commit request exists in this runner.\n`);
  return { mode: "dry-run", plan };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runBoundedRecompute();
  } catch (error) {
    console.error(`Bounded recompute stopped safely: ${error instanceof Error ? error.message : "unknown-error"}`);
    process.exitCode = 1;
  }
}
