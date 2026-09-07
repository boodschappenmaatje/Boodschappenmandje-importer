import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig, limits } from "../src/config.mjs";
import {
  claimCandidateSKU,
  isValidProductURL,
  isValidSKU,
  parseOfferPeriod,
  parsePriceText,
  weightInGrams,
} from "../src/hoogvliet.mjs";
import { formatBatchSummary, formatTermCoverage, safeLogger } from "../src/importer.mjs";
import { requestHeaders, restURL, upsertProducts } from "../src/supabase.mjs";

function testProduct(sku = "123456789", name = "Echt product", price = 5.52) {
  return {
    supermarket: "Hoogvliet", sku, name, brand: null,
    category: null, packageText: "500 gram", weightGrams: 500, imageURL: null,
    sourceURL: `https://www.hoogvliet.com/product/${sku}`, isAvailable: null,
    price, oldPrice: null, isOffer: false, offerText: null,
    validFrom: null, validUntil: null, fetchedAt: "2026-09-06T20:00:00Z",
  };
}

test("MAX_PRODUCTS is configureerbaar met een veilige standaard en bovengrens", () => {
  assert.equal(loadConfig({ DRY_RUN: "1" }).maxProducts, 10);
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "30" }).maxProducts, 30);
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "150" }).maxProducts, 150);
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "999" }).maxProducts, 200);
  assert.equal(limits.defaultMaxProducts, 10);
  assert.equal(limits.safeProductLimit, 200);
});

test("MAX_PER_TERM ondersteunt catalogusdekking maar houdt een harde bovengrens", () => {
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "150" }).maxPerTerm, 2);
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "150", MAX_PER_TERM: "7" }).maxPerTerm, 7);
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "150", MAX_PER_TERM: "999" }).maxPerTerm, 10);
  assert.equal(loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "4", MAX_PER_TERM: "7" }).maxPerTerm, 4);
  assert.equal(limits.safePerTermLimit, 10);
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
      searchedTerms: 2, configuredSearchTerms: 3, candidatesFound: 8,
      uniqueSKUs: 7,
      validatedProducts: 4, duplicateSKUsSkipped: 1, invalidProductsSkipped: 2,
      productErrors: 1, searchErrors: 0, writtenProducts: 4, writeErrors: 0,
      durationMs: 1500,
    })}`);
  } finally {
    console.log = originalLog;
  }
  assert.equal(captured.length, 1);
  assert.doesNotMatch(captured[0], new RegExp(secret));
  assert.match(captured[0], /\[REDACTED\]/);
  assert.match(captured[0], /unieke_SKUs=7/);
  assert.match(captured[0], /overgeslagen=3/);
  assert.match(captured[0], /geschreven=4/);
});

test("catalogusdekking wordt compact per zoekterm gerapporteerd", () => {
  const lines = formatTermCoverage({
    kip: { validated: 3, unique: 4 },
    pasta: { validated: 2, unique: 3 },
    melk: { validated: 3, unique: 3 },
  }, 2);

  assert.equal(lines.length, 2);
  assert.match(lines[0], /kip: 3 gevalideerd\/4 uniek/);
  assert.match(lines[0], /pasta: 2 gevalideerd\/3 uniek/);
  assert.match(lines[1], /melk: 3 gevalideerd\/3 uniek/);
});
