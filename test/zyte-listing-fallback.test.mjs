import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { loadConfig, limits } from "../src/config.mjs";
import {
  catalogListingPageIdentity,
  createZyteListingFallback,
  normalizeCatalogListingURL,
} from "../src/hoogvliet.mjs";
import {
  fetchZyteListingHTML,
  ZYTE_API_URL,
  ZYTE_MAX_BROWSER_HTML_BYTES,
} from "../src/zyte-listing-fallback.mjs";

const targetURL = "https://hoogvliet.nl/chips-zoutjes-noten/q/page/4";
const listingHTML = `<!doctype html><article><a href="/product/proof-product-123456789"><h2>Proof</h2></a></article>`;

function response(values = {}, status = 200) {
  return new Response(JSON.stringify({
    url: targetURL,
    statusCode: 200,
    browserHtml: listingHTML,
    ...values,
  }), { status, headers: { "content-type": "application/json" } });
}

function adapter(values = {}) {
  return fetchZyteListingHTML({
    targetURL,
    apiKey: "fixture-key-never-log",
    timeoutMs: 45_000,
    normalizeListingURL: normalizeCatalogListingURL,
    listingIdentity: catalogListingPageIdentity,
    fetchImpl: async () => response(values),
  });
}

function fakeBrowser(candidates = [{ sourceURL: "https://hoogvliet.nl/product/proof-product-123456789" }]) {
  return {
    newContext: async options => {
      assert.equal(options.javaScriptEnabled, false);
      return {
        newPage: async () => ({
          route: async () => {},
          setContent: async () => {},
          evaluate: async () => candidates,
          close: async () => {},
        }),
        close: async () => {},
      };
    },
  };
}

function enabledConfig(values = {}) {
  return {
    zyteListingFallbackEnabled: true,
    zyteApiKey: "fixture-key-never-log",
    zyteListingFallbackMaxRequests: 3,
    zyteListingFallbackTimeoutMs: 45_000,
    ...values,
  };
}

test("Zyte-adapter accepteert exact één geldige listing-URL zonder retry", async () => {
  const calls = [];
  const result = await fetchZyteListingHTML({
    targetURL,
    apiKey: "fixture-key-never-log",
    timeoutMs: 45_000,
    normalizeListingURL: normalizeCatalogListingURL,
    listingIdentity: catalogListingPageIdentity,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response();
    },
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, ZYTE_API_URL);
  assert.deepEqual(JSON.parse(calls[0].options.body), { url: targetURL, browserHtml: true });
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(result.finalResponseURL, targetURL);
  assert.equal(result.html, listingHTML);
});

test("ongeldige category/listing-URL stopt vóór providerrequest", async () => {
  let calls = 0;
  const result = await fetchZyteListingHTML({
    targetURL: "https://evil.example/chips/q/page/4",
    apiKey: "fixture-key",
    normalizeListingURL: normalizeCatalogListingURL,
    listingIdentity: catalogListingPageIdentity,
    fetchImpl: async () => { calls += 1; return response(); },
  });
  assert.equal(result.reason, "invalid_listing_url");
  assert.equal(calls, 0);
  assert.equal(normalizeCatalogListingURL("https://hoogvliet.nl/chips-zoutjes-noten?page=2"),
    "https://hoogvliet.nl/chips-zoutjes-noten?page=2");
  assert.equal(normalizeCatalogListingURL("https://hoogvliet.nl/chips-zoutjes-noten/q/page/4"), targetURL);
  assert.equal(normalizeCatalogListingURL("https://hoogvliet.nl/chips-zoutjes-noten/q/page/0"), null);
  assert.equal(normalizeCatalogListingURL("https://hoogvliet.nl/chips-zoutjes-noten?page=2&sort=price"), null);
  assert.equal(normalizeCatalogListingURL("https://hoogvliet.nl/product/proof-123456789"), null);
});

test("API-fout en timeout falen begrensd zonder retry", async () => {
  let apiCalls = 0;
  const apiError = await fetchZyteListingHTML({
    targetURL, apiKey: "fixture-key", normalizeListingURL: normalizeCatalogListingURL,
    listingIdentity: catalogListingPageIdentity,
    fetchImpl: async () => { apiCalls += 1; return response({}, 503); },
  });
  assert.equal(apiError.reason, "api_error");
  assert.equal(apiCalls, 1);

  let timeoutCalls = 0;
  const timeout = await fetchZyteListingHTML({
    targetURL, apiKey: "fixture-key", normalizeListingURL: normalizeCatalogListingURL,
    listingIdentity: catalogListingPageIdentity,
    fetchImpl: async () => {
      timeoutCalls += 1;
      throw Object.assign(new Error("secret provider detail"), { name: "AbortError" });
    },
  });
  assert.equal(timeout.reason, "timeout");
  assert.equal(timeoutCalls, 1);
});

test("verkeerde finalResponseURL en afwijkende listingidentiteit falen dicht", async () => {
  const wrongHost = await adapter({ url: "https://example.test/chips/q/page/4" });
  assert.equal(wrongHost.reason, "invalid_final_response_url");
  const wrongWindow = await adapter({ url: "https://hoogvliet.nl/chips-zoutjes-noten/q/page/5" });
  assert.equal(wrongWindow.reason, "listing_identity_mismatch");
});

test("onbruikbare bronstatus faalt ook bij Zyte API 200", async () => {
  assert.equal((await adapter({ statusCode: 503 })).reason, "source_status_unusable");
});

test("ontbrekende of te grote browserHtml is onbruikbaar", async () => {
  assert.equal((await adapter({ browserHtml: "" })).reason, "browser_html_missing");
  const tooLarge = "x".repeat(ZYTE_MAX_BROWSER_HTML_BYTES + 1);
  assert.equal((await adapter({ browserHtml: tooLarge })).reason, "browser_html_too_large");
});

test("gezonde primary gebruikt nul fallbackattempts", async () => {
  const fallback = createZyteListingFallback({
    config: enabledConfig(), browser: fakeBrowser(), logger: { info() {} },
    requestImpl: async () => { throw new Error("fallback mag niet worden aangeroepen"); },
  });
  fallback.recordPrimaryWindow();
  fallback.recordPrimaryWindow();
  assert.deepEqual(fallback.accounting(), {
    primaryListingWindows: 2,
    fallbackAttempts: 0,
    fallbackProviderRequests: 0,
    fallbackSuccesses: 0,
    fallbackFailures: 0,
    fallbackProvider: "zyte",
    events: [],
  });
  await fallback.close();
});

test("fallback gebruikt per canonical window maximaal één providerattempt", async () => {
  let calls = 0;
  const logs = [];
  const fallback = createZyteListingFallback({
    config: enabledConfig(), browser: fakeBrowser(), logger: { info: value => logs.push(value) },
    requestImpl: async () => {
      calls += 1;
      return { ok: true, provider: "zyte", apiStatus: 200, sourceStatus: 200,
        finalResponseURL: targetURL, latencyMs: 7, htmlBytes: listingHTML.length, html: listingHTML };
    },
  });
  const input = { targetURL, routeURL: "https://hoogvliet.nl/chips-zoutjes-noten",
    windowIndex: 3, triggerReason: "expected_next_non_hydrated" };
  assert.equal((await fallback.attempt(input)).ok, true);
  assert.equal((await fallback.attempt(input)).reason, "window_already_attempted");
  assert.equal(calls, 1);
  assert.ok(logs.every(line => !line.includes("fixture-key-never-log")));
  assert.ok(logs.every(line => !line.includes(listingHTML)));
  assert.ok(logs.every(line => !/authorization/i.test(line)));
  assert.deepEqual(fallback.accounting(), {
    primaryListingWindows: 0,
    fallbackAttempts: 2,
    fallbackProviderRequests: 1,
    fallbackSuccesses: 1,
    fallbackFailures: 1,
    fallbackProvider: "zyte",
    events: fallback.accounting().events,
  });
  await fallback.close();
});

test("disabled fallback en ontbrekende key doen geen providerrequest", async () => {
  for (const config of [enabledConfig({ zyteListingFallbackEnabled: false }), enabledConfig({ zyteApiKey: null })]) {
    let calls = 0;
    const fallback = createZyteListingFallback({
      config, browser: fakeBrowser(), logger: { info() {} },
      requestImpl: async () => { calls += 1; return { ok: false }; },
    });
    const result = await fallback.attempt({ targetURL,
      routeURL: "https://hoogvliet.nl/chips-zoutjes-noten", windowIndex: 3,
      triggerReason: "expected_next_non_hydrated" });
    assert.equal(result.ok, false);
    assert.equal(calls, 0);
    assert.equal(fallback.accounting().fallbackFailures, 1);
    await fallback.close();
  }
});

test("runbudget stopt de vierde noodzakelijke fallback zonder vierde providerrequest", async () => {
  let calls = 0;
  const fallback = createZyteListingFallback({
    config: enabledConfig(), browser: fakeBrowser(), logger: { info() {} },
    requestImpl: async ({ targetURL: requested }) => {
      calls += 1;
      return { ok: true, provider: "zyte", apiStatus: 200, sourceStatus: 200,
        finalResponseURL: requested, latencyMs: 7, htmlBytes: listingHTML.length, html: listingHTML };
    },
  });
  const results = [];
  for (let page = 2; page <= 5; page += 1) {
    results.push(await fallback.attempt({
      targetURL: `https://hoogvliet.nl/chips-zoutjes-noten/q/page/${page}`,
      routeURL: "https://hoogvliet.nl/chips-zoutjes-noten",
      windowIndex: page - 1,
      triggerReason: "expected_next_non_hydrated",
    }));
  }
  assert.deepEqual(results.map(result => result.ok), [true, true, true, false]);
  assert.equal(results[3].reason, "request_limit_reached");
  assert.equal(calls, 3);
  assert.equal(fallback.accounting().fallbackFailures, 1);
  await fallback.close();
});

test("config begrenst requestmaximum op 150 en timeout op 60 seconden", () => {
  const config = loadConfig({
    DRY_RUN: "1",
    UPDATE_MODE: "maintenance",
    CATALOG_BATCH: "growth",
    ZYTE_LISTING_FALLBACK_ENABLED: "1",
    ZYTE_API_KEY: "fixture-key",
    ZYTE_LISTING_FALLBACK_MAX_REQUESTS: "999",
    ZYTE_LISTING_FALLBACK_TIMEOUT_MS: "999999",
  });
  assert.equal(config.zyteListingFallbackEnabled, true);
  assert.equal(config.zyteListingFallbackMaxRequests, 150);
  assert.equal(config.zyteListingFallbackTimeoutMs, 60_000);
  assert.equal(limits.defaultZyteListingFallbackMaxRequests, 3);
  assert.equal(limits.defaultZyteListingFallbackTimeoutMs, 45_000);
  const defaults = loadConfig({ DRY_RUN: "1", UPDATE_MODE: "maintenance", CATALOG_BATCH: "growth" });
  assert.equal(defaults.zyteListingFallbackEnabled, false);
  assert.equal(defaults.zyteApiKey, null);
  assert.equal(defaults.zyteListingFallbackMaxRequests, 3);
  assert.equal(defaults.zyteListingFallbackTimeoutMs, 45_000);
});

test("maintenanceworkflows geven Zyte-secret alleen aan de uitvoerende maintenancestap", async () => {
  const files = [
    "import-hoogvliet-poc.yml",
    "retry-daily-catalog-import.yml",
    "manual-daily-catalog-maintenance.yml",
  ];
  for (const filename of files) {
    const workflow = await readFile(new URL(`../.github/workflows/${filename}`, import.meta.url), "utf8");
    assert.equal((workflow.match(/ZYTE_API_KEY: \$\{\{ secrets\.ZYTE_API_KEY \}\}/g) ?? []).length, 1, filename);
    assert.match(workflow, /ZYTE_LISTING_FALLBACK_ENABLED: "1"/);
    assert.match(workflow, /ZYTE_LISTING_FALLBACK_MAX_REQUESTS: "60"/);
    assert.match(workflow, /DAILY_PARTIAL_SNAPSHOT_ENABLED: "1"/);
    assert.match(workflow, /DAILY_PARTIAL_MIN_SKUS: "1000"/);
    assert.match(workflow, /ZYTE_LISTING_FALLBACK_TIMEOUT_MS: "45000"/);
    const jobEnv = workflow.match(/^    env:\n([\s\S]*?)(?=^    steps:)/m)?.[1] ?? "";
    assert.doesNotMatch(jobEnv, /ZYTE_/);
  }
});

test("config: partiële dagsnapshot staat standaard uit en heeft een ondergrens", () => {
  const defaults = loadConfig({ DRY_RUN: "1", UPDATE_MODE: "maintenance", CATALOG_BATCH: "growth" });
  assert.equal(defaults.dailyPartialSnapshotEnabled, false);
  assert.equal(defaults.dailyPartialMinSKUs, limits.defaultDailyPartialMinSKUs);
  const low = loadConfig({
    DRY_RUN: "1", UPDATE_MODE: "maintenance", CATALOG_BATCH: "growth",
    DAILY_PARTIAL_SNAPSHOT_ENABLED: "1", DAILY_PARTIAL_MIN_SKUS: "5",
  });
  assert.equal(low.dailyPartialSnapshotEnabled, true);
  assert.equal(low.dailyPartialMinSKUs, limits.safeDailyPartialMinSKUs);
});

test("echte Zyte-HTML: volgende-paginalink wordt gevolgd, laatste pagina is null", async t => {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });
  t.after(() => browser.close());
  const page4 = "https://hoogvliet.nl/chips-zoutjes-noten/q/page/4";
  const product = '<article><a href="/product/proof-product-123456789"><h2>Proof</h2></a></article>';
  const htmlFor = url => url.endsWith("/4")
    ? `<!doctype html><main>${product}<a href="/chips-zoutjes-noten/q/page/5">Volgende</a></main>`
    : `<!doctype html><main>${product.replace("123456789", "123456780")}</main>`;
  const fallback = createZyteListingFallback({
    config: enabledConfig(), browser, logger: { info() {} },
    requestImpl: async ({ targetURL: requested }) => ({ ok: true, provider: "zyte", apiStatus: 200,
      sourceStatus: 200, finalResponseURL: requested, latencyMs: 1, htmlBytes: 10, html: htmlFor(requested) }),
  });
  t.after(() => fallback.close());
  const first = await fallback.attempt({ targetURL: page4, routeURL: "https://hoogvliet.nl/chips-zoutjes-noten",
    windowIndex: 3, triggerReason: "expected_next_stagnated" });
  assert.equal(first.ok, true);
  assert.equal(first.nextURL, "https://hoogvliet.nl/chips-zoutjes-noten/q/page/5");
  const last = await fallback.attempt({ targetURL: first.nextURL, routeURL: "https://hoogvliet.nl/chips-zoutjes-noten",
    windowIndex: 4, triggerReason: "expected_next_stagnated" });
  assert.equal(last.ok, true);
  assert.equal(last.nextURL, null);
});

test("fake parserpagina zonder linkondersteuning geeft onbekende nextURL, geen exhaustion", async () => {
  const fallback = createZyteListingFallback({
    config: enabledConfig(), browser: fakeBrowser(), logger: { info() {} },
    requestImpl: async () => ({ ok: true, provider: "zyte", apiStatus: 200, sourceStatus: 200,
      finalResponseURL: targetURL, latencyMs: 1, htmlBytes: listingHTML.length, html: listingHTML }),
  });
  const result = await fallback.attempt({ targetURL, routeURL: "https://hoogvliet.nl/chips-zoutjes-noten",
    windowIndex: 3, triggerReason: "expected_next_stagnated" });
  assert.equal(result.ok, true);
  assert.equal(result.nextURL, undefined);
  await fallback.close();
});
