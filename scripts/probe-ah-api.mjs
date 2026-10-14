// Read-only probe: can a GitHub runner fetch Albert Heijn product data through
// the public mobile app endpoints, and which fields come back? No database,
// no secrets, no writes. Results go to the job summary and one annotation.
import { appendFile } from "node:fs/promises";

const BASE = "https://api.ah.nl";
const HEADERS = {
  "user-agent": "Appie/8.22.3 Model/phone Android/11-API30",
  "x-application": "AHWEBSHOP",
  "content-type": "application/json; charset=UTF-8",
  accept: "application/json",
};
const SEARCH_TERMS = ["spinazie", "melk", "gehakt"];

async function call(path, { method = "GET", token, body } = {}) {
  const started = Date.now();
  try {
    const response = await fetch(`${BASE}${path}`, {
      method,
      headers: { ...HEADERS, ...(token ? { authorization: `Bearer ${token}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    const text = await response.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    return { status: response.status, ms: Date.now() - started, json, snippet: json ? null : text.slice(0, 160) };
  } catch (error) {
    return { status: 0, ms: Date.now() - started, json: null, snippet: error?.name ?? "network_error" };
  }
}

function summarizeProduct(product) {
  return {
    id: product.webshopId ?? product.id ?? null,
    name: product.title ?? product.name ?? null,
    brand: product.brand ?? null,
    size: product.salesUnitSize ?? product.unitSize ?? null,
    price: product.currentPrice ?? product.priceBeforeBonus ?? product.price?.now ?? null,
    priceBeforeBonus: product.priceBeforeBonus ?? null,
    bonus: product.isBonus ?? null,
    bonusMechanism: product.bonusMechanism ?? null,
    hasImage: Array.isArray(product.images) && product.images.length > 0,
    category: product.mainCategory ?? null,
  };
}

const lines = ["## AH-API proef (alleen lezen)", ""];
const findings = [];

const auth = await call("/mobile-auth/v1/auth/token/anonymous", { method: "POST", body: { clientId: "appie" } });
const token = auth.json?.access_token ?? null;
lines.push(`- Anonieme sessie: HTTP ${auth.status} in ${auth.ms} ms, token ${token ? "ontvangen" : "NIET ontvangen"}${auth.snippet ? ` (${auth.snippet})` : ""}`);
findings.push(`token=${token ? "ok" : `fout_${auth.status}`}`);

if (token) {
  let fieldNames = new Set();
  for (const term of SEARCH_TERMS) {
    const result = await call(`/mobile-services/product/search/v2?sortOn=RELEVANCE&page=0&size=30&query=${encodeURIComponent(term)}`, { token });
    const products = Array.isArray(result.json?.products) ? result.json.products : [];
    const total = result.json?.page?.totalElements ?? null;
    for (const product of products) for (const key of Object.keys(product)) fieldNames.add(key);
    lines.push(`- Zoeken "${term}": HTTP ${result.status} in ${result.ms} ms, ${products.length} resultaten (totaal ${total ?? "?"})${result.snippet ? ` (${result.snippet})` : ""}`);
    for (const product of products.slice(0, 3)) lines.push(`  - \`${JSON.stringify(summarizeProduct(product))}\``);
    findings.push(`${term}=${result.status}/${products.length}`);
  }
  const all = await call("/mobile-services/product/search/v2?sortOn=RELEVANCE&page=0&size=1&query=", { token });
  const catalogTotal = all.json?.page?.totalElements ?? null;
  lines.push(`- Hele assortiment (lege zoekopdracht): HTTP ${all.status}, totaal ${catalogTotal ?? "?"} producten`);
  findings.push(`assortiment=${catalogTotal ?? `fout_${all.status}`}`);
  const shelves = await call("/mobile-services/v1/product-shelves/categories", { token });
  const categoryCount = Array.isArray(shelves.json) ? shelves.json.length : null;
  lines.push(`- Categorieën: HTTP ${shelves.status}, ${categoryCount ?? "?"} hoofdcategorieën`);
  findings.push(`categorieen=${categoryCount ?? `fout_${shelves.status}`}`);
  lines.push("", `Velden per product: ${[...fieldNames].sort().join(", ") || "geen"}`);
}

const summary = `AH-proef: ${findings.join(" | ")}`;
console.log(lines.join("\n"));
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`);
if (process.env.GITHUB_ACTIONS === "true") console.log(`::notice title=AH-API proef::${summary}`);
if (!token) process.exitCode = 1;
