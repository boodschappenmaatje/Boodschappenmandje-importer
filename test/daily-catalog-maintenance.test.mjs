import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  assessDailyCatalogCandidates,
  dailyMaintenanceDecision,
  maintenancePriceChanged,
  runDailyCatalogMaintenance,
} from "../src/daily-catalog-maintenance.mjs";
import { loadConfig } from "../src/config.mjs";
import {
  catalogAPIPriceState,
  chromiumLaunchOptions,
  SourceUnavailableError,
} from "../src/hoogvliet.mjs";

const now = new Date("2026-10-08T08:00:00Z");

function existing(sku = "123456789", id = `id-${sku}`) {
  return {
    id,
    sku,
    name: `Product ${sku}`,
    brand: null,
    category: "Test",
    packageText: "1 stuk",
    weightGrams: null,
    imageURL: "https://example.test/existing.jpg",
    sourceURL: `https://hoogvliet.nl/product/product-${sku}`,
    available: true,
    productType: "Onbekend",
  };
}

function price(product, values = {}) {
  return {
    productID: product.id,
    price: 2.49,
    oldPrice: null,
    isOffer: false,
    offerText: null,
    validFrom: null,
    validUntil: null,
    ...values,
  };
}

function state(values = {}) {
  return {
    price: 2.49,
    oldPrice: null,
    isOffer: false,
    offerText: null,
    validFrom: null,
    validUntil: null,
    sourceState: "normal_price",
    ...values,
  };
}

function candidate(sku = "123456789", priceState = state()) {
  return {
    sku,
    name: `Product ${sku}`,
    packageText: "1 stuk",
    sourceURL: `https://hoogvliet.nl/product/product-${sku}`,
    catalogAPIValidated: true,
    catalogPriceState: priceState,
  };
}

function validatedNew(sku = "987654321", values = {}) {
  return {
    supermarket: "Hoogvliet",
    sku,
    name: `Nieuw ${sku}`,
    brand: null,
    category: "Test",
    packageText: "1 stuk",
    weightGrams: null,
    imageURL: "https://example.test/new.jpg",
    sourceURL: `https://hoogvliet.nl/product/nieuw-${sku}`,
    isAvailable: true,
    productType: "Onbekend",
    price: 1.99,
    oldPrice: null,
    isOffer: false,
    offerText: null,
    validFrom: null,
    validUntil: null,
    fetchedAt: now.toISOString(),
    ...values,
  };
}

async function assess({ candidates, products, prices, fallback = async () => null, limit } = {}) {
  return assessDailyCatalogCandidates({
    candidates,
    existingProducts: products,
    existingPrices: prices,
    validateFallback: fallback,
    maxDetailFallbacks: limit ?? 500,
    now,
    logger: { info() {}, error() {} },
  });
}

test("normale prijs verandert via bulk-GraphQL zonder detailfallback", async () => {
  const product = existing();
  const result = await assess({
    candidates: [candidate(product.sku, state({ price: 2.79 }))],
    products: [product],
    prices: new Map([[product.id, price(product)]]),
  });
  assert.equal(result.productsToWrite[0].price, 2.79);
  assert.equal(result.stats.bulkPriceAssessments, 1);
  assert.equal(result.stats.detailFallbacks, 0);
});

test("aanbieding start dagelijks met actieprijs en normale old_price", async () => {
  const product = existing();
  const offer = state({ price: 1.99, oldPrice: 2.49, isOffer: true, offerText: "Actie",
    validFrom: "2026-10-08", validUntil: "2026-10-14", sourceState: "active_offer" });
  const result = await assess({ candidates: [candidate(product.sku, offer)], products: [product],
    prices: new Map([[product.id, price(product)]]) });
  assert.deepEqual({
    price: result.productsToWrite[0].price,
    oldPrice: result.productsToWrite[0].oldPrice,
    isOffer: result.productsToWrite[0].isOffer,
  }, { price: 1.99, oldPrice: 2.49, isOffer: true });
});

test("lopende aanbieding kan dagelijks wijzigen", () => {
  assert.equal(maintenancePriceChanged(
    { price: 1.99, oldPrice: 2.49, isOffer: true, offerText: "Actie A" },
    { price: 1.79, oldPrice: 2.49, isOffer: true, offerText: "Actie B" },
  ), true);
});

test("aanbieding eindigt bij betrouwbare normale bulkprijs", async () => {
  const product = existing();
  const previous = price(product, { price: 1.99, oldPrice: 2.49, isOffer: true, offerText: "Actie" });
  const result = await assess({ candidates: [candidate(product.sku, state({ price: 2.49 }))], products: [product],
    prices: new Map([[product.id, previous]]) });
  assert.deepEqual({
    price: result.productsToWrite[0].price,
    oldPrice: result.productsToWrite[0].oldPrice,
    isOffer: result.productsToWrite[0].isOffer,
  }, { price: 2.49, oldPrice: null, isOffer: false });
});

test("expliciet verlopen GraphQL-aanbieding normaliseert naar de normale prijs", () => {
  const result = catalogAPIPriceState({
    is_promotion: true,
    promotion_meta_data: { valid_from: "2026-10-01T00:00:00Z", valid_to: "2026-10-07T21:59:00Z" },
    price_range: { minimum_price: { final_price: { value: 1.99 }, regular_price: { value: 2.49 } } },
  }, now);
  assert.deepEqual(result, {
    price: 2.49, oldPrice: null, isOffer: false, offerText: null,
    validFrom: null, validUntil: null, sourceState: "expired_offer",
  });
});

test("onvolledige listing-window snapshot blijft fail-closed en bereikt geen writer of retry", async () => {
  let writes = 0;
  let sourceCalls = 0;
  await assert.rejects(runDailyCatalogMaintenance({ importTrigger: "schedule", maintenanceMaxDetailFallbacks: 500 },
    { info() {}, error() {} }, {
      fetchExistingProducts: async () => [existing()],
      fetchExistingPriceStates: async () => new Map(),
      fetchExistingSKUs: async () => new Set(["123456789"]),
      startCatalogImportRun: async () => ({ id: "run", started_at: now.toISOString() }),
      finishCatalogImportRun: async () => ({}),
      withDailyCatalogSource: async () => {
        sourceCalls += 1;
        throw new SourceUnavailableError("Dagelijkse catalogussnapshot is onvolledig; stopreden=listing_window_limit");
      },
      upsertProducts: async () => { writes += 1; return { imported: [], errors: [], duplicateSKUsSkipped: 0 }; },
    }), /listing_window_limit/);
  assert.equal(writes, 0);
  assert.equal(sourceCalls, 1);
});

test("handmatige maintenance-dry-run beoordeelt dezelfde volledige flow zonder run- of datawrites", async () => {
  const current = existing();
  const freshSKU = "987654321";
  const logs = [];
  const forbidden = async () => { throw new Error("dry-run writer aangeroepen"); };
  const result = await runDailyCatalogMaintenance({
    dryRun: true,
    importTrigger: "manual",
    maintenanceMaxDetailFallbacks: 500,
  }, { info: value => logs.push(value), error() {} }, {
    fetchExistingProducts: async () => [current],
    fetchExistingPriceStates: async () => new Map([[current.id, price(current)]]),
    fetchExistingSKUs: forbidden,
    startCatalogImportRun: forbidden,
    finishCatalogImportRun: forbidden,
    upsertProducts: forbidden,
    withDailyCatalogSource: async (_config, handler) => handler({
      candidates: [
        candidate(current.sku, state({ price: 2.79 })),
        candidate(freshSKU, null),
      ],
      snapshot: {
        pagesFetched: 2,
        primaryListingWindows: 2,
        catalogAPICalls: 2,
        sourceExhausted: true,
        stallReason: null,
        fallbackAccounting: {
          fallbackAttempts: 1,
          fallbackSuccesses: 1,
          fallbackFailures: 0,
          fallbackProvider: "zyte",
        },
      },
      validateFallback: async item => item.sku === freshSKU ? validatedNew(freshSKU) : null,
    }),
  });
  assert.equal(result.status, "dry-run");
  assert.equal(result.dryRun, true);
  assert.equal(result.newCount, 0);
  assert.equal(result.updatedCount, 0);
  assert.equal(result.wouldInsertCount, 1);
  assert.equal(result.wouldUpdateCount, 1);
  assert.equal(result.totalUniqueProductsAfter, result.totalUniqueProductsBefore);
  assert.match(logs.at(-1), /primary_listing_windows=2/);
  assert.match(logs.at(-1), /fallback_attempts=1/);
  assert.match(logs.at(-1), /fallback_successes=1/);
  assert.match(logs.at(-1), /snapshot_complete=true/);
});

test("iedere onbruikbare of begrensde fallbackuitkomst blijft vóór de writer", async () => {
  const reasons = [
    "listing_unusable",
    "timeout",
    "api_error",
    "invalid_final_response_url",
    "listing_identity_mismatch",
    "request_limit_reached",
  ];
  for (const reason of reasons) {
    let writes = 0;
    await assert.rejects(runDailyCatalogMaintenance({
      importTrigger: "schedule",
      maintenanceMaxDetailFallbacks: 500,
    }, { info() {}, error() {} }, {
      fetchExistingProducts: async () => [existing()],
      fetchExistingPriceStates: async () => new Map(),
      fetchExistingSKUs: async () => new Set(["123456789"]),
      startCatalogImportRun: async () => ({ id: "run", started_at: now.toISOString() }),
      finishCatalogImportRun: async () => ({}),
      withDailyCatalogSource: async () => {
        throw new SourceUnavailableError(`Zyte-listingfallback faalde: ${reason}`);
      },
      upsertProducts: async () => {
        writes += 1;
        return { imported: [], errors: [], duplicateSKUsSkipped: 0 };
      },
    }), new RegExp(reason));
    assert.equal(writes, 0, reason);
  }
});

test("null en nulprijs overschrijven geen bestaande geldige prijs", async () => {
  const product = existing();
  for (const invalid of [null, state({ price: 0 })]) {
    const result = await assess({ candidates: [candidate(product.sku, invalid)], products: [product],
      prices: new Map([[product.id, price(product)]]), fallback: async () => null });
    assert.equal(result.productsToWrite.length, 0);
    assert.equal(result.stats.unresolvedExistingPrices, 1);
  }
});

test("nieuwe SKU gebruikt exacte bestaande detailvalidator en wordt eenmaal gepland", async () => {
  const sku = "987654321";
  const result = await assess({ candidates: [candidate(sku)], products: [], prices: new Map(),
    fallback: async () => validatedNew(sku) });
  assert.equal(result.productsToWrite.length, 1);
  assert.equal(result.productsToWrite[0].sku, sku);
  assert.equal(result.productsToWrite[0].imageURL, undefined);
  assert.equal(result.stats.newSKUsDetected, 1);
});

test("verdwenen SKU blijft bestaan en krijgt geen delete- of prijswrite", async () => {
  const product = existing();
  const result = await assess({ candidates: [], products: [product], prices: new Map([[product.id, price(product)]]) });
  assert.equal(result.productsToWrite.length, 0);
  assert.equal(result.stats.productionOnlyOrMissingSKUs, 1);
});

test("Production-only SKU blijft buiten automatische mutaties", async () => {
  const live = existing("111111111");
  const productionOnly = existing("222222222");
  const result = await assess({ candidates: [candidate(live.sku)], products: [live, productionOnly],
    prices: new Map([[live.id, price(live)], [productionOnly.id, price(productionOnly)]]) });
  assert.equal(result.productsToWrite.length, 0);
  assert.equal(result.stats.productionOnlyOrMissingSKUs, 1);
});

test("dubbele listing-SKU wordt eenmaal verwerkt en kan geen productduplicaat maken", async () => {
  const product = existing();
  const changed = candidate(product.sku, state({ price: 2.79 }));
  const result = await assess({ candidates: [changed, { ...changed }], products: [product],
    prices: new Map([[product.id, price(product)]]) });
  assert.equal(result.productsToWrite.length, 1);
  assert.equal(result.stats.duplicateCandidates, 1);
});

test("lokale performanceproof beoordeelt 8355 bestaande SKU's zonder shard, max-400 of detailcrawl", async () => {
  const products = Array.from({ length: 8_355 }, (_, index) => existing(String(index).padStart(9, "0")));
  const candidates = products.map(product => candidate(product.sku));
  const prices = new Map(products.map(product => [product.id, price(product)]));
  let fallbacks = 0;
  const result = await assess({ candidates, products, prices, fallback: async () => { fallbacks += 1; return null; } });
  assert.equal(result.stats.currentCatalogSKUs, 8_355);
  assert.equal(result.stats.bulkPriceAssessments, 8_355);
  assert.equal(result.stats.detailFallbacks, 0);
  assert.equal(result.stats.unchangedExistingPrices, 8_355);
  assert.equal(result.productsToWrite.length, 0);
  assert.equal(fallbacks, 0);
});

test("watchdog gebruikt dagelijkse runstatus zonder 400-doel", () => {
  assert.deepEqual(dailyMaintenanceDecision([], now), { runAttempt: true, reason: "daily_maintenance_missing" });
  assert.equal(dailyMaintenanceDecision([{ started_at: now.toISOString(), status: "success" }], now).runAttempt, false);
  assert.equal(dailyMaintenanceDecision([{ started_at: now.toISOString(), status: "partial" }], now).runAttempt, true);
});

test("maintenanceconfig heeft volledige listingdekking en alleen een detail-safetycap", () => {
  const config = loadConfig({
    DRY_RUN: "1",
    UPDATE_MODE: "maintenance",
    CATALOG_BATCH: "growth",
    CHROME_PATH: "/usr/bin/google-chrome",
  });
  assert.equal(config.maintenanceMaxListingWindows, 800);
  assert.equal(config.maintenanceMaxDetailFallbacks, 500);
  assert.equal(config.chromePath, "/usr/bin/google-chrome");
  assert.deepEqual(chromiumLaunchOptions(config), {
    headless: true,
    executablePath: "/usr/bin/google-chrome",
  });
  assert.deepEqual(config.searchTerms, ["catalog:root"]);
});

test("maintenancecode raakt geen gebruikers-, recept- of readinessdata en bevat geen deletepad", async () => {
  const source = await readFile(new URL("../src/daily-catalog-maintenance.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /recipe|ingredient_product_matches|readiness|user_|auth\.|method:\s*["']DELETE|delete\s+from/i);
  assert.match(source, /fetchExistingProducts/);
  assert.match(source, /fetchExistingPriceStates/);
  assert.match(source, /upsertProducts/);
});
