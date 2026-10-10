import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { chromium } from "playwright";

import {
  parseZyteBrowserHTML,
  runZyteListingProof,
  ZYTE_API_URL,
  ZYTE_PROOF_REQUESTS,
  ZYTE_REQUEST_TIMEOUT_MS,
} from "../scripts/probe-zyte-listing-windows.mjs";

const fixture = await readFile(new URL("./fixtures/hoogvliet-current-catalog.html", import.meta.url), "utf8");
const workflow = await readFile(new URL("../.github/workflows/manual-zyte-listing-proof.yml", import.meta.url), "utf8");
const proofScript = await readFile(new URL("../scripts/probe-zyte-listing-windows.mjs", import.meta.url), "utf8");

test("Zyte browserHtml uses the existing listing parser without loading subresources", async t => {
  const browser = await chromium.launch({ headless: true, executablePath: "/usr/bin/chromium" });
  t.after(() => browser.close());
  const context = await browser.newContext({ javaScriptEnabled: false });
  t.after(() => context.close());
  let blockedSubresourceRequests = 0;
  await context.route("**/*", route => {
    blockedSubresourceRequests += 1;
    return route.abort();
  });
  const parsed = await parseZyteBrowserHTML(
    context,
    fixture,
    "https://hoogvliet.nl/chips-zoutjes-noten/q/page/4",
  );
  assert.deepEqual(parsed, { rawCandidateCount: 2, skuCount: 2, hydrated: true });
  assert.equal(blockedSubresourceRequests, 2);
});

test("proof performs exactly the six allowlisted requests once and never logs the key", async () => {
  const calls = [];
  const logs = [];
  const secret = "test-zyte-key-never-log";
  const result = await runZyteListingProof({
    apiKey: secret,
    fetchImpl: async (url, options) => {
      const payload = JSON.parse(options.body);
      calls.push({ url, options, payload });
      return new Response(JSON.stringify({
        url: payload.url,
        statusCode: 200,
        browserHtml: "<html><body>proof</body></html>",
      }), { status: 200 });
    },
    browserFactory: async () => ({
      newContext: async () => ({
        route: async () => {},
        newPage: async () => ({
          setContent: async () => {},
          evaluate: async () => ([{
            sourceURL: "https://hoogvliet.nl/product/proof-product-123456789",
          }]),
          close: async () => {},
        }),
        close: async () => {},
      }),
      close: async () => {},
    }),
    logger: { info: value => logs.push(value) },
    now: (() => {
      let value = 0;
      return () => { value += 5; return value; };
    })(),
  });

  assert.equal(result.success, true);
  assert.equal(calls.length, 6);
  assert.deepEqual(calls.map(call => call.payload.url), ZYTE_PROOF_REQUESTS);
  assert.ok(calls.every(call => call.url === ZYTE_API_URL));
  assert.ok(calls.every(call => call.payload.browserHtml === true));
  assert.ok(calls.every(call => call.options.redirect === "error"));
  assert.ok(calls.every(call => call.options.method === "POST"));
  assert.equal(ZYTE_REQUEST_TIMEOUT_MS, 60_000);
  assert.equal(logs.length, 7);
  assert.ok(logs.every(line => !line.includes(secret)));
  assert.ok(logs.every(line => !line.toLowerCase().includes("authorization")));
  assert.deepEqual(result.summary, { requests: 6, successes: 6, failures: 0 });
});

test("a provider failure is measured once, never retried, and all six fixed calls finish", async () => {
  let calls = 0;
  const result = await runZyteListingProof({
    apiKey: "test-key",
    fetchImpl: async (_url, options) => {
      calls += 1;
      const targetURL = JSON.parse(options.body).url;
      if (calls === 1) return new Response("provider unavailable", { status: 503 });
      return new Response(JSON.stringify({
        url: targetURL,
        statusCode: 200,
        browserHtml: "<html><body>proof</body></html>",
      }), { status: 200 });
    },
    browserFactory: async () => ({
      newContext: async () => ({
        route: async () => {},
        newPage: async () => ({
          setContent: async () => {},
          evaluate: async () => ([{
            sourceURL: "https://hoogvliet.nl/product/proof-product-123456789",
          }]),
          close: async () => {},
        }),
        close: async () => {},
      }),
      close: async () => {},
    }),
    logger: { info: () => {} },
  });
  assert.equal(calls, 6);
  assert.equal(result.success, false);
  assert.deepEqual(result.summary, { requests: 6, successes: 5, failures: 1 });
  assert.equal(result.metrics[0].zyteApiStatus, 503);
  assert.equal(result.metrics[0].hydrated, false);
});

test("missing key fails before browser or network activity", async () => {
  let fetchCalls = 0;
  let browserCalls = 0;
  await assert.rejects(
    runZyteListingProof({
      apiKey: "",
      fetchImpl: async () => { fetchCalls += 1; },
      browserFactory: async () => { browserCalls += 1; },
    }),
    /ZYTE_API_KEY ontbreekt/,
  );
  assert.equal(fetchCalls, 0);
  assert.equal(browserCalls, 0);
});

test("workflow is manual-only, secret-only and cannot reach importer or write paths", () => {
  assert.match(workflow, /^on:\n  workflow_dispatch:\n/m);
  assert.doesNotMatch(workflow, /^\s*(schedule|push|pull_request):/m);
  assert.match(workflow, /ZYTE_API_KEY: \$\{\{ secrets\.ZYTE_API_KEY \}\}/);
  assert.match(workflow, /npm run proof:zyte-listing/);
  assert.match(workflow, /timeout-minutes: 10/);
  assert.match(workflow, /persist-credentials: false/);
  assert.doesNotMatch(workflow, /SUPABASE|import:daily|import:skus|maintenance|upsert|write|schedule:/i);
  assert.match(proofScript, /extractCatalogListingCandidates/);
  assert.doesNotMatch(
    proofScript,
    /supabase|daily-catalog-maintenance|importer|upsertProducts|startCatalogImportRun|finishCatalogImportRun/i,
  );
});
