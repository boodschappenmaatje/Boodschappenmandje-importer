import assert from "node:assert/strict";
import test from "node:test";
import { auditPriceRows } from "../scripts/audit-offer-prices.mjs";

test("prijs-audit onderscheidt aanbiedingen en verdachte vergelijkingprijzen", () => {
  const result = auditPriceRows([
    { price: 1.39, old_price: 1.72, is_offer: true },
    { price: 2.49, old_price: null, is_offer: false },
    { price: 1.99, old_price: 2.49, is_offer: false },
    { price: 0, old_price: null, is_offer: false },
    { price: 1.99, old_price: 1.99, is_offer: true },
  ]);
  assert.deepEqual(result, {
    total: 5,
    isOfferTrue: 2,
    priceBelowOldPrice: 2,
    suspiciousOldPriceWithoutOffer: 1,
    offersWithoutValidOldPrice: 1,
    invalidPrices: 1,
  });
});
