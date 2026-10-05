import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import {
  CATALOG_ROOT_URL,
  collectPublicCatalogCandidates,
  normalizeCatalogCategoryURL,
} from "../src/hoogvliet.mjs";

const outputPath = process.env.PROBE_OUTPUT ?? "hoogvliet-current-catalog-proof.json";
const maxPages = Math.max(1, Math.min(2, Number(process.env.PROBE_MAX_PAGES ?? 2)));

function safeURL(raw) {
  try {
    const url = new URL(raw);
    return { origin: url.origin, pathname: url.pathname, queryKeys: [...new Set(url.searchParams.keys())].sort() };
  } catch {
    return { origin: "invalid", pathname: "invalid", queryKeys: [] };
  }
}

function safeCategoryURLs(hrefs) {
  return [...new Set((hrefs ?? []).map(normalizeCatalogCategoryURL).filter(Boolean))]
    .slice(0, 80)
    .map(safeURL);
}

async function rootSnapshot(page) {
  return page.evaluate(() => {
    const scopedSelector = "main a[href], [role='main'] a[href], nav[aria-label*='product' i] a[href], nav[aria-label*='catalog' i] a[href]";
    const hrefs = [...document.querySelectorAll("a[href]")].map(link => link.href);
    const scopedHrefs = [...document.querySelectorAll(scopedSelector)].map(link => link.href);
    return {
      hrefCount: hrefs.length,
      scopedCount: scopedHrefs.length,
      hrefs,
      scopedHrefs,
      pathname: document.location.pathname,
      bodyTextLength: (document.body?.innerText ?? "").trim().length,
    };
  });
}

const network = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
const rootPage = await context.newPage();
context.on("response", response => {
  const type = response.request().resourceType();
  if (type !== "xhr" && type !== "fetch") return;
  const endpoint = safeURL(response.url());
  const record = { type, status: response.status(), endpoint };
  if (endpoint.pathname === "/api/graphql") {
    const url = new URL(response.url());
    record.operationName = url.searchParams.get("operationName");
    try { record.variableKeys = Object.keys(JSON.parse(url.searchParams.get("variables") || "{}")); }
    catch { record.variableKeys = []; }
  }
  network.push(record);
});

let rootResponse = null;
let rootError = null;
let rootImmediate = { hrefCount: 0, scopedCount: 0, hrefs: [], scopedHrefs: [] };
let rootSettled = rootImmediate;
try {
  rootResponse = await rootPage.goto(CATALOG_ROOT_URL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  rootImmediate = await rootSnapshot(rootPage);
  await rootPage.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await rootPage.waitForTimeout(3_000);
  rootSettled = await rootSnapshot(rootPage);
} catch (error) {
  rootError = error?.message ?? "root_navigation_error";
}

const collectorPage = await context.newPage();
let collector = { status: "not_run", error: null, code: null };
try {
  const result = await collectPublicCatalogCandidates(collectorPage, maxPages);
  collector = {
    status: "ok",
    routesVisited: result.routesVisited,
    rootCategoriesDiscovered: result.rootCategoriesDiscovered,
    categoriesVisited: result.categoriesVisited,
    candidates: result.candidates.length,
    initialCandidateCount: result.initialCandidateCount,
    pagesFetched: result.pagesFetched,
    listingLoadMoreCycles: result.listingLoadMoreCycles,
    sourceExhausted: result.sourceExhausted,
    stallReason: result.stallReason,
    uniqueSKUs: result.uniqueListingSKUs,
    skuExamples: result.candidates.map(candidate => candidate.sku).slice(0, 10),
  };
} catch (error) {
  collector = { status: "error", error: error?.message ?? "collector_error", code: error?.code ?? null };
}

const candidateCount = collector.status === "ok" ? collector.candidates : 0;
const legacyIntershopStaticAssets = network
  .filter(record => /\/INTERSHOP\/static\//i.test(record.endpoint.pathname))
  .map(record => record.endpoint);
const legacyDiscoveryEndpoints = network
  .filter(record => /ViewTWParametricSearch|\/INTERSHOP\/web\/WFS\//i.test(record.endpoint.pathname))
  .map(record => record.endpoint);
const legacyIntershopEndpoints = network
  .filter(record => /INTERSHOP|ViewTWParametricSearch/i.test(record.endpoint.pathname))
  .map(record => record.endpoint);
const proof = {
  sourceClassification: collector.status === "error" && collector.code === "source_challenge"
    ? "CHALLENGE"
    : rootError
      ? "NAVIGATION_ERROR"
      : candidateCount > 0 ? "VALID_SOURCE" : collector.code ?? "ROOT_CATEGORY_DISCOVERY_FAILED",
  routesVisited: collector.routesVisited ?? 0,
  dynamicCategories: collector.rootCategoriesDiscovered ?? 0,
  categoriesVisited: collector.categoriesVisited ?? 0,
  candidateCount,
  uniqueSKUHintCount: collector.uniqueSKUs ?? 0,
  initialCandidateCount: collector.initialCandidateCount ?? 0,
  afterLoadMoreCandidateCount: candidateCount,
  pagesFetched: collector.pagesFetched ?? 0,
  proofBeyondInitialBatch: (collector.pagesFetched ?? 0) > 1
    || candidateCount > (collector.initialCandidateCount ?? 0),
  loadMoreCycles: collector.listingLoadMoreCycles ?? 0,
  noLegacyIntershop: legacyDiscoveryEndpoints.length === 0,
  legacyDiscoveryEndpoints,
  legacyIntershopStaticAssets,
  legacyIntershopEndpoints,
};
const result = {
  target: { catalogURL: CATALOG_ROOT_URL, maxPages },
  navigation: {
    error: rootError,
    rootStatus: rootResponse?.status() ?? null,
    finalURL: rootPage.url(),
    title: await rootPage.title().catch(() => ""),
  },
  rootImmediate: {
    pathname: rootImmediate.pathname,
    hrefCount: rootImmediate.hrefCount,
    scopedCount: rootImmediate.scopedCount,
    categoryLinks: safeCategoryURLs(rootImmediate.hrefs),
    scopedCategoryLinks: safeCategoryURLs(rootImmediate.scopedHrefs),
  },
  rootSettled: {
    pathname: rootSettled.pathname,
    hrefCount: rootSettled.hrefCount,
    scopedCount: rootSettled.scopedCount,
    categoryLinks: safeCategoryURLs(rootSettled.hrefs),
    scopedCategoryLinks: safeCategoryURLs(rootSettled.scopedHrefs),
  },
  collector,
  network: network.slice(0, 80),
  proof,
};

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`HOOGVLIET_CURRENT_CATALOG_PROOF ${JSON.stringify(proof)}`);
console.log(JSON.stringify({ navigation: result.navigation, rootSettled: result.rootSettled, collector, proof, network: result.network }, null, 2));
await context.close();
await browser.close();

if (proof.sourceClassification !== "VALID_SOURCE"
  || proof.routesVisited <= 1
  || proof.dynamicCategories < 1
  || proof.candidateCount < 1
  || !proof.noLegacyIntershop) process.exitCode = 1;
