import { appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import {
  ENDPOINT_PATH,
  PRODUCTION_ORIGIN,
} from "./bounded-production-recompute.mjs";
import {
  ALLOWED_MATCH_KEYS,
  ALLOWED_RECIPE_IDS,
  validateDryRun,
} from "./bounded-production-recompute-once-scope.mjs";

const WORKFLOW_FILE = "bounded-production-recompute-once.yml";
const CONFIRMATION = "COMMIT_BOUNDED_READINESS_ONCE";
const RESOURCE_KEY = /^[A-Za-z0-9:_-]+:(g|kg|ml|l|piece|loaf):(ingredient|mealMix):[A-Za-z0-9_-]+$/;
const SHA256 = /^[a-f0-9]{64}$/;

function fail(code) { throw new Error(code); }
function sameValues(actual, expected) {
  return Array.isArray(actual) && JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
}

export function validateOneShotContext(env) {
  if (env.GITHUB_REPOSITORY !== "boodschappenmaatje/Boodschappenmandje-importer" ||
      env.GITHUB_REF !== "refs/heads/main" || env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      env.GITHUB_RUN_ATTEMPT !== "1" || env.BOUNDED_COMMIT_CONFIRMATION !== CONFIRMATION) {
    fail("one-shot-context-invalid");
  }
  if (!/^\d+$/.test(env.GITHUB_RUN_ID ?? "") || !env.GITHUB_TOKEN ||
      !env.GITHUB_API_URL || !env.GITHUB_SERVER_URL) fail("one-shot-actions-context-missing");
}

export async function assertFirstAndOnlyDispatch({ env, fetchImpl = fetch }) {
  const repository = env.GITHUB_REPOSITORY;
  const apiUrl = `${env.GITHUB_API_URL}/repos/${repository}/actions/workflows/${WORKFLOW_FILE}/runs?per_page=100`;
  let response;
  try {
    response = await fetchImpl(apiUrl, {
      method: "GET",
      headers: { authorization: `Bearer ${env.GITHUB_TOKEN}`, accept: "application/vnd.github+json", "x-github-api-version": "2022-11-28" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    fail("one-shot-history-unavailable");
  }
  if (!response.ok) fail("one-shot-history-unavailable");
  let history;
  try { history = await response.json(); } catch { fail("one-shot-history-invalid"); }
  const runs = history?.workflow_runs;
  const currentRuns = Array.isArray(runs) ? runs.filter((run) => String(run?.id) === env.GITHUB_RUN_ID) : [];
  const priorExecution = Array.isArray(runs) && runs.some((run) => String(run?.id) !== env.GITHUB_RUN_ID &&
    !(run?.status === "completed" && run?.conclusion === "skipped"));
  if (!Array.isArray(runs) || history?.total_count !== runs.length || history.total_count > 100 ||
      currentRuns.length !== 1 || priorExecution || currentRuns[0]?.event !== "workflow_dispatch" ||
      currentRuns[0]?.head_branch !== "main" || currentRuns[0]?.run_attempt !== 1 ||
      currentRuns[0]?.status !== "in_progress") {
    fail("one-shot-route-already-used-or-ambiguous");
  }
}

function validateCas(plan) {
  const expected = new Set([
    ...ALLOWED_RECIPE_IDS.map((id) => `r:${id}`),
    ...plan.dependencyKeys.map((key) => `k:${key}`),
  ]);
  const entries = plan.casRevisions;
  if (!Array.isArray(entries) || entries.length < expected.size) fail("dry-run-cas-revisions-incomplete");
  if (entries.some((entry) => !Array.isArray(entry) || entry.length !== 2)) fail("dry-run-cas-revisions-invalid");
  const resources = entries.map((entry) => entry[0]);
  if (new Set(resources).size !== resources.length ||
      entries.some((entry) => !expected.has(entry[0]) &&
        !(typeof entry[0] === "string" && entry[0].startsWith("k:") && RESOURCE_KEY.test(entry[0].slice(2)))) ||
      [...expected].some((resource) => !resources.includes(resource)) ||
      entries.some((entry) => typeof entry[1] !== "string" || !/^\d+$/.test(entry[1]))) {
    fail("dry-run-cas-revisions-invalid");
  }
}

function validateCommit(result) {
  if (!result || result.blocked !== false || result.reason !== null ||
      result.matchWrites !== 3 || result.readinessWrites !== 70 || result.outsideScopeEffects !== 0 ||
      !SHA256.test(result.finalPlanToken ?? "") ||
      !sameValues(result.validatedScope?.recipeIds, ALLOWED_RECIPE_IDS) ||
      !sameValues(result.validatedScope?.matchKeys, ALLOWED_MATCH_KEYS)) {
    fail("commit-response-invalid");
  }
  return result;
}

function validateVerification(result) {
  if (!result || result.blocked !== false || result.recipeCount !== 7 || result.matchKeyCount !== 3 ||
      result.subscriberCount !== 70 || result.currentMatchRows !== 3 || result.currentReadinessRows !== 70 ||
      result.invalidatedRows !== 0 || result.payloadsValidated !== 70 ||
      result.revisionMetadataValidated !== true || !Array.isArray(result.evaluatorVersions) ||
      result.evaluatorVersions.length === 0 || result.evaluatorVersions.some((version) => !Number.isInteger(version)) ||
      typeof result.sourceRevision !== "string" || !/^\d+$/.test(result.sourceRevision) ||
      !Number.isInteger(result.casRevisionCount) || result.casRevisionCount < 7 ||
      !Array.isArray(result.dependencyKeys) || new Set(result.dependencyKeys).size !== result.dependencyKeys.length ||
      result.dependencyKeys.some((key) => typeof key !== "string" || !RESOURCE_KEY.test(key)) ||
      !ALLOWED_MATCH_KEYS.every((key) => result.dependencyKeys.includes(key)) ||
      !Number.isFinite(Date.parse(result.expiryRange?.earliest)) ||
      !Number.isFinite(Date.parse(result.expiryRange?.latest)) ||
      Date.parse(result.expiryRange.earliest) <= Date.now() ||
      Date.parse(result.expiryRange.latest) < Date.parse(result.expiryRange.earliest)) {
    fail("read-only-verification-invalid");
  }
  return result;
}

async function postJson(fetchImpl, url, headers, body, stage) {
  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST", headers, body: JSON.stringify(body), cache: "no-store", redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    fail(stage === "commit" ? "commit-outcome-unknown-no-retry" : `${stage}-request-failed`);
  }
  let data;
  try { data = await response.json(); } catch { fail(`${stage}-response-invalid`); }
  if (!response.ok) fail(`${stage}-request-failed-http-${response.status}`);
  return data;
}

function summary(dryRun, committed, verification) {
  return [
    "## Bounded planner-cache one-time route",
    "",
    "- Fresh authenticated dry-run: passed; plan token withheld",
    `- Commit response: ${committed.matchWrites} match rows + ${committed.readinessWrites} readiness rows; outside-scope effects: ${committed.outsideScopeEffects}`,
    `- Read-only verification: ${verification.currentMatchRows} current match rows; ${verification.currentReadinessRows} current readiness rows; ${verification.invalidatedRows} invalidated rows`,
    `- Recipes: ${verification.recipeCount}; match keys: ${verification.matchKeyCount}; subscribers: ${verification.subscriberCount}`,
    `- Dependency keys observed: ${verification.dependencyKeys.length}; source revision: ${verification.sourceRevision}; CAS resources: ${verification.casRevisionCount}`,
    `- Readiness payloads validated: ${verification.payloadsValidated}; expiry: ${verification.expiryRange.earliest} — ${verification.expiryRange.latest}`,
    `- Dry-run planned counts: ${dryRun.plannedMatchWrites} match + ${dryRun.plannedReadinessWrites} readiness rows`,
    "- Exactly one commit request was issued; the workflow has no retry or second-commit path.",
    "",
  ].join("\n");
}

export async function runBoundedRecomputeOnce({ env = process.env, fetchImpl = fetch, summaryPath = env.GITHUB_STEP_SUMMARY } = {}) {
  validateOneShotContext(env);
  await assertFirstAndOnlyDispatch({ env, fetchImpl });
  if (env.PLANNER_CACHE_BASE_URL?.trim() !== PRODUCTION_ORIGIN) fail("production-origin-mismatch");
  const token = env.PLANNER_CACHE_ADMIN_TOKEN?.trim();
  const bypass = env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim();
  if (!token || /\s/.test(token) || !bypass) fail("production-auth-secret-missing-or-invalid");
  const url = `${PRODUCTION_ORIGIN}${ENDPOINT_PATH}`;
  const headers = {
    authorization: `Bearer ${token}`,
    "x-vercel-protection-bypass": bypass,
    "content-type": "application/json",
    accept: "application/json",
  };
  const scope = { recipeIds: [...ALLOWED_RECIPE_IDS], matchKeys: [...ALLOWED_MATCH_KEYS] };
  const dryRun = validateDryRun(await postJson(fetchImpl, url, headers, { ...scope, mode: "dry-run" }, "dry-run"));
  validateCas(dryRun);
  // This is the sole commit request. Any transport uncertainty stops the run; it never retries.
  const committed = validateCommit(await postJson(fetchImpl, url, headers, {
    ...scope, mode: "write", expectedPlanToken: dryRun.planToken,
  }, "commit"));
  const verification = validateVerification(await postJson(fetchImpl, url, headers, { ...scope, mode: "verify" }, "verification"));
  if (summaryPath) await appendFile(summaryPath, summary(dryRun, committed, verification));
  return { mode: "one-time-bounded-commit", verification };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await runBoundedRecomputeOnce();
  } catch (error) {
    console.error(`Bounded one-time route stopped safely: ${error instanceof Error ? error.message : "unknown-error"}`);
    process.exitCode = 1;
  }
}
