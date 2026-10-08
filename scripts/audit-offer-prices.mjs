import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { isValidProductURL, validateCandidate } from "../src/hoogvliet.mjs";
import { requestHeaders } from "../src/supabase.mjs";

const PAGE_SIZE = 1000;
const SAMPLE_SIZE = 5;
const RED_BULL = Object.freeze({
  sku: "733741000",
  name: "Red Bull Pistache winter edition",
  sourceURL: "https://hoogvliet.nl/product/red-bull-pistache-winter-edition-733741000",
});

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function validProductURL(value) {
  return isValidProductURL(value);
}

function apiURL(base, table, select) {
  const url = new URL(`/rest/v1/${table}`, base);
  url.searchParams.set("select", select);
  return url;
}

async function fetchAllRows(base, key, table, select, order) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const url = apiURL(base, table, select);
    url.searchParams.set("order", order);
    const response = await fetch(url, {
      method: "GET",
      headers: {
        ...requestHeaders(key, "count=exact"),
        Range: `${offset}-${offset + PAGE_SIZE - 1}`,
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Read-only Production-audit GET ${table} faalde (HTTP ${response.status}).`);
    const page = await response.json();
    if (!Array.isArray(page)) throw new Error(`Read-only Production-audit gaf geen rijlijst voor ${table}.`);
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

export function auditPriceRows(prices) {
  const total = prices.length;
  const offers = prices.filter(price => price.is_offer === true);
  const validOldComparison = prices.filter(price => positive(price.old_price) != null && positive(price.price) != null
    && Number(price.old_price) > Number(price.price));
  const suspicious = validOldComparison.filter(price => price.is_offer !== true);
  const offersWithoutValidOldPrice = offers.filter(price => {
    const current = positive(price.price);
    const old = positive(price.old_price);
    return current == null || old == null || old <= current;
  });
  const invalidPrices = prices.filter(price => positive(price.price) == null);
  return {
    total,
    isOfferTrue: offers.length,
    priceBelowOldPrice: validOldComparison.length,
    suspiciousOldPriceWithoutOffer: suspicious.length,
    offersWithoutValidOldPrice: offersWithoutValidOldPrice.length,
    invalidPrices: invalidPrices.length,
  };
}

function sampleRows(prices, products) {
  const byID = new Map(products.map(product => [product.id, product]));
  const usable = prices.filter(price => {
    const product = byID.get(price.product_id);
    return product && validProductURL(product.source_url) && /^\d{9}$/.test(String(product.sku));
  });
  // A stored comparison pair is the useful audit population even when the
  // importer previously forgot to set is_offer. Filtering on is_offer here
  // would hide precisely the suspected regression we need to measure.
  const offerRows = usable
    .filter(price => positive(price.old_price) > positive(price.price))
    .sort((a, b) => String(byID.get(a.product_id).sku).localeCompare(String(byID.get(b.product_id).sku)))
    .slice(0, SAMPLE_SIZE);
  const offerIDs = new Set(offerRows.map(price => price.product_id));
  const regularRows = usable
    .filter(price => price.is_offer !== true && positive(price.old_price) == null && !offerIDs.has(price.product_id))
    .sort((a, b) => String(byID.get(a.product_id).sku).localeCompare(String(byID.get(b.product_id).sku)))
    .slice(0, SAMPLE_SIZE);
  return {
    offers: offerRows.map(price => ({ ...byID.get(price.product_id), databasePrice: price })),
    regular: regularRows.map(price => ({ ...byID.get(price.product_id), databasePrice: price })),
  };
}

async function validateSample(browser, candidates) {
  const results = [];
  for (const candidate of candidates) {
    const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
    const page = await context.newPage();
    let forbiddenRequest = null;
    page.on("request", request => {
      const method = request.method();
      const url = new URL(request.url());
      const isHoogvliet = ["hoogvliet.nl", "www.hoogvliet.com"].includes(url.hostname);
      const allowedGraphQLRead = method === "POST"
        && isHoogvliet
        && url.pathname === "/api/graphql";
      const mutatingHoogvlietRequest = ["POST", "PUT", "PATCH", "DELETE"].includes(method)
        && isHoogvliet
        && !allowedGraphQLRead;
      if (mutatingHoogvlietRequest) forbiddenRequest = `${method} ${url.origin}${url.pathname}`;
    });
    try {
      const diagnostics = {};
      const product = await validateCandidate(page, {
        sku: String(candidate.sku),
        sourceURL: candidate.source_url,
        searchTerm: "audit:offer-price",
      }, diagnostics);
      results.push({
        sku: String(candidate.sku),
        name: candidate.name,
        page: diagnostics.page ?? null,
        parser: diagnostics.parser ?? null,
        database: candidate.databasePrice,
        observed: product ? {
          price: product.price,
          oldPrice: product.oldPrice,
          isOffer: product.isOffer,
          offerText: product.offerText,
          validFrom: product.validFrom,
          validUntil: product.validUntil,
        } : null,
        reason: diagnostics.reason ?? null,
        forbiddenRequest,
      });
    } finally {
      await context.close();
    }
  }
  return results;
}

function outcomeCounts(results, expectedOffer) {
  return results.reduce((summary, result) => {
    const observed = result.observed;
    const correct = expectedOffer
      ? Boolean(observed?.isOffer && positive(observed.oldPrice) > positive(observed.price))
      : Boolean(observed && !observed.isOffer && observed.oldPrice == null);
    summary.total += 1;
    summary.correct += Number(correct);
    return summary;
  }, { total: 0, correct: 0 });
}

export async function runOfferPriceAudit(env = process.env) {
  const base = String(env.SUPABASE_URL ?? "").trim();
  const key = String(env.SUPABASE_SECRET_KEY ?? "").trim();
  if (!base || !key) throw new Error("Read-only offer-audit mist Supabase-configuratie.");
  const [prices, products] = await Promise.all([
    fetchAllRows(base, key, "product_prices", "product_id,price,old_price,is_offer,offer_text,valid_from,valid_until,fetched_at,updated_at", "product_id.asc"),
    fetchAllRows(base, key, "products", "id,sku,name,source_url", "id.asc"),
  ]);
  const database = auditPriceRows(prices);
  const samples = sampleRows(prices, products);
  if (samples.offers.length < SAMPLE_SIZE || samples.regular.length < SAMPLE_SIZE) {
    throw new Error(`Read-only offer-audit kon geen 5+5 representatieve Production-SKU's selecteren (offers=${samples.offers.length}, regular=${samples.regular.length}, database=${JSON.stringify(database)}).`);
  }
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });
  try {
    const redBull = await validateSample(browser, [{ ...RED_BULL, source_url: RED_BULL.sourceURL }]);
    const offers = await validateSample(browser, samples.offers);
    const regular = await validateSample(browser, samples.regular);
    return {
      mode: "read-only",
      database,
      redBull: redBull[0],
      samples: {
        offers,
        regular,
        offersCorrect: outcomeCounts(offers, true),
        regularCorrect: outcomeCounts(regular, false),
      },
      writes: { product: 0, price: 0 },
      forbiddenRequests: [...redBull, ...offers, ...regular].filter(result => result.forbiddenRequest),
    };
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runOfferPriceAudit().then(result => {
    console.log(JSON.stringify(result, null, 2));
    if (!result.redBull.observed?.isOffer
      || result.redBull.observed.price !== 1.39
      || result.redBull.observed.oldPrice !== 1.72
      || result.samples.offersCorrect.correct !== result.samples.offersCorrect.total
      || result.samples.regularCorrect.correct !== result.samples.regularCorrect.total
      || result.forbiddenRequests.length > 0) {
      process.exitCode = 1;
    }
  }).catch(error => {
    console.error(`Read-only offer-audit failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  });
}
