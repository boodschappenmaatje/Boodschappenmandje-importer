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
  return [
    "Batchstatistieken",
    `zoektermen=${stats.searchedTerms}/${stats.configuredSearchTerms}`,
    `kandidaten=${stats.candidatesFound}`,
    `gevalideerd=${stats.validatedProducts}`,
    `dubbele_SKUs=${stats.duplicateSKUsSkipped}`,
    `ongeldig_overgeslagen=${stats.invalidProductsSkipped}`,
    `productfouten=${stats.productErrors}`,
    `zoekfouten=${stats.searchErrors}`,
    `geschreven=${stats.writtenProducts}`,
    `schrijffouten=${stats.writeErrors}`,
    `fouten_totaal=${totalErrors}`,
    `duur=${(stats.durationMs / 1000).toFixed(1)}s`,
  ].join(" | ");
}

export async function main() {
  const startedAt = Date.now();
  const config = loadConfig();
  const logger = safeLogger([config.supabaseSecret]);
  logger.info(`Start beperkte import (maximum ${config.maxProducts} producten).`);
  const { products, stats } = await collectProducts(config, logger);

  if (config.dryRun) {
    logger.info(`Dry-run geslaagd: ${products.length} echte producten gevalideerd; niets geschreven.`);
    logger.info(formatBatchSummary({ ...stats, writtenProducts: 0, writeErrors: 0, durationMs: Date.now() - startedAt }));
    return;
  }

  const { imported, errors, duplicateSKUsSkipped } = await upsertProducts(config, products);
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
