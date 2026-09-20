import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { requestHeaders, restURL, upsertProducts } from "../src/supabase.mjs";
import { plannerMaintenanceSettings } from "../src/planner-cache-maintenance.mjs";

export const TARGET = Object.freeze({
  sku: "730331000", name: "Go vega Plantaardige falafel", packageText: "200 gram",
  sourceURL: "https://www.hoogvliet.com/product/go-vega-plantaardige-falafel1",
  preview: "https://boodschappenmaatje-pwa-git-fix-planne-a4a7f3-dennisverkaik-4661.vercel.app",
  database: "https://pjcqxufvbkkjehituzxz.supabase.co",
  branch: "refs/heads/fix/planner-new-product-maintenance",
  repository: "boodschappenmaatje/Boodschappenmandje-importer",
});
export const TABLE_KEYS = Object.freeze({
  products: ["id"], product_prices: ["product_id"], ingredient_product_matches: ["match_key"],
  recipe_readiness_cache: ["recipe_id", "people_count"], recipes: ["id"], recipe_ingredients: ["id"],
  ingredients: ["id"], ingredient_aliases: ["id"], catalog_import_runs: ["id"],
  catalog_discovery_state: ["state_key"], catalog_daily_jobs: ["id"], catalog_daily_attempts: ["id"],
});
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
class E2EError extends Error {}
const requireThat = (condition, code) => { if (!condition) throw new E2EError(code); };
const clean = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

export function validateInput(env) {
  requireThat(env.FALAFEL_E2E_ONLY === "true" && env.E2E_TEST_SKU === TARGET.sku, "explicit-falafel-input-required");
  requireThat(env.PREFLIGHT_ONLY !== "true", "conflicting-preflight-mode");
  requireThat(env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.GITHUB_REPOSITORY === TARGET.repository &&
    env.GITHUB_REF === TARGET.branch && env.GITHUB_RUN_ATTEMPT === "1", "unexpected-workflow-context");
  // Do not inherit broad importer/discovery configuration, even accidentally.
  for (const key of ["SEARCH_TERMS", "UPDATE_MODE", "CATALOG_BATCH", "MAX_NEW_PRODUCTS", "MAX_PRODUCTS",
    "ADVANCE_DISCOVERY_STATE", "DAILY_IMPORT_JOB"]) {
    requireThat(!env[key], "broad-import-configuration-forbidden");
  }
}

export function e2eConfig(env) {
  validateInput(env);
  for (const key of ["SUPABASE_URL", "SUPABASE_SECRET_KEY", "PLANNER_CACHE_BASE_URL",
    "PLANNER_CACHE_ADMIN_TOKEN", "VERCEL_AUTOMATION_BYPASS_SECRET"]) {
    requireThat(typeof env[key] === "string" && env[key].trim(), "missing-required-configuration");
  }
  const config = { headless: true, updateMode: "catalog", supabaseURL: env.SUPABASE_URL.trim(),
    supabaseSecret: env.SUPABASE_SECRET_KEY.trim(), plannerCacheBaseURL: env.PLANNER_CACHE_BASE_URL.trim(),
    plannerCacheAdminToken: env.PLANNER_CACHE_ADMIN_TOKEN.trim(),
    plannerCacheAutomationBypassSecret: env.VERCEL_AUTOMATION_BYPASS_SECRET.trim() };
  requireThat([TARGET.database, TARGET.database + "/"].includes(config.supabaseURL), "unexpected-database-origin");
  requireThat([TARGET.preview, TARGET.preview + "/"].includes(config.plannerCacheBaseURL), "unexpected-preview-origin");
  plannerMaintenanceSettings(config);
  return config;
}

export async function fetchFalafel(config) {
  // Reuse the existing detail-page validator/price parser. No search and no onBatch callback.
  const { refreshExistingProducts } = await import("../src/hoogvliet.mjs");
  const result = await refreshExistingProducts(config, [{ sku: TARGET.sku, sourceURL: TARGET.sourceURL,
    brand: "Go vega", searchTerm: "falafel", available: null }], { info() {}, error() {} });
  requireThat(result.products.length === 1, "source-must-return-one-product");
  return result.products[0];
}

export function validateProduct(product, now = Date.now()) {
  requireThat(product?.sku === TARGET.sku && product.supermarket === "Hoogvliet" &&
    clean(product.name) === TARGET.name && clean(product.packageText) === TARGET.packageText &&
    product.weightGrams === 200 && product.sourceURL === TARGET.sourceURL &&
    Number.isFinite(product.price) && product.price > 0 &&
    Number.isFinite(Date.parse(product.fetchedAt)) &&
    Math.abs(now - Date.parse(product.fetchedAt)) < 5 * 60_000, "source-product-validation-failed");
}

async function readRows(config, fetcher, table, query = {}) {
  const url = restURL(config.supabaseURL, table);
  for (const [key, value] of Object.entries({ select: "*", ...query })) url.searchParams.set(key, value);
  const response = await fetcher(url, { method: "GET", headers: requestHeaders(config.supabaseSecret, "count=exact"),
    redirect: "manual", signal: AbortSignal.timeout(25_000) });
  requireThat(response.ok, "baseline-read-failed");
  const rows = await response.json();
  requireThat(Array.isArray(rows), "baseline-read-invalid");
  return { rows, total: Number(response.headers.get("content-range")?.match(/\/(\d+)$/)?.[1]) };
}

async function assertAbsent(config, fetcher) {
  const { rows } = await readRows(config, fetcher, "products", { sku: `eq.${TARGET.sku}`, limit: "2" });
  requireThat(rows.length === 0, "test-product-already-exists");
}

export async function snapshot(config, fetcher) {
  const result = {};
  for (const [table, keys] of Object.entries(TABLE_KEYS)) {
    const rows = [];
    let total;
    do {
      const page = await readRows(config, fetcher, table,
        { order: keys.join(","), limit: "1000", offset: String(rows.length) });
      requireThat(Number.isInteger(page.total) && page.total >= 0 && page.total <= 50_000 &&
        (total === undefined || total === page.total), "baseline-count-inconsistent");
      total = page.total;
      requireThat(page.rows.length > 0 || total === 0, "baseline-pagination-incomplete");
      rows.push(...page.rows);
    } while (rows.length < total);
    requireThat(rows.length === total && new Set(rows.map((row) => rowKey(table, row))).size === total,
      "baseline-keys-inconsistent");
    result[table] = rows;
  }
  return result;
}

export function scenario(before) {
  requireThat(!before.products.some((row) => row.sku === TARGET.sku || /falafel/i.test(row.name)), "test-product-already-exists");
  const matches = before.ingredient_product_matches.filter((row) => row.ingredient_source_key === "falafel");
  requireThat(matches.length === 1, "falafel-match-scope-changed");
  const match = matches[0];
  requireThat(match.match_status === "invalid" && match.failure_reason === "no_catalog_product" &&
    match.product_id === null && match.refresh_status === "current" && match.invalidated_at === null &&
    match.matcher_version === 1 && match.requirement_unit === "g" &&
    match.requirement_kind === "ingredient" && match.brand_constraint === "",
  "falafel-match-no-longer-clean");
  const recipes = before.recipes.filter((row) => row.source_key === "falafel-pita");
  requireThat(recipes.length === 1, "falafel-recipe-missing");
  const rows = before.recipe_readiness_cache.filter((row) => row.dependency_match_keys.includes(match.match_key));
  requireThat(rows.length === 10 && rows.every((row) => row.recipe_id === recipes[0].id &&
    row.refresh_status === "current" && row.problem_count === 2 && row.readiness_status === "NOT_READY" &&
    row.readiness_payload.ingredients.some((item) => item.sourceKey === "pitabroodjes" && item.reason === "no_catalog_product")) &&
    rows.map((row) => row.people_count).sort((a, b) => a - b).join(",") === "1,2,3,4,5,6,7,8,9,10",
  "falafel-readiness-scope-changed");
  return { matchKey: match.match_key, recipeId: recipes[0].id, readinessKeys: rows.map((row) => rowKey("recipe_readiness_cache", row)) };
}

function rowKey(table, row) { return TABLE_KEYS[table].map((key) => row[key]).join(":"); }
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
const digest = (row) => createHash("sha256").update(JSON.stringify(canonical(row))).digest("hex");

export function diffSnapshots(before, after, scope, productId) {
  let unexpected = 0;
  const changes = {};
  for (const table of Object.keys(TABLE_KEYS)) {
    const a = new Map(before[table].map((row) => [rowKey(table, row), digest(row)]));
    const b = new Map(after[table].map((row) => [rowKey(table, row), digest(row)]));
    const allowed = table === "products" || table === "product_prices" ? [productId]
      : table === "ingredient_product_matches" ? [scope.matchKey]
        : table === "recipe_readiness_cache" ? scope.readinessKeys : [];
    const change = { added: 0, updated: 0, removed: 0 };
    for (const key of new Set([...a.keys(), ...b.keys()])) {
      if (a.get(key) === b.get(key)) continue;
      const kind = !a.has(key) ? "added" : !b.has(key) ? "removed" : "updated";
      change[kind] += 1;
      const expectedKind = table === "products" || table === "product_prices" ? "added" : "updated";
      if (!allowed.includes(key) || kind !== expectedKind) unexpected += 1;
    }
    changes[table] = change;
  }
  return { changes, unexpected_writes: unexpected };
}

export function guardedImporterFetch(config, product, scope, fetcher, audit) {
  const maintenanceURL = plannerMaintenanceSettings(config).url.href;
  let confirmedProduct = false;
  return async (input, options) => {
    const url = new URL(input), headers = new Headers(options.headers);
    requireThat(options.method === "POST" && options.redirect === "manual", "unexpected-importer-request");
    const body = JSON.parse(options.body);
    if (url.href === maintenanceURL) {
      requireThat(confirmedProduct && body.productIds?.length === 1 && body.productIds[0] === audit.product_id &&
        headers.get("authorization") === `Bearer ${config.plannerCacheAdminToken}` &&
        headers.get("x-vercel-protection-bypass") === config.plannerCacheAutomationBypassSecret, "maintenance-scope-or-auth-invalid");
      const attempt = { status: null, product_id: audit.product_id };
      audit.maintenance_attempts.push(attempt);
      const response = await fetcher(input, options);
      attempt.status = response.status;
      if (response.ok) {
        const result = await response.clone().json();
        requireThat(result.productCount === 1 && Array.isArray(result.changedMatchKeys) &&
          result.changedMatchKeys.every((key) => key === scope.matchKey) && Array.isArray(result.affectedRecipeIds) &&
          result.affectedRecipeIds.every((id) => id === scope.recipeId) && Number.isInteger(result.refreshedReadinessCount) &&
          result.refreshedReadinessCount >= 0 && result.refreshedReadinessCount <= 10, "maintenance-response-out-of-scope");
        audit.maintenance_result = { productCount: 1, changedMatchKeys: result.changedMatchKeys,
          affectedRecipeIds: result.affectedRecipeIds, refreshedReadinessCount: result.refreshedReadinessCount };
      }
      return response;
    }
    requireThat(url.origin === TARGET.database && !headers.has("x-vercel-protection-bypass") &&
      headers.get("apikey") === config.supabaseSecret && Array.isArray(body) && body.length === 1, "storage-scope-invalid");
    const row = body[0];
    if (url.pathname === "/rest/v1/products") {
      requireThat(headers.get("prefer") === "resolution=ignore-duplicates,return=representation" &&
        url.searchParams.get("on_conflict") === "supermarket,sku" && row.sku === TARGET.sku &&
        row.supermarket === "Hoogvliet" && row.name === product.name && row.package_text === product.packageText &&
        row.source_url === TARGET.sourceURL && UUID.test(row.id) &&
        (!audit.product_id || audit.product_id === row.id), "product-write-out-of-scope");
      if (!audit.product_id) await assertAbsent(config, fetcher);
      audit.product_id = row.id;
      const response = await fetcher(input, options);
      if (response.ok) {
        const saved = await response.clone().json();
        confirmedProduct = saved.length === 1 && saved[0].id === row.id && saved[0].sku === TARGET.sku;
      }
      return response;
    }
    requireThat(url.pathname === "/rest/v1/product_prices" && confirmedProduct &&
      row.product_id === audit.product_id && row.price === product.price && row.fetched_at === product.fetchedAt &&
      url.searchParams.get("on_conflict") === "product_id", "price-write-out-of-scope");
    return fetcher(input, options);
  };
}

export async function runFalafelE2E(env = process.env, dependencies = {}) {
  const config = e2eConfig(env);
  const fetcher = dependencies.fetch ?? globalThis.fetch;
  const log = dependencies.log ?? ((value) => console.log(JSON.stringify(value)));
  await assertAbsent(config, fetcher);
  const product = await (dependencies.fetchProduct ?? fetchFalafel)(config);
  validateProduct(product);
  const before = await snapshot(config, fetcher), scope = scenario(before);
  // Empty IDs are rejected by the real route before database access.
  const auth = await fetcher(plannerMaintenanceSettings(config).url, { method: "POST", redirect: "manual",
    signal: AbortSignal.timeout(25_000), headers: { authorization: `Bearer ${config.plannerCacheAdminToken}`,
      "x-vercel-protection-bypass": config.plannerCacheAutomationBypassSecret, "content-type": "application/json" },
    body: '{"productIds":[]}' });
  requireThat(auth.status === 400 && (await auth.json()).error === "invalid-request", "pre-write-auth-check-failed");
  const audit = { sku: TARGET.sku, product_count_before: before.products.length,
    price_count_before: before.product_prices.length, product_id: null, maintenance_attempts: [] };
  log({ sku: TARGET.sku, product_count_before: audit.product_count_before, price_count_before: audit.price_count_before });
  const originalFetch = globalThis.fetch;
  let outcome, failure;
  try {
    // Observe/guard the actual production requests, forwarding unchanged to fetch.
    globalThis.fetch = guardedImporterFetch(config, product, scope, fetcher, audit);
    outcome = await upsertProducts(config, [product]);
  } catch { failure = "import-or-maintenance-failed"; }
  finally { globalThis.fetch = originalFetch; }
  let after;
  try { after = await snapshot(config, fetcher); }
  catch {
    log({ ...audit, e2e_passed: false, post_validation: "unavailable", unexpected_writes: null });
    throw new E2EError("post-validation-unavailable-stop-no-replay");
  }
  Object.assign(audit, { product_count_after: after.products.length, price_count_after: after.product_prices.length },
    diffSnapshots(before, after, scope, audit.product_id));
  const stored = after.products.filter((row) => row.sku === TARGET.sku);
  const price = after.product_prices.filter((row) => row.product_id === audit.product_id);
  const match = after.ingredient_product_matches.find((row) => row.match_key === scope.matchKey);
  const readiness = after.recipe_readiness_cache.filter((row) => scope.readinessKeys.includes(rowKey("recipe_readiness_cache", row)));
  const success = !failure && audit.unexpected_writes === 0 && stored.length === 1 && stored[0].id === audit.product_id &&
    stored[0].name === TARGET.name && stored[0].package_text === TARGET.packageText &&
    price.length === 1 && Number(price[0].price) === product.price &&
    audit.changes.products.added === 1 && audit.changes.product_prices.added === 1 &&
    audit.changes.ingredient_product_matches.updated === 1 && audit.changes.recipe_readiness_cache.updated === 10 &&
    outcome?.plannerMaintenance?.notifiedProducts === 1 && outcome.plannerMaintenance.pendingProductIds.length === 0 &&
    audit.maintenance_result && match?.product_id === audit.product_id && match.match_status === "valid" &&
    match.refresh_status === "current" && readiness.length === 10 && readiness.every((row) =>
      row.refresh_status === "current" && row.readiness_status === "NOT_READY" && row.problem_count === 1 &&
      row.readiness_payload.ingredients.some((item) => item.sourceKey === "falafel" && item.productId === audit.product_id && item.ready) &&
      row.readiness_payload.ingredients.some((item) => item.sourceKey === "pitabroodjes" && item.reason === "no_catalog_product"));
  log({ ...audit, source_price: product.price, e2e_passed: Boolean(success) });
  requireThat(success, "e2e-post-validation-failed-stop-no-replay");
  return audit;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.includes("--validate-input")) validateInput(process.env);
    else await runFalafelE2E();
  } catch (error) {
    // Never print arbitrary network/DB/source exceptions, response bodies or credentials.
    console.error(error instanceof E2EError ? error.message : "falafel-e2e-failed-stop-no-replay");
    process.exitCode = 1;
  }
}
