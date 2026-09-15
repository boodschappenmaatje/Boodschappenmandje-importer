export const catalogBatches = {
  core: Object.freeze([
    "gehakt", "rundergehakt", "kip", "kipfilet", "varkensvlees", "worst",
    "hamburger", "shoarma", "biefstuk", "schnitzel", "rookworst", "braadworst",
    "gehaktbal", "vis", "zalm", "tonijn", "garnalen", "vissticks", "pasta",
    "spaghetti", "macaroni", "lasagne", "penne", "fusilli", "rijst", "brood",
    "volkorenbrood", "witbrood", "bolletjes", "croissant", "melk", "yoghurt",
    "kwark", "kaas", "boter", "margarine", "room",
  ]),
  fresh: Object.freeze([
    "aardappelen", "groente", "groenten", "tomaat", "paprika", "ui",
    "komkommer", "wortel", "sla", "broccoli", "bloemkool", "courgette", "prei",
    "spinazie", "andijvie", "sperziebonen", "champignons", "knoflook", "avocado",
    "appel", "banaan", "peer", "druiven", "mandarijn", "sinaasappel", "citroen",
    "fruit", "cola", "sinas", "frisdrank", "water", "sap", "vruchtensap",
    "limonade", "energiedrank", "chips", "koek", "chocolade", "snoep", "nootjes",
  ]),
  world: Object.freeze([
    "noodles", "wraps", "taco", "tortilla", "nasi", "bami", "curry", "knorr",
    "honig", "maaltijdmix", "pastasaus", "tomatensaus", "saus", "mayonaise",
    "ketchup", "woksaus", "sojasaus", "sambal", "pesto", "couscous", "bulgur",
    "naan", "roti", "pizza", "patat", "friet", "kroket", "frikandel",
    "kipnuggets", "ijs", "diepvriesgroente", "diepvries", "snacks",
  ]),
  pantry: Object.freeze([
    "soep", "bonen", "tomatenblokjes", "mais", "kruiden", "bloem", "suiker",
    "olie", "koffie", "thee", "ontbijtgranen", "havermout", "beschuit",
    "crackers", "beleg", "pindakaas", "jam", "hagelslag", "eieren", "meel",
    "bakproducten", "conserven", "peulvruchten", "azijn", "zout", "peper",
    "toiletpapier", "keukenpapier", "wasmiddel", "vaatwastabletten", "afwasmiddel",
    "allesreiniger", "vuilniszakken", "shampoo", "tandpasta", "luiers",
    "kattenvoer", "hondenvoer",
  ]),
  growth: Object.freeze([]),
};

// De groeibatch gebruikt dezelfde bewezen zoektermen. Duplicaten worden één
// keer verwijderd; de persistente cursor roteert de startpositie per run.
catalogBatches.growth = Object.freeze([
  ...new Set([
    ...catalogBatches.core,
    ...catalogBatches.fresh,
    ...catalogBatches.world,
    ...catalogBatches.pantry,
  ]),
]);
Object.freeze(catalogBatches);

const DEFAULT_BATCH = "core";
const DEFAULT_UPDATE_MODE = "catalog";
const UPDATE_MODES = new Set(["catalog", "prices", "classify", "growth"]);
const DEFAULT_MAX_PRODUCTS = 10;
const SAFE_PRODUCT_LIMIT = 500;
const DEFAULT_MAX_NEW_PRODUCTS = 50;
const SAFE_NEW_PRODUCT_LIMIT = 400;
const DEFAULT_MAX_PER_TERM = 2;
const SAFE_PER_TERM_LIMIT = 40;
const DEFAULT_MAX_PAGES_PER_TERM = 1;
const SAFE_PAGES_PER_TERM_LIMIT = 8;
const DEFAULT_PRICE_SHARD_COUNT = 7;
const SAFE_PRICE_SHARD_COUNT = 31;

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function nonNegativeInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function loadConfig(env = process.env) {
  const dryRun = env.DRY_RUN === "1" || env.DRY_RUN === "true";
  const updateMode = (env.UPDATE_MODE ?? DEFAULT_UPDATE_MODE).trim().toLowerCase();
  if (!UPDATE_MODES.has(updateMode)) {
    throw new Error(`Ongeldige UPDATE_MODE '${updateMode}'. Kies: catalog, prices, classify of growth.`);
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
    maxPagesPerTerm: Math.min(
      positiveInteger(env.MAX_PAGES_PER_TERM, DEFAULT_MAX_PAGES_PER_TERM),
      SAFE_PAGES_PER_TERM_LIMIT,
    ),
    catalogNewOnly: env.CATALOG_NEW_ONLY === "1" || env.CATALOG_NEW_ONLY === "true",
    searchTerms,
    priceShardCount,
    priceShardIndex,
    priceCycleIndex: nonNegativeInteger(env.PRICE_CYCLE_INDEX, 0),
    importTrigger: ["schedule", "manual", "test"].includes(env.IMPORT_TRIGGER)
      ? env.IMPORT_TRIGGER
      : "manual",
    discoveryStateKey: (env.DISCOVERY_STATE_KEY ?? "daily-catalog-growth")
      .trim()
      .replace(/[^a-z0-9_-]/gi, "-")
      .slice(0, 80) || "daily-catalog-growth",
    advanceDiscoveryState: env.ADVANCE_DISCOVERY_STATE !== "0"
      && env.ADVANCE_DISCOVERY_STATE !== "false",
    preferNewProducts: env.PREFER_NEW_PRODUCTS !== "0"
      && env.PREFER_NEW_PRODUCTS !== "false",
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
  defaultMaxPagesPerTerm: DEFAULT_MAX_PAGES_PER_TERM,
  safePagesPerTermLimit: SAFE_PAGES_PER_TERM_LIMIT,
  defaultPriceShardCount: DEFAULT_PRICE_SHARD_COUNT,
  safePriceShardCount: SAFE_PRICE_SHARD_COUNT,
});
