import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { catalogBatches, loadConfig, limits } from "../src/config.mjs";
import {
  classifyProductType, productTypeCoverage, UNKNOWN_PRODUCT_TYPE,
} from "../src/product-type.mjs";
import {
  collectCandidatePages,
  catalogLimitReached,
  claimCandidateSKU,
  isRelevantCandidate,
  isValidProductURL,
  isValidSKU,
  parseOfferPeriod,
  parsePriceText,
  prioritizeCandidates,
  recordCatalogProduct,
  searchURL,
  selectPriceShard,
  weightInGrams,
} from "../src/hoogvliet.mjs";
import {
  formatBatchSummary, formatClassificationSummary, formatPriceRefreshSummary, formatTermCoverage, safeLogger,
} from "../src/importer.mjs";
import {
  fetchExistingProducts, fetchExistingSKUs, hasProductTypeColumn, requestHeaders, restURL,
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
  assert.equal(limits.safeNewProductLimit, 300);
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
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.repeatedPageStopped, true);
  assert.equal(result.candidates.length, 1);
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
  assert.equal(JSON.parse(requests[0].options.body)[0].brand, undefined);
  assert.equal(JSON.parse(requests[0].options.body)[0].product_type, "Gehakt");
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
  assert.match(captured[0], /nieuwe_SKUs=5/);
  assert.match(captured[0], /bestaande_SKUs=2/);
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

test("bestaande productbronmetadata wordt zonder cacheprijs voor prijsvalidatie gelezen", async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), options };
    return new Response(JSON.stringify([{
      sku: "123456789", name: "Bestaand product", brand: "Merk", category: "Categorie",
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
    sku: "123456789", name: "Bestaand product", brand: "Merk", category: "Categorie",
    packageText: "500 gram", weightGrams: null, imageURL: "https://voorbeeld.nl/product.jpg",
    sourceURL: "https://www.hoogvliet.com/product/bestaand-product", available: true,
    productType: null,
  });
  assert.match(request.url, /select=sku%2Cname%2Cbrand%2Ccategory%2Cpackage_text/);
  assert.doesNotMatch(request.url, /product_prices/);
});

test("prijsupdate-statistieken zijn compact en bevatten geen credentials", () => {
  const summary = formatPriceRefreshSummary({
    priceShardIndex: 2, priceShardCount: 7, selectedProducts: 65,
    validatedProducts: 64, invalidProductsSkipped: 1, productErrors: 0,
    writtenProducts: 64, writeErrors: 0, durationMs: 125_000,
  });
  assert.match(summary, /deelbatch=3\/7/);
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
  assert.match(workflow, /group: hoogvliet-supabase-update/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /SUPABASE_URL: \$\{\{ secrets\.SUPABASE_URL \}\}/);
  assert.match(workflow, /SUPABASE_SECRET_KEY: \$\{\{ secrets\.SUPABASE_SECRET_KEY \}\}/);
  assert.match(workflow, /MAX_PER_TERM=20/);
  assert.match(workflow, /MAX_PAGES_PER_TERM=4/);
  assert.match(workflow, /CATALOG_NEW_ONLY=1/);
  assert.match(workflow, /- classify/);
  assert.doesNotMatch(workflow, /continue-on-error:\s*true/);
});

test("Supabase-migratie voegt alleen de optionele producttype-kolom en index toe", async () => {
  const migration = await readFile(new URL("../supabase/migrations/20260908_add_product_type.sql", import.meta.url), "utf8");
  assert.match(migration, /add column if not exists product_type text/i);
  assert.match(migration, /products_supermarket_product_type_idx/i);
  assert.doesNotMatch(migration, /drop\s+(table|column)|delete\s+from/i);
});
