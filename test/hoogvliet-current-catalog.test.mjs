import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import {
  CATALOG_ROOT_URL,
  collectCatalogListing,
  collectPublicCatalogCandidates,
  extractCatalogListingCandidates,
  extractSKUFromProductURL,
  normalizeCatalogCategoryURL,
  normalizeCatalogListingCandidate,
  RootCategoryDiscoveryError,
} from "../src/hoogvliet.mjs";

const fixture = await readFile(new URL("./fixtures/hoogvliet-current-catalog.html", import.meta.url), "utf8");
const paginationFixture = await readFile(new URL("./fixtures/hoogvliet-current-pagination.html", import.meta.url), "utf8");
const rootFixture = await readFile(new URL("./fixtures/hoogvliet-current-catalog-root.html", import.meta.url), "utf8");

async function browserFor({ body = fixture, rootBody = body, status = 200, bodyForPath, statusForPath } = {}) {
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });
  const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
  await context.route("https://hoogvliet.nl/**", route => {
    const pathname = new URL(route.request().url()).pathname;
    return route.fulfill({
      status: statusForPath?.(pathname) ?? status,
      contentType: "text/html",
      body: pathname === "/producten" ? rootBody : bodyForPath?.(pathname) ?? body,
    });
  });
  await context.route("https://hoogvliet.nl/api/graphql**", async route => {
    const url = new URL(route.request().url());
    const variables = JSON.parse(url.searchParams.get("variables") || "{}");
    const requested = variables.filters?.sku?.in ?? [];
    const catalog = new Map([
      ["064786000", { name: "Hoogvliet Komkommer", url_key: "hoogvliet-komkommer-064786000", package: "Stuks", price: 0.69 }],
      ["081222000", { name: "Blauwe bessen", url_key: "blauwe-bessen-081222000", package: "300 gram", price: 4.39 }],
      ["060936000", { name: "Trostomaten verpakt", url_key: "trostomaten-verpakt-060936000", package: "500 gram", price: 2.29 }],
    ]);
    const items = requested.filter(sku => catalog.has(sku)).map(sku => {
      const item = catalog.get(sku);
      return {
        sku,
        name: item.name,
        url_key: item.url_key,
        stock_status: "IN_STOCK",
        small_image: { url: `https://hoogvliet.nl/images/${sku}.jpg`, label: item.name },
        categories: [{ name: "Aardappelen, groente, fruit", level: 2, url_path: "aardappelen-groente-fruit" }],
        price_range: { minimum_price: { final_price: { value: item.price }, regular_price: { value: item.price } } },
        metadata: JSON.stringify({ verpakking: item.package }),
      };
    });
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { products: { items } } }) });
  });
  return { browser, context, page: await context.newPage() };
}

test("current listing fixture yields SKU, product identity, package, price and image", async t => {
  const h = await browserFor();
  t.after(() => h.browser.close());
  await h.page.goto(CATALOG_ROOT_URL);
  const candidates = await extractCatalogListingCandidates(h.page);
  assert.equal(candidates.length, 2);
  assert.deepEqual(candidates.map(candidate => candidate.sourceURL), [
    "https://hoogvliet.nl/product/hoogvliet-komkommer-064786000",
    "https://hoogvliet.nl/product/blauwe-bessen-081222000",
  ]);
  const normalized = candidates.map(candidate => normalizeCatalogListingCandidate(candidate, "/aardappelen-groente-fruit"));
  assert.deepEqual(normalized.map(candidate => candidate.sku), ["064786000", "081222000"]);
  assert.equal(normalized[0].packageText, "1 stuk");
  assert.equal(normalized[0].displayedPrice, 0.69);
  assert.equal(normalized[0].category, "aardappelen groente fruit");
});

test("current category load-more traverses beyond the initial visible batch", async t => {
  const h = await browserFor();
  t.after(() => h.browser.close());
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
  });
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.stallReason, null);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.loadMoreCycles, 1);
  assert.equal(result.candidates.length, 3);
  assert.deepEqual(result.candidates.map(candidate => extractSKUFromProductURL(candidate.sourceURL)), [
    "064786000", "081222000", "060936000",
  ]);
});

test("repeated terminal listing page is exhausted only when the published total is reached", async t => {
  const body = fixture
    .replace('<main id="catalog-listing">', '<main id="catalog-listing"><p>3 producten</p>')
    .replace("document.querySelector('#load-more').remove();", "void 0;");
  const h = await browserFor({ body });
  t.after(() => h.browser.close());
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    listingGrowthTimeoutMs: 50,
  });
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.totalProductCount, 3);
  assert.equal(result.exhaustionReason, "total_count_reached");
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.stallReason, null);
});

test("repeated listing page remains partial when the published total is not reached", async t => {
  const body = fixture
    .replace('<main id="catalog-listing">', '<main id="catalog-listing"><p>4 producten</p>')
    .replace("document.querySelector('#load-more').remove();", "void 0;");
  const h = await browserFor({ body });
  t.after(() => h.browser.close());
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    listingGrowthTimeoutMs: 50,
  });
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.totalProductCount, 4);
  assert.equal(result.exhaustionReason, null);
  assert.equal(result.sourceExhausted, false);
  assert.equal(result.stallReason, "category_listing_stagnated");
});

test("current category Next pagination traverses a second public listing page", async t => {
  const h = await browserFor({ body: paginationFixture });
  t.after(() => h.browser.close());
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
  });
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.stallReason, null);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.loadMoreCycles, 0);
  assert.deepEqual(result.candidates.map(candidate => extractSKUFromProductURL(candidate.sourceURL)), [
    "064786000", "081222000", "060936000",
  ]);
});

test("catalog root discovers multiple public categories and deduplicates cross-listed cards", async t => {
  const h = await browserFor();
  t.after(() => h.browser.close());
  const result = await collectPublicCatalogCandidates(h.page, 20);
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.categoriesVisited, 2);
  assert.equal(result.listingLoadMoreCycles, 2);
  assert.equal(result.rawCandidates, 6);
  assert.equal(result.duplicateCandidates, 3);
  assert.equal(result.uniqueListingSKUs, 3);
  assert.equal(result.rootCategoriesDiscovered, 2);
  assert.equal(result.routesVisited, 3);
  assert.deepEqual(result.candidates.map(candidate => candidate.sku), ["064786000", "081222000", "060936000"]);
});

test("coverage mode queues and visits all 20 root categories, then ends with an empty queue", async t => {
  const rootBody = `<main><nav aria-label="Productcatalogus">${Array.from({ length: 20 }, (_, index) => (
    `<a href="/coverage-category-${String(index + 1).padStart(2, "0")}">Categorie ${index + 1}</a>`
  )).join("")}</nav></main>`;
  const h = await browserFor({ rootBody });
  t.after(() => h.browser.close());
  const result = await collectPublicCatalogCandidates(h.page, 100, {
    continueAfterCategoryStall: true,
    enqueueCategoryChildren: false,
  });
  assert.equal(result.rootCategoriesDiscovered, 20);
  assert.equal(result.queuedCategories.length, 20);
  assert.equal(result.rootCategoriesVisited, 20);
  assert.equal(result.categoriesVisited, 20);
  assert.equal(result.categoryResults.length, 20);
  assert.equal(result.queueEmpty, true);
  assert.equal(result.coverageComplete, true);
  assert.equal(result.sourceExhausted, true);
  assert.ok(result.categoryResults.every(category => category.stopReason === "exhausted"));
  assert.ok(result.categoryResults.every(category => category.pagesFetched === 2));
});

test("coverage mode treats category stagnation as local and continues with the next queued route", async t => {
  const stagnatedBody = fixture.replace("document.querySelector('#load-more').remove();", "void 0;");
  const h = await browserFor({ body: stagnatedBody, rootBody: rootFixture });
  t.after(() => h.browser.close());
  const result = await collectPublicCatalogCandidates(h.page, 20, {
    continueAfterCategoryStall: true,
    enqueueCategoryChildren: false,
  });
  assert.equal(result.rootCategoriesDiscovered, 2);
  assert.equal(result.categoriesVisited, 2);
  assert.equal(result.categoryResults.length, 2);
  assert.deepEqual(result.categoryResults.map(category => category.stopReason), ["stagnated", "stagnated"]);
  assert.equal(result.queueEmpty, true);
  assert.equal(result.coverageComplete, false);
  assert.equal(result.sourceExhausted, false);
});

test("a category challenge remains a global safe stop and preserves the unvisited queue", async t => {
  const h = await browserFor({
    rootBody: rootFixture,
    statusForPath: pathname => pathname === "/aardappelen-groente-fruit" ? 403 : 200,
  });
  t.after(() => h.browser.close());
  await assert.rejects(
    collectPublicCatalogCandidates(h.page, 20, {
      continueAfterCategoryStall: true,
      enqueueCategoryChildren: false,
    }),
    error => {
      assert.equal(error.code, "source_challenge");
      assert.equal(error.collectionStats.categoryResults[0].stopReason, "challenge");
      assert.ok(error.collectionStats.queueRemaining > 0);
      return true;
    },
  );
});

test("catalog root waits for hydrated navigation and never runs listing pagination on root", async t => {
  const h = await browserFor({ rootBody: rootFixture });
  t.after(() => h.browser.close());
  const result = await collectPublicCatalogCandidates(h.page, 1);
  assert.equal(result.rootCategoriesDiscovered, 2);
  assert.equal(result.categoriesVisited, 1);
  assert.equal(result.routesVisited, 2);
  assert.equal(result.pagesFetched, 1);
  assert.equal(result.initialCandidateCount, 2);
  assert.equal(result.listingLoadMoreCycles, 1);
  assert.equal(result.candidates.length, 2);
});

test("load-more stagnation is fail-closed and does not claim exhaustion", async t => {
  const body = fixture.replace("document.querySelector('#load-more').remove();", "void 0;");
  const h = await browserFor({ body });
  t.after(() => h.browser.close());
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
  });
  assert.equal(result.sourceExhausted, false);
  assert.equal(result.stallReason, "category_listing_stagnated");
});

test("root discovery failure, category structure changes and challenge have explicit source codes", async t => {
  const challenge = await browserFor({ body: "<main>Access denied</main>", status: 403 });
  t.after(() => challenge.browser.close());
  await assert.rejects(
    collectPublicCatalogCandidates(challenge.page, 2),
    error => error.code === "source_challenge",
  );

  const changed = await browserFor({ rootBody: "<main><h1>Nieuwe catalogus</h1></main>" });
  t.after(() => changed.browser.close());
  await assert.rejects(
    collectPublicCatalogCandidates(changed.page, 2, { normalTimeoutMs: 50 }),
    error => error instanceof RootCategoryDiscoveryError && error.code === "root_category_discovery_failed",
  );

  const changedCategory = await browserFor({ body: "<main><h1>Nieuwe categoriepagina</h1></main>" });
  t.after(() => changedCategory.browser.close());
  await assert.rejects(
    collectCatalogListing(changedCategory.page, "https://hoogvliet.nl/aardappelen-groente-fruit", { normalTimeoutMs: 50 }),
    error => error.code === "category_structure_changed",
  );
});

test("catalog URL guard accepts only current public category paths", () => {
  assert.equal(normalizeCatalogCategoryURL("https://hoogvliet.nl/aardappelen-groente-fruit"),
    "https://hoogvliet.nl/aardappelen-groente-fruit");
  assert.equal(normalizeCatalogCategoryURL("https://hoogvliet.nl/product/trostomaten-verpakt-060936000"), null);
  assert.equal(normalizeCatalogCategoryURL("https://hoogvliet.nl/INTERSHOP/web/WFS/catalog"), null);
  assert.equal(normalizeCatalogCategoryURL("https://evil.example/aardappelen-groente-fruit"), null);
});
