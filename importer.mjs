import { loadConfig } from "./config.mjs";
import { collectProducts, SourceBlockedError } from "./hoogvliet.mjs";
import { upsertProducts } from "./supabase.mjs";

function safeLogger() {
  return {
    info(message) {
      console.log(String(message));
    },
    error(message) {
      console.error(String(message));
    },
  };
}

async function main() {
  const logger = safeLogger();
  const config = loadConfig();
  logger.info(`Start beperkte import (maximum ${config.maxProducts} producten).`);
  const products = await collectProducts(config, logger);

  if (config.dryRun) {
    logger.info(`Dry-run geslaagd: ${products.length} echte producten gevalideerd; niets geschreven.`);
    return;
  }

  const imported = await upsertProducts(config, products);
  logger.info(`Import geslaagd: ${imported.length} producten en gekoppelde prijzen ge-upsert.`);
  for (const product of imported) {
    logger.info(`${product.sku} | ${product.name} | €${product.price.toFixed(2)}`);
  }
}

main().catch((error) => {
  if (error instanceof SourceBlockedError) {
    console.error(`STOP: ${error.message} Er wordt geen omzeiling geprobeerd.`);
  } else {
    console.error(`Import mislukt: ${error instanceof Error ? error.message : "onbekende fout"}`);
  }
  process.exitCode = 1;
});
