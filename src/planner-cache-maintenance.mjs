import { maintenanceRequest, maintenanceError, maintenanceDiagnostic } from "./maintenance-http.mjs";
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
export async function notifyPlannerOfNewProducts(settings, productIds, fetcher = fetch, dependencies = {}) {
  const ids = [...new Set(productIds)], pendingProductIds = [], failures = [];
  let notifiedProducts = 0;
  for (let offset = 0; offset < ids.length; offset += 20) {
    const batch = ids.slice(offset, offset + 20);
    try {
      if (!settings) throw maintenanceError("planner-maintenance-not-configured");
      const response = await maintenanceRequest(settings.url, {
        method: "POST", headers: {
          authorization: `Bearer ${settings.token}`, "content-type": "application/json",
          ...(settings.automationBypassSecret ? { "x-vercel-protection-bypass": settings.automationBypassSecret } : {}),
        }, body: JSON.stringify({ productIds: batch }),
      }, { stage: "new-product-cache-refresh", fetcher, timeoutMs: 65000, ...dependencies });
      const result = await response.json().catch(() => null);
      if (result?.productCount !== batch.length || !Array.isArray(result.changedMatchKeys)
        || !Array.isArray(result.affectedRecipeIds) || !Number.isInteger(result.refreshedReadinessCount)) {
        throw maintenanceError("invalid-new-product-cache-response");
      }
      notifiedProducts += batch.length;
    } catch (error) {
      pendingProductIds.push(...batch);
      failures.push(JSON.parse(maintenanceDiagnostic(error)));
    }
  }
  return { notifiedProducts, pendingProductIds, status: pendingProductIds.length ? "pending_requires_attention" : "confirmed", failures };
}
