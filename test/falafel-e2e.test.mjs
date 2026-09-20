import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { TARGET, TABLE_KEYS, validateInput, runFalafelE2E, snapshot, e2eConfig,
  guardedImporterFetch } from "../scripts/falafel-e2e.mjs";

const workflow = readFileSync(new URL("../.github/workflows/import-hoogvliet-poc.yml", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const source = readFileSync(new URL("../scripts/falafel-e2e.mjs", import.meta.url), "utf8");
const env = {
  FALAFEL_E2E_ONLY: "true", E2E_TEST_SKU: TARGET.sku, PREFLIGHT_ONLY: "false",
  GITHUB_EVENT_NAME: "workflow_dispatch", GITHUB_REPOSITORY: TARGET.repository,
  GITHUB_REF: TARGET.branch, GITHUB_RUN_ATTEMPT: "1",
  SUPABASE_URL: TARGET.database, SUPABASE_SECRET_KEY: "sb_secret_fixture_not_real",
  PLANNER_CACHE_BASE_URL: TARGET.preview, PLANNER_CACHE_ADMIN_TOKEN: "fixture-admin-not-real",
  VERCEL_AUTOMATION_BYPASS_SECRET: "fixture-bypass-not-real",
};
const recipeId = "11111111-1111-4111-8111-111111111111";
const matchKey = "22222222-2222-4222-8222-222222222222:g:ingredient:generic";
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status,
  headers: { "content-type": "application/json", ...headers } });

function fixture(options = {}) {
  const db = Object.fromEntries(Object.keys(TABLE_KEYS).map((table) => [table, []]));
  db.products = [{ id: "unrelated-product", sku: "123456789", name: "Ongewijzigd product" }];
  db.product_prices = [{ product_id: "unrelated-product", price: 2 }];
  db.recipes = [{ id: recipeId, source_key: "falafel-pita" }];
  db.ingredient_product_matches = [{ match_key: matchKey, ingredient_source_key: "falafel", product_id: null,
    matcher_version: 1, requirement_unit: "g", requirement_kind: "ingredient", brand_constraint: "",
    match_status: "invalid", failure_reason: "no_catalog_product", refresh_status: "current", invalidated_at: null },
  { match_key: "unrelated-match", ingredient_source_key: "other", match_status: "valid" }];
  db.recipe_readiness_cache = Array.from({ length: 10 }, (_, i) => ({ recipe_id: recipeId, people_count: i + 1,
    dependency_match_keys: [matchKey], refresh_status: "current", readiness_status: "NOT_READY", problem_count: 2,
    readiness_payload: { ingredients: [{ sourceKey: "falafel", productId: null, ready: false },
      { sourceKey: "pitabroodjes", reason: "no_catalog_product" }] } }));
  db.recipe_readiness_cache.push({ recipe_id: "unrelated-recipe", people_count: 1, dependency_match_keys: [],
    refresh_status: "current", evaluated_at: "unchanged" });
  db.catalog_discovery_state = [{ state_key: "daily-catalog-growth", term_cursor: 8, page_cursor: 3 }];
  const before = structuredClone(db), requests = [], logs = [];
  const product = { sku: TARGET.sku, name: TARGET.name, packageText: TARGET.packageText, weightGrams: 200,
    supermarket: "Hoogvliet", sourceURL: TARGET.sourceURL, price: 1.48, fetchedAt: new Date().toISOString(),
    isOffer: false, oldPrice: null, offerText: null, validFrom: null, validUntil: null };
  let maintenanceCalls = 0, targetReads = 0;
  const fetcher = async (input, init) => {
    const url = new URL(input);
    requests.push({ url: String(url), ...init });
    if (init.method === "GET") {
      const table = url.pathname.split("/").at(-1);
      assert.ok(Object.hasOwn(db, table));
      if (options.postReadFailure && maintenanceCalls) return json({}, 503);
      let rows = db[table];
      if (url.searchParams.has("sku")) {
        targetReads += 1;
        if (options.race && targetReads === 2) db.products.push({ id: "concurrent", sku: TARGET.sku });
        rows = rows.filter((row) => row.sku === url.searchParams.get("sku").slice(3));
      }
      const offset = Number(url.searchParams.get("offset") ?? 0), limit = Number(url.searchParams.get("limit") ?? 1000);
      return json(rows.slice(offset, offset + limit), 200, { "content-range": `*/${rows.length}` });
    }
    assert.equal(init.method, "POST");
    const body = JSON.parse(init.body);
    if (url.origin === TARGET.preview) {
      assert.deepEqual(init.headers, { authorization: `Bearer ${env.PLANNER_CACHE_ADMIN_TOKEN}`,
        "content-type": "application/json", "x-vercel-protection-bypass": env.VERCEL_AUTOMATION_BYPASS_SECRET });
      assert.equal(init.redirect, "manual");
      if (body.productIds.length === 0) return json({ error: "invalid-request" }, options.authStatus ?? 400);
      maintenanceCalls += 1;
      if (options.maintenanceFailure || (options.retry && maintenanceCalls === 1)) {
        return json({ error: env.VERCEL_AUTOMATION_BYPASS_SECRET }, 503);
      }
      assert.equal(body.productIds.length, 1);
      const id = body.productIds[0];
      assert.ok(db.product_prices.some((row) => row.product_id === id));
      Object.assign(db.ingredient_product_matches[0], { match_status: "valid", failure_reason: null, product_id: id });
      for (const row of db.recipe_readiness_cache.filter((row) => row.recipe_id === recipeId)) {
        row.problem_count = 1;
        Object.assign(row.readiness_payload.ingredients[0], { productId: id, ready: true });
      }
      options.unexpectedWrite?.(db);
      return json({ productCount: 1, changedMatchKeys: [matchKey], affectedRecipeIds: [recipeId], refreshedReadinessCount: 10 });
    }
    assert.equal(url.origin, TARGET.database);
    assert.equal(init.headers["x-vercel-protection-bypass"], undefined);
    const table = url.pathname.split("/").at(-1);
    assert.ok(["products", "product_prices"].includes(table));
    assert.equal(body.length, 1);
    if (table === "products") assert.equal(body[0].sku, TARGET.sku);
    db[table].push(body[0]);
    return json(body);
  };
  return { db, before, requests, logs, product, dependencies: {
    fetch: fetcher, fetchProduct: async () => product, log: (value) => logs.push(value),
  } };
}

test("missing/wrong SKU, ambiguous mode, wrong branch/event/repository and reruns stop before any I/O", async () => {
  for (const patch of [{ E2E_TEST_SKU: "" }, { E2E_TEST_SKU: undefined }, { E2E_TEST_SKU: "123456789" },
    { E2E_TEST_SKU: "730331000,123456789" }, { E2E_TEST_SKU: " 730331000" },
    { FALAFEL_E2E_ONLY: "false" }, { PREFLIGHT_ONLY: "true" }, { GITHUB_REF: "refs/heads/main" },
    { GITHUB_EVENT_NAME: "schedule" }, { GITHUB_REPOSITORY: "other/repo" }, { GITHUB_RUN_ATTEMPT: "2" },
    { SEARCH_TERMS: "falafel" }, { MAX_NEW_PRODUCTS: "400" }, { ADVANCE_DISCOVERY_STATE: "1" }]) {
    let calls = 0;
    await assert.rejects(runFalafelE2E({ ...env, ...patch }, {
      fetch: async () => { calls++; }, fetchProduct: async () => { calls++; },
    }));
    assert.equal(calls, 0);
  }
});

test("secrets and exact Preview/database origins are required before I/O", async () => {
  for (const key of ["SUPABASE_SECRET_KEY", "PLANNER_CACHE_ADMIN_TOKEN", "VERCEL_AUTOMATION_BYPASS_SECRET"]) {
    assert.throws(() => e2eConfig({ ...env, [key]: "" }), /missing-required-configuration/);
  }
  for (const patch of [{ PLANNER_CACHE_BASE_URL: "https://production.example" }, { SUPABASE_URL: "https://other.supabase.co" }]) {
    assert.throws(() => e2eConfig({ ...env, ...patch }), /unexpected-.*-origin/);
  }
});

test("an existing target is refused before fetching the source or making writes", async () => {
  const f = fixture(); f.db.products.push({ id: "existing", sku: TARGET.sku });
  f.dependencies.fetchProduct = () => { throw new Error("must not fetch source"); };
  await assert.rejects(runFalafelE2E(env, f.dependencies), /test-product-already-exists/);
  assert.equal(f.requests.length, 1);
  assert.equal(f.requests[0].method, "GET");
});

test("wrong source identity, packaging, absent price and stale source are refused without writes", async () => {
  for (const patch of [{ sku: "123456789" }, { name: "Other falafel" }, { packageText: "400 gram" },
    { weightGrams: 400 }, { price: null }, { price: 0 }, { fetchedAt: "2020-01-01T00:00:00Z" }]) {
    const f = fixture(); Object.assign(f.product, patch);
    await assert.rejects(runFalafelE2E(env, f.dependencies), /source-product-validation-failed/);
    assert.ok(f.requests.every((request) => request.method === "GET"));
  }
});

test("changed scenario or failed auth cannot start product writes", async () => {
  for (const patch of [{ match_status: "valid" }, { matcher_version: 0 }, { requirement_unit: "piece" },
    { requirement_kind: "mealMix" }, { brand_constraint: "Knorr" }]) {
    const dirty = fixture(); Object.assign(dirty.db.ingredient_product_matches[0], patch);
    await assert.rejects(runFalafelE2E(env, dirty.dependencies), /falafel-match-no-longer-clean/);
    assert.ok(dirty.requests.every((request) => request.method === "GET"));
  }
  const auth = fixture({ authStatus: 401 });
  await assert.rejects(runFalafelE2E(env, auth.dependencies), /pre-write-auth-check-failed/);
  assert.deepEqual(auth.db, auth.before);
});

test("the real storage/helper chain writes one SKU and retains both auth layers across maintenance retries", async () => {
  const f = fixture({ retry: true }), originalFetch = globalThis.fetch;
  const audit = await runFalafelE2E(env, f.dependencies);
  assert.equal(globalThis.fetch, originalFetch);
  assert.equal(audit.product_count_after - audit.product_count_before, 1);
  assert.equal(audit.price_count_after - audit.price_count_before, 1);
  assert.deepEqual(audit.maintenance_attempts.map((attempt) => attempt.status), [503, 200]);
  assert.equal(audit.changes.ingredient_product_matches.updated, 1);
  assert.equal(audit.changes.recipe_readiness_cache.updated, 10);
  assert.equal(audit.unexpected_writes, 0);
  assert.deepEqual(f.db.catalog_discovery_state, f.before.catalog_discovery_state);
  for (const table of ["recipes", "recipe_ingredients", "ingredients", "ingredient_aliases",
    "catalog_import_runs", "catalog_daily_jobs", "catalog_daily_attempts"]) assert.deepEqual(f.db[table], f.before[table]);
  assert.equal(f.logs.at(-1).e2e_passed, true);
  for (const secret of [env.SUPABASE_SECRET_KEY, env.PLANNER_CACHE_ADMIN_TOKEN, env.VERCEL_AUTOMATION_BYPASS_SECRET]) {
    assert.equal(JSON.stringify(f.logs).includes(secret), false);
  }
});

test("a concurrent insert blocks the first importer write and never updates the existing product", async () => {
  const f = fixture({ race: true });
  await assert.rejects(runFalafelE2E(env, f.dependencies), /e2e-post-validation-failed/);
  assert.equal(f.db.product_prices.length, f.before.product_prices.length);
  assert.ok(f.requests.filter((r) => r.method === "POST").every((r) => new URL(r.url).origin === TARGET.preview));
});

test("guard blocks other SKU, multi-product, fallback upsert and discovery writes before HTTP", async () => {
  const f = fixture(), config = e2eConfig(env), audit = { product_id: null, maintenance_attempts: [] };
  let calls = 0;
  const guarded = guardedImporterFetch(config, f.product, {}, async () => { calls++; }, audit);
  const row = { id: recipeId, sku: TARGET.sku, supermarket: "Hoogvliet", name: TARGET.name,
    package_text: TARGET.packageText, source_url: TARGET.sourceURL };
  const init = { method: "POST", redirect: "manual", headers: { apikey: env.SUPABASE_SECRET_KEY,
    Prefer: "resolution=ignore-duplicates,return=representation" }, body: JSON.stringify([row]) };
  const url = `${TARGET.database}/rest/v1/products?on_conflict=supermarket,sku`;
  for (const request of [
    { ...init, body: JSON.stringify([{ ...row, sku: "123456789" }]) },
    { ...init, body: JSON.stringify([row, row]) },
    { ...init, headers: { ...init.headers, Prefer: "resolution=merge-duplicates,return=representation" } },
  ]) await assert.rejects(guarded(url, request));
  await assert.rejects(guarded(`${TARGET.database}/rest/v1/catalog_discovery_state`, init));
  assert.equal(calls, 0);
});

test("full row comparison detects unrelated changes, not merely unchanged counts", async () => {
  for (const table of ["products", "product_prices", "recipes", "recipe_readiness_cache", "catalog_discovery_state"]) {
    const f = fixture({ unexpectedWrite: (db) => { db[table].at(-1).unexpected = "changed"; } });
    // For products/prices mutate the existing row, not the allowed insertion.
    if (["products", "product_prices"].includes(table)) {
      const other = fixture({ unexpectedWrite: (db) => { db[table][0].unexpected = "changed"; } });
      await assert.rejects(runFalafelE2E(env, other.dependencies));
      assert.ok(other.logs.at(-1).unexpected_writes > 0);
    } else {
      await assert.rejects(runFalafelE2E(env, f.dependencies));
      assert.ok(f.logs.at(-1).unexpected_writes > 0);
    }
  }
});

test("maintenance failure is audited without success or a whole-import replay", async (t) => {
  const f = fixture({ maintenanceFailure: true }), warnings = [];
  t.mock.method(console, "warn", (value) => warnings.push(value));
  await assert.rejects(runFalafelE2E(env, f.dependencies), /e2e-post-validation-failed/);
  assert.equal(f.logs.at(-1).maintenance_attempts.length, 3);
  assert.equal(f.db.products.length - f.before.products.length, 1);
  assert.equal(f.logs.at(-1).e2e_passed, false);
  for (const secret of [env.SUPABASE_SECRET_KEY, env.PLANNER_CACHE_ADMIN_TOKEN, env.VERCEL_AUTOMATION_BYPASS_SECRET]) {
    assert.equal(JSON.stringify({ logs: f.logs, warnings }).includes(secret), false);
  }
});

test("failed post-read reports unknown scope instead of falsely claiming zero unexpected writes", async () => {
  const f = fixture({ postReadFailure: true });
  await assert.rejects(runFalafelE2E(env, f.dependencies), /post-validation-unavailable/);
  assert.equal(f.logs.at(-1).unexpected_writes, null);
  assert.equal(f.logs.at(-1).e2e_passed, false);
  assert.ok(f.logs.at(-1).product_id);
});

test("snapshot pagination reads beyond 1000 and refuses missing exact counts", async () => {
  const f = fixture(); f.db.products = Array.from({ length: 1001 }, (_, id) => ({ id: String(id), sku: String(id) }));
  assert.equal((await snapshot(e2eConfig(env), f.dependencies.fetch)).products.length, 1001);
  await assert.rejects(snapshot(e2eConfig(env), async () => json([])), /baseline-count-inconsistent/);
});

test("manual E2E workflow cannot fall through to broad import on malformed or conflicting inputs", () => {
  const expression = workflow.match(/^  import:\n[^\n]*\n    if: \$\{\{ (.*) \}\}/m)[1];
  const allow = (typed, raw) => vm.runInNewContext(expression, { inputs: {
    preflight_only: false, falafel_e2e_only: false, e2e_test_sku: "", ...typed },
  github: { event: { inputs: { preflight_only: "false", falafel_e2e_only: "false", e2e_test_sku: "", ...raw } } } });
  for (const [typed, raw] of [[{ falafel_e2e_only: true }, {}], [{}, { falafel_e2e_only: "true" }],
    [{ e2e_test_sku: TARGET.sku }, {}], [{}, { e2e_test_sku: TARGET.sku }],
    [{ e2e_test_sku: "wrong" }, {}], [{ e2e_test_sku: " " }, {}], [{ preflight_only: true }, {}]]) {
    assert.equal(allow(typed, raw), false);
  }
  assert.equal(allow({}, {}), true);
  const job = workflow.split("\n  falafel-e2e:\n")[1];
  assert.match(job, /github.event_name == 'workflow_dispatch'/);
  assert.ok(job.includes(`github.ref == '${TARGET.branch}'`));
  assert.ok(job.includes(`github.repository == '${TARGET.repository}'`));
  assert.match(job, /ref: \$\{\{ github.sha \}\}/);
  assert.match(job, /persist-credentials: false/);
  assert.ok(job.indexOf("--validate-input") < job.indexOf("npm ci"));
  assert.match(job, /run: node scripts\/falafel-e2e.mjs\n/);
  assert.doesNotMatch(job, /npm run import|MAX_NEW_PRODUCTS|SEARCH_TERMS|ADVANCE_DISCOVERY_STATE|UPDATE_MODE|CATALOG_BATCH/);
  for (const key of ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "PLANNER_CACHE_ADMIN_TOKEN", "VERCEL_AUTOMATION_BYPASS_SECRET"]) {
    assert.ok(job.includes(`${key}: \${{ secrets.${key} }}`));
  }
  assert.ok(job.includes("PLANNER_CACHE_BASE_URL: ${{ vars.PLANNER_CACHE_BASE_URL }}"));
  assert.match(workflow, /group: hoogvliet-supabase-update\n  cancel-in-progress: false/);
  assert.doesNotMatch(source, /import\(.+(?:importer|catalog-growth|daily-catalog-growth)\.mjs/);
  validateInput(env);
});
