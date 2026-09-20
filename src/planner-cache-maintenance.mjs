const PATH = "/api/internal/planner-readiness/new-products";

export function plannerMaintenanceSettings(config) {
  const base = config.plannerCacheBaseURL?.trim();
  const token = config.plannerCacheAdminToken?.trim();
  if (!base && !token) return null;
  if (!base || !token) throw new Error("Planner-cacheonderhoud vereist base-URL én admin-token.");
  let url;
  try { url = new URL(base); } catch { throw new Error("Ongeldige planner-cache base-URL."); }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash ||
    !["", "/"].includes(url.pathname)) throw new Error("Planner-cache base-URL moet een HTTPS-origin zijn.");
  url.pathname = PATH;
  return { url, token, automationBypassSecret: config.plannerCacheAutomationBypassSecret?.trim() };
}

/** Only after product AND price confirmation; never rolls back a successful import. */
export async function notifyPlannerOfNewProducts(settings, productIds, fetcher = fetch) {
  const ids = [...new Set(productIds)];
  const pendingProductIds = [];
  let notifiedProducts = 0;
  for (let offset = 0; offset < ids.length; offset += 20) {
    const batch = ids.slice(offset, offset + 20);
    let confirmed = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const response = await fetcher(settings.url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${settings.token}`,
            "content-type": "application/json",
            ...(settings.automationBypassSecret
              ? { "x-vercel-protection-bypass": settings.automationBypassSecret } : {}),
          },
          body: JSON.stringify({ productIds: batch }),
          redirect: "manual",
          signal: AbortSignal.timeout(65_000),
        });
        if (response.ok) {
          const result = await response.json();
          confirmed = result.productCount === batch.length && Array.isArray(result.changedMatchKeys) &&
            Array.isArray(result.affectedRecipeIds) && Number.isInteger(result.refreshedReadinessCount);
          if (confirmed) break;
        }
        // Do not follow redirects with credentials or retry authorization errors.
        if (response.status >= 300 && response.status < 500 && response.status !== 429) break;
      } catch {
        // Never log exception text: network errors may contain credentials or URLs.
      }
    }
    if (confirmed) notifiedProducts += batch.length;
    else pendingProductIds.push(...batch);
  }
  return { notifiedProducts, pendingProductIds };
}
