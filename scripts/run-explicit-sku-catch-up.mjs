import { createHash } from "node:crypto";
import { appendFile, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { parseExplicitSKUCSV } from "../src/explicit-sku-catch-up.mjs";

export const TRUSTED_CSVS = Object.freeze({
  original: Object.freeze({
    path: "data/hoogvliet-missing-production-2026-10-06.csv",
    sha256: "a24da369b15d4ddf0d8741f7aeb4d3fee2f733e74e2d448ec1ffcd1b8ab30246",
    skuCount: 812,
    firstSku: "000685000",
  }),
  residual_batch2: Object.freeze({
    path: "data/hoogvliet-missing-production-2026-10-08-residual.csv",
    sha256: "dd785a974054c257d7c4d2bc6248204ab8fe8e971bd865c16a2c2785b3e57254",
    skuCount: 412,
    firstSku: "697042000",
  }),
  final_batch3: Object.freeze({
    path: "data/hoogvliet-missing-production-2026-10-08-final.csv",
    sha256: "d5c43b501d4dfbf2498d1765340b354b4b487d47806c0b8683dcfcb748025dd5",
    skuCount: 12,
    firstSku: "733574000",
  }),
});
export const TRUSTED_CSV_PATH = TRUSTED_CSVS.original.path;
export const TRUSTED_CSV_SHA256 = TRUSTED_CSVS.original.sha256;
export const TRUSTED_CSV_SKU_COUNT = TRUSTED_CSVS.original.skuCount;
const MAX_BATCH_SIZE = 400;
const PR_READ_ONLY_MAX = 12;

export function resolveRunnerConfig(env = process.env) {
  const event = String(env.RUNNER_EVENT_NAME ?? "").trim();
  const ref = String(env.RUNNER_REF ?? "").trim();
  const rawMode = String(env.RUNNER_MODE ?? "").trim() || "dry-run";
  const rawMax = String(env.RUNNER_MAX ?? "").trim() || "10";
  const rawSource = String(env.RUNNER_SOURCE ?? "").trim() || "original";

  if (!["workflow_dispatch", "pull_request"].includes(event)) {
    throw new Error("Alleen workflow_dispatch en de read-only pull_request-proof zijn toegestaan.");
  }
  if (!["dry-run", "write"].includes(rawMode)) throw new Error("Mode moet dry-run of write zijn.");
  if (!/^[1-9]\d*$/.test(rawMax)) throw new Error("Max moet een positief geheel getal zijn.");
  const max = Number(rawMax);
  if (!Number.isSafeInteger(max) || max < 1 || max > MAX_BATCH_SIZE) {
    throw new Error("Max moet tussen 1 en 400 liggen.");
  }
  if (!Object.hasOwn(TRUSTED_CSVS, rawSource)) {
    throw new Error("Source moet een vaste vertrouwde CSV-keuze zijn.");
  }

  if (event === "pull_request" && (rawMode !== "dry-run" || max !== PR_READ_ONLY_MAX)) {
    throw new Error(`Een pull_request mag uitsluitend de vaste read-only proof met max=${PR_READ_ONLY_MAX} uitvoeren.`);
  }
  if (event === "pull_request" && rawSource !== "final_batch3") {
    throw new Error("Een pull_request mag uitsluitend de vaste final_batch3-bron dry-runnen.");
  }
  if (event === "workflow_dispatch" && ref !== "refs/heads/main") {
    throw new Error("Handmatige importdispatch is alleen toegestaan vanaf main.");
  }
  if (rawMode === "write" && (event !== "workflow_dispatch" || ref !== "refs/heads/main")) {
    throw new Error("Write vereist expliciete workflow_dispatch met mode=write vanaf main.");
  }
  return { event, ref, mode: rawMode, max, source: rawSource };
}

export function buildImporterArgs({ mode, max, source = "original" }) {
  if (!["dry-run", "write"].includes(mode)) throw new Error("Ongeldige importmode.");
  if (!Number.isSafeInteger(max) || max < 1 || max > MAX_BATCH_SIZE) {
    throw new Error("Max moet tussen 1 en 400 liggen.");
  }
  const trusted = TRUSTED_CSVS[source];
  if (!trusted) throw new Error("Source moet een vaste vertrouwde CSV-keuze zijn.");
  return [
    "run", "import:skus", "--", "--file", trusted.path,
    "--max", String(max), mode === "write" ? "--write" : "--dry-run",
  ];
}

export function needsProductionPrecheck(mode) {
  return mode === "write";
}

function restURL(base, table, filters = {}) {
  const url = new URL(`/rest/v1/${table}`, base);
  url.searchParams.set("select", "id");
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
  return url;
}

export async function precheckProductionImportState(env = process.env, {
  fetchImpl = fetch,
  now = Date.now(),
} = {}) {
  const base = String(env.SUPABASE_URL ?? "").trim();
  const key = String(env.SUPABASE_SECRET_KEY ?? "").trim();
  if (!base || !key) throw new Error("Supabase read-only precheck mist vereiste configuratie.");

  const headers = {
    apikey: key,
    Authorization: `Bearer ${key}`,
    Accept: "application/json",
  };
  const requests = [
    ["running_daily_jobs", "catalog_daily_jobs", { status: "eq.running" }],
    ["running_attempts", "catalog_daily_attempts", { status: "eq.running" }],
    ["active_catalog_import_runs", "catalog_import_runs", { status: "eq.running", finished_at: "is.null" }],
    ["daily_lock_rows", "catalog_daily_jobs", { select: "id,lock_expires_at", lock_token: "not.is.null", limit: "101" }],
  ];
  const observations = await Promise.all(requests.map(async ([name, table, filters]) => {
    let response;
    try {
      response = await fetchImpl(restURL(base, table, filters), {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new Error(`Read-only Production-precheck faalde bij ${name}; write geweigerd.`);
    }
    if (!response.ok) throw new Error(`Read-only Production-precheck faalde bij ${name} (HTTP ${response.status}); write geweigerd.`);
    let rows;
    try {
      rows = await response.json();
    } catch {
      throw new Error(`Read-only Production-precheck gaf onleesbare data bij ${name}; write geweigerd.`);
    }
    if (!Array.isArray(rows)) throw new Error(`Read-only Production-precheck gaf geen rijlijst bij ${name}; write geweigerd.`);
    return [name, rows];
  }));

  const state = Object.fromEntries(observations);
  if (state.daily_lock_rows.length >= 100) {
    throw new Error("Meer dan 99 daily lock-rows; veilige inspectiegrens bereikt, write geweigerd.");
  }
  const activeLocks = state.daily_lock_rows.filter(row => {
    if (!row.lock_expires_at) return true;
    const expiry = Date.parse(row.lock_expires_at);
    return !Number.isFinite(expiry) || expiry > now;
  });
  const active = {
    running_daily_jobs: state.running_daily_jobs.length,
    running_attempts: state.running_attempts.length,
    active_catalog_import_runs: state.active_catalog_import_runs.length,
    active_locks: activeLocks.length,
  };
  const conflicts = Object.entries(active).filter(([, count]) => count > 0);
  if (conflicts.length) {
    throw new Error(`Write fail-safe: actieve importstatus gevonden (${conflicts.map(([name, count]) => `${name}=${count}`).join(", ")}).`);
  }
  return active;
}

function parseImporterSummary(line) {
  try {
    const value = JSON.parse(line);
    return value && ["dry_run", "write"].includes(value.mode)
      && Number.isInteger(value.requested) ? value : null;
  } catch {
    return null;
  }
}

async function executeImporter(config, env = process.env) {
  const args = buildImporterArgs(config);
  console.log(`Command: npm ${args.join(" ")}`);
  const child = spawn("npm", args, { stdio: ["ignore", "pipe", "inherit"], env });
  let pending = "";
  let summary = null;
  let outputBytes = 0;

  const consume = (chunk, final = false) => {
    const value = chunk.toString("utf8");
    process.stdout.write(value);
    pending += value;
    outputBytes += Buffer.byteLength(value);
    if (outputBytes > 4 * 1024 * 1024) throw new Error("Importeroutput overschrijdt de veilige logginglimiet.");
    let newline;
    while ((newline = pending.indexOf("\n")) >= 0) {
      const line = pending.slice(0, newline).replace(/\r$/, "");
      pending = pending.slice(newline + 1);
      summary = parseImporterSummary(line) ?? summary;
    }
    if (final && pending) {
      summary = parseImporterSummary(pending.replace(/\r$/, "")) ?? summary;
      pending = "";
    }
  };

  await new Promise((resolve, reject) => {
    child.stdout.on("data", chunk => {
      try {
        consume(chunk);
      } catch (error) {
        child.kill("SIGTERM");
        reject(error);
      }
    });
    child.once("error", () => reject(new Error("npm run import:skus kon niet worden gestart.")));
    child.once("close", code => {
      try {
        consume(Buffer.alloc(0), true);
      } catch (error) {
        reject(error);
        return;
      }
      if (code !== 0) reject(new Error(`npm run import:skus stopte met exitcode ${code}.`));
      else if (!summary) reject(new Error("Importer beëindigde zonder herkenbare classificatiesamenvatting."));
      else resolve();
    });
  });

  if (summary.mode !== (config.mode === "write" ? "write" : "dry_run")) {
    throw new Error("Importer-mode wijkt af van de expliciete runner-intentie.");
  }
  if (config.mode === "dry-run") {
    if (summary.imported !== 0
      || summary.before_product_count !== summary.after_product_count
      || summary.before_price_count !== summary.after_price_count) {
      throw new Error("Dry-run nul-write-invariant faalde; inspecteer runresultaat, start geen tweede batch.");
    }
  } else {
    const productDelta = summary.after_product_count - summary.before_product_count;
    const priceDelta = summary.after_price_count - summary.before_price_count;
    if (productDelta !== summary.imported || priceDelta !== summary.imported) {
      throw new Error("Write-nacontrole wijkt af van imported-count; stop en start geen tweede batch.");
    }
  }
  return summary;
}

async function writeStepSummary(config, input, checksum, result) {
  const productDelta = result.after_product_count - result.before_product_count;
  const priceDelta = result.after_price_count - result.before_price_count;
  const text = [
    "## Explicit SKU catch-up",
    `- Mode: ${config.mode}`,
    `- Requested max: ${config.max}; requested: ${result.requested}; processed: ${result.processed}`,
    `- Source: ${config.source}; CSV SHA-256: ${checksum}; input SKU count: ${input.uniqueSKUs}`,
    `- valid_new: ${result.valid_product_price}; imported: ${result.imported}; already_exists: ${result.already_exists}`,
    `- invalid: ${result.invalid}; not_found: ${result.not_found}; temporary_error: ${result.temporary_error}; skipped: ${result.skipped}`,
    `- Runtime: ${result.runtime_duration_ms} ms`,
    `- Product count delta: ${productDelta}; price count delta: ${priceDelta}`,
    config.mode === "dry-run" ? "- Product writes: 0; price writes: 0" : "- Geen tweede batch automatisch gestart",
  ].join("\n") + "\n";
  if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, text, "utf8");
}

export async function main(env = process.env) {
  const config = resolveRunnerConfig(env);
  const trusted = TRUSTED_CSVS[config.source];
  const fileBytes = await readFile(trusted.path);
  const checksum = createHash("sha256").update(fileBytes).digest("hex");
  if (checksum !== trusted.sha256) throw new Error("Trusted CSV SHA-256 wijkt af; import geweigerd.");

  const parsed = parseExplicitSKUCSV(fileBytes.toString("utf8"), { maxBatchSize: MAX_BATCH_SIZE });
  if (parsed.inputRows !== trusted.skuCount
    || parsed.uniqueSKUs !== trusted.skuCount
    || parsed.candidates.length !== trusted.skuCount
    || parsed.invalidRows.length !== 0
    || parsed.duplicateRows.length !== 0
    || parsed.candidates[0]?.sku !== trusted.firstSku) {
    throw new Error("Trusted CSV-set voldoet niet aan de vastgelegde integriteitscheck.");
  }

  console.log(`Mode: ${config.mode}; source: ${config.source}; requested max: ${config.max}`);
  console.log(`Trusted CSV: ${trusted.path}; SHA-256: ${checksum}; input SKU count: ${parsed.uniqueSKUs}`);

  if (needsProductionPrecheck(config.mode)) {
    const state = await precheckProductionImportState(env);
    console.log(`Read-only precheck passed: ${JSON.stringify(state)}`);
  }

  const result = await executeImporter(config, env);
  await writeStepSummary(config, parsed, checksum, result);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`Explicit SKU runner failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  });
}
