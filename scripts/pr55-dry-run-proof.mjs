import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { loadConfig } from "../src/config.mjs";
import { fetchExistingProducts, fetchExistingPriceStates, fetchRunningCatalogDailyJobs, requestHeaders } from "../src/supabase.mjs";

const csvPath = "hoogvliet-missing-production-2026-10-06.csv";
const expectedHash = "a24da369b15d4ddf0d8741f7aeb4d3fee2f733e74e2d448ec1ffcd1b8ab30246";
const secret = process.env.SUPABASE_SECRET_KEY;
const config = loadConfig({ ...process.env, DRY_RUN: "1", UPDATE_MODE: "growth", CATALOG_BATCH: "growth" });
if (!config.supabaseURL || !secret) throw new Error("Supabase read-only proof configuration missing");

function parseCSV(text) {
  const rows = []; let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field.length === 0) quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(v => String(v).trim() !== ""));
}
function headerKey(s) { return String(s).replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[^a-z0-9]+/g, ""); }
async function readSource() {
  const bytes = await readFile(csvPath);
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== expectedHash) throw new Error("Original CSV checksum mismatch");
  const rows = parseCSV(bytes.toString("utf8"));
  const heads = rows[0].map(headerKey);
  const ix = Object.fromEntries(["sku","productnaam","categorie","producturl"].map(k => [k, heads.indexOf(k)]));
  if (Object.values(ix).some(i => i < 0) || rows.length !== 813) throw new Error("CSV shape mismatch");
  const products = rows.slice(1).map(r => ({ sku:r[ix.sku], name:r[ix.productnaam], category:r[ix.categorie], url:r[ix.producturl] }));
  const skus = products.map(p => p.sku);
  if (skus.some(s => !s) || new Set(skus).size !== 812) throw new Error("Expected 812 non-empty unique SKUs");
  return { products, hash };
}
async function exactCount(table, filters = "") {
  const base = config.supabaseURL.replace(/\/$/, "");
  const url = new URL(`${base}/rest/v1/${table}?select=id&limit=1${filters}`);
  const response = await fetch(url, { method:"GET", headers:{ ...requestHeaders(secret, "count=exact"), Range:"0-0" } });
  if (!response.ok) throw new Error(`read_only_count_failed:${table}:${response.status}`);
  const value = response.headers.get("content-range")?.split("/").at(-1);
  if (!value || value === "*") throw new Error(`count_unavailable:${table}`);
  return Number(value);
}
async function readStatuses(table) {
  const base = config.supabaseURL.replace(/\/$/, "");
  const rows = [];
  for (let offset = 0; offset < 20_000; offset += 1000) {
    const url = new URL(`${base}/rest/v1/${table}?select=status&limit=1000`);
    const response = await fetch(url, { method:"GET", headers:{ ...requestHeaders(secret, "count=exact"), Range:`${offset}-${offset+999}` } });
    if (!response.ok) throw new Error(`read_only_statuses_failed:${table}:${response.status}`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`invalid_status_rows:${table}`);
    rows.push(...page);
    if (page.length < 1000) return rows.map(row=>row.status);
  }
  throw new Error(`status_read_safety_limit:${table}`);
}
async function snapshot() {
  const [products, priceStates, totalProducts, totalPrices, totalRuns, runStatuses, totalAttempts, attemptStatuses, dailyJobs, dailyStatuses] = await Promise.all([
    fetchExistingProducts(config, { supermarketFilter:"ilike.Hoogvliet" }),
    fetchExistingPriceStates(config),
    exactCount("products"),
    exactCount("product_prices"),
    exactCount("catalog_import_runs"),
    readStatuses("catalog_import_runs"),
    exactCount("catalog_daily_attempts"),
    readStatuses("catalog_daily_attempts"),
    fetchRunningCatalogDailyJobs(config),
    readStatuses("catalog_daily_jobs"),
  ]);
  const csv = await readSource();
  const firstTen = csv.products.slice(0,10);
  const skuSet = new Set(products.map(p=>p.sku).filter(Boolean));
  const activeRuns = runStatuses.filter(status=>status==="running").length;
  const activeAttempts = attemptStatuses.filter(status=>status==="running").length;
  const activeDaily = dailyStatuses.filter(status=>["running","retry_scheduled"].includes(status)).length;
  return {
    product_records:totalProducts, unique_hoogvliet_skus:skuSet.size, price_records:totalPrices,
    price_states:priceStates.size, catalog_import_runs:totalRuns, running_catalog_imports:activeRuns,
    daily_attempts:totalAttempts, running_daily_attempts:activeAttempts,
    running_or_retry_scheduled_daily_jobs:activeDaily, running_daily_jobs:dailyJobs.length,
    first_10_skus:firstTen.map(p=>p.sku),
    first_10_present:firstTen.filter(p=>skuSet.has(p.sku)).map(p=>p.sku),
  };
}
async function verifyCSV() {
  const { products, hash } = await readSource();
  console.log(JSON.stringify({ original_csv:true, sha256:hash, input_skus:products.length, unique_skus:new Set(products.map(p=>p.sku)).size, empty_skus:products.filter(p=>!p.sku).length, first_10:products.slice(0,10).map(p=>p.sku) },null,2));
}
const mode=process.argv[2];
if (mode==="verify") await verifyCSV();
else if (mode==="before") {
  const data=await snapshot();
  if (data.running_catalog_imports || data.running_daily_attempts || data.running_or_retry_scheduled_daily_jobs) throw new Error("FAIL_SAFE_active_import_or_daily_job");
  await writeFile("pr55-dry-run-before.json", JSON.stringify(data,null,2));
  console.log("PRODUCTION_BEFORE="+JSON.stringify(data));
} else if (mode==="after") {
  const log=await readFile(process.argv[3],"utf8");
  const marker='{\n  "mode": "dry_run"';
  const pos=log.lastIndexOf(marker);
  if(pos<0) throw new Error("dry_run_result_json_missing");
  const result=JSON.parse(log.slice(pos+1).trim());
  const {products,hash}=await readSource();
  const before=JSON.parse(await readFile("pr55-dry-run-before.json","utf8"));
  const after=await snapshot();
  const selected=products.slice(0,10);
  const bySku=new Map(selected.map(p=>[p.sku,p]));
  const results=(result.results??[]).filter(r=>r.status!=="skipped").map(r=>{
    const source=bySku.get(r.sku);
    return {sku:r.sku,status:r.status==="valid"?"valid_new":r.status,product_name:source?.name??null,price:r.price??null,detail_url:source?.url??null,category:source?.category??null,error_classification:r.reason??r.error_code??null};
  });
  const counts={valid_new:results.filter(r=>r.status==="valid_new").length,already_exists:results.filter(r=>r.status==="already_exists").length,invalid:results.filter(r=>r.status==="invalid").length,not_found:results.filter(r=>r.status==="not_found").length,temporary_error:results.filter(r=>r.status==="temporary_error").length};
  const noWrites=before.product_records===after.product_records && before.price_records===after.price_records && before.catalog_import_runs===after.catalog_import_runs && before.daily_attempts===after.daily_attempts && JSON.stringify(before.first_10_present)===JSON.stringify(after.first_10_present);
  const pass=hash===expectedHash && result.mode==="dry_run" && result.input_rows===812 && result.unique_input_skus===812 && result.requested===10 && result.processed===10 && results.length===10 && result.imported===0 && counts.temporary_error===0 && noWrites;
  const report={releasegate_pass:pass,proof_scope:"explicit CSV only; no root catalog crawl, category queue, listing pagination, or discovery is invoked by import:skus",command:"npm run import:skus -- --file hoogvliet-missing-production-2026-10-06.csv --max 10 --dry-run",csv_sha256:hash,input_skus:812,unique_input_skus:812,processed:results.length,counts,products:results,production_before:before,production_after:after,product_writes:0,price_writes:0,catalog_import_run_writes:after.catalog_import_runs-before.catalog_import_runs,read_only_fetch_guard:"GET only"};
  await writeFile("pr55-dry-run-proof.json",JSON.stringify(report,null,2));
  console.log("DRY_RUN_REPORT="+JSON.stringify(report,null,2));
  if(!pass) throw new Error("PR55_DRY_RUN_RELEASEGATE_FAIL");
} else throw new Error("expected verify, before, or after");
