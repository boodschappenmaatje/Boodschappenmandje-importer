export const PRODUCTION_PLANNER_ORIGIN = 'https://boodschappenmaatje-pwa.vercel.app';
const TRANSIENT = new Set([408, 425, 429, 500, 502, 503, 504]);
const NETWORK_CODES = new Set(['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'EAI_AGAIN', 'ENOTFOUND', 'UND_ERR_CONNECT_TIMEOUT']);
const API_CODES = new Set(['unauthorized', 'invalid-request', 'cache-unavailable', 'profile-not-verified', 'cache-refresh-failed', 'new-product-maintenance-failed']);
function networkCode(error) {
  for (let depth = 0; error && depth < 4; depth++, error = error.cause) {
    if (NETWORK_CODES.has(error.code)) return error.code;
  }
}
export function maintenanceError(stage, { status, code, host, cause } = {}) {
  return Object.assign(new Error(stage), { stage, status, code, host, cause });
}
export function maintenanceDiagnostic(error) {
  // No bodies, request headers, arbitrary URLs or raw exception messages.
  return JSON.stringify({
    stage: /^[a-z][a-z0-9-]{0,80}$/.test(error?.stage ?? '') ? error.stage : 'unexpected-maintenance-failure',
    status: Number.isInteger(error?.status) ? error.status : undefined,
    code: API_CODES.has(error?.code) || NETWORK_CODES.has(error?.code) || /^(PGRST\d{3}|[0-9]{5})$/.test(error?.code ?? '') ? error.code : undefined,
    cause: networkCode(error?.cause),
    timeout: ['TimeoutError', 'AbortError'].includes(error?.name) || ['TimeoutError', 'AbortError'].includes(error?.cause?.name),
    host: error?.host === 'boodschappenmaatje-pwa.vercel.app' ? error.host : undefined,
  });
}
export async function maintenanceRequest(url, options, { stage, fetcher = fetch,
  wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), timeoutMs = 25000,
  finalCodes = [] } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const response = await fetcher(url, { ...options, redirect: 'manual', signal: AbortSignal.timeout(timeoutMs) });
      if (response.ok) return response;
      const body = await response.json().catch(() => null);
      throw maintenanceError(stage, { status: response.status, code: body?.code ?? body?.error, host: url.hostname });
    } catch (error) {
      const retryable = !finalCodes.includes(error.code) && (TRANSIENT.has(error.status) || Boolean(networkCode(error))
        || ['TimeoutError', 'AbortError'].includes(error.name));
      if (!retryable || attempt >= 2) {
        if (error.stage) throw error;
        throw maintenanceError(stage, { cause: error, host: url.hostname });
      }
      await wait(1000 * 2 ** attempt);
    }
  }
}
export function mealMixRefreshSettings(env) {
  for (const key of ['SUPABASE_URL', 'SUPABASE_SECRET_KEY', 'PLANNER_CACHE_BASE_URL', 'PLANNER_CACHE_ADMIN_TOKEN']) {
    if (!env[key]?.trim()) throw maintenanceError(`missing-${key.toLowerCase().replaceAll('_', '-')}`);
  }
  let base;
  try { base = new URL(env.PLANNER_CACHE_BASE_URL); } catch { throw maintenanceError('invalid-planner-origin'); }
  if (base.origin !== PRODUCTION_PLANNER_ORIGIN || base.username || base.password || base.search || base.hash || base.pathname !== '/') {
    throw maintenanceError('planner-origin-must-be-production');
  }
  return { url: new URL('/api/internal/planner-readiness/mix-refresh', base), headers: {
    'content-type': 'application/json', authorization: `Bearer ${env.PLANNER_CACHE_ADMIN_TOKEN.trim()}`,
    ...(env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() ? { 'x-vercel-protection-bypass': env.VERCEL_AUTOMATION_BYPASS_SECRET.trim() } : {}),
  } };
}
export async function refreshMealMixRecipes(settings, recipeIds, dependencies = {}) {
  const response = await maintenanceRequest(settings.url, { method: 'POST', headers: settings.headers,
    body: JSON.stringify({ recipeIds }) }, { stage: 'meal-mix-cache-refresh', timeoutMs: 120000,
    // The route answers 503 cache-refresh-failed when the database guard keeps
    // the readiness pending; repeating the same write cannot change that.
    finalCodes: ['cache-refresh-failed'], ...dependencies });
  const data = await response.json().catch(() => null);
  if (!Array.isArray(data?.refreshedRecipeIds) || data.refreshedRecipeIds.length !== recipeIds.length
    || recipeIds.some((id) => !data.refreshedRecipeIds.includes(id))) throw maintenanceError('invalid-cache-refresh-response');
}
