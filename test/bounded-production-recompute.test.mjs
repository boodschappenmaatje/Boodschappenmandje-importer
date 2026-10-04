import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_MATCH_KEYS,
  PRODUCTION_ORIGIN,
  runBoundedRecompute,
} from "../src/bounded-production-recompute.mjs";

const recipeIds = Array.from({ length: 7 }, (_, index) =>
  `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const envBase = {
  RECIPE_IDS_JSON: JSON.stringify(recipeIds),
  RECOMPUTE_ARMED: "false",
  PLANNER_CACHE_BASE_URL: PRODUCTION_ORIGIN,
  PLANNER_CACHE_ADMIN_TOKEN: "test-admin-token",
  VERCEL_AUTOMATION_BYPASS_SECRET: "test-bypass",
};
const planToken = "a".repeat(64);

function dryRun(overrides = {}) {
  return {
    requestedRecipeIds: [...recipeIds],
    resolvedRecipeIds: [...recipeIds],
    requestedMatchKeys: [...ALLOWED_MATCH_KEYS],
    dependencyKeys: [
      ...ALLOWED_MATCH_KEYS,
      ...Array.from({ length: 35 }, (_, index) =>
        `meal-mix-ingredient:dependency-${index}:g:ingredient:generic`),
    ],
    subscriberScope: recipeIds.flatMap((recipeId) =>
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

function commitResult(overrides = {}) {
  return {
    blocked: false,
    matchWrites: 3,
    readinessWrites: 70,
    outsideScopeEffects: 0,
    finalPlanToken: "b".repeat(64),
    validatedScope: { recipeIds: [...recipeIds], matchKeys: [...ALLOWED_MATCH_KEYS] },
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

test("DISARMED doet precies één verse dry-run en kan geen commit sturen", async () => {
  const calls = [];
  const result = await runBoundedRecompute({ env: envBase, fetchImpl: fetchSequence([response(dryRun())], calls) });
  assert.equal(result.mode, "dry-run");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].body.mode, "dry-run");
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
  ["blocked=true", (plan) => ({ ...plan, blocked: true })],
  ["onverwachte recipe ID", (plan) => ({ ...plan, resolvedRecipeIds: [...recipeIds.slice(0, 6), "11111111-1111-4111-8111-111111111111"] })],
  ["onverwachte matchkey", (plan) => ({ ...plan, requestedMatchKeys: [...ALLOWED_MATCH_KEYS.slice(0, 2), "meal-mix-ingredient:other:g:ingredient:generic"] })],
  ["onverwachte dependency", (plan) => ({ ...plan, unexpectedDependencies: ["outside-recipe:4"] })],
  ["onverwachte subscriber", (plan) => ({ ...plan, subscriberScope: [...plan.subscriberScope, { recipeId: "11111111-1111-4111-8111-111111111111", peopleCount: 4 }] })],
  ["ontbrekend plan-token", (plan) => ({ ...plan, planToken: null })],
]) {
  test(`${name} stopt vóór commit`, async () => {
    const calls = [];
    await assert.rejects(() => runBoundedRecompute({
      env: envBase,
      fetchImpl: fetchSequence([response(mutate(dryRun()))], calls),
    }));
    assert.equal(calls.length, 1);
    assert.equal(calls[0].body.mode, "dry-run");
  });
}

test("ARMED gebruikt exact het verse plan en maakt één commitrequest bereikbaar", async () => {
  const calls = [];
  const result = await runBoundedRecompute({
    env: { ...envBase, RECOMPUTE_ARMED: "true" },
    fetchImpl: fetchSequence([response(dryRun()), response(commitResult())], calls),
  });
  assert.equal(result.mode, "write");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].body.mode, "dry-run");
  assert.equal(calls[1].body.mode, "write");
  assert.equal(calls[1].body.expectedPlanToken, planToken);
  assert.deepEqual(calls[1].body.recipeIds, calls[0].body.recipeIds);
  assert.deepEqual(calls[1].body.matchKeys, calls[0].body.matchKeys);
});

test("409 wordt gestopt zonder automatische retry", async () => {
  const calls = [];
  await assert.rejects(() => runBoundedRecompute({
    env: { ...envBase, RECOMPUTE_ARMED: "true" },
    fetchImpl: fetchSequence([response(dryRun()), response({ blocked: true }, 409)], calls),
  }), /http-409/);
  assert.equal(calls.filter((call) => call.body.mode === "write").length, 1);
});

test("5xx na commitrequest veroorzaakt geen tweede write", async () => {
  const calls = [];
  await assert.rejects(() => runBoundedRecompute({
    env: { ...envBase, RECOMPUTE_ARMED: "true" },
    fetchImpl: fetchSequence([response(dryRun()), response({ error: "bounded-refresh-failed" }, 503)], calls),
  }), /http-503/);
  assert.equal(calls.filter((call) => call.body.mode === "write").length, 1);
});

test("een wijziging tussen fresh dry-run en commit wordt door één CAS-request afgewezen", async () => {
  const calls = [];
  await assert.rejects(() => runBoundedRecompute({
    env: { ...envBase, RECOMPUTE_ARMED: "true" },
    fetchImpl: fetchSequence([response(dryRun()), response({ blocked: true }, 409)], calls),
  }));
  assert.equal(calls[1].body.expectedPlanToken, planToken);
  assert.equal(calls.filter((call) => call.body.mode === "write").length, 1);
});
