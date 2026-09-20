import { readFile, writeFile, mkdir } from "node:fs/promises";
import { chromium } from "playwright";

// Read-only, bounded to existing catalog products. Never imports products/prices.
const directory = "apps/web/test-results/pwa13/mix-sources";
const inventory = JSON.parse(await readFile("apps/web/test-results/pwa13/mix-inventory.json", "utf8"));
const candidates = inventory.filter((product) =>
  /^(honig|knorr)\b/i.test(product.name) &&
  (/maaltijdmixen|maaltijdpakketten/i.test(product.category) ||
   /\b(bakplaat mix|basis voor|mix voor|maaltijdmix|wereldgerecht|wereldgerechten|familiegerecht|maaltijdsoep|risotto|spaghetteria)\b/i.test(product.name)) &&
  !/\b(kippensoep|tomatensoep)\b/i.test(product.name));
await mkdir(directory, { recursive: true });
await writeFile(`${directory}/inventory.json`, JSON.stringify(candidates, null, 2));
console.log(JSON.stringify({ candidates: candidates.length, brands: Object.groupBy(candidates, (p) => p.brand) }, (_, value) => Array.isArray(value) ? value.map((p) => p.name) : value));
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
try {
  for (const product of candidates) {
    try { await readFile(`${directory}/${product.sku}.json`); continue; } catch { /* not read yet */ }
    const url = new URL(product.source_url);
    if (url.origin !== "https://www.hoogvliet.com" || !url.pathname.startsWith("/product/")) throw Error("untrusted-source");
    const page = await browser.newPage();
    try {
      await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 25000 });
      const detail = page.locator('[data-testing-id="product-detail-page"]');
      await detail.waitFor({ timeout: 15000 });
      const title = await page.locator("h1").innerText();
      const text = await detail.textContent();
      await writeFile(`${directory}/${product.sku}.json`, JSON.stringify({ product, title, text, sourceUrl: page.url(), fetchedAt: new Date().toISOString() }, null, 2));
      console.log(`${product.sku}: ${title}`);
    } catch {
      await writeFile(`${directory}/${product.sku}.json`, JSON.stringify({ product, reason: "source_unavailable" }));
      console.log(`${product.sku}: source_unavailable`);
    } finally { await page.close(); }
  }
} finally { await browser.close(); }
