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
} from "../scripts/run-explicit-sku-catch-up.mjs";
import { parseExplicitSKUCSV } from "../src/explicit-sku-catch-up.mjs";

const rootFile = path => new URL(`../${path}`, import.meta.url);

test("runner is isolated to explicit SKUs and the fixed checksummed CSV", async () => {
  const workflow = await readFile(rootFile(".github/workflows/import-explicit-skus.yml"), "utf8");
  const runner = await readFile(rootFile("scripts/run-explicit-sku-catch-up.mjs"), "utf8");
  assert.equal(TRUSTED_CSV_PATH, "data/hoogvliet-missing-production-2026-10-06.csv");
  assert.equal(TRUSTED_CSV_SHA256, "a24da369b15d4ddf0d8741f7aeb4d3fee2f733e74e2d448ec1ffcd1b8ab30246");
  assert.equal(TRUSTED_CSV_SKU_COUNT, 812);
  const csvBytes = await readFile(rootFile(TRUSTED_CSV_PATH));
  assert.equal(createHash("sha256").update(csvBytes).digest("hex"), TRUSTED_CSV_SHA256);
  const parsed = parseExplicitSKUCSV(csvBytes.toString("utf8"), { maxBatchSize: 400 });
  assert.equal(parsed.inputRows, 812);
  assert.equal(parsed.uniqueSKUs, 812);
  assert.equal(parsed.candidates.length, 812);
  assert.equal(parsed.invalidRows.length, 0);
  assert.equal(parsed.duplicateRows.length, 0);
  assert.equal(parsed.candidates[0].sku, "000685000");
  assert.match(runner, /npm run import:skus/);
  assert.doesNotMatch(runner, /import:daily|catalog:root|catalog-growth|collectProducts|findCandidates/);
  assert.match(workflow, /pull_request:/);
  assert.doesNotMatch(workflow, /^\s*(schedule|push):/m);
});

test("missing dispatch mode defaults to read-only dry-run", () => {
  assert.deepEqual(resolveRunnerConfig({
    RUNNER_EVENT_NAME: "workflow_dispatch",
    RUNNER_REF: "refs/heads/main",
    RUNNER_MODE: "",
    RUNNER_MAX: "",
  }), { event: "workflow_dispatch", ref: "refs/heads/main", mode: "dry-run", max: 10 });
  assert.equal(needsProductionPrecheck("dry-run"), false);
  assert.deepEqual(buildImporterArgs({ mode: "dry-run", max: 10 }), [
    "run", "import:skus", "--", "--file", TRUSTED_CSV_PATH, "--max", "10", "--dry-run",
  ]);
});

test("write requires workflow_dispatch, main ref, and explicit write intent", () => {
  assert.deepEqual(resolveRunnerConfig({
    RUNNER_EVENT_NAME: "workflow_dispatch", RUNNER_REF: "refs/heads/main",
    RUNNER_MODE: "write", RUNNER_MAX: "400",
  }), { event: "workflow_dispatch", ref: "refs/heads/main", mode: "write", max: 400 });
  assert.throws(() => resolveRunnerConfig({
    RUNNER_EVENT_NAME: "pull_request", RUNNER_REF: "refs/pull/55/merge",
    RUNNER_MODE: "write", RUNNER_MAX: "10",
  }), /pull_request/);
  assert.throws(() => resolveRunnerConfig({
    RUNNER_EVENT_NAME: "workflow_dispatch", RUNNER_REF: "refs/heads/feature",
    RUNNER_MODE: "write", RUNNER_MAX: "10",
  }), /main/);
  assert.equal(buildImporterArgs({ mode: "write", max: 400 }).at(-1), "--write");
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

test("pull request proof is fixed to dry-run max=10; the normal daily workflow stays separate", async () => {
  assert.deepEqual(resolveRunnerConfig({
    RUNNER_EVENT_NAME: "pull_request", RUNNER_REF: "refs/pull/55/merge",
    RUNNER_MODE: "dry-run", RUNNER_MAX: "10",
  }), { event: "pull_request", ref: "refs/pull/55/merge", mode: "dry-run", max: 10 });
  assert.throws(() => resolveRunnerConfig({
    RUNNER_EVENT_NAME: "pull_request", RUNNER_REF: "refs/pull/55/merge",
    RUNNER_MODE: "dry-run", RUNNER_MAX: "11",
  }), /max=10/);
  const daily = await readFile(rootFile(".github/workflows/import-hoogvliet-poc.yml"), "utf8");
  assert.doesNotMatch(daily, /import-explicit-skus|run-explicit-sku-catch-up/);
});
