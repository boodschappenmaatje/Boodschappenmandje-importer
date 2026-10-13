import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  ALLOWED_MATCH_KEYS,
  ALLOWED_RECIPE_IDS,
  PRODUCTION_ORIGIN,
} from "../src/bounded-production-recompute.mjs";
import {
  assertShanghaiFirstAndOnlyDispatch,
  runBoundedShanghaiSharedRefreshOnce,
  validateShanghaiOneShotContext,
} from "../src/bounded-production-recompute-shanghai-once.mjs";

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
  GITHUB_RUN_ID: "7654321",
  GITHUB_API_URL: "https://api.github.com",
  GITHUB_SERVER_URL: "https://github.com",
  GITHUB_TOKEN: "actions-read-token",
  BOUNDED_COMMIT_CONFIRMATION: "COMMIT_SHANGHAI_SHARED_MATCH_REFRESH",
  PLANNER_CACHE_BASE_URL: PRODUCTION_ORIGIN,
  PLANNER_CACHE_ADMIN_TOKEN: "admin-secret",
  VERCEL_AUTOMATION_BYPASS_SECRET: "bypass-secret",
};
const subscribers = ALLOWED_RECIPE_IDS.flatMap((recipeId) =>
  Array.from({ length: 10 }, (_, index) => ({ recipeId, peopleCount: index + 1 })));
function dryRun(overrides = {}) {
  return {
    requestedRecipeIds: [...ALLOWED_RECIPE_IDS], resolvedRecipeIds: [...ALLOWED_RECIPE_IDS],
    requestedMatchKeys: [...ALLOWED_MATCH_KEYS], dependencyKeys: dependencies,
    subscriberScope: subscribers, sourceRevision: "368",
    casRevisions: [
      ...ALLOWED_RECIPE_IDS.map((id) => [`r:${id}`, "2"]),
      ...dependencies.map((key) => [`k:${key}`, "3"]),
    ],
    plannedMatchWrites: 2, plannedReadinessWrites: 200, unexpectedDependencies: [],
    blocked: false, reason: null, planToken: token, transactional: true,
    ...overrides,
  };
}
const committed = {
  blocked: false, reason: null, matchWrites: 2, readinessWrites: 200, outsideScopeEffects: 0,
  finalPlanToken: "b".repeat(64),
  validatedScope: { recipeIds: [...ALLOWED_RECIPE_IDS], matchKeys: [...ALLOWED_MATCH_KEYS] },
};
function verification(overrides = {}) {
  return {
    blocked: false, reason: null, recipeCount: 20, matchKeyCount: 2, subscriberCount: 200,
    currentMatchRows: 2, currentReadinessRows: 200, invalidatedRows: 0,
    dependencyKeys: dependencies, sourceRevision: "369", casRevisionCount: 57,
    revisionMetadataValidated: true, evaluatorVersions: [5], payloadsValidated: 200,
    expiryRange: {
      earliest: new Date(Date.now() + 60_000).toISOString(),
      latest: new Date(Date.now() + 86_400_000).toISOString(),
    },
    ...overrides,
  };
}
const apiRun = { id: 7654321, event: "workflow_dispatch", head_branch: "main", run_attempt: 1, status: "in_progress", conclusion: null };
function response(data, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => data }; }
function sequence(responses, calls = []) {
  return async (url, options) => {
    calls.push({ url, options, body: options.body ? JSON.parse(options.body) : null });
    const next = responses.shift();
    if (next instanceof Error) throw next;
    return next;
  };
}
function successfulResponses() {
  return [response({ total_count: 1, workflow_runs: [apiRun] }), response(dryRun()), response(committed), response(verification())];
}

test("exact 20/2/200 Shanghai scope uses one write then verifies, with no token in output", async () => {
  const calls = [];
  const dir = await mkdtemp(join(tmpdir(), "shanghai-once-"));
  const summaryPath = join(dir, "summary.md");
  try {
    const result = await runBoundedShanghaiSharedRefreshOnce({ env, fetchImpl: sequence(successfulResponses(), calls), summaryPath });
    assert.equal(calls.length, 4);
    assert.match(calls[0].url, /bounded-production-recompute-shanghai-once\.yml\/runs/);
    assert.deepEqual(calls.slice(1).map((call) => call.body.mode), ["dry-run", "write", "verify"]);
    assert.deepEqual(calls[1].body.recipeIds, [...ALLOWED_RECIPE_IDS]);
    assert.deepEqual(calls[1].body.matchKeys, [...ALLOWED_MATCH_KEYS]);
    assert.equal(calls[1].body.recipeIds.length, 20);
    assert.equal(calls[1].body.matchKeys.length, 2);
    assert.equal(calls[2].body.expectedPlanToken, token);
    assert.equal(calls.filter((call) => call.body?.mode === "write").length, 1);
    assert.equal(result.mode, "one-time-shanghai-shared-match-refresh");
    const summary = await readFile(summaryPath, "utf8");
    assert.match(summary, /20; match keys: 2; subscribers: 200/);
    assert.doesNotMatch(summary, /admin-secret|bypass-secret|actions-read-token|a{64}|b{64}/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("workflow is manual-only, main-only and gated by the Shanghai confirmation", async () => {
  const workflow = await readFile(new URL("../.github/workflows/bounded-production-recompute-shanghai-once.yml", import.meta.url), "utf8");
  assert.match(workflow, /on:\s+workflow_dispatch:/);
  assert.match(workflow, /default: NO_REFRESH/);
  assert.match(workflow, /COMMIT_SHANGHAI_SHARED_MATCH_REFRESH/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /inputs\.confirmation == 'COMMIT_SHANGHAI_SHARED_MATCH_REFRESH'/);
  assert.match(workflow, /PLANNER_CACHE_ADMIN_TOKEN: \$\{\{ secrets\.PLANNER_CACHE_ADMIN_TOKEN \}\}/);
  assert.match(workflow, /VERCEL_AUTOMATION_BYPASS_SECRET: \$\{\{ secrets\.VERCEL_AUTOMATION_BYPASS_SECRET \}\}/);
  assert.match(workflow, /node src\/bounded-production-recompute-shanghai-once\.mjs/);
  assert.doesNotMatch(workflow, /pull_request:|schedule:/);
});

test("invalid dispatch context stops before Actions or Production requests", async () => {
  for (const altered of [
    { GITHUB_REPOSITORY: "someone/else" }, { GITHUB_REF: "refs/heads/feature" },
    { GITHUB_EVENT_NAME: "push" }, { GITHUB_RUN_ATTEMPT: "2" },
    { BOUNDED_COMMIT_CONFIRMATION: "NO_REFRESH" },
  ]) assert.throws(() => validateShanghaiOneShotContext({ ...env, ...altered }));
  let calls = 0;
  await assert.rejects(() => runBoundedShanghaiSharedRefreshOnce({
    env: { ...env, GITHUB_RUN_ATTEMPT: "2" }, fetchImpl: async () => { calls += 1; },
  }));
  assert.equal(calls, 0);
});

test("used, duplicate or ambiguous workflow history fails closed", async () => {
  const history = [
    { total_count: 2, workflow_runs: [apiRun, { ...apiRun, id: 123 }] },
    { total_count: 1, workflow_runs: [{ ...apiRun, id: 123 }] },
    { total_count: 2, workflow_runs: [apiRun] },
  ];
  for (const data of history) await assert.rejects(() => assertShanghaiFirstAndOnlyDispatch({ env, fetchImpl: async () => response(data) }));
  await assert.doesNotReject(() => assertShanghaiFirstAndOnlyDispatch({ env, fetchImpl: async () => response({
    total_count: 2, workflow_runs: [apiRun, { ...apiRun, id: 124, status: "completed", conclusion: "skipped" }],
  }) }));
});

for (const [name, mutate] of [
  ["blocked plan", (plan) => ({ ...plan, blocked: true })],
  ["subscriber missing", (plan) => ({ ...plan, subscriberScope: plan.subscriberScope.slice(1) })],
  ["unexpected dependency", (plan) => ({ ...plan, unexpectedDependencies: ["outside:1"] })],
  ["CAS resource missing", (plan) => ({ ...plan, casRevisions: plan.casRevisions.slice(1) })],
  ["planned count changed", (plan) => ({ ...plan, plannedReadinessWrites: 199 })],
  ["plan token missing", (plan) => ({ ...plan, planToken: null })],
]) {
  test(`${name} prevents every write request`, async () => {
    const calls = [];
    await assert.rejects(() => runBoundedShanghaiSharedRefreshOnce({
      env, fetchImpl: sequence([response({ total_count: 1, workflow_runs: [apiRun] }), response(mutate(dryRun()))], calls),
    }));
    assert.equal(calls.filter((call) => call.body?.mode === "write").length, 0);
  });
}

test("commit transport uncertainty never retries the write", async () => {
  const calls = [];
  await assert.rejects(() => runBoundedShanghaiSharedRefreshOnce({
    env, fetchImpl: sequence([response({ total_count: 1, workflow_runs: [apiRun] }), response(dryRun()), new Error("timeout")], calls),
  }), /commit-outcome-unknown-no-retry/);
  assert.equal(calls.filter((call) => call.body?.mode === "write").length, 1);
  assert.equal(calls.length, 3);
});

test("bad commit or verification response cannot trigger a second write", async () => {
  for (const [bad, suffix] of [[{ ...committed, readinessWrites: 199 }, []], [committed, [response(verification({ invalidatedRows: 1 }))]]]) {
    const calls = [];
    const responses = [response({ total_count: 1, workflow_runs: [apiRun] }), response(dryRun()), response(bad), ...suffix];
    if (suffix.length === 0) responses[2] = response(bad);
    await assert.rejects(() => runBoundedShanghaiSharedRefreshOnce({ env, fetchImpl: sequence(responses, calls) }));
    assert.equal(calls.filter((call) => call.body?.mode === "write").length, 1);
  }
});
