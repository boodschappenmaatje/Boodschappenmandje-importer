import { collectGrowthCandidates } from "./growth-collector.mjs";
import { categoryDiscoveryRoute } from "./discovery-routes.mjs";
import { chromium } from "playwright";
import { classifyProductType, UNKNOWN_PRODUCT_TYPE } from "./product-type.mjs";

const BASE_URL = "https://www.hoogvliet.com";
const SEARCH_PATH = "/INTERSHOP/web/WFS/org-webshop-Site/nl_NL/-/EUR/ViewTWParametricSearch-SimpleOfferSearch";
const NORMAL_SOURCE_READY_TIMEOUT_MS = 12_000;
const SECURITY_CHECK_READY_TIMEOUT_MS = 45_000;

// One shared serial navigation budget for listing and detail pages. Browser
// subresources remain normal; no identity/header changes or challenge handling.
export function createSourcePacer({ delayMs = 2000, now = Date.now,
  wait = ms => new Promise(resolve => setTimeout(resolve, ms)) } = {}) {
  let last = null;
  return async () => {
    if (last !== null) await wait(Math.max(0, delayMs - (now() - last)));
    last = now();
  };
}
const sourcePacers = new WeakMap();
async function sourceGoto(page, url, options) {
  await sourcePacers.get(page)?.();
  return page.goto(url, options);
}

export async function verifyNormalSourceAccess(config) {
  const browser = await chromium.launch({ headless: config.headless });
  try {
    const context = await browser.newContext({ locale: 'nl-NL', timezoneId: 'Europe/Amsterdam' });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 35_000 });
    await waitForSourceContent(page, "input[name='SearchTerm']", { normalTimeoutMs: 5000 });
    if (!(await readSourcePageEvidence(page, "input[name='SearchTerm']")).hasExpectedContent) {
      throw new SourceUnavailableError('Normale openbare startpagina niet beschikbaar.');
    }
  } finally { await browser.close(); }
}

export class SourceBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = "SourceBlockedError";
    this.code = "source_challenge";
  }
}

export class SourceUnavailableError extends SourceBlockedError {
  constructor(message) {
    super(message);
    this.name = "SourceUnavailableError";
    this.code = "source_unavailable";
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

export function isReliableCatalogProduct(product) {
  return isValidSKU(product?.sku)
    && Boolean(clean(product?.name))
    && Boolean(clean(product?.packageText))
    && isValidProductURL(product?.sourceURL)
    && Number.isFinite(product?.price)
    && product.price > 0;
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

export function isOfferPeriodActive(period, referenceDate = new Date()) {
  if (!period?.validFrom || !period?.validUntil || Number.isNaN(referenceDate.getTime())) return false;
  const day = referenceDate.toISOString().slice(0, 10);
  return period.validFrom <= day && day <= period.validUntil;
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

const SEARCH_PAGE_SIZE = 40;

// Intershop's search treats '+' differently from the visible form's '%20'.
// URLSearchParams also recodes existing %20 when changing only PageNumber.
function sourceSearchURL(url) {
  return url.href.replaceAll("+", "%20");
}

export function searchURL(term, pageNumber = 0) {
  const category = categoryDiscoveryRoute(term);
  if (String(term).startsWith("category:") && !category) {
    throw new SourceUnavailableError("Onbekende categorieroute.");
  }
  const url = new URL(SEARCH_PATH, BASE_URL);
  url.searchParams.set("PageNumber", String(pageNumber));
  url.searchParams.set("PageSize", String(category ? 16 : SEARCH_PAGE_SIZE));
  url.searchParams.set("SelectedSearchResult", "SFProductSearch");
  url.searchParams.set("SearchTerm", category ? "" : term);
  url.searchParams.set("SelectedItem", "");
  url.searchParams.set("SortingOption", category ? "Relevantie" : "");
  url.searchParams.set("CategoryName", category?.id ?? "");
  url.searchParams.set("CategoryTitle", category ? `Producten--${category.title}` : "");
  url.searchParams.set("SearchTermKey", "");
  return sourceSearchURL(url);
}

export function classifySourcePageEvidence(evidence = {}) {
  // Expected source content wins over incidental security markup. Hoogvliet
  // can leave an Incapsula resource script in an otherwise usable page.
  if (evidence.hasExpectedContent) return "ready";
  if (evidence.captcha || evidence.denied) return "blocked";
  if (evidence.hasExplicitEmptyState) return "empty";
  // De bron kan na de initiële loader een volledige websiteschil renderen,
  // terwijl de productdata nog steeds door de normale broncontrole wordt
  // tegengehouden. Een grote HTML-response is daarom geen bewijs van een
  // geldige productresponse; alleen de verwachte inhoud is dat.
  if (evidence.hasIncapsula) return "security_check";
  return "empty";
}

const SPECIFIC_CHALLENGE_MARKERS = [
  /(?:^|[^a-z])_incapsula_resource(?:[^a-z]|$)/i,
  /(?:^|[^a-z])incap_ses_[a-z0-9]+/i,
  /(?:^|[^a-z])visid_incap_[a-z0-9]+/i,
  /request unsuccessful/i,
  /verify you are human/i,
  /controleer of je een mens bent/i,
];

/**
 * Classifies a fetched source response without treating arbitrary page text
 * or a provider-side error as proof of a challenge. Parsed source content is
 * deliberately checked first because challenge markup can coexist with real
 * Hoogvliet content.
 */
export function classifySourceResponse({
  status = null, html = "", hasExpectedContent = false,
  hasUsableProductData = false, hasUsableListingData = false,
} = {}) {
  if (hasExpectedContent || hasUsableProductData || hasUsableListingData) return "VALID_SOURCE";
  const body = typeof html === "string" ? html : "";
  const explicitChallenge = status === 403 || status === 429
    || SPECIFIC_CHALLENGE_MARKERS.some(marker => marker.test(body));
  if (explicitChallenge) return "CHALLENGE";
  return "UNKNOWN";
}

async function readSourcePageEvidence(page, expectedSelector = null) {
  return page.evaluate((selector) => {
    const text = (document.body?.innerText ?? "").toLowerCase();
    return {
      captcha: /captcha|verify you are human|controleer of je een mens bent/.test(text),
      denied: /access denied|toegang geweigerd|forbidden/.test(text),
      hasExpectedContent: Boolean(selector && document.querySelector(selector)),
      hasExplicitEmptyState: /geen (?:producten|zoekresultaten)|geen resultaten gevonden|niks kunnen vinden|niets gevonden|0 resultaten/.test(text),
      hasIncapsula: Boolean(document.querySelector("script[src*='_Incapsula_Resource']")),
      bodyTextLength: text.trim().length,
      htmlLength: document.documentElement?.outerHTML?.length ?? 0,
    };
  }, expectedSelector);
}

async function detectBlocking(page, expectedSelector = null) {
  const evidence = await readSourcePageEvidence(page, expectedSelector);
  if (classifySourcePageEvidence(evidence) === "blocked") {
    throw new SourceBlockedError("Hoogvliet blokkeert de browsersessie met een toegangscontrole of CAPTCHA.");
  }
  return evidence;
}

export async function waitForSourceContent(page, expectedSelector, options = {}) {
  const waitForExpectedContent = (timeout) => page.waitForFunction(
    (selector) => {
      const text = (document.body?.innerText ?? "").toLowerCase();
      return Boolean(document.querySelector(selector))
        || /captcha|verify you are human|controleer of je een mens bent/.test(text)
        || /access denied|toegang geweigerd|forbidden/.test(text)
        || /geen resultaten gevonden|niks kunnen vinden/.test(text);
    },
    expectedSelector,
    { timeout },
  );

  await waitForExpectedContent(options.normalTimeoutMs ?? NORMAL_SOURCE_READY_TIMEOUT_MS)
    .catch(() => {});
  let evidence = await detectBlocking(page, expectedSelector);
  if (classifySourcePageEvidence(evidence) !== "security_check") {
    return { securityCheckObserved: false, evidence };
  }

  if (typeof options.onSecurityCheck === "function") options.onSecurityCheck();
  await waitForExpectedContent(options.securityTimeoutMs ?? SECURITY_CHECK_READY_TIMEOUT_MS)
    .catch(() => {});
  evidence = await detectBlocking(page, expectedSelector);
  if (classifySourcePageEvidence(evidence) === "security_check") {
    throw new SourceBlockedError(
      "De normale Hoogvliet-veiligheidscontrole (Incapsula) werd niet binnen de wachttijd afgerond.",
    );
  }
  return { securityCheckObserved: true, evidence };
}

async function acceptCookiesIfShown(page) {
  const button = page.getByRole("button", { name: /alles accepteren|accepteren|akkoord/i }).first();
  if (await button.isVisible({ timeout: 1200 }).catch(() => false)) {
    await button.click({ timeout: 3000 }).catch(() => {});
  }
}

export async function extractSearchCandidates(page) {
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

export function searchPaginationEvidence({ currentPage, totalPages, totalProducts, candidateCount, explicitEmpty = false, requestedPage }) {
  if ((totalProducts === 0 || explicitEmpty) && candidateCount === 0) return { sourceExhausted: true, nextPage: 0 };
  if (!Number.isInteger(currentPage) || currentPage < 1 || !Number.isInteger(totalPages)
    || totalPages < currentPage || !Number.isInteger(totalProducts) || totalProducts < candidateCount
    || candidateCount < 1) throw new SourceUnavailableError("Zoekresultaten missen betrouwbare pagineringmetadata.");
  if (requestedPage !== undefined && currentPage !== requestedPage + 1) {
    throw new SourceUnavailableError("Categoriepagina komt niet overeen met de gevraagde cursor.");
  }
  return { sourceExhausted: currentPage === totalPages, nextPage: currentPage, currentPage };
}

async function searchPageResult(page, options) {
  const candidates = await extractSearchCandidates(page);
  if (!options.requirePaginationEvidence) return candidates;
  const evidence = await page.evaluate(() => {
    const root = document.querySelector('#product-search-result');
    const positive = value => /^\d+$/.test(value ?? '') ? Number(value) : null;
    const total = root?.querySelector('.pagination-total')?.textContent?.match(/^\s*([\d.]+)\s+Producten\s*$/i);
    return {
      currentPage: positive(root?.querySelector('.storePageNo')?.getAttribute('data-page-number')),
      totalPages: positive(root?.querySelector('#nrofpages')?.getAttribute('data-page-number')),
      totalProducts: total ? Number(total[1].replaceAll('.', '')) : null,
      explicitEmpty: /geen resultaten gevonden|niks kunnen vinden/i.test(document.querySelector('[role="main"]')?.textContent ?? ""),
    };
  });
  return { candidates, ...searchPaginationEvidence({ ...evidence, candidateCount: candidates.length,
    requestedPage: options.requestedCategoryPage }) };
}

export function resolvedSearchPageURL(resolvedURL, pageNumber) {
  const url = new URL(resolvedURL);
  if (url.origin !== BASE_URL || url.pathname !== SEARCH_PATH || url.username || url.password) {
    throw new SourceUnavailableError("Zoekredirect verlaat het vertrouwde zoekendpoint.");
  }
  url.searchParams.set("PageNumber", String(pageNumber));
  return sourceSearchURL(url);
}

export function verifyCategorySearchRoute(resolvedURL, category) {
  const url = new URL(resolvedSearchPageURL(resolvedURL, 0));
  if (url.searchParams.get("CategoryName") !== category.id || url.searchParams.get("SearchTerm")) {
    throw new SourceUnavailableError("Categoriezoekopdracht verliest de gevraagde broncategorie.");
  }
}

export async function navigateSearchPage(page, term, pageNumber = 0, options = {}) {
  const routes = options.resolvedRoutes;
  const knownRoute = routes?.get(term);
  await sourceGoto(page, knownRoute ? resolvedSearchPageURL(knownRoute, pageNumber) : searchURL(term, pageNumber), { waitUntil: "domcontentloaded", timeout: 35_000 });
  const category = categoryDiscoveryRoute(term);
  if (category) verifyCategorySearchRoute(page.url(), category);
  if (routes) {
    // A term such as fruit redirects to a category and resets PageNumber=0.
    // Keep the resolved category, sorting and page size for all subsequent windows.
    const resolved = resolvedSearchPageURL(page.url(), pageNumber);
    routes.set(term, resolved);
    if (new URL(page.url()).searchParams.get("PageNumber") !== String(pageNumber)) {
      await sourceGoto(page, resolved, { waitUntil: "domcontentloaded", timeout: 35_000 });
      if (category) verifyCategorySearchRoute(page.url(), category);
    }
  }
  return page.url();
}

async function searchOnce(page, term, pageNumber = 0, options = {}) {
  await navigateSearchPage(page, term, pageNumber, options);
  await waitForSourceContent(page, ".product-tile", options);
  return searchPageResult(page, { ...options,
    requestedCategoryPage: categoryDiscoveryRoute(term) ? pageNumber : undefined });
}

async function searchUsingVisibleForm(page, term, options = {}) {
  await page.goto(BASE_URL, { waitUntil: "domcontentloaded", timeout: 35_000 });
  await waitForSourceContent(page, "input[name='SearchTerm']", {
    ...options,
    normalTimeoutMs: 5_000,
  });
  await acceptCookiesIfShown(page);
  const input = page.locator("input[name='SearchTerm']").first();
  if (!(await input.isVisible({ timeout: 5000 }).catch(() => false))) return [];
  await input.fill(term);
  await input.press("Enter");
  await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => {});
  await waitForSourceContent(page, ".product-tile", options);
  return searchPageResult(page, options);
}

export function nextEmptySourceSearchCount(previousCount, rawCandidateCount) {
  return Number(rawCandidateCount) > 0 ? 0 : Math.max(0, Math.trunc(previousCount ?? 0)) + 1;
}

export function normalizedSearchTokens(value) {
  if (typeof value !== "string") return [];
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .match(/[a-z0-9]+/g) ?? [];
}

function tokenMatches(queryToken, productToken) {
  if (queryToken === productToken || productToken.startsWith(queryToken)) return true;
  return productToken.length >= 4 && queryToken.startsWith(productToken);
}

export function isRelevantCandidate(candidate, term) {
  const queryTokens = normalizedSearchTokens(term);
  if (queryTokens.length === 0) return false;
  const productTokens = normalizedSearchTokens(
    [candidate?.name, candidate?.brand, candidate?.category].filter(Boolean).join(" "),
  );
  return queryTokens.every((queryToken) => (
    productTokens.some((productToken) => tokenMatches(queryToken, productToken))
  ));
}

function normalizeCandidate(candidate) {
  const normalized = {
    ...candidate,
    name: clean(candidate?.name),
    brand: clean(candidate?.brand),
    category: clean(candidate?.category),
    packageText: clean(candidate?.packageText),
    sourceURL: absoluteURL(candidate?.sourceURL),
    imageURL: absoluteURL(candidate?.imageURL),
  };
  return isValidSKU(normalized.sku) && normalized.name && isValidProductURL(normalized.sourceURL)
    ? normalized
    : null;
}

export async function collectCandidatePages(fetchPage, term, maxPages, options = {}) {
  const candidates = [];
  const seenSKUs = new Set();
  const seenPageSignatures = options.seenPageSignatures ?? new Set();
  let invalidCandidates = 0;
  let repeatedPageCandidates = 0;
  let stallReason = null;
  let rawCandidates = 0;
  let irrelevantCandidates = 0;
  let duplicateCandidates = 0;
  let pagesFetched = 0;
  let repeatedPageStopped = false;

  const startPage = Math.max(0, Math.trunc(options.startPage ?? 0));
  let sourceExhausted = false;
  let lastPageNumber = startPage;
  let firstPageAliasSkipped = false;

  const snapshot = () => ({ candidates, pagesFetched, rawCandidates, irrelevantCandidates,
    duplicateCandidates, invalidCandidates, repeatedPageCandidates, repeatedPageStopped,
    firstPageAliasSkipped, sourceExhausted, stallReason, stallPage: stallReason ? lastPageNumber : null,
    nextPage: sourceExhausted ? 0 : lastPageNumber + 1 });
  try {
  for (let pageOffset = 0; pageOffset < maxPages; pageOffset += 1) {
    if (options.shouldStop?.()) break;
    const pageNumber = pageOffset === 0 ? startPage : lastPageNumber + 1;
    const pageResult = await fetchPage(pageNumber);
    const pageCandidates = Array.isArray(pageResult) ? pageResult : pageResult?.candidates;
    pagesFetched += 1;
    lastPageNumber = pageNumber;
    if (!Array.isArray(pageCandidates) || pageCandidates.length === 0) {
      sourceExhausted = Array.isArray(pageResult) || pageResult?.sourceExhausted === true;
      if (!sourceExhausted) stallReason = "empty_page_without_end";
      break;
    }
    rawCandidates += pageCandidates.length;

    // SKU-set equality also detects reordering and cycles A -> B -> A.
    const signature = [...new Set(pageCandidates.map(candidate => candidate?.sku
      || JSON.stringify([candidate?.name, candidate?.sourceURL])))].sort().join("|");
    if (seenPageSignatures.has(signature)) {
      repeatedPageCandidates += pageCandidates.length;
      // Sommige Intershop-varianten behandelen PageNumber=0 en 1 allebei als
      // de eerste pagina. Probeer dan één keer pagina 2 voordat discovery de
      // term als werkelijk herhaald/uitgeput markeert.
      if (Array.isArray(pageResult) && startPage === 0 && pageNumber === 1 && !firstPageAliasSkipped) {
        firstPageAliasSkipped = true;
        continue;
      }
      repeatedPageStopped = true;
      // With an explicit category, repeated tiles before the declared final
      // page are a pagination failure, never evidence of category exhaustion.
      stallReason = categoryDiscoveryRoute(term) ? "repeated_category_page" : "repeated_sku_set";
      sourceExhausted = false;
      break;
    }
    seenPageSignatures.add(signature);

    for (const rawCandidate of pageCandidates) {
      const candidate = normalizeCandidate(rawCandidate);
      if (!candidate) { invalidCandidates += 1; continue; }
      if (!categoryDiscoveryRoute(term) && !isRelevantCandidate(candidate, term)) {
        irrelevantCandidates += 1;
        continue;
      }
      if (seenSKUs.has(candidate.sku)) {
        duplicateCandidates += 1;
        continue;
      }
      seenSKUs.add(candidate.sku);
      candidates.push(candidate);
    }
    if (!Array.isArray(pageResult)) {
      if (pageResult.sourceExhausted) { sourceExhausted = true; break; }
      if (!Number.isInteger(pageResult.nextPage) || pageResult.nextPage <= pageNumber) {
        stallReason = "cursor_not_advancing";
        break;
      }
      lastPageNumber = pageResult.nextPage - 1;
    }
  }

  } catch (error) {
    error.pageCollection = snapshot();
    throw error;
  }
  return snapshot();
}

export function isTransientNavigationError(error) {
  if (error?.code === 'source_challenge') return false;
  const value = `${error?.name ?? ""} ${error?.code ?? ""} ${error?.message ?? ""}`.toUpperCase();
  return /ERR_ABORTED|TIMEOUT|TIMEDOUT|NAVIGATION.*FAILED|FRAME.*DETACHED|CONNECTION.*RESET/.test(value);
}

export async function withTransientNavigationRetry(operation, {
  maxRetries = 2,
  onRetry = null,
  wait = (delayMs) => new Promise((resolve) => setTimeout(resolve, delayMs)),
} = {}) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await operation(attempt + 1);
    } catch (error) {
      if (!isTransientNavigationError(error) || attempt >= maxRetries) throw error;
      if (typeof onRetry === "function") onRetry(error, attempt + 1);
      await wait(350 * (attempt + 1));
    }
  }
}

async function findCandidates(page, term, maxPages, options = {}) {
  return collectCandidatePages(async (pageNumber) => {
    return withTransientNavigationRetry(async () => {
      let candidates = await searchOnce(page, term, pageNumber, options);
      if (pageNumber === 0 && !options.requirePaginationEvidence && candidates.length === 0) {
        candidates = await searchUsingVisibleForm(page, term, options);
      }
      return candidates;
    }, {
      maxRetries: options.navigationRetries ?? 2,
      onRetry: options.onRetry,
      wait: async (delayMs) => page.waitForTimeout(delayMs),
    });
  }, term, maxPages, { startPage: options.startPage ?? 0, seenPageSignatures: options.seenPageSignatures, shouldStop: options.shouldStop });
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

export function resolvedProductTypeForRefresh(product, existingProductType, searchTerm) {
  const classified = classifyProductType({ ...product, searchTerm });
  if (classified !== UNKNOWN_PRODUCT_TYPE) return classified;
  return typeof existingProductType === "string" && existingProductType.trim()
    ? existingProductType.trim()
    : UNKNOWN_PRODUCT_TYPE;
}

export async function validateCandidate(page, candidate, diagnostics = null) {
  const fail = (reason) => {
    if (diagnostics) diagnostics.reason = reason;
    return null;
  };
  await sourceGoto(page, candidate.sourceURL, { waitUntil: "domcontentloaded", timeout: 35_000 });
  await waitForSourceContent(page, ".product-details");
  const details = await extractProductDetails(page);
  if (!details) return fail("notFound");
  if (details.sku !== candidate.sku || !isValidSKU(details.sku)) return fail("invalidProduct");

  const name = clean(details.name);
  const packageText = clean(details.packageText);
  if (!name || !packageText) return fail("invalidProduct");

  const promotionText = clean(details.promotionText);
  const offerText = clean(details.offerPeriod);
  const checkedAt = new Date();
  const period = parseOfferPeriod(offerText, checkedAt);
  const simpleOffer = Boolean(
    isOfferPeriodActive(period, checkedAt)
      && promotionText?.toLowerCase().startsWith("per "),
  );
  const regularPrice = details.regularPrice ?? (!simpleOffer ? details.displayPrice : null);
  const currentPrice = simpleOffer ? (details.offerPrice ?? details.displayPrice) : regularPrice;
  if (!(Number.isFinite(currentPrice) && currentPrice > 0)) return fail("invalidPrice");

  const product = {
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
    fetchedAt: checkedAt.toISOString(),
  };
  product.productType = resolvedProductTypeForRefresh(
    product,
    candidate.productType,
    candidate.searchTerm,
  );
  return isReliableCatalogProduct(product) ? product : fail("invalidProduct");
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

function growthNewCount(stats) {
  return stats.persistedTargetActive
    ? (stats.persistedNewProducts ?? 0)
    : (stats.newProducts ?? 0);
}

export function growthStopReason(stats, config, totalProducts, nowMs = Date.now(), startedAtMs = nowMs) {
  if (growthNewCount(stats) >= config.maxNewProducts) return "growth_target_reached";
  if ((stats.uniqueSKUsDiscovered ?? 0) >= config.growthMaxCandidates) return "candidate_safety_limit";
  if ((stats.pagesFetched ?? 0) >= config.growthMaxTotalPages) return "page_safety_limit";
  if (nowMs - startedAtMs >= config.growthMaxRuntimeMs) return "runtime_safety_limit";
  if (config.updateMode !== "growth" && totalProducts >= config.maxProducts) return "product_limit";
  return null;
}

export function catalogLimitReached(stats, config, totalProducts, nowMs = Date.now(), startedAtMs = nowMs) {
  if (config.updateMode === "growth") {
    return growthStopReason(stats, config, totalProducts, nowMs, startedAtMs) !== null;
  }
  const processedProducts = Number.isFinite(stats.processedProducts)
    ? stats.processedProducts
    : totalProducts;
  return processedProducts >= config.maxProducts || stats.newProducts >= config.maxNewProducts;
}

export function finalizeTermDiscoveryStats(termStats, config) {
  const viewed = Math.max(0, termStats.candidates ?? 0);
  const discovered = Math.max(0, termStats.new ?? 0);
  const discoveryYield = viewed > 0 ? discovered / viewed : 0;
  return {
    ...termStats,
    discoveryYield,
    saturated: viewed >= config.saturationMinCandidates
      && discoveryYield < config.saturationYieldThreshold,
  };
}

export function filterDiscoveryCandidates(candidates, existingSKUs, observedExistingSKUs) {
  const newCandidates = [];
  let existingOccurrences = 0;
  for (const candidate of candidates) {
    if (existingSKUs.has(candidate.sku)) {
      existingOccurrences += 1;
      observedExistingSKUs.add(candidate.sku);
    } else {
      newCandidates.push(candidate);
    }
  }
  return {
    candidates: newCandidates,
    existingOccurrences,
    uniqueExistingSKUs: observedExistingSKUs.size,
  };
}

export function isSafeEmptyDiscovery(config, stats, attemptedSKUCount) {
  return Boolean(
    config.catalogNewOnly
      && attemptedSKUCount === 0
      && (stats.existingSKUsDiscovered ?? 0) > 0,
  );
}

export function selectPriceShardWindow(products, shardIndex, shardCount, maxProducts, cycleIndex = 0) {
  if (!Number.isInteger(shardCount) || shardCount < 1) throw new Error("Ongeldig aantal prijsdeelbatches.");
  if (!Number.isInteger(shardIndex) || shardIndex < 0 || shardIndex >= shardCount) {
    throw new Error("Ongeldige prijsdeelbatch.");
  }
  if (!Number.isInteger(maxProducts) || maxProducts < 1) throw new Error("Ongeldige prijsbatchgrootte.");
  if (!Number.isInteger(cycleIndex) || cycleIndex < 0) throw new Error("Ongeldige prijsvenstercyclus.");
  const shard = products
    .filter((product) => isValidSKU(product?.sku) && isValidProductURL(product?.sourceURL))
    .filter((product) => Number(product.sku) % shardCount === shardIndex)
    .sort((left, right) => left.sku.localeCompare(right.sku));
  const windowCount = Math.max(1, Math.ceil(shard.length / maxProducts));
  const windowIndex = cycleIndex % windowCount;
  const start = windowIndex * maxProducts;
  return {
    products: shard.slice(start, start + maxProducts),
    totalInShard: shard.length,
    windowIndex,
    windowCount,
  };
}

export function selectPriceShard(products, shardIndex, shardCount, maxProducts, cycleIndex = 0) {
  return selectPriceShardWindow(products, shardIndex, shardCount, maxProducts, cycleIndex).products;
}

function priceInCents(value) {
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : null;
}

export function describePriceUpdate(previous, current) {
  const previousCents = priceInCents(previous?.price);
  const currentCents = priceInCents(current?.price);
  const previousOffer = previous?.isOffer === true;
  const currentOffer = current?.isOffer === true;
  return {
    changed: previousCents == null || currentCents !== previousCents,
    offerStarted: !previousOffer && currentOffer,
    offerEnded: previousOffer && !currentOffer,
    activeOffer: currentOffer,
  };
}

/// Valideert bestaande Supabase-producten opnieuw via exact dezelfde
/// productpagina- en prijscontrole als de catalogusimport. Hierdoor ontstaat
/// geen tweede prijsengine en kan een mislukte run bestaande data niet wissen.
export async function refreshExistingProducts(config, candidates, logger = console, options = {}) {
  const startedAt = Date.now();
  const onBatch = typeof options.onBatch === "function" ? options.onBatch : null;
  const persistBatchSize = Math.max(1, Math.min(options.persistBatchSize ?? 10, 25));
  const browser = await chromium.launch({ headless: config.headless });
  const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
  const detailPage = await context.newPage();
  const products = [];
  const pendingPersistence = [];
  const stats = {
    selectedProducts: candidates.length,
    checkedProducts: 0,
    foundProducts: 0,
    unchangedPrices: 0,
    changedPrices: 0,
    activeOffers: 0,
    offersStarted: 0,
    offersEnded: 0,
    notFoundProducts: 0,
    invalidPrices: 0,
    validatedProducts: 0,
    invalidProductsSkipped: 0,
    productErrors: 0,
    durationMs: 0,
  };

  try {
    for (const candidate of candidates) {
      let product;
      const diagnostics = {};
      stats.checkedProducts += 1;
      try {
        product = await validateCandidate(detailPage, candidate, diagnostics);
      } catch (error) {
        if (error instanceof SourceBlockedError) throw error;
        stats.productErrors += 1;
        logger.error(`Prijsproduct overgeslagen (${candidate.sku}): ${error instanceof Error ? error.message : "onbekende fout"}`);
        continue;
      }
      if (!product) {
        stats.invalidProductsSkipped += 1;
        if (diagnostics.reason === "notFound") stats.notFoundProducts += 1;
        if (diagnostics.reason === "invalidPrice") stats.invalidPrices += 1;
        logger.info(`Prijscontrole overgeslagen: ${candidate.sku} | reden=${diagnostics.reason ?? "ongeldig_product"}`);
        continue;
      }
      const outcome = describePriceUpdate(candidate.previousPrice, product);
      stats.foundProducts += 1;
      if (outcome.changed) stats.changedPrices += 1;
      else stats.unchangedPrices += 1;
      if (outcome.activeOffer) stats.activeOffers += 1;
      if (outcome.offerStarted) stats.offersStarted += 1;
      if (outcome.offerEnded) stats.offersEnded += 1;
      products.push(product);
      pendingPersistence.push(product);
      stats.validatedProducts += 1;
      logger.info(
        `Prijs gevalideerd: ${product.sku} | ${product.name} | €${product.price.toFixed(2)} | `
          + `${outcome.changed ? "gewijzigd" : "ongewijzigd"}`
          + `${outcome.offerStarted ? " | actie gestart" : ""}`
          + `${outcome.offerEnded ? " | actie beëindigd" : ""}`,
      );
      if (onBatch && pendingPersistence.length >= persistBatchSize) {
        await onBatch(pendingPersistence.splice(0, pendingPersistence.length));
      }
      await detailPage.waitForTimeout(250);
    }
    if (onBatch && pendingPersistence.length > 0) {
      await onBatch(pendingPersistence.splice(0, pendingPersistence.length));
    }
  } finally {
    await context.close();
    await browser.close();
  }

  if (products.length === 0) {
    throw new Error("Geen enkel bestaand Hoogvliet-product kon opnieuw betrouwbaar worden gevalideerd.");
  }
  stats.durationMs = Date.now() - startedAt;
  return { products, stats };
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
  const pace = createSourcePacer();
  sourcePacers.set(searchPage, pace);
  sourcePacers.set(detailPage, pace);
  const chosen = [];
  const pendingPersistence = [];
  const attemptedSKUs = new Set();
  const observedExistingSKUs = new Set();
  const observedCatalogSKUs = new Set();
  const observedNewSKUs = new Set();
  const growthMode = config.updateMode === "growth";
  const initialPageCursor = Math.max(0, Math.trunc(options.initialPageCursor ?? 0));
  let resumePageCursor = initialPageCursor;
  let consecutiveEmptySourceSearches = 0;
  const stats = {
    configuredSearchTerms: config.searchTerms.length,
    searchedTerms: 0,
    pagesFetched: 0,
    rawCandidatesFound: 0,
    candidatesFound: 0,
    irrelevantCandidatesSkipped: 0,
    repeatedPagesStopped: 0,
    existingCandidatesSkipped: 0,
    existingSKUsDiscovered: 0,
    uniqueSKUsDiscovered: 0,
    newSKUsDiscovered: 0,
    uniqueSKUs: 0,
    processedProducts: 0,
    existingProducts: 0,
    newProducts: 0,
    persistedNewProducts: 0,
    persistedTargetActive: Boolean(growthMode && onBatch),
    unknownProductTypes: 0,
    validatedProducts: 0,
    duplicateSKUsSkipped: 0,
    invalidProductsSkipped: 0,
    productErrors: 0,
    searchErrors: 0,
    searchRetries: 0,
    sourceSecurityChecks: 0,
    sourceEmptySearches: 0,
    validationFailures: {},
    stopReason: null,
    lastSearchedTerm: null,
    nextPageCursor: initialPageCursor,
    completedTerms: 0,
    termCoverage: {},
    durationMs: 0,
  };

  const persistPendingProducts = async () => {
    if (!onBatch || pendingPersistence.length === 0) return;
    const batch = pendingPersistence.splice(0, pendingPersistence.length);
    const feedback = await onBatch(batch);
    const persistedNew = Number(feedback?.newProducts);
    if (Number.isFinite(persistedNew) && persistedNew > 0) {
      stats.persistedNewProducts += Math.trunc(persistedNew);
    }
  };

  try {
    await withTransientNavigationRetry(
      () => sourceGoto(searchPage, BASE_URL, { waitUntil: "domcontentloaded", timeout: 35_000 }),
      {
        maxRetries: config.navigationRetries,
        onRetry: (error, attempt) => {
          stats.searchRetries += 1;
          logger.info(`Startpagina opnieuw proberen (${attempt}/${config.navigationRetries}): ${error.message}`);
        },
        wait: async (delayMs) => searchPage.waitForTimeout(delayMs),
      },
    );
    await waitForSourceContent(searchPage, "input[name='SearchTerm']", {
      normalTimeoutMs: 5_000,
      onSecurityCheck: () => {
        stats.sourceSecurityChecks += 1;
        logger.info("Hoogvliet-veiligheidscontrole gedetecteerd; dezelfde sessie krijgt tijd om normaal te laden.");
      },
    });
    await acceptCookiesIfShown(searchPage);

    if (growthMode) {
      const resolvedRoutes = new Map();
      return await collectGrowthCandidates(config, {
        existingSKUs, initialPageCursor, onBatch, persistBatchSize,
        onTermStall: entry => logger.info(`Zoekterm gestald; overige routes gaan door: ${JSON.stringify(entry)}`),
        findCandidates: (term, pages, cursor) => {
          logger.info(`Zoeken: ${term} | vanaf_pagina=${cursor.startPage}`);
          return findCandidates(searchPage, term, pages, {
            ...cursor, resolvedRoutes, navigationRetries: config.navigationRetries, requirePaginationEvidence: true,
          });
        },
        validateCandidate: (candidate, diagnostics) => withTransientNavigationRetry(
          () => validateCandidate(detailPage, candidate, diagnostics), {
            maxRetries: config.navigationRetries,
            wait: (ms) => detailPage.waitForTimeout(ms),
          }),
      });
    }

    for (const term of config.searchTerms) {
      stats.stopReason = growthMode
        ? growthStopReason(stats, config, chosen.length, Date.now(), startedAt)
        : null;
      if (catalogLimitReached(stats, config, chosen.length, Date.now(), startedAt)) break;
      logger.info(`Zoeken: ${term}`);
      stats.searchedTerms += 1;
      stats.lastSearchedTerm = term;
      const termStats = {
        candidates: 0,
        rawCandidates: 0,
        pages: 0,
        irrelevant: 0,
        existingSkipped: 0,
        unique: 0,
        duplicates: 0,
        validated: 0,
        existing: 0,
        new: 0,
        skipped: 0,
        errors: 0,
        sourceExhausted: false,
      };
      stats.termCoverage[term] = termStats;
      let candidates;
      const termStartPage = resumePageCursor;
      try {
        const remainingGrowthPages = growthMode
          ? Math.max(0, config.growthMaxTotalPages - stats.pagesFetched)
          : config.maxPagesPerTerm;
        const requestedPages = growthMode
          ? Math.min(config.growthMaxPagesPerTerm, remainingGrowthPages)
          : config.maxPagesPerTerm;
        if (requestedPages === 0) {
          stats.stopReason = "page_safety_limit";
          break;
        }
        const pageResult = await findCandidates(searchPage, term, requestedPages, {
          startPage: resumePageCursor,
          navigationRetries: config.navigationRetries,
          onRetry: (error, attempt) => {
            stats.searchRetries += 1;
            logger.info(`Zoekterm opnieuw proberen (${term}, ${attempt}/${config.navigationRetries}): ${error.message}`);
          },
          onSecurityCheck: () => {
            stats.sourceSecurityChecks += 1;
            logger.info(`Hoogvliet-veiligheidscontrole bij '${term}'; wachten binnen dezelfde browsersessie.`);
          },
        });
        consecutiveEmptySourceSearches = nextEmptySourceSearchCount(
          consecutiveEmptySourceSearches,
          pageResult.rawCandidates,
        );
        if (pageResult.rawCandidates === 0) stats.sourceEmptySearches += 1;
        if (consecutiveEmptySourceSearches >= 3) {
          const error = new SourceUnavailableError(
            `Drie opeenvolgende zoekroutes leverden geen productdata op; laatste zoekterm: ${term}.`,
          );
          logger.error(
            `Bronstatus | status=${error.code} | opeenvolgende_lege_zoekroutes=${consecutiveEmptySourceSearches}`
              + ` | laatste_term=${term}`,
          );
          throw error;
        }
        resumePageCursor = 0;
        stats.nextPageCursor = pageResult.nextPage;
        candidates = config.preferNewProducts === false
          ? pageResult.candidates
          : prioritizeCandidates(pageResult.candidates, existingSKUs);
        stats.pagesFetched += pageResult.pagesFetched;
        stats.rawCandidatesFound += pageResult.rawCandidates;
        stats.irrelevantCandidatesSkipped += pageResult.irrelevantCandidates;
        stats.duplicateSKUsSkipped += pageResult.duplicateCandidates;
        if (pageResult.repeatedPageStopped) stats.repeatedPagesStopped += 1;
        stats.candidatesFound += candidates.length;
        for (const candidate of candidates) {
          observedCatalogSKUs.add(candidate.sku);
          if (!existingSKUs.has(candidate.sku)) observedNewSKUs.add(candidate.sku);
        }
        stats.uniqueSKUsDiscovered = observedCatalogSKUs.size;
        stats.newSKUsDiscovered = observedNewSKUs.size;
        termStats.candidates = candidates.length;
        termStats.rawCandidates = pageResult.rawCandidates;
        termStats.pages = pageResult.pagesFetched;
        termStats.irrelevant = pageResult.irrelevantCandidates;
        termStats.duplicates += pageResult.duplicateCandidates;
        termStats.sourceExhausted = pageResult.sourceExhausted;
        if (config.catalogNewOnly || growthMode) {
          const discovery = filterDiscoveryCandidates(
            candidates,
            existingSKUs,
            observedExistingSKUs,
          );
          candidates = discovery.candidates;
          stats.existingCandidatesSkipped += discovery.existingOccurrences;
          stats.existingSKUsDiscovered = discovery.uniqueExistingSKUs;
          termStats.existingSkipped = discovery.existingOccurrences;
        }
      } catch (error) {
        if (error instanceof SourceBlockedError) {
          logger.error(
            `Bronstatus | status=${error.code ?? "source_unavailable"} | zoekterm=${term}`
              + ` | detail=${error.message}`,
          );
          throw error;
        }
        stats.searchErrors += 1;
        termStats.errors += 1;
        resumePageCursor = 0;
        stats.nextPageCursor = 0;
        stats.completedTerms += 1;
        stats.termCoverage[term] = finalizeTermDiscoveryStats(termStats, config);
        logger.error(`Zoekterm overgeslagen (${term}): ${error instanceof Error ? error.message : "onbekende fout"}`);
        continue;
      }
      let acceptedForTerm = 0;

      for (const candidate of candidates) {
        stats.stopReason = growthMode
          ? growthStopReason(stats, config, chosen.length, Date.now(), startedAt)
          : null;
        if (catalogLimitReached(stats, config, chosen.length, Date.now(), startedAt)
          || acceptedForTerm >= config.maxPerTerm) break;
        if (!claimCandidateSKU(candidate, attemptedSKUs, stats, termStats)) continue;
        stats.processedProducts += 1;
        let product;
        const diagnostics = {};
        try {
          candidate.searchTerm = term;
          product = await validateCandidate(detailPage, candidate, diagnostics);
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
          const reason = diagnostics.reason ?? "invalidProduct";
          stats.validationFailures[reason] = (stats.validationFailures[reason] ?? 0) + 1;
          logger.info(`Product afgewezen: ${candidate.sku} | reden=${reason}`);
          continue;
        }
        chosen.push(product);
        pendingPersistence.push(product);
        acceptedForTerm += 1;
        stats.validatedProducts += 1;
        if (product.productType === UNKNOWN_PRODUCT_TYPE) stats.unknownProductTypes += 1;
        termStats.validated += 1;
        recordCatalogProduct(product.sku, existingSKUs, stats, termStats);
        logger.info(`Gevalideerd: ${product.sku} | ${product.name} | €${product.price.toFixed(2)}`);
        if (onBatch && pendingPersistence.length >= persistBatchSize) {
          await persistPendingProducts();
        }
        await detailPage.waitForTimeout(250);
      }
      stats.termCoverage[term] = finalizeTermDiscoveryStats(termStats, config);
      const reachedLimit = catalogLimitReached(
        stats,
        config,
        chosen.length,
        Date.now(),
        startedAt,
      );
      if (!reachedLimit) {
        stats.completedTerms += 1;
        stats.nextPageCursor = 0;
      } else {
        stats.nextPageCursor = termStartPage;
      }
    }
    if (onBatch && pendingPersistence.length > 0) {
      await persistPendingProducts();
    }
  } finally {
    await context.close();
    await browser.close();
  }
  if (growthMode && !stats.stopReason) {
    stats.stopReason = growthStopReason(stats, config, chosen.length, Date.now(), startedAt)
      ?? "discovery_exhausted";
  }

  stats.durationMs = Date.now() - startedAt;

  if (chosen.length === 0 && !isSafeEmptyDiscovery(config, stats, attemptedSKUs.size)) {
    logger.error(
      "Importdiagnose"
        + ` | zoekroutes=${stats.searchedTerms}`
        + ` | pagina's=${stats.pagesFetched}`
        + ` | ruwe_kandidaten=${stats.rawCandidatesFound}`
        + ` | geparsed=${stats.candidatesFound}`
        + ` | unieke_skus=${stats.uniqueSKUs}`
        + ` | gevalideerd=${stats.validatedProducts}`
        + ` | afgewezen=${stats.invalidProductsSkipped}`
        + ` | veiligheidscontroles=${stats.sourceSecurityChecks}`
        + ` | afwijsredenen=${JSON.stringify(stats.validationFailures)}`,
    );
    throw new Error("De Hoogvliet-bron leverde geen volledig valideerbare producten op.");
  }
  return { products: chosen, stats };
}
