import { collectGrowthCandidates } from "./growth-collector.mjs";
import { categoryDiscoveryRoute, isPublicCatalogDiscoveryTerm } from "./discovery-routes.mjs";
import { chromium } from "playwright";
import { classifyProductType, UNKNOWN_PRODUCT_TYPE } from "./product-type.mjs";

export const BASE_URL = "https://hoogvliet.nl";
export const CATALOG_ROOT_PATH = "/producten";
export const CATALOG_ROOT_URL = `${BASE_URL}${CATALOG_ROOT_PATH}`;
export const PUBLIC_CATALOG_GRAPHQL_URL = `${BASE_URL}/api/graphql`;
// This is the public GetProducts shape observed in the current site's own
// hydration request. The query is deliberately limited to listing fields;
// product detail validation remains the authority before persistence.
export const PUBLIC_CATALOG_GRAPHQL_QUERY = `query GetProducts($pageSize: Int! $currentPage: Int! $filters: ProductAttributeFilterInput! $sort: ProductAttributeSortInput) { products(pageSize: $pageSize currentPage: $currentPage filter: $filters sort: $sort) { items { ... on ProductInterface { id id stock_status name url_key is_promotion promotion_meta_data { korting_label raw_discount_label { text price full_label } valid_from valid_to promotion_id prijs promotie_prijs } metadata catch_weight_item_code webshop: metafield(key: "webshop") { value } price_range { maximum_price { final_price { currency value } } minimum_price { regular_price { value currency } final_price { currency value } discount { percent_off } } } } } } }`;
const NORMAL_SOURCE_READY_TIMEOUT_MS = 12_000;
const SECURITY_CHECK_READY_TIMEOUT_MS = 45_000;
const SENSITIVE_QUERY_KEYS = new Set([
  "authorization", "cookie", "key", "query", "token", "variables",
]);

function safeSourceURL(raw) {
  try {
    const url = new URL(raw, BASE_URL);
    for (const key of [...url.searchParams.keys()]) {
      if (SENSITIVE_QUERY_KEYS.has(key.toLowerCase())) url.searchParams.set(key, "[REDACTED]");
    }
    return url.href;
  } catch {
    return "[invalid-url]";
  }
}

function sourceRequestContext(page, fallback = {}) {
  const request = page.__hoogvlietLastRequest ?? {};
  return {
    routeKey: fallback.routeKey ?? page.__hoogvlietRequestContext?.routeKey ?? "unknown",
    requestType: request.method ?? fallback.requestType ?? "GET",
    requestURL: fallback.requestURL ?? request.url ?? null,
    finalURL: fallback.finalURL ?? request.finalURL ?? page.url?.() ?? null,
    cursor: fallback.cursor ?? page.__hoogvlietRequestContext?.cursor ?? null,
    page: fallback.page ?? page.__hoogvlietRequestContext?.page ?? null,
    categoryURL: fallback.categoryURL ?? page.__hoogvlietRequestContext?.categoryURL ?? null,
    upstreamStatus: fallback.upstreamStatus ?? request.status ?? page.__hoogvlietLastResponseStatus ?? null,
    operationName: fallback.operationName ?? null,
  };
}

function sourceContextSummary(context, classification) {
  return [
    `route=${context.routeKey}`,
    `request_type=${context.requestType}`,
    `request_url=${safeSourceURL(context.requestURL ?? context.finalURL)}`,
    context.finalURL ? `final_url=${safeSourceURL(context.finalURL)}` : null,
    `cursor=${context.cursor ?? "-"}`,
    `page=${context.page ?? "-"}`,
    context.categoryURL ? `category=${safeSourceURL(context.categoryURL)}` : null,
    `upstream_http_status=${context.upstreamStatus ?? "unknown"}`,
    context.operationName ? `graphql_operation=${context.operationName}` : null,
    `classification=${classification}`,
  ].filter(Boolean).join(" | ");
}

function sourceUnavailableError(page, message, fallback = {}) {
  const context = sourceRequestContext(page, fallback);
  const error = new SourceUnavailableError(`${message} | ${sourceContextSummary(context, "source_unavailable")}`);
  error.sourceRequest = context;
  return error;
}

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
async function sourceGoto(page, url, options, requestContext = {}) {
  page.__hoogvlietRequestContext = { ...requestContext, requestURL: url };
  await sourcePacers.get(page)?.();
  try {
    const response = await page.goto(url, options);
    page.__hoogvlietLastResponseStatus = response?.status?.() ?? null;
    const request = response?.request?.();
    page.__hoogvlietLastRequest = {
      method: request?.method?.() ?? "GET",
      url: request?.url?.() ?? url,
      finalURL: response?.url?.() ?? page.url?.() ?? url,
      status: response?.status?.() ?? null,
    };
    return response;
  } catch (error) {
    page.__hoogvlietLastResponseStatus = null;
    page.__hoogvlietLastRequest = {
      method: "GET", url, finalURL: page.url?.() ?? url, status: null,
    };
    error.sourceRequest = sourceRequestContext(page);
    throw error;
  }
}

export async function verifyNormalSourceAccess(config) {
  const browser = await chromium.launch({ headless: config.headless });
  try {
    const context = await browser.newContext({ locale: 'nl-NL', timezoneId: 'Europe/Amsterdam' });
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 35_000 });
    await waitForSourceContent(page, "a[href^='/producten']", { normalTimeoutMs: 5000 });
    if (!(await readSourcePageEvidence(page, "a[href^='/producten']")).hasExpectedContent) {
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

export class ParserStructureChangedError extends SourceBlockedError {
  constructor(message) {
    super(message);
    this.name = "ParserStructureChangedError";
    this.code = "parser_structure_changed";
  }
}

export class RootCategoryDiscoveryError extends ParserStructureChangedError {
  constructor(message) {
    super(message);
    this.name = "RootCategoryDiscoveryError";
    this.code = "root_category_discovery_failed";
  }
}

export class CategoryStructureChangedError extends ParserStructureChangedError {
  constructor(message) {
    super(message);
    this.name = "CategoryStructureChangedError";
    this.code = "category_structure_changed";
  }
}

export class SourceNavigationError extends Error {
  constructor(message, cause = null) {
    super(message, cause ? { cause } : undefined);
    this.name = "SourceNavigationError";
    this.code = "navigation_error";
    this.retryable = true;
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
    // Existing rows may still contain the old www alias, which redirects to
    // the current public host. New listing candidates are canonicalized to
    // hoogvliet.nl below; no legacy listing endpoint is accepted.
    return url.protocol === "https:"
      && ["hoogvliet.nl", "www.hoogvliet.com"].includes(url.hostname)
      && url.pathname.startsWith("/product/");
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

export function searchURL(term, pageNumber = 0) {
  const category = categoryDiscoveryRoute(term);
  if (String(term).startsWith("category:") && !category) {
    throw new SourceUnavailableError("Onbekende categorieroute.");
  }
  if (!category) {
    throw new SourceUnavailableError(
      `Onbekende Hoogvliet-discoveryroute '${term}'; gebruik de actuele openbare catalogusstructuur.`,
    );
  }
  const url = new URL(category.path, BASE_URL);
  // The current site paginates the public listing through its visible
  // load-more control. Do not invent a query cursor here.
  void pageNumber;
  return url.href;
}

const NON_CATALOG_PATHS = new Set([
  "aanbiedingen", "acties", "recepten", "winkels", "service", "contact", "over-hoogvliet",
  "account", "inloggen", "login", "privacy", "privacybeleid", "voorwaarden", "algemene-voorwaarden",
  "nieuws", "nieuwsbrief", "folder", "folders", "klantenservice", "customer", "mijnhoogvliet",
  "spotgoedkoopjes", "kies-mix", "goeie-dagdeals", "gratis-bezorging", "gezond-en-vers",
  "warme-bakker-leen", "wijnen", "sint", "klantenkaart", "zelfscan", "online-bestellen",
  "garanties", "team-hoogvliet", "geschiedenis", "duurzaamheid", "klantenpanel", "sponsoring",
  "intershop",
  "cookies",
]);

export function extractSKUFromProductURL(value) {
  try {
    const url = new URL(value, BASE_URL);
    if (url.protocol !== "https:" || !["hoogvliet.nl", "www.hoogvliet.com"].includes(url.hostname)
      || !url.pathname.startsWith("/product/")) return null;
    const match = url.pathname.replace(/\/$/, "").match(/(?:^|-)(\d{9})$/);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

export function normalizeCatalogCategoryURL(value) {
  try {
    const url = new URL(value, BASE_URL);
    const firstSegment = url.pathname.split("/").filter(Boolean)[0] ?? "";
    if (url.protocol !== "https:" || url.hostname !== "hoogvliet.nl"
      || url.username || url.password || url.search || url.hash
      || url.pathname === CATALOG_ROOT_PATH || url.pathname.startsWith("/product/")
      || !firstSegment || NON_CATALOG_PATHS.has(firstSegment.toLowerCase())) return null;
    return `${BASE_URL}${url.pathname.replace(/\/$/, "")}`;
  } catch {
    return null;
  }
}

export function normalizeCatalogListingCandidate(candidate, categoryURL = CATALOG_ROOT_URL) {
  const sourceURLValue = absoluteURL(candidate?.sourceURL);
  let sourceURL = sourceURLValue;
  try {
    const parsed = new URL(sourceURLValue);
    if (parsed.hostname === "www.hoogvliet.com") {
      parsed.hostname = "hoogvliet.nl";
    }
    parsed.search = "";
    parsed.hash = "";
    sourceURL = parsed.href;
  } catch {}
  const sku = extractSKUFromProductURL(sourceURL);
  const normalized = {
    ...candidate,
    sku,
    name: clean(candidate?.name),
    brand: clean(candidate?.brand),
    category: clean(candidate?.category) || clean(categoryURL?.split("/").at(-1)?.replaceAll("-", " ")),
    packageText: clean(candidate?.packageText),
    sourceURL,
    imageURL: absoluteURL(candidate?.imageURL),
  };
  return isValidSKU(normalized.sku) && normalized.name && isValidProductURL(normalized.sourceURL)
    ? normalized
    : null;
}

function isCatalogRouteTerm(term) {
  return isPublicCatalogDiscoveryTerm(term) || Boolean(normalizeCatalogCategoryURL(term));
}

export function classifySourcePageEvidence(evidence = {}) {
  const responseStatus = Number(evidence.responseStatus);
  if (evidence.navigationError) return "navigation_error";
  if ([404, 408, 425, 429, 500, 502, 503, 504].includes(responseStatus)) return "source_unavailable";
  if (evidence.captcha || evidence.denied || [401, 403].includes(responseStatus)) return "challenge";
  if (evidence.hasExpectedContent || evidence.hasCatalogStructure) return "ready";
  if (evidence.hasExplicitEmptyState || evidence.hasZeroProductCount) return "valid_empty_search";
  // De bron kan na de initiële loader een volledige websiteschil renderen,
  // terwijl de productdata nog steeds door de normale broncontrole wordt
  // tegengehouden. Een grote HTML-response is daarom geen bewijs van een
  // geldige productresponse; alleen de verwachte inhoud is dat.
  if (evidence.hasIncapsula) return "security_check";
  if (evidence.hasSearchStructure || evidence.hasCatalogStructure) return "parser_structure_changed";
  return "parser_structure_changed";
}

async function readCatalogPageEvidence(page) {
  return page.evaluate(({ responseStatus }) => {
    const text = (document.body?.innerText ?? "").toLowerCase();
    const productLinks = document.querySelectorAll("a[href*='/product/']").length;
    const categoryLinks = [...document.querySelectorAll("a[href]")]
      .filter(link => /\/producten(?:\/|$)|\/product\//i.test(link.getAttribute("href") || "")).length;
    return {
      responseStatus,
      captcha: /captcha|verify you are human|controleer of je een mens bent/.test(text),
      denied: /access denied|toegang geweigerd|forbidden/.test(text),
      hasExpectedContent: productLinks > 0,
      hasCatalogStructure: categoryLinks > 0 || document.location.pathname === "/producten",
      hasExplicitEmptyState: /geen (?:producten|zoekresultaten)|geen resultaten gevonden|niks kunnen vinden|niets gevonden|0 producten/.test(text),
      hasZeroProductCount: /(?:^|\s)0\s+producten(?:\s|$)/.test(text),
      productLinks,
      bodyTextLength: text.trim().length,
      htmlLength: document.documentElement?.outerHTML?.length ?? 0,
    };
  }, { responseStatus: page.__hoogvlietLastResponseStatus ?? null });
}

async function waitForCatalogSource(page, options = {}) {
  const expectCategoryLinks = options.expectCategoryLinks === true;
  await page.waitForFunction(({ expectCategoryLinks: expect, nonCatalogPaths }) => {
    const text = (document.body?.innerText ?? "").toLowerCase();
    const hasCategoryLink = [...document.querySelectorAll("a[href]")].some(link => {
      try {
        const url = new URL(link.href, document.location.href);
        const firstSegment = url.pathname.split("/").filter(Boolean)[0]?.toLowerCase() ?? "";
        return url.origin === document.location.origin
          && url.pathname !== "/producten"
          && !url.pathname.startsWith("/product/")
          && !url.search && !url.hash
          && !nonCatalogPaths.includes(firstSegment);
      } catch { return false; }
    });
    return document.querySelectorAll("a[href*='/product/']").length > 0
      || (!expect && document.location.pathname === "/producten")
      || (expect && hasCategoryLink)
      || /geen (?:producten|zoekresultaten)|geen resultaten gevonden|niks kunnen vinden|niets gevonden|0 producten|captcha|verify you are human|controleer of je een mens bent|access denied|toegang geweigerd|forbidden/.test(text);
  }, { expectCategoryLinks, nonCatalogPaths: [...NON_CATALOG_PATHS] }, {
    timeout: options.normalTimeoutMs ?? NORMAL_SOURCE_READY_TIMEOUT_MS,
  }).catch(() => {});
  const evidence = await readCatalogPageEvidence(page);
  const classification = classifySourcePageEvidence(evidence);
  if (classification === "challenge") throw new SourceBlockedError("Hoogvliet blokkeert de catalogusbrowser met een toegangscontrole of CAPTCHA.");
  if (classification === "source_unavailable") {
    throw sourceUnavailableError(page,
      `Hoogvliet gaf een tijdelijke catalogusbronfout (HTTP ${evidence.responseStatus}).`,
      options.requestContext,
    );
  }
  if (classification === "parser_structure_changed") {
    throw new CategoryStructureChangedError("Hoogvliet-catalogus bevat geen herkenbare categorie- of productstructuur.");
  }
  return { evidence, classification };
}

async function readSourcePageEvidence(page, expectedSelector = null) {
  return page.evaluate(({ selector, responseStatus }) => {
    const text = (document.body?.innerText ?? "").toLowerCase();
    return {
      responseStatus,
      captcha: /captcha|verify you are human|controleer of je een mens bent/.test(text),
      denied: /access denied|toegang geweigerd|forbidden/.test(text),
      hasExpectedContent: Boolean(selector && document.querySelector(selector)),
      hasExplicitEmptyState: /geen (?:producten|zoekresultaten)|geen resultaten gevonden|niks kunnen vinden|niets gevonden|0 resultaten/.test(text),
      hasSearchStructure: Boolean(document.querySelector("a[href*='/product/']")),
      hasZeroProductCount: /(?:^|\s)0\s+producten(?:\s|$)/.test(text),
      hasIncapsula: Boolean(document.querySelector("script[src*='_Incapsula_Resource']")),
      bodyTextLength: text.trim().length,
      htmlLength: document.documentElement?.outerHTML?.length ?? 0,
    };
  }, {
    selector: expectedSelector,
    responseStatus: page.__hoogvlietLastResponseStatus ?? null,
  });
}

async function detectBlocking(page, expectedSelector = null) {
  const evidence = await readSourcePageEvidence(page, expectedSelector);
  if (classifySourcePageEvidence(evidence) === "challenge") {
    throw new SourceBlockedError("Hoogvliet blokkeert de browsersessie met een toegangscontrole of CAPTCHA.");
  }
  return evidence;
}

function throwForSourceEvidence(evidence, page = null, requestContext = {}) {
  const classification = classifySourcePageEvidence(evidence);
  if (classification === "source_unavailable") {
    if (page) {
      throw sourceUnavailableError(page,
        `Hoogvliet gaf een tijdelijke bronfout (HTTP ${evidence.responseStatus}).`,
        requestContext,
      );
    }
    throw new SourceUnavailableError(`Hoogvliet gaf een tijdelijke bronfout (HTTP ${evidence.responseStatus}).`);
  }
  if (classification === "parser_structure_changed") {
    throw new ParserStructureChangedError(
      "Hoogvliet-zoekpagina bevat geen herkenbare product- of lege-resultaatstructuur.",
    );
  }
  return classification;
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
  let classification = throwForSourceEvidence(evidence, page, options.requestContext);
  if (classification !== "security_check") {
    return { securityCheckObserved: false, evidence: { ...evidence, classification } };
  }

  if (typeof options.onSecurityCheck === "function") options.onSecurityCheck();
  await waitForExpectedContent(options.securityTimeoutMs ?? SECURITY_CHECK_READY_TIMEOUT_MS)
    .catch(() => {});
  evidence = await detectBlocking(page, expectedSelector);
  classification = throwForSourceEvidence(evidence, page, options.requestContext);
  if (classification === "security_check") {
    throw new SourceBlockedError(
      "De normale Hoogvliet-veiligheidscontrole (Incapsula) werd niet binnen de wachttijd afgerond.",
    );
  }
  return { securityCheckObserved: true, evidence: { ...evidence, classification } };
}

async function acceptCookiesIfShown(page) {
  const button = page.getByRole("button", { name: /alles accepteren|accepteren|akkoord/i }).first();
  if (await button.isVisible({ timeout: 1200 }).catch(() => false)) {
    await button.click({ timeout: 3000 }).catch(() => {});
  }
}

export async function extractCatalogListingCandidates(page) {
  return page.evaluate(() => {
    const cleanText = (value) => (value || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim() || null;
    const price = (element) => {
      if (!element) return null;
      const match = cleanText(element.textContent)?.replace(/\s+/g, "").match(/\d+[.,]\d{2}/);
      return match ? Number(match[0].replace(",", ".")) : null;
    };
    const packagePattern = /\b\d+(?:[.,]\d+)?\s*(?:kg|kilo|kilogram|g|gram|gr|l|liter|ml|milliliter|stuk|stuks)\b/i;
    const cardFor = (link) => link.closest("article, li, [data-testid*='product' i], [class*='product-card' i], [class*='product-tile' i]")
      || link.parentElement || link;
    const cards = new Map();
    for (const link of document.querySelectorAll("a[href*='/product/']")) {
      const sourceURL = link.href;
      if (!/-\d{9}\/?(?:[?#].*)?$/i.test(new URL(sourceURL).pathname)) continue;
      const card = cardFor(link);
      const text = cleanText(card.textContent);
      const title = card.querySelector("h2, h3, h4, [class*='name' i], [class*='title' i]")
        || link;
      const priceElement = card.querySelector("[class*='price' i], [data-testid*='price' i]");
      const image = card.querySelector("img");
      const packageMatch = text?.match(packagePattern);
      const candidate = {
        name: cleanText(title.textContent),
        brand: cleanText(card.querySelector("[class*='brand' i]")?.textContent),
        category: cleanText(document.querySelector("nav[aria-label*='breadcrumb' i] a:last-child, [class*='breadcrumb' i] a:last-child")?.textContent),
        packageText: packageMatch?.[0] ?? null,
        displayedPrice: price(priceElement) ?? price(card),
        sourceURL,
        imageURL: image?.currentSrc || image?.src || null,
        available: card.querySelector("[disabled], [aria-disabled='true']") ? false : null,
      };
      if (!cards.has(sourceURL)) cards.set(sourceURL, candidate);
    }
    return [...cards.values()];
  });
}

async function extractCatalogCategoryLinks(page) {
  const links = await page.evaluate(() => {
    // /producten is a navigation page. Its category tree may be outside
    // <main>, while <main> can already contain unrelated links.
    return [...new Map([...document.querySelectorAll("a[href]")].map(link => [link.href, {
      href: link.href,
      title: (link.textContent || "").replace(/\s+/g, " ").trim() || null,
    }])).values()];
  });
  return links
    .map(({ href, title }) => ({ url: normalizeCatalogCategoryURL(href), title }))
    .filter(route => route.url);
}

async function findLoadMoreControl(page) {
  const controls = page.locator("button, a, [role='button']")
    .filter({ hasText: /producten\s+laden|meer\s+producten|meer\s+laden|laad\s+meer/i });
  for (let index = 0; index < await controls.count(); index += 1) {
    const candidate = controls.nth(index);
    if (await candidate.isVisible({ timeout: 250 }).catch(() => false)) return candidate;
  }
  return null;
}

async function findNextCatalogPageURL(page, currentURL) {
  const links = page.locator("a[href]").filter({ hasText: /^(?:next|volgende)$/i });
  for (let index = 0; index < await links.count(); index += 1) {
    const link = links.nth(index);
    if (!await link.isVisible({ timeout: 250 }).catch(() => false)) continue;
    const href = await link.getAttribute("href");
    if (!href) continue;
    try {
      const next = new URL(href, currentURL);
      const current = new URL(currentURL);
      const listingBase = pathname => pathname.replace(/\/q\/page\/\d+\/?$/i, "").replace(/\/$/, "") || "/";
      if (next.protocol !== "https:" || next.origin !== BASE_URL || next.username || next.password
        || next.hash || listingBase(next.pathname) !== listingBase(current.pathname)
        || next.pathname.startsWith("/product/")) continue;
      next.hash = "";
      if (next.href === current.href) continue;
      return next.href;
    } catch {}
  }
  return null;
}

async function waitForListingGrowth(page, previousCount) {
  return page.waitForFunction(({ previousCount }) => {
    const current = document.querySelectorAll("a[href*='/product/']").length;
    const text = (document.body?.innerText ?? "").toLowerCase();
    return current > previousCount
      || /geen (?:producten|zoekresultaten)|geen resultaten gevonden|niks kunnen vinden|niets gevonden|0 producten/.test(text);
  }, { previousCount }, { timeout: 20_000 }).then(() => true).catch(() => false);
}

function catalogAPIPrice(item) {
  return item?.price_range?.minimum_price?.final_price?.value
    ?? item?.price_range?.maximum_price?.final_price?.value
    ?? null;
}

function catalogAPIPackage(item) {
  let metadata = {};
  try { metadata = typeof item?.metadata === "string" ? JSON.parse(item.metadata) : (item?.metadata ?? {}); }
  catch {}
  const subtitle = item?.sub_title_attributes;
  if (subtitle?.volume && subtitle?.unit) return String(subtitle.volume) + " " + String(subtitle.unit);
  return clean(metadata.verpakking) || null;
}

function catalogAPICategory(item) {
  return [...(item?.categories ?? [])]
    .sort((left, right) => (Number(left?.level) || 0) - (Number(right?.level) || 0))
    .map(category => clean(category?.name))
    .filter(Boolean)
    .at(-1) ?? null;
}

async function fetchPublicCatalogItems(page, skus) {
  const uniqueSKUs = [...new Set(skus.filter(isValidSKU))];
  if (uniqueSKUs.length === 0) return [];
  const response = await page.evaluate(async ({ endpoint, query, variables }) => {
    try {
      const url = new URL(endpoint);
      url.searchParams.set("operationName", "GetProducts");
      url.searchParams.set("query", query);
      url.searchParams.set("variables", JSON.stringify(variables));
      const response = await fetch(url.href, { credentials: "same-origin" });
      let body = null;
      try { body = await response.json(); } catch {}
      return { status: response.status, body, requestURL: url.href, finalURL: response.url };
    } catch (error) {
      return { status: 0, error: error?.message ?? "graphql_fetch_failed" };
    }
  }, {
    endpoint: PUBLIC_CATALOG_GRAPHQL_URL,
    query: PUBLIC_CATALOG_GRAPHQL_QUERY,
    variables: { filters: { sku: { in: uniqueSKUs } }, pageSize: uniqueSKUs.length, currentPage: 1 },
  });
  if (response.status === 401 || response.status === 403) {
    throw new SourceBlockedError("Hoogvliet blokkeert de openbare catalogus-API.");
  }
  if (response.status >= 400 || response.status === 0) {
    throw sourceUnavailableError(page,
      "Hoogvliet gaf een catalogus-API-fout (HTTP " + (response.status || "onbekend") + ").",
      { ...page.__hoogvlietRequestContext, requestType: "GET", requestURL: response.requestURL,
        finalURL: response.finalURL, upstreamStatus: response.status, operationName: "GetProducts" },
    );
  }
  if (Array.isArray(response.body?.errors) && response.body.errors.length > 0) {
    throw new ParserStructureChangedError("De actuele Hoogvliet-catalogus-API heeft een gewijzigde productschema-respons.");
  }
  const items = response.body?.data?.products?.items;
  if (!Array.isArray(items)) {
    throw new ParserStructureChangedError("De actuele Hoogvliet-catalogus-API bevat geen productitems.");
  }
  return items;
}

export async function hydrateCatalogListingCandidates(page, candidates) {
  const domBySKU = new Map(candidates
    .map(candidate => [extractSKUFromProductURL(candidate.sourceURL), candidate])
    .filter(([sku]) => sku));
  const items = await fetchPublicCatalogItems(page, [...domBySKU.keys()]);
  const apiBySKU = new Map(items.map(item => {
    const urlKey = clean(item?.url_key);
    const sku = clean(item?.sku) || (urlKey ? extractSKUFromProductURL(BASE_URL + "/product/" + urlKey) : null);
    return [sku, item];
  }).filter(([sku]) => sku));
  if (apiBySKU.size === 0 && domBySKU.size > 0) {
    throw new ParserStructureChangedError("De actuele Hoogvliet-catalogus-API leverde geen zichtbare productitems.");
  }
  const hydrated = [...apiBySKU].map(([sku, item]) => {
    const domCandidate = domBySKU.get(sku);
    const urlKey = clean(item?.url_key);
    const sourceURL = domCandidate?.sourceURL
      ?? (urlKey ? BASE_URL + "/product/" + urlKey : null);
    return {
      ...domCandidate,
      sku,
      name: clean(item?.name) || domCandidate?.name,
      brand: clean(item?.brand?.value) || domCandidate?.brand,
      category: catalogAPICategory(item) || domCandidate?.category,
      packageText: domCandidate?.packageText || catalogAPIPackage(item),
      displayedPrice: catalogAPIPrice(item) ?? domCandidate?.displayedPrice,
      sourceURL,
      imageURL: clean(item?.small_image?.url) || domCandidate?.imageURL,
      available: item?.stock_status ? item.stock_status === "IN_STOCK" : domCandidate?.available,
    };
  });
  // The public endpoint currently hydrates the visible cards in one request.
  // Keep any visible card omitted by a server-side page-size limit as a DOM
  // candidate; detail validation still decides whether it is usable.
  return [...hydrated, ...candidates.filter(candidate => (
    !apiBySKU.has(extractSKUFromProductURL(candidate.sourceURL))
  ))];
}

export async function collectCatalogListing(page, routeURL, {
  startWindow = 0,
  maxWindows = 20,
  shouldStop = () => false,
  navigationRetries = 2,
  onRetry = null,
  normalTimeoutMs,
} = {}) {
  await withTransientNavigationRetry(
    () => sourceGoto(page, routeURL, { waitUntil: "domcontentloaded", timeout: 35_000 }, {
      routeKey: "catalog:category", cursor: startWindow, page: startWindow, categoryURL: routeURL,
    }),
    { maxRetries: navigationRetries, onRetry, wait: ms => page.waitForTimeout(ms) },
  );
  await waitForCatalogSource(page, {
    normalTimeoutMs,
    requestContext: { routeKey: "catalog:category", cursor: startWindow, page: startWindow, categoryURL: routeURL },
  });
  const routeCandidates = new Map();
  const windows = [];
  let loadMoreCycles = 0;
  let stagnated = false;
  let currentSignature = "";
  const visitedListingURLs = new Set([page.url()]);

  const snapshot = async () => {
    const rawDOM = await extractCatalogListingCandidates(page);
    const raw = await hydrateCatalogListingCandidates(page, rawDOM);
    const fresh = raw.filter(candidate => !routeCandidates.has(candidate.sourceURL));
    for (const candidate of fresh) routeCandidates.set(candidate.sourceURL, candidate);
    const signature = [...routeCandidates.keys()].sort().join("|");
    return { fresh, signature };
  };

  while (!shouldStop() && windows.length < maxWindows) {
    const { fresh, signature } = await snapshot();
    if (signature === currentSignature && currentSignature) {
      stagnated = true;
      break;
    }
    currentSignature = signature;
    windows.push(fresh);
    const loadMore = await findLoadMoreControl(page);
    if (loadMore) {
      const previousCount = routeCandidates.size;
      await loadMore.click({ timeout: 5_000 }).catch(() => { stagnated = true; });
      if (stagnated) break;
      loadMoreCycles += 1;
      const grew = await waitForListingGrowth(page, previousCount);
      if (!grew) {
        const after = await hydrateCatalogListingCandidates(page, await extractCatalogListingCandidates(page));
        const afterCount = new Set(after.map(candidate => candidate.sourceURL)).size;
        if (afterCount <= previousCount) stagnated = true;
      }
      continue;
    }
    const nextURL = await findNextCatalogPageURL(page, page.url());
    if (!nextURL || visitedListingURLs.has(nextURL)) break;
    await withTransientNavigationRetry(
      () => sourceGoto(page, nextURL, { waitUntil: "domcontentloaded", timeout: 35_000 }, {
        routeKey: "catalog:category", cursor: visitedListingURLs.size, page: visitedListingURLs.size,
        categoryURL: routeURL,
      }),
      { maxRetries: navigationRetries, onRetry, wait: ms => page.waitForTimeout(ms) },
    );
    await waitForCatalogSource(page, {
      normalTimeoutMs,
      requestContext: { routeKey: "catalog:category", cursor: visitedListingURLs.size, page: visitedListingURLs.size, categoryURL: routeURL },
    });
    visitedListingURLs.add(nextURL);
  }

  // `windows` is a deterministic global cursor: a resumed segment can replay
  // earlier visible batches, but only emits windows at/after its checkpoint.
  const emitted = windows.slice(Math.max(0, startWindow), Math.max(0, startWindow) + maxWindows)
    .flatMap(window => window);
  const sourceExhausted = !stagnated && windows.length < maxWindows;
  return {
    candidates: emitted,
    pagesFetched: windows.length,
    windowCount: windows.length,
    emittedWindowCount: Math.min(maxWindows, Math.max(0, windows.length - startWindow)),
    initialCandidateCount: windows[0]?.length ?? 0,
    loadMoreCycles,
    sourceExhausted,
    stallReason: stagnated ? "category_listing_stagnated" : null,
    nextPage: sourceExhausted ? 0 : startWindow + Math.min(maxWindows, windows.length),
    categoryURL: routeURL,
  };
}

export async function collectPublicCatalogCandidates(page, maxPages, options = {}) {
  const rootURL = CATALOG_ROOT_URL;
  const queue = [rootURL];
  const queued = new Set(queue);
  const visitedCategories = new Set();
  const rootCategoryURLs = new Set();
  const categoryTitles = new Map();
  const categoryResults = [];
  const queuedCategories = [];
  const allCandidates = [];
  const seenURLs = new Set();
  const startWindow = Math.max(0, Math.trunc(options.startPage ?? 0));
  const continueAfterCategoryStall = options.continueAfterCategoryStall === true;
  const enqueueCategoryChildren = options.enqueueCategoryChildren !== false;
  let globalWindowCursor = 0;
  let pagesFetched = 0;
  let loadMoreCycles = 0;
  let sourceExhausted = true;
  let stallReason = null;
  let rootCategoryCount = 0;
  let initialCandidateCount = 0;
  let rawCandidates = 0;
  let duplicateCandidates = 0;
  let invalidCandidates = 0;

  while (queue.length && !options.shouldStop?.()) {
    const routeURL = queue.shift();
    if (visitedCategories.has(routeURL)) continue;
    visitedCategories.add(routeURL);
    const categoryResult = routeURL === rootURL ? null : {
      route: routeURL,
      title: categoryTitles.get(routeURL) ?? null,
      expectedResultCount: null,
      pagesFetched: 0,
      rawHits: 0,
      uniqueSKUs: 0,
      invalidCandidates: 0,
      lastCursor: startWindow,
      nextCursor: null,
      stopReason: null,
      queueRemainingBefore: queue.length,
      queueRemainingAfter: null,
    };
    try {
      await withTransientNavigationRetry(
        () => sourceGoto(page, routeURL, { waitUntil: "domcontentloaded", timeout: 35_000 }, {
          routeKey: routeURL === rootURL ? "catalog:root" : "catalog:category",
          cursor: startWindow, page: startWindow, categoryURL: routeURL === rootURL ? null : routeURL,
        }),
        { maxRetries: options.navigationRetries ?? 2, onRetry: options.onRetry, wait: ms => page.waitForTimeout(ms) },
      );
      await waitForCatalogSource(page, {
        expectCategoryLinks: routeURL === rootURL,
        normalTimeoutMs: options.normalTimeoutMs,
        requestContext: {
          routeKey: routeURL === rootURL ? "catalog:root" : "catalog:category",
          cursor: startWindow, page: startWindow, categoryURL: routeURL === rootURL ? null : routeURL,
        },
      });
    } catch (error) {
      if (categoryResult) {
        categoryResult.stopReason = error?.code === "source_challenge" ? "challenge" : "error";
        categoryResult.queueRemainingAfter = queue.length;
        categoryResults.push(categoryResult);
        error.collectionStats = {
          ...(error.collectionStats ?? {}),
          categoryResults: [...categoryResults],
          queuedCategories: [...queuedCategories],
          queueRemaining: queue.length,
        };
      }
      throw error;
    }
    const childRoutes = await extractCatalogCategoryLinks(page);
    for (const child of childRoutes) {
      categoryTitles.set(child.url, child.title);
      if (routeURL === rootURL) rootCategoryURLs.add(child.url);
      if ((routeURL === rootURL || enqueueCategoryChildren) && !queued.has(child.url)) {
        queued.add(child.url); queue.push(child.url); queuedCategories.push(child);
      }
    }
    if (routeURL === rootURL) {
      rootCategoryCount = childRoutes.length;
      if (!rootCategoryCount) {
        throw new RootCategoryDiscoveryError("Actuele Hoogvliet-catalogus bevat geen publieke categorie-links.");
      }
      continue;
    }
    const remaining = Math.max(0, maxPages - pagesFetched);
    if (remaining === 0) {
      sourceExhausted = false;
      categoryResult.stopReason = "safety_limit";
      categoryResult.queueRemainingAfter = queue.length;
      categoryResults.push(categoryResult);
      break;
    }
    const routeSkip = Math.max(0, startWindow - globalWindowCursor);
    let listing;
    try {
      listing = await collectCatalogListing(page, routeURL, {
        startWindow: routeSkip,
        maxWindows: routeSkip + remaining,
        shouldStop: options.shouldStop,
        navigationRetries: options.navigationRetries,
        onRetry: options.onRetry,
        normalTimeoutMs: options.normalTimeoutMs,
      });
    } catch (error) {
      categoryResult.stopReason = error?.code === "source_challenge" ? "challenge" : "error";
      categoryResult.queueRemainingAfter = queue.length;
      categoryResults.push(categoryResult);
      error.collectionStats = {
        ...(error.collectionStats ?? {}),
        categoryResults: [...categoryResults],
        queuedCategories: [...queuedCategories],
        queueRemaining: queue.length,
      };
      throw error;
    }
    // A fresh page starts at window zero. Replay enough load-more clicks to
    // reach the persisted global cursor, then emit only the new window range.
    const emittedWindows = listing.emittedWindowCount;
    if (pagesFetched === 0) initialCandidateCount = listing.initialCandidateCount ?? 0;
    globalWindowCursor += listing.windowCount;
    pagesFetched += emittedWindows;
    loadMoreCycles += listing.loadMoreCycles;
    sourceExhausted = listing.sourceExhausted;
    categoryResult.pagesFetched = emittedWindows;
    categoryResult.rawHits = listing.candidates.length;
    categoryResult.lastCursor = routeSkip + Math.max(0, listing.windowCount - 1);
    categoryResult.nextCursor = listing.nextPage ?? null;
    if (listing.stallReason) {
      stallReason ??= listing.stallReason;
      categoryResult.stopReason = "stagnated";
    }
    const routeSKUs = new Set();
    for (const candidate of listing.candidates) {
      rawCandidates += 1;
      const normalized = normalizeCatalogListingCandidate(candidate, routeURL);
      if (!normalized) { invalidCandidates += 1; categoryResult.invalidCandidates += 1; continue; }
      routeSKUs.add(normalized.sku);
      if (seenURLs.has(normalized.sourceURL)) { duplicateCandidates += 1; continue; }
      seenURLs.add(normalized.sourceURL);
      allCandidates.push({
        ...normalized,
        categoryURL: routeURL,
        discoveryCursor: startWindow + globalWindowCursor,
        discoveryPage: startWindow + globalWindowCursor,
      });
    }
    categoryResult.uniqueSKUs = routeSKUs.size;
    if (!categoryResult.stopReason) {
      categoryResult.stopReason = listing.sourceExhausted
        ? "exhausted"
        : pagesFetched >= maxPages ? "safety_limit" : "complete";
    }
    categoryResult.queueRemainingAfter = queue.length;
    categoryResults.push(categoryResult);
    if (listing.stallReason && !continueAfterCategoryStall) break;
    if (!listing.sourceExhausted && pagesFetched >= maxPages) { sourceExhausted = false; break; }
  }

  if (!rootCategoryCount) throw new RootCategoryDiscoveryError("Actuele Hoogvliet-catalogus bevat geen publieke categorie-links.");
  const nextPage = sourceExhausted ? 0 : startWindow + Math.max(1, pagesFetched);
  const queueEmpty = queue.length === 0;
  const coverageComplete = queueEmpty && categoryResults.every(result => (
    result.stopReason === "exhausted" || result.stopReason === "complete"
  ));
  return {
    candidates: allCandidates,
    rawCandidates,
    duplicateCandidates,
    irrelevantCandidates: 0,
    invalidCandidates,
    repeatedPageCandidates: 0,
    repeatedPageStopped: Boolean(stallReason),
    pagesFetched,
    categoriesVisited: visitedCategories.size - 1,
    rootCategoriesVisited: [...rootCategoryURLs].filter(route => visitedCategories.has(route)).length,
    rootCategoriesDiscovered: rootCategoryCount,
    routesVisited: visitedCategories.size,
    rootCategories: [...rootCategoryURLs].map(url => ({ url, title: categoryTitles.get(url) ?? null })),
    queuedCategories,
    categoryResults,
    queueRemaining: queue.length,
    queueEmpty,
    coverageComplete,
    initialCandidateCount,
    listingLoadMoreCycles: loadMoreCycles,
    uniqueListingSKUs: new Set(allCandidates.map(candidate => candidate.sku)).size,
    sourceExhausted: sourceExhausted && coverageComplete,
    stallReason,
    nextPage: sourceExhausted && queue.length === 0 ? 0 : nextPage,
  };
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
  const candidates = await extractCatalogListingCandidates(page);
  if (!options.requirePaginationEvidence) {
    candidates.sourceClassification = options.sourceEvidence?.classification ?? "ready";
    candidates.sourceExhausted = candidates.sourceClassification === "valid_empty_search";
    return candidates;
  }
  const evidence = await page.evaluate(() => {
    const text = document.body?.innerText ?? "";
    const total = text.match(/([\d.]+)\s+producten/i);
    return {
      currentPage: 1,
      totalPages: 1,
      totalProducts: total ? Number(total[1].replaceAll('.', '')) : null,
      explicitEmpty: /geen (?:producten|zoekresultaten)|geen resultaten gevonden|niks kunnen vinden/i.test(text),
    };
  });
  return { candidates, sourceClassification: options.sourceEvidence?.classification ?? "ready",
    ...searchPaginationEvidence({ ...evidence, candidateCount: candidates.length,
      requestedPage: options.requestedCategoryPage }) };
}

export function resolvedSearchPageURL(resolvedURL, pageNumber) {
  const url = new URL(resolvedURL);
  if (url.origin !== BASE_URL || url.username || url.password
    || (url.pathname !== CATALOG_ROOT_PATH && !normalizeCatalogCategoryURL(url.href))) {
    throw new SourceUnavailableError("Catalogusredirect verlaat het vertrouwde openbare Hoogvliet-endpoint.");
  }
  void pageNumber;
  url.search = "";
  url.hash = "";
  return url.href.replace(/\/$/, "");
}

export function verifyCategorySearchRoute(resolvedURL, category) {
  const url = new URL(resolvedSearchPageURL(resolvedURL, 0));
  if (category?.path !== url.pathname) {
    throw new SourceUnavailableError("Categoriezoekopdracht verliest de gevraagde broncategorie.");
  }
}

export async function navigateSearchPage(page, term, pageNumber = 0, options = {}) {
  const routes = options.resolvedRoutes;
  const knownRoute = routes?.get(term);
  if (!isCatalogRouteTerm(term)) {
    throw new SourceUnavailableError(
      `Hoogvliet-keyworddiscovery '${term}' is disabled; gebruik de actuele publieke catalogusroute.`,
    );
  }
  const route = knownRoute ? resolvedSearchPageURL(knownRoute, pageNumber) : searchURL(term, pageNumber);
  await sourceGoto(page, route, { waitUntil: "domcontentloaded", timeout: 35_000 }, {
    routeKey: term, cursor: pageNumber, page: pageNumber,
  });
  const category = categoryDiscoveryRoute(term);
  if (category && new URL(page.url()).pathname !== category.path) verifyCategorySearchRoute(page.url(), category);
  if (routes) {
    const resolved = resolvedSearchPageURL(page.url(), pageNumber);
    routes.set(term, resolved);
  }
  return page.url();
}

async function searchOnce(page, term, pageNumber = 0, options = {}) {
  if (isCatalogRouteTerm(term)) {
    return collectPublicCatalogCandidates(page, Math.max(1, options.maxPages ?? 1), {
      ...options, startPage: pageNumber,
    });
  }
  await navigateSearchPage(page, term, pageNumber, options);
  const source = await waitForCatalogSource(page, options);
  return searchPageResult(page, { ...options, sourceEvidence: source.evidence,
    requestedCategoryPage: undefined });
}

async function searchUsingVisibleForm(page, term, options = {}) {
  await sourceGoto(page, BASE_URL, { waitUntil: "domcontentloaded", timeout: 35_000 }, {
    routeKey: "search:home",
  });
  await waitForSourceContent(page, "input[name='SearchTerm'], input[placeholder*='Waar ben je' i]", {
    ...options,
    normalTimeoutMs: 5_000,
  });
  await acceptCookiesIfShown(page);
  const input = page.locator("input[name='SearchTerm'], input[placeholder*='Waar ben je' i]").first();
  if (!(await input.isVisible({ timeout: 5000 }).catch(() => false))) return [];
  await input.fill(term);
  await input.press("Enter");
  await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => {});
  const source = await waitForCatalogSource(page, options);
  return searchPageResult(page, { ...options, sourceEvidence: source.evidence });
}

export function nextEmptySourceSearchCount(previousCount, rawCandidateCount, sourceClassification = null) {
  return Number(rawCandidateCount) > 0 || sourceClassification === "valid_empty_search"
    ? 0 : Math.max(0, Math.trunc(previousCount ?? 0)) + 1;
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
  let sourceClassification = null;
  let lastPageNumber = startPage;
  let firstPageAliasSkipped = false;

  const snapshot = () => ({ candidates, pagesFetched, rawCandidates, irrelevantCandidates,
    duplicateCandidates, invalidCandidates, repeatedPageCandidates, repeatedPageStopped,
    firstPageAliasSkipped, sourceExhausted, sourceClassification, stallReason, stallPage: stallReason ? lastPageNumber : null,
    nextPage: sourceExhausted ? 0 : lastPageNumber + 1 });
  try {
  for (let pageOffset = 0; pageOffset < maxPages; pageOffset += 1) {
    if (options.shouldStop?.()) break;
    const pageNumber = pageOffset === 0 ? startPage : lastPageNumber + 1;
    const pageResult = await fetchPage(pageNumber);
    const pageCandidates = Array.isArray(pageResult) ? pageResult : pageResult?.candidates;
    sourceClassification = pageResult?.sourceClassification ?? sourceClassification;
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
      // Some public listing implementations expose the first window twice.
      // Try one extra window before treating the route as repeated/exhausted.
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
  if (isCatalogRouteTerm(term)) {
    return collectPublicCatalogCandidates(page, maxPages, options);
  }
  return collectCandidatePages(async (pageNumber) => {
    try {
      return await withTransientNavigationRetry(async () => {
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
    } catch (error) {
      if (error instanceof SourceBlockedError) throw error;
      throw new SourceNavigationError("Hoogvliet-zoekroute kon niet worden genavigeerd.", error);
    }
  }, term, maxPages, { startPage: options.startPage ?? 0, seenPageSignatures: options.seenPageSignatures, shouldStop: options.shouldStop });
}

async function extractProductDetails(page) {
  return page.evaluate(() => {
    const root = document.querySelector(".product-details, [itemtype*='Product' i], main");
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
      sku: (form?.id || "").replace("productDetailForm_", "")
        || location.pathname.match(/(?:^|-)(\d{9})\/?$/)?.[1] || null,
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
  const requestContext = {
    routeKey: candidate.searchTerm ?? "catalog:detail",
    cursor: candidate.discoveryCursor ?? null,
    page: candidate.discoveryPage ?? null,
    categoryURL: candidate.categoryURL ?? null,
  };
  await sourceGoto(page, candidate.sourceURL, { waitUntil: "domcontentloaded", timeout: 35_000 }, requestContext);
  // A stale listing card can legitimately outlive its product page. It is an
  // invalid detail candidate, not a failure of the catalog source. Continue
  // the bounded discovery window and let the normal invalid-detail ledger
  // account for it.
  if (page.__hoogvlietLastResponseStatus === 404) return fail("notFound");
  try {
    await waitForSourceContent(page, "h1", { requestContext });
  } catch (error) {
    if (error?.code === "source_unavailable" && page.__hoogvlietLastResponseStatus === 404) {
      return fail("notFound");
    }
    throw error;
  }
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
    categoriesVisited: 0,
    listingLoadMoreCycles: 0,
    uniqueListingSKUs: 0,
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
    validEmptySearches: 0,
    sourceClassifications: {},
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
    await waitForSourceContent(searchPage, "a[href^='/producten']", {
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
          pageResult.sourceClassification,
        );
        if (pageResult.rawCandidates === 0) {
          stats.sourceEmptySearches += 1;
          const classification = pageResult.sourceClassification ?? "unknown";
          stats.sourceClassifications[classification] = (stats.sourceClassifications[classification] ?? 0) + 1;
          if (classification === "valid_empty_search") stats.validEmptySearches += 1;
          logger.info(`Zoekroutebewijs | term=${term} | classificatie=${classification} | ruwe_kandidaten=0`);
        }
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
        stats.categoriesVisited += pageResult.categoriesVisited ?? 0;
        stats.listingLoadMoreCycles += pageResult.listingLoadMoreCycles ?? 0;
        stats.uniqueListingSKUs += pageResult.uniqueListingSKUs ?? pageResult.candidates.length;
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
        termStats.sourceClassification = pageResult.sourceClassification ?? null;
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
        logger.error(`Zoekterm overgeslagen (${term}) | status=${error.code ?? "navigation_error"}: ${error instanceof Error ? error.message : "onbekende fout"}`);
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
