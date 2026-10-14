import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mealMixCorroborationFor } from "../src/meal-mix-reviewed-evidence.mjs";
import { parseMealMixSource, matchingExistingMixProfile, mealMixPreparationFingerprint } from "../apps/web/src/server/meal-mix-source.ts";
import { maintainMealMixProfiles, profileRecipeRow, refreshStaleMealMixCaches, MEAL_MIX_PARSER_VERSION } from "../src/meal-mix-profile-maintenance.mjs";

const product = { id: "product", sku: "123456789", name: "Honig Basis voor testpasta", brand: "Honig",
  package_text: "41 gram", source_url: "https://www.hoogvliet.com/product/honig-testpasta", category: "Maaltijdmixen" };
const source = (text) => ({ product, title: product.name, text, sourceUrl: product.source_url, fetchedAt: "2026-09-20T12:00:00Z" });

test("the four completed profiles use exact SKU/pack/source evidence, including the two-sachet omelette", () => {
  const sources = JSON.parse(readFileSync(new URL('./fixtures/meal-mix-completion-sources.json', import.meta.url)));
  sources.push(JSON.parse(readFileSync(new URL('./fixtures/wrap-completion-source.json', import.meta.url))));
  for (const snapshot of sources) {
    const evidence = mealMixCorroborationFor(snapshot.product);
    const parsed = parseMealMixSource(snapshot, [], evidence);
    assert.equal(parsed.status, 'verified', snapshot.product.name);
    assert.ok(parsed.profile.supplements.length >= 5);
    assert.equal(mealMixCorroborationFor({...snapshot.product, package_text:'999 gram'}), undefined);
    assert.equal(parseMealMixSource({...snapshot,text:snapshot.text.replace('Bereidingswijze:','Bereidingswijze: gewijzigde receptuur')},[],evidence).status,'needs_review');
    if(snapshot.product.sku==='665854000') {
      assert.equal(parsed.profile.servingsPerPackage,8);
      assert.equal(parsed.profile.supplementServings,4);
      assert.equal(parsed.profile.supplements.find(i=>i.name==='eieren').quantity,6);
    }
    if(snapshot.product.sku==='070523000') assert.equal(parsed.profile.supplements.find(i=>i.name==='kipfilet').quantity,300);
  }
});

test("supplement aliases retain the exact vegetable and classify ham without misclassifying mushrooms", () => {
  const result = parseMealMixSource(source("Voor 4 personen. Zelf toevoegen\n125 g achterham\n250 g champignons\n250 g cherrytomaten\n200 g doperwten\nAlgemene bereidingswijze\n20 min"));
  assert.equal(result.status, "verified");
  assert.deepEqual(result.profile.supplements.map(item => item.category), ["Vlees", "Groente", "Groente", "Groente"]);
  assert.ok(result.profile.supplements[2].aliases.includes("cherry tomaten"));
  assert.ok(result.profile.supplements[3].aliases.includes("doperwtjes"));
});

test("reviewed serving evidence cannot be reused after pack or preparation changes", () => {
  const original=source("Gebruiksaanwijzing Zelf toevoegen\n300 g pasta\nAlgemene bereidingswijze\n20 min");
  const evidence={preparationFingerprint:mealMixPreparationFingerprint(original),servings:4,sourceUrl:"https://www.ah.nl/producten/product/exact",evidence:"Aantal porties: 4"};
  assert.equal(parseMealMixSource(original,[],evidence).status,"verified");
  assert.equal(parseMealMixSource({...original,product:{...product,package_text:"82 gram"}},[],evidence).reason,"corroboration_source_changed");
  assert.equal(parseMealMixSource({...original,text:original.text.replace("300 g","200 g")},[],evidence).reason,"corroboration_source_changed");
});

test("water-only meals need explicit exact-source evidence, never an empty inferred list", () => {
  const original=source("Voor 2 personen. Gebruiksaanwijzing Kook de zak met 500 ml water. 12 min");
  assert.equal(parseMealMixSource(original).status,"needs_review");
  const evidence={preparationFingerprint:mealMixPreparationFingerprint(original),sourceUrl:product.source_url,evidence:"Alleen water",supplementList:"500 ml water",waterOnly:true};
  const parsed=parseMealMixSource(original,[],evidence);
  assert.equal(parsed.status,"verified");
  assert.deepEqual(parsed.profile.supplements,[]);
  assert.equal(parsed.profile.waterOnly,true);
});

test("separates trailing oil and cooking labels and retains declared quantities", () => {
  const parsed=parseMealMixSource(source("Aantal porties: 4. Zelf toevoegen: 250 g rijst OlieVoorbereiding: Verhit 2 el olie. 20 min"));
  assert.equal(parsed.status,"verified");
  assert.deepEqual(parsed.profile.supplements.map(r=>[r.name,r.quantity,r.unit]),[["rijst",250,"g"],["olie",30,"ml"]]);
  const canned=parseMealMixSource(source("Voor 4 personen. Zelf toevoegen\n2 blik tomatenblokjes (à 400 g)\nAlgemene bereidingswijze"));
  assert.equal(canned.profile.supplements[0].quantity,800);
});

test("daily cache renewal reuses verified source profiles even when cache_status was current", async () => {
  let fetches=0; const refreshed=[];
  const results=await maintainMealMixProfiles({ api:async(table,query,options)=>options?[]:[{product_id:"p",recipe_id:"r",status:"verified",cache_status:"current",parser_version:MEAL_MIX_PARSER_VERSION,updated_at:"2026-09-20T00:00:00Z"}],readSource:async()=>{fetches++;},refreshRecipes:async ids=>refreshed.push(ids),now:new Date("2026-09-21T06:45:00Z") });
  assert.equal(fetches,0);assert.deepEqual(refreshed,[["r"]]);assert.equal(results[0].status,"cache_refreshed");
});

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

test("parses the exact comma-separated Knorr Chinese Beef Shanghai source and totals its declared oil", () => {
  const snapshot = JSON.parse(readFileSync(new URL('./fixtures/knorr-chinese-beef-shanghai-source.json', import.meta.url)));
  const parsed = parseMealMixSource({ ...snapshot, sourceUrl: snapshot.sourceUrl, fetchedAt: snapshot.capturedAt });
  assert.equal(parsed.status, "verified", parsed.reason);
  assert.equal(parsed.fingerprint.length, 64);
  assert.equal(parsed.profile.servingsPerPackage, 3);
  const recipe = profileRecipeRow(parsed.profile, snapshot);
  assert.equal(recipe.source_key, "catalog-mix-231215000");
  assert.equal(recipe.preparation_minutes, 40);
  assert.equal(recipe.vegetarian, false);
  assert.deepEqual(parsed.profile.supplements.map(({ name, quantity, unit }) => [name, quantity, unit]), [
    ["mager rundergehakt", 225, "g"],
    ["champignons", 250, "g"],
    ["taugé", 125, "g"],
    ["bosui", 3, "piece"],
    ["ui", 1, "piece"],
    ["prei", 1, "piece"],
    ["olie", 30, "ml"],
  ]);
  const expandedPage = { ...snapshot, text: `Nog zelf toevoegen: 350 g rundergehakt, 1 prei, 100 g taugé, olie\nGebruiksaanwijzing ${snapshot.text}` };
  const fromExpandedPage = parseMealMixSource(expandedPage);
  assert.equal(fromExpandedPage.status, "verified", fromExpandedPage.reason);
  assert.deepEqual(fromExpandedPage.profile.supplements.map(({ name, quantity, unit }) => [name, quantity, unit]),
    parsed.profile.supplements.map(({ name, quantity, unit }) => [name, quantity, unit]));
    const otherSku = { ...snapshot, product: { ...snapshot.product, sku: "231215001" } };
  assert.equal(parseMealMixSource(otherSku).reason, "supplement_ambiguous:225 g mager rundergehakt 250 g champignons 125 g tauge 3 bosuien 1 ui 1 prei olie");
});

test("accepts only the exact SKU-specific Shanghai Hoogvliet redirect route", () => {
  const snapshot = JSON.parse(readFileSync(new URL('./fixtures/knorr-chinese-beef-shanghai-source.json', import.meta.url)));
  const finalUrl = "https://hoogvliet.nl/product/knorr-wereldgerecht-maaltijdpakket-chinese-beef-shanghai-231215000";
  const redirected = parseMealMixSource({ ...snapshot, sourceUrl: finalUrl });
  assert.equal(redirected.status, "verified", redirected.reason);
  assert.equal(redirected.profile.sourceUrl, finalUrl);

  const otherSku = { ...snapshot, sourceUrl: finalUrl, product: { ...snapshot.product, sku: "231215001" } };
  assert.equal(parseMealMixSource(otherSku).reason, "source_identity_mismatch");
  assert.equal(parseMealMixSource({ ...snapshot, sourceUrl: finalUrl.replace("hoogvliet.nl", "www.hoogvliet.nl") }).reason,
    "source_identity_mismatch");
  assert.equal(parseMealMixSource({ ...snapshot, sourceUrl: finalUrl.replace("-231215000", "-231215001") }).reason,
    "source_identity_mismatch");
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

test("preserves explicitly declared frozen form without inventing package contents", () => {
  const parsed = parseMealMixSource(source("voor 4 porties. Zelf toevoegen\n200 g spinazie (diepvries)\nAlgemene bereidingswijze\n20 min"));
  assert.equal(parsed.status, "verified");
  assert.deepEqual(parsed.profile.supplements.map(({ name, quantity, unit }) => ({ name, quantity, unit })),
    [{ name: "spinazie diepvries", quantity: 200, unit: "g" }]);
  assert.equal(parseMealMixSource(source("voor 4 porties. Zelf toevoegen\n1 blikje spinazie (diepvries)\nAlgemene bereidingswijze")).status, "needs_review");
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

test("price invalidation and expiry refresh only affected verified profiles without source/product writes", async () => {
  const now = new Date("2026-09-21T10:00:00Z");
  const profiles = ["untouched", "pending", "expired", "missing"].map((id) => ({ product_id: id, recipe_id: id, updated_at: "snapshot" }));
  const rows = profiles.flatMap(({ recipe_id }) => Array.from({ length: 10 }, (_, n) => ({
    recipe_id, people_count: n + 1, refresh_status: recipe_id === "pending" && n === 3 ? "pending" : "current",
    invalidated_at: recipe_id === "pending" && n === 3 ? now.toISOString() : null,
    expires_at: recipe_id === "expired" ? "2026-09-20T10:00:00Z" : "2026-09-22T10:00:00Z",
  }))).filter((row) => row.recipe_id !== "missing" || row.people_count !== 10);
  const writes = [];
  const refreshed = [];
  const api = async (table, query, options) => {
    if (options) {
      assert.equal(table, "meal_mix_profiles");
      assert.equal(query.updated_at, "eq.snapshot");
      writes.push(query.product_id);
      return [{}];
    }
    if (table === "meal_mix_profiles") { assert.equal(query.status, "eq.verified"); return profiles; }
    assert.equal(table, "recipe_readiness_cache");
    return rows;
  };
  const refreshRecipes = async ([id]) => {
    refreshed.push(id);
    for (let people = 1; people <= 10; people++) {
      let row = rows.find((r) => r.recipe_id === id && r.people_count === people);
      if (!row) { row = { recipe_id: id, people_count: people }; rows.push(row); }
      Object.assign(row, { refresh_status: "current", invalidated_at: null, expires_at: "2026-09-22T10:00:00Z" });
    }
  };
  assert.deepEqual(await refreshStaleMealMixCaches({ api, refreshRecipes, now, limit: 2 }), ["pending", "expired"]);
  assert.deepEqual(await refreshStaleMealMixCaches({ api, refreshRecipes, now }), ["missing"]);
  assert.deepEqual(await refreshStaleMealMixCaches({ api, refreshRecipes, now }), []);
  assert.deepEqual(refreshed, ["pending", "expired", "missing"]);
  assert.equal(writes.length, 3);
});

const rejectedRefresh = () => Object.assign(new Error("meal-mix-cache-refresh"),
  { stage: "meal-mix-cache-refresh", status: 503, code: "cache-refresh-failed" });

test("geweigerde cachevernieuwing stopt de wachtrij niet en laat de cache 'pending'", async () => {
  const patches = [];
  const queue = [
    { product_id: "a", recipe_id: "ra", status: "verified", cache_status: "pending", parser_version: MEAL_MIX_PARSER_VERSION, updated_at: "t" },
    { product_id: "b", recipe_id: "rb", status: "verified", cache_status: "pending", parser_version: MEAL_MIX_PARSER_VERSION, updated_at: "t" },
  ];
  const results = await maintainMealMixProfiles({
    api: async (table, query, options) => { if (options) { patches.push(query.product_id); return [{}]; } return queue; },
    readSource: async () => assert.fail("must not fetch"),
    refreshRecipes: async ([id]) => { if (id === "ra") throw rejectedRefresh(); },
  });
  assert.deepEqual(results.map((row) => row.status), ["cache_refresh_rejected", "cache_refreshed"]);
  assert.deepEqual(patches, ["eq.b"]);
});

test("nieuw profiel wordt opgeslagen ook als de cache geweigerd wordt; andere fouten blijven fataal", async () => {
  let queue = { product_id: product.id, recipe_id: null, status: "pending", parser_version: 0, cache_status: "pending", updated_at: "initial" };
  const api = async (table, query, options) => {
    if (table === "products") return [{ ...product, updated_at: "catalog-update" }];
    if (table === "recipes") return [{ id: "recipe" }];
    if (options?.method === "PATCH") {
      if (query.updated_at !== `eq.${queue.updated_at}`) return [];
      queue = { ...queue, ...options.body }; return [queue];
    }
    return [queue];
  };
  const readSource = async () => source("voor 4 personen. Zelf toevoegen\n300 g spaghetti\nAlgemene bereidingswijze\nKook 20 min");
  const [result] = await maintainMealMixProfiles({ api, readSource, refreshRecipes: async () => { throw rejectedRefresh(); } });
  assert.equal(result.status, "verified");
  assert.equal(result.cacheRefresh, "rejected");
  assert.equal(queue.status, "verified");
  assert.equal(queue.cache_status, "pending");

  queue = { ...queue, status: "pending", updated_at: "again" };
  const unauthorized = Object.assign(new Error("meal-mix-cache-refresh"), { stage: "meal-mix-cache-refresh", status: 401, code: "unauthorized" });
  await assert.rejects(maintainMealMixProfiles({ api, readSource, refreshRecipes: async () => { throw unauthorized; } }), /meal-mix-cache-refresh/);
});

test("verlopen caches: geweigerde recepten worden overgeslagen en gerapporteerd", async () => {
  const profiles = ["x", "y"].map((id) => ({ product_id: id, recipe_id: id, updated_at: "s" }));
  const rejected = [];
  const patched = [];
  const refreshed = await refreshStaleMealMixCaches({
    api: async (table, query, options) => {
      if (options) { patched.push(query.product_id); return [{}]; }
      return table === "meal_mix_profiles" ? profiles : [];
    },
    refreshRecipes: async ([id]) => { if (id === "x") throw rejectedRefresh(); },
    rejected,
  });
  assert.deepEqual(refreshed, ["y"]);
  assert.deepEqual(rejected, ["x"]);
  assert.deepEqual(patched, ["eq.y"]);
});
