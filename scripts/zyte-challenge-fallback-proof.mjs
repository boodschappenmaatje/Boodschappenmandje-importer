import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import {
  SourceBlockedError,
  classifySourceResponse,
  validateCandidate,
  waitForSourceContent,
} from "../src/hoogvliet.mjs";

const url = "https://www.hoogvliet.com/product/trostomaten-verpakt";
const expectedSKU = "060936000";
const key = process.env.ZYTE_API_KEY;

function out(name, value) { console.log(`${name}=${String(value ?? "").replace(/[\r\n]/g, " ").slice(0, 300)}`); }

const candidate = {
  sku: expectedSKU, name: "Trostomaten", brand: null,
  category: "Groente/Tomaat, paprika", packageText: "500 gram",
  sourceURL: url, imageURL: null, available: null, searchTerm: "tomaten",
};

function parserPage(page) {
  return new Proxy(page, {
    get(target, property) {
      if (property === "goto") return async () => null;
      const value = Reflect.get(target, property, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });
}

async function parseCurrentPage(page) {
  try { return await validateCandidate(parserPage(page), candidate); } catch { return null; }
}

async function requestZyte() {
  const response = await fetch("https://api.zyte.com/v1/extract", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${key}:`).toString("base64")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, httpResponseBody: true }),
    signal: AbortSignal.timeout(120000),
  });
  const json = await response.json();
  const html = typeof json.httpResponseBody === "string"
    ? Buffer.from(json.httpResponseBody, "base64").toString("utf8") : "";
  return { apiStatus: response.status, sourceStatus: json.statusCode ?? null, html };
}

const browser = await chromium.launch({ headless: true });
try {
  const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
  const page = await context.newPage();
  let normal = "UNKNOWN";
  let normalProduct = null;
  let normalStatus = null;
  try {
    const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 35000 });
    normalStatus = response?.status() ?? null;
    const evidence = await waitForSourceContent(page, ".product-details");
    normalProduct = await parseCurrentPage(page);
    normal = classifySourceResponse({
      status: normalStatus,
      hasExpectedContent: evidence.evidence.hasExpectedContent,
      hasUsableProductData: Boolean(normalProduct),
    });
  } catch (error) {
    if (error instanceof SourceBlockedError || error?.code === "source_challenge") normal = "CHALLENGE";
    else normal = "UNKNOWN";
  }
  out("url", url);
  out("normal_http_status", normalStatus);
  out("normal_classification", normal);
  out("normal_parser_data", Boolean(normalProduct));

  if (normal !== "CHALLENGE") process.exitCode = 0;
  else {
    if (!key) throw new Error("ZYTE_API_KEY ontbreekt na een echte challenge.");
    const zyte = await requestZyte();
    let zyteProduct = null;
    if (zyte.html) {
      await page.setContent(zyte.html, { waitUntil: "domcontentloaded", timeout: 15000 });
      zyteProduct = await parseCurrentPage(page);
    }
    const zyteClass = classifySourceResponse({
      status: zyte.sourceStatus,
      html: zyte.html,
      hasUsableProductData: Boolean(zyteProduct),
    });
    out("zyte_request", "yes");
    out("zyte_api_status", zyte.apiStatus);
    out("zyte_source_status", zyte.sourceStatus);
    out("zyte_classification", zyteClass);
    out("zyte_parser_data", Boolean(zyteProduct));
    out("zyte_sku", zyteProduct?.sku ?? "");
    out("zyte_package", zyteProduct?.packageText ?? "");
    out("zyte_price", zyteProduct?.price ?? "");
  }
} finally { await browser.close(); }
