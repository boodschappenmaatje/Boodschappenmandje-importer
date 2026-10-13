import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { parseMealMixSource } from "../src/server/meal-mix-source.ts";
import { loadCatalog, rowsForGate, PLANNER_MAINTENANCE_PEOPLE_COUNTS } from "../src/server/planner-cache-service.ts";
import { dryRunBoundedReadiness, writeBoundedReadiness } from "../src/server/bounded-readiness-maintenance.ts";
import { evaluateRecipeReadiness } from "../src/services/week-preparation/recipe-readiness.ts";
import { SupabaseCatalogRepository } from "../src/services/catalog/catalog-repository.ts";
import { enrichIngredientsForMealMixes } from "../src/services/week-preparation/meal-mix-profiles.ts";
import { matcherVersionForSourceKey } from "../src/services/week-preparation/persistent-readiness-cache.ts";
import { mealMixCorroborationFor } from "../../../src/meal-mix-reviewed-evidence.mjs";
import { MEAL_MIX_PROFILES } from "../src/services/week-preparation/meal-mix-profiles.ts";
import { MEAL_MIX_PARSER_VERSION, profileRecipeRow } from "../../../src/meal-mix-profile-maintenance.mjs";
import {
  SHANGHAI_CONTENT_ROOT,
  clickShanghaiInstructionsWithConsentFallback,
  dismissShanghaiRejectOptionalConsent,
  inspectShanghaiSource,
  safeShanghaiParserReason,
  safeShanghaiSourceFacts,
  shanghaiOilMeasurementCount,
  validateShanghaiContentRoot,
} from "./shanghai-source-diagnostics.mjs";
import {
  SHANGHAI_PARSER_VERSION,
  SHANGHAI_PRODUCT_NAME,
  SHANGHAI_SKU,
  SHANGHAI_SOURCE_KEY,
  assertShanghaiWriteArmed,
  buildShanghaiWriteSummary,
  runShanghaiCommit,
  validateShanghaiMatchScope,
  validateShanghaiPreflight,
} from "./shanghai-writepad-core.mjs";

const SELECT_PRODUCT = "id,sku,name,brand,package_text,source_url,category,updated_at";

function requireData(result, stage) {
  if (result.error) throw new Error(stage);
  return result.data;
}

async function readProduct(client) {
  const result = await client.from("products").select(SELECT_PRODUCT).eq("sku", SHANGHAI_SKU).maybeSingle();
  if (result.error) throw new Error("product_read_failed");
  return result.data;
}

async function readProfile(client, productId) {
  if (!productId) return null;
  const result = await client.from("meal_mix_profiles").select("*").eq("product_id", productId).maybeSingle();
  if (result.error) throw new Error("profile_read_failed");
  return result.data;
}

async function parseCurrentSource(browser, product) {
  const url = new URL(product.source_url);
  if (url.origin !== "https://www.hoogvliet.com" || !url.pathname.startsWith("/product/") || url.username || url.password) {
    return { error: "source_unavailable", diagnostic: {
      navigation_status: null, final_url: null, error_stage: "validation", error_type: "Error",
      selector_status: "not_reached", parser_status: "not_reached", timeout: false,
    } };
  }
  const page = await browser.newPage();
  try {
    const contentRoot = page.locator(SHANGHAI_CONTENT_ROOT);
    const title = contentRoot.getByRole("heading", { level: 1, name: SHANGHAI_PRODUCT_NAME, exact: true });
    const instructions = contentRoot.getByRole("button", { name: "Gebruiksaanwijzing", exact: true });
    let rejectOptionalCookies = null;
    const inspectDocument = () => page.evaluate((expectedName) => {
      const normalize = (value) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("nl-NL").replace(/[^\p{L}\p{N}]+/gu, " ").trim();
      const visible = (element) => {
        const style = window.getComputedStyle(element);
        return style.visibility !== "hidden" && style.display !== "none" && element.getClientRects().length > 0;
      };
      const product = normalize(expectedName);
      const body = normalize(document.body?.innerText ?? "");
      const headings = [...document.querySelectorAll("h1")];
      const buttons = [...document.querySelectorAll("button")];
      const buttonText = (button) => normalize(button.getAttribute("aria-label") || button.innerText || button.textContent);
      const namesInstructions = buttons.filter((button) => buttonText(button) === "gebruiksaanwijzing");
      const contentRoots = [...document.querySelectorAll("main:has(h1)")];
      const controlledPanels = namesInstructions.map((button) => document.getElementById(button.getAttribute("aria-controls") || "")).filter(Boolean);
      const controlledPanelText = controlledPanels[0]?.textContent ?? "";
      const instructionPreparationStart = controlledPanelText.search(/\bZo maak\b/i);
      const instructionPreparationText = instructionPreparationStart >= 0 ? controlledPanelText.slice(instructionPreparationStart) : "";
      const instructionOilMeasurementCount = [...instructionPreparationText.matchAll(/\b\d+(?:[.,]\d+)?\s*(?:el|eetl\.?|eetlepels?)\s+(?:(?:olijf|zonnebloem|arachide|rijst)?olie)\b/gi)].length;
      const consent = buttons.filter((button) => /cookie|consent|accepteren|toestaan|weigeren|afwijzen|reject/.test(buttonText(button)));
      const visibleConsent = consent.filter(visible);
      const rejectOnlyConsent = visibleConsent.filter((button) => /alleen noodzakelijke|only necessary|reject optional|weigeren|afwijzen/.test(buttonText(button)));
      const acceptAllConsent = visibleConsent.filter((button) => /alle cookies accepteren|alles accepteren|accept all|allow all/.test(buttonText(button)));
      const instructionButton = namesInstructions[0] ?? null;
      const instructionRect = instructionButton?.getBoundingClientRect();
      const instructionIntersectsViewport = Boolean(instructionRect && instructionRect.bottom > 0 && instructionRect.top < window.innerHeight &&
        instructionRect.right > 0 && instructionRect.left < window.innerWidth);
      const instructionCenterHit = instructionIntersectsViewport
        ? document.elementFromPoint(instructionRect.left + instructionRect.width / 2, instructionRect.top + instructionRect.height / 2)
        : null;
      const instructionCenterHitTarget = Boolean(instructionCenterHit && instructionButton &&
        (instructionCenterHit === instructionButton || instructionButton.contains(instructionCenterHit)));
      const instructionCenterHitByConsent = Boolean(instructionCenterHit && visibleConsent.some((button) =>
        button === instructionCenterHit || button.contains(instructionCenterHit)));
      const instructionCenterHitTagRaw = instructionCenterHit?.tagName?.toLowerCase() ?? "none";
      const instructionCenterHitKind = ["button", "a", "input", "svg", "path", "div", "span", "body", "main", "section", "dialog", "iframe"].includes(instructionCenterHitTagRaw)
        ? instructionCenterHitTagRaw
        : instructionCenterHit ? "other" : "none";
      const instructionCenterHitHasClickSurface = Boolean(instructionCenterHit?.closest?.("button,a,input,[role=button]"));
      const instructionCenterHitInsideContentRoot = Boolean(instructionCenterHit && contentRoots.some((root) => root.contains(instructionCenterHit)));
      const title = normalize(document.title);
      const challengeText = normalize((document.title ?? "") + " " + (document.body?.innerText ?? ""));
      const mains = [...document.querySelectorAll("main")];
      return {
        ready_state: document.readyState,
        main_count: mains.length,
        main_visible_count: mains.filter(visible).length,
        main_zero_rect_count: mains.filter((main) => main.getClientRects().length === 0).length,
        main_display_contents_count: mains.filter((main) => window.getComputedStyle(main).display === "contents").length,
        main_with_h1_count: mains.filter((main) => main.querySelector("h1")).length,
        visible_main_with_h1_count: mains.filter((main) => main.querySelector("h1") && visible(main)).length,
        content_root_query_count: contentRoots.length,
        visible_content_root_count: contentRoots.filter(visible).length,
        h1_count: headings.length,
        visible_h1_count: headings.filter(visible).length,
        matching_product_h1_count: headings.filter((heading) => normalize(heading.innerText || heading.textContent) === product).length,
        title_matches_product: title === product,
        body_contains_product_name: body.includes(product),
        has_package_marker: body.includes("239 gram"),
        has_people_marker: body.includes("voor 2 3 personen"),
        has_shopping_list_marker: body.includes("boodschappenlijstje"),
        instructions_button_count: namesInstructions.length,
        visible_instructions_button_count: namesInstructions.filter(visible).length,
        instructions_expanded_count: namesInstructions.filter((button) => button.getAttribute("aria-expanded") === "true").length,
        instructions_aria_controls_count: namesInstructions.filter((button) => Boolean(button.getAttribute("aria-controls"))).length,
        controlled_panel_present_count: controlledPanels.length,
        visible_controlled_panel_count: controlledPanels.filter(visible).length,
        instruction_oil_measurement_count: instructionOilMeasurementCount,
        panel_within_content_root_count: controlledPanels.filter((panel) => contentRoots.some((root) => root.contains(panel))).length,
        consent_control_count: consent.length,
        consent_control_visible_count: visibleConsent.length,
        consent_reject_only_count: rejectOnlyConsent.length,
        consent_accept_all_count: acceptAllConsent.length,
        instructions_intersects_viewport: instructionIntersectsViewport,
        instructions_center_hit_target: instructionCenterHitTarget,
        instructions_center_hit_by_consent: instructionCenterHitByConsent,
        instructions_center_hit_kind: instructionCenterHitKind,
        instructions_center_hit_has_click_surface: instructionCenterHitHasClickSurface,
        instructions_center_hit_inside_content_root: instructionCenterHitInsideContentRoot,
        challenge_signals: {
          cloudflare: challengeText.includes("cloudflare"),
          human_check: challengeText.includes("verify you are human") || challengeText.includes("checking your browser"),
          access_denied: challengeText.includes("access denied"),
          captcha: challengeText.includes("captcha"),
        },
      };
    }, SHANGHAI_PRODUCT_NAME);
    let domAtDomContentLoaded = null;
    let selectorSubstage = "content_root";
    let oilMeasurementsBeforeWait = null;
    let oilMeasurementsAfterWait = null;
    const inspected = await inspectShanghaiSource({
      diagnose: async () => {
        const afterWait = await inspectDocument();
        if (rejectOptionalCookies) {
          afterWait.reject_only_locator_count = await rejectOptionalCookies.count().catch(() => 0);
          afterWait.reject_only_locator_visible = await rejectOptionalCookies.isVisible().catch(() => false);
          afterWait.reject_only_locator_enabled = await rejectOptionalCookies.isEnabled().catch(() => false);
        }
        return {
          selector_substage: selectorSubstage,
          playwright_root_count: await contentRoot.count(),
          playwright_root_visible: await contentRoot.isVisible().catch(() => false),
          heading_locator_count: await title.count(),
          heading_locator_visible: await title.isVisible().catch(() => false),
          instructions_locator_count: await instructions.count(),
          instructions_locator_visible: await instructions.isVisible().catch(() => false),
          at_domcontentloaded: domAtDomContentLoaded,
          after_wait: afterWait,
        };
      },
      selector: SHANGHAI_CONTENT_ROOT,
      navigate: async () => {
        const response = await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 25000 });
        domAtDomContentLoaded = await inspectDocument();
        return { status: response?.status() ?? null };
      },
      finalUrl: async () => page.url(),
      waitForSelector: async () => {
        selectorSubstage = "content_root";
        await contentRoot.waitFor({ timeout: 15000 });
        selectorSubstage = "product_heading";
        if (await title.count() !== 1) throw new Error("source-structure-mismatch");
        selectorSubstage = "instructions_button";
        if (await instructions.count() !== 1) throw new Error("source-structure-mismatch");
        selectorSubstage = "optional_consent";
        rejectOptionalCookies = page.getByRole("button", {
          name: /(?:alleen noodzakelijke|only necessary|reject optional|weigeren|afwijzen)/i,
        });
        await dismissShanghaiRejectOptionalConsent(rejectOptionalCookies);
        selectorSubstage = "instructions_click";
        if (await instructions.getAttribute("aria-expanded") !== "true") {
          await clickShanghaiInstructionsWithConsentFallback({
            instructions,
            inspectDocument,
            rejectOptionalCookies,
          });
        }
        selectorSubstage = "aria_controls";
        const panelId = await instructions.getAttribute("aria-controls");
        if (!panelId) throw new Error("source-instructions-panel-missing");
        selectorSubstage = "instructions_panel";
        const instructionsPanel = contentRoot.locator(`[id=${JSON.stringify(panelId)}]`);
        await instructionsPanel.waitFor({ state: "visible", timeout: 15000 });
        oilMeasurementsBeforeWait = shanghaiOilMeasurementCount(await instructionsPanel.textContent());
        selectorSubstage = "instructions_content";
        await page.waitForFunction((id) => {
          const text = document.getElementById(id)?.textContent ?? "";
          const start = text.search(/\bZo maak\b/i);
          if (start < 0) return false;
          const preparation = text.slice(start).split(/Netto-inhoud/i)[0];
          return [...preparation.matchAll(/\b\d+(?:[.,]\d+)?\s*(?:el|eetl\.?|eetlepels?)\s+(?:(?:olijf|zonnebloem|arachide|rijst)?olie)\b/gi)].length >= 2;
        }, panelId, { timeout: 15000 });
        oilMeasurementsAfterWait = shanghaiOilMeasurementCount(await instructionsPanel.textContent());
      },
      readSource: async () => validateShanghaiContentRoot({
        product,
        title: await title.innerText(),
        text: await contentRoot.textContent(),
        sourceUrl: page.url(),
        fetchedAt: new Date().toISOString(),
      }),
      parseSource: async (source) => parseMealMixSource(source, MEAL_MIX_PROFILES, mealMixCorroborationFor(product)),
    });
    if (!inspected.source) return inspected;
    return { ...inspected, diagnostic: {
      ...inspected.diagnostic,
      ...safeShanghaiSourceFacts(inspected.source.text),
      instruction_oil_measurements_before_wait: oilMeasurementsBeforeWait ?? 0,
      instruction_oil_measurements_after_wait: oilMeasurementsAfterWait ?? 0,
    } };
  } finally {
    await page.close();
  }
}

function safeReadinessGateShape(gate) {
  const recipes = Array.isArray(gate?.recipes) ? gate.recipes : [];
  const ingredients = recipes.flatMap((recipe) => Array.isArray(recipe?.ingredients) ? recipe.ingredients : []);
  const candidates = gate?.candidatesByRequirement;
  const matched = gate?.matchedProductsByRequirement;
  return {
    recipes_array: Array.isArray(gate?.recipes),
    recipe_count: recipes.length,
    recipe_ingredients_arrays: recipes.every((recipe) => Array.isArray(recipe?.ingredients)),
    matched_products_lookup: typeof matched?.get === "function",
    candidates_lookup: candidates === undefined || typeof candidates?.get === "function",
    requirement_key_types: ingredients.every((item) => item?.requirementKey == null || typeof item.requirementKey === "string"),
    source_key_types: ingredients.every((item) => typeof item?.sourceKey === "string"),
    candidate_product_lists: typeof candidates?.get !== "function" || ingredients.every((item) => {
      if (item?.requirementKey == null) return true;
      const candidate = candidates.get(item.requirementKey);
      return candidate == null || Array.isArray(candidate.products);
    }),
  };
}

function safeReadinessErrorType(error) {
  return ["TypeError", "RangeError", "Error"].includes(error?.name) ? error.name : "unknown";
}

function projectedRecipe(id, recipeRow) {
  return {
    id,
    sourceKey: recipeRow.source_key,
    name: recipeRow.name,
    normalizedName: recipeRow.normalized_name,
    symbol: recipeRow.symbol,
    preparationMinutes: recipeRow.preparation_minutes,
    vegetarian: recipeRow.vegetarian,
    containsPork: recipeRow.contains_pork,
    kidFriendly: recipeRow.kid_friendly,
    healthy: recipeRow.healthy,
    budgetTier: recipeRow.budget_tier,
  };
}

async function evaluatePlannedRows(client, recipeId, recipeRow, parsedProfile, setStage = () => {}) {
  setStage("catalog_load");
  const catalog = await loadCatalog(client);
  setStage("recipe_source_key_check");
  if (catalog.recipes.some((item) => item.sourceKey === SHANGHAI_SOURCE_KEY)) throw new Error("recipe_source_key_conflict");
  const prospectiveProfile = { ...parsedProfile, recipeId, productId: parsedProfile.productId };
  setStage("catalog_enrichment");
  catalog.mealMixProfiles = [...(catalog.mealMixProfiles ?? []), prospectiveProfile];
  catalog.ingredients = enrichIngredientsForMealMixes(catalog.ingredients, catalog.mealMixProfiles);
  setStage("recipe_projection");
  const recipe = projectedRecipe(recipeId, recipeRow);
  catalog.recipes = [...catalog.recipes, recipe];
  const repository = new SupabaseCatalogRepository(client);
  const byMatchKey = new Map();
  const readinessRows = [];
  for (const peopleCount of PLANNER_MAINTENANCE_PEOPLE_COUNTS) {
    setStage("readiness_evaluation");
    const gate = await evaluateRecipeReadiness([recipe], peopleCount, catalog, repository);
    if (gate.recipes.length !== 1 || gate.recipes[0]?.recipeId !== recipeId) throw new Error("evaluator_recipe_scope_mismatch");
    setStage("readiness_row_projection", gate);
    const rows = rowsForGate(gate, peopleCount, new Date());
    if (rows.readinessRows.length !== 1 || rows.readinessRows[0]?.recipe_id !== recipeId) throw new Error("readiness_scope_mismatch");
    readinessRows.push(rows.readinessRows[0]);
    for (const row of rows.matchRows) {
      const existing = byMatchKey.get(row.match_key);
      if (existing && (existing.product_id !== row.product_id || existing.match_status !== row.match_status ||
          existing.failure_reason !== row.failure_reason || existing.product_updated_at !== row.product_updated_at ||
          existing.price_updated_at !== row.price_updated_at)) throw new Error("match_changes_across_people");
      byMatchKey.set(row.match_key, row);
    }
  }
  setStage("readiness_scope_validation");
  const matchRows = [...byMatchKey.values()];
  const expectedSourceKeys = new Set([parsedProfile.productIngredientSourceKey, ...parsedProfile.supplements.map((row) => row.sourceKey)]);
  if (matchRows.length !== 8 || matchRows.some((row) => !expectedSourceKeys.has(row.ingredient_source_key)) || readinessRows.length !== 10) {
    throw new Error("computed_scope_mismatch");
  }
  return { catalog, recipe, matchRows, readinessRows, expectedSourceKeys };
}

async function preflight(client, browser) {
  const product = await readProduct(client);
  const profile = product ? await readProfile(client, product.id) : null;
  let source = null;
  let parsed = null;
  let recipeRow = null;
  let recipeId = randomUUID();
  let sourceDiagnostic = null;
  const blockers = [];
  if (product) {
    const sourceResult = await parseCurrentSource(browser, product);
    sourceDiagnostic = sourceResult.diagnostic;
    if (sourceResult.error) blockers.push("source_unavailable");
    else {
      ({ source, parsed } = sourceResult);
      if (parsed.status === "verified") recipeRow = profileRecipeRow(parsed.profile, source);
    }
  }
  const conflictsResult = await client.from("recipes").select("id,source_key,name").eq("source_key", SHANGHAI_SOURCE_KEY);
  const recipeConflicts = requireData(conflictsResult, "recipe_conflict_read_failed") ?? [];
  const state = validateShanghaiPreflight({ product, profile, recipeConflicts, parsed, recipe: recipeRow });
  blockers.push(...state.blockers);
  if (MEAL_MIX_PARSER_VERSION !== SHANGHAI_PARSER_VERSION) blockers.push("parser_version_code_mismatch");
  let evaluated = null;
  let matchValidation = { blocked: true, blockers: ["readiness_plan_unavailable"], matchRows: [] };
  let planned = null;
  const cas = null;
  let sourceRevision = null;
  let readinessPreflightStage = null;
  let readinessGateShape = null;
  let readinessPreflightErrorType = null;
  if (product && parsed?.status === "verified" && recipeRow) {
    try {
      evaluated = await evaluatePlannedRows(client, recipeId, recipeRow, parsed.profile, (stage, gate) => {
        readinessPreflightStage = stage;
        if (stage === "readiness_row_projection") readinessGateShape = safeReadinessGateShape(gate);
      });
      readinessPreflightStage = "supplement_match_read";
      const missingKey = evaluated.matchRows.filter((row) => row.ingredient_source_key === "catalog-mix-product-231215000");
      const supplementKeys = evaluated.matchRows.filter((row) => row.ingredient_source_key.startsWith("mix-supplement-")).map((row) => row.match_key);
      const oldResult = await client.from("ingredient_product_matches").select("*").in("match_key", supplementKeys);
      const existingRows = requireData(oldResult, "supplement_match_read_failed") ?? [];
      readinessPreflightStage = "supplement_match_validation";
      matchValidation = validateShanghaiMatchScope({ matchRows: evaluated.matchRows, expectedSourceKeys: evaluated.expectedSourceKeys,
        existingRows, matcherVersionForSourceKey });
      blockers.push(...matchValidation.blockers);
      if (missingKey.length !== 1) blockers.push("package_match_scope_mismatch");
      else {
        readinessPreflightStage = "package_match_read";
        const packageMatchResult = await client.from("ingredient_product_matches").select("match_key")
          .eq("match_key", missingKey[0].match_key).maybeSingle();
        const packageMatchRow = requireData(packageMatchResult, "package_match_read_failed");
        if (packageMatchRow) blockers.push("package_match_cache_already_exists");
        readinessPreflightStage = "source_revision_read";
        const sourceResult = await client.rpc("bounded_readiness_source_revision");
        if (sourceResult.error || typeof sourceResult.data !== "string") throw new Error("source_revision_unavailable");
        sourceRevision = sourceResult.data;
        readinessPreflightStage = null;
        // bounded_readiness_state is intentionally not granted to service_role.
        // The executable CAS snapshot/token is obtained later through the
        // existing bounded planner, after the exact recipe/profile are linked.
        planned = buildShanghaiWriteSummary([missingKey[0].match_key]);
      }
    } catch (error) {
      readinessPreflightErrorType = safeReadinessErrorType(error);
      blockers.push("readiness_preflight_unavailable");
    }
  }
  const sourceSnapshot = {
    product: product && { id: product.id, sku: product.sku, name: product.name, brand: product.brand,
      package_text: product.package_text, source_url: product.source_url, updated_at: product.updated_at },
    profile: profile && { product_id: profile.product_id, status: profile.status, recipe_id: profile.recipe_id,
      profile: profile.profile, parser_version: profile.parser_version, updated_at: profile.updated_at },
    sourceFingerprint: parsed?.fingerprint ?? null,
    recipeConflicts,
    sourceRevision,
    readinessPreflightStage,
    readinessGateShape,
    readinessPreflightErrorType,
  };
  const blocked = blockers.length > 0;
  const emptyCounts = { recipes: 0, mealMixProfiles: 0, ingredientProductMatches: 0, readiness: 0, total: 0 };
  return {
    blocked,
    sku: SHANGHAI_SKU,
    sourceKey: SHANGHAI_SOURCE_KEY,
    recipeId,
    recipe: recipeRow,
    parsedProfile: parsed?.profile ?? null,
    sourceEvidence: parsed?.evidence ?? null,
    parsedStatus: parsed?.status ?? "unavailable",
    parsedReason: safeShanghaiParserReason(parsed?.reason),
    sourceDiagnostic,
    sourceFingerprint: parsed?.fingerprint ?? null,
    matchKeys: evaluated?.matchRows.map((row) => row.match_key).sort() ?? [],
    writeMatchKeys: planned?.matchKeys ?? [],
    plannedRecords: !blocked && planned ? planned.uniqueRecords : emptyCounts,
    writeOperations: !blocked && planned
      ? { recipes: 1, mealMixProfiles: 2, ingredientProductMatches: 1, readiness: 10, total: 14 }
      : emptyCounts,
    existingSupplementMatches: matchValidation.blocked ? [] : 7,
    readinessPeopleCounts: planned?.readinessPeopleCounts ?? [1,2,3,4,5,6,7,8,9,10],
    sourceRevision,
    readinessPreflightStage,
    readinessGateShape,
    readinessPreflightErrorType,
    casRevisions: cas,
    casRevisionStatus: cas ? "captured" : "will_be_captured_by_bounded_dry_run_after_link",
    dependencyKeys: evaluated ? [...new Set(evaluated.readinessRows.flatMap((row) => row.dependency_match_keys))].sort() : [],
    blockers: [...new Set(blockers)],
    _snapshot: sourceSnapshot,
  };
}

function publicPlan(plan) {
  return Object.fromEntries(Object.entries(plan).filter(([key]) => key !== "_snapshot"));
}

async function freshIdentitySnapshot(client, browser) {
  const product = await readProduct(client);
  const profile = product ? await readProfile(client, product.id) : null;
  let parsed = null;
  if (product) {
    const sourceResult = await parseCurrentSource(browser, product);
    if (sourceResult.error) throw new Error("source_unavailable");
    ({ parsed } = sourceResult);
  }
  const conflictResult = await client.from("recipes").select("id,source_key,name").eq("source_key", SHANGHAI_SOURCE_KEY);
  const conflicts = requireData(conflictResult, "recipe_conflict_recheck_failed") ?? [];
  return {
    product: product && { id: product.id, sku: product.sku, name: product.name, brand: product.brand,
      package_text: product.package_text, source_url: product.source_url, updated_at: product.updated_at },
    profile: profile && { product_id: profile.product_id, status: profile.status, recipe_id: profile.recipe_id,
      profile: profile.profile, parser_version: profile.parser_version, updated_at: profile.updated_at },
    sourceFingerprint: parsed?.fingerprint ?? null,
    recipeConflicts: conflicts,
    sourceRevision: requireData(await client.rpc("bounded_readiness_source_revision"), "source_revision_recheck_failed"),
  };
}

async function commit(client, browser, plan) {
  return runShanghaiCommit({
    mode: "write", confirmation: process.env.SHANGHAI_WRITE_CONFIRMATION,
    context: { eventName: process.env.GITHUB_EVENT_NAME, repository: process.env.GITHUB_REPOSITORY,
      ref: process.env.GITHUB_REF, runAttempt: process.env.GITHUB_RUN_ATTEMPT },
    plan,
    readCurrentSnapshot: () => freshIdentitySnapshot(client, browser),
    writeRecipe: async (currentPlan) => {
      const insert = await client.from("recipes").insert({ id: currentPlan.recipeId, ...currentPlan.recipe })
        .select("id,source_key").single();
      if (insert.error || insert.data?.id !== currentPlan.recipeId || insert.data?.source_key !== SHANGHAI_SOURCE_KEY) {
        throw new Error("recipe_insert_failed");
      }
    },
    writeProfile: async (currentPlan) => {
      const updatedAt = new Date().toISOString();
      const profilePatch = {
        status: "verified", cache_status: "pending", reason: null, recipe_id: currentPlan.recipeId,
        profile: currentPlan.parsedProfile, source_url: currentPlan.parsedProfile.sourceUrl,
        source_fingerprint: currentPlan.sourceFingerprint, source_evidence: currentPlan.sourceEvidence,
        source_product_updated_at: currentPlan._snapshot.product.updated_at,
        parser_version: SHANGHAI_PARSER_VERSION, checked_at: updatedAt, updated_at: updatedAt,
      };
      const profileWrite = await client.from("meal_mix_profiles").update(profilePatch)
        .eq("product_id", currentPlan._snapshot.product.id).eq("updated_at", currentPlan._snapshot.profile.updated_at)
        .eq("status", "needs_review").is("recipe_id", null).is("profile", null)
        .select("product_id,recipe_id,status,cache_status,updated_at");
      if (profileWrite.error || profileWrite.data?.length !== 1 || profileWrite.data[0].recipe_id !== currentPlan.recipeId ||
          profileWrite.data[0].status !== "verified") throw new Error("profile_compare_and_set_failed");
    },
    writeCaches: async (currentPlan) => {
      const beforePlan = await client.from("ingredient_product_matches").select("match_key")
        .eq("match_key", currentPlan.writeMatchKeys[0]).maybeSingle();
      if (beforePlan.error || beforePlan.data) throw new Error("package_match_state_changed");
      const cachePlan = await dryRunBoundedReadiness(client, { recipeIds: [currentPlan.recipeId], matchKeys: currentPlan.writeMatchKeys });
      if (cachePlan.blocked || cachePlan.transactional !== true || cachePlan.plannedMatchWrites !== 1 ||
          cachePlan.plannedReadinessWrites !== 10 || !cachePlan.planToken || !cachePlan.sourceRevision ||
          cachePlan.dependencyKeys?.length !== 8) throw new Error("bounded_readiness_preflight_failed");
      const beforeCommit = await client.from("ingredient_product_matches").select("match_key")
        .eq("match_key", currentPlan.writeMatchKeys[0]).maybeSingle();
      if (beforeCommit.error || beforeCommit.data) throw new Error("package_match_state_changed");
      const written = await writeBoundedReadiness(client, {
        recipeIds: [currentPlan.recipeId], matchKeys: currentPlan.writeMatchKeys, expectedPlanToken: cachePlan.planToken,
      });
      if (written.blocked || written.matchWrites !== 1 || written.readinessWrites !== 10) throw new Error("bounded_readiness_commit_failed");
    },
    verifyWrites: async (currentPlan) => {
      const [matchResult, readinessResult] = await Promise.all([
        client.from("ingredient_product_matches").select("match_key,match_status,refresh_status,invalidated_at,invalidation_reason")
          .in("match_key", currentPlan.writeMatchKeys),
        client.from("recipe_readiness_cache").select("recipe_id,people_count,refresh_status,invalidated_at,invalidation_reason,expires_at")
          .eq("recipe_id", currentPlan.recipeId).in("people_count", [...PLANNER_MAINTENANCE_PEOPLE_COUNTS]),
      ]);
      const matches = requireData(matchResult, "postwrite_match_read_failed") ?? [];
      const readiness = requireData(readinessResult, "postwrite_readiness_read_failed") ?? [];
      if (matches.length !== 1 || matches[0].match_status !== "valid" || matches[0].refresh_status !== "current" ||
          matches[0].invalidated_at !== null || matches[0].invalidation_reason !== null || readiness.length !== 10 ||
          readiness.some((row) => row.recipe_id !== currentPlan.recipeId || row.refresh_status !== "current" ||
            row.invalidated_at !== null || row.invalidation_reason !== null || Date.parse(row.expires_at) <= Date.now())) {
        throw new Error("postwrite_verification_failed");
      }
    },
    markProfileCurrent: async (currentPlan) => {
      const profileCurrent = await client.from("meal_mix_profiles").update({ cache_status: "current", updated_at: new Date().toISOString() })
        .eq("product_id", currentPlan._snapshot.product.id).eq("recipe_id", currentPlan.recipeId).eq("status", "verified")
        .eq("cache_status", "pending").select("product_id");
      if (profileCurrent.error || profileCurrent.data?.length !== 1) throw new Error("profile_cache_status_verification_failed");
    },
  });
}

async function main() {
  const mode = process.env.SHANGHAI_WRITE_MODE ?? "dry-run";
  const confirmation = process.env.SHANGHAI_WRITE_CONFIRMATION ?? "";
  if (mode === "write") assertShanghaiWriteArmed({ mode, confirmation, eventName: process.env.GITHUB_EVENT_NAME,
    repository: process.env.GITHUB_REPOSITORY, ref: process.env.GITHUB_REF, runAttempt: process.env.GITHUB_RUN_ATTEMPT });
  else if (mode !== "dry-run") throw new Error("invalid_mode");
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!supabaseUrl || !secret) throw new Error("database_credentials_missing");
  const client = createClient(supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined, headless: true });
  try {
    const plan = await preflight(client, browser);
    if (mode === "dry-run") {
      console.log(JSON.stringify({ status: "dry-run", ...publicPlan(plan) }, null, 2));
      if (plan.blocked) process.exitCode = 1;
      return;
    }
    if (plan.blocked) {
      console.log(JSON.stringify({ status: "blocked", ...publicPlan(plan) }, null, 2));
      process.exitCode = 1;
      return;
    }
    const result = await commit(client, browser, plan);
    console.log(JSON.stringify({ ...publicPlan(plan), ...result }, null, 2));
  } finally {
    await browser.close();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    const code = /^[a-z][a-z0-9_]{0,80}$/.test(error?.message ?? "") ? error.message : "unexpected_writepad_failure";
    console.error(JSON.stringify({ status: "failed", sku: SHANGHAI_SKU, sourceKey: SHANGHAI_SOURCE_KEY, code }));
    process.exitCode = 1;
  });
}
