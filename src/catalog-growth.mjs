import { collectProducts } from "./hoogvliet.mjs";
import {
  fetchCatalogDiscoveryState,
  fetchExistingPriceStates,
  fetchExistingProducts,
  fetchExistingSKUs,
  finishCatalogImportRun,
  saveCatalogDiscoveryState,
  startCatalogImportRun,
  upsertProducts,
} from "./supabase.mjs";

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cents(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0
    ? Math.round(Number(value) * 100)
    : null;
}

export function rotateDiscoveryTerms(terms, cursor = 0) {
  if (!Array.isArray(terms) || terms.length === 0) return [];
  const offset = Math.max(0, Math.trunc(cursor)) % terms.length;
  return [...terms.slice(offset), ...terms.slice(0, offset)];
}

export function nextDiscoveryCursor(cursor, searchedTerms, termCount) {
  if (!Number.isInteger(termCount) || termCount < 1) return 0;
  return (Math.max(0, Math.trunc(cursor)) + Math.max(1, Math.trunc(searchedTerms))) % termCount;
}

export function catalogGrowthMode(totalUniqueProducts) {
  const total = Math.max(0, Number(totalUniqueProducts) || 0);
  if (total >= 10_000) return "maintenance";
  if (total >= 9_500) return "balanced";
  return "discovery";
}

export function productChanged(existing, previousPrice, current) {
  if (!existing) return true;
  const pairs = [
    [text(existing.name), text(current.name)],
    [text(existing.brand), text(current.brand)],
    [text(existing.category), text(current.category)],
    [text(existing.packageText), text(current.packageText)],
    [Number(existing.weightGrams) || null, Number(current.weightGrams) || null],
    [text(existing.imageURL), text(current.imageURL)],
    [text(existing.sourceURL), text(current.sourceURL)],
    [existing.available ?? null, current.isAvailable ?? null],
    [text(existing.productType), text(current.productType)],
    [cents(previousPrice?.price), cents(current.price)],
    [cents(previousPrice?.oldPrice), cents(current.oldPrice)],
    [previousPrice?.isOffer === true, current.isOffer === true],
    [text(previousPrice?.offerText), text(current.offerText)],
    [text(previousPrice?.validFrom), text(current.validFrom)],
    [text(previousPrice?.validUntil), text(current.validUntil)],
  ];
  return pairs.some(([before, after]) => before !== after);
}

export function classifyCatalogOutcomes({
  products,
  importedSKUs,
  existingBySKU,
  existingPrices,
  stats,
  writeErrors = 0,
}) {
  let newCount = 0;
  let updatedCount = 0;
  let unchangedCount = 0;
  for (const product of products) {
    if (!importedSKUs.has(product.sku)) continue;
    const existing = existingBySKU.get(product.sku);
    if (!existing) {
      newCount += 1;
      continue;
    }
    const previousPrice = existingPrices.get(existing.id) ?? null;
    if (productChanged(existing, previousPrice, product)) updatedCount += 1;
    else unchangedCount += 1;
  }
  const skippedCount = Math.max(0, stats.invalidProductsSkipped ?? 0);
  const errorCount = Math.max(0, stats.productErrors ?? 0) + Math.max(0, writeErrors);
  const processedCount = newCount + updatedCount + unchangedCount + skippedCount + errorCount;
  return { processedCount, newCount, updatedCount, unchangedCount, skippedCount, errorCount };
}

export function importRunStatus({ errorCount, searchErrors = 0 }) {
  return errorCount > 0 || searchErrors > 0 ? "partial" : "success";
}

export function formatCatalogGrowthSummary(result) {
  return [
    "Catalogusgroei",
    `status=${result.status}`,
    `verwerkt=${result.processedCount}`,
    `nieuw=${result.newCount}`,
    `bijgewerkt=${result.updatedCount}`,
    `ongewijzigd=${result.unchangedCount}`,
    `overgeslagen=${result.skippedCount}`,
    `fouten=${result.errorCount}`,
    `totaal_voor=${result.totalUniqueProductsBefore}`,
    `totaal_na=${result.totalUniqueProductsAfter}`,
    `duur=${result.durationSeconds.toFixed(1)}s`,
  ].join(" | ");
}

export async function runCatalogGrowth(config, logger = console) {
  const startedAt = Date.now();
  const existingProducts = await fetchExistingProducts(config);
  const existingPrices = await fetchExistingPriceStates(config);
  const existingBySKU = new Map(existingProducts.map((product) => [product.sku, product]));
  const existingSKUs = new Set(existingBySKU.keys());
  const totalUniqueProductsBefore = existingSKUs.size;
  const run = await startCatalogImportRun(config, {
    trigger: config.importTrigger,
    totalUniqueProductsBefore,
  });
  let stats = {};
  let writeErrors = [];

  try {
    const discoveryState = await fetchCatalogDiscoveryState(config, config.discoveryStateKey);
    const originalTerms = [...config.searchTerms];
    const rotatedTerms = rotateDiscoveryTerms(originalTerms, discoveryState.termCursor);
    const growthConfig = {
      ...config,
      searchTerms: rotatedTerms,
      catalogNewOnly: false,
    };
    logger.info(
      `Catalogusgroei gestart: modus=${catalogGrowthMode(totalUniqueProductsBefore)}, `
        + `cursor=${discoveryState.termCursor}, limiet=${growthConfig.maxProducts}.`,
    );

    const imported = [];
    const persistBatch = async (batch) => {
      const result = await upsertProducts(growthConfig, batch);
      imported.push(...result.imported);
      writeErrors.push(...result.errors);
      logger.info(`Catalogusgroei tussentijds opgeslagen: ${imported.length}.`);
    };
    const collected = await collectProducts(growthConfig, logger, {
      existingSKUs,
      onBatch: persistBatch,
      persistBatchSize: 10,
    });
    stats = collected.stats;
    const importedSKUs = new Set(imported.map((product) => product.sku));
    const counts = classifyCatalogOutcomes({
      products: collected.products,
      importedSKUs,
      existingBySKU,
      existingPrices,
      stats,
      writeErrors: writeErrors.length,
    });
    const totalUniqueProductsAfter = (await fetchExistingSKUs(config)).size;
    const searchErrors = stats.searchErrors ?? 0;
    const result = {
      ...counts,
      status: importRunStatus({ errorCount: counts.errorCount, searchErrors }),
      totalUniqueProductsBefore,
      totalUniqueProductsAfter,
      durationSeconds: (Date.now() - startedAt) / 1000,
      errorSummary: [
        searchErrors ? `${searchErrors} zoektermfout(en)` : null,
        writeErrors.length ? `${writeErrors.length} schrijffout(en)` : null,
      ].filter(Boolean).join("; ") || null,
    };
    await finishCatalogImportRun(config, run, result);

    if (config.advanceDiscoveryState) {
      await saveCatalogDiscoveryState(config, {
        ...discoveryState,
        termCursor: nextDiscoveryCursor(
          discoveryState.termCursor,
          stats.searchedTerms ?? 0,
          originalTerms.length,
        ),
        pageCursor: 0,
        lastBatch: config.catalogBatch,
        updatedAt: new Date().toISOString(),
      });
    }
    logger.info(formatCatalogGrowthSummary(result));
    return result;
  } catch (error) {
    const totalUniqueProductsAfter = await fetchExistingSKUs(config)
      .then((skus) => skus.size)
      .catch(() => totalUniqueProductsBefore);
    await finishCatalogImportRun(config, run, {
      status: "failed",
      processedCount: stats.processedProducts ?? 0,
      newCount: 0,
      updatedCount: 0,
      unchangedCount: 0,
      skippedCount: stats.invalidProductsSkipped ?? 0,
      errorCount: Math.max(1, (stats.productErrors ?? 0) + writeErrors.length),
      totalUniqueProductsAfter,
      errorSummary: error instanceof Error ? error.message : "Onbekende importfout",
    }).catch((finishError) => {
      logger.error(`Runstatus kon niet worden afgesloten: ${finishError instanceof Error ? finishError.message : "onbekend"}`);
    });
    throw error;
  }
}
