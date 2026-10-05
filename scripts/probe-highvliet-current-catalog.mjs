import { writeFile } from "node:fs/promises";
import { chromium } from "playwright";
import { collectCatalogListing } from "../src/hoogvliet.mjs";

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
      controls: [...document.querySelectorAll("button, a, [role='button']")]
        .map(element => ({
          tag: element.tagName,
          text: (element.textContent || "").replace(/\s+/g, " ").trim(),
          href: element.getAttribute("href"),
          html: element.outerHTML.slice(0, 700),
          visible: Boolean(element.offsetWidth || element.offsetHeight || element.getClientRects().length),
          disabled: element.disabled === true || element.getAttribute("aria-disabled") === "true",
        }))
        .filter(control => control.text && /laden|meer|bekijk|volgende|next|product/i.test(control.text))
        .slice(0, 80),
      loadMoreTextNodes: [...document.querySelectorAll("*")]
        .filter(element => /producten\s+laden|meer\s+producten|bekijk\s+meer/i.test((element.textContent || "").replace(/\s+/g, " ").trim())
          && element.children.length < 4)
        .slice(0, 20)
        .map(element => ({
          tag: element.tagName,
          text: (element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 120),
          html: element.outerHTML.slice(0, 500),
        })),
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
  let error = null;
  const pages = [];
  for (; cycles < maxCycles; cycles += 1) {
    const controls = page.locator("button, a, [role='button']")
      .filter({ hasText: /producten\s+laden|meer\s+producten|meer\s+laden|laad\s+meer/i });
    let control = null;
    for (let index = 0; index < await controls.count(); index += 1) {
      const candidate = controls.nth(index);
      if (await candidate.isVisible({ timeout: 200 }).catch(() => false)) {
        control = candidate;
        break;
      }
    }
    if (!control) break;
    const previous = (await listingSnapshot(page)).productURLs.length;
    const href = await control.getAttribute("href");
    pages.push({ before: previous, control: await control.evaluate(element => ({
      tag: element.tagName,
      text: (element.textContent || "").replace(/\s+/g, " ").trim(),
      href: element.getAttribute("href"),
      html: element.outerHTML.slice(0, 700),
    })) });
    try {
      await control.click({ timeout: 5_000 });
    } catch (clickError) {
      error = clickError?.message ?? "control_click_failed";
      break;
    }
    if (href) await page.waitForLoadState("domcontentloaded", { timeout: 20_000 }).catch(() => {});
    const grew = await page.waitForFunction(({ previous, href }) => {
      const current = document.querySelectorAll("a[href*='/product/']").length;
      return current > previous || (href && location.href.includes(new URL(href, location.href).pathname));
    }, { previous, href }, { timeout: 20_000 }).then(() => true).catch(() => false);
    const current = (await listingSnapshot(page)).productURLs.length;
    if (!grew || (!href && current <= previous)) { stagnated = true; break; }
  }
  return { cycles, stagnated, pages, error };
}

const network = [];
const responseTasks = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ locale: "nl-NL", timezoneId: "Europe/Amsterdam" });
const page = await context.newPage();
page.on("response", response => {
  const type = response.request().resourceType();
  if (type !== "xhr" && type !== "fetch") return;
  const endpoint = safeURL(response.url());
  const record = { type, status: response.status(), endpoint };
  network.push(record);
  if (endpoint.pathname === "/api/graphql") {
    responseTasks.push((async () => {
      try {
        const body = await response.text();
        const url = new URL(response.url());
        const query = url.searchParams.get("query") ?? "";
        const variables = url.searchParams.get("variables") ?? "";
        record.operationName = url.searchParams.get("operationName");
        record.query = query.replace(/\s+/g, " ").trim();
        record.variables = variables;
        record.bodyLength = body.length;
        record.bodyStart = body.replace(/\s+/g, " ").slice(0, 300);
        try {
          const parsed = JSON.parse(body);
          const items = parsed?.data?.products?.items;
          if (Array.isArray(items)) record.firstItem = items[0] ?? null;
        } catch { record.jsonParse = false; }
      } catch { record.bodyRead = "failed"; }
    })());
  }
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
let collector = { status: "not_run", error: null };
try {
  categoryResponse = await page.goto(categoryURL, { waitUntil: "domcontentloaded", timeout: 45_000 });
  await page.waitForLoadState("networkidle", { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(5_000);
  initial = await listingSnapshot(page);
  loadMoreResult = await loadMore(page);
  await page.waitForTimeout(3_000);
  final = await listingSnapshot(page);
} catch (error) {
  categoryError = error?.message ?? "navigation_error";
}

const collectorPage = await context.newPage();
try {
  const collected = await collectCatalogListing(collectorPage, categoryURL, { maxWindows: 2 });
  collector = {
    status: "ok",
    candidates: collected.candidates.length,
    pagesFetched: collected.pagesFetched,
    loadMoreCycles: collected.loadMoreCycles,
    sourceExhausted: collected.sourceExhausted,
    stallReason: collected.stallReason,
    skuExamples: collected.candidates.map(candidate => candidate.sku).slice(0, 10),
  };
} catch (error) {
  collector = { status: "error", error: error?.message ?? "collector_error", code: error?.code ?? null };
}

const allProductURLs = [...new Set(final.productURLs)];
const productionCandidateCount = collector.status === "ok" ? collector.candidates : allProductURLs.length;
const productionPagesFetched = collector.status === "ok" ? collector.pagesFetched : 0;
const proof = {
  sourceClassification: collector.status === "error" && collector.code === "source_challenge"
    ? "CHALLENGE"
    : navigationError || categoryError
    ? "NAVIGATION_ERROR"
    : navigationResponse?.status() === 403 || categoryResponse?.status() === 403
      ? "CHALLENGE"
      : productionCandidateCount > 0 ? "VALID_SOURCE" : "PARSER_STRUCTURE_CHANGED",
  candidateCount: productionCandidateCount,
  uniqueSKUHintCount: collector.status === "ok"
    ? new Set(collector.skuExamples).size
    : new Set(allProductURLs.map(skuFromURL).filter(Boolean)).size,
  initialCandidateCount: initial.productURLs.length,
  afterLoadMoreCandidateCount: productionCandidateCount,
  proofBeyondInitialBatch: productionPagesFetched > 1 || final.productURLs.length > initial.productURLs.length,
  loadMoreCycles: collector.status === "ok" ? collector.loadMoreCycles : loadMoreResult.cycles,
  loadMoreStagnated: loadMoreResult.stagnated,
  productionCollector: collector.status === "ok" && collector.candidates > 0 ? "VALID_SOURCE" : collector.status.toUpperCase(),
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
  initial: { count: initial.productURLs.length, skuExamples: initial.productURLs.map(skuFromURL).filter(Boolean).slice(0, 5), controls: initial.controls, loadMoreTextNodes: initial.loadMoreTextNodes },
  final: { count: final.productURLs.length, skuExamples: allProductURLs.map(skuFromURL).filter(Boolean).slice(0, 10), controls: final.controls, loadMoreTextNodes: final.loadMoreTextNodes },
  loadMore: loadMoreResult,
  productionCollector: collector,
  network: network.slice(0, 80),
  proof,
};

await Promise.allSettled(responseTasks);
result.network = network.slice(0, 80);
if (network.some(record => /INTERSHOP|ViewTWParametricSearch/i.test(record.endpoint.pathname))) {
  throw new Error("Legacy Intershop discovery endpoint appeared in current catalog traffic.");
}
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
console.log(`HOOGVLIET_CURRENT_CATALOG_PROOF ${JSON.stringify(proof)}`);
console.log(JSON.stringify({ navigation: result.navigation, proof, rootCategories: result.rootCategories.slice(0, 20), network: result.network }, null, 2));
await context.close();
await browser.close();

if (proof.sourceClassification !== "VALID_SOURCE" || proof.candidateCount < 1) process.exitCode = 1;
