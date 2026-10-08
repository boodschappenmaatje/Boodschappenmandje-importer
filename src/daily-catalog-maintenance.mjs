import { pathToFileURL } from "node:url";

import { loadConfig } from "./config.mjs";
import { amsterdamDateKey, isDailyImportWindowOpen } from "./daily-catalog-growth.mjs";
import {
  isReliableCatalogProduct,
  isValidProductURL,
  SourceBlockedError,
  withDailyCatalogSource,
} from "./hoogvliet.mjs";
import {
  fetchCatalogImportRuns,
  fetchExistingPriceStates,
  fetchExistingProducts,
  fetchExistingSKUs,
  finishCatalogImportRun,
  hasProductTypeColumn,
  startCatalogImportRun,
  upsertProducts,
} from "./supabase.mjs";

function cents(value) {
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function maintenancePriceChanged(previous, current) {
  return [
    [cents(previous?.price), cents(current?.price)],
    [cents(previous?.oldPrice), cents(current?.oldPrice)],
    [previous?.isOffer === true, current?.isOffer === true],
    [text(previous?.offerText), text(current?.offerText)],
    [text(previous?.validFrom), text(current?.validFrom)],
    [text(previous?.validUntil), text(current?.validUntil)],
  ].some(([before, after]) => before !== after);
}

function existingProductWithPrice(existing, candidate, priceState, fetchedAt) {
  if (!existing || !priceState) return null;
  const product = {
    supermarket: "Hoogvliet",
    sku: existing.sku,
    name: existing.name,
    brand: existing.brand,
    category: existing.category,
    packageText: existing.packageText,
    weightGrams: existing.weightGrams,
    imageURL: existing.imageURL,
    sourceURL: isValidProductURL(existing.sourceURL) ? existing.sourceURL : candidate.sourceURL,
    isAvailable: existing.available,
    productType: existing.productType,
    price: priceState.price,
    oldPrice: priceState.oldPrice,
    isOffer: priceState.isOffer,
    offerText: priceState.offerText,
    validFrom: priceState.validFrom,
    validUntil: priceState.validUntil,
    fetchedAt,
  };
  return isReliableCatalogProduct(product) ? product : null;
}

function fallbackProductForMaintenance(product, existing, candidate) {
  if (!product) return null;
  if (!existing) {
    // Images are deliberately outside this maintenance scope.
    return { ...product, imageURL: undefined };
  }
  const merged = {
    ...product,
    name: existing.name,
    brand: existing.brand,
    category: existing.category,
    packageText: existing.packageText,
    weightGrams: existing.weightGrams,
    imageURL: existing.imageURL,
    sourceURL: isValidProductURL(existing.sourceURL) ? existing.sourceURL : candidate.sourceURL,
    isAvailable: existing.available,
    productType: existing.productType,
  };
  return isReliableCatalogProduct(merged) ? merged : null;
}

export async function assessDailyCatalogCandidates({
  candidates,
  existingProducts,
  existingPrices,
  validateFallback,
  maxDetailFallbacks = 500,
  now = new Date(),
  logger = console,
} = {}) {
  if (!Array.isArray(candidates) || !Array.isArray(existingProducts)
      || !(existingPrices instanceof Map) || typeof validateFallback !== "function") {
    throw new Error("Ongeldige daily-maintenance input.");
  }
  const existingBySKU = new Map(existingProducts.map(product => [product.sku, product]));
  const uniqueCandidates = new Map();
  let duplicateCandidates = 0;
  for (const candidate of candidates) {
    if (!candidate?.sku) continue;
    if (uniqueCandidates.has(candidate.sku)) {
      duplicateCandidates += 1;
      continue;
    }
    uniqueCandidates.set(candidate.sku, candidate);
  }

  const productsToWrite = [];
  const listingExistingSKUs = new Set();
  const stats = {
    currentCatalogSKUs: uniqueCandidates.size,
    existingCatalogSKUs: 0,
    newSKUsDetected: 0,
    bulkPriceAssessments: 0,
    detailFallbacks: 0,
    changedExistingPrices: 0,
    unchangedExistingPrices: 0,
    unresolvedExistingPrices: 0,
    invalidNewSKUs: 0,
    duplicateCandidates,
    productionOnlyOrMissingSKUs: 0,
  };
  const fetchedAt = now.toISOString();

  for (const candidate of uniqueCandidates.values()) {
    const existing = existingBySKU.get(candidate.sku) ?? null;
    if (existing) {
      listingExistingSKUs.add(candidate.sku);
      stats.existingCatalogSKUs += 1;
    } else {
      stats.newSKUsDetected += 1;
    }

    let product = null;
    if (existing && candidate.catalogAPIValidated === true && candidate.catalogPriceState) {
      product = existingProductWithPrice(existing, candidate, candidate.catalogPriceState, fetchedAt);
      if (product) stats.bulkPriceAssessments += 1;
    }

    if (!product) {
      if (stats.detailFallbacks >= maxDetailFallbacks) {
        const error = new Error(
          `Detailfallback-veiligheidsgrens bereikt (${maxDetailFallbacks}); geen maintenancewrites uitgevoerd.`,
        );
        error.code = "detail_fallback_safety_limit";
        throw error;
      }
      stats.detailFallbacks += 1;
      const diagnostics = {};
      try {
        product = fallbackProductForMaintenance(
          await validateFallback(candidate, diagnostics),
          existing,
          candidate,
        );
      } catch (error) {
        if (error instanceof SourceBlockedError) throw error;
        logger.error(`Daily detailfallback overgeslagen (${candidate.sku}): ${error instanceof Error ? error.message : "onbekende fout"}`);
      }
      if (!product) {
        if (existing) stats.unresolvedExistingPrices += 1;
        else stats.invalidNewSKUs += 1;
        logger.info(`Daily maintenance behoudt last-known-good voor ${candidate.sku}; reden=${diagnostics.reason ?? "fallback_onbetrouwbaar"}.`);
        continue;
      }
    }

    if (existing) {
      const previous = existingPrices.get(existing.id) ?? null;
      if (maintenancePriceChanged(previous, product)) {
        stats.changedExistingPrices += 1;
        productsToWrite.push(product);
      } else {
        stats.unchangedExistingPrices += 1;
      }
    } else {
      productsToWrite.push(product);
    }
  }

  stats.productionOnlyOrMissingSKUs = existingProducts
    .filter(product => !listingExistingSKUs.has(product.sku))
    .length;
  return { productsToWrite, stats };
}

export function dailyMaintenanceDecision(runs, now = new Date()) {
  if (!isDailyImportWindowOpen(now)) return { runAttempt: false, reason: "outside_daily_window" };
  const today = amsterdamDateKey(now);
  const todayRuns = (Array.isArray(runs) ? runs : [])
    .filter(run => {
      const startedAt = new Date(run?.started_at ?? "");
      return !Number.isNaN(startedAt.getTime()) && amsterdamDateKey(startedAt) === today;
    })
    .sort((left, right) => Date.parse(right.started_at) - Date.parse(left.started_at));
  const latest = todayRuns[0];
  if (!latest) return { runAttempt: true, reason: "daily_maintenance_missing" };
  if (latest.status === "running") return { runAttempt: false, reason: "daily_maintenance_running" };
  if (latest.status === "success") return { runAttempt: false, reason: "daily_maintenance_complete" };
  return { runAttempt: true, reason: `daily_maintenance_${latest.status || "incomplete"}` };
}

export async function inspectDailyCatalogMaintenance(config, dependencies = {}) {
  const fetchRuns = dependencies.fetchRuns ?? fetchCatalogImportRuns;
  const now = dependencies.now?.() ?? new Date();
  const runs = await fetchRuns(config, { trigger: "schedule", limit: 20 });
  return dailyMaintenanceDecision(runs, now);
}

export function formatDailyMaintenanceSummary(result) {
  const stats = result.stats;
  return [
    "Dagelijkse catalogusmaintenance",
    `status=${result.status}`,
    `actuele_SKUs=${stats.currentCatalogSKUs}`,
    `bulk_prijschecks=${stats.bulkPriceAssessments}`,
    `detailfallbacks=${stats.detailFallbacks}`,
    `nieuw_gevonden=${stats.newSKUsDetected}`,
    `nieuw_geschreven=${result.newCount}`,
    `bestaande_prijsgewijzigd=${result.updatedCount}`,
    `bestaande_prijsongewijzigd=${stats.unchangedExistingPrices}`,
    `last_known_good_behouden=${stats.unresolvedExistingPrices}`,
    `Production_only_of_verdwenen_behouden=${stats.productionOnlyOrMissingSKUs}`,
    `listing_paginas=${result.snapshot.pagesFetched}`,
    `GraphQL_bulk_calls=${result.snapshot.catalogAPICalls}`,
    `duplicaten=${stats.duplicateCandidates + result.duplicateSKUsSkipped}`,
  ].join(" | ");
}

export async function runDailyCatalogMaintenance(config, logger = console, dependencies = {}) {
  const services = {
    fetchExistingProducts,
    fetchExistingPriceStates,
    fetchExistingSKUs,
    startCatalogImportRun,
    finishCatalogImportRun,
    upsertProducts,
    withDailyCatalogSource,
    ...dependencies,
  };
  const existingProducts = await services.fetchExistingProducts(config);
  const existingPrices = await services.fetchExistingPriceStates(config);
  const totalUniqueProductsBefore = existingProducts.length;
  const run = await services.startCatalogImportRun(config, {
    trigger: config.importTrigger,
    totalUniqueProductsBefore,
  });
  let assessment = null;
  let snapshot = null;
  let writeResult = { imported: [], errors: [], duplicateSKUsSkipped: 0 };
  try {
    const sourceResult = await services.withDailyCatalogSource(config, async source => {
      snapshot = source.snapshot;
      return assessDailyCatalogCandidates({
        candidates: source.candidates,
        existingProducts,
        existingPrices,
        validateFallback: source.validateFallback,
        maxDetailFallbacks: config.maintenanceMaxDetailFallbacks,
        logger,
      });
    });
    assessment = sourceResult;
    if (assessment.productsToWrite.length > 0) {
      writeResult = await services.upsertProducts(config, assessment.productsToWrite);
    }
    const totalUniqueProductsAfter = (await services.fetchExistingSKUs(config)).size;
    const newCount = writeResult.imported.filter(product => product.inserted === true).length;
    const updatedCount = writeResult.imported.length - newCount;
    const errorCount = assessment.stats.unresolvedExistingPrices + writeResult.errors.length;
    const status = errorCount > 0 ? "partial" : "success";
    const result = {
      status,
      stats: assessment.stats,
      snapshot,
      processedCount: assessment.stats.currentCatalogSKUs,
      newCount,
      updatedCount,
      unchangedCount: assessment.stats.unchangedExistingPrices,
      skippedCount: assessment.stats.invalidNewSKUs + assessment.stats.unresolvedExistingPrices,
      errorCount,
      totalUniqueProductsBefore,
      totalUniqueProductsAfter,
      duplicateSKUsSkipped: writeResult.duplicateSKUsSkipped,
      errorSummary: errorCount > 0
        ? `${assessment.stats.unresolvedExistingPrices} bestaande prijsstatussen behielden last-known-good; ${writeResult.errors.length} schrijffouten.`
        : null,
    };
    await services.finishCatalogImportRun(config, run, result);
    logger.info(formatDailyMaintenanceSummary(result));
    return result;
  } catch (error) {
    const totalUniqueProductsAfter = await services.fetchExistingSKUs(config)
      .then(skus => skus.size)
      .catch(() => totalUniqueProductsBefore);
    await services.finishCatalogImportRun(config, run, {
      status: "failed",
      processedCount: assessment?.stats?.currentCatalogSKUs ?? 0,
      newCount: 0,
      updatedCount: 0,
      unchangedCount: assessment?.stats?.unchangedExistingPrices ?? 0,
      skippedCount: assessment?.stats?.invalidNewSKUs ?? 0,
      errorCount: 1,
      totalUniqueProductsAfter,
      errorSummary: error instanceof Error ? error.message : "onbekende maintenancefout",
    });
    throw error;
  }
}

export async function main(argv = process.argv.slice(2)) {
  const config = loadConfig();
  if (argv.includes("--inspect")) {
    const decision = await inspectDailyCatalogMaintenance(config);
    console.log(`run_attempt=${decision.runAttempt ? 1 : 0}`);
    console.log(`reason=${decision.reason}`);
    return decision;
  }
  if (config.updateMode !== "maintenance") {
    throw new Error("Dagelijkse catalogusmaintenance vereist UPDATE_MODE=maintenance.");
  }
  if (config.dryRun) throw new Error("Dagelijkse catalogusmaintenance ondersteunt geen DRY_RUN.");
  config.productTypeSupported = await hasProductTypeColumn(config);
  return runDailyCatalogMaintenance(config);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`Dagelijkse catalogusmaintenance mislukt: ${error instanceof Error ? error.message : "onbekende fout"}`);
    process.exitCode = 1;
  });
}
