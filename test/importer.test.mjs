import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig, limits } from "../src/config.mjs";
import { isValidProductURL, isValidSKU, parseOfferPeriod, parsePriceText, weightInGrams } from "../src/hoogvliet.mjs";
import { upsertProducts } from "../src/supabase.mjs";

test("de proof of concept kan nooit meer dan 10 producten importeren", () => {
  const config = loadConfig({ DRY_RUN: "1", MAX_PRODUCTS: "999" });
  assert.equal(config.maxProducts, 10);
  assert.equal(limits.absoluteProductLimit, 10);
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
    const product = {
      supermarket: "Hoogvliet", sku: "123456789", name: "Echt product", brand: null,
      category: null, packageText: "500 gram", weightGrams: 500, imageURL: null,
      sourceURL: "https://www.hoogvliet.com/product/echt-product", isAvailable: null,
      price: 5.52, oldPrice: null, isOffer: false, offerText: null,
      validFrom: null, validUntil: null, fetchedAt: "2026-09-06T20:00:00Z",
    };
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
  assert.equal(requests[0].options.headers.Authorization, undefined);
  assert.equal(JSON.parse(requests[0].options.body)[0].brand, undefined);
});
