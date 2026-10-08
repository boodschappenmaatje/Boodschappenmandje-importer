import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { appendFileSync } from "node:fs";
import { spawn } from "node:child_process";

const repoRoot = process.cwd();
const inputPath = "hoogvliet-missing-production-2026-10-06.csv";
const expectedCsvSha = "a24da369b15d4ddf0d8741f7aeb4d3fee2f733e74e2d448ec1ffcd1b8ab30246";
const artifactDir = "artifacts/pr55-400-readonly-proof";
const urlBase = (process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const secret = process.env.SUPABASE_SECRET_KEY || "";
if (!urlBase || !secret) throw new Error("Supabase read-only proof configuration missing.");
if (!/^https:\/\//.test(urlBase)) throw new Error("Supabase URL must use HTTPS.");

function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  text = text.replace(/^\uFEFF/, "");
  for (let i = 0; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i += 1; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field.length === 0) quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (quoted) throw new Error("Missing CSV has unterminated quote.");
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim() !== ""));
}
function norm(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
async function supabaseRows(table, select, filters = {}, from = 0, to = 999, order = "") {
  const url = new URL(urlBase + "/rest/v1/" + table);
  url.searchParams.set("select", select);
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
  if (order) url.searchParams.set("order", order);
  const headers = { apikey: secret, Accept: "application/json", Range: from + "-" + to };
  if (secret.startsWith("eyJ")) headers.Authorization = "Bearer " + secret;
  const response = await fetch(url, { method: "GET", headers });
  if (!response.ok) throw new Error("Read-only Supabase GET failed for " + table + " with HTTP " + response.status);
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error("Unexpected Supabase response for " + table);
  return data;
}
async function allRows(table, select, order) {
  const rows = [];
  for (let from = 0; from < 20000; from += 1000) {
    const page = await supabaseRows(table, select, {}, from, from + 999, order);
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
  throw new Error("Safety page limit reached while reading " + table);
}
function hashRows(rows) {
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
function duplicateGroups(rows) {
  const counts = new Map();
  for (const row of rows) {
    if (row.supermarket !== "Hoogvliet" || typeof row.sku !== "string" || !row.sku.trim()) continue;
    counts.set(row.sku, (counts.get(row.sku) || 0) + 1);
  }
  return [...counts.values()].filter(count => count > 1).length;
}
async function snapshot(candidateSkus) {
  const products = await allRows("products",
    "id,sku,supermarket,name,brand,category,package_text,weight_grams,image_url,source_url,is_available,created_at,updated_at,product_type",
    "id.asc");
  const prices = await allRows("product_prices",
    "product_id,price,old_price,is_offer,offer_text,valid_from,valid_until,fetched_at,updated_at",
    "product_id.asc");
  const runs = await allRows("catalog_import_runs", "id,status", "id.asc");
  const dailyJobs = await allRows("catalog_daily_jobs", "id,status,lock_expires_at", "id.asc");
  const attempts = await allRows("catalog_daily_attempts", "daily_job_id,attempt_number,status", "daily_job_id.asc,attempt_number.asc");
  const skuRows = products.filter(row => row.supermarket === "Hoogvliet" && typeof row.sku === "string" && row.sku.trim());
  const skuSet = new Set(skuRows.map(row => row.sku));
  const activeRuns = runs.filter(row => row.status === "running");
  const activeDailyJobs = dailyJobs.filter(row => row.status === "running");
  const activeAttempts = attempts.filter(row => row.status === "running");
  const candidatesInProduction = candidateSkus.filter(sku => skuSet.has(sku));
  return {
    product_count: products.length,
    unique_hoogvliet_skus: skuSet.size,
    duplicate_sku_groups: duplicateGroups(products),
    records_without_usable_sku: products.filter(row => row.supermarket === "Hoogvliet" && !(typeof row.sku === "string" && row.sku.trim())).length,
    price_count: prices.length,
    catalog_import_runs: runs.length,
    active_catalog_import_runs: activeRuns.length,
    active_daily_jobs: activeDailyJobs.length,
    active_daily_attempts: activeAttempts.length,
    selected_skus_already_in_production: candidatesInProduction.length,
    selected_sku_membership: candidatesInProduction.sort(),
    products_sha256: hashRows(products),
    prices_sha256: hashRows(prices),
    catalog_import_runs_sha256: hashRows(runs),
    daily_jobs_sha256: hashRows(dailyJobs),
    daily_attempts_sha256: hashRows(attempts),
  };
}
function balancedJSON(text, start) {
  let depth = 0, quoted = false, escaped = false;
  for (let i = start; i < text.length; i += 1) {
    const c = text[i];
    if (quoted) {
      if (escaped) escaped = false;
      else if (c === "\\") escaped = true;
      else if (c === '"') quoted = false;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === "{") depth += 1;
    else if (c === "}") {
      depth -= 1;
      if (depth === 0) return JSON.parse(text.slice(start, i + 1));
    }
  }
  return null;
}
function resultObject(log) {
  const matches = [...log.matchAll(/"mode"\s*:\s*"dry_run"/g)];
  for (let n = matches.length - 1; n >= 0; n -= 1) {
    const start = log.lastIndexOf("{", matches[n].index);
    if (start < 0) continue;
    try {
      const parsed = balancedJSON(log, start);
      if (parsed && Array.isArray(parsed.results)) return parsed;
    } catch {}
  }
  return null;
}
function summarizeCSVRows(rows) {
  const headers = rows[0].map(norm);
  const idx = name => headers.indexOf(norm(name));
  const skuIdx = idx("sku"), nameIdx = idx("productnaam"), urlIdx = idx("product_url");
  const categoryIdx = idx("categorie"), packageIdx = idx("verpakkingsinfo"), priceIdx = idx("getoonde_prijs");
  if ([skuIdx, nameIdx, urlIdx].some(n => n < 0)) throw new Error("Original CSV required columns are missing.");
  const data = rows.slice(1);
  const seen = new Set();
  for (const row of data) {
    const sku = String(row[skuIdx] || "").trim();
    if (!sku || seen.has(sku)) throw new Error("Missing CSV has blank or duplicate SKU.");
    seen.add(sku);
  }
  const selected = data.slice(0, 400).map(row => ({
    sku: String(row[skuIdx]).trim(),
    product_name: row[nameIdx] || null,
    product_url: row[urlIdx] || null,
    category: categoryIdx >= 0 ? row[categoryIdx] || null : null,
    input_package: packageIdx >= 0 ? row[packageIdx] || null : null,
    input_price: priceIdx >= 0 && row[priceIdx] !== "" ? Number(row[priceIdx]) : null,
  }));
  return { inputRows: data.length, unique: seen.size, selected };
}
function runCommand() {
  return new Promise(resolve => {
    const args = ["run", "import:skus", "--", "--file", inputPath, "--max", "400", "--dry-run"];
    const commandText = "npm " + args.join(" ");
    console.log("EXECUTING EXACT READ-ONLY COMMAND: " + commandText);
    const child = spawn("npm", args, { cwd: repoRoot, env: process.env, stdio: ["ignore", "pipe", "pipe"] });
    const chunks = [];
    child.stdout.on("data", chunk => { process.stdout.write(chunk); chunks.push(chunk); });
    child.stderr.on("data", chunk => { process.stderr.write(chunk); chunks.push(chunk); });
    child.on("error", error => resolve({ exitCode: 1, output: Buffer.concat(chunks).toString("utf8"), spawnError: error.message }));
    child.on("close", code => resolve({ exitCode: code ?? 1, output: Buffer.concat(chunks).toString("utf8"), spawnError: null }));
  });
}

await mkdir(artifactDir, { recursive: true });
const csv = await readFile(inputPath);
const csvHash = createHash("sha256").update(csv).digest("hex");
if (csvHash !== expectedCsvSha) throw new Error("Original 812-SKU CSV checksum mismatch.");
const csvRows = summarizeCSVRows(parseCsv(csv.toString("utf8")));
if (csvRows.inputRows !== 812 || csvRows.unique !== 812 || csvRows.selected.length !== 400) {
  throw new Error("Original missing-set must be exactly 812 unique SKUs; batch selection must be 400.");
}
if (csvRows.selected[0].sku !== "000685000") throw new Error("Leading zero preservation check failed.");
const candidateSkus = csvRows.selected.map(row => row.sku);
const before = await snapshot(candidateSkus);
await writeFile(artifactDir + "/production-before.json", JSON.stringify(before, null, 2) + "\n");
if (before.active_catalog_import_runs || before.active_daily_jobs || before.active_daily_attempts) {
  const failed = {
    gate: "FAIL_SAFE_ACTIVE_IMPORT",
    requested: 400,
    processed: 0,
    csv_sha256: csvHash,
    csv_input_rows: csvRows.inputRows,
    csv_unique_skus: csvRows.unique,
    before,
    command_started: false,
    broad_discovery_started: false,
  };
  await writeFile(artifactDir + "/proof-report.json", JSON.stringify(failed, null, 2) + "\n");
  throw new Error("Read-only dry-run refused: an active import/run/attempt exists.");
}
const started = Date.now();
const run = await runCommand();
const durationMs = Date.now() - started;
await writeFile(artifactDir + "/import-command.log", run.output);
const after = await snapshot(candidateSkus);
await writeFile(artifactDir + "/production-after.json", JSON.stringify(after, null, 2) + "\n");
const parsed = resultObject(run.output);
const guardLogPath = "/tmp/pr55-blocked-write-attempts.log";
let blockedWrites = [];
try {
  blockedWrites = (await readFile(guardLogPath, "utf8")).split("\n").filter(Boolean);
} catch {}
const results = parsed?.results ?? [];
const counts = {
  valid_new: results.filter(item => item.classification === "valid_new" || item.status === "valid").length,
  already_exists: results.filter(item => item.status === "already_exists").length,
  invalid: results.filter(item => item.status === "invalid").length,
  not_found: results.filter(item => item.status === "not_found").length,
  temporary_error: results.filter(item => item.status === "temporary_error").length,
  skipped: results.filter(item => item.status === "skipped").length,
};
const inputBySKU = new Map(csvRows.selected.map(row => [row.sku, row]));
const itemResults = results.map(item => {
  const source = inputBySKU.get(item.sku) || {};
  return {
    sku: item.sku,
    status: item.status,
    classification: item.classification || (item.status === "valid" ? "valid_new" : item.status),
    reason: item.reason || item.error_code || null,
    current_price_eur: Number.isFinite(Number(item.price)) ? Number(item.price) : null,
    input_product_name: source.product_name || null,
    category: source.category || null,
    product_url: source.product_url || null,
    input_package: source.input_package || null,
    input_price_eur: source.input_price,
    source_row: item.source_row || null,
  };
});
const validPrices = results.filter(item => item.status === "valid" || item.classification === "valid_new")
  .map(item => Number(item.price)).filter(Number.isFinite);
const importsOnly = new Set(results.map(item => item.sku));
const guardFree = blockedWrites.length === 0;
const snapshotsUnchanged =
  before.product_count === after.product_count &&
  before.price_count === after.price_count &&
  before.catalog_import_runs === after.catalog_import_runs &&
  before.products_sha256 === after.products_sha256 &&
  before.prices_sha256 === after.prices_sha256 &&
  before.catalog_import_runs_sha256 === after.catalog_import_runs_sha256 &&
  before.daily_jobs_sha256 === after.daily_jobs_sha256 &&
  before.daily_attempts_sha256 === after.daily_attempts_sha256 &&
  JSON.stringify(before.selected_sku_membership) === JSON.stringify(after.selected_sku_membership);
const report = {
  proof: "PR #55 explicit SKU 400-row dry-run",
  source_head: process.env.PR55_SOURCE_HEAD || null,
  csv_file: inputPath,
  csv_sha256: csvHash,
  csv_input_rows: csvRows.inputRows,
  csv_unique_skus: csvRows.unique,
  requested: 400,
  processed: parsed?.processed ?? results.length,
  valid_new: counts.valid_new,
  already_exists: counts.already_exists,
  invalid: counts.invalid,
  not_found: counts.not_found,
  temporary_error: counts.temporary_error,
  skipped: counts.skipped,
  result_rows: results.length,
  distinct_result_skus: importsOnly.size,
  broad_discovery_started: false,
  root_category_discovery_started: false,
  listing_pagination_started: false,
  candidate_source: "original proven 812-SKU CSV only",
  command: "npm run import:skus -- --file hoogvliet-missing-production-2026-10-06.csv --max 400 --dry-run",
  command_exit_code: run.exitCode,
  import_runtime_ms: parsed?.runtime_duration_ms ?? null,
  proof_command_runtime_ms: durationMs,
  average_ms_per_processed_sku: parsed?.processed > 0 ? Math.round((parsed.runtime_duration_ms / parsed.processed) * 100) / 100 : null,
  price_guard: {
    valid_new_price_count: validPrices.length,
    minimum_eur: validPrices.length ? Math.min(...validPrices) : null,
    maximum_eur: validPrices.length ? Math.max(...validPrices) : null,
    zero_or_negative_prices: validPrices.filter(price => price <= 0).length,
    missing_prices: results.filter(item => (item.status === "valid" || item.classification === "valid_new") && !(Number(item.price) > 0)).length,
    note: "PR #55 validateCandidate acceptance requires exact SKU, product name, package and valid positive price; dry-run result retains current price.",
  },
  writes: {
    product_writes: 0,
    price_writes: 0,
    blocked_non_get_attempts: blockedWrites,
    full_snapshot_hashes_unchanged: snapshotsUnchanged,
    catalog_import_run_count_before: before.catalog_import_runs,
    catalog_import_run_count_after: after.catalog_import_runs,
  },
  production_before: before,
  production_after: after,
  per_sku: itemResults,
  reason_counts: results.reduce((acc, item) => {
    const code = item.reason || item.error_code || (item.status === "already_exists" ? "already_exists" : item.status);
    if (item.status !== "valid" && item.classification !== "valid_new") acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {}),
};
const totalClassified = counts.valid_new + counts.already_exists + counts.invalid + counts.not_found + counts.temporary_error + counts.skipped;
report.gate = run.exitCode === 0 && parsed?.mode === "dry_run" && parsed?.requested === 400 &&
  parsed?.processed + counts.skipped === 400 && results.length === 400 && importsOnly.size === 400 &&
  totalClassified === 400 && guardFree && snapshotsUnchanged && validPrices.length === counts.valid_new &&
  counts.valid_new === validPrices.length && validPrices.every(price => price > 0)
  ? "PASS_CANDIDATE" : "FAIL";
await writeFile(artifactDir + "/proof-report.json", JSON.stringify(report, null, 2) + "\n");
const summary = [
  "## PR #55 — 400 explicit SKU dry-run",
  "",
  "- Gate: **" + report.gate + "**",
  "- CSV: 812/812 unique; SHA-256 " + csvHash,
  "- Requested / processed: " + report.requested + " / " + report.processed + " (result rows " + results.length + ")",
  "- valid_new / already_exists / invalid / not_found / temporary_error / skipped: " +
    [counts.valid_new, counts.already_exists, counts.invalid, counts.not_found, counts.temporary_error, counts.skipped].join(" / "),
  "- Runtime: " + (report.import_runtime_ms ?? "unknown") + " ms importer; " + durationMs + " ms proof command",
  "- Discovery: none; explicit CSV candidates only",
  "- Production products: " + before.product_count + " → " + after.product_count +
    "; prices: " + before.price_count + " → " + after.price_count +
    "; catalog_import_runs: " + before.catalog_import_runs + " → " + after.catalog_import_runs,
  "- Writes: products 0; prices 0; blocked Node non-GET calls: " + blockedWrites.length,
  "- Snapshot hashes unchanged: " + snapshotsUnchanged,
];
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFile } = await import("node:fs/promises");
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary.join("\n") + "\n");
}
console.log(summary.join("\n"));
if (report.gate !== "PASS_CANDIDATE") process.exitCode = 1;