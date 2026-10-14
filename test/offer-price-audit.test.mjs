import assert from "node:assert/strict";
import test from "node:test";
import { auditPriceRows, offerAuditPassed } from "../scripts/audit-offer-prices.mjs";

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

test("offer-audit slaagt zonder vaste Red Bull-prijs zodra 5 live aanbiedingen en alle reguliere goed zijn", () => {
  const passing = {
    redBull: { observed: { isOffer: false, price: 1.72, oldPrice: null } },
    samples: { offersCorrect: { total: 5, correct: 5 }, regularCorrect: { total: 5, correct: 5 } },
    forbiddenRequests: [],
  };
  assert.equal(offerAuditPassed(passing), true);
  assert.equal(offerAuditPassed({ ...passing, samples: { ...passing.samples, offersCorrect: { total: 4, correct: 4 } } }), false);
  assert.equal(offerAuditPassed({ ...passing, samples: { ...passing.samples, regularCorrect: { total: 5, correct: 4 } } }), false);
  assert.equal(offerAuditPassed({ ...passing, samples: { ...passing.samples, regularCorrect: { total: 0, correct: 0 } } }), false);
  assert.equal(offerAuditPassed({ ...passing, forbiddenRequests: [{ sku: "x" }] }), false);
});
