import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_MATCH_KEYS,
  ALLOWED_RECIPE_IDS,
  PRODUCTION_ORIGIN,
  runBoundedRecompute,
} from "../src/bounded-production-recompute.mjs";

const envBase = {
  PLANNER_CACHE_BASE_URL: PRODUCTION_ORIGIN,
  PLANNER_CACHE_ADMIN_TOKEN: "test-admin-token",
  VERCEL_AUTOMATION_BYPASS_SECRET: "test-bypass-secret",
};
const planToken = "a".repeat(64);

function dryRun(overrides = {}) {
  return {
    requestedRecipeIds: [...ALLOWED_RECIPE_IDS],
    resolvedRecipeIds: [...ALLOWED_RECIPE_IDS],
    requestedMatchKeys: [...ALLOWED_MATCH_KEYS],
    dependencyKeys: [
      ...ALLOWED_MATCH_KEYS,
      ...Array.from({ length: 35 }, (_, index) =>
        `meal-mix-ingredient:dependency-${index}:g:ingredient:generic`),
    ],
    subscriberScope: ALLOWED_RECIPE_IDS.flatMap((recipeId) =>
      Array.from({ length: 10 }, (_, index) => ({ recipeId, peopleCount: index + 1 }))),
    sourceRevision: "368",
    casRevisions: [["r:recipe", "4"], ["k:match", "2"]],
    plannedMatchWrites: 3,
    plannedReadinessWrites: 70,
    unexpectedDependencies: [],
    blocked: false,
    reason: null,
    planToken,
    transactional: true,
    ...overrides,
  };
}

function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(data) };
}

function fetchSequence(responses, calls = []) {
  return async (url, options) => {
    calls.push({ url, options, body: JSON.parse(options.body) });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
}

test("stuurt exact één geauthenticeerde dry-run met uitsluitend de vaste scope", async () => {
  const calls = [];
  const result = await runBoundedRecompute({ env: envBase, fetchImpl: fetchSequence([response(dryRun())], calls) });
  assert.equal(result.mode, "dry-run");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, `${PRODUCTION_ORIGIN}/api/internal/planner-readiness/bounded-refresh`);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.headers.authorization, "Bearer test-admin-token");
  assert.equal(calls[0].options.headers["x-vercel-protection-bypass"], "test-bypass-secret");
  assert.deepEqual(calls[0].body, {
    recipeIds: [...ALLOWED_RECIPE_IDS],
    matchKeys: [...ALLOWED_MATCH_KEYS],
    mode: "dry-run",
  });
  assert.equal(calls[0].body.expectedPlanToken, undefined);
});

test("ontbrekende auth faalt vóór netwerkverkeer", async () => {
  let calls = 0;
  await assert.rejects(() => runBoundedRecompute({
    env: { ...envBase, PLANNER_CACHE_ADMIN_TOKEN: "" },
    fetchImpl: async () => { calls += 1; },
  }), /production-auth-secret-missing-or-invalid/);
  assert.equal(calls, 0);
});

for (const [name, mutate] of [
  ["blocked response", (plan) => ({ ...plan, blocked: true })],
  ["onverwacht recept", (plan) => ({ ...plan, resolvedRecipeIds: [...ALLOWED_RECIPE_IDS.slice(0, 6), "11111111-1111-4111-8111-111111111111"] })],
  ["onverwachte matchkey", (plan) => ({ ...plan, requestedMatchKeys: [...ALLOWED_MATCH_KEYS.slice(0, 2), "meal-mix-ingredient:other:g:ingredient:generic"] })],
  ["onverwachte dependency", (plan) => ({ ...plan, unexpectedDependencies: ["outside-recipe:4"] })],
  ["onverwachte subscriber", (plan) => ({ ...plan, subscriberScope: [...plan.subscriberScope, { recipeId: "11111111-1111-4111-8111-111111111111", peopleCount: 4 }] })],
  ["ontbrekend plan-token", (plan) => ({ ...plan, planToken: null })],
  ["te veel readinessrijen", (plan) => ({ ...plan, plannedReadinessWrites: 71 })],
  ["ontbrekende CAS-revisies", (plan) => ({ ...plan, casRevisions: [] })],
]) {
  test(`${name} stopt fail-closed na alleen de dry-run`, async () => {
    const calls = [];
    await assert.rejects(() => runBoundedRecompute({
      env: envBase,
      fetchImpl: fetchSequence([response(mutate(dryRun()))], calls),
    }));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.mode, "dry-run");
  });
}

test("HTTP-authfout stopt zonder retry of tweede request", async () => {
  const calls = [];
  await assert.rejects(() => runBoundedRecompute({
    env: envBase,
    fetchImpl: fetchSequence([response({ error: "unauthorized" }, 401)], calls),
  }), /production-request-failed-http-401/);
  assert.equal(calls.length, 1);
});

test("runneroutput bevat geen credentials of plan-token", async () => {
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(join(tmpdir(), "bounded-dry-run-"));
  const summaryPath = join(dir, "summary.md");
  try {
    await runBoundedRecompute({ env: envBase, fetchImpl: fetchSequence([response(dryRun())]), summaryPath });
    const summary = await readFile(summaryPath, "utf8");
    assert.doesNotMatch(summary, /test-admin-token|test-bypass-secret|a{64}/);
    assert.match(summary, /no commit request exists in this runner/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
