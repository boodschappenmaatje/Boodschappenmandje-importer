import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  CONFIRMATION, LINKS, READINESS_PATH, runKnorrRecipeLinks, runKnorrRecipeLinksCli,
} from "../scripts/run-knorr-recipe-links.mjs";

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
  let preflightCount = 0;
  const fetchImpl = async (rawUrl, init) => {
    const url = new URL(rawUrl);
    const method = init.method ?? "GET";
    calls.push({ url, method, body: init.body, headers: init.headers });
    if (url.origin === "https://boodschappenmaatje-pwa.vercel.app") {
      const payload = JSON.parse(init.body);
      if (payload.preflight === true) {
        preflightCount += 1;
        if (options.preflightException) throw options.preflightException;
        if (options.preflightError) throw new Error("fixture network failure");
        if (options.preflightStatus) return response({ error: "fixture" }, options.preflightStatus);
        const link = LINKS[0];
        const body = {
          sku: link.sku, recipeId: link.recipeId, profileStatus: "needs_review",
          profilePromoted: false, matchCacheWrites: 0, readinessWrites: 0, evaluationMode: "preflight",
          readiness: [{ peopleCount: 4, status: "READY", problemCount: 0 }],
        };
        if (options.preflightWrongResponse) body.readinessWrites = 1;
        const result = response(body);
        if (options.preflightBodyException) result.json = async () => { throw options.preflightBodyException; };
        return result;
      }
      readinessCount += 1;
      if (options.failReadinessAt === readinessCount) return response({ error: "fixture" }, 503);
      const link = LINKS.find(item => item.sku === payload.sku);
      const notReady = link.sku === "704892000";
      return response({
        sku: link.sku, recipeId: link.recipeId, profileStatus: "needs_review",
        profilePromoted: false, matchCacheWrites: 0, readinessWrites: 10, evaluationMode: "full",
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
const posts = calls => calls.filter(call => call.method === "POST" && JSON.parse(call.body).preflight !== true);
const preflights = calls => calls.filter(call => call.method === "POST" && JSON.parse(call.body).preflight === true);

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
  assert.match(workflow, /node scripts\/run-knorr-recipe-links\.mjs/);
});

test("dry-run requires a successful authenticated Production preflight, validates all seven, and writes nothing", async () => {
  const testFixture = fixture();
  const result = await runKnorrRecipeLinks(envBase, { fetchImpl: testFixture.fetchImpl });
  assert.equal(result.status, "dry-run");
  assert.deepEqual(result.productionPreflight, {
    route: READINESS_PATH, authAccepted: true, explicitRecipeReadiness: true, evaluationMode: "preflight",
    readinessRows: 1, readinessWrites: 0, matchCacheWrites: 0,
  });
  assert.equal(result.precheckValid, 7);
  assert.equal(result.recipeWrites, 0);
  assert.equal(preflights(testFixture.calls).length, 1);
  assert.equal(preflights(testFixture.calls)[0].headers.authorization, "Bearer " + envBase.PLANNER_CACHE_ADMIN_TOKEN);
  assert.equal(preflights(testFixture.calls)[0].headers["x-vercel-protection-bypass"], envBase.VERCEL_AUTOMATION_BYPASS_SECRET);
  assert.equal(writes(testFixture.calls).length, 0);
  assert.equal(posts(testFixture.calls).length, 0);
});

test("successful dry-run prints one structured terminal result with zero database writes", async () => {
  const testFixture = fixture();
  const stdout = [];
  const stderr = [];
  const result = await runKnorrRecipeLinksCli(envBase, {
    fetchImpl: testFixture.fetchImpl,
    stdout: value => stdout.push(value),
    stderr: value => stderr.push(value),
  });
  assert.equal(stdout.length, 1);
  assert.equal(stderr.length, 0);
  assert.deepEqual(JSON.parse(stdout[0]), result);
  assert.deepEqual(result, {
    status: "dry-run",
    evaluationMode: "preflight",
    candidatesChecked: 7,
    validLinks: 7,
    writes: { recipeIds: 0, readinessCache: 0, ingredientMatchCache: 0, total: 0 },
    stopReason: null,
  });
  assert.doesNotMatch(stdout[0], /admin-fixture-not-real|bypass-fixture-not-real|sb_secret_fixture_not_real/);
  assert.equal(writes(testFixture.calls).length, 0);
  assert.equal(posts(testFixture.calls).length, 0);
});

test("missing runner result is reported as stopped and cannot exit successfully", async () => {
  const stdout = [];
  const stderr = [];
  await assert.rejects(runKnorrRecipeLinksCli(envBase, {
    runImpl: async () => undefined,
    stdout: value => stdout.push(value),
    stderr: value => stderr.push(value),
  }), error => error.code === "runner_result_missing_or_invalid");
  assert.equal(stdout.length, 0);
  assert.equal(stderr.length, 1);
  const output = JSON.parse(stderr[0]);
  assert.equal(output.status, "stopped");
  assert.equal(output.stopReason, "runner_result_missing_or_invalid");
});

test("invalid preflight result is printed as stopped and never reported as success", async () => {
  const testFixture = fixture({ preflightWrongResponse: true });
  const stdout = [];
  const stderr = [];
  await assert.rejects(runKnorrRecipeLinksCli(envBase, {
    fetchImpl: testFixture.fetchImpl,
    stdout: value => stdout.push(value),
    stderr: value => stderr.push(value),
  }), error => error.code === "production_preflight_response_mismatch");
  assert.equal(stdout.length, 0);
  assert.equal(JSON.parse(stderr[0]).stopReason, "production_preflight_response_mismatch");
  assert.equal(writes(testFixture.calls).length, 0);
});

test("preflight timeout is printed as stopped with zero completed writes", async () => {
  const testFixture = fixture({ preflightException: new DOMException("fixture", "TimeoutError") });
  const stdout = [];
  const stderr = [];
  await assert.rejects(runKnorrRecipeLinksCli(envBase, {
    fetchImpl: testFixture.fetchImpl,
    stdout: value => stdout.push(value),
    stderr: value => stderr.push(value),
  }), error => error.code === "production_preflight_timeout");
  assert.equal(stdout.length, 0);
  const output = JSON.parse(stderr[0]);
  assert.equal(output.stopReason, "production_preflight_timeout");
  assert.equal(output.writes.recipeIds, 0);
  assert.equal(output.writes.readinessRefreshesCompleted, 0);
  assert.equal(writes(testFixture.calls).length, 0);
});

test("authentication, route, timeout, and malformed preflight failures stop before candidate reads", async () => {
  for (const options of [{ preflightStatus: 401 }, { preflightStatus: 403 }, { preflightStatus: 404 },
    { preflightStatus: 503 }, { preflightError: true }, { preflightWrongResponse: true }]) {
    const testFixture = fixture(options);
    await assert.rejects(runKnorrRecipeLinks(envBase, { fetchImpl: testFixture.fetchImpl }));
    assert.equal(testFixture.calls.length, 1);
    assert.equal(writes(testFixture.calls).length, 0);
    assert.equal(posts(testFixture.calls).length, 0);
  }
});

test("preflight separates timeouts, safe transport causes, HTTP failures, redirects, and invalid JSON without writes or secret output", async () => {
  const privateMessage = "private-token-and-url-fixture";
  for (const [options, code, details] of [
    [{ preflightException: new DOMException(privateMessage, "TimeoutError") }, "production_preflight_timeout", { phase: "response_headers", transportCode: "unknown" }],
    [{ preflightException: new TypeError(privateMessage, { cause: { code: "ENOTFOUND" } }) }, "production_preflight_network_error", { phase: "response_headers", transportCode: "ENOTFOUND" }],
    [{ preflightException: new TypeError(privateMessage, { cause: { code: "UND_ERR_CONNECT_TIMEOUT" } }) }, "production_preflight_network_error", { phase: "response_headers", transportCode: "UND_ERR_CONNECT_TIMEOUT" }],
    [{ preflightException: new TypeError(privateMessage, { cause: { code: privateMessage } }) }, "production_preflight_network_error", { phase: "response_headers", transportCode: "unknown" }],
    [{ preflightBodyException: new DOMException(privateMessage, "TimeoutError") }, "production_preflight_timeout", { phase: "response_body" }],
    [{ preflightBodyException: new SyntaxError(privateMessage) }, "production_preflight_invalid_json", { phase: "response_body" }],
    [{ preflightStatus: 403 }, "production_preflight_http_403", undefined],
    [{ preflightStatus: 503 }, "production_preflight_http_503", undefined],
    [{ preflightStatus: 307 }, "production_preflight_redirect_rejected", undefined],
  ]) {
    const testFixture = fixture(options);
    await assert.rejects(runKnorrRecipeLinks(envBase, { fetchImpl: testFixture.fetchImpl }), error => {
      assert.equal(error.code, code);
      assert.deepEqual(error.details, details);
      assert.doesNotMatch(JSON.stringify(error), /private-token-and-url-fixture/);
      return true;
    });
    assert.equal(testFixture.calls.length, 1);
    assert.equal(writes(testFixture.calls).length, 0);
    assert.equal(posts(testFixture.calls).length, 0);
  }
});

test("an expired preflight deadline is classified as a timeout even when fetch reports AbortError", async (t) => {
  t.mock.method(AbortSignal, "timeout", () => AbortSignal.abort(new DOMException("deadline", "TimeoutError")));
  const testFixture = fixture({ preflightException: new DOMException("fixture", "AbortError") });
  await assert.rejects(runKnorrRecipeLinks(envBase, { fetchImpl: testFixture.fetchImpl }), error =>
    error.code === "production_preflight_timeout" && error.details.phase === "response_headers");
  assert.equal(testFixture.calls.length, 1);
});

test("write links only seven profiles and calls the explicit readiness route once per pair", async () => {
  const testFixture = fixture();
  const result = await runKnorrRecipeLinks({
    ...envBase, KNORR_LINK_MODE: "write", KNORR_LINK_CONFIRMATION: CONFIRMATION,
  }, { fetchImpl: testFixture.fetchImpl });
  assert.equal(result.recipeWrites, 7);
  assert.equal(result.readinessCalls, 7);
  assert.deepEqual(result.changedSkus, LINKS.map(item => item.sku));
  assert.equal(writes(testFixture.calls).length, 7);
  assert.equal(preflights(testFixture.calls).length, 1);
  assert.equal(posts(testFixture.calls).length, 7);
  assert.ok(writes(testFixture.calls).every(call => call.url.pathname === "/rest/v1/meal_mix_profiles"));
  assert.ok(posts(testFixture.calls).every(call => call.url.pathname === "/api/internal/planner-readiness/explicit-recipe-refresh"));
  assert.ok(posts(testFixture.calls).every(call => call.headers.authorization === "Bearer " + envBase.PLANNER_CACHE_ADMIN_TOKEN));
  assert.ok(posts(testFixture.calls).every(call => call.headers["x-vercel-protection-bypass"] === envBase.VERCEL_AUTOMATION_BYPASS_SECRET));
  assert.equal(preflights(testFixture.calls)[0].headers.authorization, "Bearer " + envBase.PLANNER_CACHE_ADMIN_TOKEN);
  assert.equal(preflights(testFixture.calls)[0].headers["x-vercel-protection-bypass"], envBase.VERCEL_AUTOMATION_BYPASS_SECRET);
  assert.equal(result.readiness.find(item => item.sku === "704892000").readiness[0].status, "NOT_READY");
});

test("a failed precheck on one record stops before every write", async () => {
  const testFixture = fixture({ invalidSku: "704888000" });
  await assert.rejects(runKnorrRecipeLinks(envBase, { fetchImpl: testFixture.fetchImpl }), error =>
    error.code === "precheck_rejected" && error.details.some(item => item.sku === "704888000"));
  assert.equal(writes(testFixture.calls).length, 0);
  assert.equal(posts(testFixture.calls).length, 0);
  assert.equal(preflights(testFixture.calls).length, 1);
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
  assert.equal(preflights(testFixture.calls).length, 1);
});

test("readiness failure is not retried and later pairs are not called", async () => {
  const testFixture = fixture({ failReadinessAt: 3 });
  await assert.rejects(runKnorrRecipeLinks({
    ...envBase, KNORR_LINK_MODE: "write", KNORR_LINK_CONFIRMATION: CONFIRMATION,
  }, { fetchImpl: testFixture.fetchImpl }), error =>
    error.code === "readiness_refresh_http_503" && error.changedSkus.length === 7 &&
    error.refreshedSkus.length === 2);
  assert.equal(posts(testFixture.calls).length, 3);
  assert.equal(preflights(testFixture.calls).length, 1);
});

test("invalid context, confirmation, or Production origin fails before network access", async () => {
  for (const env of [
    { ...envBase, GITHUB_REF: "refs/heads/topic" },
    { ...envBase, PLANNER_CACHE_BASE_URL: "https://preview.example" },
    { ...envBase, PLANNER_CACHE_ADMIN_TOKEN: "" },
  ]) {
    const testFixture = fixture();
    await assert.rejects(runKnorrRecipeLinks(env, { fetchImpl: testFixture.fetchImpl }));
    assert.equal(testFixture.calls.length, 0);
  }
  const testFixture = fixture();
  await assert.rejects(runKnorrRecipeLinks({
    ...envBase, KNORR_LINK_MODE: "write", KNORR_LINK_CONFIRMATION: "wrong",
  }, { fetchImpl: testFixture.fetchImpl }), error => error.code === "write_confirmation_rejected");
  assert.equal(preflights(testFixture.calls).length, 1);
  assert.equal(writes(testFixture.calls).length, 0);
  assert.equal(posts(testFixture.calls).length, 0);
});
