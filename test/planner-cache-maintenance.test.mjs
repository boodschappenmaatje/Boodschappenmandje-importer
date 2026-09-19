import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.mjs";
import { notifyPlannerOfNewProducts, plannerMaintenanceSettings } from "../src/planner-cache-maintenance.mjs";
import { upsertProducts } from "../src/supabase.mjs";

const config = {
  supabaseURL: "https://fixture.supabase.co", supabaseSecret: "fixture-supabase-secret",
  plannerCacheBaseURL: "https://preview.example", plannerCacheAdminToken: "fixture-admin-token",
};
const product = (sku = "730331000") => ({ supermarket: "Hoogvliet", sku,
  name: "Go vega Plantaardige falafel", packageText: "200 gram", price: 1.48,
  sourceURL: "https://www.hoogvliet.com/product/falafel", fetchedAt: "2026-09-19T20:00:00Z" });
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
const acknowledgement = (ids) => json({ productCount: ids.length, changedMatchKeys: [],
  affectedRecipeIds: [], refreshedReadinessCount: 0 });

test("maintenance configuration is explicit, HTTPS-only and loaded server-side", () => {
  assert.equal(plannerMaintenanceSettings({}), null);
  assert.throws(() => plannerMaintenanceSettings({ plannerCacheBaseURL: "https://preview.example" }));
  for (const url of ["http://preview.example", "https://user:secret@preview.example", "https://preview.example/?token=secret"]) {
    assert.throws(() => plannerMaintenanceSettings({ ...config, plannerCacheBaseURL: url }));
  }
  const loaded = loadConfig({ DRY_RUN: "1", PLANNER_CACHE_BASE_URL: config.plannerCacheBaseURL,
    PLANNER_CACHE_ADMIN_TOKEN: config.plannerCacheAdminToken });
  assert.equal(loaded.plannerCacheAdminToken, config.plannerCacheAdminToken);
});

test("a new insert notifies only after its confirmed price; repeated SKU never notifies again", async (t) => {
  const rows = new Map();
  const prices = new Map();
  const notifications = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    const body = JSON.parse(options.body);
    if (url.pathname.endsWith("new-products")) {
      assert.equal(options.headers.authorization, `Bearer ${config.plannerCacheAdminToken}`);
      assert.equal(options.headers.apikey, undefined);
      assert.ok(body.productIds.every((id) => prices.has(id)));
      notifications.push(body.productIds);
      return acknowledgement(body.productIds);
    }
    assert.equal(options.headers.authorization, undefined);
    if (url.pathname.endsWith("/products")) {
      const row = body[0];
      if (options.headers.Prefer.includes("ignore-duplicates") && rows.has(row.sku)) return json([]);
      const saved = { ...rows.get(row.sku), ...row };
      rows.set(row.sku, saved);
      return json([saved]);
    }
    const price = body[0];
    prices.set(price.product_id, price);
    return json([price]);
  });
  const first = await upsertProducts(config, [product(), product()]);
  assert.equal(first.imported.length, 1);
  assert.equal(first.duplicateSKUsSkipped, 1);
  assert.equal(first.plannerMaintenance.notifiedProducts, 1);
  await upsertProducts(config, [product()]);
  assert.equal(rows.size, 1);
  assert.equal(prices.size, 1);
  assert.equal(notifications.length, 1);
});

test("concurrent insert collision is an existing product, never a new-product notification", async (t) => {
  const requests = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    requests.push(url.pathname);
    const row = JSON.parse(options.body)[0];
    if (options.headers.Prefer.includes("ignore-duplicates")) return json([]);
    if (url.pathname.endsWith("/products")) {
      assert.equal(row.id, undefined);
      return json([{ ...row, id: "concurrent-product" }]);
    }
    return json([row]);
  });
  const result = await upsertProducts(config, [product()]);
  assert.equal(result.imported.length, 1);
  assert.equal(requests.some((path) => path.endsWith("new-products")), false);
});

test("failed price confirmation cannot trigger planner maintenance", async (t) => {
  const calls = [];
  t.mock.method(globalThis, "fetch", async (url, options) => {
    calls.push(url.pathname);
    const row = JSON.parse(options.body)[0];
    return url.pathname.endsWith("/products") ? json([row]) : json({ code: "fixture-failure" }, 400);
  });
  await assert.rejects(upsertProducts(config, [product()]), /Geen enkel product/);
  assert.equal(calls.some((path) => path.endsWith("new-products")), false);
});

test("maintenance outage preserves successful imports and exposes only exact retry IDs, never secrets", async (t) => {
  const warnings = [];
  let notifyCalls = 0;
  t.mock.method(console, "warn", (message) => warnings.push(message));
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.pathname.endsWith("new-products")) {
      notifyCalls += 1;
      throw new Error(config.plannerCacheAdminToken);
    }
    return json(JSON.parse(options.body));
  });
  const result = await upsertProducts(config, [product()]);
  assert.equal(result.imported.length, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(result.plannerMaintenance.pendingProductIds.length, 1);
  assert.equal(notifyCalls, 3);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].includes(config.plannerCacheAdminToken), false);
  assert.equal(warnings[0].includes(config.supabaseSecret), false);
});

test("a later structural write failure still notifies earlier confirmed products", async (t) => {
  let calls = 0;
  let notified = 0;
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.pathname.endsWith("new-products")) {
      notified += 1;
      return acknowledgement(JSON.parse(options.body).productIds);
    }
    calls += 1;
    if (calls === 3) return json({ message: "fixture forbidden" }, 403);
    return json(JSON.parse(options.body));
  });
  await assert.rejects(upsertProducts(config, [product(), product("730331001")]), /403/);
  assert.equal(notified, 1);
});

test("notification batches are bounded, deduplicated and retry-idempotent", async () => {
  const batches = [];
  const ids = Array.from({ length: 41 }, (_, i) => `product-${i}`);
  let attempt = 0;
  const result = await notifyPlannerOfNewProducts(plannerMaintenanceSettings(config), [...ids, ids[0]], async (_url, options) => {
    const batch = JSON.parse(options.body).productIds;
    batches.push(batch);
    if (attempt++ === 0) return json({}, 503);
    return acknowledgement(batch);
  });
  assert.deepEqual(batches.map((batch) => batch.length), [20, 20, 20, 1]);
  assert.deepEqual(batches[0], batches[1]);
  assert.equal(result.notifiedProducts, 41);
  assert.deepEqual(result.pendingProductIds, []);
});

test("authorization errors and redirects are not retried or followed", async () => {
  for (const status of [401, 403, 302]) {
    let calls = 0;
    const result = await notifyPlannerOfNewProducts(plannerMaintenanceSettings(config), ["one"], async (_url, options) => {
      calls += 1;
      assert.equal(options.redirect, "manual");
      return json({}, status);
    });
    assert.equal(calls, 1);
    assert.deepEqual(result.pendingProductIds, ["one"]);
  }
});
