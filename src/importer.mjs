import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.mjs";
import { runCatalogGrowth } from "./catalog-growth.mjs";
import { classifyProductType, productTypeCoverage } from "./product-type.mjs";
import {
  collectProducts,
  refreshExistingProducts,
  selectPriceShardWindow,
  SourceBlockedError,
} from "./hoogvliet.mjs";
import {
  fetchExistingProducts,
  fetchExistingPriceStates,
  fetchExistingSKUs,
  hasProductTypeColumn,
  upsertProductClassifications,
  upsertProducts,
} from "./supabase.mjs";

export function safeLogger(secrets = []) {
  const redact = (message) => secrets
    .filter(Boolean)
    .reduce((result, secret) => result.split(secret).join("[REDACTED]"), String(message));
  return {
    info(message) {
      console.log(redact(message));
    },
    error(message) {
      console.error(redact(message));
    },
  };
}

export function formatBatchSummary(stats) {
  const totalErrors = stats.productErrors + stats.searchErrors + stats.writeErrors;
  const skippedProducts = stats.invalidProductsSkipped + stats.productErrors + stats.writeErrors;
  return [
    "Batchstatistieken",
    `batch=${stats.catalogBatch}`,
    `zoektermen=${stats.searchedTerms}/${stats.configuredSearchTerms}`,
    `pagina's=${stats.pagesFetched ?? 0}`,
    `ruwe_kandidaten=${stats.rawCandidatesFound ?? stats.candidatesFound}`,
    `kandidaten=${stats.candidatesFound}`,
    `irrelevant_overgeslagen=${stats.irrelevantCandidatesSkipped ?? 0}`,
    `bekend_overgeslagen=${stats.existingCandidatesSkipped ?? 0}`,
    `bestaand_gevonden=${stats.existingSKUsDiscovered ?? stats.existingProducts ?? 0}`,
    `unieke_SKUs=${stats.uniqueSKUsDiscovered ?? stats.uniqueSKUs}`,
    `nieuw_gevonden=${stats.newSKUsDiscovered ?? stats.newProducts}`,
    `nieuwe_SKUs=${stats.newProducts}`,
    `bestaande_SKUs=${stats.existingProducts}`,
    `gevalideerd=${stats.validatedProducts}`,
    `onbekend_type=${stats.unknownProductTypes ?? 0}`,
    `dubbele_SKUs=${stats.duplicateSKUsSkipped}`,
    `overgeslagen=${skippedProducts}`,
    `ongeldig_overgeslagen=${stats.invalidProductsSkipped}`,
    `productfouten=${stats.productErrors}`,
    `zoekfouten=${stats.searchErrors}`,
    `geschreven=${stats.writtenProducts}`,
    `nieuw_geschreven=${stats.newProductsWritten}`,
    `bestaand_bijgewerkt=${stats.existingProductsUpdated}`,
    `schrijffouten=${stats.writeErrors}`,
    `fouten_totaal=${totalErrors}`,
    `duur=${(stats.durationMs / 1000).toFixed(1)}s`,
  ].join(" | ");
}

export function formatTermCoverage(termCoverage, termsPerLine = 8) {
  const entries = Object.entries(termCoverage).map(([term, value]) => (
    `${term}: ${value.candidates ?? 0} relevant/${value.pages ?? 0} pag., `
      + `${value.new ?? 0} nieuw, ${value.existing ?? 0} bijgewerkt, `
      + `${value.existingSkipped ?? 0} bekend overgeslagen`
  ));
  const lines = [];
  for (let index = 0; index < entries.length; index += termsPerLine) {
    lines.push(`Dekking per zoekterm | ${entries.slice(index, index + termsPerLine).join(" | ")}`);
  }
  return lines;
}

export function formatPriceRefreshSummary(stats) {
  return [
    "Prijsupdate-statistieken",
    `deelbatch=${stats.priceShardIndex + 1}/${stats.priceShardCount}`,
    `venster=${(stats.priceWindowIndex ?? 0) + 1}/${stats.priceWindowCount ?? 1}`,
    `in_shard=${stats.totalInShard ?? stats.selectedProducts}`,
    `geselecteerd=${stats.selectedProducts}`,
    `gecontroleerd=${stats.checkedProducts ?? stats.selectedProducts}`,
    `gevonden=${stats.foundProducts ?? stats.validatedProducts}`,
    `gewijzigd=${stats.changedPrices ?? 0}`,
    `ongewijzigd=${stats.unchangedPrices ?? 0}`,
    `acties=${stats.activeOffers ?? 0}`,
    `actie_gestart=${stats.offersStarted ?? 0}`,
    `actie_beëindigd=${stats.offersEnded ?? 0}`,
    `niet_gevonden=${stats.notFoundProducts ?? 0}`,
    `ongeldige_prijs=${stats.invalidPrices ?? 0}`,
    `gevalideerd=${stats.validatedProducts}`,
    `overgeslagen=${stats.invalidProductsSkipped}`,
    `productfouten=${stats.productErrors}`,
    `geschreven=${stats.writtenProducts}`,
    `schrijffouten=${stats.writeErrors}`,
    `duur=${(stats.durationMs / 1000).toFixed(1)}s`,
  ].join(" | ");
}

export function formatClassificationSummary(coverage, written) {
  const commonTypes = [...coverage.counts.entries()]
    .filter(([type]) => type !== "Onbekend")
    .sort((left, right) => right[1] - left[1])
    .slice(0, 12)
    .map(([type, count]) => `${type}=${count}`)
    .join(", ");
  return [
    "Producttype-statistieken",
    `onderzocht=${coverage.total}`,
    `geclassificeerd=${coverage.classified}`,
    `onbekend=${coverage.unknown}`,
    `dekking=${coverage.percentage.toFixed(1)}%`,
    `geschreven=${written}`,
    `typen=${commonTypes || "-"}`,
  ].join(" | ");
}

async function runProductTypeBackfill(config, logger) {
  if (!config.productTypeSupported) {
    throw new Error("Supabase-kolom products.product_type ontbreekt; voer eerst supabase/migrations/20260908091354_add_product_type.sql uit.");
  }
  const products = await fetchExistingProducts(config);
  const classifiedProducts = products.map((product) => ({
    ...product,
    productType: classifyProductType(product),
  }));
  const coverage = productTypeCoverage(classifiedProducts);
  const result = await upsertProductClassifications(config, classifiedProducts);
  logger.info(formatClassificationSummary(coverage, result.written));
}

async function runPriceRefresh(config, logger, startedAt) {
  const existingProducts = await fetchExistingProducts(config);
  const existingPrices = await fetchExistingPriceStates(config);
  const productsWithPriceState = existingProducts.map((product) => ({
    ...product,
    previousPrice: existingPrices.get(product.id) ?? null,
  }));
  const priceWindow = selectPriceShardWindow(
    productsWithPriceState,
    config.priceShardIndex,
    config.priceShardCount,
    config.maxProducts,
    config.priceCycleIndex,
  );
  const selected = priceWindow.products;
  if (selected.length === 0) {
    throw new Error(
      `Prijsdeelbatch ${config.priceShardIndex + 1}/${config.priceShardCount} bevat geen valide productpagina's.`,
    );
  }
  logger.info(
    `Start prijsupdate ${config.priceShardIndex + 1}/${config.priceShardCount}: `
      + `${selected.length} van ${priceWindow.totalInShard} producten in deze shard; `
      + `venster ${priceWindow.windowIndex + 1}/${priceWindow.windowCount}.`,
  );

  const writeResult = { imported: [], errors: [], duplicateSKUsSkipped: 0 };
  const persistBatch = async (batch) => {
    const result = await upsertProducts(config, batch);
    writeResult.imported.push(...result.imported);
    writeResult.errors.push(...result.errors);
    writeResult.duplicateSKUsSkipped += result.duplicateSKUsSkipped;
    logger.info(`Tussentijds opgeslagen: ${writeResult.imported.length} prijsupdates.`);
  };
  const { stats } = await refreshExistingProducts(config, selected, logger, {
    onBatch: persistBatch,
    persistBatchSize: 10,
  });
  for (const error of writeResult.errors) {
    logger.error(`Prijsupdate overgeslagen (${error.sku}): ${error.message}`);
  }
  logger.info(`Prijsupdate geslaagd: ${writeResult.imported.length} producten bijgewerkt.`);
  logger.info(formatPriceRefreshSummary({
    ...stats,
    priceShardIndex: config.priceShardIndex,
    priceShardCount: config.priceShardCount,
    priceWindowIndex: priceWindow.windowIndex,
    priceWindowCount: priceWindow.windowCount,
    totalInShard: priceWindow.totalInShard,
    writtenProducts: writeResult.imported.length,
    writeErrors: writeResult.errors.length,
    durationMs: Date.now() - startedAt,
  }));
}

export async function main() {
  const startedAt = Date.now();
  const config = loadConfig();
  const logger = safeLogger([config.supabaseSecret]);
  config.productTypeSupported = config.dryRun ? true : await hasProductTypeColumn(config);
  if (!config.productTypeSupported) {
    logger.info("Producttype-opslag nog niet actief: products.product_type ontbreekt; bestaande imports blijven veilig werken.");
  }
  if (config.updateMode === "classify") {
    await runProductTypeBackfill(config, logger);
    return;
  }
  if (config.updateMode === "prices") {
    await runPriceRefresh(config, logger, startedAt);
    return;
  }
  if (config.updateMode === "growth") {
    if (config.dryRun) {
      throw new Error("Catalogusgroei met runregistratie ondersteunt geen DRY_RUN; gebruik catalog voor een bron-dry-run.");
    }
    const result = await runCatalogGrowth(config, logger);
    if (!result.targetReached) {
      throw new Error(
        `Catalogusgroeidoel niet gehaald: ${result.actualGrowth}/${result.targetNewProducts} `
          + `nieuwe producten; stopreden=${result.stopReason}.`,
      );
    }
    return;
  }
  const existingSKUs = config.dryRun ? new Set() : await fetchExistingSKUs(config);
  const writeResult = {
    imported: [], errors: [], duplicateSKUsSkipped: 0,
    newProductsWritten: 0, existingProductsUpdated: 0,
  };
  logger.info(
    `Start catalogusbatch '${config.catalogBatch}' met ${config.searchTerms.length} zoektermen; `
      + `maximum ${config.maxNewProducts} nieuwe en ${config.maxProducts} totaal; `
      + `maximaal ${config.maxPerTerm} producten en ${config.maxPagesPerTerm} pagina's per zoekterm.`,
  );
  if (config.catalogNewOnly) {
    logger.info("Automatische productontdekking: bekende SKU's worden overgeslagen; alleen volledig gevalideerde nieuwe SKU's worden toegevoegd. Dagelijkse prijsupdates houden bestaande producten actueel.");
  }
  if (!config.dryRun) logger.info(`Bestaande Supabase-SKU's geladen: ${existingSKUs.size}.`);
  const persistBatch = async (batch) => {
    const result = await upsertProducts(config, batch);
    writeResult.imported.push(...result.imported);
    writeResult.errors.push(...result.errors);
    writeResult.duplicateSKUsSkipped += result.duplicateSKUsSkipped;
    for (const product of result.imported) {
      if (existingSKUs.has(product.sku)) writeResult.existingProductsUpdated += 1;
      else writeResult.newProductsWritten += 1;
    }
    logger.info(`Tussentijds opgeslagen: ${writeResult.imported.length} producten.`);
  };
  const { products, stats } = await collectProducts(
    config,
    logger,
    {
      existingSKUs,
      ...(config.dryRun ? {} : { onBatch: persistBatch, persistBatchSize: 10 }),
    },
  );

  if (config.dryRun) {
    logger.info(`Dry-run geslaagd: ${products.length} echte producten gevalideerd; niets geschreven.`);
    logger.info(formatBatchSummary({
      ...stats, catalogBatch: config.catalogBatch, writtenProducts: 0,
      newProductsWritten: 0, existingProductsUpdated: 0,
      writeErrors: 0, durationMs: Date.now() - startedAt,
    }));
    for (const line of formatTermCoverage(stats.termCoverage)) logger.info(line);
    return;
  }

  const {
    imported, errors, duplicateSKUsSkipped, newProductsWritten, existingProductsUpdated,
  } = writeResult;
  for (const error of errors) logger.error(`Supabase-product overgeslagen (${error.sku}): ${error.message}`);
  if (products.length === 0 && stats.existingSKUsDiscovered > 0) {
    logger.info(`Ontdekking geslaagd: geen nieuwe SKU's; ${stats.existingSKUsDiscovered} bestaande SKU's herkend.`);
  } else {
    logger.info(`Import geslaagd: ${imported.length} producten en gekoppelde prijzen ge-upsert.`);
  }
  for (const product of imported) {
    logger.info(`${product.sku} | ${product.name} | €${product.price.toFixed(2)}`);
  }
  logger.info(formatBatchSummary({
    ...stats,
    catalogBatch: config.catalogBatch,
    duplicateSKUsSkipped: stats.duplicateSKUsSkipped + duplicateSKUsSkipped,
    writtenProducts: imported.length,
    newProductsWritten,
    existingProductsUpdated,
    writeErrors: errors.length,
    durationMs: Date.now() - startedAt,
  }));
  for (const line of formatTermCoverage(stats.termCoverage)) logger.info(line);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    if (error instanceof SourceBlockedError) {
      console.error(`STOP: ${error.message} Er wordt geen omzeiling geprobeerd.`);
    } else {
      console.error(`Import mislukt: ${error instanceof Error ? error.message : "onbekende fout"}`);
    }
    process.exitCode = 1;
  });
}
