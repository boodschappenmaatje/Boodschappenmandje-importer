import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";

export const PRODUCTION_ORIGIN = "https://boodschappenmaatje-pwa.vercel.app";
export const SUPABASE_ORIGIN = "https://pjcqxufvbkkjehituzxz.supabase.co";
export const CONFIRMATION = "WRITE_EXACT_7_KNORR_RECIPE_LINKS";
export const LINKS = Object.freeze([
  { sku: "686060000", recipeId: "6593543a-5c8d-409d-8c9e-145632c43f0b", recipeName: "Knorr Thaise Kip Siam met groente" },
  { sku: "686150000", recipeId: "17b1cade-cd86-4c55-81b6-ceeef22ed196", recipeName: "Knorr Italiaanse lasagne bolognese" },
  { sku: "704884000", recipeId: "654b1b0c-6a25-412e-9119-b05a475e0d2e", recipeName: "Knorr Surinaamse roti met kip" },
  { sku: "704888000", recipeId: "f6460830-bd8e-4e85-9568-5336f5543bfb", recipeName: "Knorr Indiase Kip Madras" },
  { sku: "704892000", recipeId: "4404d963-73f3-4cc7-b8d0-b9a91cbca5da", recipeName: "Knorr Japanse teriyaki met runderreepjes" },
  { sku: "704897000", recipeId: "4718fbbd-5cd9-4a58-841c-e62bee4574db", recipeName: "Knorr Hokkien Mie met kip en groente" },
  { sku: "704898000", recipeId: "95cfbfc8-45a0-4de9-b015-a731cb015107", recipeName: "Knorr Griekse kofta met rundergehakt" },
]);
export const READINESS_PATH = "/api/internal/planner-readiness/explicit-recipe-refresh";
const PEOPLE = Object.freeze([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);

function stop(code, changedSkus = [], refreshedSkus = [], details = undefined) {
  const error = new Error(code);
  error.code = code;
  error.changedSkus = [...changedSkus];
  error.refreshedSkus = [...refreshedSkus];
  if (details) error.details = details;
  throw error;
}
function stable(value) {
  if (Array.isArray(value)) return "[" + value.map(stable).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + stable(value[key])).join(",") + "}";
  }
  return JSON.stringify(value);
}
function validate(env) {
  if (env.GITHUB_EVENT_NAME !== "workflow_dispatch" ||
      env.GITHUB_REPOSITORY !== "boodschappenmaatje/Boodschappenmandje-importer" ||
      env.GITHUB_REF !== "refs/heads/main" || env.GITHUB_RUN_ATTEMPT !== "1") stop("workflow_context_rejected");
  const mode = env.KNORR_LINK_MODE;
  const confirmation = String(env.KNORR_LINK_CONFIRMATION ?? "").trim();
  if (mode !== "dry-run" && mode !== "write") stop("mode_rejected");
  const supabaseSecret = String(env.SUPABASE_SECRET_KEY ?? "").trim();
  const adminToken = String(env.PLANNER_CACHE_ADMIN_TOKEN ?? "").trim();
  const bypass = String(env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "").trim();
  let database;
  let planner;
  try { database = new URL(env.SUPABASE_URL); planner = new URL(env.PLANNER_CACHE_BASE_URL); }
  catch { stop("production_configuration_invalid"); }
  if (database.origin !== SUPABASE_ORIGIN || database.pathname !== "/" || database.username || database.password || database.search || database.hash ||
      planner.origin !== PRODUCTION_ORIGIN || planner.pathname !== "/" || planner.username || planner.password || planner.search || planner.hash ||
      !supabaseSecret || !adminToken || !bypass ||
      /\s/.test(supabaseSecret) || /\s/.test(adminToken) || /\s/.test(bypass)) stop("production_configuration_invalid");
  return { mode, confirmation, database, planner, supabaseSecret, adminToken, bypass };
}
function dbHeaders(secret) {
  const headers = { apikey: secret, accept: "application/json" };
  if (secret.startsWith("eyJ")) headers.authorization = "Bearer " + secret;
  return headers;
}
function tableURL(database, table, filters, select) {
  const url = new URL("/rest/v1/" + table, database);
  url.searchParams.set("select", select);
  for (const [key, value] of Object.entries(filters)) url.searchParams.set(key, value);
  return url;
}
async function request(fetchImpl, url, init, stage, changed = [], refreshed = []) {
  let response;
  try {
    response = await fetchImpl(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(30_000) });
  } catch {
    stop(stage + "_network_error", changed, refreshed);
  }
  if (response.status >= 300 && response.status < 400) stop(stage + "_redirect_rejected", changed, refreshed);
  if (!response.ok) stop(stage + "_http_" + response.status, changed, refreshed);
  try { return await response.json(); }
  catch { stop(stage + "_invalid_json", changed, refreshed); }
}
async function rows(fetchImpl, config, table, filters, select, stage) {
  const result = await request(fetchImpl, tableURL(config.database, table, filters, select),
    { method: "GET", headers: dbHeaders(config.supabaseSecret) }, stage);
  if (!Array.isArray(result)) stop(stage + "_invalid_rows");
  return result;
}
async function inspectLink(fetchImpl, config, link) {
  const products = await rows(fetchImpl, config, "products", { sku: "eq." + link.sku },
    "id,sku,name,brand", "product_read");
  const reasons = [];
  if (products.length !== 1) reasons.push("product_count");
  const product = products[0];
  if (product && (product.sku !== link.sku || String(product.brand ?? "").trim().toLowerCase() !== "knorr" ||
      !/^knorr\b/i.test(String(product.name ?? "")))) reasons.push("product_identity");
  const recipeRows = await rows(fetchImpl, config, "recipes", { id: "eq." + link.recipeId },
    "id,name", "recipe_read");
  if (recipeRows.length !== 1 || recipeRows[0]?.id !== link.recipeId ||
      recipeRows[0]?.name !== link.recipeName) reasons.push("recipe_identity");
  const ingredients = await rows(fetchImpl, config, "recipe_ingredients", {
    recipe_id: "eq." + link.recipeId, limit: "1",
  }, "id", "recipe_ingredient_read");
  if (ingredients.length < 1) reasons.push("recipe_ingredients");
  const owners = await rows(fetchImpl, config, "meal_mix_profiles", { recipe_id: "eq." + link.recipeId },
    "product_id,recipe_id,status", "recipe_owner_read");
  if (owners.length !== 0) reasons.push("recipe_already_linked");
  let profile = null;
  if (product?.id) {
    const profiles = await rows(fetchImpl, config, "meal_mix_profiles", {
      product_id: "eq." + product.id,
    }, "product_id,recipe_id,status,profile,brand", "profile_read");
    if (profiles.length !== 1) reasons.push("profile_count");
    profile = profiles[0] ?? null;
  } else {
    reasons.push("profile_unaddressable");
  }
  if (profile && (profile.recipe_id !== null || profile.status !== "needs_review" ||
      profile.profile !== null || String(profile.brand ?? "").trim().toLowerCase() !== "knorr")) {
    reasons.push("profile_state");
  }
  return { link, product, profile, reasons };
}
async function matchSnapshot(fetchImpl, config, productIds, changed = [], refreshed = []) {
  const result = await request(fetchImpl, tableURL(config.database, "ingredient_product_matches", {
    product_id: "in.(" + productIds.join(",") + ")", limit: "1001",
  }, "*"), { method: "GET", headers: dbHeaders(config.supabaseSecret) }, "match_cache_read", changed, refreshed);
  if (!Array.isArray(result) || result.length > 1000) stop("match_cache_snapshot_out_of_bounds", changed, refreshed);
  result.sort((a, b) => String(a.match_key).localeCompare(String(b.match_key)));
  return createHash("sha256").update(stable(result)).digest("hex");
}
async function readProfile(fetchImpl, config, productId, changed = [], refreshed = []) {
  const result = await request(fetchImpl, tableURL(config.database, "meal_mix_profiles", {
    product_id: "eq." + productId,
  }, "product_id,recipe_id,status,profile,brand"), { method: "GET", headers: dbHeaders(config.supabaseSecret) },
  "profile_postcheck", changed, refreshed);
  if (!Array.isArray(result) || result.length !== 1) stop("profile_postcheck_mismatch", changed, refreshed);
  return result[0];
}
function checkProfile(row, candidate, changed, refreshed) {
  if (row.recipe_id !== candidate.link.recipeId || row.status !== "needs_review" ||
      row.brand !== candidate.profile.brand || stable(row.profile) !== stable(candidate.profile.profile)) {
    stop("profile_postcheck_mismatch", changed, refreshed);
  }
}
function validateReadiness(body, link, changed, refreshed) {
  if (!body || body.sku !== link.sku || body.recipeId !== link.recipeId ||
      body.profileStatus !== "needs_review" || body.profilePromoted !== false || body.matchCacheWrites !== 0 ||
      body.evaluationMode !== "full" ||
      !Number.isInteger(body.readinessWrites) || body.readinessWrites < 0 ||
      !Array.isArray(body.readiness) || body.readiness.length !== 10) {
    stop("readiness_response_contract_mismatch", changed, refreshed);
  }
  const seen = new Set();
  for (const row of body.readiness) {
    if (!row || !PEOPLE.includes(row.peopleCount) || seen.has(row.peopleCount) ||
        !["READY", "NOT_READY"].includes(row.status) || !Number.isInteger(row.problemCount) || row.problemCount < 0) {
      stop("readiness_rows_invalid", changed, refreshed);
    }
    seen.add(row.peopleCount);
  }
  if (PEOPLE.some(count => !seen.has(count))) stop("readiness_people_counts_incomplete", changed, refreshed);
}

async function productionReadinessPreflight(fetchImpl, config) {
  const link = LINKS[0];
  const signal = AbortSignal.timeout(20_000);
  let response;
  try {
    response = await fetchImpl(new URL(READINESS_PATH, config.planner), {
      method: "POST",
      redirect: "manual",
      signal,
      headers: {
        authorization: "Bearer " + config.adminToken,
        "x-vercel-protection-bypass": config.bypass,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ sku: link.sku, recipeId: link.recipeId, preflight: true }),
    });
  } catch (error) {
    const transportCode = error?.cause?.code;
    const safeTransportCodes = ["ENOTFOUND", "EAI_AGAIN", "ECONNREFUSED", "ECONNRESET", "ETIMEDOUT",
      "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_HEADERS_TIMEOUT", "CERT_HAS_EXPIRED", "UNABLE_TO_VERIFY_LEAF_SIGNATURE"];
    stop(signal.aborted || error?.name === "TimeoutError"
      ? "production_preflight_timeout" : "production_preflight_network_error", [], [], {
      phase: "response_headers",
      transportCode: safeTransportCodes.includes(transportCode) ? transportCode : "unknown",
    });
  }
  if (response.status >= 300 && response.status < 400) stop("production_preflight_redirect_rejected");
  if (!response.ok) stop("production_preflight_http_" + response.status);
  if (!response.headers.get("content-type")?.includes("application/json")) stop("production_preflight_wrong_content_type");
  let body;
  try { body = await response.json(); } catch (error) {
    stop(signal.aborted || error?.name === "TimeoutError"
      ? "production_preflight_timeout" : "production_preflight_invalid_json", [], [], { phase: "response_body" });
  }
  if (!body || body.sku !== link.sku || body.recipeId !== link.recipeId ||
      body.profileStatus !== "needs_review" || body.profilePromoted !== false ||
      body.matchCacheWrites !== 0 || body.readinessWrites !== 0 || body.evaluationMode !== "preflight" ||
      !Array.isArray(body.readiness) || body.readiness.length !== 1) {
    stop("production_preflight_response_mismatch");
  }
  const seen = new Set();
  for (const row of body.readiness) {
    if (!row || !PEOPLE.includes(row.peopleCount) || seen.has(row.peopleCount) ||
        !["READY", "NOT_READY"].includes(row.status) ||
        !Number.isInteger(row.problemCount) || row.problemCount < 0) {
      stop("production_preflight_readiness_invalid");
    }
    seen.add(row.peopleCount);
  }
  if (seen.size !== 1 || !seen.has(4)) stop("production_preflight_readiness_incomplete");
  return { route: READINESS_PATH, authAccepted: true, explicitRecipeReadiness: true, evaluationMode: body.evaluationMode,
    readinessRows: body.readiness.length, readinessWrites: body.readinessWrites, matchCacheWrites: body.matchCacheWrites };
}

export async function runKnorrRecipeLinks(env = process.env, dependencies = {}) {
  const config = validate(env);
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const preflight = await productionReadinessPreflight(fetchImpl, config);
  const inspected = [];
  for (const link of LINKS) inspected.push(await inspectLink(fetchImpl, config, link));
  const rejected = inspected.filter(item => item.reasons.length);
  if (rejected.length) stop("precheck_rejected", [], [], rejected.map(item => ({ sku: item.link.sku, reasons: item.reasons })));
  const productIds = inspected.map(item => item.product.id);
  const matchHashBefore = await matchSnapshot(fetchImpl, config, productIds);
  const base = { productionPreflight: preflight, precheckValid: inspected.length,
    skuList: LINKS.map(item => item.sku), matchCacheHashBefore: matchHashBefore };
  if (config.mode === "dry-run") {
    if (config.confirmation !== "") stop("dry_run_confirmation_must_be_empty");
    return { status: "dry-run", ...base, recipeWrites: 0, readinessCalls: 0 };
  }
  if (config.confirmation !== CONFIRMATION) stop("write_confirmation_rejected");

  const changed = [];
  const refreshed = [];
  for (const item of inspected) {
    const link = item.link;
    const url = tableURL(config.database, "meal_mix_profiles", {
      product_id: "eq." + item.product.id,
      recipe_id: "is.null",
      status: "eq.needs_review",
      profile: "is.null",
      brand: "eq.Knorr",
    }, "product_id,recipe_id,status,profile,brand");
    const result = await request(fetchImpl, url, {
      method: "PATCH",
      headers: { ...dbHeaders(config.supabaseSecret), "content-type": "application/json", prefer: "return=representation" },
      body: JSON.stringify({ recipe_id: link.recipeId }),
    }, "recipe_write", changed, refreshed);
    if (!Array.isArray(result) || result.length !== 1 ||
        result[0].product_id !== item.product.id || result[0].recipe_id !== link.recipeId ||
        result[0].status !== "needs_review" || result[0].profile !== null) {
      stop("recipe_write_count_or_state_mismatch", changed, refreshed, { sku: link.sku });
    }
    changed.push(link.sku);
  }
  for (const item of inspected) {
    const row = await readProfile(fetchImpl, config, item.product.id, changed);
    checkProfile(row, item, changed, []);
  }

  const readinessResults = [];
  for (const item of inspected) {
    const link = item.link;
    const responseBody = await request(fetchImpl, new URL(READINESS_PATH, config.planner), {
      method: "POST",
      headers: {
        authorization: "Bearer " + config.adminToken,
        "x-vercel-protection-bypass": config.bypass,
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({ sku: link.sku, recipeId: link.recipeId }),
    }, "readiness_refresh", changed, refreshed);
    validateReadiness(responseBody, link, changed, refreshed);
    readinessResults.push(responseBody);
    refreshed.push(link.sku);
  }

  for (const item of inspected) {
    const row = await readProfile(fetchImpl, config, item.product.id, changed, refreshed);
    checkProfile(row, item, changed, refreshed);
  }
  const matchHashAfter = await matchSnapshot(fetchImpl, config, productIds, changed, refreshed);
  if (matchHashBefore !== matchHashAfter) stop("match_cache_changed", changed, refreshed);

  const result = {
    status: "complete",
    ...base,
    recipeWrites: changed.length,
    changedSkus: changed,
    readinessCalls: refreshed.length,
    readiness: readinessResults,
    matchCacheHashAfter: matchHashAfter,
    profileStatusesPreserved: true,
    profileDataPreserved: true,
    matchCacheUnchanged: true,
  };
  return result;
}

function successfulOutput(result) {
  if (!result || !["dry-run", "complete"].includes(result.status) ||
      result.productionPreflight?.authAccepted !== true ||
      result.productionPreflight?.evaluationMode !== "preflight" ||
      result.productionPreflight?.readinessRows !== 1 ||
      result.productionPreflight?.readinessWrites !== 0 ||
      result.productionPreflight?.matchCacheWrites !== 0 ||
      result.precheckValid !== LINKS.length ||
      stable(result.skuList) !== stable(LINKS.map(item => item.sku)) ||
      !Number.isInteger(result.recipeWrites) || result.recipeWrites < 0 ||
      !Number.isInteger(result.readinessCalls) || result.readinessCalls < 0 ||
      (result.status === "complete" && !Array.isArray(result.readiness))) {
    stop("runner_result_missing_or_invalid");
  }
  if (result.status === "dry-run" && (result.recipeWrites !== 0 || result.readinessCalls !== 0)) {
    stop("dry_run_result_reported_writes");
  }
  const readinessCacheWrites = result.status === "complete"
    ? result.readiness?.reduce((total, item) => total + item.readinessWrites, 0)
    : result.productionPreflight.readinessWrites;
  const ingredientMatchCacheWrites = result.status === "complete"
    ? result.readiness?.reduce((total, item) => total + item.matchCacheWrites, 0)
    : result.productionPreflight.matchCacheWrites;
  if (!Number.isInteger(readinessCacheWrites) || readinessCacheWrites < 0 ||
      !Number.isInteger(ingredientMatchCacheWrites) || ingredientMatchCacheWrites < 0) {
    stop("runner_result_missing_or_invalid");
  }
  return {
    status: result.status,
    evaluationMode: result.productionPreflight.evaluationMode,
    candidatesChecked: result.precheckValid,
    validLinks: result.precheckValid,
    writes: {
      recipeIds: result.recipeWrites,
      readinessCache: readinessCacheWrites,
      ingredientMatchCache: ingredientMatchCacheWrites,
      total: result.recipeWrites + readinessCacheWrites + ingredientMatchCacheWrites,
    },
    stopReason: null,
  };
}

function stoppedOutput(error) {
  const code = error?.code ?? "runner_failed";
  return {
    status: "stopped",
    evaluationMode: null,
    candidatesChecked: null,
    validLinks: null,
    writes: {
      recipeIds: error?.changedSkus?.length ?? 0,
      readinessRefreshesCompleted: error?.refreshedSkus?.length ?? 0,
    },
    stopReason: code,
    code,
    changedSkus: error?.changedSkus ?? [],
    readinessRefreshedSkus: error?.refreshedSkus ?? [],
    details: error?.details,
    secretsRedacted: true,
  };
}

export async function runKnorrRecipeLinksCli(env = process.env, dependencies = {}) {
  const {
    runImpl = runKnorrRecipeLinks,
    stdout = value => console.log(value),
    stderr = value => console.error(value),
    ...runDependencies
  } = dependencies;
  try {
    const result = await runImpl(env, runDependencies);
    const output = successfulOutput(result);
    try {
      stdout(JSON.stringify(output));
    } catch {
      stop("runner_result_output_failed");
    }
    return output;
  } catch (error) {
    stderr(JSON.stringify(stoppedOutput(error)));
    throw error;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runKnorrRecipeLinksCli().catch(() => {
    process.exitCode = 1;
  });
}
