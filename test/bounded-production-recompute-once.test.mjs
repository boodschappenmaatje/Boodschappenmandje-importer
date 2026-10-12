import test from "node:test";
import assert from "node:assert/strict";
import {
  ALLOWED_MATCH_KEYS,
  ALLOWED_RECIPE_IDS,
  PRODUCTION_ORIGIN,
} from "../src/bounded-production-recompute.mjs";
import {
  assertFirstAndOnlyDispatch,
  runBoundedRecomputeOnce,
  validateOneShotContext,
} from "../src/bounded-production-recompute-once.mjs";

const dependencies = [
  ...ALLOWED_MATCH_KEYS,
  ...Array.from({ length: 35 }, (_, index) => `meal-mix-ingredient:dependency-${index}:g:ingredient:generic`),
];
const token = "a".repeat(64);
const env = {
  GITHUB_REPOSITORY: "boodschappenmaatje/Boodschappenmandje-importer",
  GITHUB_REF: "refs/heads/main",
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_RUN_ATTEMPT: "1",
  GITHUB_RUN_ID: "12345",
  GITHUB_API_URL: "https://api.github.com",
  GITHUB_SERVER_URL: "https://github.com",
  GITHUB_TOKEN: "actions-read-token",
  BOUNDED_COMMIT_CONFIRMATION: "COMMIT_BOUNDED_READINESS_ONCE",
  PLANNER_CACHE_BASE_URL: PRODUCTION_ORIGIN,
  PLANNER_CACHE_ADMIN_TOKEN: "admin-secret",
  VERCEL_AUTOMATION_BYPASS_SECRET: "bypass-secret",
};

function dryRun(overrides = {}) {
  return {
    requestedRecipeIds: [...ALLOWED_RECIPE_IDS],
    resolvedRecipeIds: [...ALLOWED_RECIPE_IDS],
    requestedMatchKeys: [...ALLOWED_MATCH_KEYS],
    dependencyKeys: dependencies,
    subscriberScope: ALLOWED_RECIPE_IDS.flatMap((recipeId) =>
      Array.from({ length: 10 }, (_, index) => ({ recipeId, peopleCount: index + 1 }))),
    sourceRevision: "19904",
    casRevisions: [
      ...ALLOWED_RECIPE_IDS.map((id) => [`r:${id}`, "2"]),
      ...dependencies.map((key) => [`k:${key}`, "3"]),
    ],
    plannedMatchWrites: 3,
    plannedReadinessWrites: 70,
    unexpectedDependencies: [],
    blocked: false,
    reason: null,
    planToken: token,
    transactional: true,
    ...overrides,
  };
}

const committed = {
  blocked: false, reason: null, matchWrites: 3, readinessWrites: 70, outsideScopeEffects: 0,
  finalPlanToken: "b".repeat(64),
  validatedScope: { recipeIds: [...ALLOWED_RECIPE_IDS], matchKeys: [...ALLOWED_MATCH_KEYS] },
};
function verification(overrides = {}) {
  return {
    blocked: false, recipeCount: 7, matchKeyCount: 3, subscriberCount: 70,
    currentMatchRows: 3, currentReadinessRows: 70, invalidatedRows: 0,
    dependencyKeys: dependencies, sourceRevision: "19905", casRevisionCount: 45,
    revisionMetadataValidated: true, evaluatorVersions: [5],
    payloadsValidated: 70,
    expiryRange: {
      earliest: new Date(Date.now() + 60_000).toISOString(),
      latest: new Date(Date.now() + 86_400_000).toISOString(),
    },
    ...overrides,
  };
}
const apiRun = {
  id: 12345, event: "workflow_dispatch", head_branch: "main", run_attempt: 1,
  status: "in_progress", conclusion: null,
};
function response(data, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => data };
}
function sequence(responses, calls = []) {
  return async (url, options) => {
    calls.push({ url, options, body: options.body ? JSON.parse(options.body) : null });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
}
function successfulResponses() {
  return [
    response({ total_count: 1, workflow_runs: [apiRun] }),
    response(dryRun()), response(committed), response(verification()),
  ];
}

test("doet eerst een verse exacte dry-run, daarna één commitrequest en alleen-lezen verificatie", async () => {
  const calls = [];
  const result = await runBoundedRecomputeOnce({ env, fetchImpl: sequence(successfulResponses(), calls) });
  assert.equal(calls.length, 4);
  assert.match(calls[0].url, /actions\/workflows\/bounded-production-recompute-once.yml\/runs/);
  assert.deepEqual(calls.slice(1).map((call) => call.body.mode), ["dry-run", "write", "verify"]);
  assert.deepEqual(calls[1].body.recipeIds, [...ALLOWED_RECIPE_IDS]);
  assert.deepEqual(calls[1].body.matchKeys, [...ALLOWED_MATCH_KEYS]);
  assert.equal(calls[2].body.expectedPlanToken, token);
  assert.equal(calls[3].body.expectedPlanToken, undefined);
  assert.equal(calls.filter((call) => call.body?.mode === "write").length, 1);
  assert.equal(result.mode, "one-time-bounded-commit");
});

test("verwerpt afwijkende dispatchcontext vóór Actions- of Production-request", async () => {
  let calls = 0;
  for (const altered of [
    { GITHUB_REPOSITORY: "someone/else" }, { GITHUB_REF: "refs/heads/feature" },
    { GITHUB_EVENT_NAME: "push" }, { GITHUB_RUN_ATTEMPT: "2" },
    { BOUNDED_COMMIT_CONFIRMATION: "NO_COMMIT" },
  ]) {
    assert.throws(() => validateOneShotContext({ ...env, ...altered }));
  }
  await assert.rejects(() => runBoundedRecomputeOnce({
    env: { ...env, GITHUB_RUN_ATTEMPT: "2" }, fetchImpl: async () => { calls += 1; },
  }));
  assert.equal(calls, 0);
});

test("fail-closed bij reeds gebruikte, dubbele of onleesbare one-shot history", async () => {
  for (const history of [
    { total_count: 2, workflow_runs: [apiRun, { ...apiRun, id: 987 }] },
    { total_count: 1, workflow_runs: [{ ...apiRun, id: 987 }] },
    { total_count: 2, workflow_runs: [apiRun] },
  ]) {
    await assert.rejects(() => assertFirstAndOnlyDispatch({ env, fetchImpl: async () => response(history) }));
  }
  await assert.doesNotReject(() => assertFirstAndOnlyDispatch({ env, fetchImpl: async () => response({
    total_count: 2,
    workflow_runs: [apiRun, { ...apiRun, id: 678, status: "completed", conclusion: "skipped" }],
  }) }));
  await assert.rejects(() => assertFirstAndOnlyDispatch({ env, fetchImpl: async () => { throw new Error("network"); } }));
});

for (const [name, mutate] of [
  ["blocked dry-run", (plan) => ({ ...plan, blocked: true })],
  ["subscriber drift", (plan) => ({ ...plan, subscriberScope: plan.subscriberScope.slice(1) })],
  ["dependency drift", (plan) => ({ ...plan, dependencyKeys: plan.dependencyKeys.slice(1) })],
  ["CAS conflict or missing resource", (plan) => ({ ...plan, casRevisions: plan.casRevisions.slice(1) })],
  ["missing plan token", (plan) => ({ ...plan, planToken: null })],
]) {
  test(`${name} voorkomt iedere commit`, async () => {
    const calls = [];
    await assert.rejects(() => runBoundedRecomputeOnce({
      env, fetchImpl: sequence([response({ total_count: 1, workflow_runs: [apiRun] }), response(mutate(dryRun()))], calls),
    }));
    assert.equal(calls.filter((call) => call.body?.mode === "write").length, 0);
  });
}

test("ontbrekende Production-auth stopt vóór de Production-request", async () => {
  const calls = [];
  await assert.rejects(() => runBoundedRecomputeOnce({
    env: { ...env, PLANNER_CACHE_ADMIN_TOKEN: "" },
    fetchImpl: sequence([response({ total_count: 1, workflow_runs: [apiRun] })], calls),
  }));
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /api\.github\.com/);
});

test("geblokkeerde dry-run en commitfout stoppen zonder retry", async () => {
  const blockedCalls = [];
  await assert.rejects(() => runBoundedRecomputeOnce({ env, fetchImpl: sequence([
    response({ total_count: 1, workflow_runs: [apiRun] }), response({ ...dryRun(), blocked: true }),
  ], blockedCalls) }));
  assert.equal(blockedCalls.length, 2);
  assert.equal(blockedCalls.some((call) => call.body?.mode === "write"), false);

  const failedCalls = [];
  await assert.rejects(() => runBoundedRecomputeOnce({ env, fetchImpl: sequence([
    response({ total_count: 1, workflow_runs: [apiRun] }), response(dryRun()), response({ error: "conflict" }, 409),
  ], failedCalls) }));
  assert.equal(failedCalls.filter((call) => call.body?.mode === "write").length, 1);
  assert.equal(failedCalls.length, 3);
});

test("Production-authfout op de verse dry-run stopt vóór de commit", async () => {
  const calls = [];
  await assert.rejects(() => runBoundedRecomputeOnce({ env, fetchImpl: sequence([
    response({ total_count: 1, workflow_runs: [apiRun] }), response({ error: "unauthorized" }, 401),
  ], calls) }), /dry-run-request-failed-http-401/);
  assert.equal(calls.length, 2);
  assert.equal(calls.some((call) => call.body?.mode === "write"), false);
});

test("commit-timeout geeft onzekere uitkomst en wordt nooit herhaald", async () => {
  const calls = [];
  await assert.rejects(() => runBoundedRecomputeOnce({ env, fetchImpl: sequence([
    response({ total_count: 1, workflow_runs: [apiRun] }), response(dryRun()), new Error("timeout"),
  ], calls) }), /commit-outcome-unknown-no-retry/);
  assert.equal(calls.filter((call) => call.body?.mode === "write").length, 1);
  assert.equal(calls.length, 3);
});

test("afwijkende commit- of verificatieresponse stopt zonder tweede commit", async () => {
  const badCommitCalls = [];
  await assert.rejects(() => runBoundedRecomputeOnce({ env, fetchImpl: sequence([
    response({ total_count: 1, workflow_runs: [apiRun] }), response(dryRun()), response({ ...committed, readinessWrites: 69 }),
  ], badCommitCalls) }));
  assert.equal(badCommitCalls.filter((call) => call.body?.mode === "write").length, 1);
  assert.equal(badCommitCalls.length, 3);

  const badVerifyCalls = [];
  await assert.rejects(() => runBoundedRecomputeOnce({ env, fetchImpl: sequence([
    response({ total_count: 1, workflow_runs: [apiRun] }), response(dryRun()), response(committed), response(verification({ invalidatedRows: 1 })),
  ], badVerifyCalls) }));
  assert.equal(badVerifyCalls.filter((call) => call.body?.mode === "write").length, 1);
  assert.equal(badVerifyCalls.length, 4);
});

test("summary logt geen credentials of plan-tokens", async () => {
  const { mkdtemp, readFile, rm } = await import("node:fs/promises");
  const { join } = await import("node:path");
  const { tmpdir } = await import("node:os");
  const dir = await mkdtemp(join(tmpdir(), "bounded-one-shot-"));
  const summaryPath = join(dir, "summary.md");
  try {
    await runBoundedRecomputeOnce({ env, summaryPath, fetchImpl: sequence(successfulResponses()) });
    const output = await readFile(summaryPath, "utf8");
    assert.doesNotMatch(output, /admin-secret|bypass-secret|actions-read-token|a{64}|b{64}/);
    assert.match(output, /Exactly one commit request/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
