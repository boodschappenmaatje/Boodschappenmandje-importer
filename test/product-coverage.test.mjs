import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import { catalogBatches, loadConfig } from "../src/config.mjs";
import { DISCOVERY_STRATEGY_VERSION, buildDynamicDiscoveryTerms } from "../src/catalog-growth.mjs";
import { PUBLIC_CATALOG_ROUTE, categoryDiscoveryRoute } from "../src/discovery-routes.mjs";
import { collectGrowthCandidates } from "../src/growth-collector.mjs";
import {
  collectCandidatePages,
  extractSKUFromProductURL,
  isRelevantCandidate,
  isReliableCatalogProduct,
  normalizeCatalogCategoryURL,
  normalizeCatalogListingCandidate,
  searchURL,
  validateCandidate,
} from "../src/hoogvliet.mjs";

const fixture = JSON.parse(await readFile(new URL("./fixtures/hoogvliet-coverage-20260930.json", import.meta.url)));
const category = PUBLIC_CATALOG_ROUTE.key;
const settings = {
  searchTerms: [category], maxNewProducts: 400, growthMaxTotalPages: 800,
  growthMaxPagesPerTerm: 1, growthMaxCandidates: 5000, growthMaxRuntimeMs: 10000,
};
function detailPage(detail, catalogItems = []) {
  return { goto: async () => {}, waitForFunction: async () => {},
    evaluate: async (_fn, argument) => {
      if (argument?.variables?.filters?.sku) {
        return { status: 200, body: { data: { products: { items: catalogItems } } } };
      }
      return argument?.selector ? { hasExpectedContent: true } : detail;
    } };
}

test("the daily route is the current public catalog root and has no keyword fallback", () => {
  assert.deepEqual(catalogBatches.growth, [PUBLIC_CATALOG_ROUTE.key]);
  assert.equal(loadConfig({ DRY_RUN: "1", CATALOG_BATCH: "growth" }).searchTerms.length, 1);
  assert.equal(searchURL(PUBLIC_CATALOG_ROUTE.key), "https://hoogvliet.nl/producten");
  assert.throws(() => searchURL("category:999999-100"), { code: "source_unavailable" });
  assert.equal(buildDynamicDiscoveryTerms([{ brand: "Brand 1" }], catalogBatches.growth).length, 0);
  assert.equal(DISCOVERY_STRATEGY_VERSION, "hoogvliet-public-catalog-api-pagination-v4");
});

test("only current public category URLs are accepted and SKU comes from the product URL", () => {
  assert.deepEqual(categoryDiscoveryRoute(PUBLIC_CATALOG_ROUTE.key), PUBLIC_CATALOG_ROUTE);
  assert.equal(normalizeCatalogCategoryURL("https://hoogvliet.nl/aardappelen-groente-fruit/groente/tomaat-paprika"),
    "https://hoogvliet.nl/aardappelen-groente-fruit/groente/tomaat-paprika");
  assert.equal(normalizeCatalogCategoryURL("https://hoogvliet.nl/product/trostomaten-verpakt-060936000"), null);
  assert.equal(normalizeCatalogCategoryURL("https://evil.example/catalogus"), null);
  assert.equal(extractSKUFromProductURL("https://hoogvliet.nl/product/trostomaten-verpakt-060936000"), "060936000");
  assert.equal(extractSKUFromProductURL("https://hoogvliet.nl/product/without-sku"), null);
});

test("listing candidates keep product identity, URL and category context as candidate data", () => {
  const candidate = normalizeCatalogListingCandidate({
    name: "Trostomaten verpakt", sourceURL: "https://hoogvliet.nl/product/trostomaten-verpakt-060936000",
    packageText: "500 gram", displayedPrice: 2.29, imageURL: "https://hoogvliet.nl/images/tomaat.jpg",
  }, "https://hoogvliet.nl/aardappelen-groente-fruit/groente/tomaat-paprika");
  assert.deepEqual(candidate, {
    name: "Trostomaten verpakt", sourceURL: "https://hoogvliet.nl/product/trostomaten-verpakt-060936000",
    packageText: "500 gram", displayedPrice: 2.29, imageURL: "https://hoogvliet.nl/images/tomaat.jpg",
    sku: "060936000", brand: null, category: "tomaat paprika",
  });
});

test("category membership does not apply keyword relevance filtering", async () => {
  const prunes = fixture.products.find(product => product.sku === "718878000");
  assert.equal(isRelevantCandidate(prunes, "Bewuste voeding"), false);
  const result = await collectCandidatePages(async () => ({
    candidates: [prunes], pagesFetched: 1, rawCandidates: 1, sourceExhausted: true,
  }), category, 1);
  assert.equal(result.candidates[0].sku, prunes.sku);
});

test("malformed listing identity is rejected and cross-category duplicates are counted", async () => {
  const p = fixture.products[0];
  const result = await collectCandidatePages(async () => [
    p, p, { ...p, sku: "bad" }, { ...p, sourceURL: "https://evil.example/product/test" },
  ], category, 1);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.invalidCandidates, 2);
  assert.equal(result.duplicateCandidates, 1);
});

test("existing SKU is skipped, valid new detail is retained and invalid detail is not added", async () => {
  const rows = fixture.products.slice(0, 4);
  const result = await collectGrowthCandidates({ ...settings, maxNewProducts: 10 }, {
    existingSKUs: new Set([rows[0].sku]),
    findCandidates: async () => ({ candidates: rows, rawCandidates: rows.length, pagesFetched: 1, sourceExhausted: true }),
    validateCandidate: async (candidate, diagnostics) => {
      if (candidate.sku === rows[2].sku) { diagnostics.reason = "invalidDetail"; return null; }
      return validateCandidate(detailPage(candidate.detail), candidate, diagnostics);
    },
  });
  assert.deepEqual(result.products.map(product => product.sku), [rows[1].sku, rows[3].sku]);
  assert.equal(result.stats.existingCandidatesSkipped, 1);
  assert.equal(result.stats.invalidProductsSkipped, 1);
  assert.equal(result.stats.dispositions.validatedOnly, 2);
  assert.equal(result.stats.accounting.balanced, true);
  assert.ok(result.products.every(isReliableCatalogProduct));
});

test("detail validation remains authoritative for SKU, package and positive price", async () => {
  const product = fixture.products[0];
  const cases = [
    [{ sku: "123456789" }, "sku_mismatch"],
    [{ packageText: "" }, "missing_package"],
    [{ displayPrice: 0 }, "invalidPrice"],
    [{ displayPrice: null }, "invalidPrice"],
  ];
  for (const [changes, reason] of cases) {
    const diagnostics = {};
    assert.equal(await validateCandidate(detailPage({ ...product.detail, ...changes }), product, diagnostics), null);
    assert.equal(diagnostics.reason, reason);
  }
});

test("current detail JSON-LD plus exact catalog API package data reaches price validation", async t => {
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });
  t.after(() => browser.close());
  const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
  t.after(() => context.close());
  await context.route("https://hoogvliet.nl/**", async route => {
    if (new URL(route.request().url()).pathname === "/api/graphql") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { products: { items: [{
          sku: "000685000", url_key: "bio-biologische-broccoli-000685000", name: "Bio+ Biologische broccoli",
          metadata: JSON.stringify({ verpakking: "Stuks" }),
          price_range: { minimum_price: { final_price: { value: 1.99 } } },
        }] } } }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "text/html",
      body: `<!doctype html><main><h1>Bio+ Biologische broccoli</h1>
        <script type="application/ld+json">${JSON.stringify({
          "@type": "Product", sku: "000685000", name: "Bio+ Biologische broccoli",
          brand: { name: "Bio+" }, offers: { price: 1.99 },
        })}</script></main>`,
    });
  });
  const page = await context.newPage();
  const diagnostics = {};
  const product = await validateCandidate(page, {
    sku: "000685000", sourceURL: "https://hoogvliet.nl/product/bio-biologische-broccoli-000685000",
    available: true, searchTerm: "catch-up:explicit-sku",
  }, diagnostics);
  assert.equal(product.sku, "000685000");
  assert.equal(product.packageText, "Stuks");
  assert.equal(product.price, 1.99);
  assert.equal(diagnostics.reason, undefined);
  assert.equal(diagnostics.parser.catalog_api.matched_sku, "000685000");
});

test("a stale product detail HTTP 404 is a safe invalid-detail rejection", async () => {
  const product = fixture.products[0];
  const page = {
    url: () => product.sourceURL,
    goto: async url => ({
      status: () => 404,
      url: () => url,
      request: () => ({ method: () => "GET", url: () => url }),
    }),
  };
  const diagnostics = {};
  assert.equal(await validateCandidate(page, product, diagnostics), null);
  assert.equal(diagnostics.reason, "notFound");
});

test("all proven current listing candidates can be validated without persistence", async () => {
  const result = await collectGrowthCandidates(settings, {
    findCandidates: async () => ({ candidates: fixture.products, rawCandidates: 15, pagesFetched: 1, sourceExhausted: true }),
    validateCandidate: product => validateCandidate(detailPage(product.detail), product),
  });
  assert.equal(new Set(result.products.map(product => product.sku)).size, 15);
  assert.equal(result.stats.persistedNewProducts, 0);
  assert.equal(result.stats.dispositions.validatedOnly, 15);
  assert.equal(result.stats.accounting.balanced, true);
});
