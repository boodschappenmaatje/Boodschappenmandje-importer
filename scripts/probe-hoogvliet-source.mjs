import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { searchURL } from "../src/hoogvliet.mjs";

const term = process.env.PROBE_TERM ?? "category:999999-100";
const targetURL = searchURL(term, 0);
const outputPath = process.env.PROBE_OUTPUT ?? "hoogvliet-source-proof.json";

function safeEndpoint(rawURL) {
  try {
    const url = new URL(rawURL);
    return {
      origin: url.origin,
      pathname: url.pathname,
      queryKeys: [...new Set(url.searchParams.keys())].sort(),
    };
  } catch {
    return { origin: "invalid", pathname: "invalid", queryKeys: [] };
  }
}

function isProductURL(value) {
  return typeof value === "string" && /https?:\/\/[^/]+\/product\//i.test(value);
}

function shapeOf(value, depth = 0, seen = new WeakSet()) {
  if (value === null) return "null";
  if (typeof value !== "object") return typeof value;
  if (seen.has(value)) return "circular";
  seen.add(value);
  if (depth >= 3) return Array.isArray(value) ? `array(${value.length})` : "object";
  if (Array.isArray(value)) {
    return {
      type: "array",
      length: value.length,
      items: value.slice(0, 2).map(item => shapeOf(item, depth + 1, seen)),
    };
  }
  return Object.fromEntries(Object.keys(value).sort().slice(0, 80).map(key => [key, shapeOf(value[key], depth + 1, seen)]));
}

function inspectJSON(value) {
  const skus = new Set();
  const productURLs = new Set();
  const candidatePaths = [];
  let productLikeObjects = 0;
  let visited = 0;

  const visit = (node, path = "$", depth = 0) => {
    if (visited++ > 25_000 || depth > 10 || node === null || typeof node !== "object") return;
    if (Array.isArray(node)) {
      node.slice(0, 2_000).forEach((item, index) => visit(item, `${path}[${index}]`, depth + 1));
      return;
    }
    const keys = Object.keys(node);
    const lowerKeys = keys.map(key => key.toLowerCase());
    const hasProductKey = lowerKeys.some(key => /product|article|artikel|sku|ean|url|name|title/.test(key));
    const hasIdentityKey = lowerKeys.some(key => /sku|ean|article|artikel|product.?number|product.?code/.test(key));
    if (hasProductKey && hasIdentityKey) {
      productLikeObjects += 1;
      if (candidatePaths.length < 80) candidatePaths.push({ path, keys: keys.sort() });
    }
    for (const [key, child] of Object.entries(node)) {
      if (typeof child === "string") {
        if (/sku|ean|article|artikel|product.?number|product.?code/i.test(key) && /^\d{9}$/.test(child)) skus.add(child);
        if (isProductURL(child)) productURLs.add(child);
      }
      visit(child, `${path}.${key}`, depth + 1);
    }
  };
  visit(value);
  return {
    shape: shapeOf(value),
    productLikeObjects,
    uniqueSKUHints: [...skus].sort().slice(0, 20),
    productURLHints: [...productURLs].map(safeEndpoint).slice(0, 20),
    candidatePaths,
  };
}

function classify({ status, challenge, explicitEmpty, candidateCount }) {
  if (challenge || status === 401 || status === 403) return "CHALLENGE";
  if (status >= 500 || status === 408 || status === 425 || status === 429) return "SOURCE_UNAVAILABLE";
  if (candidateCount > 0) return "VALID_SOURCE";
  if (explicitEmpty) return "VALID_EMPTY_SEARCH";
  return "PARSER_STRUCTURE_CHANGED";
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
const page = await context.newPage();
const responseTasks = [];
const network = [];

page.on("response", response => {
  const request = response.request();
  const type = request.resourceType();
  if (!["document", "xhr", "fetch", "script"].includes(type)) return;
  responseTasks.push((async () => {
    const record = {
      type,
      status: response.status(),
      contentType: response.headers()["content-type"]?.split(";", 1)[0] ?? null,
      endpoint: safeEndpoint(response.url()),
    };
    if (type === "xhr" || type === "fetch") {
      try {
        const text = await response.text();
        record.bodyLength = text.length;
        if (record.contentType?.includes("json") || /^[\s]*[\[{]/.test(text)) {
          try {
            const parsed = JSON.parse(text);
            record.json = inspectJSON(parsed);
          } catch {
            record.jsonParseable = false;
          }
        }
      } catch {
        record.bodyRead = "failed";
      }
    }
    network.push(record);
  })());
});

let navigationResponse;
let navigationError = null;
try {
  navigationResponse = await page.goto(targetURL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(5_000);
} catch (error) {
  navigationError = error?.name ?? "navigation_error";
}
await Promise.allSettled(responseTasks);

const dom = await page.evaluate(() => {
  const clean = value => (value || "").replace(/\s+/g, " ").trim();
  const productLinks = [...new Set([...document.querySelectorAll("a[href*='/product/']")].map(link => link.href))];
  const dataAttributes = {};
  for (const element of document.querySelectorAll("*[data-sku], *[data-product-id], *[data-product], *[data-productcode]")) {
    for (const name of element.getAttributeNames().filter(attribute => attribute.startsWith("data-"))) {
      dataAttributes[name] = (dataAttributes[name] ?? 0) + 1;
    }
  }
  const jsonScripts = [...document.querySelectorAll("script[type='application/json'], script[type='application/ld+json']")];
  const jsonScriptInfo = jsonScripts.map(script => {
    let parsed = null;
    try { parsed = JSON.parse(script.textContent || ""); } catch {}
    return { type: script.getAttribute("type"), length: script.textContent?.length ?? 0, parsed: Boolean(parsed), topKeys: parsed && typeof parsed === "object" && !Array.isArray(parsed) ? Object.keys(parsed).sort().slice(0, 80) : [] };
  });
  const bodyText = (document.body?.innerText ?? "").toLowerCase();
  return {
    title: document.title,
    finalURL: location.href,
    bodyTextLength: bodyText.trim().length,
    htmlLength: document.documentElement?.outerHTML?.length ?? 0,
    counts: {
      productTiles: document.querySelectorAll(".product-tile").length,
      productTitleLinks: document.querySelectorAll("a.product-title").length,
      productDetails: document.querySelectorAll(".product-details").length,
      productLinks: productLinks.length,
      searchRoots: document.querySelectorAll("#product-search-result").length,
      forms: document.querySelectorAll("form").length,
      scripts: document.scripts.length,
      jsonScripts: jsonScripts.length,
    },
    productLinkHints: productLinks.slice(0, 20),
    dataAttributes,
    jsonScriptInfo,
    scriptSources: [...document.scripts].map(script => script.src).filter(Boolean).map(src => new URL(src).pathname).slice(0, 80),
    challenge: /captcha|verify you are human|controleer of je een mens bent|access denied|toegang geweigerd|forbidden/.test(bodyText),
    explicitEmpty: /geen (?:producten|zoekresultaten)|geen resultaten gevonden|niks kunnen vinden|niets gevonden|0 resultaten/.test(bodyText),
    textHints: ["Producten", "producten", "resultaten", "zoeken", "laden"].filter(value => bodyText.includes(value.toLowerCase())),
    cleanBodyStart: clean(document.body?.innerText).slice(0, 240),
  };
});

const jsonNetwork = network.filter(record => record.json);
const uniqueSKUs = [...new Set(jsonNetwork.flatMap(record => record.json.uniqueSKUHints ?? []))];
const productURLs = [...new Set([
  ...dom.productLinkHints,
  ...jsonNetwork.flatMap(record => (record.json.productURLHints ?? []).map(item => `${item.origin}${item.pathname}`)),
])];
const candidateCount = Math.max(dom.counts.productTiles, dom.counts.productLinks, uniqueSKUs.length, productURLs.length,
  jsonNetwork.reduce((sum, record) => sum + (record.json.productLikeObjects ?? 0), 0));
const result = {
  target: { term, url: targetURL },
  navigation: {
    error: navigationError,
    initialStatus: navigationResponse?.status?.() ?? null,
    finalURL: dom.finalURL,
    title: dom.title,
  },
  dom,
  network: network.map(record => ({ ...record, bodyStart: undefined })),
  proof: {
    candidateCount,
    uniqueSKUHintCount: uniqueSKUs.length,
    productURLHintCount: productURLs.length,
    sourceClassification: classify({
      status: navigationResponse?.status?.() ?? 0,
      challenge: dom.challenge,
      explicitEmpty: dom.explicitEmpty,
      candidateCount,
    }),
  },
};

await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`HOOGVLIET_PROBE_RESULT ${JSON.stringify(result.proof)}`);
console.log(JSON.stringify({ navigation: result.navigation, dom: { counts: dom.counts, dataAttributes: dom.dataAttributes, jsonScriptInfo: dom.jsonScriptInfo }, jsonNetwork: jsonNetwork.map(record => ({ status: record.status, endpoint: record.endpoint, bodyLength: record.bodyLength, json: record.json })) }, null, 2));
await context.close();
await browser.close();

if (result.proof.sourceClassification !== "VALID_SOURCE" || result.proof.candidateCount < 1) process.exitCode = 1;
