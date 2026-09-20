import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
const bypassConfig = { ...config, plannerCacheAutomationBypassSecret: "fixture-bypass-not-a-real-secret" };

for (const [filename, jobName, mode] of [
  ["import-hoogvliet-poc.yml", "import", "catalog"],
  ["retry-daily-catalog-import.yml", "retry-if-due", "growth"],
]) {
  test(`${filename}: job environment reaches real maintenance requests with both auth headers on every batch/retry`, async (t) => {
    const workflow = readFileSync(new URL(`../.github/workflows/${filename}`, import.meta.url), "utf8")
      .replace(/\r\n/g, "\n");
    const job = workflow.split(`\n  ${jobName}:\n`)[1]?.split(/\n  [\w-]+:\n/)[0];
    const environment = job?.match(/^    env:\n([\s\S]*?)(?=^    steps:)/m)?.[1];
    assert.ok(environment, "read the actual importer job environment, not the preflight step");
    const fixtures = {
      SUPABASE_URL: config.supabaseURL,
      SUPABASE_SECRET_KEY: config.supabaseSecret,
      PLANNER_CACHE_BASE_URL: config.plannerCacheBaseURL,
      PLANNER_CACHE_ADMIN_TOKEN: config.plannerCacheAdminToken,
      VERCEL_AUTOMATION_BYPASS_SECRET: bypassConfig.plannerCacheAutomationBypassSecret,
    };
    const env = { UPDATE_MODE: mode };
    for (const [key, value] of Object.entries(fixtures)) {
      const source = key === "PLANNER_CACHE_BASE_URL" ? "vars" : "secrets";
      assert.ok(environment.includes(`${key}: \${{ ${source}.${key} }}`), `${key} must be mapped in ${jobName}`);
      env[key] = `  ${value}  `;
    }
    const loaded = loadConfig(env);
    const requests = [], output = [], priced = new Set();
    for (const method of ["log", "info", "warn", "error", "debug"]) {
      t.mock.method(console, method, (...args) => output.push(args));
    }
    // All HTTP is intercepted: exercise the normal storage -> maintenance path
    // with fixture products only, without running an importer or writing a database.
    t.mock.method(globalThis, "fetch", async (url, options) => {
      const body = JSON.parse(options.body);
      const snapshot = { url: String(url), method: options.method, headers: { ...options.headers },
        redirect: options.redirect, body, priceConfirmed: body.productIds?.every((id) => priced.has(id)) };
      requests.push(snapshot);
      if (url.origin === config.plannerCacheBaseURL) {
        const attempts = requests.filter((request) => request.body.productIds).length;
        if (attempts === 1) return json({ error: fixtures.VERCEL_AUTOMATION_BYPASS_SECRET }, 503);
        if (attempts === 2) throw new Error(`${fixtures.PLANNER_CACHE_ADMIN_TOKEN} ${fixtures.VERCEL_AUTOMATION_BYPASS_SECRET}`);
        return acknowledgement(body.productIds);
      }
      if (url.pathname.endsWith("/product_prices")) priced.add(body[0].product_id);
      return json(body);
    });
    const products = Array.from({ length: 41 }, (_, i) => product(String(730331000 + i)));
    const result = await upsertProducts(loaded, [...products, products[0]]);
    const maintenance = requests.filter((request) => request.body.productIds);
    assert.deepEqual(maintenance.map((request) => request.body.productIds.length), [20, 20, 20, 20, 1]);
    assert.deepEqual(maintenance[0].body, maintenance[1].body);
    assert.deepEqual(maintenance[1].body, maintenance[2].body);
    for (const request of maintenance) {
      assert.equal(request.url, `${config.plannerCacheBaseURL}/api/internal/planner-readiness/new-products`);
      assert.equal(request.method, "POST");
      assert.equal(request.redirect, "manual");
      assert.equal(request.priceConfirmed, true);
      assert.deepEqual(request.headers, {
        authorization: `Bearer ${config.plannerCacheAdminToken}`,
        "content-type": "application/json",
        "x-vercel-protection-bypass": bypassConfig.plannerCacheAutomationBypassSecret,
      });
    }
    const storage = requests.filter((request) => !request.body.productIds);
    assert.equal(storage.length, 82);
    for (const request of storage) {
      assert.equal(new URL(request.url).origin, config.supabaseURL);
      assert.equal(Object.hasOwn(request.headers, "x-vercel-protection-bypass"), false);
    }
    assert.equal(new Set(maintenance.slice(2).flatMap((request) => request.body.productIds)).size, 41);
    assert.equal(result.imported.length, 41);
    assert.equal(result.duplicateSKUsSkipped, 1);
    assert.deepEqual(result.plannerMaintenance, { notifiedProducts: 41, pendingProductIds: [] });
    for (const secret of [config.supabaseSecret, config.plannerCacheAdminToken, bypassConfig.plannerCacheAutomationBypassSecret]) {
      assert.equal(JSON.stringify({ output, result }).includes(secret), false);
    }
  });
}

test("optional server config reaches only the configured planner origin with both independent auth layers", async () => {
  const loaded = loadConfig({ DRY_RUN: "1", PLANNER_CACHE_BASE_URL: config.plannerCacheBaseURL,
    PLANNER_CACHE_ADMIN_TOKEN: config.plannerCacheAdminToken,
    VERCEL_AUTOMATION_BYPASS_SECRET: `  ${bypassConfig.plannerCacheAutomationBypassSecret}  ` });
  assert.equal(loaded.plannerCacheAutomationBypassSecret, bypassConfig.plannerCacheAutomationBypassSecret);
  const result = await notifyPlannerOfNewProducts(plannerMaintenanceSettings(loaded), ["fixture-id"], async (url, options) => {
    assert.equal(String(url), `${config.plannerCacheBaseURL}/api/internal/planner-readiness/new-products`);
    assert.equal(url.search, "");
    assert.deepEqual(options.headers, {
      authorization: `Bearer ${config.plannerCacheAdminToken}`,
      "content-type": "application/json",
      "x-vercel-protection-bypass": bypassConfig.plannerCacheAutomationBypassSecret,
    });
    assert.equal(options.redirect, "manual");
    return acknowledgement(["fixture-id"]);
  });
  assert.equal(result.notifiedProducts, 1);
});

test("missing or blank bypass sends no bypass header and preserves existing app auth", async () => {
  for (const value of [undefined, "", "   "]) {
    const settings = plannerMaintenanceSettings({ ...config, plannerCacheAutomationBypassSecret: value });
    await notifyPlannerOfNewProducts(settings, ["fixture-id"], async (_url, options) => {
      assert.deepEqual(options.headers, {
        authorization: `Bearer ${config.plannerCacheAdminToken}`, "content-type": "application/json",
      });
      return acknowledgement(["fixture-id"]);
    });
  }
  assert.equal(plannerMaintenanceSettings({ plannerCacheAutomationBypassSecret: "fixture-only" }), null);
});

test("bypass never reaches Supabase; product and price requests are identical with or without bypass", async (t) => {
  const runs = [];
  for (const settings of [config, bypassConfig]) {
    const writes = [];
    const mock = t.mock.method(globalThis, "fetch", async (url, options) => {
      if (url.origin === config.plannerCacheBaseURL) {
        assert.equal(options.headers["x-vercel-protection-bypass"], settings.plannerCacheAutomationBypassSecret);
        return acknowledgement(JSON.parse(options.body).productIds);
      }
      assert.equal(url.origin, config.supabaseURL);
      assert.equal(Object.hasOwn(options.headers, "x-vercel-protection-bypass"), false);
      const payload = JSON.parse(options.body);
      // The normal importer intentionally generates a fresh insertion UUID.
      const normalized = payload.map(({ id, product_id, ...row }) => row);
      writes.push({ url: String(url), method: options.method, headers: options.headers, body: normalized });
      return json(payload);
    });
    const result = await upsertProducts(settings, [product()]);
    assert.equal(result.imported.length, 1);
    assert.equal(result.plannerMaintenance.notifiedProducts, 1);
    mock.mock.restore();
    runs.push(writes);
  }
  assert.equal(runs[0].length, 2);
  assert.deepEqual(runs[0], runs[1]);
});

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
  const output = [];
  let notifyCalls = 0;
  t.mock.method(console, "warn", (message) => warnings.push(message));
  for (const method of ["log", "info", "error", "debug"]) t.mock.method(console, method, (...args) => output.push(args));
  t.mock.method(globalThis, "fetch", async (url, options) => {
    if (url.pathname.endsWith("new-products")) {
      notifyCalls += 1;
      throw new Error(`${config.plannerCacheAdminToken} ${bypassConfig.plannerCacheAutomationBypassSecret}`);
    }
    return json(JSON.parse(options.body));
  });
  const result = await upsertProducts(bypassConfig, [product()]);
  assert.equal(result.imported.length, 1);
  assert.equal(result.errors.length, 0);
  assert.equal(result.plannerMaintenance.pendingProductIds.length, 1);
  assert.equal(notifyCalls, 3);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].includes(config.plannerCacheAdminToken), false);
  assert.equal(warnings[0].includes(config.supabaseSecret), false);
  for (const secret of [config.plannerCacheAdminToken, config.supabaseSecret, bypassConfig.plannerCacheAutomationBypassSecret]) {
    assert.equal(JSON.stringify({ warnings, output, result }).includes(secret), false);
  }
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
  for (const status of [401, 403, 301, 302, 303, 307, 308]) {
    let calls = 0;
    const result = await notifyPlannerOfNewProducts(plannerMaintenanceSettings(bypassConfig), ["one"], async (url, options) => {
      calls += 1;
      assert.equal(url.origin, config.plannerCacheBaseURL);
      assert.equal(options.headers["x-vercel-protection-bypass"], bypassConfig.plannerCacheAutomationBypassSecret);
      assert.equal(options.redirect, "manual");
      return new Response("", { status, headers: { location: "https://other.example/collect" } });
    });
    assert.equal(calls, 1);
    assert.deepEqual(result.pendingProductIds, ["one"]);
  }
});
