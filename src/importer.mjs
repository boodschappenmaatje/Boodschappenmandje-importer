import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.mjs";
import { collectProducts, SourceBlockedError } from "./hoogvliet.mjs";
import { fetchExistingSKUs, upsertProducts } from "./supabase.mjs";

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
    `kandidaten=${stats.candidatesFound}`,
    `unieke_SKUs=${stats.uniqueSKUs}`,
    `nieuwe_SKUs=${stats.newProducts}`,
    `bestaande_SKUs=${stats.existingProducts}`,
    `gevalideerd=${stats.validatedProducts}`,
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
    `${term}: ${value.new ?? 0} nieuw, ${value.existing ?? 0} bestaand`
  ));
  const lines = [];
  for (let index = 0; index < entries.length; index += termsPerLine) {
    lines.push(`Dekking per zoekterm | ${entries.slice(index, index + termsPerLine).join(" | ")}`);
  }
  return lines;
}

export async function main() {
  const startedAt = Date.now();
  const config = loadConfig();
  const logger = safeLogger([config.supabaseSecret]);
  const existingSKUs = config.dryRun ? new Set() : await fetchExistingSKUs(config);
  const writeResult = {
    imported: [], errors: [], duplicateSKUsSkipped: 0,
    newProductsWritten: 0, existingProductsUpdated: 0,
  };
  logger.info(
    `Start catalogusbatch '${config.catalogBatch}' met ${config.searchTerms.length} zoektermen; `
      + `maximum ${config.maxNewProducts} nieuwe en ${config.maxProducts} totaal.`,
  );
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
  logger.info(`Import geslaagd: ${imported.length} producten en gekoppelde prijzen ge-upsert.`);
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
