export const SHANGHAI_SKU = "231215000";
export const SHANGHAI_PRODUCT_NAME = "Knorr Wereldgerecht maaltijdpakket chinese beef shanghai";
export const SHANGHAI_SOURCE_KEY = "catalog-mix-231215000";
export const SHANGHAI_PARSER_VERSION = 5;
export const SHANGHAI_CONFIRMATION = "WRITE_ONLY_SHANGHAI_231215000";
export const SHANGHAI_PACKAGE_TEXT = "239 gram";

const EXPECTED_SUPPLEMENTS = [
  ["mix-supplement-mager-rundergehakt", "mager rundergehakt", 225, "g"],
  ["mix-supplement-champignons", "champignons", 250, "g"],
  ["mix-supplement-tauge", "taugé", 125, "g"],
  ["mix-supplement-bosui", "bosui", 3, "piece"],
  ["mix-supplement-ui", "ui", 1, "piece"],
  ["mix-supplement-prei", "prei", 1, "piece"],
  ["mix-supplement-olie", "olie", 30, "ml"],
];

const normalizedName = (value) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("nl-NL");

export function validateShanghaiPreflight({ product, profile, recipeConflicts, packageMatchRow = null, parsed, recipe }) {
  const blockers = [];
  if (!product) blockers.push("product_missing");
  else if (product.sku !== SHANGHAI_SKU || product.name !== SHANGHAI_PRODUCT_NAME ||
      product.brand?.trim().toLocaleLowerCase("en-US") !== "knorr" ||
      product.package_text !== SHANGHAI_PACKAGE_TEXT ||
      product.source_url !== "https://www.hoogvliet.com/product/knorr-wereldgerechten-maaltijdpakket-chinese-beef-shanghai") {
    blockers.push("product_identity_mismatch");
  }
  if (!profile) blockers.push("profile_missing");
  else if (profile.product_id !== product?.id || profile.brand?.trim().toLocaleLowerCase("en-US") !== "knorr" ||
      profile.status !== "needs_review" || profile.recipe_id !== null || profile.profile !== null ||
      profile.parser_version !== SHANGHAI_PARSER_VERSION || !profile.updated_at || !product?.updated_at ||
      (profile.source_url !== null && profile.source_url !== product?.source_url) ||
      (profile.source_product_updated_at !== null && profile.source_product_updated_at !== product?.updated_at)) {
    blockers.push("profile_state_mismatch");
  }
  if (Array.isArray(recipeConflicts) && recipeConflicts.length) blockers.push("recipe_source_key_conflict");
  if (packageMatchRow) blockers.push("package_match_cache_already_exists");
  if (!parsed || parsed.status !== "verified") blockers.push("source_not_verified");
  else {
    const parsedProfile = parsed.profile;
    if (parsedProfile.recipeSourceKey !== SHANGHAI_SOURCE_KEY ||
        parsedProfile.productIngredientSourceKey !== "catalog-mix-product-231215000" ||
        parsedProfile.productId !== product?.id || parsedProfile.productName !== SHANGHAI_PRODUCT_NAME ||
        parsedProfile.brand !== "Knorr" || parsedProfile.servingsPerPackage !== 3) {
      blockers.push("parsed_profile_identity_mismatch");
    }
    const supplements = parsedProfile.supplements ?? [];
    if (supplements.length !== EXPECTED_SUPPLEMENTS.length || EXPECTED_SUPPLEMENTS.some(([sourceKey, name, quantity, unit]) =>
      !supplements.some((item) => item.sourceKey === sourceKey && normalizedName(item.name) === normalizedName(name) &&
        item.quantity === quantity && item.unit === unit))) blockers.push("parsed_supplements_mismatch");
  }
  if (!recipe || recipe.source_key !== SHANGHAI_SOURCE_KEY || recipe.name !== SHANGHAI_PRODUCT_NAME ||
      recipe.preparation_minutes !== 40) blockers.push("recipe_projection_mismatch");
  return { blocked: blockers.length > 0, blockers };
}

export function validateShanghaiMatchScope({ matchRows, expectedSourceKeys, existingRows, matcherVersionForSourceKey }) {
  const blockers = [];
  const rows = new Map(matchRows.map((row) => [row.match_key, row]));
  if (rows.size !== 8 || matchRows.length !== 8) blockers.push("match_key_count_mismatch");
  const actualSources = new Set(matchRows.map((row) => row.ingredient_source_key));
  if (actualSources.size !== 8 || expectedSourceKeys.size !== 8 ||
      [...expectedSourceKeys].some((key) => !actualSources.has(key)) ||
      [...actualSources].some((key) => !expectedSourceKeys.has(key))) blockers.push("match_source_scope_mismatch");
  if (existingRows.length !== 7) blockers.push("supplement_match_rows_missing");
  for (const row of existingRows) {
    const expected = rows.get(row.match_key);
    if (!expected || !expected.ingredient_source_key.startsWith("mix-supplement-") ||
        row.match_status !== "valid" || !row.product_id || row.refresh_status !== "current" ||
        row.failure_reason !== null || row.invalidated_at !== null || row.invalidation_reason !== null ||
        row.matcher_version !== matcherVersionForSourceKey(row.ingredient_source_key) ||
        row.product_updated_at !== expected.product_updated_at || row.price_updated_at !== expected.price_updated_at ||
        expected.match_status !== "valid" || expected.product_id !== row.product_id) {
      blockers.push("supplement_match_not_current");
      break;
    }
  }
  const productMatch = matchRows.filter((row) => row.ingredient_source_key === "catalog-mix-product-231215000");
  if (productMatch.length !== 1 || productMatch[0].match_status !== "valid" || !productMatch[0].product_id) {
    blockers.push("package_match_unavailable");
  }
  return { blocked: blockers.length > 0, blockers, matchRows: [...rows.values()] };
}

export function buildShanghaiWriteSummary(matchKeys, readinessRows = 10) {
  if (matchKeys.length !== 1 || new Set(matchKeys).size !== 1 || readinessRows !== 10) {
    throw new Error("shanghai_write_scope_mismatch");
  }
  return {
    sku: SHANGHAI_SKU,
    sourceKey: SHANGHAI_SOURCE_KEY,
    uniqueRecords: { recipes: 1, mealMixProfiles: 1, ingredientProductMatches: 1, readiness: 10, total: 13 },
    writeOperations: { recipes: 1, mealMixProfiles: 2, ingredientProductMatches: 1, readiness: 10, total: 14 },
    matchKeys: [...matchKeys].sort(),
    readinessPeopleCounts: Array.from({ length: readinessRows }, (_, index) => index + 1),
  };
}

export function stableShanghaiSnapshot(snapshot) {
  return JSON.stringify(snapshot, (_key, value) => {
    if (!value || Array.isArray(value) || typeof value !== "object") return value;
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
  });
}

export function assertShanghaiWriteArmed({ mode, confirmation, eventName, repository, ref, runAttempt }) {
  if (mode !== "write") throw new Error("write_mode_required");
  if (confirmation !== SHANGHAI_CONFIRMATION) throw new Error("write_confirmation_rejected");
  if (eventName !== "workflow_dispatch" || repository !== "boodschappenmaatje/Boodschappenmandje-importer" ||
      ref !== "refs/heads/main" || runAttempt !== "1") throw new Error("runner_context_rejected");
}

export async function runShanghaiCommit({ mode, confirmation, context, plan, readCurrentSnapshot, writeRecipe,
  writeProfile, writeCaches, verifyWrites, markProfileCurrent }) {
  assertShanghaiWriteArmed({ mode, confirmation, ...context });
  if (plan.blocked) throw new Error("preflight_blocked");
  const current = await readCurrentSnapshot(plan);
  if (stableShanghaiSnapshot(current) !== stableShanghaiSnapshot(plan._snapshot)) throw new Error("preflight_changed");
  await writeRecipe(plan);
  await writeProfile(plan);
  await writeCaches(plan);
  await verifyWrites(plan);
  await markProfileCurrent(plan);
  return { status: "complete", sku: SHANGHAI_SKU, recipeId: plan.recipeId,
    matchWrites: 1, readinessWrites: 10, uniqueRecords: 13, writeOperations: 14, outsideScopeEffects: 0 };
}
