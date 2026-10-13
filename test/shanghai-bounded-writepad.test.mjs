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
import {
  SHANGHAI_CONTENT_ROOT,
  inspectShanghaiSource,
  validateShanghaiContentRoot,
} from "../apps/web/scripts/shanghai-source-diagnostics.mjs";

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
const runner = readFileSync(new URL("../apps/web/scripts/run-shanghai-bounded-writepad.mjs", import.meta.url), "utf8");

test("runner imports the Shanghai product name used by the normal source-read flow", () => {
  const coreImportEnd = runner.indexOf('} from "./shanghai-writepad-core.mjs";');
  const coreImportStart = runner.lastIndexOf("import {", coreImportEnd);
  assert.notEqual(coreImportStart, -1);
  assert.notEqual(coreImportEnd, -1);
  assert.match(runner.slice(coreImportStart, coreImportEnd), /\bSHANGHAI_PRODUCT_NAME\b/);
  assert.match(runner, /name: SHANGHAI_PRODUCT_NAME, exact: true/);
});

test("accepts only the exact Shanghai preflight identity and proven profile", () => {
  assert.deepEqual(valid(), { blocked: false, blockers: [] });
  assert.equal(buildShanghaiWriteSummary(["catalog-mix-product-231215000:piece:mealMix:knorr"]).uniqueRecords.total, 13);
});

test("accepts only the two allowlisted Shanghai URL variants for the exact SKU", () => {
  const productionUrl = "https://www.hoogvliet.com/product/knorr-wereldgerecht-maaltijdpakket-chinese-beef-shanghai";
  assert.equal(validateShanghaiPreflight({ product: { ...product, source_url: productionUrl }, profile,
    recipeConflicts: [], parsed, recipe }).blocked, false);
  assert.ok(validateShanghaiPreflight({ product: { ...product, sku: "231215001", source_url: productionUrl }, profile,
    recipeConflicts: [], parsed, recipe }).blockers.includes("product_identity_mismatch"));
  assert.ok(validateShanghaiPreflight({ product: { ...product, source_url: "https://www.hoogvliet.com/product/other" }, profile,
    recipeConflicts: [], parsed, recipe }).blockers.includes("product_identity_mismatch"));
});

const sourceProbe = (overrides = {}) => inspectShanghaiSource({
  navigate: async () => ({ status: 200 }),
  finalUrl: async () => "https://hoogvliet.nl/product/knorr-wereldgerecht-maaltijdpakket-chinese-beef-shanghai-231215000?secret=hidden",
  waitForSelector: async () => {},
  readSource: async () => ({ text: "safe" }),
  parseSource: async () => ({ status: "verified" }),
  ...overrides,
});

const liveShanghaiSource = {
  title: SHANGHAI_PRODUCT_NAME,
  text: `Knorr Wereldgerecht maaltijdpakket chinese beef shanghai
239 gram - Prijs per kilo
Chinese Beef Shanghai, gehaktballetjes met mie. Voor 2-3 personen.
Bereidingswijze: Recept met lekker veel groente: Boodschappenlijstje:
225 g mager rundergehakt, 250 g champignons, 125 g taugé, 3 bosuien, 1 ui, 1 prei, Olie.`,
};

test("runner uses the exact measured Shanghai CSS content-root selector", () => {
  assert.ok(runner.includes("page.locator(SHANGHAI_CONTENT_ROOT)"));
  assert.ok(!runner.includes('page.locator("main").filter({ has: page.locator("h1") })'));
});

test("uses the current semantic Shanghai root, opens source content and reaches the parser", async () => {
  let waitedFor = null;
  let parserReached = false;
  const result = await sourceProbe({
    waitForSelector: async (selector) => { waitedFor = selector; },
    readSource: async () => validateShanghaiContentRoot(liveShanghaiSource),
    parseSource: async () => { parserReached = true; return { status: "verified" }; },
  });
  assert.equal(waitedFor, "main:has(h1)");
  assert.equal(waitedFor, SHANGHAI_CONTENT_ROOT);
  assert.notEqual(waitedFor, '[data-testing-id="product-detail-page"]');
  assert.equal(parserReached, true);
  assert.equal(result.diagnostic.content_root_found, true);
  assert.equal(result.diagnostic.parser_status, "parsed");
});

test("missing current root and malformed root content fail closed before parsing", async () => {
  const timeout = new Error("sensitive selector details");
  timeout.name = "TimeoutError";
  const missing = await sourceProbe({ waitForSelector: async () => { throw timeout; } });
  assert.equal(missing.error, "source_unavailable");
  assert.equal(missing.diagnostic.error_stage, "selector");
  assert.equal(missing.diagnostic.content_root_found, false);

  let parserReached = false;
  const malformed = await sourceProbe({
    readSource: async () => validateShanghaiContentRoot({ ...liveShanghaiSource, text: "239 gram" }),
    parseSource: async () => { parserReached = true; return { status: "verified" }; },
  });
  assert.equal(malformed.error, "source_unavailable");
  assert.equal(malformed.diagnostic.error_stage, "validation");
  assert.equal(malformed.diagnostic.content_root_found, true);
  assert.equal(malformed.diagnostic.parser_status, "not_reached");
  assert.equal(parserReached, false);
});

test("source diagnostics classify navigation, selector and parser failures without writes or secret leakage", async () => {
  let writes = 0;
  const failures = [
    ["navigation", { navigate: async () => { const error = new Error("token=secret"); error.name = "TypeError"; throw error; } }],
    ["selector", { waitForSelector: async () => { const error = new Error("cookie=secret"); error.name = "TimeoutError"; throw error; } }],
    ["parser", { parseSource: async () => { throw new Error("authorization=secret"); } }],
  ];
  for (const [stage, override] of failures) {
    const result = await sourceProbe(override);
    assert.equal(result.error, "source_unavailable");
    assert.equal(result.diagnostic.error_stage, stage);
    assert.equal(result.diagnostic.timeout, stage === "selector");
    assert.equal(result.diagnostic.content_root, SHANGHAI_CONTENT_ROOT);
    assert.equal(result.diagnostic.final_url,
      "https://hoogvliet.nl/product/knorr-wereldgerecht-maaltijdpakket-chinese-beef-shanghai-231215000");
    assert.doesNotMatch(JSON.stringify(result), /token=|cookie=|authorization=|secret/i);
    await assert.rejects(runShanghaiCommit({ mode: "write", confirmation: SHANGHAI_CONFIRMATION, context,
      plan: { blocked: true, recipeId: "new-id", _snapshot: {} }, readCurrentSnapshot: async () => ({}),
      writeRecipe: async () => writes++, writeProfile: async () => writes++, writeCaches: async () => writes++,
      verifyWrites: async () => {}, markProfileCurrent: async () => {} }), /preflight_blocked/);
  }
  assert.equal(writes, 0);
});

test("selector diagnostics expose only bounded DOM facts, not page text", async () => {
  const timeout = new Error("timeout");
  timeout.name = "TimeoutError";
  const result = await sourceProbe({
    waitForSelector: async () => { throw timeout; },
    diagnose: async () => ({
      selector_substage: "instructions_panel", playwright_root_count: 1, playwright_root_visible: true,
      heading_locator_count: 1, heading_locator_visible: true, instructions_locator_count: 1,
      instructions_locator_visible: true,
      at_domcontentloaded: { ready_state: "interactive", main_count: 0, body_contains_product_name: false,
        challenge_signals: { human_check: true } },
      after_wait: { ready_state: "complete", main_count: 1, main_visible_count: 0, main_zero_rect_count: 1,
        main_display_contents_count: 1, main_with_h1_count: 1, visible_main_with_h1_count: 0,
        content_root_query_count: 1, visible_content_root_count: 0, h1_count: 0, body_text: "secret cookie=hidden",
        consent_control_visible_count: 5, consent_reject_only_count: 1, consent_accept_all_count: 1,
        instructions_intersects_viewport: true, instructions_center_hit_target: false, instructions_center_hit_by_consent: true,
        challenge_signals: { captcha: true } },
      leaked_text: "must not be returned",
    }),
  });
  assert.equal(result.diagnostic.document_diagnostic.at_domcontentloaded.ready_state, "interactive");
  assert.equal(result.diagnostic.document_diagnostic.at_domcontentloaded.challenge_signals.human_check, true);
  assert.equal(result.diagnostic.document_diagnostic.after_wait.challenge_signals.captcha, true);
  assert.equal(result.diagnostic.document_diagnostic.selector_substage, "instructions_panel");
  assert.equal(result.diagnostic.document_diagnostic.playwright_root_count, 1);
  assert.equal(result.diagnostic.document_diagnostic.playwright_root_visible, true);
  assert.equal(result.diagnostic.document_diagnostic.after_wait.main_display_contents_count, 1);
  assert.equal(result.diagnostic.document_diagnostic.after_wait.content_root_query_count, 1);
  assert.equal(result.diagnostic.document_diagnostic.after_wait.visible_content_root_count, 0);
  assert.equal(result.diagnostic.document_diagnostic.after_wait.instructions_center_hit_by_consent, true);
  assert.equal(result.diagnostic.document_diagnostic.after_wait.consent_reject_only_count, 1);
  assert.doesNotMatch(JSON.stringify(result), /secret|cookie=|hidden|must not be returned/i);
});

test("successful source diagnostics report public status without query leakage", async () => {
  const result = await sourceProbe();
  assert.equal(result.error, undefined);
  assert.equal(result.diagnostic.navigation_status, 200);
  assert.equal(result.diagnostic.selector_status, "matched");
  assert.equal(result.diagnostic.parser_status, "parsed");
  assert.doesNotMatch(JSON.stringify(result.diagnostic), /secret|hidden/i);
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
  assert.match(workflow, /inputs\.mode == 'dry-run'/);
  assert.match(workflow, /refs\/heads\/codex\/shanghai-source-diagnostic-20261012/);
  assert.match(workflow, /github\.run_attempt == 1/);
  assert.doesNotMatch(workflow.slice(workflow.indexOf("    inputs:"), workflow.indexOf("\n\npermissions:")), /sku:/i);
  assert.doesNotMatch(workflow, /SUPABASE_DB_PASSWORD|PLANNER_CACHE_ADMIN_TOKEN/);
});
