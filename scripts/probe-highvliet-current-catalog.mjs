import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";

const baseURL = "https://hoogvliet.nl";
const catalogURL = `${baseURL}/producten`;
const outputPath = process.env.PROBE_OUTPUT ?? "hoogvliet-current-catalog-proof.json";
const requestedCategory = process.env.PROBE_CATEGORY ?? "/aardappelen-groente-fruit";

function safeURL(raw) {
  try {
    const url = new URL(raw);
    return { origin: url.origin, pathname: url.pathname, queryKeys: [...new Set(url.searchParams.keys())].sort() };
  } catch { return { origin: "invalid", pathname: "invalid", queryKeys: [] }; }
}

function skuFromURL(raw) {
  const match = new URL(raw).pathname.replace(/\/$/, "").match(/(?:^|-)(\d{9})$/);
  return match?.[1] ?? null;
}

async function listingSnapshot(page) {
  return page.evaluate(() => {
    const links = [...document.querySelectorAll("a[href*='/product/']")]
      .map(link => link.href)
      .filter(href => /-\d{9}\/?$/.test(new URL(href).pathname));
    return {
      productURLs: [...new Set(links)],
      text: (document.body?.innerText ?? "").replace(/\s+/g, " ").trim().slice(0, 300),
    };
  });
}

async function categoryLinks(page) {
  return page.evaluate(({ base }) => [...document.querySelectorAll("a[href]")]
    .map(link => link.href)
    .filter(href => {
      const url = new URL(href, base);
      return url.origin === base && url.pathname !== "/producten"
        && !url.pathname.startsWith("/product/")
        && !["/aanbiedingen", "/recepten", "/winkels", "/service"].includes(url.pathname);
    }), { base: baseURL });
}

async function loadMore(page, maxCycles = 10) {
  let cycles = 0;
  let stagnated = false;
  for (; cycles < maxCycles; cycles += 1) {
    const control = page.locator("button, a, [role='button']")
      .filter({ hasText: /producten\s+laden|meer\s+producten|laad\s+meer|toon\s+meer/i })
      .last();
    if (!await control.isVisible({ timeout: 800 }).catch(() => false)) break;
    const previous = (await listingSnapshot(page)).productURLs.length;
    await control.click({ timeout: 5_000 });
    const grew = await page.waitForFunction(({ previous }) => document.querySelectorAll("a[href*='/product/']").length > previous,
      { previous }, { timeout: 20_000 }).then(() => true).catch(() => false);
    const current = (await listingSnapshot(page)).productURLs.length;
    if (!grew || current <= previous) { stagnated = true; break; }
  }
  return { cycles, stagnated };
}

const network = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
const page = await context.newPage();
page.on("response", response => {
  const type = response.request().resourceType();
  if (type === "xhr" || type === "fetch") network.push({ type, status: response.status(), endpoint: safeURL(response.url()) });
});

let navigationResponse = null;
let navigationError = null;
try {
  navigationResponse = await page.goto(catalogURL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(3_000);
} catch (error) {
  navigationError = error?.message ?? "navigation_error";
}

const rootCategories = await categoryLinks(page).catch(() => []);
const categoryURL = new URL(requestedCategory, baseURL).href;
let categoryResponse = null;
let categoryError = null;
let initial = { productURLs: [], text: "" };
let final = initial;
let loadMoreResult = { cycles: 0, stagnated: false };
try {
  categoryResponse = await page.goto(categoryURL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(2_000);
  initial = await listingSnapshot(page);
  loadMoreResult = await loadMore(page);
  final = await listingSnapshot(page);
} catch (error) {
  categoryError = error?.message ?? "navigation_error";
}

const allProductURLs = [...new Set(final.productURLs)];
const proof = {
  sourceClassification: navigationError || categoryError
    ? "NAVIGATION_ERROR"
    : navigationResponse?.status() === 403 || categoryResponse?.status() === 403
      ? "CHALLENGE"
      : allProductURLs.length > 0 ? "VALID_SOURCE" : "PARSER_STRUCTURE_CHANGED",
  candidateCount: allProductURLs.length,
  uniqueSKUHintCount: new Set(allProductURLs.map(skuFromURL).filter(Boolean)).size,
  initialCandidateCount: initial.productURLs.length,
  afterLoadMoreCandidateCount: final.productURLs.length,
  proofBeyondInitialBatch: final.productURLs.length > initial.productURLs.length,
  loadMoreCycles: loadMoreResult.cycles,
  loadMoreStagnated: loadMoreResult.stagnated,
};
const result = {
  target: { catalogURL, categoryURL, requestedCategory },
  navigation: {
    error: navigationError,
    initialStatus: navigationResponse?.status() ?? null,
    finalURL: page.url(),
    categoryStatus: categoryResponse?.status() ?? null,
    title: await page.title().catch(() => ""),
  },
  rootCategories: [...new Set(rootCategories)].slice(0, 80).map(safeURL),
  initial: { count: initial.productURLs.length, skuExamples: initial.productURLs.map(skuFromURL).filter(Boolean).slice(0, 5) },
  final: { count: final.productURLs.length, skuExamples: allProductURLs.map(skuFromURL).filter(Boolean).slice(0, 10) },
  loadMore: loadMoreResult,
  network: network.slice(0, 80),
  proof,
};

if (network.some(record => /INTERSHOP|ViewTWParametricSearch/i.test(record.endpoint.pathname))) {
  throw new Error("Legacy Intershop discovery endpoint appeared in current catalog traffic.");
}
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`HOOGVLIET_CURRENT_CATALOG_PROOF ${JSON.stringify(proof)}`);
console.log(JSON.stringify({ navigation: result.navigation, proof, rootCategories: result.rootCategories.slice(0, 20), network: result.network }, null, 2));
await context.close();
await browser.close();

if (proof.sourceClassification !== "VALID_SOURCE" || proof.candidateCount < 1) process.exitCode = 1;
