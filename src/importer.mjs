import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.mjs";
import { collectProducts, SourceBlockedError } from "./hoogvliet.mjs";
import { upsertProducts } from "./supabase.mjs";

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
    `zoektermen=${stats.searchedTerms}/${stats.configuredSearchTerms}`,
    `kandidaten=${stats.candidatesFound}`,
    `unieke_SKUs=${stats.uniqueSKUs}`,
    `gevalideerd=${stats.validatedProducts}`,
    `dubbele_SKUs=${stats.duplicateSKUsSkipped}`,
    `overgeslagen=${skippedProducts}`,
    `ongeldig_overgeslagen=${stats.invalidProductsSkipped}`,
    `productfouten=${stats.productErrors}`,
    `zoekfouten=${stats.searchErrors}`,
    `geschreven=${stats.writtenProducts}`,
    `schrijffouten=${stats.writeErrors}`,
    `fouten_totaal=${totalErrors}`,
    `duur=${(stats.durationMs / 1000).toFixed(1)}s`,
  ].join(" | ");
}

export function formatTermCoverage(termCoverage, termsPerLine = 8) {
  const entries = Object.entries(termCoverage).map(([term, value]) => (
    `${term}: ${value.validated} gevalideerd/${value.unique} uniek`
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
  const writeResult = { imported: [], errors: [], duplicateSKUsSkipped: 0 };
  logger.info(`Start gecontroleerde catalogusimport (maximum ${config.maxProducts} producten).`);
  const persistBatch = async (batch) => {
    const result = await upsertProducts(config, batch);
    writeResult.imported.push(...result.imported);
    writeResult.errors.push(...result.errors);
    writeResult.duplicateSKUsSkipped += result.duplicateSKUsSkipped;
    logger.info(`Tussentijds opgeslagen: ${writeResult.imported.length} producten.`);
  };
  const { products, stats } = await collectProducts(
    config,
    logger,
    config.dryRun ? {} : { onBatch: persistBatch, persistBatchSize: 10 },
  );

  if (config.dryRun) {
    logger.info(`Dry-run geslaagd: ${products.length} echte producten gevalideerd; niets geschreven.`);
    logger.info(formatBatchSummary({ ...stats, writtenProducts: 0, writeErrors: 0, durationMs: Date.now() - startedAt }));
    for (const line of formatTermCoverage(stats.termCoverage)) logger.info(line);
    return;
  }

  const { imported, errors, duplicateSKUsSkipped } = writeResult;
  for (const error of errors) logger.error(`Supabase-product overgeslagen (${error.sku}): ${error.message}`);
  logger.info(`Import geslaagd: ${imported.length} producten en gekoppelde prijzen ge-upsert.`);
  for (const product of imported) {
    logger.info(`${product.sku} | ${product.name} | €${product.price.toFixed(2)}`);
  }
  logger.info(formatBatchSummary({
    ...stats,
    duplicateSKUsSkipped: stats.duplicateSKUsSkipped + duplicateSKUsSkipped,
    writtenProducts: imported.length,
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
