import { pathToFileURL } from "node:url";

import { chromium } from "playwright";

import {
  catalogListingPageIdentity,
  chromiumLaunchOptions,
  extractCatalogListingCandidates,
  extractSKUFromProductURL,
} from "../src/hoogvliet.mjs";

export const ZYTE_API_URL = "https://api.zyte.com/v1/extract";
export const ZYTE_REQUEST_TIMEOUT_MS = 60_000;
export const ZYTE_PROOF_REQUESTS = Object.freeze([
  "https://hoogvliet.nl/chips-zoutjes-noten/q/page/4",
  "https://hoogvliet.nl/chips-zoutjes-noten/q/page/4",
  "https://hoogvliet.nl/chips-zoutjes-noten/q/page/4",
  "https://hoogvliet.nl/chips-zoutjes-noten/q/page/1",
  "https://hoogvliet.nl/chips-zoutjes-noten/q/page/1",
  "https://hoogvliet.nl/chips-zoutjes-noten/q/page/1",
]);

function htmlWithBaseURL(html, targetURL) {
  const base = `<base href="${targetURL}">`;
  return /<head\b[^>]*>/i.test(html)
    ? html.replace(/<head\b[^>]*>/i, match => `${match}${base}`)
    : `${base}${html}`;
}

function safeTargetURL(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "hoogvliet.nl" || url.username || url.password) {
      return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

export async function parseZyteBrowserHTML(context, html, targetURL) {
  const page = await context.newPage();
  try {
    await page.setContent(htmlWithBaseURL(html, targetURL), { waitUntil: "domcontentloaded" });
    const candidates = await extractCatalogListingCandidates(page);
    const skus = new Set(candidates
      .map(candidate => extractSKUFromProductURL(candidate.sourceURL))
      .filter(Boolean));
    return {
      rawCandidateCount: candidates.length,
      skuCount: skus.size,
      hydrated: skus.size > 0,
    };
  } finally {
    await page.close();
  }
}

async function requestZyteBrowserHTML({ apiKey, targetURL, fetchImpl, now }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ZYTE_REQUEST_TIMEOUT_MS);
  const startedAt = now();
  try {
    const response = await fetchImpl(ZYTE_API_URL, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: targetURL, browserHtml: true }),
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      return {
        ok: false,
        zyteApiStatus: response.status,
        sourceStatus: null,
        finalResponseURL: null,
        latencyMs: Math.max(0, now() - startedAt),
        html: null,
      };
    }
    let body;
    try {
      body = JSON.parse(await response.text());
    } catch {
      return {
        ok: false,
        zyteApiStatus: response.status,
        sourceStatus: null,
        finalResponseURL: null,
        latencyMs: Math.max(0, now() - startedAt),
        html: null,
      };
    }
    const finalResponseURL = safeTargetURL(body?.url);
    const html = typeof body?.browserHtml === "string" ? body.browserHtml : null;
    const latencyMs = Math.max(0, now() - startedAt);
    return {
      ok: Boolean(finalResponseURL && html),
      zyteApiStatus: response.status,
      sourceStatus: Number.isInteger(body?.statusCode) ? body.statusCode : null,
      finalResponseURL,
      latencyMs,
      html,
    };
  } catch (error) {
    return {
      ok: false,
      zyteApiStatus: error?.name === "AbortError" ? "timeout" : "network_error",
      sourceStatus: null,
      finalResponseURL: null,
      latencyMs: Math.max(0, now() - startedAt),
      html: null,
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function runZyteListingProof({
  apiKey = process.env.ZYTE_API_KEY,
  chromePath = process.env.CHROME_PATH,
  fetchImpl = globalThis.fetch,
  browserFactory = options => chromium.launch(options),
  logger = console,
  now = Date.now,
} = {}) {
  if (typeof apiKey !== "string" || !apiKey.trim()) {
    throw new Error("ZYTE_API_KEY ontbreekt; read-only proof niet gestart.");
  }
  if (typeof fetchImpl !== "function") throw new Error("Fetchimplementatie ontbreekt.");
  if (ZYTE_PROOF_REQUESTS.length !== 6) throw new Error("Zyte-proof moet exact zes requests bevatten.");

  const browser = await browserFactory(chromiumLaunchOptions({ headless: true, chromePath }));
  const context = await browser.newContext({
    javaScriptEnabled: false,
    locale: "nl-NL",
    timezoneId: "Europe/Amsterdam",
  });
  // Provider-HTML wordt offline geparsed; subresources mogen de meting niet
  // aanvullen en kunnen daardoor ook geen onverwachte extra requests starten.
  await context.route("**/*", route => route.abort());
  const metrics = [];
  try {
    for (const [index, targetURL] of ZYTE_PROOF_REQUESTS.entries()) {
      const provider = await requestZyteBrowserHTML({
        apiKey: apiKey.trim(),
        targetURL,
        fetchImpl,
        now,
      });
      let parsed = { rawCandidateCount: 0, skuCount: 0, hydrated: false };
      if (provider.ok && provider.html) {
        try {
          parsed = await parseZyteBrowserHTML(context, provider.html, targetURL);
        } catch {
          parsed = { rawCandidateCount: 0, skuCount: 0, hydrated: false };
        }
      }
      const sameListingIdentity = Boolean(provider.finalResponseURL)
        && catalogListingPageIdentity(provider.finalResponseURL) === catalogListingPageIdentity(targetURL);
      const metric = {
        requestNumber: index + 1,
        targetURL,
        zyteApiStatus: provider.zyteApiStatus,
        sourceStatus: provider.sourceStatus,
        finalResponseURL: provider.finalResponseURL,
        latencyMs: provider.latencyMs,
        htmlBytes: provider.html ? Buffer.byteLength(provider.html, "utf8") : 0,
        rawCandidateCount: parsed.rawCandidateCount,
        skuCount: parsed.skuCount,
        hydrated: parsed.hydrated,
        sameListingIdentity,
        success: provider.ok && parsed.hydrated && sameListingIdentity,
      };
      metrics.push(metric);
      logger.info(`zyte_listing_proof=${JSON.stringify(metric)}`);
    }
  } finally {
    await context.close();
    await browser.close();
  }

  const successes = metrics.filter(metric => metric.success).length;
  const summary = { requests: metrics.length, successes, failures: metrics.length - successes };
  logger.info(`zyte_listing_proof_summary=${JSON.stringify(summary)}`);
  return { success: successes === ZYTE_PROOF_REQUESTS.length, metrics, summary };
}

export async function main() {
  const result = await runZyteListingProof();
  if (!result.success) {
    throw new Error(`Zyte listingproof faalde voor ${result.summary.failures} van 6 requests.`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : "Zyte listingproof mislukt.");
    process.exitCode = 1;
  });
}
