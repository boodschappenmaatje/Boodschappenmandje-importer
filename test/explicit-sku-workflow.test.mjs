import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildImporterArgs,
  needsProductionPrecheck,
  precheckProductionImportState,
  resolveRunnerConfig,
  TRUSTED_CSV_PATH,
  TRUSTED_CSV_SHA256,
  TRUSTED_CSV_SKU_COUNT,
  TRUSTED_CSVS,
} from "../scripts/run-explicit-sku-catch-up.mjs";
import { parseExplicitSKUCSV } from "../src/explicit-sku-catch-up.mjs";

const rootFile = path => new URL(`../${path}`, import.meta.url);

test("runner is isolated to allowlisted explicit-SKU CSVs with checksums", async () => {
  const workflow = await readFile(rootFile(".github/workflows/import-explicit-skus.yml"), "utf8");
  const runner = await readFile(rootFile("scripts/run-explicit-sku-catch-up.mjs"), "utf8");
  assert.equal(TRUSTED_CSV_PATH, "data/hoogvliet-missing-production-2026-10-06.csv");
  assert.equal(TRUSTED_CSV_SHA256, "a24da369b15d4ddf0d8741f7aeb4d3fee2f733e74e2d448ec1ffcd1b8ab30246");
  assert.equal(TRUSTED_CSV_SKU_COUNT, 812);
  assert.equal(TRUSTED_CSVS.residual_batch2.path, "data/hoogvliet-missing-production-2026-10-08-residual.csv");
  assert.equal(TRUSTED_CSVS.residual_batch2.sha256, "dd785a974054c257d7c4d2bc6248204ab8fe8e971bd865c16a2c2785b3e57254");
  assert.equal(TRUSTED_CSVS.residual_batch2.skuCount, 412);
  assert.equal(TRUSTED_CSVS.final_batch3.path, "data/hoogvliet-missing-production-2026-10-08-final.csv");
  assert.equal(TRUSTED_CSVS.final_batch3.sha256, "d5c43b501d4dfbf2498d1765340b354b4b487d47806c0b8683dcfcb748025dd5");
  assert.equal(TRUSTED_CSVS.final_batch3.skuCount, 12);

  const csvBytes = await readFile(rootFile(TRUSTED_CSV_PATH));
  assert.equal(createHash("sha256").update(csvBytes).digest("hex"), TRUSTED_CSV_SHA256);
  const parsed = parseExplicitSKUCSV(csvBytes.toString("utf8"), { maxBatchSize: 400 });
  assert.equal(parsed.inputRows, 812);
  assert.equal(parsed.uniqueSKUs, 812);
  assert.equal(parsed.candidates.length, 812);
  assert.equal(parsed.invalidRows.length, 0);
  assert.equal(parsed.duplicateRows.length, 0);
  assert.equal(parsed.candidates[0].sku, "000685000");

  const residualBytes = await readFile(rootFile(TRUSTED_CSVS.residual_batch2.path));
  assert.equal(createHash("sha256").update(residualBytes).digest("hex"), TRUSTED_CSVS.residual_batch2.sha256);
  const residual = parseExplicitSKUCSV(residualBytes.toString("utf8"), { maxBatchSize: 400 });
  const originalSKUs = parsed.candidates.map(candidate => candidate.sku);
  const residualSKUs = residual.candidates.map(candidate => candidate.sku);
  assert.equal(residual.inputRows, 412);
  assert.equal(residual.uniqueSKUs, 412);
  assert.equal(residual.invalidRows.length, 0);
  assert.equal(residual.duplicateRows.length, 0);
  assert.deepEqual(residualSKUs, originalSKUs.slice(400));
  assert.equal(residualSKUs.some(sku => originalSKUs.slice(0, 400).includes(sku)), false);
  const finalBytes = await readFile(rootFile(TRUSTED_CSVS.final_batch3.path));
  assert.equal(createHash("sha256").update(finalBytes).digest("hex"), TRUSTED_CSVS.final_batch3.sha256);
  const final = parseExplicitSKUCSV(finalBytes.toString("utf8"), { maxBatchSize: 400 });
  assert.deepEqual(final.candidates.map(candidate => candidate.sku), [
    "733574000", "733575000", "733741000", "770787000", "770809000", "777641000",
    "905631000", "921742000", "926108000", "926876000", "927082000", "927120000",
  ]);
  assert.equal(final.inputRows, 12);
  assert.equal(final.uniqueSKUs, 12);
  assert.equal(final.invalidRows.length, 0);
  assert.equal(final.duplicateRows.length, 0);
  assert.equal(final.candidates.some(candidate => candidate.sku === "727643000"), false);
  assert.match(workflow, /residual_batch2/);
  assert.match(workflow, /final_batch3/);
  assert.match(runner, /npm run import:skus/);
  assert.doesNotMatch(runner, /import:daily|catalog:root|catalog-growth|collectProducts|findCandidates/);
  assert.match(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /^\s*(schedule|push):/m);
  assert.match(workflow, /PLANNER_CACHE_BASE_URL:\s+https:\/\/boodschappenmaatje-pwa\.vercel\.app/);
  assert.match(workflow, /PLANNER_CACHE_ADMIN_TOKEN:\s+\$\{\{ secrets\.PLANNER_CACHE_ADMIN_TOKEN \}\}/);
  assert.match(workflow, /VERCEL_AUTOMATION_BYPASS_SECRET:\s+\$\{\{ secrets\.VERCEL_AUTOMATION_BYPASS_SECRET \}\}/);
  assert.match(workflow, /command -v google-chrome/);
  assert.match(workflow, /CHROME_PATH=\$chrome_path/);
  assert.doesNotMatch(workflow, /playwright install|apt-get|with-deps/);
  assert.match(await readFile(rootFile("src/explicit-sku-catch-up.mjs"), "utf8"), /chromiumLaunchOptions\(config\)/);
});

test("missing dispatch mode defaults to read-only dry-run", () => {
  assert.deepEqual(resolveRunnerConfig({
    RUNNER_EVENT_NAME: "workflow_dispatch",
    RUNNER_REF: "refs/heads/main",
    RUNNER_MODE: "",
    RUNNER_MAX: "",
  }), { event: "workflow_dispatch", ref: "refs/heads/main", mode: "dry-run", max: 10, source: "original" });
  assert.equal(needsProductionPrecheck("dry-run"), false);
  assert.deepEqual(buildImporterArgs({ mode: "dry-run", max: 10 }), [
    "run", "import:skus", "--", "--file", TRUSTED_CSV_PATH, "--max", "10", "--dry-run",
  ]);
});

test("write requires workflow_dispatch, main ref, and explicit write intent", () => {
  assert.deepEqual(resolveRunnerConfig({
    RUNNER_EVENT_NAME: "workflow_dispatch", RUNNER_REF: "refs/heads/main",
    RUNNER_MODE: "write", RUNNER_MAX: "400",
  }), { event: "workflow_dispatch", ref: "refs/heads/main", mode: "write", max: 400, source: "original" });
  assert.throws(() => resolveRunnerConfig({
    RUNNER_EVENT_NAME: "pull_request", RUNNER_REF: "refs/pull/55/merge",
    RUNNER_MODE: "write", RUNNER_MAX: "10",
  }), /pull_request/);
  assert.throws(() => resolveRunnerConfig({
    RUNNER_EVENT_NAME: "workflow_dispatch", RUNNER_REF: "refs/heads/feature",
    RUNNER_MODE: "write", RUNNER_MAX: "10",
  }), /main/);
  assert.equal(buildImporterArgs({ mode: "write", max: 400 }).at(-1), "--write");
  assert.deepEqual(buildImporterArgs({ mode: "dry-run", max: 10, source: "residual_batch2" }), [
    "run", "import:skus", "--", "--file", TRUSTED_CSVS.residual_batch2.path, "--max", "10", "--dry-run",
  ]);
  assert.throws(() => buildImporterArgs({ mode: "dry-run", max: 10, source: "../arbitrary.csv" }), /vaste vertrouwde CSV-keuze/);
  assert.equal(needsProductionPrecheck("write"), true);
});

test("batch maximum accepts 400 and rejects values above it", () => {
  assert.equal(resolveRunnerConfig({
    RUNNER_EVENT_NAME: "workflow_dispatch", RUNNER_REF: "refs/heads/main",
    RUNNER_MODE: "dry-run", RUNNER_MAX: "400",
  }).max, 400);
  assert.throws(() => resolveRunnerConfig({
    RUNNER_EVENT_NAME: "workflow_dispatch", RUNNER_REF: "refs/heads/main",
    RUNNER_MODE: "dry-run", RUNNER_MAX: "401",
  }), /1 en 400/);
  assert.throws(() => resolveRunnerConfig({
    RUNNER_EVENT_NAME: "workflow_dispatch", RUNNER_REF: "refs/heads/main",
    RUNNER_MODE: "dry-run", RUNNER_MAX: "1.5",
  }), /geheel getal/);
});

test("read-only precheck uses GET and refuses any active importer", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), method: options.method, headers: options.headers });
    const table = new URL(url).pathname.split("/").at(-1);
    return { ok: true, status: 200, json: async () => table === "catalog_import_runs" ? [{ id: "busy" }] : [] };
  };
  await assert.rejects(precheckProductionImportState({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "never-log-this",
  }, { fetchImpl }), /active_catalog_import_runs=1/);
  assert.equal(calls.length, 4);
  assert.ok(calls.every(call => call.method === "GET"));
  assert.ok(calls.every(call => !call.url.includes("never-log-this")));
});

test("idle read-only precheck passes and exposes no credentials", async () => {
  const calls = [];
  const state = await precheckProductionImportState({
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SECRET_KEY: "never-log-this",
  }, {
    now: Date.parse("2026-10-08T05:00:00Z"),
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), method: options.method });
      return { ok: true, status: 200, json: async () => [] };
    },
  });
  assert.deepEqual(state, {
    running_daily_jobs: 0, running_attempts: 0,
    active_catalog_import_runs: 0, active_locks: 0,
  });
  assert.ok(calls.every(call => call.method === "GET"));
});

test("pull request proof is fixed to final_batch3 dry-run max=12; the normal daily workflow stays separate", async () => {
  assert.deepEqual(resolveRunnerConfig({
    RUNNER_EVENT_NAME: "pull_request", RUNNER_REF: "refs/pull/55/merge",
    RUNNER_MODE: "dry-run", RUNNER_MAX: "12", RUNNER_SOURCE: "final_batch3",
  }), { event: "pull_request", ref: "refs/pull/55/merge", mode: "dry-run", max: 12, source: "final_batch3" });
  assert.throws(() => resolveRunnerConfig({
    RUNNER_EVENT_NAME: "pull_request", RUNNER_REF: "refs/pull/55/merge",
    RUNNER_MODE: "dry-run", RUNNER_MAX: "11", RUNNER_SOURCE: "final_batch3",
  }), /max=12/);
  assert.throws(() => resolveRunnerConfig({
    RUNNER_EVENT_NAME: "pull_request", RUNNER_REF: "refs/pull/55/merge",
    RUNNER_MODE: "dry-run", RUNNER_MAX: "12", RUNNER_SOURCE: "residual_batch2",
  }), /final_batch3/);
  assert.throws(() => resolveRunnerConfig({
    RUNNER_EVENT_NAME: "workflow_dispatch", RUNNER_REF: "refs/heads/main",
    RUNNER_MODE: "dry-run", RUNNER_MAX: "10", RUNNER_SOURCE: "../path.csv",
  }), /vaste vertrouwde CSV-keuze/);
  const daily = await readFile(rootFile(".github/workflows/import-hoogvliet-poc.yml"), "utf8");
  assert.doesNotMatch(daily, /import-explicit-skus|run-explicit-sku-catch-up/);
});
