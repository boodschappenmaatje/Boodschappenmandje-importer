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
} from "../src/hoogvliet.mjs";

const fixture = await readFile(new URL("./fixtures/hoogvliet-current-catalog.html", import.meta.url), "utf8");

async function browserFor({ body = fixture, status = 200 } = {}) {
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });
  const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
  await context.route("https://hoogvliet.nl/**", route => route.fulfill({
    status,
    contentType: "text/html",
    body,
  }));
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
  assert.deepEqual(result.candidates.map(candidate => candidate.sku), ["064786000", "081222000", "060936000"]);
});

test("load-more stagnation is fail-closed and does not claim exhaustion", async t => {
  const body = fixture.replace("document.querySelector('#load-more').remove();", "void 0;");
  const h = await browserFor({ body });
  t.after(() => h.browser.close());
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
  });
  assert.equal(result.sourceExhausted, false);
  assert.equal(result.stallReason, "load_more_stagnated");
});

test("challenge and changed catalog structure stop with explicit source codes", async t => {
  const challenge = await browserFor({ body: "<main>Access denied</main>", status: 403 });
  t.after(() => challenge.browser.close());
  await assert.rejects(
    collectPublicCatalogCandidates(challenge.page, 2),
    error => error.code === "source_challenge",
  );

  const changed = await browserFor({ body: "<main><h1>Nieuwe catalogus</h1></main>" });
  t.after(() => changed.browser.close());
  await assert.rejects(
    collectPublicCatalogCandidates(changed.page, 2),
    error => error.code === "parser_structure_changed",
  );
});

test("catalog URL guard accepts only current public category paths", () => {
  assert.equal(normalizeCatalogCategoryURL("https://hoogvliet.nl/aardappelen-groente-fruit"), 
    "https://hoogvliet.nl/aardappelen-groente-fruit");
  assert.equal(normalizeCatalogCategoryURL("https://hoogvliet.nl/product/trostomaten-verpakt-060936000"), null);
  assert.equal(normalizeCatalogCategoryURL("https://evil.example/aardappelen-groente-fruit"), null);
});
