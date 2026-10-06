import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import {
  CATALOG_ROOT_URL,
  collectPublicCatalogCandidates,
} from "../src/hoogvliet.mjs";

const maxPages = Math.max(20, Math.min(1_200, Number(process.env.COVERAGE_MAX_PAGES ?? 800)));
const outputPath = process.env.COVERAGE_OUTPUT ?? "hoogvliet-coverage-proof.json";
const csvPath = process.env.COVERAGE_CSV ?? "hoogvliet-coverage-skus.csv";

function safeURL(raw) {
  try {
    const url = new URL(raw);
    return { origin: url.origin, pathname: url.pathname, queryKeys: [...new Set(url.searchParams.keys())].sort() };
  } catch {
    return { origin: "invalid", pathname: "invalid", queryKeys: [] };
  }
}

function csv(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function uniqueSKURecords(candidates) {
  const groups = new Map();
  for (const candidate of candidates ?? []) {
    if (!candidate?.sku) continue;
    const group = groups.get(candidate.sku) ?? [];
    group.push(candidate);
    groups.set(candidate.sku, group);
  }
  const records = [...groups].sort(([left], [right]) => left.localeCompare(right)).map(([sku, group]) => {
    const first = group[0];
    return {
      sku,
      name: first.name ?? null,
      brand: first.brand ?? null,
      category: first.category ?? null,
      packageText: first.packageText ?? null,
      displayedPrice: first.displayedPrice ?? null,
      sourceURL: first.sourceURL ?? null,
      categoriesSeen: [...new Set(group.map(candidate => candidate.categoryURL).filter(Boolean))].sort(),
      listingURLCount: new Set(group.map(candidate => candidate.sourceURL).filter(Boolean)).size,
    };
  });
  const duplicateSKUGroups = [...groups]
    .filter(([, group]) => new Set(group.map(candidate => candidate.categoryURL).filter(Boolean)).size > 1)
    .map(([sku, group]) => ({
      sku,
      routes: [...new Set(group.map(candidate => candidate.categoryURL).filter(Boolean))].sort(),
      sourceURLs: [...new Set(group.map(candidate => candidate.sourceURL).filter(Boolean))].sort(),
    }));
  return { records, duplicateSKUGroups };
}

const network = [];
const navigation404s = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
context.on("response", response => {
  const type = response.request().resourceType();
  if (type === "document" && response.status() === 404) {
    navigation404s.push({ status: 404, endpoint: safeURL(response.url()) });
  }
  if (type !== "xhr" && type !== "fetch") return;
  const endpoint = safeURL(response.url());
  const record = { type, status: response.status(), endpoint };
  if (endpoint.pathname === "/api/graphql") {
    const url = new URL(response.url());
    record.operationName = url.searchParams.get("operationName");
    try {
      record.variableKeys = Object.keys(JSON.parse(url.searchParams.get("variables") || "{}"));
    } catch {
      record.variableKeys = [];
    }
  }
  network.push(record);
});

const page = await context.newPage();
let collection = null;
let collectionError = null;
try {
  collection = await collectPublicCatalogCandidates(page, maxPages, {
    // Coverage must finish the root queue even when one category has a local
    // repeated-page/load-more stall. A real source challenge/error still
    // throws globally and is reported below.
    continueAfterCategoryStall: true,
    enqueueCategoryChildren: false,
    retryStalledLoadMore: true,
    maxStalledLoadMoreRetries: 2,
    navigationRetries: 1,
  });
} catch (error) {
  collectionError = {
    code: error?.code ?? "coverage_collection_error",
    message: error?.message ?? "coverage_collection_error",
    request: error?.sourceRequest ?? null,
    stats: error?.collectionStats ?? null,
  };
}

const candidates = collection?.candidates ?? [];
const { records, duplicateSKUGroups } = uniqueSKURecords(candidates);
const categoryResults = collection?.categoryResults ?? collectionError?.stats?.categoryResults ?? [];
const queuedCategories = collection?.queuedCategories ?? collectionError?.stats?.queuedCategories ?? [];
const sourceErrors = collectionError && collectionError.code !== "source_challenge" ? [collectionError] : [];
const challenges = collectionError?.code === "source_challenge" ? [collectionError] : [];
const completeCategoryResults = categoryResults.filter(result => ["exhausted", "complete"].includes(result.stopReason));
const partialCategoryResults = categoryResults.filter(result => !["exhausted", "complete"].includes(result.stopReason));
const queueRemaining = collection?.queueRemaining ?? collectionError?.stats?.queueRemaining ?? 0;
const rootCategoriesFound = collection?.rootCategoriesDiscovered ?? 0;
const rootCategoriesVisited = collection?.rootCategoriesVisited ?? 0;
const reliableCoverage = Boolean(
  !collectionError
  && rootCategoriesFound > 0
  && queuedCategories.length === rootCategoriesFound
  && rootCategoriesVisited === rootCategoriesFound
  && queueRemaining === 0
  && partialCategoryResults.length === 0
  && navigation404s.length === 0,
);

const summary = {
  classification: reliableCoverage ? "RELIABLE_COVERAGE" : "PARTIAL_COVERAGE",
  catalogURL: CATALOG_ROOT_URL,
  maxPages,
  rootCategoriesFound,
  rootCategoriesQueued: queuedCategories.length,
  rootCategoriesVisited,
  categoriesVisited: collection?.categoriesVisited ?? categoryResults.length,
  categoriesComplete: completeCategoryResults.length,
  categoriesPartialOrFailed: partialCategoryResults.length,
  listingPages: collection?.pagesFetched ?? categoryResults.reduce((sum, result) => sum + (result.pagesFetched ?? 0), 0),
  rawHits: collection?.rawCandidates ?? candidates.length,
  uniqueSKUs: records.length,
  duplicateSKUGroups: duplicateSKUGroups.length,
  duplicateURLHits: collection?.duplicateCandidates ?? 0,
  invalidListingCandidates: collection?.invalidCandidates ?? 0,
  sourceErrors: sourceErrors.length,
  challenges: challenges.length,
  navigation404s: navigation404s.length,
  queueRemaining,
  queueEmpty: queueRemaining === 0,
};

const artifact = {
  generatedAt: new Date().toISOString(),
  summary,
  rootCategories: collection?.rootCategories ?? [],
  queuedCategories,
  categoryResults,
  sourceErrors,
  challenges,
  navigation404s,
  network: network.slice(0, 200),
  duplicateSKUGroups,
  skus: records.map(record => record.sku),
  records,
};

const csvLines = ["sku,name,brand,category,packageText,displayedPrice,sourceURL,categoriesSeen,listingURLCount"];
for (const record of records) {
  csvLines.push([
    record.sku, record.name, record.brand, record.category, record.packageText,
    record.displayedPrice, record.sourceURL, record.categoriesSeen.join(" | "), record.listingURLCount,
  ].map(csv).join(","));
}

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
await writeFile(csvPath, `${csvLines.join("\n")}\n`, "utf8");
console.log(`HOOGVLIET_COVERAGE_PROOF ${JSON.stringify(summary)}`);
console.log(JSON.stringify({ summary, categoryResults, sourceErrors, challenges }, null, 2));

await context.close();
await browser.close();

if (summary.classification !== "RELIABLE_COVERAGE") process.exitCode = 1;
