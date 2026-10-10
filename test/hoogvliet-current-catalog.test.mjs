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

function fallbackStub(implementation = async () => ({ ok: false, reason: "fixture_failure" })) {
  const calls = [];
  let primaryListingWindows = 0;
  return {
    calls,
    recordPrimaryWindow() { primaryListingWindows += 1; },
    async attempt(input) {
      calls.push(input);
      return implementation(input);
    },
    accounting() {
      return {
        primaryListingWindows,
        fallbackAttempts: calls.length,
        fallbackProviderRequests: calls.length,
        fallbackSuccesses: 0,
        fallbackFailures: calls.length,
        fallbackProvider: "zyte",
        events: [],
      };
    },
  };
}

const tomatoesFallback = [{
  sourceURL: "https://hoogvliet.nl/product/trostomaten-verpakt-060936000",
  name: "Trostomaten verpakt",
  packageText: "500 gram",
}];

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
  const fallback = fallbackStub();
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    listingFallback: fallback,
  });
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.stallReason, null);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.loadMoreCycles, 0);
  assert.deepEqual(result.candidates.map(candidate => extractSKUFromProductURL(candidate.sourceURL)), [
    "064786000", "081222000", "060936000",
  ]);
  assert.equal(fallback.calls.length, 0);
});

test("verwachte next-window met geldige lege shell gebruikt exact eenmaal dezelfde URL via fallback", async t => {
  const emptyShell = '<!doctype html><main id="catalog-listing"><h1>Aardappelen, groente en fruit</h1></main>';
  const h = await browserFor({
    body: paginationFixture,
    bodyForURL: url => url.searchParams.get("page") === "2" ? emptyShell : paginationFixture,
  });
  t.after(() => h.browser.close());
  const fallback = fallbackStub(async () => ({ ok: true, candidates: tomatoesFallback }));
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    listingFallback: fallback,
  });
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.stallReason, null);
  assert.equal(fallback.calls.length, 1);
  assert.deepEqual(fallback.calls[0], {
    targetURL: "https://hoogvliet.nl/aardappelen-groente-fruit?page=2",
    routeURL: "https://hoogvliet.nl/aardappelen-groente-fruit",
    windowIndex: 1,
    triggerReason: "expected_next_non_hydrated",
  });
  assert.deepEqual(result.candidates.map(candidate => extractSKUFromProductURL(candidate.sourceURL)), [
    "064786000", "081222000", "060936000",
  ]);
});

for (const status of [408, 425, 429, 503]) {
  test(`retryable HTTP ${status} gebruikt exact één Zyte-attempt`, async t => {
    const h = await browserFor({ body: "<!doctype html><main>Tijdelijke bronstoring</main>", status });
    t.after(() => h.browser.close());
    const fallback = fallbackStub(async () => ({ ok: true, candidates: tomatoesFallback }));
    const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
      maxWindows: 10,
      listingFallback: fallback,
    });
    assert.equal(result.sourceExhausted, true);
    assert.equal(fallback.calls.length, 1);
    assert.equal(fallback.calls[0].targetURL, "https://hoogvliet.nl/aardappelen-groente-fruit");
    assert.equal(fallback.calls[0].triggerReason, status >= 500 ? "retryable_http_5xx" : `retryable_http_${status}`);
  });
}

test("primary leeg en fallback leeg blijft onvolledig", async t => {
  const emptyShell = '<!doctype html><main id="catalog-listing"><h1>Aardappelen, groente en fruit</h1></main>';
  const h = await browserFor({
    body: paginationFixture,
    bodyForURL: url => url.searchParams.get("page") === "2" ? emptyShell : paginationFixture,
  });
  t.after(() => h.browser.close());
  const fallback = fallbackStub(async () => ({ ok: false, reason: "listing_unusable" }));
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    listingFallback: fallback,
  });
  assert.equal(fallback.calls.length, 1);
  assert.equal(result.sourceExhausted, false);
  assert.equal(result.stallReason, "category_listing_stagnated");
  assert.deepEqual(result.stallDiagnostic, {
    route: "https://hoogvliet.nl/aardappelen-groente-fruit",
    window_index: 1,
    canonical_url: "https://hoogvliet.nl/aardappelen-groente-fruit?page=2",
    transition: "next",
    expectedByNext: true,
    response_status: 200,
    raw_candidate_count: 0,
    unique_sku_count: 0,
    shell_classification: "valid_catalog_shell",
    explicit_empty_classification: "not_explicitly_empty",
    empty_signal_type: "none",
    empty_match: "none",
    empty_source_selector: "none",
    empty_visible: "unknown",
    empty_strength: "none",
    fallback_eligible: true,
    fallback_eligibility_reason: "eligible_expected_next_non_hydrated",
    fallback_attempt_reason: "listing_unusable",
    fallback_attempts: 1,
    stop_reason: "category_listing_stagnated",
  });
});

test("permanente HTTP 404 gebruikt geen fallback", async t => {
  const h = await browserFor({ body: "<!doctype html><main>Niet gevonden</main>", status: 404 });
  t.after(() => h.browser.close());
  const fallback = fallbackStub();
  await assert.rejects(
    collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
      maxWindows: 10,
      listingFallback: fallback,
    }),
    error => error.code === "source_unavailable",
  );
  assert.equal(fallback.calls.length, 0);
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
  const fallback = fallbackStub();
  const result = await collectPublicCatalogCandidates(h.page, 10, { listingFallback: fallback });
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.rootCategoriesDiscovered, 2);
  assert.equal(result.rootListingRoutesSelected, 1);
  assert.equal(result.nestedFallbackRoutes, 1);
  assert.equal(result.categoriesVisited, 2);
  assert.equal(result.pagesFetched, 2);
  assert.deepEqual(result.candidates.map(candidate => candidate.sku), ["064786000", "081222000", "060936000"]);
  assert.equal(fallback.calls.length, 0);
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
  const fallback = fallbackStub();
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    listingFallback: fallback,
  });
  assert.equal(result.sourceExhausted, false);
  assert.equal(result.stallReason, "category_listing_stagnated");
  assert.equal(fallback.calls.length, 0);
  assert.equal(result.stallDiagnostic.transition, "load_more");
  assert.equal(result.stallDiagnostic.expectedByNext, false);
  assert.equal(result.stallDiagnostic.fallback_eligible, false);
  assert.equal(result.stallDiagnostic.fallback_eligibility_reason, "transition_load_more_not_expected_next");
});

test("zichtbare expliciete empty-state op verwachte next-window is natuurlijke exhaustion", async t => {
  const explicitEmpty = '<!doctype html><main id="catalog-listing"><h1>Aardappelen</h1><div data-testid="empty-state">Geen producten</div></main>';
  const h = await browserFor({
    body: paginationFixture,
    bodyForURL: url => url.searchParams.get("page") === "2" ? explicitEmpty : paginationFixture,
  });
  t.after(() => h.browser.close());
  const fallback = fallbackStub();
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    listingFallback: fallback,
  });
  assert.equal(fallback.calls.length, 0);
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.stallReason, null);
});

test("zichtbare generieke leegfrase blijft zwak en blokkeert next-window fallback niet", async t => {
  const genericNotice = '<!doctype html><main id="catalog-listing"><h1>Aardappelen</h1><aside>Geen producten beschikbaar in deze melding</aside></main>';
  const h = await browserFor({
    body: paginationFixture,
    bodyForURL: url => url.searchParams.get("page") === "2" ? genericNotice : paginationFixture,
  });
  t.after(() => h.browser.close());
  const fallback = fallbackStub(async () => ({ ok: false, reason: "provider_failure" }));
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    listingFallback: fallback,
  });
  assert.equal(fallback.calls.length, 1);
  assert.equal(result.stallDiagnostic.explicit_empty_classification, "weak_signal");
  assert.equal(result.stallDiagnostic.empty_signal_type, "body_text_phrase");
  assert.equal(result.stallDiagnostic.empty_match, "geen_producten");
  assert.equal(result.stallDiagnostic.empty_source_selector, "aside");
  assert.equal(result.stallDiagnostic.empty_visible, "true");
  assert.equal(result.stallDiagnostic.empty_strength, "weak");
  assert.equal(result.stallDiagnostic.fallback_eligible, true);
  assert.equal(result.stallDiagnostic.fallback_eligibility_reason, "eligible_expected_next_non_hydrated");
});

test("een verborgen leegplaceholder staat niet in rendered body-tekst en wordt als none vastgelegd", async t => {
  const hiddenNotice = '<!doctype html><main id="catalog-listing"><h1>Aardappelen</h1><div style="opacity:0"><div data-testid="empty-state">Geen producten</div></div></main>';
  const h = await browserFor({
    body: paginationFixture,
    bodyForURL: url => url.searchParams.get("page") === "2" ? hiddenNotice : paginationFixture,
  });
  t.after(() => h.browser.close());
  const fallback = fallbackStub();
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    listingFallback: fallback,
  });
  assert.equal(fallback.calls.length, 1);
  assert.equal(fallback.calls[0].triggerReason, "expected_next_non_hydrated");
  assert.equal(result.stallDiagnostic.explicit_empty_classification, "not_explicitly_empty");
  assert.equal(result.stallDiagnostic.empty_signal_type, "none");
  assert.equal(result.stallDiagnostic.empty_match, "none");
  assert.equal(result.stallDiagnostic.empty_visible, "unknown");
});

test("empty diagnostic reports the earliest matched phrase as a stable enum", async t => {
  const mixedNotice = '<!doctype html><main id="catalog-listing"><h1>Aardappelen</h1><p>Geen zoekresultaten. Geen producten.</p></main>';
  const h = await browserFor({
    body: paginationFixture,
    bodyForURL: url => url.searchParams.get("page") === "2" ? mixedNotice : paginationFixture,
  });
  t.after(() => h.browser.close());
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    listingFallback: fallbackStub(),
  });
  assert.equal(result.stallDiagnostic.empty_signal_type, "body_text_phrase");
  assert.equal(result.stallDiagnostic.empty_match, "geen_zoekresultaten");
});

test("sterke lege initial category is natuurlijke exhaustion zonder Zyte", async t => {
  const emptyInitial = '<!doctype html><main id="catalog-listing"><h1>Aardappelen</h1><div data-testid="empty-state">Geen producten</div></main>';
  const h = await browserFor({ body: emptyInitial });
  t.after(() => h.browser.close());
  const fallback = fallbackStub();
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    listingFallback: fallback,
  });
  assert.equal(fallback.calls.length, 0);
  assert.equal(result.initialCandidateCount, 0);
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.stallReason, null);
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
  const fallback = fallbackStub();
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    listingFallback: fallback,
  });
  assert.equal(result.sourceExhausted, false);
  assert.equal(result.stallReason, "category_listing_repeated_sku_window");
  assert.equal(result.pagesFetched, 1);
  assert.equal(fallback.calls.length, 0);
});

test("page zero/one alias is skipped while a genuine next page remains reachable", async t => {
  const body = paginationFixture.replace(
    '<a id="next" href="/aardappelen-groente-fruit?page=2">Next</a>',
    '<a href="/aardappelen-groente-fruit?page=1">Next</a><a id="next" href="/aardappelen-groente-fruit?page=2">Volgende</a>',
  );
  const h = await browserFor({ body });
  t.after(() => h.browser.close());
  const fallback = fallbackStub();
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    listingFallback: fallback,
  });
  assert.equal(result.sourceExhausted, true);
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.listingURLsVisited, 2);
  assert.deepEqual(result.candidates.map(candidate => extractSKUFromProductURL(candidate.sourceURL)), [
    "064786000", "081222000", "060936000",
  ]);
  assert.equal(fallback.calls.length, 0);
});

test("pagination-loop gebruikt geen fallback", async t => {
  const body = paginationFixture.replace(
    'href="/aardappelen-groente-fruit?page=2"',
    'href="/aardappelen-groente-fruit?page=1"',
  );
  const h = await browserFor({ body });
  t.after(() => h.browser.close());
  const fallback = fallbackStub();
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 10,
    listingFallback: fallback,
  });
  assert.equal(result.sourceExhausted, true);
  assert.equal(fallback.calls.length, 0);
});

test("listing-window-limit wordt niet met fallback omzeild", async t => {
  const h = await browserFor({ body: paginationFixture });
  t.after(() => h.browser.close());
  const fallback = fallbackStub();
  const result = await collectCatalogListing(h.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
    maxWindows: 1,
    listingFallback: fallback,
  });
  assert.equal(result.sourceExhausted, false);
  assert.equal(result.pagesFetched, 1);
  assert.equal(fallback.calls.length, 0);
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
  const fallback = fallbackStub();
  await assert.rejects(
    collectCatalogListing(changedCategory.page, "https://hoogvliet.nl/aardappelen-groente-fruit", {
      normalTimeoutMs: 50,
      listingFallback: fallback,
    }),
    error => error.code === "category_structure_changed",
  );
  assert.equal(fallback.calls.length, 0);
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
