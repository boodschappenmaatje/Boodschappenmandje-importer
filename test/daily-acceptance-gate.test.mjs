import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { inspectAcceptanceSnapshot, verifyDailyAcceptance } from "../src/daily-acceptance-gate.mjs";
import { runDailyAcceptance } from "../src/daily-catalog-growth.mjs";
import { loadConfig } from "../src/config.mjs";

function snapshot(n) {
  return {
    products: Array.from({ length: n }, (_, i) => ({ id: `id-${i}`, sku: String(100000000 + i),
      supermarket: "Hoogvliet", name: `Product ${i}`, source_url: `https://www.hoogvliet.com/product/p-${i}`,
      created_at: "2026-10-01T07:00:00Z" })),
    prices: Array.from({ length: n }, (_, i) => ({ product_id: `id-${i}`, price: 1.99, fetched_at: "2026-10-01T07:00:00Z" })),
    maintenance: { status: "confirmed", pendingProductIds: [], failures: [], notifiedProducts: 304 + n },
  };
}
const job = { id: "job", jobDate: "2026-10-01", targetNewProducts: 400, newProductsCollected: 0 };
const result = { actualGrowth: 100, accounting: { balanced: true }, errorCount: 0, searchErrors: 0 };
function verify(after = snapshot(100), overrides = {}) {
  return verifyDailyAcceptance({ before: snapshot(0), after, job, result, limit: 100, ...overrides });
}

test("100 exact bevestigde nieuwe producten, prijzen en acknowledgements laten 300 over", () => {
  assert.deepEqual(verify(), { before: { products: 0, prices: 0, today: 0, notified: 304 },
    after: { products: 100, prices: 100, today: 100, notified: 404 }, confirmedNew: 100,
    confirmedPrices: 100, pending: 0, acknowledgements: 100, remaining: 300 });
});

for (const [name, mutate] of [
  ["duplicate_sku", s => { s.products[1].sku = s.products[0].sku; }],
  ["duplicate_product_id", s => { s.products[1].id = s.products[0].id; }],
  ["duplicate_price", s => { s.prices.push(s.prices[0]); }],
  ["orphan_price", s => { s.prices[0].product_id = "orphan"; }],
  ["invalid_price", s => { s.prices[0].price = 0; }],
  ["product_without_price", s => { s.prices.pop(); }],
  ["new_product_identity", s => { s.products[0].source_url = "https://other.example/product/p"; }],
  ["maintenance_unconfirmed", s => { s.maintenance.pendingProductIds.push("id-0"); }],
  ["acknowledgement_mismatch", s => { s.maintenance.notifiedProducts--; }],
]) test(`gate stopt op ${name}`, () => {
  const after = snapshot(100); mutate(after);
  assert.throws(() => verify(after), { code: `acceptance_${name}` });
});

test("bestaande SKU, gewijzigde bestaande prijs, onjuiste dagstand en bronfout worden geweigerd", () => {
  const before = snapshot(1); const after = snapshot(101);
  assert.throws(() => verify(after, { before }), /day_accounting_before/);
  after.prices[0].price = 2;
  assert.throws(() => verify(after, { before, job: { ...job, newProductsCollected: 1 } }), /unexpected_existing_price_write/);
  assert.throws(() => verify(snapshot(100), { result: { ...result, searchErrors: 1 } }), /import_errors/);
  assert.throws(() => verify(snapshot(100), { result: { ...result, accounting: { balanced: false } } }), /unbalanced_discovery/);
  assert.throws(() => verify(snapshot(101), { result: { ...result, actualGrowth: 101 } }), /invalid_growth_count/);
  assert.equal(inspectAcceptanceSnapshot(snapshot(100), "2026-10-02").today, 0);
});

function harness({ first = 100, initial = 0, badMaintenance = false, denied = false } = {}) {
  let n = initial; let stage = 0;
  const state = { ...job, newProductsCollected: initial, remainingTarget: 400 - initial, attemptCount: 0, status: "pending" };
  const limits = []; const finishes = [];
  return { state, limits, finishes, dependencies: {
    now: () => new Date("2026-10-01T08:00:00Z"),
    hasProductTypeColumn: async () => true,
      fetchAttempts: async () => [],
    claim: async (_c, input) => {
      assert.equal(input.targetNewProducts, 400);
      if (denied) return { claimed: false, reason: "attempt_running", job: state };
      state.attemptCount++; state.status = "running";
      return { claimed: true, attemptId: `a${state.attemptCount}`, lockToken: "lock", job: { ...state } };
    },
    acceptanceSnapshot: async () => {
      const s = snapshot(n);
      if (badMaintenance && stage) s.maintenance.pendingProductIds.push("pending");
      return s;
    },
    runGrowth: async c => {
      limits.push(c.maxNewProducts);
      const added = stage++ === 0 ? first : c.maxNewProducts;
      n += added;
      return { ...result, actualGrowth: added, accounting: { rawPageHits: added, categories: { inserted: added }, balanced: true, uniqueRelevantSKUs: added },
        sourceExhausted: added < c.maxNewProducts, stopReason: added < c.maxNewProducts ? "discovery_exhausted" : "growth_target_reached" };
    },
    finish: async (_c, input) => {
      finishes.push(input); state.newProductsCollected += input.counts.new;
      state.remainingTarget = 400 - state.newProductsCollected;
      state.status = state.remainingTarget === 0 ? "target_reached" : input.outcome === "non_retryable_failure"
        ? "failed_requires_attention" : input.outcome === "daily_target_partial" ? "daily_target_partial" : "retry_scheduled";
      state.nextRetryAt = input.nextRetryAt;
      return { ...state };
    },
  } };
}
const config = { dailyAcceptanceGate: true, dailySingleAttempt: true, dailyTargetNewProducts: 400,
  dailyEndHour: 23, maxProducts: 400, growthMaxRuntimeMs: 105 * 60_000 };
const logger = { info() {}, error() {} };

test("echte daily claim/accounting: A100 gecontroleerd/persistent, daarna B300 op dezelfde dagjob", async () => {
  const h = harness(); const r = await runDailyAcceptance(config, logger, h.dependencies);
  assert.deepEqual(h.limits, [100, 300]);
  assert.equal(r.phaseA.job.newProductsCollected, 100);
  assert.equal(r.phaseA.job.remainingTarget, 300);
  assert.equal(r.phaseB.job.id, r.phaseA.job.id);
  assert.equal(r.phaseB.job.newProductsCollected, 400);
  assert.equal(r.phaseB.job.status, "target_reached");
  assert.deepEqual(h.finishes.map(f => f.counts.new), [100, 300]);
});
test("eerdere producten van vandaag worden behouden: 25 + 100 + 275", async () => {
  const h = harness({ initial: 25 }); await runDailyAcceptance(config, logger, h.dependencies);
  assert.deepEqual(h.limits, [100, 275]); assert.equal(h.state.newProductsCollected, 400);
});
test("59 echte producten zijn geen geslaagde gate en starten nooit B of retry", async () => {
  const h = harness({ first: 59 }); const r = await runDailyAcceptance(config, logger, h.dependencies);
  assert.equal(r.phaseB, null); assert.deepEqual(h.limits, [100]);
  assert.equal(h.state.newProductsCollected, 59); assert.equal(h.state.status, "daily_target_partial");
  assert.equal(h.state.nextRetryAt, null);
});
test("maintenancefout bewaart 100 confirmed inserts, maar blokkeert B", async () => {
  const h = harness({ badMaintenance: true });
  await assert.rejects(runDailyAcceptance(config, logger, h.dependencies), /maintenance_unconfirmed/);
  assert.deepEqual(h.limits, [100]); assert.equal(h.state.newProductsCollected, 100);
  assert.equal(h.state.status, "failed_requires_attention");
});
test("actieve claim start geen enkele growth", async () => {
  const h = harness({ denied: true }); const r = await runDailyAcceptance(config, logger, h.dependencies);
  assert.equal(r.phaseB, null); assert.deepEqual(h.limits, []);
});
test("acceptance is expliciet, geen alternatief laag dagdoel of willekeurige cap", async () => {
  assert.throws(() => loadConfig({ DAILY_ACCEPTANCE_GATE: "99" }), /100/);
  assert.throws(() => loadConfig({ DAILY_ACCEPTANCE_GATE: "100" }), /dagdoel 400/);
  assert.throws(() => loadConfig({ DAILY_ACCEPTANCE_GATE: "100", DAILY_SINGLE_ATTEMPT: "1", DAILY_NEW_PRODUCT_TARGET: "100", UPDATE_MODE: "growth" }), /dagdoel 400/);
  const yaml = await readFile(new URL("../.github/workflows/import-hoogvliet-poc.yml", import.meta.url), "utf8");
  assert.match(yaml, /- "100"/);
  assert.match(yaml, /100 vereist daily_attempt_only/);
  assert.match(yaml, /DAILY_ACCEPTANCE_GATE=100/);
  assert.match(yaml, /max_products="400"/);
  assert.match(yaml, /group: hoogvliet-supabase-update\n  cancel-in-progress: false/);
});
