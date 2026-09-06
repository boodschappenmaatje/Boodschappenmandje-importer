const DEFAULT_TERMS = ["gehakt", "kip", "cola", "honig", "sinas"];
const ABSOLUTE_PRODUCT_LIMIT = 10;

function positiveInteger(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function loadConfig(env = process.env) {
  const dryRun = env.DRY_RUN === "1" || env.DRY_RUN === "true";
  const searchTerms = (env.SEARCH_TERMS ?? DEFAULT_TERMS.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (searchTerms.length === 0) {
    throw new Error("SEARCH_TERMS bevat geen bruikbare zoektermen.");
  }

  const maxProducts = Math.min(
    positiveInteger(env.MAX_PRODUCTS, ABSOLUTE_PRODUCT_LIMIT),
    ABSOLUTE_PRODUCT_LIMIT,
  );

  const config = {
    dryRun,
    headless: env.HEADLESS !== "0",
    maxProducts,
    maxPerTerm: Math.min(positiveInteger(env.MAX_PER_TERM, 2), maxProducts),
    searchTerms,
    supabaseURL: env.SUPABASE_URL?.trim(),
    supabaseSecret: env.SUPABASE_SECRET_KEY?.trim(),
  };

  if (!dryRun) {
    if (!config.supabaseURL) throw new Error("SUPABASE_URL is niet ingesteld.");
    if (!config.supabaseSecret) throw new Error("SUPABASE_SECRET_KEY is niet ingesteld.");
  }

  return config;
}

export const limits = Object.freeze({ absoluteProductLimit: ABSOLUTE_PRODUCT_LIMIT });
