import { appendFileSync, readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const productURL = "https://www.hoogvliet.com/product/trostomaten-verpakt";
const skuExpected = "060936000";
const key = process.env.ZYTE_API_KEY;
const tempModule = "src/.hoogvliet-zyte-proof.mjs";
const endpoint = "https://api.zyte.com/v1/extract";

function out(name, value) {
  const safe = String(value === undefined || value === null ? "" : value)
    .replace(/[\r\n]/g, " ").slice(0, 250);
  console.log(name + "=" + safe);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, name + "=" + safe + "\n");
}
function statusOK(value) {
  return Number.isInteger(value) && value >= 200 && value < 300;
}
function isChallenge(html, status) {
  return status === 403 || status === 429
    || /_Incapsula_Resource|incapsula|incap_ses|access denied|verify you are human|captcha|request unsuccessful/i.test(html);
}
function addBase(html, url) {
  const base = '<base href="' + url.replace(/[^/]*$/, "") + '">';
  if (/<head[^>]*>/i.test(html)) return html.replace(/<head([^>]*)>/i, "<head$1>" + base);
  return base + html;
}
async function requestPage(url, mode) {
  try {
    const payload = mode === "browserHtml"
      ? { url: url, browserHtml: true }
      : { url: url, httpResponseBody: true };
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(key + ":").toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(120000),
    });
    const json = await response.json().catch(() => null);
    let html = "";
    if (json) {
      if (mode === "browserHtml" && typeof json.browserHtml === "string") html = json.browserHtml;
      if (mode !== "browserHtml" && typeof json.httpResponseBody === "string") {
        html = Buffer.from(json.httpResponseBody, "base64").toString("utf8");
      }
    }
    const targetStatus = json && Number.isInteger(json.statusCode) ? json.statusCode : null;
    return {
      apiStatus: response.status,
      targetStatus: targetStatus,
      html: html,
      challenge: isChallenge(html, targetStatus),
      providerOK: response.status >= 200 && response.status < 300,
    };
  } catch {
    return { apiStatus: null, targetStatus: null, html: "", challenge: false, providerOK: false };
  }
}
async function loadImporter() {
  const source = readFileSync("src/hoogvliet.mjs", "utf8");
  const needle = "async function extractSearchCandidates(page) {";
  if (!source.includes(needle)) throw new Error("LISTING_PARSER_NOT_FOUND");
  writeFileSync(tempModule, source.replace(needle, "export async function extractSearchCandidates(page) {"));
  return import(pathToFileURL(tempModule).href + "?probe=" + Date.now());
}
async function withHTML(html, url, fn) {
  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ javaScriptEnabled: false });
    await context.route("**/*", async route => {
      const target = route.request().url();
      if (target.startsWith("about:") || target.startsWith("data:")) await route.continue();
      else await route.abort();
    });
    const page = await context.newPage();
    await page.setContent(addBase(html, url), { waitUntil: "domcontentloaded", timeout: 15000 });
    return await fn(page);
  } finally {
    await browser.close();
  }
}
async function parseProduct(response, validateCandidate) {
  const hasNames = /trostomaten/i.test(response.html) && response.html.includes(skuExpected);
  let parsedProduct = null;
  if (response.html && statusOK(response.targetStatus)) {
    parsedProduct = await withHTML(response.html, productURL, async page => {
      const parserPage = new Proxy(page, {
        get(target, property) {
          if (property === "goto") return async () => null;
          const member = Reflect.get(target, property, target);
          return typeof member === "function" ? member.bind(target) : member;
        },
      });
      try {
        return await validateCandidate(parserPage, {
          sku: skuExpected, name: "Trostomaten", brand: null,
          category: "Groente/Tomaat, paprika", packageText: null,
          sourceURL: productURL, imageURL: null, available: null, searchTerm: "tomaten",
        });
      } catch {
        return null;
      }
    });
  }
  return {
    contentSeen: hasNames,
    parserReady: Boolean(parsedProduct),
    product: parsedProduct ? {
      name: parsedProduct.name, sku: parsedProduct.sku,
      packageText: parsedProduct.packageText, price: parsedProduct.price,
    } : null,
  };
}
async function parseListing(response, importer) {
  if (!response.html || !statusOK(response.targetStatus)) {
    return { contentSeen: false, parserReady: false, products: [] };
  }
  try {
    const url = importer.searchURL("tomaten", 0);
    const raw = await withHTML(response.html, url, page => importer.extractSearchCandidates(page));
    const parsed = await importer.collectCandidatePages(async () => raw, "tomaten", 1);
    return {
      contentSeen: raw.length > 0,
      parserReady: parsed.candidates.length > 0,
      products: parsed.candidates.slice(0, 3).map(item => ({
        name: item.name, sku: item.sku, packageText: item.packageText, price: item.displayedPrice,
      })),
    };
  } catch {
    return { contentSeen: false, parserReady: false, products: [] };
  }
}
function logResult(prefix, response, parsed) {
  out(prefix + "_api_status", response.apiStatus === null ? "network_error" : response.apiStatus);
  out(prefix + "_hoogvliet_status", response.targetStatus === null ? "unknown" : response.targetStatus);
  out(prefix + "_challenge_markup", response.challenge);
  out(prefix + "_html_received", response.html.length > 0);
  out(prefix + "_html_bytes", Buffer.byteLength(response.html, "utf8"));
  out(prefix + "_hoogvliet_content", parsed.contentSeen);
  out(prefix + "_existing_parser_usable", parsed.parserReady);
  if (prefix.indexOf("product") === 0 && parsed.product) {
    out("product_name", parsed.product.name);
    out("product_sku", parsed.product.sku);
    out("product_package", parsed.product.packageText);
    out("product_price", parsed.product.price);
  }
  if (prefix.indexOf("listing") === 0) {
    out(prefix + "_parsed_count", parsed.products.length);
    parsed.products.forEach((item, i) => out(prefix + "_item_" + (i + 1), JSON.stringify(item)));
  }
}
async function main() {
  if (!key) {
    out("secret_status", "missing");
    return;
  }
  out("secret_status", "present");

  const importer = await loadImporter();
  const listingURL = importer.searchURL("tomaten", 0);

  // Exactly one HTTP-response request per approved page. No retries.
  const productHTTP = await requestPage(productURL, "httpResponseBody");
  const productParsed = await parseProduct(productHTTP, importer.validateCandidate);
  logResult("product", productHTTP, productParsed);

  await new Promise(resolve => setTimeout(resolve, 1500));
  const listingHTTP = await requestPage(listingURL, "httpResponseBody");
  const listingParsed = await parseListing(listingHTTP, importer);
  logResult("listing", listingHTTP, listingParsed);
  out("listing_url_source", "src/hoogvliet.mjs searchURL('tomaten', 0)");

  // Permit at most one browserHtml request for a usable provider response
  // that shows a challenge or lacks expected content/parser fields.
  function needsBrowser(response, parserReady) {
    return response.providerOK && response.html.length > 0
      && (response.challenge || (statusOK(response.targetStatus) && !parserReady));
  }
  let browserURL = null;
  let browserLabel = null;
  if (needsBrowser(productHTTP, productParsed.parserReady)) {
    browserURL = productURL;
    browserLabel = "product";
  } else if (needsBrowser(listingHTTP, listingParsed.parserReady)) {
    browserURL = listingURL;
    browserLabel = "listing";
  }
  out("browserhtml_attempted", Boolean(browserURL));
  if (browserURL) {
    const rendered = await requestPage(browserURL, "browserHtml");
    const renderedParsed = browserLabel === "product"
      ? await parseProduct(rendered, importer.validateCandidate)
      : await parseListing(rendered, importer);
    logResult(browserLabel + "_browserhtml", rendered, renderedParsed);
  }
}
try {
  await main();
} catch (error) {
  out("probe_error_class", error && error.name ? error.name : "Error");
  process.exitCode = 1;
} finally {
  try { unlinkSync(tempModule); } catch {}
}
