import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import { restURL, requestHeaders } from "./supabase.mjs";
import { parseMealMixSource } from "../apps/web/src/server/meal-mix-source.ts";
import { MEAL_MIX_PROFILES } from "../apps/web/src/services/week-preparation/meal-mix-profiles.ts";

export const MEAL_MIX_PARSER_VERSION = 2;

export async function readMealMixSource(page, product) {
  const url = new URL(product.source_url);
  if (url.origin !== "https://www.hoogvliet.com" || !url.pathname.startsWith("/product/") || url.username || url.password) throw Error("untrusted-source");
  await page.goto(url.href, { waitUntil: "domcontentloaded", timeout: 25000 });
  const detail = page.locator('[data-testing-id="product-detail-page"]');
  await detail.waitFor({ timeout: 15000 });
  return { product, title: await page.locator("h1").innerText(), text: await detail.textContent(),
    sourceUrl: page.url(), fetchedAt: new Date().toISOString() };
}

export function profileRecipeRow(profile, source) {
  // Use declared cooking durations, conservatively taking the longest range.
  // When the source provides no duration, do not publish an invented time.
  const durations = [...source.text.matchAll(/\b(\d+)(?:\s*(?:à|tot|[-–])\s*(\d+))?\s*min(?:uten)?\b/gi)]
    .map((match) => Number(match[2] ?? match[1])).filter((value) => value > 0 && value <= 360);
  if (!durations.length) return null;
  return { source_key: profile.recipeSourceKey, name: profile.dishName,
    normalized_name: profile.dishName.toLocaleLowerCase("nl-NL"), symbol: "fork.knife",
    preparation_minutes: Math.max(...durations),
    vegetarian: !profile.supplements.some((item) => ["Vlees", "Vis"].includes(item.category)),
    contains_pork: profile.supplements.some((item) => /varken|spek|ham|rookworst/i.test(item.name)),
    kid_friendly: false, healthy: false, budget_tier: "standard" };
}

export function mealMixApi(config, fetcher = fetch) {
  return async (table, query, { method = "GET", body, prefer = "return=representation" } = {}) => {
    const url = restURL(config.supabaseURL, table);
    url.search = new URLSearchParams(query).toString();
    const response = await fetcher(url, { method, headers: requestHeaders(config.supabaseSecretKey, prefer),
      body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(25000) });
    if (!response.ok) throw Error(`meal-mix-database-${response.status}`);
    return response.status === 204 ? [] : response.json();
  };
}

/** Queue processing is bounded and idempotent, with compare-and-set writes. */
export async function maintainMealMixProfiles({ api, readSource, refreshRecipes, limit = 20 }) {
  const queued = await api("meal_mix_profiles", { select: "*",
    or: `(status.eq.pending,parser_version.lt.${MEAL_MIX_PARSER_VERSION},and(status.eq.verified,cache_status.eq.pending))`, order: "updated_at.asc", limit: String(Math.min(100, Math.max(1, limit))) });
  const results = [];
  for (const queue of queued) {
    if (queue.status === "verified" && queue.parser_version === MEAL_MIX_PARSER_VERSION && queue.cache_status === "pending") {
      await refreshRecipes([queue.recipe_id]);
      await api("meal_mix_profiles", { product_id: `eq.${queue.product_id}`, updated_at: `eq.${queue.updated_at}` }, { method: "PATCH", body: { cache_status: "current" } });
      results.push({ productId: queue.product_id, status: "cache_refreshed" });
      continue;
    }
    const [product] = await api("products", { select: "id,sku,name,brand,package_text,source_url,category,updated_at", id: `eq.${queue.product_id}` });
    if (!product) continue;
    let result;
    let source;
    try {
      source = await readSource(product);
      result = parseMealMixSource(source, MEAL_MIX_PROFILES);
    } catch { result = { status: "needs_review", reason: "source_unavailable", fingerprint: null }; }
    let recipeId = queue.recipe_id;
    if (result.status === "verified") {
      const recipe = profileRecipeRow(result.profile, source);
      if (!recipe) result = { ...result, status: "needs_review", reason: "preparation_time_missing" };
      else {
        const [saved] = await api("recipes", { on_conflict: "source_key" }, {
          method: "POST", body: recipe, prefer: "resolution=ignore-duplicates,return=representation",
        });
        recipeId = saved?.id ?? (await api("recipes", { select: "id", source_key: `eq.${recipe.source_key}` }))[0]?.id;
        if (!recipeId) throw Error("meal-mix-recipe-write-failed");
      }
    }
    const verified = result.status === "verified";
    const patch = { status: result.status, cache_status: "pending", reason: verified ? null : result.reason,
      recipe_id: recipeId, profile: verified ? result.profile : null,
      source_url: product.source_url, source_fingerprint: result.fingerprint,
      source_evidence: verified ? result.evidence : null, source_product_updated_at: product.updated_at,
      parser_version: MEAL_MIX_PARSER_VERSION, checked_at: new Date().toISOString(), updated_at: new Date().toISOString() };
    const saved = await api("meal_mix_profiles", { product_id: `eq.${product.id}`, updated_at: `eq.${queue.updated_at}` }, { method: "PATCH", body: patch });
    if (!saved.length) { results.push({ productId: product.id, status: "changed_during_fetch" }); continue; }
    if (verified) {
      await refreshRecipes([recipeId]);
      await api("meal_mix_profiles", { product_id: `eq.${product.id}`, updated_at: `eq.${patch.updated_at}` }, { method: "PATCH", body: { cache_status: "current" } });
    }
    results.push({ productId: product.id, name: product.name, status: result.status, reason: result.reason ?? null });
  }
  return results;
}

async function main() {
  const api = mealMixApi({ supabaseURL: process.env.SUPABASE_URL, supabaseSecretKey: process.env.SUPABASE_SECRET_KEY });
  const base = new URL(process.env.PLANNER_CACHE_BASE_URL);
  if (base.protocol !== "https:" || base.username || base.password) throw Error("invalid-planner-origin");
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH, headless: true });
  try {
    const results = await maintainMealMixProfiles({ api, limit: process.argv.includes("--backfill") ? 100 : 20,
      readSource: async (product) => { const page = await browser.newPage(); try { return await readMealMixSource(page, product); } finally { await page.close(); } },
      refreshRecipes: async (recipeIds) => {
        const response = await fetch(new URL("/api/internal/planner-readiness/mix-refresh", base), {
          method: "POST", redirect: "manual", signal: AbortSignal.timeout(120000),
          headers: { "content-type": "application/json", authorization: `Bearer ${process.env.PLANNER_CACHE_ADMIN_TOKEN}`,
            ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET ? { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET } : {}) },
          body: JSON.stringify({ recipeIds }),
        });
        if (!response.ok) throw Error("meal-mix-cache-refresh-failed");
      },
    });
    console.log(JSON.stringify(results, null, 2));
  } finally { await browser.close(); }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => { console.error("Maaltijdmixonderhoud mislukt; de wachtrij en bronstatus blijven controleerbaar."); process.exitCode = 1; });
}
