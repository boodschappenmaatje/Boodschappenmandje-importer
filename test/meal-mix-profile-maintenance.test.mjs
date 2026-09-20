import { test } from "node:test";
import assert from "node:assert/strict";
import { parseMealMixSource, matchingExistingMixProfile } from "../apps/web/src/server/meal-mix-source.ts";
import { maintainMealMixProfiles, MEAL_MIX_PARSER_VERSION } from "../src/meal-mix-profile-maintenance.mjs";

const product = { id: "product", sku: "123456789", name: "Honig Basis voor testpasta", brand: "Honig",
  package_text: "41 gram", source_url: "https://www.hoogvliet.com/product/honig-testpasta", category: "Maaltijdmixen" };
const source = (text) => ({ product, title: product.name, text, sourceUrl: product.source_url, fetchedAt: "2026-09-20T12:00:00Z" });

test("a one-piece ingredient does not terminate the explicit shopping list", () => {
  const result = parseMealMixSource(source("Deze verpakking is geschikt voor 4 porties.\nZelf toevoegen\n300 g pasta\n1 grote ui\n2 rode paprika's\n500 ml water\nAlgemene bereidingswijze\n1 Kook de pasta. 20 min"));
  assert.equal(result.status, "verified");
  assert.equal(result.profile.servingsPerPackage, 4);
  assert.deepEqual(result.profile.supplements.map((row) => row.name), ["pasta", "ui", "rode paprika's"]);
});

test("parses parenthesized can contents and does not split that quantity into a new ingredient", () => {
  const result = parseMealMixSource(source("Voor 3 tot 4 personen. Zelf toevoegen: ? 1 blik tomatenblokjes (à 400 g) ? 300 g kipfilet ? OlieVoorbereiding: Verhit 2 el olie. 20 min"));
  assert.equal(result.status, "verified");
  assert.deepEqual(result.profile.supplements.map((row) => [row.name, row.quantity, row.unit]), [["tomatenblokjes", 400, "g"], ["kipfilet", 300, "g"], ["olie", 30, "ml"]]);
});

test("never borrows serving counts or ingredients from a similar branded variant", () => {
  const existing = { productName: "Knorr Wereldgerechten Lasagne", productAliases: ["Knorr Lasagne"], brand: "Knorr", verificationStatus: "verified", servingsPerPackage: 3 };
  assert.equal(matchingExistingMixProfile({ ...product, name: "Knorr Maaltijdmix lasagne" }, [existing]), null);
  assert.equal(parseMealMixSource(source("Zelf toevoegen\n300 g pasta\nAlgemene bereidingswijze"), [existing]).reason, "package_servings_missing");
});

test("fails closed for missing pack contents, missing units and conflicting servings", () => {
  assert.equal(parseMealMixSource(source("voor 4 porties. Zelf toevoegen\n1 klein blikje ananas\nAlgemene bereidingswijze")).status, "needs_review");
  assert.equal(parseMealMixSource(source("voor 4 porties. Zelf toevoegen: Nasi groentepakket (450 g) 125 taugé 3 bosuiVoorbereiding:")).status, "needs_review");
  assert.equal(parseMealMixSource(source("voor 4 porties. voor 3 personen. Zelf toevoegen\n300 g pasta\nAlgemene bereidingswijze")).reason, "servings_conflict");
  assert.equal(parseMealMixSource({ ...source("voor 4 porties"), title: "Ander product" }).reason, "source_identity_mismatch");
});

test("a completed profile with an interrupted cache refresh resumes without fetching or creating duplicates", async () => {
  const calls = [];
  const result = await maintainMealMixProfiles({
    api: async (table, query, options) => {
      calls.push({ table, options });
      return options ? [{ product_id: "p" }] : [{ product_id: "p", recipe_id: "r", status: "verified", cache_status: "pending", parser_version: MEAL_MIX_PARSER_VERSION, updated_at: "before" }];
    },
    readSource: async () => assert.fail("must reuse persisted profile"),
    refreshRecipes: async (ids) => assert.deepEqual(ids, ["r"]),
  });
  assert.equal(result[0].status, "cache_refreshed");
  assert.deepEqual(calls.map((call) => call.table), ["meal_mix_profiles", "meal_mix_profiles"]);
  assert.equal(calls[1].options.body.cache_status, "current");
});

test("new and changed products are processed idempotently and refresh only their recipe", async () => {
  let queue = { product_id: product.id, recipe_id: null, status: "pending", parser_version: 0, cache_status: "pending", updated_at: "initial" };
  let recipe = null;
  let reads = 0;
  const refreshed = [];
  const api = async (table, query, options) => {
    if (table === "products") return [{ ...product, updated_at: "catalog-update" }];
    if (table === "recipes") {
      if (options?.method === "POST") { if (recipe) return []; recipe = { id: "recipe", ...options.body }; }
      return [recipe];
    }
    if (options?.method === "PATCH") {
      if (query.updated_at !== `eq.${queue.updated_at}`) return [];
      queue = { ...queue, ...options.body }; return [queue];
    }
    return queue.status === "pending" || queue.cache_status === "pending" ? [queue] : [];
  };
  const run = () => maintainMealMixProfiles({ api, readSource: async () => { reads++; return source("voor 4 personen. Zelf toevoegen\n300 g spaghetti\nAlgemene bereidingswijze\nKook 20 min"); }, refreshRecipes: async ids => refreshed.push(ids) });
  assert.equal((await run())[0].status, "verified");
  assert.equal(queue.cache_status, "current");
  assert.equal((await run()).length, 0);
  assert.equal(reads, 1);
  queue = { ...queue, status: "pending", cache_status: "pending", updated_at: "changed" };
  await run();
  assert.equal(reads, 2);
  assert.equal(queue.recipe_id, "recipe");
  assert.deepEqual(refreshed, [["recipe"], ["recipe"]]);
});

test("a concurrent catalog change prevents publication of stale source data", async () => {
  let refreshed = false;
  const result = await maintainMealMixProfiles({ api: async (table, query, options) => {
    if (table === "products") return [product];
    if (table === "recipes") return [{ id: "recipe" }];
    return options ? [] : [{ product_id: product.id, status: "pending", updated_at: "old" }];
  }, readSource: async () => source("voor 4 personen. Zelf toevoegen\n300 g pasta\nAlgemene bereidingswijze\n20 min"), refreshRecipes: async () => { refreshed = true; } });
  assert.equal(result[0].status, "changed_during_fetch");
  assert.equal(refreshed, false);
});
