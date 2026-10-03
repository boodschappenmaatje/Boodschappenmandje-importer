import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { catalogBatches, loadConfig, limits } from "../src/config.mjs";
import {
  buildDynamicDiscoveryTerms,
  catalogImportFailure,
  catalogGrowthMode,
  CATALOG_SOURCE_UNAVAILABLE_MESSAGE,
  classifyCatalogOutcomes,
  formatCatalogGrowthSummary,
  importRunStatus,
  mergeDiscoveryMetrics,
  nextDiscoveryCursor,
  prioritizeDiscoveryTerms,
  productChanged,
  rotateDiscoveryTerms,
} from "../src/catalog-growth.mjs";
import { evaluateCatalogMonitor } from "../src/catalog-monitor.mjs";
import {
  classifyProductType, productTypeCoverage, UNKNOWN_PRODUCT_TYPE,
} from "../src/product-type.mjs";
import {
  collectCandidatePages,
  catalogLimitReached,
  claimCandidateSKU,
  classifySourcePageEvidence,
  describePriceUpdate,
  filterDiscoveryCandidates,
  finalizeTermDiscoveryStats,
  growthStopReason,
  isReliableCatalogProduct,
  isOfferPeriodActive,
  isSafeEmptyDiscovery,
  isRelevantCandidate,
  isValidProductURL,
  isValidSKU,
  nextEmptySourceSearchCount,
  parseOfferPeriod,
  parsePriceText,
  prioritizeCandidates,
  recordCatalogProduct,
  searchURL,
  selectPriceShard,
  selectPriceShardWindow,
  SourceBlockedError,
  withTransientNavigationRetry,
  waitForSourceContent,
  resolvedProductTypeForRefresh,
  weightInGrams,
} from "../src/hoogvliet.mjs";
import {
  formatBatchSummary, formatClassificationSummary, formatPriceRefreshSummary, formatTermCoverage, safeLogger,
} from "../src/importer.mjs";
import {
  fetchCatalogDiscoveryState, fetchExistingPriceStates, fetchExistingProducts, fetchExistingSKUs,
  hasProductTypeColumn, requestHeaders, restURL, saveCatalogDiscoveryState,
  upsertProductClassifications, upsertProducts,
} from "../src/supabase.mjs";

function testProduct(sku = "123456789", name = "Echt product", price = 5.52) {
  return {
    supermarket: "Hoogvliet", sku, name, brand: null,
    category: null, packageText: "500 gram", weightGrams: 500, imageURL: null,
    sourceURL: `https://www.hoogvliet.com/product/${sku}`, isAvailable: null,
    productType: "Gehakt",
    price, oldPrice: null, isOffer: false, offerText: null,
    validFrom: null, validUntil: null, fetchedAt: "2026-09-06T20:00:00Z",
  };
}

test("MAX_PRODUCTS is configureerbaar met een veilige standaard en bovengrens", () => {
  assert.equal(loadConfig({ DRY_RUN: "1" }).maxProducts, 10);
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "30" }).maxProducts, 30);
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "150" }).maxProducts, 150);
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "999" }).maxProducts, 500);
  assert.equal(limits.defaultMaxProducts, 10);
  assert.equal(limits.safeProductLimit, 500);
});

test("catalogusbatches zijn selecteerbaar en SEARCH_TERMS blijft een override", () => {
  const fresh = loadConfig({ DRY_RUN: "1", CATALOG_BATCH: "fresh" });
  assert.equal(fresh.catalogBatch, "fresh");
  assert.deepEqual(fresh.searchTerms, [...catalogBatches.fresh]);

  const custom = loadConfig({
    DRY_RUN: "1", CATALOG_BATCH: "core", SEARCH_TERMS: "cola, melk",
  });
  assert.equal(custom.catalogBatch, "custom");
  assert.deepEqual(custom.searchTerms, ["cola", "melk"]);
  assert.ok(catalogBatches.fresh.includes("cola"));
  assert.ok(catalogBatches.pantry.includes("toiletpapier"));
  assert.ok(Object.values(catalogBatches).every((terms) => new Set(terms).size === terms.length));
});

test("een ongeldige catalogusbatch faalt veilig", () => {
  assert.throws(
    () => loadConfig({ DRY_RUN: "1", CATALOG_BATCH: "onbekend" }),
    /Ongeldige CATALOG_BATCH/,
  );
});

test("MAX_NEW_PRODUCTS heeft een aparte veilige grens", () => {
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "180" }).maxNewProducts, 50);
  assert.equal(loadConfig({
    DRY_RUN: "1", MAX_PRODUCTS: "180", MAX_NEW_PRODUCTS: "100",
  }).maxNewProducts, 100);
  assert.equal(loadConfig({
    DRY_RUN: "1", MAX_PRODUCTS: "180", MAX_NEW_PRODUCTS: "999",
  }).maxNewProducts, 180);
  assert.equal(limits.safeNewProductLimit, 400);
});

test("MAX_PER_TERM ondersteunt catalogusdekking maar houdt een harde bovengrens", () => {
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "150" }).maxPerTerm, 2);
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "150", MAX_PER_TERM: "7" }).maxPerTerm, 7);
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "150", MAX_PER_TERM: "999" }).maxPerTerm, 40);
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "4", MAX_PER_TERM: "7" }).maxPerTerm, 4);
  assert.equal(limits.safePerTermLimit, 40);
});

test("paginering en catalogusfocus zijn configureerbaar en hard begrensd", () => {
  const config = loadConfig({
    DRY_RUN: "1", MAX_PAGES_PER_TERM: "4", CATALOG_NEW_ONLY: "1",
  });
  assert.equal(config.maxPagesPerTerm, 4);
  assert.equal(config.catalogNewOnly, true);
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PAGES_PER_TERM: "999" }).maxPagesPerTerm, 8);
  assert.equal(limits.defaultMaxPagesPerTerm, 1);
  assert.equal(limits.safePagesPerTermLimit, 8);
});

test("een lege Incapsula-loader wordt als tijdelijke bronbeveiliging herkend", () => {
  assert.equal(classifySourcePageEvidence({
    hasExpectedContent: false,
    hasIncapsula: true,
    bodyTextLength: 0,
    htmlLength: 212,
  }), "security_check");
  assert.equal(classifySourcePageEvidence({
    hasExpectedContent: true,
    hasIncapsula: true,
    bodyTextLength: 1832,
    htmlLength: 704779,
  }), "ready");
  assert.equal(classifySourcePageEvidence({ captcha: true }), "blocked");
  assert.equal(classifySourcePageEvidence({
    hasExpectedContent: false,
    hasIncapsula: true,
    bodyTextLength: 1800,
    htmlLength: 700000,
  }), "security_check");
  assert.equal(classifySourcePageEvidence({
    hasExpectedContent: false,
    hasExplicitEmptyState: true,
    hasIncapsula: true,
  }), "empty");
});

test("opeenvolgende lege bronresultaten worden geteld en echte kandidaten resetten de teller", () => {
  assert.equal(nextEmptySourceSearchCount(0, 0), 1);
  assert.equal(nextEmptySourceSearchCount(1, 0), 2);
  assert.equal(nextEmptySourceSearchCount(2, 0), 3);
  assert.equal(nextEmptySourceSearchCount(3, 4), 0);
});

test("bronproblemen krijgen een consumentveilige catalogusstatus", () => {
  const error = new SourceBlockedError("Technische broncontrole met interne details");
  const failure = catalogImportFailure(error, 0);
  assert.equal(failure.sourceStatus, "source_challenge");
  assert.equal(failure.publicSummary, CATALOG_SOURCE_UNAVAILABLE_MESSAGE);
  assert.doesNotMatch(failure.publicSummary, /Incapsula|Imperva|HTTP|challenge/i);
});

test("de importer laat een normale Incapsula-controle in dezelfde sessie uitlopen", async () => {
  const evidence = [
    {
      hasExpectedContent: false,
      hasIncapsula: true,
      bodyTextLength: 0,
      htmlLength: 212,
    },
    {
      hasExpectedContent: true,
      hasIncapsula: true,
      bodyTextLength: 1832,
      htmlLength: 704779,
    },
  ];
  const waitCalls = [];
  let securityChecks = 0;
  const page = {
    waitForFunction: async (...args) => waitCalls.push(args),
    evaluate: async () => evidence.shift(),
  };

  const result = await waitForSourceContent(page, ".product-tile", {
    normalTimeoutMs: 12_000,
    securityTimeoutMs: 45_000,
    onSecurityCheck: () => { securityChecks += 1; },
  });

  assert.equal(result.securityCheckObserved, true);
  assert.equal(securityChecks, 1);
  assert.equal(waitCalls.length, 2);
  assert.equal(waitCalls[0][2].timeout, 12_000);
  assert.equal(waitCalls[1][2].timeout, 45_000);
});

test("een veiligheidscontrole die niet afrondt faalt vroeg en expliciet", async () => {
  const evidence = {
    hasExpectedContent: false,
    hasIncapsula: true,
    bodyTextLength: 0,
    htmlLength: 212,
  };
  const page = {
    waitForFunction: async () => {},
    evaluate: async () => evidence,
  };

  await assert.rejects(
    waitForSourceContent(page, ".product-tile", {
      normalTimeoutMs: 1,
      securityTimeoutMs: 1,
    }),
    /Incapsula.*wachttijd/,
  );
});

test("growth heeft een apart ruim discoverybudget zonder het nieuwe-productdoel te verlagen", () => {
  const config = loadConfig({
    DRY_RUN: "1", UPDATE_MODE: "growth", MAX_PRODUCTS: "10", MAX_NEW_PRODUCTS: "400",
    GROWTH_MAX_CANDIDATES: "6000", GROWTH_MAX_PAGES_PER_TERM: "20",
    GROWTH_MAX_TOTAL_PAGES: "800", GROWTH_MAX_RUNTIME_MINUTES: "105",
  });
  assert.equal(config.maxProducts, 10);
  assert.equal(config.maxNewProducts, 400);
  assert.equal(config.growthMaxCandidates, 6000);
  assert.equal(config.growthMaxPagesPerTerm, 20);
  assert.equal(config.growthMaxTotalPages, 800);
  assert.equal(config.growthMaxRuntimeMs, 105 * 60_000);
  assert.equal(config.navigationRetries, 2);
});

test("prijsvenstercyclus is configureerbaar zonder de zeven SKU-shards te wijzigen", () => {
  const config = loadConfig({
    DRY_RUN: "1", PRICE_SHARD_COUNT: "7", PRICE_SHARD_INDEX: "4", PRICE_CYCLE_INDEX: "12",
  });
  assert.equal(config.priceShardCount, 7);
  assert.equal(config.priceShardIndex, 4);
  assert.equal(config.priceCycleIndex, 12);
  assert.equal(loadConfig({ DRY_RUN: "1", PRICE_CYCLE_INDEX: "ongeldig" }).priceCycleIndex, 0);
});

test("drankmerken en varianten krijgen het generieke producttype Cola", () => {
  const products = [
    { sku: "111111111", name: "Coca-Cola Original taste", brand: "Coca-Cola", category: "Frisdrank" },
    { sku: "222222222", name: "Coca-Cola Zero 6-pack", brand: "Coca-Cola", category: "Frisdrank" },
    { sku: "333333333", name: "Pepsi Max", brand: "Pepsi", category: "Frisdrank" },
    { sku: "444444444", name: "Hoogvliet Cola Zero", brand: "Hoogvliet", category: "Frisdrank" },
  ];
  assert.deepEqual(products.map(classifyProductType), ["Cola", "Cola", "Cola", "Cola"]);
  assert.equal(new Set(products.map(({ sku }) => sku)).size, 4);
  assert.notEqual(classifyProductType(products[0]), products[0].brand);
});

test("belangrijke supermarktproducten worden centraal en niet op SKU geclassificeerd", () => {
  const examples = new Map([
    ["Hoogvliet Rundergehakt 500 gram", "Gehakt"],
    ["Kipfilet naturel", "Kipfilet"],
    ["Halfvolle melk", "Melk"],
    ["Griekse yoghurt", "Yoghurt"],
    ["Paprika chips", "Chips"],
    ["Vastkokende aardappelen", "Aardappelen"],
    ["Volkoren pasta penne", "Pasta"],
    ["Basmati rijst", "Rijst"],
    ["Italiaanse pastasaus", "Pastasaus"],
  ]);
  for (const [name, expected] of examples) {
    assert.equal(classifyProductType({ name }), expected, name);
  }
});

test("onbekende producten blijven meetbaar aanwezig met veilige fallback", () => {
  const products = [{ name: "Volstrekt nieuw artikel" }, { name: "Halfvolle melk" }];
  assert.equal(classifyProductType(products[0]), UNKNOWN_PRODUCT_TYPE);
  assert.deepEqual(productTypeCoverage(products), {
    total: 2, classified: 1, unknown: 1, percentage: 50,
    counts: new Map([[UNKNOWN_PRODUCT_TYPE, 1], ["Melk", 1]]),
  });
});

test("korte letterreeksen en samengestelde woorden veroorzaken geen duidelijke misclassificatie", () => {
  assert.equal(classifyProductType({ name: "Chocoladereep" }), "Chocolade");
  assert.equal(classifyProductType({ name: "Indische spekkoek" }), "Koek");
  assert.equal(classifyProductType({ name: "Naturel roomkaas" }), "Kaas");
  assert.notEqual(classifyProductType({ name: "Uitdeelzak snoep" }), "Ui");
  assert.notEqual(classifyProductType({ name: "Verse vlaai" }), "Vla");
});

test("zoekcontext is alleen een veilige fallback voor toekomstige producten", () => {
  assert.equal(classifyProductType({ name: "Nieuw merk Original", searchTerm: "cola" }), "Cola");
  assert.equal(classifyProductType({ name: "Nieuw merk Original" }), UNKNOWN_PRODUCT_TYPE);
});

test("zoekrelevantie behoudt productvarianten maar weigert toevallige middenwoordmatches", () => {
  assert.equal(isRelevantCandidate({ name: "Coca-Cola Original taste", brand: "Coca-Cola" }, "cola"), true);
  assert.equal(isRelevantCandidate({ name: "First Choice Cola Zero", brand: "First Choice" }, "cola"), true);
  assert.equal(isRelevantCandidate({ name: "Chocolade hagelmix", brand: "Hoogvliet" }, "cola"), false);
  assert.equal(isRelevantCandidate({ name: "Kipfilet voordeelverpakking" }, "kip"), true);
  assert.equal(isRelevantCandidate({ name: "Fanta Orange", category: "Frisdrank" }, "frisdrank"), true);
});

test("meerdere resultaatpagina's leveren afzonderlijke SKU-varianten zonder dubbelen", async () => {
  const candidate = (sku, name) => ({
    sku, name, brand: " GateTest", category: "Frisdrank", packageText: "1,5 liter",
    sourceURL: `https://www.hoogvliet.com/product/${sku}`,
  });
  const pages = [
    [candidate("111111111", "Cola Original"), candidate("222222222", "Cola Zero")],
    [candidate("222222222", "Cola Zero"), candidate("333333333", "Cola 6-pack")],
    [],
  ];
  const result = await collectCandidatePages(async (pageNumber) => pages[pageNumber], "cola", 4);

  assert.equal(result.pagesFetched, 3);
  assert.deepEqual(result.candidates.map(({ sku }) => sku), ["111111111", "222222222", "333333333"]);
  assert.equal(result.duplicateCandidates, 1);
});

test("Hoogvliet-zoek-URL vraagt expliciet een volgend resultaatblok op", () => {
  const url = new URL(searchURL("cola", 3));
  assert.equal(url.searchParams.get("SearchTerm"), "cola");
  assert.equal(url.searchParams.get("PageNumber"), "3");
  assert.equal(url.searchParams.get("PageSize"), "40");
});

test("herhaalde resultaatpagina stopt begrensd en voorkomt een paginalus", async () => {
  const page = [{
    sku: "111111111", name: "Cola Original", category: "Frisdrank",
    sourceURL: "https://www.hoogvliet.com/product/111111111",
  }];
  const result = await collectCandidatePages(async () => page, "cola", 8);
  assert.equal(result.pagesFetched, 3);
  assert.equal(result.repeatedPageStopped, true);
  assert.equal(result.firstPageAliasSkipped, true);
  assert.equal(result.candidates.length, 1);
});

test("PageNumber 0/1-alias blokkeert een echte tweede resultaatpagina niet", async () => {
  const candidate = (sku, name) => ({
    sku, name, category: "Frisdrank", sourceURL: `https://www.hoogvliet.com/product/${sku}`,
  });
  const first = [candidate("111111111", "Cola Original")];
  const second = [candidate("222222222", "Cola Zero")];
  const result = await collectCandidatePages(async (pageNumber) => (
    pageNumber <= 1 ? first : pageNumber === 2 ? second : []
  ), "cola", 5);
  assert.equal(result.firstPageAliasSkipped, true);
  assert.equal(result.repeatedPageStopped, false);
  assert.equal(result.pagesFetched, 4);
  assert.deepEqual(result.candidates.map(({ sku }) => sku), ["111111111", "222222222"]);
});

test("dezelfde SKU uit twee zoektermen wordt maar eenmaal geclaimd", () => {
  const stats = { duplicateSKUsSkipped: 0 };
  const seen = new Set();
  const candidate = { sku: "123456789" };
  assert.equal(claimCandidateSKU(candidate, seen, stats), true);
  assert.equal(claimCandidateSKU(candidate, seen, stats), false);
  assert.equal(seen.size, 1);
  assert.equal(stats.uniqueSKUs, 1);
  assert.equal(stats.duplicateSKUsSkipped, 1);
});

test("veel overlappende zoekresultaten worden centraal op SKU gededupliceerd", () => {
  const stats = { duplicateSKUsSkipped: 0, uniqueSKUs: 0 };
  const seen = new Set();
  const terms = [
    ["111111111", "222222222", "333333333"],
    ["222222222", "333333333", "444444444"],
    ["111111111", "444444444", "555555555"],
  ];

  const claimed = terms.flatMap((skus) => skus)
    .filter((sku) => claimCandidateSKU({ sku }, seen, stats));

  assert.deepEqual(claimed, ["111111111", "222222222", "333333333", "444444444", "555555555"]);
  assert.equal(stats.uniqueSKUs, 5);
  assert.equal(stats.duplicateSKUsSkipped, 4);
});

test("nieuwe kandidaten krijgen prioriteit boven reeds bestaande SKU's", () => {
  const existing = new Set(["111111111", "333333333"]);
  const result = prioritizeCandidates([
    { sku: "111111111" }, { sku: "222222222" }, { sku: "333333333" }, { sku: "444444444" },
  ], existing);
  assert.deepEqual(result.map(({ sku }) => sku), ["222222222", "444444444", "111111111", "333333333"]);
});

test("bestaande SKU telt niet mee voor MAX_NEW_PRODUCTS en nieuwe SKU wel", () => {
  const existing = new Set(["111111111"]);
  const stats = { existingProducts: 0, newProducts: 0 };
  const termStats = { existing: 0, new: 0 };

  assert.equal(recordCatalogProduct("111111111", existing, stats, termStats), "existing");
  assert.deepEqual(stats, { existingProducts: 1, newProducts: 0 });
  assert.equal(catalogLimitReached(stats, { maxProducts: 180, maxNewProducts: 1 }, 1), false);

  assert.equal(recordCatalogProduct("222222222", existing, stats, termStats), "new");
  assert.deepEqual(stats, { existingProducts: 1, newProducts: 1 });
  assert.equal(catalogLimitReached(stats, { maxProducts: 180, maxNewProducts: 1 }, 2), true);
  assert.deepEqual(termStats, { existing: 1, new: 1 });
});

test("scenario A: 400 bestaande kandidaten stoppen een growth-run niet", () => {
  const config = {
    updateMode: "growth", maxProducts: 400, maxNewProducts: 400,
    growthMaxCandidates: 6000, growthMaxTotalPages: 800, growthMaxRuntimeMs: 105 * 60_000,
  };
  const stats = {
    processedProducts: 400, uniqueSKUsDiscovered: 400, pagesFetched: 10,
    newProducts: 0, persistedNewProducts: 0, persistedTargetActive: true,
  };
  assert.equal(catalogLimitReached(stats, config, 400, 1_000, 0), false);
  assert.equal(growthStopReason(stats, config, 400, 1_000, 0), null);
});

test("scenario B: 400 bestaand plus 400 werkelijk nieuw stopt exact op het growth-doel", () => {
  const config = {
    updateMode: "growth", maxProducts: 400, maxNewProducts: 400,
    growthMaxCandidates: 6000, growthMaxTotalPages: 800, growthMaxRuntimeMs: 105 * 60_000,
  };
  const stats = {
    processedProducts: 400, uniqueSKUsDiscovered: 800, pagesFetched: 20,
    newProducts: 400, persistedNewProducts: 400, persistedTargetActive: true,
  };
  assert.equal(catalogLimitReached(stats, config, 400, 1_000, 0), true);
  assert.equal(growthStopReason(stats, config, 400, 1_000, 0), "growth_target_reached");
});

test("scenario C: veel dubbele kandidaten leveren 400 unieke nieuwe SKU's", () => {
  const existing = new Set(Array.from({ length: 400 }, (_, index) => `E${index}`));
  const newSKUs = Array.from({ length: 400 }, (_, index) => `N${index}`);
  const candidates = [
    ...existing,
    ...newSKUs,
    ...newSKUs,
  ].map((sku) => ({ sku }));
  const observed = new Set();
  const filtered = filterDiscoveryCandidates(candidates, existing, observed);
  const claimed = new Set();
  const stats = { duplicateSKUsSkipped: 0, uniqueSKUs: 0 };
  const uniqueNew = filtered.candidates.filter((candidate) => claimCandidateSKU(candidate, claimed, stats));
  assert.equal(uniqueNew.length, 400);
  assert.equal(new Set(uniqueNew.map(({ sku }) => sku)).size, 400);
  assert.equal(stats.duplicateSKUsSkipped, 400);
});

test("scenario D: ERR_ABORTED krijgt twee retries en een volgende poging kan slagen", async () => {
  let attempts = 0;
  const retries = [];
  const result = await withTransientNavigationRetry(async () => {
    attempts += 1;
    if (attempts < 3) throw new Error("page.goto: net::ERR_ABORTED");
    return "gevonden";
  }, {
    maxRetries: 2,
    onRetry: (_error, attempt) => retries.push(attempt),
    wait: async () => {},
  });
  assert.equal(result, "gevonden");
  assert.equal(attempts, 3);
  assert.deepEqual(retries, [1, 2]);
});

test("scenario E: een verzadigde term schuift tijdelijk achter productieve termen", () => {
  const saturated = finalizeTermDiscoveryStats({ candidates: 40, new: 1 }, {
    saturationMinCandidates: 40, saturationYieldThreshold: 0.05,
  });
  assert.equal(saturated.discoveryYield, 0.025);
  assert.equal(saturated.saturated, true);
  const now = new Date("2026-09-16T12:00:00Z");
  const state = mergeDiscoveryMetrics({}, { pasta: saturated }, now);
  const prioritized = prioritizeDiscoveryTerms(["pasta", "fruit"], state, now);
  assert.deepEqual(prioritized, ["fruit", "pasta"]);
  assert.deepEqual(prioritizeDiscoveryTerms(["pasta", "fruit"], {
    ...state, lastTerm: "pasta", pageCursor: 3,
  }, now), ["pasta", "fruit"], "een halve zoekterm hervat eerst op de opgeslagen pagina");
  assert.deepEqual(prioritizeDiscoveryTerms(["pasta", "fruit"], {
    ...state, lastTerm: "pasta", pageCursor: 0, lastStopReason: "growth_target_reached",
  }, now), ["pasta", "fruit"], "ook pagina nul hervat wanneer het doel midden in die term viel");
});

test("scenario F: safety limits geven een concrete stopreden vóór uitputting", () => {
  const config = {
    updateMode: "growth", maxProducts: 400, maxNewProducts: 400,
    growthMaxCandidates: 1200, growthMaxTotalPages: 800, growthMaxRuntimeMs: 105 * 60_000,
  };
  const stats = {
    uniqueSKUsDiscovered: 1200, pagesFetched: 50, newProducts: 327,
    persistedNewProducts: 327, persistedTargetActive: true,
  };
  assert.equal(growthStopReason(stats, config, 327, 1_000, 0), "candidate_safety_limit");
});

test("automatische discovery selecteert alleen nieuwe SKU's en een identieke tweede run is een veilige no-op", () => {
  const candidates = [
    { sku: "111111111" }, { sku: "222222222" }, { sku: "333333333" },
  ];
  const observed = new Set();
  const first = filterDiscoveryCandidates(candidates, new Set(["111111111"]), observed);
  assert.deepEqual(first.candidates.map(({ sku }) => sku), ["222222222", "333333333"]);
  assert.equal(first.existingOccurrences, 1);
  assert.equal(first.uniqueExistingSKUs, 1);

  const second = filterDiscoveryCandidates(
    candidates,
    new Set(candidates.map(({ sku }) => sku)),
    observed,
  );
  assert.deepEqual(second.candidates, []);
  assert.equal(second.uniqueExistingSKUs, 3);
  assert.equal(isSafeEmptyDiscovery(
    { catalogNewOnly: true },
    { existingSKUsDiscovered: second.uniqueExistingSKUs },
    0,
  ), true);
  assert.equal(isSafeEmptyDiscovery(
    { catalogNewOnly: true },
    { existingSKUsDiscovered: second.uniqueExistingSKUs },
    1,
  ), false, "een mislukte validatie van een werkelijk nieuwe SKU mag niet stil groen worden");
});

test("alleen een volledig betrouwbaar nieuw product bereikt de opslagketen", () => {
  const valid = testProduct("987654321", "Nieuw Hoogvliet-product", 2.49);
  assert.equal(isReliableCatalogProduct(valid), true);
  assert.equal(isReliableCatalogProduct({ ...valid, sku: null }), false);
  assert.equal(isReliableCatalogProduct({ ...valid, price: null }), false);
  assert.equal(isReliableCatalogProduct({ ...valid, price: 0 }), false);
  assert.equal(isReliableCatalogProduct({ ...valid, packageText: null }), false);
  assert.equal(isReliableCatalogProduct({ ...valid, sourceURL: "https://example.com/product/987654321" }), false);
});

test("server-side geheim is verplicht buiten dry-run", () => {
  assert.throws(() => loadConfig({ SUPABASE_URL: "https://voorbeeld.supabase.co" }), /SUPABASE_SECRET_KEY/);
});

test("SKU- en product-URL-validatie zijn strikt", () => {
  assert.equal(isValidSKU("123456789"), true);
  assert.equal(isValidSKU("TEST-001"), false);
  assert.equal(isValidProductURL("https://www.hoogvliet.com/product/voorbeeld"), true);
  assert.equal(isValidProductURL("https://example.com/product/voorbeeld"), false);
});

test("prijzen worden alleen uit expliciete bedragen gelezen", () => {
  assert.equal(parsePriceText("€ 5,52"), 5.52);
  assert.equal(parsePriceText("geen prijs"), null);
});

test("gewicht wordt alleen bij een eenduidige gram- of kilogramverpakking afgeleid", () => {
  assert.equal(weightInGrams("500 gram"), 500);
  assert.equal(weightInGrams("1,5 kg"), 1500);
  assert.equal(weightInGrams("6 x 200 gram"), null);
  assert.equal(weightInGrams("1,5 liter"), null);
});

test("een expliciete Nederlandse aanbiedingsperiode wordt zonder gokwerk gelezen", () => {
  assert.deepEqual(
    parseOfferPeriod("Aanbieding is geldig van 26 augustus t/m 01 september", new Date("2026-08-28T12:00:00Z")),
    { validFrom: "2026-08-26", validUntil: "2026-09-01" },
  );
  assert.equal(parseOfferPeriod("2 voor 5 euro"), null);
});

test("alleen een aanbieding binnen de echte geldigheidsperiode blijft actief", () => {
  const period = { validFrom: "2026-09-07", validUntil: "2026-09-13" };
  assert.equal(isOfferPeriodActive(period, new Date("2026-09-08T12:00:00Z")), true);
  assert.equal(isOfferPeriodActive(period, new Date("2026-09-14T00:00:00Z")), false);
  assert.equal(isOfferPeriodActive(null, new Date("2026-09-08T12:00:00Z")), false);
});

test("prijsvergelijking onderscheidt gewijzigd, ongewijzigd en aanbieding gestart of beëindigd", () => {
  assert.deepEqual(
    describePriceUpdate({ price: 2.49, isOffer: false }, { price: 2.49, isOffer: false }),
    { changed: false, offerStarted: false, offerEnded: false, activeOffer: false },
  );
  assert.deepEqual(
    describePriceUpdate({ price: 2.49, isOffer: false }, { price: 1.99, isOffer: true }),
    { changed: true, offerStarted: true, offerEnded: false, activeOffer: true },
  );
  assert.deepEqual(
    describePriceUpdate({ price: 1.99, isOffer: true }, { price: 2.49, isOffer: false }),
    { changed: true, offerStarted: false, offerEnded: true, activeOffer: false },
  );
});

test("prijsrefresh beschermt een bestaand betrouwbaar producttype tegen Onbekend", () => {
  assert.equal(
    resolvedProductTypeForRefresh({ name: "Bijzonder artikel" }, "Cola", null),
    "Cola",
  );
  assert.equal(
    resolvedProductTypeForRefresh({ name: "Coca-Cola Zero" }, "Onbekend", null),
    "Cola",
  );
});

test("Supabase-upserts gebruiken de twee bedoelde unieke sleutels", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    const isPrice = String(url).includes("/product_prices?");
    return new Response(JSON.stringify(isPrice
      ? [{ product_id: "product-uuid", price: 5.52, is_offer: false, updated_at: "2026-09-06T20:00:00Z" }]
      : [{ id: "product-uuid", sku: "123456789", name: "Echt product" }]), { status: 200 });
  };

  try {
    const product = testProduct();
    await upsertProducts({
      supabaseURL: "https://voorbeeld.supabase.co",
      supabaseSecret: ["sb", "secret", "test"].join("_"),
    }, [product]);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests.length, 2);
  assert.match(requests[0].url, /on_conflict=supermarket%2Csku/);
  assert.match(requests[1].url, /on_conflict=product_id/);
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[1].options.method, "POST");
  assert.equal(requests[0].options.headers["Content-Type"], "application/json");
  assert.equal(requests[0].options.headers.Prefer, "resolution=merge-duplicates,return=representation");
  assert.equal(requests[1].options.headers.Prefer, "resolution=merge-duplicates,return=representation");
  assert.equal(requests[0].options.headers.Authorization, undefined);
  const storedProductPayload = JSON.parse(requests[0].options.body)[0];
  assert.equal(storedProductPayload.brand, undefined);
  assert.equal(storedProductPayload.category, undefined);
  assert.equal(storedProductPayload.image_url, undefined);
  assert.equal(storedProductPayload.is_available, undefined);
  assert.equal(storedProductPayload.product_type, "Gehakt");
  assert.equal(JSON.parse(requests[1].options.body)[0].product_id, "product-uuid");
});

test("een bestaande SKU kan in een volgende run veilig opnieuw worden ge-upsert", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    const isPrice = String(url).includes("/product_prices?");
    return new Response(JSON.stringify(isPrice
      ? [{ product_id: "bestaand-product", price: 5.52 }]
      : [{ id: "bestaand-product", sku: "123456789", name: "Echt product" }]), { status: 200 });
  };

  try {
    const config = {
      supabaseURL: "https://voorbeeld.supabase.co",
      supabaseSecret: ["sb", "secret", "test"].join("_"),
    };
    const first = await upsertProducts(config, [testProduct()]);
    const second = await upsertProducts(config, [testProduct()]);
    assert.equal(first.imported.length, 1);
    assert.equal(second.imported.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests.length, 4);
  assert.equal(requests.filter(({ url }) => /on_conflict=supermarket%2Csku/.test(url)).length, 2);
  assert.equal(requests.filter(({ url }) => /on_conflict=product_id/.test(url)).length, 2);
});

test("een gewijzigde prijs wordt via hetzelfde product_id bijgewerkt en maakt geen productduplicaat", async () => {
  const originalFetch = globalThis.fetch;
  const pricePayloads = [];
  globalThis.fetch = async (url, options) => {
    const payload = JSON.parse(options.body)[0];
    if (String(url).includes("/product_prices?")) {
      pricePayloads.push(payload);
      return new Response(JSON.stringify([payload]), { status: 200 });
    }
    return new Response(JSON.stringify([{
      id: "vast-product-id", sku: payload.sku, name: payload.name,
    }]), { status: 200 });
  };
  try {
    const config = {
      supabaseURL: "https://voorbeeld.supabase.co",
      supabaseSecret: ["sb", "secret", "test"].join("_"),
      productTypeSupported: true,
    };
    await upsertProducts(config, [testProduct("123456789", "Echt product", 5.52)]);
    await upsertProducts(config, [{
      ...testProduct("123456789", "Echt product", 1.99),
      oldPrice: 2.49,
      isOffer: true,
      offerText: "Per stuk · Aanbieding is geldig van 7 september t/m 13 september",
      validFrom: "2026-09-07",
      validUntil: "2026-09-13",
    }]);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.deepEqual(pricePayloads.map(({ product_id }) => product_id), ["vast-product-id", "vast-product-id"]);
  assert.deepEqual(pricePayloads.map(({ price }) => price), [5.52, 1.99]);
  assert.equal(pricePayloads[1].old_price, 2.49);
  assert.equal(pricePayloads[1].is_offer, true);
  assert.equal(pricePayloads[1].valid_until, "2026-09-13");
});

test("ongeldige nieuwe prijs start geen write en kan een bestaande geldige prijs niet overschrijven", async () => {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests += 1;
    throw new Error("fetch had niet aangeroepen mogen worden");
  };
  try {
    await assert.rejects(
      upsertProducts({
        supabaseURL: "https://voorbeeld.supabase.co",
        supabaseSecret: ["sb", "secret", "test"].join("_"),
      }, [testProduct("123456789", "Echt product", Number.NaN)]),
      /Ongeldige prijs; bestaande Supabase-prijs blijft ongewijzigd/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requests, 0);
});

test("Supabase basis-URL wordt exact met de twee REST-paden gecombineerd", () => {
  assert.equal(
    restURL("https://voorbeeld.supabase.co", "products").href,
    "https://voorbeeld.supabase.co/rest/v1/products",
  );
  assert.equal(
    restURL("https://voorbeeld.supabase.co/rest/v1/", "product_prices").href,
    "https://voorbeeld.supabase.co/rest/v1/product_prices",
  );
});

test("moderne secret key wordt niet foutief als Bearer-JWT verzonden", () => {
  const modern = requestHeaders(["sb", "secret", "voorbeeld"].join("_"), "return=representation");
  assert.equal(modern.Authorization, undefined);
  assert.equal(modern.apikey, ["sb", "secret", "voorbeeld"].join("_"));

  const legacy = requestHeaders("eyJlegacy-service-role", "return=representation");
  assert.equal(legacy.Authorization, "Bearer eyJlegacy-service-role");
});

test("bestaande Hoogvliet-SKU's worden licht uit Supabase gelezen", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify([{ sku: "111111111" }, { sku: "222222222" }]), { status: 200 });
  };

  let result;
  try {
    result = await fetchExistingSKUs({
      supabaseURL: "https://voorbeeld.supabase.co",
      supabaseSecret: ["sb", "secret", "test"].join("_"),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.deepEqual([...result], ["111111111", "222222222"]);
  assert.match(request.url, /\/rest\/v1\/products\?/);
  assert.match(request.url, /select=sku/);
  assert.match(request.url, /supermarket=eq\.Hoogvliet/);
  assert.equal(request.options.method, "GET");
  assert.equal(request.options.headers.Range, "0-999");
});

test("producttype-kolom wordt veilig gedetecteerd zonder schema te gokken", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    return new Response(JSON.stringify([]), { status: 200 });
  };
  try {
    assert.equal(await hasProductTypeColumn({
      supabaseURL: "https://voorbeeld.supabase.co",
      supabaseSecret: ["sb", "secret", "test"].join("_"),
    }), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.match(requests[0], /select=product_type/);
});

test("ontbrekende producttype-kolom breekt bestaande imports niet", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    code: "PGRST204", message: "Could not find the 'product_type' column",
  }), { status: 400 });
  try {
    assert.equal(await hasProductTypeColumn({
      supabaseURL: "https://voorbeeld.supabase.co",
      supabaseSecret: ["sb", "secret", "test"].join("_"),
    }), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("bestaande product-upsert laat producttype weg zolang de migratie ontbreekt", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    const isPrice = String(url).includes("/product_prices?");
    return new Response(JSON.stringify(isPrice
      ? [{ product_id: "product-uuid", price: 5.52 }]
      : [{ id: "product-uuid", sku: "123456789", name: "Echt product" }]), { status: 200 });
  };
  try {
    await upsertProducts({
      supabaseURL: "https://voorbeeld.supabase.co",
      supabaseSecret: ["sb", "secret", "test"].join("_"),
      productTypeSupported: false,
    }, [testProduct()]);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(JSON.parse(requests[0].options.body)[0].product_type, undefined);
  assert.equal(requests.filter(({ url }) => url.includes("/product_prices?")).length, 1);
});

test("backfill werkt alleen products bij en raakt gekoppelde prijzen niet aan", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), options });
    const payload = JSON.parse(options.body);
    return new Response(JSON.stringify(payload.map((product, index) => ({
      id: `id-${index}`, sku: product.sku, product_type: product.product_type,
    }))), { status: 200 });
  };
  let result;
  try {
    result = await upsertProductClassifications({
      supabaseURL: "https://voorbeeld.supabase.co",
      supabaseSecret: ["sb", "secret", "test"].join("_"),
      productTypeSupported: true,
    }, [
      { sku: "111111111", name: "Coca-Cola", productType: "Cola", packageText: "1,5 liter", sourceURL: "https://www.hoogvliet.com/product/cola" },
      { sku: "222222222", name: "Pepsi Max", productType: "Cola", packageText: "1,5 liter", sourceURL: "https://www.hoogvliet.com/product/pepsi" },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(result.written, 2);
  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/rest\/v1\/products\?/);
  assert.doesNotMatch(requests[0].url, /product_prices/);
  assert.deepEqual(JSON.parse(requests[0].options.body).map(({ product_type }) => product_type), ["Cola", "Cola"]);
});

test("classificatie-upsert maakt gemengde metadata per request PostgREST-uniform", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    const payload = JSON.parse(options.body);
    const signatures = payload.map((row) => Object.keys(row).sort().join(","));
    assert.equal(new Set(signatures).size, 1, "alle object keys binnen een bulkrequest moeten gelijk zijn");
    requests.push({ url: String(url), payload });
    return new Response(JSON.stringify(payload.map((product, index) => ({
      id: `id-${requests.length}-${index}`,
      sku: product.sku,
      product_type: product.product_type,
    }))), { status: 200 });
  };

  let result;
  try {
    result = await upsertProductClassifications({
      supabaseURL: "https://voorbeeld.supabase.co",
      supabaseSecret: ["sb", "secret", "test"].join("_"),
      productTypeSupported: true,
    }, [
      {
        sku: "111111111", name: "Coca-Cola", brand: "Coca-Cola", category: "Frisdrank",
        packageText: "1,5 liter", imageURL: "https://example.com/cola.jpg", isAvailable: true,
        productType: "Cola", sourceURL: "https://www.hoogvliet.com/product/cola",
      },
      {
        sku: "222222222", name: "Pepsi Max", packageText: "1,5 liter",
        productType: "Cola", sourceURL: "https://www.hoogvliet.com/product/pepsi",
      },
      {
        sku: "333333333", name: "Onbekend artikel", category: "Overig", packageText: "1 stuk",
        productType: null, sourceURL: "https://www.hoogvliet.com/product/onbekend",
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(result.written, 3);
  assert.ok(requests.length > 1, "verschillende sleutelsets horen in afzonderlijke requests");
  assert.ok(requests.every(({ url }) => url.includes("/rest/v1/products?")));
  assert.ok(requests.every(({ url }) => !url.includes("product_prices")));
  const writtenProducts = requests.flatMap(({ payload }) => payload);
  assert.equal(writtenProducts.find(({ sku }) => sku === "333333333")?.product_type, UNKNOWN_PRODUCT_TYPE);
  assert.equal(writtenProducts.find(({ sku }) => sku === "222222222")?.brand, undefined);
});

test("een tijdelijke fetch-fout wordt opnieuw geprobeerd", async () => {
  const originalFetch = globalThis.fetch;
  let attempts = 0;
  globalThis.fetch = async (url) => {
    attempts += 1;
    if (attempts === 1) throw new TypeError("fetch failed", { cause: { code: "ECONNRESET", message: "reset" } });
    const isPrice = String(url).includes("/product_prices?");
    return new Response(JSON.stringify(isPrice
      ? [{ product_id: "product-uuid", price: 5.52 }]
      : [{ id: "product-uuid", sku: "123456789", name: "Echt product" }]), { status: 200 });
  };

  try {
    await upsertProducts({
      supabaseURL: "https://voorbeeld.supabase.co",
      supabaseSecret: ["sb", "secret", "test"].join("_"),
    }, [testProduct()]);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(attempts, 3);
});

test("HTTP-fout toont status en foutcode maar redigeert de secret", async () => {
  const originalFetch = globalThis.fetch;
  const secret = ["sb", "secret", "zeer-geheim"].join("_");
  globalThis.fetch = async () => new Response(JSON.stringify({
    code: "PGRST301",
    message: `Ongeldige sleutel ${secret}`,
  }), { status: 401 });

  let message = "";
  try {
    await upsertProducts({ supabaseURL: "https://voorbeeld.supabase.co", supabaseSecret: secret }, [testProduct()]);
  } catch (error) {
    message = error.message;
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.match(message, /HTTP 401/);
  assert.match(message, /PGRST301/);
  assert.match(message, /fase=products/);
  assert.match(message, /host=voorbeeld\.supabase\.co/);
  assert.match(message, /soort=http/);
  assert.doesNotMatch(message, new RegExp(secret));
  assert.match(message, /\[REDACTED\]/);
});

test("netwerkfout toont veilige DNS-diagnostiek met fase en host", async () => {
  const originalFetch = globalThis.fetch;
  const originalSetTimeout = globalThis.setTimeout;
  const secret = ["sb", "secret", "niet-loggen"].join("_");
  globalThis.setTimeout = (callback, delay, ...args) => originalSetTimeout(callback, Math.min(delay, 1), ...args);
  globalThis.fetch = async () => {
    const cause = Object.assign(new Error(`getaddrinfo ENOTFOUND ${secret}`), { code: "ENOTFOUND" });
    throw new TypeError("fetch failed", { cause });
  };

  let message = "";
  try {
    await upsertProducts({ supabaseURL: "https://voorbeeld.supabase.co", supabaseSecret: secret }, [testProduct()]);
  } catch (error) {
    message = error.message;
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.setTimeout = originalSetTimeout;
  }

  assert.match(message, /fase=products/);
  assert.match(message, /host=voorbeeld\.supabase\.co/);
  assert.match(message, /soort=dns/);
  assert.match(message, /error\.name=TypeError/);
  assert.match(message, /cause\.code=ENOTFOUND/);
  assert.match(message, /Pogingen: 3/);
  assert.doesNotMatch(message, new RegExp(secret));
  assert.match(message, /\[REDACTED\]/);
});

test("deduplicatie vóór Supabase verwerkt dezelfde SKU maar één keer", async () => {
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url) => {
    requests.push(String(url));
    const isPrice = String(url).includes("/product_prices?");
    return new Response(JSON.stringify(isPrice
      ? [{ product_id: "product-uuid", price: 5.52 }]
      : [{ id: "product-uuid", sku: "123456789", name: "Echt product" }]), { status: 200 });
  };

  let result;
  try {
    result = await upsertProducts({
      supabaseURL: "https://voorbeeld.supabase.co",
      supabaseSecret: ["sb", "secret", "test"].join("_"),
    }, [testProduct(), testProduct()]);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requests.length, 2);
  assert.equal(result.imported.length, 1);
  assert.equal(result.duplicateSKUsSkipped, 1);
});

test("één productspecifieke fout blokkeert een volgend geldig product niet", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    const payload = JSON.parse(options.body)[0];
    if (payload.sku === "111111111") {
      return new Response(JSON.stringify({ code: "22003", message: "ongeldige productwaarde" }), { status: 400 });
    }
    const isPrice = String(url).includes("/product_prices?");
    return new Response(JSON.stringify(isPrice
      ? [{ product_id: "good-uuid", price: 3.25 }]
      : [{ id: "good-uuid", sku: "222222222", name: "Geldig product" }]), { status: 200 });
  };

  let result;
  try {
    result = await upsertProducts({
      supabaseURL: "https://voorbeeld.supabase.co",
      supabaseSecret: ["sb", "secret", "test"].join("_"),
    }, [testProduct("111111111", "Ongeldig"), testProduct("222222222", "Geldig product", 3.25)]);
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(result.imported.length, 1);
  assert.equal(result.imported[0].sku, "222222222");
  assert.equal(result.errors.length, 1);
  assert.equal(result.errors[0].sku, "111111111");
});

test("een structurele Supabase-authenticatiefout laat de run falen", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ code: "PGRST301", message: "unauthorized" }), { status: 401 });
  try {
    await assert.rejects(
      upsertProducts({
        supabaseURL: "https://voorbeeld.supabase.co",
        supabaseSecret: ["sb", "secret", "test"].join("_"),
      }, [testProduct()]),
      /HTTP 401/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("batchstatistieken en logging lekken geen ingestelde secrets", () => {
  const originalLog = console.log;
  const captured = [];
  const secret = ["sb", "secret", "batch-geheim"].join("_");
  console.log = (message) => captured.push(String(message));
  try {
    const logger = safeLogger([secret]);
    logger.info(`${secret} ${formatBatchSummary({
      catalogBatch: "core",
      searchedTerms: 2, configuredSearchTerms: 3, candidatesFound: 8,
      uniqueSKUs: 7, newProducts: 5, existingProducts: 2,
      uniqueSKUsDiscovered: 7, newSKUsDiscovered: 5,
      existingSKUsDiscovered: 2, unknownProductTypes: 1,
      validatedProducts: 4, duplicateSKUsSkipped: 1, invalidProductsSkipped: 2,
      productErrors: 1, searchErrors: 0, writtenProducts: 4,
      newProductsWritten: 3, existingProductsUpdated: 1, writeErrors: 0,
      durationMs: 1500,
    })}`);
  } finally {
    console.log = originalLog;
  }
  assert.equal(captured.length, 1);
  assert.doesNotMatch(captured[0], new RegExp(secret));
  assert.match(captured[0], /\[REDACTED\]/);
  assert.match(captured[0], /unieke_SKUs=7/);
  assert.match(captured[0], /nieuw_gevonden=5/);
  assert.match(captured[0], /nieuwe_SKUs=5/);
  assert.match(captured[0], /bestaande_SKUs=2/);
  assert.match(captured[0], /bestaand_gevonden=2/);
  assert.match(captured[0], /onbekend_type=1/);
  assert.match(captured[0], /nieuw_geschreven=3/);
  assert.match(captured[0], /bestaand_bijgewerkt=1/);
  assert.match(captured[0], /overgeslagen=3/);
  assert.match(captured[0], /geschreven=4/);
});

test("catalogusdekking wordt compact per zoekterm gerapporteerd", () => {
  const lines = formatTermCoverage({
    kip: { candidates: 12, pages: 2, new: 3, existing: 1, existingSkipped: 4 },
    pasta: { candidates: 8, pages: 2, new: 2, existing: 1, existingSkipped: 2 },
    melk: { candidates: 6, pages: 1, new: 1, existing: 2, existingSkipped: 1 },
  }, 2);

  assert.equal(lines.length, 2);
  assert.match(lines[0], /kip: 12 relevant\/2 pag\., 3 nieuw, 1 bijgewerkt, 4 bekend overgeslagen/);
  assert.match(lines[0], /pasta: 8 relevant\/2 pag\., 2 nieuw, 1 bijgewerkt/);
  assert.match(lines[1], /melk: 6 relevant\/1 pag\., 1 nieuw, 2 bijgewerkt/);
});

test("prijsmodus en begrensde prijsdeelbatch zijn configureerbaar", () => {
  const config = loadConfig({
    DRY_RUN: "1", UPDATE_MODE: "prices", PRICE_SHARD_COUNT: "7", PRICE_SHARD_INDEX: "6",
  });
  assert.equal(config.updateMode, "prices");
  assert.equal(config.priceShardCount, 7);
  assert.equal(config.priceShardIndex, 6);
  assert.throws(
    () => loadConfig({ DRY_RUN: "1", UPDATE_MODE: "prices", PRICE_SHARD_COUNT: "7", PRICE_SHARD_INDEX: "7" }),
    /Ongeldige PRICE_SHARD_INDEX/,
  );
  assert.throws(() => loadConfig({ DRY_RUN: "1", UPDATE_MODE: "onbekend" }), /Ongeldige UPDATE_MODE/);
  assert.equal(loadConfig({ DRY_RUN: "1", UPDATE_MODE: "classify" }).updateMode, "classify");
});

test("prijsdeelbatches verdelen SKU's stabiel zonder overlap", () => {
  const products = [0, 1, 2, 3, 4, 5, 6].map((value) => ({
    sku: `12345678${value}`,
    sourceURL: `https://www.hoogvliet.com/product/${value}`,
  }));
  const shards = Array.from({ length: 7 }, (_, index) => selectPriceShard(products, index, 7, 100));
  assert.equal(shards.flat().length, products.length);
  assert.equal(new Set(shards.flat().map(({ sku }) => sku)).size, products.length);
  for (const shard of shards) assert.ok(shard.length <= 1);
});

test("grote SKU-shards rouleren begrensd zodat nieuwe producten later automatisch aan bod komen", () => {
  const products = Array.from({ length: 205 }, (_, index) => ({
    sku: String(100000000 + index * 7),
    sourceURL: `https://www.hoogvliet.com/product/${100000000 + index * 7}`,
  }));
  const first = selectPriceShardWindow(products, 2, 7, 100, 0);
  const second = selectPriceShardWindow(products, 2, 7, 100, 1);
  const third = selectPriceShardWindow(products, 2, 7, 100, 2);
  assert.equal(first.totalInShard, 205);
  assert.equal(first.windowCount, 3);
  assert.equal(first.products.length, 100);
  assert.equal(second.products.length, 100);
  assert.equal(third.products.length, 5);
  assert.equal(new Set([...first.products, ...second.products, ...third.products].map(({ sku }) => sku)).size, 205);
  assert.deepEqual(selectPriceShardWindow(products, 2, 7, 100, 3).products, first.products);
});

test("bestaande productbronmetadata wordt zonder cacheprijs voor prijsvalidatie gelezen", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify([{
      id: "product-uuid", sku: "123456789", name: "Bestaand product", brand: "Merk", category: "Categorie",
      package_text: "500 gram", image_url: "https://voorbeeld.nl/product.jpg",
      source_url: "https://www.hoogvliet.com/product/bestaand-product", is_available: true,
    }]), { status: 200 });
  };
  let products;
  try {
    products = await fetchExistingProducts({
      supabaseURL: "https://voorbeeld.supabase.co",
      supabaseSecret: ["sb", "secret", "test"].join("_"),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(products.length, 1);
  assert.deepEqual(products[0], {
    id: "product-uuid", sku: "123456789", name: "Bestaand product", brand: "Merk", category: "Categorie",
    packageText: "500 gram", weightGrams: null, imageURL: "https://voorbeeld.nl/product.jpg",
    sourceURL: "https://www.hoogvliet.com/product/bestaand-product", available: true,
    productType: null,
  });
  assert.match(request.url, /select=id%2Csku%2Cname%2Cbrand%2Ccategory%2Cpackage_text/);
  assert.doesNotMatch(request.url, /product_prices/);
});

test("bestaande prijsstatus wordt uitsluitend via product_id aan het juiste product gekoppeld", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify([
      {
        product_id: "product-a", price: "2.49", old_price: null, is_offer: false,
        offer_text: null, valid_from: null, valid_until: null,
        fetched_at: "2026-09-08T08:00:00Z", updated_at: "2026-09-08T08:00:00Z",
      },
      {
        product_id: "product-b", price: "1.99", old_price: "2.79", is_offer: true,
        offer_text: "Per stuk", valid_from: "2026-09-07", valid_until: "2026-09-13",
        fetched_at: "2026-09-08T09:00:00Z", updated_at: "2026-09-08T09:00:00Z",
      },
    ]), { status: 200 });
  };
  let prices;
  try {
    prices = await fetchExistingPriceStates({
      supabaseURL: "https://voorbeeld.supabase.co",
      supabaseSecret: ["sb", "secret", "test"].join("_"),
    });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(prices.get("product-a")?.price, 2.49);
  assert.equal(prices.get("product-b")?.price, 1.99);
  assert.equal(prices.get("product-b")?.isOffer, true);
  assert.equal(prices.get("verkeerd-product"), undefined);
  assert.match(request.url, /\/rest\/v1\/product_prices\?/);
  assert.match(request.url, /select=product_id%2Cprice%2Cold_price/);
});

test("prijsupdate-statistieken zijn compact en bevatten geen credentials", () => {
  const summary = formatPriceRefreshSummary({
    priceShardIndex: 2, priceShardCount: 7, selectedProducts: 65,
    priceWindowIndex: 1, priceWindowCount: 3, totalInShard: 265,
    checkedProducts: 65, foundProducts: 62, changedPrices: 8, unchangedPrices: 54,
    activeOffers: 7, offersStarted: 2, offersEnded: 1, notFoundProducts: 1,
    invalidPrices: 2, validatedProducts: 62, invalidProductsSkipped: 3, productErrors: 0,
    writtenProducts: 64, writeErrors: 0, durationMs: 125_000,
  });
  assert.match(summary, /deelbatch=3\/7/);
  assert.match(summary, /venster=2\/3/);
  assert.match(summary, /in_shard=265/);
  assert.match(summary, /gecontroleerd=65/);
  assert.match(summary, /gevonden=62/);
  assert.match(summary, /gewijzigd=8/);
  assert.match(summary, /ongewijzigd=54/);
  assert.match(summary, /acties=7/);
  assert.match(summary, /actie_gestart=2/);
  assert.match(summary, /actie_beëindigd=1/);
  assert.match(summary, /niet_gevonden=1/);
  assert.match(summary, /ongeldige_prijs=2/);
  assert.match(summary, /geschreven=64/);
  assert.doesNotMatch(summary, /SUPABASE|secret|apikey|Authorization/i);
});

test("classificatiestatistieken tonen dekking en fallback compact", () => {
  const coverage = productTypeCoverage([
    { name: "Coca-Cola Original" }, { name: "Pepsi Max" }, { name: "Mysterieproduct" },
  ]);
  const summary = formatClassificationSummary(coverage, 3);
  assert.match(summary, /onderzocht=3/);
  assert.match(summary, /geclassificeerd=2/);
  assert.match(summary, /onbekend=1/);
  assert.match(summary, /dekking=66\.7%/);
  assert.match(summary, /Cola=2/);
});

test("workflow behoudt handmatig starten en plant veilige automatische updates", async () => {
  const workflow = await readFile(new URL("../.github/workflows/import-hoogvliet-poc.yml", import.meta.url), "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /cron: "17 2 \* \* \*"/);
  assert.match(workflow, /cron: "43 3 \* \* 0"/);
  assert.match(workflow, /cron: "7 6 \* \* \*"\n      timezone: "Europe\/Amsterdam"/);
  assert.doesNotMatch(workflow, /local_hour|TZ=Europe\/Amsterdam date \+%H/);
  assert.match(workflow, /group: hoogvliet-supabase-update/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /SUPABASE_URL: \$\{\{ secrets\.SUPABASE_URL \}\}/);
  assert.match(workflow, /SUPABASE_SECRET_KEY: \$\{\{ secrets\.SUPABASE_SECRET_KEY \}\}/);
  assert.match(workflow, /MAX_PER_TERM=.*"40".*"20"/);
  assert.match(workflow, /MAX_PAGES_PER_TERM=.*"8".*"4"/);
  assert.match(workflow, /GROWTH_MAX_PAGES_PER_TERM=20/);
  assert.match(workflow, /GROWTH_MAX_TOTAL_PAGES=800/);
  assert.match(workflow, /GROWTH_MAX_CANDIDATES=6000/);
  assert.match(workflow, /GROWTH_MAX_RUNTIME_MINUTES=105/);
  assert.match(workflow, /NAVIGATION_RETRIES=2/);
  assert.match(workflow, /CATALOG_NEW_ONLY=1/);
  assert.match(workflow, /batches=\(core fresh world pantry\)/);
  assert.match(workflow, /PRICE_CYCLE_INDEX=\$\(\(10#\$\(date -u \+%V\) - 1\)\)/);
  assert.match(workflow, /- classify/);
  assert.match(workflow, /- growth/);
  assert.match(workflow, /MAX_PRODUCTS=\$max_products/);
  assert.match(workflow, /DISCOVERY_STATE_KEY=\$discovery_state_key/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
});

test("dagelijkse bewakingsworkflow controleert een vertraagde 06:07-run DST-veilig", async () => {
  const workflow = await readFile(new URL("../.github/workflows/monitor-catalog-import.yml", import.meta.url), "utf8");
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /cron: "30 8 \* \* \*"\n      timezone: "Europe\/Amsterdam"/);
  assert.doesNotMatch(workflow, /RUN_MONITOR|local_hour|TZ=Europe\/Amsterdam date \+%H/);
  assert.match(workflow, /npm run monitor:catalog/);
  assert.match(workflow, /SUPABASE_SECRET_KEY: \$\{\{ secrets\.SUPABASE_SECRET_KEY \}\}/);
  assert.match(workflow, /CATALOG_MONITOR_GROWTH_TARGET: "400"/);
  assert.doesNotMatch(workflow, /NEXT_PUBLIC_|continue-on-error:\s*true/);
});

test("groeiconfiguratie gebruikt 400 als doel voor werkelijk nieuwe producten", () => {
  const config = loadConfig({
    DRY_RUN: "1",
    UPDATE_MODE: "growth",
    CATALOG_BATCH: "growth",
    MAX_PRODUCTS: "400",
    MAX_NEW_PRODUCTS: "400",
    IMPORT_TRIGGER: "schedule",
  });
  assert.equal(config.maxProducts, 400);
  assert.equal(config.maxNewProducts, 400);
  assert.equal(config.importTrigger, "schedule");
  assert.ok(config.searchTerms.length > 100);
  assert.equal(new Set(config.searchTerms).size, config.searchTerms.length);
});

test("discovery-state roteert deterministisch en ondersteunt een identieke testrun", () => {
  const terms = ["a", "b", "c", "d"];
  assert.deepEqual(rotateDiscoveryTerms(terms, 2), ["c", "d", "a", "b"]);
  assert.equal(nextDiscoveryCursor(2, 2, terms.length), 0);
  assert.deepEqual(rotateDiscoveryTerms(terms, 2), rotateDiscoveryTerms(terms, 2));
  assert.equal(loadConfig({ DRY_RUN: "1", PREFER_NEW_PRODUCTS: "0" }).preferNewProducts, false);
});

test("toekomstige catalogusgroei leidt nieuwe zoektermen af uit echte merk- en productmetadata", () => {
  const terms = buildDynamicDiscoveryTerms([
    { brand: "Nieuw Merk", category: "Wereldkeuken", productType: "Maaltijdmix", name: "Nieuw Merk Thaise curry" },
    { brand: "Nieuw Merk", category: "Wereldkeuken", productType: "Maaltijdmix", name: "Nieuw Merk Groene curry" },
    { brand: "Ander Merk", category: "Koek", productType: "Koek", name: "Ander Merk Haverkoek" },
  ], ["maaltijdmix", "koek"]);
  assert.ok(terms.includes("Nieuw Merk"));
  assert.ok(terms.includes("Ander Merk"));
  assert.ok(terms.includes("Wereldkeuken"));
  assert.ok(terms.includes("a"));
  assert.ok(terms.includes("curry"));
  assert.equal(new Set(terms.map((term) => term.toLowerCase())).size, terms.length);
  assert.equal(terms.includes("Maaltijdmix"), false, "reeds ingestelde termen worden niet herhaald");
});

test("discovery-state bewaart cursor, termyield en tijdelijke verzadiging compatibel in Supabase", async () => {
  const originalFetch = globalThis.fetch;
  let storedPayload;
  const config = {
    supabaseURL: "https://voorbeeld.supabase.co",
    supabaseSecret: ["sb", "secret", "test"].join("_"),
  };
  globalThis.fetch = async (_url, options) => {
    if (options.method === "GET") {
      return new Response(JSON.stringify([{
        state_key: "daily-growth", term_cursor: 7, page_cursor: 3,
        last_batch: JSON.stringify({
          version: 2, batch: "growth", lastTerm: "pasta",
          lastStopReason: "growth_target_reached",
          termStats: { pasta: { candidates: 80, newProducts: 25, discoveryYield: 0.3125 } },
          saturatedUntil: { fruit: "2026-09-19T12:00:00.000Z" },
        }),
        updated_at: "2026-09-16T12:00:00.000Z",
      }]), { status: 200 });
    }
    assert.equal(options.method, "PATCH");
    storedPayload = JSON.parse(options.body);
    return new Response(JSON.stringify([storedPayload]), { status: 200 });
  };
  try {
    const state = await fetchCatalogDiscoveryState(config, "daily-growth");
    assert.equal(state.termCursor, 7);
    assert.equal(state.pageCursor, 3);
    assert.equal(state.lastTerm, "pasta");
    assert.equal(state.termStats.pasta.discoveryYield, 0.3125);
    await saveCatalogDiscoveryState(config, state);
  } finally {
    globalThis.fetch = originalFetch;
  }
  const persistedMetadata = JSON.parse(storedPayload.last_batch);
  assert.equal(persistedMetadata.version, 4);
  assert.deepEqual(persistedMetadata.exhaustedTerms, []);
  assert.equal(persistedMetadata.lastTerm, "pasta");
  assert.equal(persistedMetadata.saturatedUntil.fruit, "2026-09-19T12:00:00.000Z");
});

test("catalogusmodus verschuift pas nabij het indicatieve catalogusdoel", () => {
  assert.equal(catalogGrowthMode(4_999), "discovery");
  assert.equal(catalogGrowthMode(9_499), "discovery");
  assert.equal(catalogGrowthMode(9_500), "balanced");
  assert.equal(catalogGrowthMode(10_000), "maintenance");
});

test("bestaande SKU wordt als ongewijzigd of bijgewerkt geteld en nooit als nieuw", () => {
  const existing = {
    id: "product-1", sku: "123456789", name: "Cola", brand: "Merk", category: "Frisdrank",
    packageText: "1,5 liter", weightGrams: null, imageURL: null,
    sourceURL: "https://www.hoogvliet.com/product/123456789", available: true, productType: "Cola",
  };
  const current = {
    ...testProduct("123456789", "Cola", 2.49), brand: "Merk", category: "Frisdrank",
    packageText: "1,5 liter", weightGrams: null, sourceURL: existing.sourceURL,
    isAvailable: true, productType: "Cola",
  };
  const previousPrice = { price: 2.49, oldPrice: null, isOffer: false, offerText: null, validFrom: null, validUntil: null };
  assert.equal(productChanged(existing, previousPrice, current), false);
  assert.equal(productChanged(existing, previousPrice, { ...current, price: 2.59 }), true);

  const unchanged = classifyCatalogOutcomes({
    products: [current], importedSKUs: new Set([current.sku]),
    existingBySKU: new Map([[existing.sku, existing]]),
    existingPrices: new Map([[existing.id, previousPrice]]),
    stats: { invalidProductsSkipped: 0, productErrors: 0 },
  });
  assert.deepEqual(unchanged, {
    processedCount: 1, newCount: 0, updatedCount: 0, unchangedCount: 1, skippedCount: 0, errorCount: 0,
  });
});

test("nieuwe SKU, partial/failed status en runstatistieken blijven expliciet", () => {
  const product = testProduct("987654321", "Nieuw product", 3.25);
  const result = classifyCatalogOutcomes({
    products: [product], importedSKUs: new Set([product.sku]),
    existingBySKU: new Map(), existingPrices: new Map(),
    stats: { invalidProductsSkipped: 1, productErrors: 1 },
  });
  assert.deepEqual(result, {
    processedCount: 3, newCount: 1, updatedCount: 0, unchangedCount: 0, skippedCount: 1, errorCount: 1,
  });
  assert.equal(importRunStatus({ errorCount: 0, searchErrors: 0 }), "success");
  assert.equal(importRunStatus({ errorCount: 1, searchErrors: 0 }), "partial");
  assert.equal(importRunStatus({
    errorCount: 2, searchErrors: 1, actualGrowth: 400, targetNewProducts: 400,
  }), "success", "niet-kritieke zoekfouten maken behaalde catalogusgroei niet functioneel mislukt");
  assert.equal(importRunStatus({
    errorCount: 0, searchErrors: 0, actualGrowth: 327, targetNewProducts: 400,
  }), "partial");
  assert.match(formatCatalogGrowthSummary({
    ...result, status: "partial", growthStatus: "partial_growth_target_not_reached",
    targetNewProducts: 400, totalUniqueProductsBefore: 10,
    totalUniqueProductsAfter: 11, actualGrowth: 1, candidatesViewed: 1200,
    searchedTerms: 12, searchErrors: 1, stopReason: "discovery_exhausted", durationSeconds: 4.2,
  }), /target_nieuw=400.*verwerkt=3.*nieuw=1.*kandidaten_bekeken=1200.*totaal_voor=10.*totaal_na=11.*werkelijke_groei=1/);
});

test("dagelijkse bewaking accepteert alleen een recente geslaagde schedule-run", () => {
  const now = new Date("2026-09-15T06:30:00Z");
  const baseRun = {
    started_at: "2026-09-15T04:00:00Z",
    finished_at: "2026-09-15T04:22:00Z",
    status: "success",
    trigger: "schedule",
    processed_count: 400,
    new_count: 400,
    total_unique_products_before: 1163,
    total_unique_products_after: 1563,
    error_count: 0,
    error_summary: null,
  };
  assert.deepEqual(
    evaluateCatalogMonitor([baseRun], { now, maxAgeHours: 6 }),
    {
      ok: true, state: "healthy",
      message: "Dagelijkse catalogusgroei geslaagd: 400 nieuwe producten toegevoegd.",
      run: baseRun,
    },
  );
  assert.equal(evaluateCatalogMonitor([
    {
      ...baseRun, status: "partial", new_count: 327, total_unique_products_after: 1490,
      error_summary: "partial_growth_target_not_reached",
    },
  ], { now }).state, "partial_growth_target_not_reached");
  assert.equal(evaluateCatalogMonitor([
    { ...baseRun, status: "success", total_unique_products_after: 1562 },
  ], { now }).state, "partial_growth_target_not_reached", "verwerkt=400 is geen bewijs voor +400 groei");
  assert.equal(evaluateCatalogMonitor([
    { ...baseRun, status: "failed" },
  ], { now }).state, "failed");
  assert.equal(evaluateCatalogMonitor([
    { ...baseRun, status: "running", finished_at: null },
  ], { now }).state, "running");
});

test("dagelijkse bewaking meldt een ontbrekende of te oude ochtendrun", () => {
  const now = new Date("2026-09-15T06:30:00Z");
  assert.equal(evaluateCatalogMonitor([], { now }).state, "missing");
  assert.equal(evaluateCatalogMonitor([{
    started_at: "2026-09-14T04:00:00Z",
    finished_at: "2026-09-14T04:22:00Z",
    status: "success",
  }], { now, maxAgeHours: 6 }).state, "overdue");
});

test("PWA 8.1-migratie is additief, compact en browser read-only", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260915151220_catalog_growth.sql", import.meta.url), "utf8");
  assert.match(migration, /create table if not exists public\.catalog_import_runs/i);
  assert.match(migration, /create table if not exists public\.catalog_discovery_state/i);
  assert.match(migration, /catalog_import_runs_single_running_idx/i);
  assert.match(migration, /grant select on public\.catalog_import_runs to anon, authenticated/i);
  assert.match(migration, /revoke insert, update, delete on public\.catalog_import_runs/i);
  assert.match(migration, /grant select, insert, update on public\.catalog_import_runs to service_role/i);
  assert.match(migration, /grant select, insert, update on public\.catalog_discovery_state to service_role/i);
  assert.match(migration, /products_name_trgm_idx/i);
  assert.doesNotMatch(migration, /drop\s+(table|column)|delete\s+from/i);
});

test("Supabase-migratie voegt alleen de optionele producttype-kolom en index toe", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260908091354_add_product_type.sql", import.meta.url), "utf8");
  assert.match(migration, /add column if not exists product_type text/i);
  assert.match(migration, /products_supermarket_product_type_idx/i);
  assert.doesNotMatch(migration, /drop\s+(table|column)|delete\s+from/i);
});

test('live-observed Hoogvliet pagination metadata distinguishes last page from missing markup', async () => {
  const { searchPaginationEvidence } = await import('../src/hoogvliet.mjs');
  assert.deepEqual(searchPaginationEvidence({ currentPage: 1, totalPages: 2, totalProducts: 31, candidateCount: 16 }),
    { sourceExhausted: false, nextPage: 1, currentPage: 1 });
  assert.equal(searchPaginationEvidence({ currentPage: 2, totalPages: 2, totalProducts: 31, candidateCount: 15 }).sourceExhausted, true);
  assert.equal(searchPaginationEvidence({ totalProducts: 0, candidateCount: 0 }).sourceExhausted, true);
  assert.equal(searchPaginationEvidence({ explicitEmpty: true, candidateCount: 0 }).sourceExhausted, true);
  assert.throws(() => searchPaginationEvidence({ currentPage: null, totalPages: null, totalProducts: null, candidateCount: 0 }), /metadata/);
});

test('discovery reads v3 live checkpoints and round-trips v4 accounting/stalls/maintenance', async t => {
  let row = { state_key: 'fixture', term_cursor: 94, page_cursor: 2, last_batch: JSON.stringify({
    version: 3, scanDate: '2026-09-28', lastTerm: 'fruit', exhaustedTerms: ['groente', 'groenten'],
  }) };
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.method !== 'GET') { assert.equal(options.method, 'PATCH'); row = JSON.parse(options.body); }
    return new Response(JSON.stringify([row]), { status: 200 });
  });
  const settings = { supabaseURL: 'https://fixture.supabase.co', supabaseSecret: 'fixture' };
  const old = await fetchCatalogDiscoveryState(settings, 'fixture');
  assert.equal(old.lastTerm, 'fruit'); assert.equal(old.scanDate, '2026-09-28');
  assert.deepEqual(old.exhaustedTerms, ['groente', 'groenten']);
  const fields = { stalledTerms: [{ term: 'fruit', page: 2, reason: 'repeated_sku_set' }],
    lastAttemptReport: { accounting: { rawPageHits: 9, accounted: 9, balanced: true } },
    plannerMaintenance: { status: 'pending_requires_attention', pendingProductIds: ['fixture-id'] } };
  await saveCatalogDiscoveryState(settings, { ...old, ...fields });
  const restored = await fetchCatalogDiscoveryState(settings, 'fixture');
  for (const key of Object.keys(fields)) assert.deepEqual(restored[key], fields[key]);
});
