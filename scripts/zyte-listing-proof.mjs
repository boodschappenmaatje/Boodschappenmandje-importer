import { appendFileSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const endpoint = "https://api.zyte.com/v1/extract";
const listingURL = "https://www.hoogvliet.com/INTERSHOP/web/WFS/org-webshop-Site/nl_NL/-/EUR/ViewTWParametricSearch-SimpleOfferSearch?PageNumber=0&PageSize=40&SelectedSearchResult=SFProductSearch&SearchTerm=tomaten&SelectedItem=&SortingOption=&CategoryName=&CategoryTitle=&SearchTermKey=";
const key = process.env.ZYTE_API_KEY;
const tempModule = "src/.hoogvliet-zyte-listing-proof.mjs";
const mode = process.env.PROOF_MODE === "browserHtml" ? "browserHtml" : "httpResponseBody";

function out(name, value) {
  const safe = String(value ?? "").replace(/[\r\n]/g, " ").slice(0, 300);
  console.log(`${name}=${safe}`);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${safe}\n`);
}

function challenge(status, html) {
  return status === 403 || status === 429
    || /_Incapsula_Resource|incap_ses_|visid_incap_|request unsuccessful|verify you are human|captcha/i.test(html);
}

async function requestListing() {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url: listingURL, httpResponseBody: true }),
    signal: AbortSignal.timeout(120000),
  });
  const json = await response.json();
  const encoded = mode === "browserHtml" ? json.browserHtml : json.httpResponseBody;
  const html = mode === "browserHtml" ? (typeof encoded === "string" ? encoded : "")
    : (typeof encoded === "string" ? Buffer.from(encoded, "base64").toString("utf8") : "");
  return { apiStatus: response.status, sourceStatus: json.statusCode ?? null, html };
}

async function inspectHTML(html) {
  const source = readFileSync("src/hoogvliet.mjs", "utf8");
  const needle = "export async function extractSearchCandidates(page) {";
  if (!source.includes(needle)) throw new Error("LISTING_PARSER_NOT_FOUND");
  writeFileSync(tempModule, source);
  const importer = await import(pathToFileURL(tempModule).href + `?proof=${Date.now()}`);
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ javaScriptEnabled: false });
    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 15000 });
    const structure = await page.evaluate(() => ({
      productTiles: document.querySelectorAll(".product-tile").length,
      productLinks: document.querySelectorAll("a.product-title").length,
      nextData: Boolean(document.querySelector("#__NEXT_DATA__")),
      jsonLd: document.querySelectorAll('script[type="application/ld+json"]').length,
      embeddedJSON: document.querySelectorAll("script[type*='json'], script[data-state], script[data-products]").length,
      xhrHints: [...document.scripts].filter(script => /fetch\(|xhr|ajax|product/i.test(script.textContent ?? "")).length,
      htmlBytes: new TextEncoder().encode(document.documentElement.outerHTML).length,
    }));
    const candidates = await importer.extractSearchCandidates(page);
    return { structure, parserCount: candidates.length };
  } finally {
    await browser.close();
  }
}

try {
  if (!key) { out("secret_status", "missing"); process.exitCode = 1; }
  else {
    out("secret_status", "present");
    const response = await requestListing();
    const inspection = response.html ? await inspectHTML(response.html) : { structure: {}, parserCount: 0 };
    out("mode", mode);
    out("listing_url", listingURL);
    out("zyte_api_status", response.apiStatus);
    out("hoogvliet_status", response.sourceStatus);
    out("html_received", Boolean(response.html));
    out("html_bytes", Buffer.byteLength(response.html, "utf8"));
    out("challenge", challenge(response.sourceStatus, response.html));
    out("product_tiles", inspection.structure.productTiles ?? 0);
    out("product_links", inspection.structure.productLinks ?? 0);
    out("next_data", inspection.structure.nextData ?? false);
    out("json_ld", inspection.structure.jsonLd ?? 0);
    out("embedded_json", inspection.structure.embeddedJSON ?? 0);
    out("xhr_script_hints", inspection.structure.xhrHints ?? 0);
    out("parser_count", inspection.parserCount);
  }
} finally {
  try { unlinkSync(tempModule); } catch {}
}
