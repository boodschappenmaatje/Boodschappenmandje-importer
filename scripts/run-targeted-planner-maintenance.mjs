import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { readFile, appendFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";

const execFile = promisify(execFileCallback);

export const TARGET_SOURCE = "final_batch3";
export const TARGET_CSV = "data/hoogvliet-missing-production-2026-10-08-final.csv";
export const TARGET_CSV_SHA256 = "d5c43b501d4dfbf2498d1765340b354b4b487d47806c0b8683dcfcb748025dd5";
export const TARGET_COUNT = 12;
export const TARGET_CONFIRMATION = "RUN_TARGETED_MAINTENANCE";
export const PRODUCTION_PLANNER_ORIGIN = "https://boodschappenmaatje-pwa.vercel.app";
export const PRODUCTION_SUPABASE_PROJECT = "pjcqxufvbkkjehituzxz";
export const PRODUCTION_POOLER_HOST = "aws-1-eu-west-1.pooler.supabase.com";
export const PRODUCTION_POOLER_PORT = "5432";
export const PLANNER_PATH = "/api/internal/planner-readiness/new-products";
const TIME_ZONE = "Europe/Amsterdam";
const DAILY_START_HOUR = 6;
const DAILY_END_HOUR = 23;
const PAGE_SIZE = 1000;
const MAX_ROWS = 20_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SKU = /^\d{9}$/;

function fail(message) {
  throw new Error(message);
}

function requireText(value, message) {
  if (typeof value !== "string" || !value.trim()) fail(message);
  return value.trim();
}

export function validateRunnerConfig(env = process.env) {
  if (String(env.GITHUB_EVENT_NAME ?? "").trim() !== "workflow_dispatch") {
    fail("Alleen workflow_dispatch is toegestaan.");
  }
  if (String(env.GITHUB_REPOSITORY ?? "").trim() !== "boodschappenmaatje/Boodschappenmandje-importer") {
    fail("Onverwachte repository.");
  }
  if (String(env.GITHUB_REF ?? "").trim() !== "refs/heads/main") {
    fail("Targeted maintenance mag alleen vanaf main draaien.");
  }
  if (String(env.TARGETED_SOURCE ?? "").trim() !== TARGET_SOURCE) {
    fail("Alleen de vaste final_batch3-bron is toegestaan.");
  }
  if (String(env.TARGETED_CONFIRM ?? "").trim() !== TARGET_CONFIRMATION) {
    fail("De expliciete targeted-maintenance bevestiging ontbreekt.");
  }

  const supabaseURL = requireText(env.SUPABASE_URL, "SUPABASE_URL ontbreekt.");
  const supabaseSecret = requireText(env.SUPABASE_SECRET_KEY, "SUPABASE_SECRET_KEY ontbreekt.");
  const adminToken = requireText(env.PLANNER_CACHE_ADMIN_TOKEN, "PLANNER_CACHE_ADMIN_TOKEN ontbreekt.");
  const bypassSecret = requireText(env.VERCEL_AUTOMATION_BYPASS_SECRET,
    "VERCEL_AUTOMATION_BYPASS_SECRET ontbreekt.");
  const dbPassword = requireText(env.SUPABASE_DB_PASSWORD, "SUPABASE_DB_PASSWORD ontbreekt.");
  let supabaseOrigin;
  try {
    supabaseOrigin = new URL(supabaseURL);
  } catch {
    fail("SUPABASE_URL is ongeldig.");
  }
  if (supabaseOrigin.protocol !== "https:" || supabaseOrigin.username || supabaseOrigin.password ||
      supabaseOrigin.search || supabaseOrigin.hash) {
    fail("SUPABASE_URL moet een veilige HTTPS-origin zijn.");
  }
  const plannerBase = String(env.PLANNER_CACHE_BASE_URL ?? PRODUCTION_PLANNER_ORIGIN).trim();
  let plannerOrigin;
  try {
    plannerOrigin = new URL(plannerBase);
  } catch {
    fail("PLANNER_CACHE_BASE_URL is ongeldig.");
  }
  if (plannerOrigin.origin !== PRODUCTION_PLANNER_ORIGIN || plannerOrigin.pathname !== "/" ||
      plannerOrigin.username || plannerOrigin.password || plannerOrigin.search || plannerOrigin.hash) {
    fail("Planner-origin moet exact Production zijn.");
  }
  if (/\s/.test(adminToken) || /\s/.test(bypassSecret)) fail("Planner-secretformaat is ongeldig.");
  return { supabaseURL: supabaseOrigin, supabaseSecret, adminToken, bypassSecret, dbPassword,
    plannerURL: new URL(PLANNER_PATH, plannerOrigin) };
}

function firstCSVField(line) {
  let field = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (quoted) {
      if (char === '"' && line[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") break;
    else field += char;
  }
  if (quoted) fail("Final CSV bevat een onafgesloten quote.");
  return field.trim();
}

export function parseTargetSKUs(text) {
  if (typeof text !== "string" || !text.trim()) fail("Final CSV ontbreekt.");
  const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
  if (lines.length < 2 || firstCSVField(lines[0]).replace(/^\uFEFF/, "").toLowerCase() !== "sku") {
    fail("Final CSV heeft geen geldige SKU-header.");
  }
  const skus = lines.slice(1).map(firstCSVField);
  if (skus.length !== TARGET_COUNT || skus.some(sku => !SKU.test(sku)) || new Set(skus).size !== TARGET_COUNT) {
    fail(`Final CSV moet exact ${TARGET_COUNT} unieke SKU's bevatten.`);
  }
  if (skus.includes("727643000")) fail("Uitgesloten not_found-SKU staat in de final input.");
  return skus;
}

async function readTargetSKUs(readFileImpl = readFile) {
  const bytes = await readFileImpl(TARGET_CSV);
  if (createHash("sha256").update(bytes).digest("hex") !== TARGET_CSV_SHA256) {
    fail("Final CSV SHA-256 wijkt af; maintenance geweigerd.");
  }
  return parseTargetSKUs(bytes.toString("utf8"));
}

function apiURL(base, table, select) {
  const url = new URL(`/rest/v1/${table}`, base);
  url.searchParams.set("select", select);
  return url;
}

function dbHeaders(secret) {
  const headers = { apikey: secret, Accept: "application/json" };
  // Match the existing Supabase client convention: modern sb_secret keys are
  // API keys, while only legacy service-role JWTs are also Bearer tokens.
  if (secret.startsWith("eyJ")) headers.Authorization = `Bearer ${secret}`;
  return headers;
}

async function readJSON(fetchImpl, url, options, label) {
  let response;
  try {
    response = await fetchImpl(url, { ...options, redirect: "manual", signal: AbortSignal.timeout(30_000) });
  } catch {
    fail(`Read-only ${label} netwerkfout.`);
  }
  if (!response.ok) fail(`Read-only ${label} faalde (HTTP ${response.status}).`);
  try {
    return await response.json();
  } catch {
    fail(`Read-only ${label} gaf onleesbare JSON.`);
  }
}

async function fetchRows(fetchImpl, settings, table, select, { filters = {}, order = null } = {}) {
  const url = apiURL(settings.supabaseURL, table, select);
  if (order) url.searchParams.set("order", order);
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
  const rows = await readJSON(fetchImpl, url, { method: "GET", headers: dbHeaders(settings.supabaseSecret) }, table);
  if (!Array.isArray(rows)) fail(`Read-only ${table} gaf geen rijlijst.`);
  return rows;
}

async function fetchAllRows(fetchImpl, settings, table, select, order) {
  const rows = [];
  for (let offset = 0; offset < MAX_ROWS; offset += PAGE_SIZE) {
    const url = apiURL(settings.supabaseURL, table, select);
    url.searchParams.set("order", order);
    const page = await readJSON(fetchImpl, url, {
      method: "GET",
      headers: { ...dbHeaders(settings.supabaseSecret), Range: `${offset}-${offset + PAGE_SIZE - 1}` },
    }, `${table}-page`);
    if (!Array.isArray(page)) fail(`Read-only ${table} gaf geen rijlijst.`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
  fail(`Read-only ${table} overschrijdt de veilige grens.`);
}

function amsterdamParts(now) {
  return Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23",
  }).formatToParts(now).map(({ type, value }) => [type, value]));
}

export function currentAmsterdamDate(now = new Date()) {
  const parts = amsterdamParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function currentAmsterdamHour(now = new Date()) {
  return Number(amsterdamParts(now).hour);
}

export function isCurrentRetryClaimable(job, now = new Date()) {
  if (job?.status !== "retry_scheduled" || String(job.job_date) !== currentAmsterdamDate(now)) return false;
  if (currentAmsterdamHour(now) < DAILY_START_HOUR || currentAmsterdamHour(now) >= DAILY_END_HOUR) return false;
  if (Number(job.new_products_collected) >= Number(job.target_new_products) || job.status === "target_reached") return false;
  const retryAt = Date.parse(job.next_retry_at ?? "");
  return !Number.isFinite(retryAt) || retryAt <= now.getTime();
}

export async function readAdvisoryLockCount(settings, execFileImpl = execFile) {
  const query = "select count(*)::bigint from pg_locks where locktype = 'advisory' and granted;";
  try {
    const result = await execFileImpl("psql", [
      "--host", PRODUCTION_POOLER_HOST, "--port", PRODUCTION_POOLER_PORT,
      "--username", `postgres.${PRODUCTION_SUPABASE_PROJECT}`, "--dbname", "postgres",
      "--no-psqlrc", "--tuples-only", "--no-align", "--command", query,
    ], { env: { ...process.env, PGPASSWORD: settings.dbPassword, PGSSLMODE: "require" }, timeout: 15_000,
      maxBuffer: 1024 });
    const value = String(result.stdout ?? "").trim();
    if (!/^\d+$/.test(value)) fail("Advisory-lock read gaf geen veilige telling.");
    return Number(value);
  } catch {
    fail("Advisory-lock read-only precheck kon niet worden uitgevoerd.");
  }
}

function duplicateSKUGroupCount(products) {
  const counts = new Map();
  for (const product of products) {
    const key = `${product.supermarket}\u0000${product.sku}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.values()].filter(count => count > 1).length;
}

async function catalogSnapshot(fetchImpl, settings) {
  const [products, prices] = await Promise.all([
    fetchAllRows(fetchImpl, settings, "products", "id,sku,supermarket", "id.asc"),
    fetchAllRows(fetchImpl, settings, "product_prices", "product_id,price", "product_id.asc"),
  ]);
  return { products, prices, productCount: products.length, priceCount: prices.length,
    duplicateSKUGroups: duplicateSKUGroupCount(products) };
}

async function concurrencySnapshot(fetchImpl, settings, now, execFileImpl) {
  const [jobs, attempts, imports, advisoryLocks] = await Promise.all([
    fetchRows(fetchImpl, settings, "catalog_daily_jobs",
      "id,status,job_date,next_retry_at,new_products_collected,target_new_products,lock_token,lock_expires_at"),
    fetchRows(fetchImpl, settings, "catalog_daily_attempts", "id,status", { filters: { status: "eq.running" } }),
    fetchRows(fetchImpl, settings, "catalog_import_runs", "id,status,finished_at",
      { filters: { status: "eq.running", finished_at: "is.null" } }),
    readAdvisoryLockCount(settings, execFileImpl),
  ]);
  const activeLocks = jobs.filter(job => {
    if (!job.lock_token) return false;
    if (!job.lock_expires_at) return true;
    const expiry = Date.parse(job.lock_expires_at);
    return !Number.isFinite(expiry) || expiry > now.getTime();
  });
  const retryScheduled = jobs.filter(job => job.status === "retry_scheduled");
  const currentRetryClaimable = retryScheduled.filter(job => isCurrentRetryClaimable(job, now));
  const result = {
    runningDailyJobs: jobs.filter(job => job.status === "running").length,
    runningAttempts: attempts.length,
    runningCatalogImports: imports.length,
    activeImporterLocks: activeLocks.length,
    grantedAdvisoryLocks: advisoryLocks,
    retryScheduled: retryScheduled.length,
    currentRetryClaimable: currentRetryClaimable.length,
  };
  if (result.runningDailyJobs || result.runningAttempts || result.runningCatalogImports ||
      result.activeImporterLocks || result.grantedAdvisoryLocks || result.currentRetryClaimable) {
    fail(`Concurrente Production-activiteit gevonden: ${JSON.stringify({
      runningDailyJobs: result.runningDailyJobs, runningAttempts: result.runningAttempts,
      runningCatalogImports: result.runningCatalogImports, activeImporterLocks: result.activeImporterLocks,
      grantedAdvisoryLocks: result.grantedAdvisoryLocks, currentRetryClaimable: result.currentRetryClaimable,
    })}`);
  }
  return result;
}

function targetProducts(snapshot, skus) {
  const bySKU = new Map(snapshot.products.filter(product => product.supermarket === "Hoogvliet")
    .map(product => [String(product.sku), product]));
  const products = skus.map(sku => bySKU.get(sku)).filter(Boolean);
  if (products.length !== TARGET_COUNT || new Set(products.map(product => product.id)).size !== TARGET_COUNT ||
      products.some(product => !UUID.test(String(product.id)))) {
    fail(`Production bevat niet exact ${TARGET_COUNT} unieke final product-ID's.`);
  }
  const prices = new Map(snapshot.prices.map(price => [String(price.product_id), price]));
  if (products.some(product => !prices.has(String(product.id)) ||
      !Number.isFinite(Number(prices.get(String(product.id)).price)) || Number(prices.get(String(product.id)).price) <= 0)) {
    fail("Niet alle final producten hebben een positieve Production-prijs.");
  }
  return products.map(product => String(product.id));
}

async function plannerLinkedCache(fetchImpl, settings, productIds, result) {
  const matches = await fetchRows(fetchImpl, settings, "ingredient_product_matches",
    "match_key,product_id,match_status,refresh_status", { filters: { product_id: `in.(${productIds.join(",")})` } });
  const affectedRecipeIds = Array.isArray(result.affectedRecipeIds) ? result.affectedRecipeIds : [];
  if (affectedRecipeIds.some(id => typeof id !== "string" || !UUID.test(id))) fail("Endpoint gaf onverwachte recipe-ID's.");
  const readiness = affectedRecipeIds.length === 0 ? [] : await fetchRows(fetchImpl, settings, "recipe_readiness_cache",
    "recipe_id,people_count,refresh_status", {
      filters: { recipe_id: `in.(${affectedRecipeIds.join(",")})`, people_count: "gte.1" },
    });
  return { linkedMatchRows: matches.length, affectedReadinessRows: readiness.length };
}

export async function runTargetedPlannerMaintenance(env = process.env, dependencies = {}) {
  const settings = validateRunnerConfig(env);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const readFileImpl = dependencies.readFileImpl ?? readFile;
  const execFileImpl = dependencies.execFileImpl ?? execFile;
  const now = dependencies.now instanceof Date ? dependencies.now : new Date();
  const skus = await readTargetSKUs(readFileImpl);
  const beforeCatalog = await catalogSnapshot(fetchImpl, settings);
  const beforeConcurrency = await concurrencySnapshot(fetchImpl, settings, now, execFileImpl);
  const productIds = targetProducts(beforeCatalog, skus);

  let postCount = 0;
  let response;
  try {
    if (postCount !== 0) fail("Targeted maintenance POST-guard geblokkeerd.");
    postCount += 1;
    response = await fetchImpl(settings.plannerURL, {
      method: "POST",
      redirect: "manual",
      signal: AbortSignal.timeout(65_000),
      headers: {
        authorization: `Bearer ${settings.adminToken}`,
        "content-type": "application/json",
        accept: "application/json",
        "x-vercel-protection-bypass": settings.bypassSecret,
      },
      body: JSON.stringify({ productIds }),
    });
  } catch {
    fail("Targeted planner-maintenance POST faalde; geen retry uitgevoerd.");
  }
  if (!response.ok) fail(`Targeted planner-maintenance gaf HTTP ${response.status}; geen retry uitgevoerd.`);
  let result;
  try { result = await response.json(); } catch { fail("Targeted planner-maintenance gaf onleesbare JSON."); }
  if (!result || result.productCount !== TARGET_COUNT || !Array.isArray(result.changedMatchKeys) ||
      !Array.isArray(result.affectedRecipeIds) || !Number.isInteger(result.refreshedReadinessCount) ||
      result.refreshedReadinessCount < 0 || Object.keys(result).some(key =>
        ["fullRebuild", "full_rebuild", "allProductIds", "all_product_ids"].includes(key))) {
    fail("Targeted planner-maintenance response voldoet niet aan het bestaande contract.");
  }
  if (result.affectedRecipeIds.some(id => typeof id !== "string" || !UUID.test(id))) {
    fail("Targeted planner-maintenance gaf onverwachte recipe-ID's.");
  }

  const cache = await plannerLinkedCache(fetchImpl, settings, productIds, result);
  const afterCatalog = await catalogSnapshot(fetchImpl, settings);
  const afterConcurrency = await concurrencySnapshot(fetchImpl, settings, now, execFileImpl);
  if (afterCatalog.productCount !== beforeCatalog.productCount || afterCatalog.priceCount !== beforeCatalog.priceCount ||
      afterCatalog.duplicateSKUGroups !== beforeCatalog.duplicateSKUGroups || afterCatalog.duplicateSKUGroups !== 0 ||
      afterConcurrency.grantedAdvisoryLocks !== 0 || afterConcurrency.activeImporterLocks !== 0 ||
      afterConcurrency.runningDailyJobs !== 0 || afterConcurrency.runningAttempts !== 0 ||
      afterConcurrency.runningCatalogImports !== 0) {
    fail("Read-only nacontrole detecteerde onverwachte catalogus- of importerwijziging.");
  }
  const summary = {
    status: "confirmed", source: TARGET_SOURCE, requestedProducts: TARGET_COUNT, postCount,
    productCount: afterCatalog.productCount, priceCount: afterCatalog.priceCount,
    duplicateSKUGroups: afterCatalog.duplicateSKUGroups, changedMatchKeys: result.changedMatchKeys.length,
    affectedRecipeIds: result.affectedRecipeIds.length, refreshedReadinessCount: result.refreshedReadinessCount,
    linkedMatchRows: cache.linkedMatchRows, affectedReadinessRows: cache.affectedReadinessRows,
    beforeConcurrency, afterConcurrency,
  };
  if (env.GITHUB_STEP_SUMMARY) {
    const report = ["## Targeted planner maintenance", "", "```json", JSON.stringify(summary, null, 2), "```", ""].join("\n");
    await appendFile(env.GITHUB_STEP_SUMMARY, report, "utf8");
  }
  return summary;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runTargetedPlannerMaintenance().then(result => console.log(JSON.stringify(result)))
    .catch(error => { console.error(error instanceof Error ? error.message : "Targeted maintenance failed."); process.exitCode = 1; });
}
