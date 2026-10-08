import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import {
  isValidProductURL,
  isValidSKU,
  validateCandidate,
  withTransientNavigationRetry,
} from "./hoogvliet.mjs";
import {
  fetchExistingPriceStates,
  fetchExistingProducts,
  fetchRunningCatalogDailyJobs,
  finishCatalogImportRun,
  startCatalogImportRun,
  upsertProducts,
} from "./supabase.mjs";

export const DEFAULT_CATCH_UP_MAX = 400;
export const CATCH_UP_ROUTE_KEY = "catch-up:explicit-sku";

function normalizedHeader(value) {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"' && text[index + 1] === '"') { field += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"' && field.length === 0) quoted = true;
    else if (char === ",") { row.push(field); field = ""; }
    else if (char === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (char !== "\r") field += char;
  }
  if (quoted) throw new Error("CSV bevat een niet afgesloten quote.");
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter((candidate) => candidate.some((value) => String(value).trim() !== ""));
}

function columnIndex(headers, names) {
  return names.map(normalizedHeader).map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
}

function productURLFromRow(row, indexes) {
  const value = indexes.productURL >= 0 ? String(row[indexes.productURL] ?? "").trim() : "";
  return value || null;
}

export function parseExplicitSKUCSV(text, { maxBatchSize = DEFAULT_CATCH_UP_MAX } = {}) {
  if (typeof text !== "string" || text.length > 8 * 1024 * 1024) {
    throw new Error("CSV ontbreekt of overschrijdt de veilige bestandsgrootte van 8 MB.");
  }
  if (!Number.isInteger(maxBatchSize) || maxBatchSize < 1 || maxBatchSize > DEFAULT_CATCH_UP_MAX) {
    throw new Error(`Catch-up maximum moet 1 t/m ${DEFAULT_CATCH_UP_MAX} zijn.`);
  }
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error("CSV heeft geen header en datarijen.");
  const headers = rows[0].map(normalizedHeader);
  const skuIndex = columnIndex(headers, ["sku", "productsku", "hoogvlietsku"]);
  if (skuIndex < 0) throw new Error("CSV vereist een SKU-kolom.");
  const urlIndex = columnIndex(headers, ["producturl", "product_url", "sourceurl", "source_url", "url"]);
  const brandIndex = columnIndex(headers, ["brand", "merk"]);
  const categoryIndex = columnIndex(headers, ["category", "categorie"]);
  const seen = new Set();
  const candidates = [], invalidRows = [], duplicateRows = [];
  for (let rowIndex = 1; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex];
    const rawSKU = String(row[skuIndex] ?? "").trim();
    if (!isValidSKU(rawSKU)) {
      invalidRows.push({ row: rowIndex + 1, sku: rawSKU || null, reason: "invalid_sku" });
      continue;
    }
    if (seen.has(rawSKU)) {
      duplicateRows.push({ row: rowIndex + 1, sku: rawSKU, reason: "duplicate_input" });
      continue;
    }
    seen.add(rawSKU);
    const sourceURL = productURLFromRow(row, { productURL: urlIndex });
    if (!sourceURL) {
      invalidRows.push({ row: rowIndex + 1, sku: rawSKU, reason: "missing_product_url" });
      continue;
    }
    if (!isValidProductURL(sourceURL)) {
      invalidRows.push({ row: rowIndex + 1, sku: rawSKU, reason: "invalid_product_url" });
      continue;
    }
    candidates.push({
      sku: rawSKU,
      sourceURL,
      brand: brandIndex >= 0 ? String(row[brandIndex] ?? "").trim() || null : null,
      category: categoryIndex >= 0 ? String(row[categoryIndex] ?? "").trim() || null : null,
      sourceRow: rowIndex + 1,
    });
  }
  return {
    inputRows: rows.length - 1,
    uniqueSKUs: seen.size,
    candidates,
    invalidRows,
    duplicateRows,
    maxBatchSize,
  };
}

export async function readExplicitSKUCSV(filePath, options = {}) {
  if (typeof filePath !== "string" || !filePath.trim() || !filePath.toLowerCase().endsWith(".csv")) {
    throw new Error("--file moet naar een CSV-bestand wijzen.");
  }
  return parseExplicitSKUCSV(await readFile(filePath, "utf8"), options);
}

function loggerMethod(logger, method, message) {
  (logger?.[method] ?? logger?.info ?? console.log)(message);
}

function resultCounts(results) {
  const count = (status) => results.filter((item) => item.status === status).length;
  return {
    processed: results.filter((item) => item.status !== "skipped").length,
    imported: count("imported"),
    already_exists: count("already_exists"),
    invalid: count("invalid"),
    not_found: count("not_found"),
    temporary_error: count("temporary_error"),
    skipped: count("skipped"),
  };
}

function validationStatus(diagnostics) {
  if (diagnostics?.reason === "notFound") return "not_found";
  return "invalid";
}

function runtimeErrorStatus(error) {
  return {
    status: "temporary_error",
    error_code: error?.code ?? error?.name ?? "temporary_error",
    reason: error instanceof Error ? error.message : "onbekende tijdelijke fout",
  };
}

export async function runExplicitSKUImport(config, input, logger = console, dependencies = {}) {
  if (!input || !Array.isArray(input.candidates)) throw new Error("Ongeldige expliciete SKU-input.");
  const max = Math.min(
    Math.max(1, Math.trunc(Number(config.catchUpMax ?? input.maxBatchSize ?? DEFAULT_CATCH_UP_MAX))),
    DEFAULT_CATCH_UP_MAX,
  );
  const selected = input.candidates.slice(0, max);
  const overMax = input.candidates.slice(max).map((candidate) => ({
    sku: candidate.sku, status: "skipped", reason: "max_batch_size", source_row: candidate.sourceRow,
  }));
  const services = {
    fetchExistingProducts,
    fetchExistingPriceStates,
    fetchRunningCatalogDailyJobs,
    startCatalogImportRun,
    finishCatalogImportRun,
    upsertProducts,
    ...(dependencies.services ?? {}),
  };
  const beforeProducts = await services.fetchExistingProducts(config, { supermarketFilter: "ilike.Hoogvliet" });
  const beforePrices = await services.fetchExistingPriceStates(config);
  const existingSKUs = new Set(beforeProducts.map((product) => product.sku).filter(isValidSKU));
  const results = [
    ...input.invalidRows.map((item) => ({
      sku: item.sku,
      status: isValidSKU(item.sku) && existingSKUs.has(item.sku) ? "already_exists" : "invalid",
      reason: isValidSKU(item.sku) && existingSKUs.has(item.sku) ? "existing_before_input_validation" : item.reason,
      source_row: item.row,
    })),
    ...input.duplicateRows.map((item) => ({ sku: item.sku, status: "skipped", reason: item.reason, source_row: item.row })),
    ...overMax,
  ];
  const startedAt = Date.now();
  const maxRuntimeMs = Math.max(1, Number(config.catchUpMaxRuntimeMs ?? config.growthMaxRuntimeMs ?? 105 * 60_000));
  const dryRun = config.catchUpWrite !== true;
  let run = null;
  let stopReason = null;
  let browser = null;
  let detailPage = null;
  let validator = dependencies.validateCandidate ?? services.validateCandidate;
  if (!validator) {
    browser = await chromium.launch({ headless: config.headless !== false });
    const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
    detailPage = await context.newPage();
    validator = (candidate, diagnostics) => withTransientNavigationRetry(
      () => validateCandidate(detailPage, candidate, diagnostics),
      { maxRetries: config.navigationRetries ?? 2, wait: (delay) => detailPage.waitForTimeout(delay) },
    );
  }

  if (!dryRun) {
    let dailyJobs;
    try {
      dailyJobs = await services.fetchRunningCatalogDailyJobs(config);
    } catch (error) {
      if (detailPage) await detailPage.context().close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      throw error;
    }
    if (dailyJobs.length > 0) {
      if (detailPage) await detailPage.context().close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      const error = new Error("Catch-up geweigerd: er draait al een daily import.");
      error.code = "daily_import_lock_active";
      throw error;
    }
    try {
      run = await services.startCatalogImportRun(config, {
        trigger: "manual",
        totalUniqueProductsBefore: existingSKUs.size,
      });
    } catch (error) {
      if (detailPage) await detailPage.context().close().catch(() => {});
      if (browser) await browser.close().catch(() => {});
      const wrapped = new Error("Catch-up geweigerd: relevante catalogusimport-lock is actief.", { cause: error });
      wrapped.code = "catalog_import_lock_active";
      throw wrapped;
    }
  }

  let written = 0;
  try {
    for (const candidate of selected) {
      if (Date.now() - startedAt >= maxRuntimeMs) {
        stopReason = "runtime_safety_limit";
        results.push(...selected.slice(selected.indexOf(candidate)).map((remaining) => ({
          sku: remaining.sku, status: "skipped", reason: stopReason, source_row: remaining.sourceRow,
        })));
        break;
      }
      if (existingSKUs.has(candidate.sku)) {
        results.push({ sku: candidate.sku, status: "already_exists", source_row: candidate.sourceRow });
        continue;
      }
      const diagnostics = {};
      let product;
      try {
        product = await validator({ ...candidate, searchTerm: CATCH_UP_ROUTE_KEY }, diagnostics);
      } catch (error) {
        const detail = runtimeErrorStatus(error);
        results.push({ sku: candidate.sku, ...detail, source_row: candidate.sourceRow });
        loggerMethod(logger, "error", `Catch-up ${candidate.sku}: ${detail.reason}`);
        continue;
      }
      if (!product) {
        const status = validationStatus(diagnostics);
        results.push({ sku: candidate.sku, status, reason: diagnostics.reason ?? "invalidProduct",
          detail_reachable: diagnostics.detailReachable === true,
          parser: diagnostics.parser ?? null,
          source_row: candidate.sourceRow });
        continue;
      }
      if (dryRun) {
        results.push({ sku: candidate.sku, status: "valid", classification: "valid_new",
          price: product.price, source_row: candidate.sourceRow });
        continue;
      }
      try {
        const writeResult = await services.upsertProducts({ ...config, updateMode: "growth" }, [product]);
        const stored = writeResult.imported?.[0];
        if (!stored) throw new Error(writeResult.errors?.[0]?.message ?? "geen bevestigde product/prijs-write");
        const inserted = stored.inserted === true;
        if (inserted) { written += 1; existingSKUs.add(candidate.sku); }
        results.push({ sku: candidate.sku, status: inserted ? "imported" : "already_exists", price: product.price, source_row: candidate.sourceRow });
      } catch (error) {
        const detail = runtimeErrorStatus(error);
        results.push({ sku: candidate.sku, ...detail, source_row: candidate.sourceRow });
      }
    }
  } finally {
    if (detailPage) await detailPage.context().close().catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }

  const counts = resultCounts(results);
  let afterProducts = beforeProducts;
  let afterPrices = beforePrices;
  let postReadError = null;
  if (!dryRun) {
    try {
      afterProducts = await services.fetchExistingProducts(config, { supermarketFilter: "ilike.Hoogvliet" });
      afterPrices = await services.fetchExistingPriceStates(config);
    } catch (error) {
      postReadError = error;
      loggerMethod(logger, "error", `Catch-up post-read mislukt: ${error instanceof Error ? error.message : "onbekende fout"}`);
    }
  }
  const durationMs = Date.now() - startedAt;
  const totalErrors = counts.temporary_error + (postReadError ? 1 : 0);
  const result = {
    mode: dryRun ? "dry_run" : "write",
    input_rows: input.inputRows,
    unique_input_skus: input.uniqueSKUs,
    requested: selected.length,
    ...counts,
    detail_reachable: results.filter((item) => item.detail_reachable === true
      || ["valid", "imported"].includes(item.status)).length,
    valid_product_price: results.filter((item) => ["valid", "imported"].includes(item.status)).length,
    runtime_duration_ms: durationMs,
    stop_reason: stopReason,
    post_read_error: postReadError?.code ?? null,
    before_product_count: beforeProducts.length,
    after_product_count: afterProducts.length,
    before_price_count: beforePrices.size,
    after_price_count: afterPrices.size,
    results,
  };

  if (run) {
    await services.finishCatalogImportRun(config, run, {
      status: totalErrors || stopReason ? "partial" : "success",
      processedCount: counts.processed,
      newCount: counts.imported,
      updatedCount: 0,
      unchangedCount: counts.already_exists,
      skippedCount: counts.invalid + counts.not_found + counts.skipped,
      errorCount: totalErrors,
      totalUniqueProductsAfter: afterProducts.length,
      errorSummary: `catch_up_explicit_sku; imported=${counts.imported}; already_exists=${counts.already_exists}; invalid=${counts.invalid}; not_found=${counts.not_found}; temporary_error=${counts.temporary_error}; skipped=${counts.skipped}; post_read_error=${postReadError?.code ?? "none"}`,
    });
  }
  loggerMethod(logger, "info", JSON.stringify({ ...result, results: undefined }));
  return result;
}
