import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  parseExplicitSKUCSV,
  runExplicitSKUImport,
} from "../src/explicit-sku-catch-up.mjs";

const config = (overrides = {}) => ({
  headless: true,
  navigationRetries: 0,
  growthMaxRuntimeMs: 60_000,
  catchUpMax: 400,
  catchUpWrite: false,
  ...overrides,
});
const silentLogger = { info() {}, error() {} };

function input(rows, maxBatchSize = 400) {
  return parseExplicitSKUCSV(`SKU,product_url\n${rows.join("\n")}\n`, { maxBatchSize });
}

function services({ existing = [], validate = async () => product(), write = async (_config, products) => ({
  imported: products.map((item) => ({ sku: item.sku, inserted: true })), errors: [],
}), running = [], onStart = () => {}, onFinish = () => {} } = {}) {
  let stored = [...existing];
  return {
    fetchExistingProducts: async () => [...stored],
    fetchExistingPriceStates: async () => new Map(stored.map((item) => [item.id ?? item.sku, { price: 1 }])),
    fetchRunningCatalogDailyJobs: async () => running,
    startCatalogImportRun: async (_config, details) => { onStart(details); return { id: "run-1", started_at: new Date().toISOString() }; },
    finishCatalogImportRun: async (_config, _run, result) => { onFinish(result); return result; },
    validateCandidate: validate,
    upsertProducts: async (writeConfig, products) => {
      const result = await write(writeConfig, products);
      for (const item of result.imported ?? []) if (item.inserted) stored.push(products.find((p) => p.sku === item.sku));
      return result;
    },
  };
}

function product(sku = "000016000", price = 2.19) {
  return {
    supermarket: "Hoogvliet", sku, name: "Testproduct", packageText: "1 stuk",
    sourceURL: `https://hoogvliet.nl/product/test-${sku}`, price, fetchedAt: new Date().toISOString(),
  };
}

test("expliciete lijst verwerkt geen catalogusdiscovery", async () => {
  const source = await readFile(new URL("../src/explicit-sku-catch-up.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /collectProducts|findCandidates|catalog:root/);
  let validated = 0;
  const result = await runExplicitSKUImport(config(), input(["000016000,https://hoogvliet.nl/product/test-000016000"]), silentLogger, {
    services: services({ validate: async () => { validated += 1; return product(); } }),
  });
  assert.equal(validated, 1);
  assert.equal(result.requested, 1);
  assert.equal(result.imported, 0);
  assert.equal(result.valid_product_price, 1);
});

test("input 400 schrijft nooit meer dan 400 nieuwe producten", async () => {
  let writes = 0;
  const rows = Array.from({ length: 401 }, (_, index) => `${String(index).padStart(9, "0")},https://hoogvliet.nl/product/test-${String(index).padStart(9, "0")}`);
  const result = await runExplicitSKUImport(config({ catchUpWrite: true }), input(rows), silentLogger, {
    services: services({
      write: async (_config, products) => { writes += products.length; return { imported: products.map((item) => ({ sku: item.sku, inserted: true })), errors: [] }; },
    }),
  });
  assert.equal(result.requested, 400);
  assert.equal(writes, 400);
  assert.equal(result.imported, 400);
  assert.equal(result.skipped, 1);
});

test("duplicates worden eenmaal verwerkt en leading zero's blijven behouden", async () => {
  const seen = [];
  const parsed = input([
    "000016000,https://hoogvliet.nl/product/test-000016000",
    "000016000,https://hoogvliet.nl/product/test-000016000",
    "16000000,https://hoogvliet.nl/product/test-16000000",
  ]);
  assert.equal(parsed.candidates.length, 1);
  assert.equal(parsed.candidates[0].sku, "000016000");
  const result = await runExplicitSKUImport(config(), parsed, silentLogger, {
    services: services({ validate: async (candidate) => { seen.push(candidate.sku); return product(candidate.sku); } }),
  });
  assert.deepEqual(seen, ["000016000"]);
  assert.equal(result.skipped, 1);
  assert.equal(result.invalid, 1);
});

test("existing SKU wordt al bestaand gemeld zonder detail- of writepad", async () => {
  let validated = 0, written = 0;
  const sku = "000016000";
  const result = await runExplicitSKUImport(config({ catchUpWrite: true }), input([`${sku},https://hoogvliet.nl/product/test-${sku}`]), silentLogger, {
    services: services({
      existing: [{ id: "p1", sku }],
      validate: async () => { validated += 1; return product(sku); },
      write: async () => { written += 1; return { imported: [], errors: [] }; },
    }),
  });
  assert.equal(result.already_exists, 1);
  assert.equal(validated, 0);
  assert.equal(written, 0);
});

test("invalid price/product en detail-404 schrijven niets en volgende SKU gaat door", async () => {
  let writes = 0;
  const result = await runExplicitSKUImport(config({ catchUpWrite: true }), input([
    "000000001,https://hoogvliet.nl/product/test-000000001",
    "000000002,https://hoogvliet.nl/product/test-000000002",
    "000000003,https://hoogvliet.nl/product/test-000000003",
  ]), silentLogger, {
    services: services({
      validate: async (candidate, diagnostics) => {
        if (candidate.sku === "000000001") { diagnostics.reason = "invalidPrice"; return null; }
        if (candidate.sku === "000000002") { diagnostics.reason = "notFound"; return null; }
        return product(candidate.sku);
      },
      write: async (_config, products) => { writes += products.length; return { imported: products.map((item) => ({ sku: item.sku, inserted: true })), errors: [] }; },
    }),
  });
  assert.equal(result.invalid, 1);
  assert.equal(result.not_found, 1);
  assert.equal(result.imported, 1);
  assert.equal(writes, 1);
});

test("tijdelijke fout blijft per SKU en batch gaat door", async () => {
  const result = await runExplicitSKUImport(config(), input([
    "000000001,https://hoogvliet.nl/product/test-000000001",
    "000000002,https://hoogvliet.nl/product/test-000000002",
  ]), silentLogger, {
    services: services({ validate: async (candidate) => {
      if (candidate.sku === "000000001") throw Object.assign(new Error("timeout"), { code: "ETIMEDOUT" });
      return product(candidate.sku);
    } }),
  });
  assert.equal(result.temporary_error, 1);
  assert.equal(result.valid_product_price, 1);
});

test("actieve daily lock weigert catch-up write vóór catalogusrun", async () => {
  let started = 0;
  await assert.rejects(
    runExplicitSKUImport(config({ catchUpWrite: true }), input(["000000001,https://hoogvliet.nl/product/test-000000001"]), silentLogger, {
      services: services({
        running: [{ id: "daily-1", status: "running" }],
        onStart: () => { started += 1; },
      }),
    }),
    (error) => error.code === "daily_import_lock_active",
  );
  assert.equal(started, 0);
});

test("de bestaande gedeelde cataloguslock weigert een tweede catch-up", async () => {
  const locked = services();
  locked.startCatalogImportRun = async () => { throw Object.assign(new Error("unique running index"), { status: 409 }); };
  await assert.rejects(
    runExplicitSKUImport(config({ catchUpWrite: true }), input(["000000001,https://hoogvliet.nl/product/test-000000001"]), silentLogger, {
      services: locked,
    }),
    (error) => error.code === "catalog_import_lock_active",
  );
});

test("dry-run doet nul writes en rapporteert de nul-write countdelta", async () => {
  let writes = 0, starts = 0;
  const result = await runExplicitSKUImport(config(), input(["000000001,https://hoogvliet.nl/product/test-000000001"]), silentLogger, {
    services: services({
      onStart: () => { starts += 1; },
      write: async () => { writes += 1; return { imported: [], errors: [] }; },
    }),
  });
  assert.equal(result.mode, "dry_run");
  assert.equal(writes, 0);
  assert.equal(starts, 0);
  assert.equal(result.before_product_count, result.after_product_count);
  assert.equal(result.before_price_count, result.after_price_count);
});
