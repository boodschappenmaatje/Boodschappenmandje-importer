import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { chromium } from "playwright";
import {
  CATALOG_ROOT_URL,
  collectCatalogListing,
  collectPublicCatalogCandidates,
  catalogListingPageIdentity,
  extractCatalogListingCandidates,
  extractSKUFromProductURL,
  normalizeCatalogCategoryURL,
  normalizeCatalogListingCandidate,
  RootCategoryDiscoveryError,
  selectCatalogListingRoutes,
} from "../src/hoogvliet.mjs";

const fixture = await readFile(new URL("./fixtures/hoogvliet-current-catalog.html", import.meta.url), "utf8");
const paginationFixture = await readFile(new URL("./fixtures/hoogvliet-current-pagination.html", import.meta.url), "utf8");
const rootFixture = await readFile(new URL("./fixtures/hoogvliet-current-catalog-root.html", import.meta.url), "utf8");

async function browserFor({ body = fixture, rootBody = body, bodyForURL = null, status = 200 } = {}) {
  const graphqlRequests = [];
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });
  const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
  await context.route("https://hoogvliet.nl/**", route => {
    const url = new URL(route.request().url());
    return route.fulfill({
      status,
      contentType: "text/html",
      body: bodyForURL?.(url) ?? (url.pathname === "/producten" ? rootBody : body),
    });
  });
  await context.route("https://hoogvliet.nl/api/graphql**", async route => {
    const url = new URL(route.request().url());
    const variables = JSON.parse(url.searchParams.get("variables") || "{}");
    const requested = variables.filters?.sku?.in ?? [];
    graphqlRequests.push([...requested]);
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
  return { browser, context, page: await context.newPage(), graphqlRequests };
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
  assert.equal(result.catalogAPICalls, 2);
  assert.deepEqual(h.graphqlRequests.map(request => request.length), [2, 1]);
  assert.equal(result.candidates.length, 3);
  assert.deepEqual(result.candidates.map(candidate => extractSKUFromProductURL(candidate.sourceURL)), [
    "064786000", "081222000", "060936000",
  ]);
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

test("catalog root visits an aggregate parent once and skips overlapping nested routes", async t => {
  const h = await browserFor();
  t.after(() => h.browser.close());
  const result = await collectPublicCatalogCandidates(h.page, 20);
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.categoriesVisited, 1);
  assert.equal(result.listingLoadMoreCycles, 1);
  assert.equal(result.catalogAPICalls, 2);
  assert.deepEqual(h.graphqlRequests.map(request => request.length), [2, 1]);
  assert.equal(result.rawCandidates, 3);
  assert.equal(result.duplicateCandidates, 0);
  assert.equal(result.uniqueListingSKUs, 3);
  assert.equal(result.rootCategoriesDiscovered, 2);
  assert.equal(result.rootListingRoutesSelected, 1);
  assert.equal(result.nestedRoutesSkipped, 1);
  assert.equal(result.routesVisited, 2);
  assert.deepEqual(result.candidates.map(candidate => candidate.sku), ["064786000", "081222000", "060936000"]);
});

test("navigation-only aggregate category falls back to its real nested category", async t => {
  const root = `<!doctype html><main><a href="/vers">Vers</a><a href="/vers/fruit">Fruit</a></main>`;
  const parent = `<!doctype html><main><a href="/vers/fruit">Fruit</a></main>`;
  const h = await browserFor({
    rootBody: root,
    bodyForURL: url => url.pathname === "/producten" ? root : url.pathname === "/vers" ? parent : fixture,
  });
  t.after(() => h.browser.close());
  const result = await collectPublicCatalogCandidates(h.page, 10, { normalTimeoutMs: 50 });
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.rootCategoriesDiscovered, 2);
  assert.equal(result.rootListingRoutesSelected, 1);
  assert.equal(result.nestedFallbackRoutes, 1);
  assert.equal(result.categoriesVisited, 2);
  assert.equal(result.pagesFetched, 2);
  assert.deepEqual(result.candidates.map(candidate => candidate.sku), ["064786000", "081222000", "060936000"]);
});

test("category navigation shell waits for delayed product hydration before deciding stagnation", async t => {
  const firstPage = `<!doctype html><main>
    <a href="/producten/kaas">Kaas</a>
    <article><a href="/product/hoogvliet-komkommer-064786000"><h2>Hoogvliet Komkommer</h2></a></article>
    <a href="/aardappelen-groente-fruit/q/page/2">Volgende</a>
  </main>`;
  const delayedSecondPage = `<!doctype html><main>
    <a href="/producten/kaas">Kaas</a>
    <script>
      setTimeout(() => {
        document.querySelector('main').insertAdjacentHTML('beforeend',
          '<article><a href="/product/trostomaten-verpakt-060936000"><h2>Trostomaten verpakt</h2></a></article>');
      }, 100);
    </script>
  </main>`;
  const h = await browserFor({
    bodyForURL: url => url.pathname.endsWith("/q/page/2") ? delayedSecondPage : firstPage,
  });
  t.after(() => h.browser.close());
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    normalTimeoutMs: 1_000,
  });
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.stallReason, null);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.catalogAPICalls, 2);
  assert.deepEqual(result.candidates.map(candidate => extractSKUFromProductURL(candidate.sourceURL)), [
    "064786000", "060936000",
  ]);
});

test("category shell that never hydrates remains fail-closed", async t => {
  const firstPage = `<!doctype html><main>
    <article><a href="/product/hoogvliet-komkommer-064786000"><h2>Hoogvliet Komkommer</h2></a></article>
    <a href="/aardappelen-groente-fruit/q/page/2">Volgende</a>
  </main>`;
  const stalledSecondPage = `<!doctype html><main><a href="/producten/kaas">Kaas</a></main>`;
  const h = await browserFor({
    bodyForURL: url => url.pathname.endsWith("/q/page/2") ? stalledSecondPage : firstPage,
  });
  t.after(() => h.browser.close());
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    normalTimeoutMs: 100,
  });
  assert.equal(result.sourceExhausted, false);
  assert.equal(result.stallReason, "category_listing_stagnated");
  assert.equal(result.pagesFetched, 1);
  assert.equal(result.catalogAPICalls, 1);
});

test("catalog root waits for hydrated navigation, filters domain links and never paginates root", async t => {
  const h = await browserFor({ rootBody: rootFixture });
  t.after(() => h.browser.close());
  assert.match(rootFixture, /<a href="\/Hoogvliet\.nl">Hoogvliet\.nl<\/a>/);
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

test("repeated SKU window stops without recounting or looping", async t => {
  const body = `<!doctype html><main>
    <article><a href="/product/hoogvliet-komkommer-064786000"><h2>Hoogvliet Komkommer</h2></a></article>
    <button id="load-more">Producten laden</button>
    <script>document.querySelector('#load-more').addEventListener('click', () => {
      document.querySelector('#load-more').insertAdjacentHTML('beforebegin',
        '<article><a href="/product/hoogvliet-komkommer-064786000?alias=1"><h2>Hoogvliet Komkommer</h2></a></article>');
      document.querySelector('#load-more').remove();
    });</script>
  </main>`;
  const h = await browserFor({ body });
  t.after(() => h.browser.close());
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
  });
  assert.equal(result.sourceExhausted, false);
  assert.equal(result.stallReason, "category_listing_repeated_sku_window");
  assert.equal(result.pagesFetched, 1);
});

test("page zero/one alias is skipped while a genuine next page remains reachable", async t => {
  const body = paginationFixture.replace(
    '<a id="next" href="/aardappelen-groente-fruit?page=2">Next</a>',
    '<a href="/aardappelen-groente-fruit?page=1">Next</a><a id="next" href="/aardappelen-groente-fruit?page=2">Volgende</a>',
  );
  const h = await browserFor({ body });
  t.after(() => h.browser.close());
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
  });
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.listingURLsVisited, 2);
  assert.deepEqual(result.candidates.map(candidate => extractSKUFromProductURL(candidate.sourceURL)), [
    "064786000", "081222000", "060936000",
  ]);
});

test("a naturally exhausted one-window listing is complete exactly at the safety cap", async t => {
  const body = fixture.replace('<button type="button" id="load-more">Producten laden</button>', "");
  const h = await browserFor({ body });
  t.after(() => h.browser.close());
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 1,
  });
  assert.equal(result.pagesFetched, 1);
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.stallReason, null);
});

test("category routes and listing page aliases have deterministic identities", () => {
  const routes = [
    { url: "https://hoogvliet.nl/vers" },
    { url: "https://hoogvliet.nl/vers/fruit" },
    { url: "https://hoogvliet.nl/dranken" },
    { url: "https://hoogvliet.nl/vers" },
  ];
  assert.deepEqual(selectCatalogListingRoutes(routes).map(route => route.url), [
    "https://hoogvliet.nl/vers", "https://hoogvliet.nl/dranken",
  ]);
  assert.equal(
    catalogListingPageIdentity("https://hoogvliet.nl/vers?page=1"),
    catalogListingPageIdentity("https://hoogvliet.nl/vers"),
  );
  assert.notEqual(
    catalogListingPageIdentity("https://hoogvliet.nl/vers?page=2"),
    catalogListingPageIdentity("https://hoogvliet.nl/vers"),
  );
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
  assert.equal(normalizeCatalogCategoryURL("https://hoogvliet.nl/Hoogvliet.nl"), null);
  assert.equal(normalizeCatalogCategoryURL("https://hoogvliet.nl/Hoogvliet%2Enl"), null);
  assert.equal(normalizeCatalogCategoryURL("https://hoogvliet.nl/aardappelen-groente-fruit/fruit"),
    "https://hoogvliet.nl/aardappelen-groente-fruit/fruit");
  assert.equal(normalizeCatalogCategoryURL("https://hoogvliet.nl/product/trostomaten-verpakt-060936000"), null);
  assert.equal(normalizeCatalogCategoryURL("https://hoogvliet.nl/INTERSHOP/web/WFS/catalog"), null);
  assert.equal(normalizeCatalogCategoryURL("https://evil.example/aardappelen-groente-fruit"), null);
});
