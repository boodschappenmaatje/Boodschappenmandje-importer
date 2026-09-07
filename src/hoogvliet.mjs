import { chromium } from "playwright";

const BASE_URL = "https://www.hoogvliet.com";
const SEARCH_PATH = "/INTERSHOP/web/WFS/org-webshop-Site/nl_NL/-/EUR/ViewTWParametricSearch-SimpleOfferSearch";

export class SourceBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = "SourceBlockedError";
  }
}

export function parsePriceText(value) {
  if (typeof value !== "string") return null;
  const normalized = value.replace(/\u00a0/g, " ").replace(/\s+/g, "");
  const match = normalized.match(/\d+[.,]\d{2}/);
  if (!match) return null;
  const amount = Number.parseFloat(match[0].replace(",", "."));
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

export function weightInGrams(packageText) {
  if (typeof packageText !== "string") return null;
  const normalized = packageText.toLowerCase().replace(/,/g, ".").replace(/\u00a0/g, " ");
  if (/\d+\s*[x×]/.test(normalized)) return null;
  const match = normalized.match(/(^|\s)(\d+(?:\.\d+)?)\s*(kg|kilogram|g|gr|gram)(?:\s|$)/);
  if (!match) return null;
  const value = Number.parseFloat(match[2]);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(match[3] === "kg" || match[3] === "kilogram" ? value * 1000 : value);
}

export function isValidSKU(value) {
  return typeof value === "string" && /^\d{9}$/.test(value);
}

export function isValidProductURL(value) {
  try {
    const url = new URL(value, BASE_URL);
    return url.protocol === "https:" && url.hostname === "www.hoogvliet.com" && url.pathname.startsWith("/product/");
  } catch {
    return false;
  }
}

export function parseOfferPeriod(value, referenceDate = new Date()) {
  if (typeof value !== "string") return null;
  const months = new Map([
    ["januari", 1], ["februari", 2], ["maart", 3], ["april", 4],
    ["mei", 5], ["juni", 6], ["juli", 7], ["augustus", 8],
    ["september", 9], ["oktober", 10], ["november", 11], ["december", 12],
  ]);
  const normalized = value.toLowerCase().replace(/\u00a0/g, " ").replace(/\s+/g, " ");
  const match = normalized.match(
    /van\s+(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?\s+(?:t\/m|tot en met)\s+(\d{1,2})\s+([a-z]+)(?:\s+(\d{4}))?/,
  );
  if (!match) return null;
  const startMonth = months.get(match[2]);
  const endMonth = months.get(match[5]);
  if (!startMonth || !endMonth) return null;
  const defaultYear = referenceDate.getUTCFullYear();
  const startYear = Number.parseInt(match[3] ?? String(defaultYear), 10);
  const endYear = Number.parseInt(match[6] ?? String(endMonth < startMonth ? startYear + 1 : startYear), 10);
  const startDay = Number.parseInt(match[1], 10);
  const endDay = Number.parseInt(match[4], 10);
  const validDate = (year, month, day) => {
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  };
  if (!validDate(startYear, startMonth, startDay) || !validDate(endYear, endMonth, endDay)) return null;
  const format = (year, month, day) => `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return {
    validFrom: format(startYear, startMonth, startDay),
    validUntil: format(endYear, endMonth, endDay),
  };
}

function clean(value) {
  if (typeof value !== "string") return null;
  const result = value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  return result || null;
}

function absoluteURL(value) {
  if (!value) return null;
  try {
    const url = new URL(value, BASE_URL);
    return url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

function searchURL(term) {
  const url = new URL(SEARCH_PATH, BASE_URL);
  url.searchParams.set("PageNumber", "0");
  url.searchParams.set("PageSize", "40");
  url.searchParams.set("SelectedSearchResult", "SFProductSearch");
  url.searchParams.set("SearchTerm", term);
  url.searchParams.set("SelectedItem", "");
  url.searchParams.set("SortingOption", "");
  url.searchParams.set("CategoryName", "");
  url.searchParams.set("CategoryTitle", "");
  url.searchParams.set("SearchTermKey", "");
  return url.href;
}

async function detectBlocking(page) {
  const evidence = await page.evaluate(() => {
    const text = (document.body?.innerText ?? "").toLowerCase();
    return {
      captcha: /captcha|verify you are human|controleer of je een mens bent/.test(text),
      denied: /access denied|toegang geweigerd|forbidden/.test(text),
    };
  });
  if (evidence.captcha || evidence.denied) {
    throw new SourceBlockedError("Hoogvliet blokkeert de browsersessie met een toegangscontrole of CAPTCHA.");
  }
}

async function acceptCookiesIfShown(page) {
  const button = page.getByRole("button", { name: /alles accepteren|accepteren|akkoord/i }).first();
  if (await button.isVisible({ timeout: 1200 }).catch(() => false)) {
    await button.click({ timeout: 3000 }).catch(() => {});
  }
}

async function extractSearchCandidates(page) {
  return page.evaluate(() => {
    const cleanText = (value) => (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() || null;
    const price = (element) => {
      if (!element) return null;
      const match = cleanText(element.textContent)?.replace(/\s+/g, "").match(/\d+[.,]\d{2}/);
      return match ? Number(match[0].replace(",", ".")) : null;
    };

    return Array.from(document.querySelectorAll(".product-tile")).map((tile) => {
      const form = tile.querySelector("form[id^='productDetailForm_']");
      const titleLink = tile.querySelector("a.product-title");
      const trackingElement = tile.querySelector("[data-track-click]");
      let tracking = {};
      try {
        tracking = JSON.parse(trackingElement?.getAttribute("data-track-click") || "{}").products?.[0] || {};
      } catch {}
      const spinner = tile.querySelector(".spinner");
      return {
        sku: (tile.id || "").replace("product-tile_", ""),
        name: cleanText(titleLink?.textContent),
        brand: cleanText(tracking.brand),
        category: cleanText(tracking.category || tracking.categoryName),
        packageText: cleanText(form?.querySelector(".ratio-base-packing-unit")?.textContent),
        displayedPrice: price(tile.querySelector(".kor-product-sale-price-value")),
        sourceURL: titleLink?.href || null,
        imageURL: tile.querySelector("img.product-image")?.src || null,
        available: spinner ? Number(spinner.getAttribute("maxqty") || "0") > 0 : null,
      };
    });
  });
}

async function searchOnce(page, term) {
  await page.goto(searchURL(term), { waitUntil: "domcontentloaded", timeout: 35_000 });
  await page.waitForFunction(
    () => document.querySelectorAll(".product-tile").length > 0 || document.querySelector(".pagination-total"),
    { timeout: 12_000 },
  ).catch(() => {});
  await detectBlocking(page);
  return extractSearchCandidates(page);
}

async function searchUsingVisibleForm(page, term) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 35_000 });
  await acceptCookiesIfShown(page);
  const input = page.locator("input[name='SearchTerm']").first();
  if (!(await input.isVisible({ timeout: 5000 }).catch(() => false))) return [];
  await input.fill(term);
  await input.press("Enter");
  await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => {});
  await page.waitForSelector(".product-tile", { timeout: 12_000 }).catch(() => {});
  await detectBlocking(page);
  return extractSearchCandidates(page);
}

async function findCandidates(page, term) {
  let candidates = await searchOnce(page, term);
  if (candidates.length === 0) candidates = await searchUsingVisibleForm(page, term);

  const seen = new Set();
  return candidates.filter((candidate) => {
    candidate.name = clean(candidate.name);
    candidate.brand = clean(candidate.brand);
    candidate.category = clean(candidate.category);
    candidate.packageText = clean(candidate.packageText);
    candidate.sourceURL = absoluteURL(candidate.sourceURL);
    candidate.imageURL = absoluteURL(candidate.imageURL);
    if (!isValidSKU(candidate.sku) || !candidate.name || !isValidProductURL(candidate.sourceURL)) return false;
    if (seen.has(candidate.sku)) return false;
    seen.add(candidate.sku);
    return true;
  });
}

async function extractProductDetails(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".product-details");
    if (!root) return null;
    const cleanText = (value) => (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() || null;
    const price = (element) => {
      if (!element) return null;
      const match = cleanText(element.textContent)?.replace(/\s+/g, "").match(/\d+[.,]\d{2}/);
      return match ? Number(match[0].replace(",", ".")) : null;
    };
    const form = root.querySelector("form[id^='productDetailForm_']");
    const offerPeriod = Array.from(document.querySelectorAll("h3"))
      .map((element) => cleanText(element.textContent))
      .find((text) => /Aanbieding is geldig/i.test(text || "")) || null;
    const breadcrumbs = Array.from(document.querySelectorAll(".breadcrumb a, nav[aria-label*='breadcrumb' i] a"))
      .map((element) => cleanText(element.textContent)).filter(Boolean);

    return {
      sku: (form?.id || "").replace("productDetailForm_", ""),
      name: cleanText(root.querySelector("h1")?.textContent),
      packageText: cleanText(root.querySelector(".unitPrice .ratio-base-packing-unit")?.textContent)
        || cleanText(root.querySelector(".ratio-base-packing-unit")?.textContent),
      displayPrice: price(root.querySelector(".price-display-container"))
        || price(root.querySelector(".kor-product-sale-price-value")),
      regularPrice: price(root.querySelector(".kor-product-sale-price-value")),
      offerPrice: price(root.querySelector(".product-promo-price")),
      promotionText: cleanText(root.querySelector(".promotion-short-title")?.textContent),
      offerPeriod,
      imageURL: root.querySelector("img.product-image")?.src || null,
      category: breadcrumbs.length > 1 ? breadcrumbs.at(-1) : null,
    };
  });
}

async function validateCandidate(page, candidate) {
  await page.goto(candidate.sourceURL, { waitUntil: "domcontentloaded", timeout: 35_000 });
  await page.waitForSelector(".product-details", { timeout: 12_000 }).catch(() => {});
  await detectBlocking(page);
  const details = await extractProductDetails(page);
  if (!details || details.sku !== candidate.sku || !isValidSKU(details.sku)) return null;

  const name = clean(details.name);
  const packageText = clean(details.packageText);
  if (!name || !packageText) return null;

  const promotionText = clean(details.promotionText);
  const offerText = clean(details.offerPeriod);
  const period = parseOfferPeriod(offerText, new Date());
  const simpleOffer = Boolean(period && promotionText?.toLowerCase().startsWith("per "));
  const regularPrice = details.regularPrice ?? (!simpleOffer ? details.displayPrice : null);
  const currentPrice = simpleOffer ? (details.offerPrice ?? details.displayPrice) : regularPrice;
  if (!(Number.isFinite(currentPrice) && currentPrice > 0)) return null;

  return {
    supermarket: "Hoogvliet",
    sku: details.sku,
    name,
    brand: candidate.brand,
    category: clean(details.category) ?? candidate.category,
    packageText,
    weightGrams: weightInGrams(packageText),
    imageURL: absoluteURL(details.imageURL) ?? candidate.imageURL,
    sourceURL: candidate.sourceURL,
    isAvailable: candidate.available,
    price: Number(currentPrice.toFixed(2)),
    oldPrice: simpleOffer && regularPrice && regularPrice > currentPrice
      ? Number(regularPrice.toFixed(2))
      : null,
    isOffer: Boolean(simpleOffer),
    offerText: simpleOffer ? [promotionText, offerText].filter(Boolean).join(" · ") : null,
    validFrom: simpleOffer ? period.validFrom : null,
    validUntil: simpleOffer ? period.validUntil : null,
    fetchedAt: new Date().toISOString(),
  };
}

export function claimCandidateSKU(candidate, seenSKUs, stats, termStats = null) {
  if (seenSKUs.has(candidate.sku)) {
    stats.duplicateSKUsSkipped += 1;
    if (termStats) termStats.duplicates += 1;
    return false;
  }
  seenSKUs.add(candidate.sku);
  stats.uniqueSKUs = (stats.uniqueSKUs ?? 0) + 1;
  if (termStats) termStats.unique += 1;
  return true;
}

export function prioritizeCandidates(candidates, existingSKUs) {
  return [...candidates].sort((left, right) => (
    Number(existingSKUs.has(left.sku)) - Number(existingSKUs.has(right.sku))
  ));
}

export function recordCatalogProduct(sku, existingSKUs, stats, termStats = null) {
  if (existingSKUs.has(sku)) {
    stats.existingProducts += 1;
    if (termStats) termStats.existing += 1;
    return "existing";
  }
  stats.newProducts += 1;
  if (termStats) termStats.new += 1;
  return "new";
}

export function catalogLimitReached(stats, config, totalProducts) {
  return totalProducts >= config.maxProducts || stats.newProducts >= config.maxNewProducts;
}

export async function collectProducts(config, logger = console, options = {}) {
  const startedAt = Date.now();
  const onBatch = typeof options.onBatch === "function" ? options.onBatch : null;
  const persistBatchSize = Math.max(1, Math.min(options.persistBatchSize ?? 10, 25));
  const existingSKUs = options.existingSKUs instanceof Set ? options.existingSKUs : new Set();
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
  const searchPage = await context.newPage();
  const detailPage = await context.newPage();
  const chosen = [];
  const pendingPersistence = [];
  const attemptedSKUs = new Set();
  const stats = {
    configuredSearchTerms: config.searchTerms.length,
    searchedTerms: 0,
    candidatesFound: 0,
    uniqueSKUs: 0,
    existingProducts: 0,
    newProducts: 0,
    validatedProducts: 0,
    duplicateSKUsSkipped: 0,
    invalidProductsSkipped: 0,
    productErrors: 0,
    searchErrors: 0,
    termCoverage: {},
    durationMs: 0,
  };

  try {
    await searchPage.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 35_000 });
    await acceptCookiesIfShown(searchPage);

    for (const term of config.searchTerms) {
      if (catalogLimitReached(stats, config, chosen.length)) break;
      logger.info(`Zoeken: ${term}`);
      stats.searchedTerms += 1;
      const termStats = {
        candidates: 0,
        unique: 0,
        duplicates: 0,
        validated: 0,
        existing: 0,
        new: 0,
        skipped: 0,
        errors: 0,
      };
      stats.termCoverage[term] = termStats;
      let candidates;
      try {
        candidates = prioritizeCandidates(await findCandidates(searchPage, term), existingSKUs);
        stats.candidatesFound += candidates.length;
        termStats.candidates = candidates.length;
      } catch (error) {
        if (error instanceof SourceBlockedError) throw error;
        stats.searchErrors += 1;
        termStats.errors += 1;
        logger.error(`Zoekterm overgeslagen (${term}): ${error instanceof Error ? error.message : "onbekende fout"}`);
        continue;
      }
      let acceptedForTerm = 0;

      for (const candidate of candidates) {
        if (catalogLimitReached(stats, config, chosen.length) || acceptedForTerm >= config.maxPerTerm) break;
        if (!claimCandidateSKU(candidate, attemptedSKUs, stats, termStats)) continue;
        let product;
        try {
          product = await validateCandidate(detailPage, candidate);
        } catch (error) {
          if (error instanceof SourceBlockedError) throw error;
          stats.productErrors += 1;
          termStats.errors += 1;
          logger.error(`Product overgeslagen (${candidate.sku}): ${error instanceof Error ? error.message : "onbekende fout"}`);
          continue;
        }
        if (!product) {
          stats.invalidProductsSkipped += 1;
          termStats.skipped += 1;
          continue;
        }
        chosen.push(product);
        pendingPersistence.push(product);
        acceptedForTerm += 1;
        stats.validatedProducts += 1;
        termStats.validated += 1;
        recordCatalogProduct(product.sku, existingSKUs, stats, termStats);
        logger.info(`Gevalideerd: ${product.sku} | ${product.name} | €${product.price.toFixed(2)}`);
        if (onBatch && pendingPersistence.length >= persistBatchSize) {
          await onBatch(pendingPersistence.splice(0, pendingPersistence.length));
        }
        await detailPage.waitForTimeout(250);
      }
    }
    if (onBatch && pendingPersistence.length > 0) {
      await onBatch(pendingPersistence.splice(0, pendingPersistence.length));
    }
  } finally {
    await context.close();
    await browser.close();
  }

  if (chosen.length === 0) {
    throw new Error("De Hoogvliet-bron leverde geen volledig valideerbare producten op.");
  }
  stats.durationMs = Date.now() - startedAt;
  return { products: chosen, stats };
}
