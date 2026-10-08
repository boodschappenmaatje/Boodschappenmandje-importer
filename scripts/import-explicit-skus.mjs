import { pathToFileURL } from "node:url";
import { loadConfig } from "../src/config.mjs";
import { hasProductTypeColumn } from "../src/supabase.mjs";
import { readExplicitSKUCSV, runExplicitSKUImport, DEFAULT_CATCH_UP_MAX } from "../src/explicit-sku-catch-up.mjs";

function parseArguments(argv) {
  const args = { file: null, max: DEFAULT_CATCH_UP_MAX, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--file") args.file = argv[++index];
    else if (value === "--max") args.max = Number.parseInt(argv[++index], 10);
    else if (value === "--dry-run") args.write = false;
    else if (value === "--write") args.write = true;
    else if (value === "--help" || value === "-h") args.help = true;
    else throw new Error(`Onbekende optie '${value}'. Gebruik --file <csv> [--max N] [--dry-run|--write].`);
  }
  if (!args.help && !args.file) throw new Error("Gebruik --file <csv>; standaard is read-only dry-run. Schrijven vereist --write.");
  if (!Number.isInteger(args.max) || args.max < 1 || args.max > DEFAULT_CATCH_UP_MAX) {
    throw new Error(`--max moet 1 t/m ${DEFAULT_CATCH_UP_MAX} zijn.`);
  }
  return args;
}
export async function main(argv = process.argv.slice(2)) {
  const args = parseArguments(argv);
  if (args.help) {
    console.log("Gebruik: npm run import:skus -- --file <missing.csv> [--max 400] [--dry-run|--write]");
    console.log("Default: dry-run/read-only. Alleen --write mag product- en prijswrites uitvoeren.");
    return;
  }
  const input = await readExplicitSKUCSV(args.file, { maxBatchSize: args.max });
  const config = loadConfig({
    ...process.env,
    CATALOG_BATCH: "growth",
    UPDATE_MODE: "growth",
    DRY_RUN: args.write ? "0" : "1",
    MAX_PRODUCTS: String(args.max),
    MAX_NEW_PRODUCTS: String(args.max),
  });
  config.catchUpMax = args.max;
  config.catchUpWrite = args.write;
  config.productTypeSupported = await hasProductTypeColumn(config);
  const result = await runExplicitSKUImport(config, input, console);
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`Catch-up mislukt: ${error instanceof Error ? error.message : "onbekende fout"}`);
    process.exitCode = 1;
  });
}
