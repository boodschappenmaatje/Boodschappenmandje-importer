import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SHANGHAI_CONFIRMATION,
  SHANGHAI_PARSER_VERSION,
  SHANGHAI_PRODUCT_NAME,
  SHANGHAI_SKU,
  SHANGHAI_SOURCE_KEY,
  assertShanghaiWriteArmed,
  buildShanghaiWriteSummary,
  runShanghaiCommit,
  validateShanghaiMatchScope,
  validateShanghaiPreflight,
} from "../apps/web/scripts/shanghai-writepad-core.mjs";

const product = {
  id: "837af4a6-b7b6-4fd4-8eea-3437d4f138a7", sku: SHANGHAI_SKU, name: SHANGHAI_PRODUCT_NAME,
  brand: "Knorr", package_text: "239 gram", updated_at: "product-v1",
  source_url: "https://www.hoogvliet.com/product/knorr-wereldgerechten-maaltijdpakket-chinese-beef-shanghai",
};
const supplements = [
  ["mager-rundergehakt", "mager rundergehakt", 225, "g"], ["champignons", "champignons", 250, "g"],
  ["tauge", "taugé", 125, "g"], ["bosui", "bosui", 3, "piece"], ["ui", "ui", 1, "piece"],
  ["prei", "prei", 1, "piece"], ["olie", "olie", 30, "ml"],
].map(([suffix, name, quantity, unit]) => ({ sourceKey: `mix-supplement-${suffix}`, name, quantity, unit }));
const profile = { product_id: product.id, brand: "Knorr", status: "needs_review", recipe_id: null, profile: null,
  parser_version: SHANGHAI_PARSER_VERSION, updated_at: "profile-v1", source_url: null, source_product_updated_at: null };
const parsed = { status: "verified", profile: { recipeSourceKey: SHANGHAI_SOURCE_KEY,
  productIngredientSourceKey: "catalog-mix-product-231215000", productId: product.id,
  productName: SHANGHAI_PRODUCT_NAME, brand: "Knorr", servingsPerPackage: 3, supplements } };
const recipe = { source_key: SHANGHAI_SOURCE_KEY, name: SHANGHAI_PRODUCT_NAME, preparation_minutes: 40 };
const valid = () => validateShanghaiPreflight({ product, profile, recipeConflicts: [], parsed, recipe });
const context = { eventName: "workflow_dispatch", repository: "boodschappenmaatje/Boodschappenmandje-importer",
  ref: "refs/heads/main", runAttempt: "1" };
const workflow = readFileSync(new URL("../.github/workflows/shanghai-bounded-writepad.yml", import.meta.url), "utf8");

test("accepts only the exact Shanghai preflight identity and proven profile", () => {
  assert.deepEqual(valid(), { blocked: false, blockers: [] });
  assert.equal(buildShanghaiWriteSummary(["catalog-mix-product-231215000:piece:mealMix:knorr"]).uniqueRecords.total, 13);
});

test("rejects another SKU and a missing product", () => {
  assert.ok(validateShanghaiPreflight({ product: { ...product, sku: "231215001" }, profile, recipeConflicts: [], parsed, recipe }).blocked);
  assert.ok(validateShanghaiPreflight({ product: null, profile: null, recipeConflicts: [], parsed: null, recipe: null }).blockers.includes("product_missing"));
});

test("rejects unexpected profile status and existing/conflicting recipe", () => {
  assert.ok(validateShanghaiPreflight({ product, profile: { ...profile, status: "verified" }, recipeConflicts: [], parsed, recipe }).blocked);
  assert.ok(validateShanghaiPreflight({ product, profile, recipeConflicts: [{ id: "other" }], parsed, recipe }).blockers.includes("recipe_source_key_conflict"));
  assert.ok(validateShanghaiPreflight({ product, profile, recipeConflicts: [], packageMatchRow: { match_key: "already-there" }, parsed, recipe })
    .blockers.includes("package_match_cache_already_exists"));
});

test("parser failure blocks the plan before any write capability is produced", () => {
  assert.ok(validateShanghaiPreflight({ product, profile, recipeConflicts: [], parsed: { status: "needs_review" }, recipe }).blockers.includes("source_not_verified"));
  assert.ok(validateShanghaiPreflight({ product, profile, recipeConflicts: [], parsed: { ...parsed, profile: { ...parsed.profile, servingsPerPackage: 4 } }, recipe }).blockers.includes("parsed_profile_identity_mismatch"));
});

test("validates the seven current supplement matches and one new package match", () => {
  const matchRows = [
    { match_key: "package", ingredient_source_key: "catalog-mix-product-231215000", match_status: "valid", product_id: "p-shanghai" },
    ...supplements.map((item) => ({ match_key: item.sourceKey, ingredient_source_key: item.sourceKey,
      match_status: "valid", product_id: `product-${item.sourceKey}`, product_updated_at: "prod-v1", price_updated_at: "price-v1" })),
  ];
  const existingRows = matchRows.slice(1).map((row) => ({ ...row, failure_reason: null, refresh_status: "current", invalidated_at: null,
    invalidation_reason: null, matcher_version: 5 }));
  const scope = validateShanghaiMatchScope({ matchRows, expectedSourceKeys: new Set(matchRows.map((row) => row.ingredient_source_key)),
    existingRows, matcherVersionForSourceKey: () => 5 });
  assert.equal(scope.blocked, false);
  assert.equal(scope.matchRows.length, 8);
  assert.equal(validateShanghaiMatchScope({ matchRows, expectedSourceKeys: new Set(matchRows.map((row) => row.ingredient_source_key)),
    existingRows: existingRows.slice(1), matcherVersionForSourceKey: () => 5 }).blocked, true);
});

test("wrong confirmation and CAS drift produce zero simulated writes", async () => {
  let writes = 0;
  const plan = { blocked: false, recipeId: "new-id", _snapshot: { sku: SHANGHAI_SKU, updated_at: "v1" } };
  const actions = { mode: "write", context, plan, writeRecipe: async () => writes++, writeProfile: async () => writes++,
    writeCaches: async () => writes++, verifyWrites: async () => {}, markProfileCurrent: async () => {} };
  await assert.rejects(runShanghaiCommit({ ...actions, confirmation: "wrong", readCurrentSnapshot: async () => plan._snapshot }), /write_confirmation_rejected/);
  await assert.rejects(runShanghaiCommit({ ...actions, confirmation: SHANGHAI_CONFIRMATION,
    readCurrentSnapshot: async () => ({ sku: SHANGHAI_SKU, updated_at: "v2" }) }), /preflight_changed/);
  assert.equal(writes, 0);
});

test("confirmed simulated commit writes only Shanghai and exact cache scope", async () => {
  const writes = [];
  const plan = { blocked: false, recipeId: "new-id", _snapshot: { sku: SHANGHAI_SKU, updated_at: "v1" } };
  const result = await runShanghaiCommit({ mode: "write", confirmation: SHANGHAI_CONFIRMATION, context, plan,
    readCurrentSnapshot: async () => plan._snapshot,
    writeRecipe: async (value) => writes.push(["recipe", value.recipeId, SHANGHAI_SOURCE_KEY]),
    writeProfile: async (value) => writes.push(["profile", value.recipeId, SHANGHAI_SKU]),
    writeCaches: async (value) => writes.push(["bounded-cache", value.recipeId, [1,2,3,4,5,6,7,8,9,10]]),
    verifyWrites: async () => writes.push(["verify", SHANGHAI_SKU]),
    markProfileCurrent: async () => writes.push(["profile-current", SHANGHAI_SKU]),
  });
  assert.equal(result.status, "complete");
  assert.deepEqual(result, { status: "complete", sku: SHANGHAI_SKU, recipeId: "new-id", matchWrites: 1,
    readinessWrites: 10, uniqueRecords: 13, writeOperations: 14, outsideScopeEffects: 0 });
  assert.ok(writes.every(([, , scope]) => scope === undefined || Array.isArray(scope) || scope === SHANGHAI_SKU || scope === SHANGHAI_SOURCE_KEY));
  assert.equal(writes.filter(([kind]) => kind === "bounded-cache").length, 1);
});

test("second run stops safely after identity moves from needs_review", async () => {
  const changed = validateShanghaiPreflight({ product, profile: { ...profile, status: "verified", recipe_id: "new-id" },
    recipeConflicts: [{ id: "new-id", source_key: SHANGHAI_SOURCE_KEY }], parsed, recipe });
  assert.equal(changed.blocked, true);
  let writes = 0;
  await assert.rejects(runShanghaiCommit({ mode: "write", confirmation: SHANGHAI_CONFIRMATION, context,
    plan: { blocked: true, recipeId: "new-id", _snapshot: {} }, readCurrentSnapshot: async () => ({}),
    writeRecipe: async () => writes++, writeProfile: async () => writes++, writeCaches: async () => writes++,
    verifyWrites: async () => {}, markProfileCurrent: async () => {} }), /preflight_blocked/);
  assert.equal(writes, 0);
});

test("arming rejects non-main, retry and non-manual execution", () => {
  assert.throws(() => assertShanghaiWriteArmed({ mode: "write", confirmation: SHANGHAI_CONFIRMATION,
    ...context, ref: "refs/heads/feature" }), /runner_context_rejected/);
  assert.throws(() => assertShanghaiWriteArmed({ mode: "write", confirmation: SHANGHAI_CONFIRMATION,
    ...context, runAttempt: "2" }), /runner_context_rejected/);
  assert.throws(() => assertShanghaiWriteArmed({ mode: "write", confirmation: SHANGHAI_CONFIRMATION,
    ...context, eventName: "push" }), /runner_context_rejected/);
});

test("workflow is manual-only, fixed-scope, default dry-run and branch/attempt guarded", () => {
  assert.match(workflow, /^on:\n  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^\s+schedule:/m);
  assert.match(workflow, /default: dry-run/);
  assert.match(workflow, /WRITE_ONLY_SHANGHAI_231215000/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /github\.run_attempt == 1/);
  assert.doesNotMatch(workflow.slice(workflow.indexOf("    inputs:"), workflow.indexOf("\n\npermissions:")), /sku:/i);
  assert.doesNotMatch(workflow, /SUPABASE_DB_PASSWORD|PLANNER_CACHE_ADMIN_TOKEN/);
});
