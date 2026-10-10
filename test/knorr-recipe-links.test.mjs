import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { CONFIRMATION, LINKS, runKnorrRecipeLinks } from "../scripts/run-knorr-recipe-links.mjs";

const workflow = readFileSync(new URL("../.github/workflows/knorr-recipe-links.yml", import.meta.url), "utf8");
const envBase = {
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REPOSITORY: "boodschappenmaatje/Boodschappenmandje-importer",
  GITHUB_REF: "refs/heads/main",
  GITHUB_RUN_ATTEMPT: "1",
  KNORR_LINK_MODE: "dry-run",
  KNORR_LINK_CONFIRMATION: "",
  SUPABASE_URL: "https://pjcqxufvbkkjehituzxz.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_fixture_not_real",
  PLANNER_CACHE_BASE_URL: "https://boodschappenmaatje-pwa.vercel.app",
  PLANNER_CACHE_ADMIN_TOKEN: "admin-fixture-not-real",
  VERCEL_AUTOMATION_BYPASS_SECRET: "bypass-fixture-not-real",
};
const response = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});
function fixture(options = {}) {
  const products = LINKS.map((link, index) => ({
    id: "00000000-0000-4000-8000-" + String(index + 1).padStart(12, "0"),
    sku: link.sku, name: "Knorr test mix " + link.sku, brand: "Knorr",
  }));
  const profiles = new Map(products.map(product => [product.id, {
    product_id: product.id, recipe_id: null, status: "needs_review", profile: null, brand: "Knorr",
  }]));
  const calls = [];
  let readinessCount = 0;
  const fetchImpl = async (rawUrl, init) => {
    const url = new URL(rawUrl);
    const method = init.method ?? "GET";
    calls.push({ url, method, body: init.body, headers: init.headers });
    if (url.origin === "https://boodschappenmaatje-pwa.vercel.app") {
      readinessCount += 1;
      if (options.failReadinessAt === readinessCount) return response({ error: "fixture" }, 503);
      const link = LINKS.find(item => item.sku === JSON.parse(init.body).sku);
      const notReady = link.sku === "704892000";
      return response({
        sku: link.sku, recipeId: link.recipeId, profileStatus: "needs_review",
        profilePromoted: false, matchCacheWrites: 0, readinessWrites: 10,
        readiness: Array.from({ length: 10 }, (_, i) => ({
          peopleCount: i + 1, status: notReady ? "NOT_READY" : "READY", problemCount: notReady ? 2 : 0,
        })),
      });
    }
    const table = url.pathname.split("/").pop();
    const skuFilter = url.searchParams.get("sku");
    const productFilter = url.searchParams.get("product_id");
    const idFilter = url.searchParams.get("id");
    if (table === "products") {
      const found = products.filter(row => row.sku === skuFilter?.slice(3));
      if (options.invalidSku === skuFilter?.slice(3)) found[0].brand = "Other";
      return response(found);
    }
    if (table === "recipes") {
      const link = LINKS.find(item => item.recipeId === idFilter?.slice(3));
      return response(link ? [{ id: link.recipeId, name: link.recipeName }] : []);
    }
    if (table === "recipe_ingredients") return response([{ id: "ingredient-row" }]);
    if (table === "ingredient_product_matches") return response([]);
    if (table === "meal_mix_profiles") {
      const productId = productFilter?.startsWith("eq.") ? productFilter.slice(3) : null;
      if (method === "PATCH") {
        if (options.failWriteAt === calls.filter(c => c.method === "PATCH").length) return response([], 200);
        const row = profiles.get(productId);
        row.recipe_id = JSON.parse(init.body).recipe_id;
        return response([row]);
      }
      return response(productId ? [profiles.get(productId)] : []);
    }
    throw new Error("unexpected fixture path");
  };
  return { calls, fetchImpl };
}
const writes = calls => calls.filter(call => call.method === "PATCH");
const posts = calls => calls.filter(call => call.method === "POST");

test("allowlist contains exactly the seven approved pairs and excludes 704881000", () => {
  assert.equal(LINKS.length, 7);
  assert.equal(new Set(LINKS.map(item => item.sku)).size, 7);
  assert.equal(LINKS.some(item => item.sku === "704881000"), false);
  assert.equal(LINKS[0].recipeId, "6593543a-5c8d-409d-8c9e-145632c43f0b");
});

test("workflow is manual-only, main-only, dry-run by default and accepts no free SKU or recipe input", () => {
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+(schedule|push|pull_request):/m);
  assert.match(workflow, /default: dry-run/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /WRITE_EXACT_7_KNORR_RECIPE_LINKS/);
  assert.doesNotMatch(workflow, /^\s+(sku|recipe_id|recipeId):/m);
  assert.match(workflow, /secrets\.PLANNER_CACHE_ADMIN_TOKEN/);
  assert.match(workflow, /secrets\.VERCEL_AUTOMATION_BYPASS_SECRET/);
});

test("dry-run validates all seven and performs no PATCH or POST", async () => {
  const testFixture = fixture();
  const result = await runKnorrRecipeLinks(envBase, { fetchImpl: testFixture.fetchImpl });
  assert.equal(result.status, "dry-run");
  assert.equal(result.precheckValid, 7);
  assert.equal(result.recipeWrites, 0);
  assert.equal(writes(testFixture.calls).length, 0);
  assert.equal(posts(testFixture.calls).length, 0);
});

test("write links only seven profiles and calls the explicit readiness route once per pair", async () => {
  const testFixture = fixture();
  const logs = [];
  const result = await runKnorrRecipeLinks({
    ...envBase, KNORR_LINK_MODE: "write", KNORR_LINK_CONFIRMATION: CONFIRMATION,
  }, { fetchImpl: testFixture.fetchImpl, log: value => logs.push(value) });
  assert.equal(result.recipeWrites, 7);
  assert.equal(result.readinessCalls, 7);
  assert.deepEqual(result.changedSkus, LINKS.map(item => item.sku));
  assert.equal(writes(testFixture.calls).length, 7);
  assert.equal(posts(testFixture.calls).length, 7);
  assert.ok(writes(testFixture.calls).every(call => call.url.pathname === "/rest/v1/meal_mix_profiles"));
  assert.ok(posts(testFixture.calls).every(call => call.url.pathname === "/api/internal/planner-readiness/explicit-recipe-refresh"));
  assert.ok(posts(testFixture.calls).every(call => call.headers.authorization === "Bearer " + envBase.PLANNER_CACHE_ADMIN_TOKEN));
  assert.ok(posts(testFixture.calls).every(call => call.headers["x-vercel-protection-bypass"] === envBase.VERCEL_AUTOMATION_BYPASS_SECRET));
  assert.equal(result.readiness.find(item => item.sku === "704892000").readiness[0].status, "NOT_READY");
  assert.doesNotMatch(logs.join("\n"), /admin-fixture-not-real|bypass-fixture-not-real|sb_secret_fixture_not_real/);
});

test("a failed precheck on one record stops before every write", async () => {
  const testFixture = fixture({ invalidSku: "704888000" });
  await assert.rejects(runKnorrRecipeLinks(envBase, { fetchImpl: testFixture.fetchImpl }), error =>
    error.code === "precheck_rejected" && error.details.some(item => item.sku === "704888000"));
  assert.equal(writes(testFixture.calls).length, 0);
  assert.equal(posts(testFixture.calls).length, 0);
});

test("partial recipe-link write stops before the readiness route and reports the exact changed subset", async () => {
  const testFixture = fixture({ failWriteAt: 3 });
  await assert.rejects(runKnorrRecipeLinks({
    ...envBase, KNORR_LINK_MODE: "write", KNORR_LINK_CONFIRMATION: CONFIRMATION,
  }, { fetchImpl: testFixture.fetchImpl }), error =>
    error.code === "recipe_write_count_or_state_mismatch" &&
    JSON.stringify(error.changedSkus) === JSON.stringify(LINKS.slice(0, 2).map(item => item.sku)));
  assert.equal(writes(testFixture.calls).length, 3);
  assert.equal(posts(testFixture.calls).length, 0);
});

test("readiness failure is not retried and later pairs are not called", async () => {
  const testFixture = fixture({ failReadinessAt: 3 });
  await assert.rejects(runKnorrRecipeLinks({
    ...envBase, KNORR_LINK_MODE: "write", KNORR_LINK_CONFIRMATION: CONFIRMATION,
  }, { fetchImpl: testFixture.fetchImpl }), error =>
    error.code === "readiness_refresh_http_503" && error.changedSkus.length === 7 &&
    error.refreshedSkus.length === 2);
  assert.equal(posts(testFixture.calls).length, 3);
});

test("invalid context, confirmation, or Production origin fails before network access", async () => {
  for (const env of [
    { ...envBase, GITHUB_REF: "refs/heads/topic" },
    { ...envBase, KNORR_LINK_MODE: "write", KNORR_LINK_CONFIRMATION: "wrong" },
    { ...envBase, PLANNER_CACHE_BASE_URL: "https://preview.example" },
  ]) {
    const testFixture = fixture();
    await assert.rejects(runKnorrRecipeLinks(env, { fetchImpl: testFixture.fetchImpl }));
    assert.equal(testFixture.calls.length, 0);
  }
});
