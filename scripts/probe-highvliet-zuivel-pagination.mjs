import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { collectCatalogListing, extractSKUFromProductURL } from "../src/hoogvliet.mjs";

const routeURL = "https://hoogvliet.nl/zuivel-eieren-boter";
const outputPath = process.env.DAIRY_OUTPUT ?? "hoogvliet-zuivel-pagination.json";
const windows = [];
const paginationSteps = [];
const responses = [];
const responsePromises = [];

function safeURL(raw) {
  try {
    const url = new URL(raw);
    return { origin: url.origin, pathname: url.pathname, queryKeys: [...new Set(url.searchParams.keys())].sort() };
  } catch {
    return { origin: "invalid", pathname: "invalid", queryKeys: [] };
  }
}

function skuSet(candidates) {
  return [...new Set((candidates ?? []).map(candidate => candidate.sku
    ?? extractSKUFromProductURL(candidate.sourceURL)).filter(Boolean))].sort();
}

function diff(left, right) {
  const rightSet = new Set(right);
  return left.filter(value => !rightSet.has(value));
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
context.on("response", response => {
  const type = response.request().resourceType();
  if (type !== "document" && type !== "xhr" && type !== "fetch") return;
  const record = {
    type,
    method: response.request().method(),
    requestURL: safeURL(response.request().url()),
    finalURL: safeURL(response.url()),
    status: response.status(),
    operationName: null,
    variables: null,
    responseItemCount: null,
    responseSKUs: [],
    redirectedFrom: response.request().redirectedFrom()?.url() ?? null,
  };
  if (record.finalURL.pathname === "/api/graphql") {
    const url = new URL(response.url());
    record.operationName = url.searchParams.get("operationName");
    try {
      const variables = JSON.parse(url.searchParams.get("variables") || "{}");
      record.variables = {
        currentPage: variables.currentPage ?? null,
        pageSize: variables.pageSize ?? null,
        filters: variables.filters ?? null,
      };
    } catch {
      record.variables = { parseError: true };
    }
    responsePromises.push((async () => {
      const body = await response.json().catch(() => null);
      const items = body?.data?.products?.items;
      if (Array.isArray(items)) {
        record.responseItemCount = items.length;
        record.responseSKUs = items.map(item => item?.sku ?? extractSKUFromProductURL(item?.url_key
          ? `https://hoogvliet.nl/product/${item.url_key}` : "")).filter(Boolean).sort();
      }
    })());
  }
  responses.push(record);
});

const page = await context.newPage();
let result = null;
let error = null;
try {
  result = await collectCatalogListing(page, routeURL, {
    maxWindows: 35,
    navigationRetries: 1,
    onWindow: async snapshot => {
      const evidence = await page.evaluate(() => {
        const text = document.body?.innerText ?? "";
        return {
          pathname: document.location.pathname,
          textProductCounts: [...text.matchAll(/([\d.]+)\s+producten/gi)].map(match => match[0]),
          productLinkCount: document.querySelectorAll("a[href*='/product/']").length,
        };
      });
      windows.push({
        windowIndex: snapshot.windowIndex,
        cursor: snapshot.windowIndex,
        page: snapshot.windowIndex + 1,
        pageURL: snapshot.pageURL,
        repeatedSignature: snapshot.repeatedSignature,
        cumulativeCandidateCount: snapshot.cumulativeCandidateCount,
        rawProductURLs: snapshot.rawCandidates.map(candidate => candidate.sourceURL).sort(),
        rawSKUs: skuSet(snapshot.rawCandidates),
        hydratedSKUs: skuSet(snapshot.hydratedCandidates),
        freshSKUs: skuSet(snapshot.freshCandidates),
        evidence,
      });
    },
    onPaginationStep: step => {
      paginationSteps.push({
        ...step,
        cursor: step.windowIndex,
        page: step.windowIndex + 1,
        nextCursor: step.nextWindow,
        nextPage: step.nextWindow === null ? null : step.nextWindow + 1,
        nextURL: step.nextURL ? safeURL(step.nextURL) : null,
      });
    },
  });
} catch (caught) {
  error = { code: caught?.code ?? "pagination_probe_error", message: caught?.message ?? "unknown_error" };
}

await Promise.all(responsePromises);
const selectedWindows = windows.filter(window => window.cursor >= 23 && window.cursor <= 28);
const cursor26 = windows.find(window => window.cursor === 26);
const cursor27 = windows.find(window => window.cursor === 27);
const terminalComparison = cursor26 && cursor27 ? {
  cursor26Page27SKUCount: cursor26.rawSKUs.length,
  cursor27Page28SKUCount: cursor27.rawSKUs.length,
  sameRawSKUSet: JSON.stringify(cursor26.rawSKUs) === JSON.stringify(cursor27.rawSKUs),
  newSKUsAtCursor27: diff(cursor27.rawSKUs, cursor26.rawSKUs),
  missingSKUsAtCursor27: diff(cursor26.rawSKUs, cursor27.rawSKUs),
} : null;
const graphql = responses.filter(record => record.finalURL.pathname === "/api/graphql");
const artifact = {
  routeURL,
  requestScope: { firstCursor: 0, lastCursorRequested: 28, maxWindows: 35 },
  collection: result ? {
    pagesFetched: result.pagesFetched,
    candidates: result.candidates.length,
    uniqueSKUs: result.uniqueListingSKUs,
    sourceExhausted: result.sourceExhausted,
    stallReason: result.stallReason,
    stallWindow: result.stallWindow,
    nextPage: result.nextPage,
  } : null,
  error,
  selectedWindows,
  terminalComparison,
  paginationSteps: paginationSteps.filter(step => step.cursor >= 23 && step.cursor <= 28),
  graphqlRequests: graphql,
  documentResponses: responses.filter(record => record.type === "document"),
  httpErrors: responses.filter(record => record.status >= 400),
};

await writeFile(outputPath, `${JSON.stringify(artifact, null, 2)}\n`, "utf8");
console.log(`HOOGVLIET_ZUIVEL_PAGINATION_PROOF ${JSON.stringify({
  routeURL,
  pagesFetched: result?.pagesFetched ?? 0,
  stallReason: result?.stallReason ?? error?.code ?? null,
  stallWindow: result?.stallWindow ?? null,
  terminalComparison,
  graphqlRequests: graphql.length,
  httpErrors: artifact.httpErrors.length,
})}`);

await context.close();
await browser.close();
if (error) process.exitCode = 1;
