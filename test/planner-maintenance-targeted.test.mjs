import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  PRODUCTION_PLANNER_ORIGIN,
  TARGET_CONFIRMATION,
  TARGET_COUNT,
  TARGET_CSV,
  TARGET_SOURCE,
  parseTargetSKUs,
  runTargetedPlannerMaintenance,
  validateRunnerConfig,
} from "../scripts/run-targeted-planner-maintenance.mjs";

const workflow = readFileSync(new URL("../.github/workflows/planner-maintenance-targeted.yml", import.meta.url), "utf8")
  .replace(/\r\n/g, "\n");
const script = readFileSync(new URL("../scripts/run-targeted-planner-maintenance.mjs", import.meta.url), "utf8");
const finalSKUs = parseTargetSKUs(readFileSync(TARGET_CSV, "utf8"));
const IDs = finalSKUs.map((_, index) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const baseEnv = {
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REPOSITORY: "boodschappenmaatje/Boodschappenmandje-importer",
  GITHUB_REF: "refs/heads/main",
  TARGETED_SOURCE: TARGET_SOURCE,
  TARGETED_CONFIRM: TARGET_CONFIRMATION,
  SUPABASE_URL: "https://pjcqxufvbkkjehituzxz.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_fixture_not_real",
  SUPABASE_DB_PASSWORD: "db-password-fixture-not-real",
  PLANNER_CACHE_BASE_URL: PRODUCTION_PLANNER_ORIGIN,
  PLANNER_CACHE_ADMIN_TOKEN: "planner-admin-fixture-not-real",
  VERCEL_AUTOMATION_BYPASS_SECRET: "vercel-bypass-fixture-not-real",
};

const response = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), {
  status, headers: { "content-type": "application/json", ...headers },
});
function fixture(options = {}) {
  const products = finalSKUs.slice(0, options.productCount ?? TARGET_COUNT).map((sku, index) => ({
    id: IDs[index], sku, supermarket: "Hoogvliet",
  }));
  const prices = products.map(product => ({ product_id: product.id, price: 1.23 }));
  const calls = [];
  const fetchImpl = async (url, request) => {
    const parsed = new URL(url);
    calls.push({ url: String(url), request });
    if (parsed.origin === PRODUCTION_PLANNER_ORIGIN) {
      if (request.method !== "POST") return response({ error: "wrong-method" }, 405);
      return response(options.endpointBody ?? {
        productCount: TARGET_COUNT, changedMatchKeys: [], affectedRecipeIds: [], refreshedReadinessCount: 0,
      }, options.endpointStatus ?? 200);
    }
    const table = parsed.pathname.split("/").at(-1);
    if (table === "products") return response(products);
    if (table === "product_prices") return response(prices);
    if (table === "catalog_daily_jobs") return response(options.jobs ?? []);
    if (table === "catalog_daily_attempts") return response(options.attempts ?? []);
    if (table === "catalog_import_runs") return response(options.imports ?? []);
    if (table === "ingredient_product_matches" || table === "recipe_readiness_cache") return response([]);
    throw new Error(`unexpected fixture URL ${parsed.pathname}`);
  };
  const execFileImpl = async () => ({ stdout: "0\n", stderr: "" });
  return { calls, fetchImpl, execFileImpl };
}

async function run(options = {}) {
  const harness = fixture(options);
  const result = await runTargetedPlannerMaintenance({ ...baseEnv, ...options.env }, harness);
  return { result, ...harness };
}

test("workflow is manual-only, final_batch3-only, and requires exact confirmation", () => {
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+(schedule|push|pull_request):/m);
  assert.match(workflow, /source:[\s\S]*?type: choice[\s\S]*?options:\n\s+- final_batch3/);
  assert.match(workflow, /confirm:[\s\S]*?required: true/);
  assert.match(workflow, /TARGETED_CONFIRM: \$\{\{ inputs\.confirm \}\}/);
  assert.match(workflow, /TARGETED_SOURCE: \$\{\{ inputs\.source \}\}/);
  assert.equal(validateRunnerConfig(baseEnv).plannerURL.href,
    `${PRODUCTION_PLANNER_ORIGIN}/api/internal/planner-readiness/new-products`);
  assert.throws(() => validateRunnerConfig({ ...baseEnv, TARGETED_CONFIRM: "" }), /bevestiging/);
});

test("fixed source contains exactly 12 SKUs and excludes 727643000", () => {
  assert.equal(finalSKUs.length, TARGET_COUNT);
  assert.equal(new Set(finalSKUs).size, TARGET_COUNT);
  assert.equal(finalSKUs.includes("727643000"), false);
  assert.equal(TARGET_SOURCE, "final_batch3");
  assert.match(script, /data\/hoogvliet-missing-production-2026-10-08-final\.csv/);
});

test("successful run resolves exact IDs, sends exactly one POST, and only reads Supabase", async () => {
  const { result, calls } = await run();
  assert.equal(result.status, "confirmed");
  assert.equal(result.requestedProducts, TARGET_COUNT);
  const plannerCalls = calls.filter(call => new URL(call.url).origin === PRODUCTION_PLANNER_ORIGIN);
  assert.equal(plannerCalls.length, 1);
  assert.deepEqual(JSON.parse(plannerCalls[0].request.body).productIds, IDs);
  assert.equal(plannerCalls[0].request.headers.authorization, `Bearer ${baseEnv.PLANNER_CACHE_ADMIN_TOKEN}`);
  assert.equal(plannerCalls[0].request.headers["x-vercel-protection-bypass"], baseEnv.VERCEL_AUTOMATION_BYPASS_SECRET);
  assert.ok(calls.filter(call => new URL(call.url).origin !== PRODUCTION_PLANNER_ORIGIN)
    .every(call => call.request.method === "GET"));
});

test("eleven resolved UUIDs fail closed before any POST", async () => {
  const harness = fixture({ productCount: 11 });
  await assert.rejects(runTargetedPlannerMaintenance(baseEnv, harness), /exact 12 unieke final product-ID's/);
  assert.equal(harness.calls.filter(call => new URL(call.url).origin === PRODUCTION_PLANNER_ORIGIN).length, 0);
});

test("active importer activity fails closed before any POST", async () => {
  const harness = fixture({ jobs: [{ id: "running", status: "running", lock_token: "lock", lock_expires_at: "2099-01-01T00:00:00Z" }] });
  await assert.rejects(runTargetedPlannerMaintenance(baseEnv, harness), /Concurrente Production-activiteit/);
  assert.equal(harness.calls.filter(call => new URL(call.url).origin === PRODUCTION_PLANNER_ORIGIN).length, 0);
});

test("any granted advisory lock fails closed before any POST", async () => {
  const harness = fixture();
  harness.execFileImpl = async () => ({ stdout: "1\n", stderr: "" });
  await assert.rejects(runTargetedPlannerMaintenance(baseEnv, harness), /Concurrente Production-activiteit/);
  assert.equal(harness.calls.filter(call => new URL(call.url).origin === PRODUCTION_PLANNER_ORIGIN).length, 0);
});

test("old retry_scheduled rows do not block, but a current due retry does", async () => {
  const old = fixture({ jobs: [{ status: "retry_scheduled", job_date: "2026-10-06", next_retry_at: "2026-10-06T08:00:00Z" }] });
  await runTargetedPlannerMaintenance(baseEnv, { ...old, now: new Date("2026-10-08T10:00:00Z") });
  const due = fixture({ jobs: [{ status: "retry_scheduled", job_date: "2026-10-08", next_retry_at: "2026-10-07T08:00:00Z" }] });
  await assert.rejects(runTargetedPlannerMaintenance(baseEnv, { ...due, now: new Date("2026-10-08T10:00:00Z") }), /Concurrente Production-activiteit/);
  assert.equal(due.calls.filter(call => new URL(call.url).origin === PRODUCTION_PLANNER_ORIGIN).length, 0);
});

test("missing required secrets/config fails before network access", async () => {
  for (const key of ["SUPABASE_SECRET_KEY", "SUPABASE_DB_PASSWORD", "PLANNER_CACHE_ADMIN_TOKEN", "VERCEL_AUTOMATION_BYPASS_SECRET"]) {
    const harness = fixture();
    await assert.rejects(runTargetedPlannerMaintenance({ ...baseEnv, [key]: "" }));
    assert.equal(harness.calls.length, 0);
  }
});

test("non-2xx endpoint response fails once without retry", async () => {
  const harness = fixture({ endpointStatus: 503, endpointBody: { error: "cache-unavailable" } });
  await assert.rejects(runTargetedPlannerMaintenance(baseEnv, harness), /HTTP 503/);
  assert.equal(harness.calls.filter(call => new URL(call.url).origin === PRODUCTION_PLANNER_ORIGIN).length, 1);
});

test("malformed acknowledgement fails after exactly one POST", async () => {
  const harness = fixture({ endpointBody: { productCount: 12, changedMatchKeys: [] } });
  await assert.rejects(runTargetedPlannerMaintenance(baseEnv, harness), /response voldoet/);
  assert.equal(harness.calls.filter(call => new URL(call.url).origin === PRODUCTION_PLANNER_ORIGIN).length, 1);
});

test("unexpected full-rebuild or recipe scope is rejected", async () => {
  for (const endpointBody of [
    { productCount: 12, changedMatchKeys: [], affectedRecipeIds: [], refreshedReadinessCount: 0, fullRebuild: true },
    { productCount: 12, changedMatchKeys: [], affectedRecipeIds: ["unexpected"], refreshedReadinessCount: 0 },
  ]) {
    const harness = fixture({ endpointBody });
    await assert.rejects(runTargetedPlannerMaintenance(baseEnv, harness), /response voldoet|recipe-ID's/);
    assert.equal(harness.calls.filter(call => new URL(call.url).origin === PRODUCTION_PLANNER_ORIGIN).length, 1);
  }
});

test("runner cannot start importer, discovery, price refresh, or product/price writes", () => {
  assert.doesNotMatch(workflow, /npm (run|exec)|import:daily|import:skus|catalog-discovery|price-refresh/);
  assert.doesNotMatch(script, /upsertProducts|startCatalogImportRun|import:daily|import:skus|catalog discovery/);
  assert.doesNotMatch(script, /method:\s*["'](?:POST|PATCH|PUT|DELETE)["'][\s\S]{0,300}(?:products|product_prices)/);
  assert.doesNotMatch(script, /\b(?:INSERT|UPDATE|DELETE|TRUNCATE|DROP)\b/);
});

test("secrets are only sent as headers and never appear in safe output", async () => {
  const output = [];
  const previous = console.log;
  console.log = value => output.push(String(value));
  try {
    const { result } = await run();
    assert.equal(result.status, "confirmed");
  } finally {
    console.log = previous;
  }
  for (const secret of [baseEnv.SUPABASE_SECRET_KEY, baseEnv.SUPABASE_DB_PASSWORD,
    baseEnv.PLANNER_CACHE_ADMIN_TOKEN, baseEnv.VERCEL_AUTOMATION_BYPASS_SECRET]) {
    assert.equal(output.join("\n").includes(secret), false);
  }
});
// End of targeted maintenance regression coverage.
// EOF
