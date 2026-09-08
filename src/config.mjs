export const catalogBatches = Object.freeze({
  core: Object.freeze([
    "gehakt", "rundergehakt", "kip", "kipfilet", "varkensvlees", "worst",
    "hamburger", "shoarma", "vis", "zalm", "tonijn", "pasta", "spaghetti",
    "macaroni", "lasagne", "rijst", "brood", "bolletjes", "croissant", "melk",
    "yoghurt", "kwark", "kaas", "boter", "margarine", "room",
  ]),
  fresh: Object.freeze([
    "aardappelen", "groente", "groenten", "tomaat", "paprika", "ui",
    "komkommer", "wortel", "sla", "broccoli", "bloemkool", "appel", "banaan",
    "sinaasappel", "fruit", "cola", "sinas", "frisdrank", "water", "sap",
    "limonade", "chips", "koek", "chocolade", "snoep", "nootjes",
  ]),
  world: Object.freeze([
    "noodles", "wraps", "taco", "tortilla", "nasi", "bami", "curry", "knorr",
    "honig", "maaltijdmix", "pastasaus", "tomatensaus", "saus", "mayonaise",
    "ketchup", "pizza", "patat", "friet", "kroket", "frikandel", "kipnuggets",
    "diepvries", "snacks",
  ]),
  pantry: Object.freeze([
    "soep", "bonen", "tomatenblokjes", "mais", "kruiden", "bloem", "suiker",
    "olie", "koffie", "thee", "ontbijtgranen", "havermout", "beschuit",
    "crackers", "beleg", "pindakaas", "jam", "hagelslag", "eieren", "meel",
    "bakproducten", "conserven", "peulvruchten", "azijn", "zout", "peper",
  ]),
});

const DEFAULT_BATCH = "core";
const DEFAULT_UPDATE_MODE = "catalog";
const UPDATE_MODES = new Set(["catalog", "prices"]);
const DEFAULT_MAX_PRODUCTS = 10;
const SAFE_PRODUCT_LIMIT = 200;
const DEFAULT_MAX_NEW_PRODUCTS = 50;
const SAFE_NEW_PRODUCT_LIMIT = 150;
const DEFAULT_MAX_PER_TERM = 2;
const SAFE_PER_TERM_LIMIT = 10;
const DEFAULT_PRICE_SHARD_COUNT = 7;
const SAFE_PRICE_SHARD_COUNT = 31;

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env = process.env) {
  const dryRun = env.DRY_RUN === "1" || env.DRY_RUN === "true";
  const updateMode = (env.UPDATE_MODE ?? DEFAULT_UPDATE_MODE).trim().toLowerCase();
  if (!UPDATE_MODES.has(updateMode)) {
    throw new Error(`Ongeldige UPDATE_MODE '${updateMode}'. Kies: catalog of prices.`);
  }
  const catalogBatch = (env.CATALOG_BATCH ?? DEFAULT_BATCH).trim().toLowerCase();
  if (!Object.hasOwn(catalogBatches, catalogBatch)) {
    throw new Error(`Ongeldige CATALOG_BATCH '${catalogBatch}'. Kies: ${Object.keys(catalogBatches).join(", ")}.`);
  }

  const hasSearchOverride = env.SEARCH_TERMS != null;
  const searchTerms = (hasSearchOverride
    ? String(env.SEARCH_TERMS).split(",")
    : catalogBatches[catalogBatch])
    .map((value) => value.trim())
    .filter(Boolean);

  if (searchTerms.length === 0) {
    throw new Error("SEARCH_TERMS bevat geen bruikbare zoektermen.");
  }

  const maxProducts = Math.min(
    positiveInteger(env.MAX_PRODUCTS, DEFAULT_MAX_PRODUCTS),
    SAFE_PRODUCT_LIMIT,
  );
  const maxNewProducts = Math.min(
    positiveInteger(env.MAX_NEW_PRODUCTS, DEFAULT_MAX_NEW_PRODUCTS),
    maxProducts,
    SAFE_NEW_PRODUCT_LIMIT,
  );
  const priceShardCount = Math.min(
    positiveInteger(env.PRICE_SHARD_COUNT, DEFAULT_PRICE_SHARD_COUNT),
    SAFE_PRICE_SHARD_COUNT,
  );
  const priceShardIndex = Number.parseInt(env.PRICE_SHARD_INDEX ?? "0", 10);
  if (!Number.isInteger(priceShardIndex) || priceShardIndex < 0 || priceShardIndex >= priceShardCount) {
    throw new Error(
      `Ongeldige PRICE_SHARD_INDEX '${env.PRICE_SHARD_INDEX ?? "0"}'; gebruik 0 t/m ${priceShardCount - 1}.`,
    );
  }

  const config = {
    dryRun,
    headless: env.HEADLESS !== "0",
    updateMode,
    catalogBatch: hasSearchOverride ? "custom" : catalogBatch,
    maxProducts,
    maxNewProducts,
    maxPerTerm: Math.min(
      positiveInteger(env.MAX_PER_TERM, DEFAULT_MAX_PER_TERM),
      maxProducts,
      SAFE_PER_TERM_LIMIT,
    ),
    searchTerms,
    priceShardCount,
    priceShardIndex,
    supabaseURL: env.SUPABASE_URL?.trim(),
    supabaseSecret: env.SUPABASE_SECRET_KEY?.trim(),
  };

  if (!dryRun) {
    if (!config.supabaseURL) throw new Error("SUPABASE_URL is niet ingesteld.");
    if (!config.supabaseSecret) throw new Error("SUPABASE_SECRET_KEY is niet ingesteld.");
  }

  return config;
}

export const limits = Object.freeze({
  defaultBatch: DEFAULT_BATCH,
  defaultUpdateMode: DEFAULT_UPDATE_MODE,
  defaultMaxProducts: DEFAULT_MAX_PRODUCTS,
  safeProductLimit: SAFE_PRODUCT_LIMIT,
  defaultMaxNewProducts: DEFAULT_MAX_NEW_PRODUCTS,
  safeNewProductLimit: SAFE_NEW_PRODUCT_LIMIT,
  safePerTermLimit: SAFE_PER_TERM_LIMIT,
  defaultPriceShardCount: DEFAULT_PRICE_SHARD_COUNT,
  safePriceShardCount: SAFE_PRICE_SHARD_COUNT,
});
