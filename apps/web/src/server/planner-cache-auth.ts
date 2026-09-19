export function isSameOriginPlannerRequest(request: Request): boolean {
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite === "same-origin") return true;
  const origin = request.headers.get("origin");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function isPlannerCacheAdminRequest(request: Request): boolean {
  const expected = process.env.PLANNER_CACHE_ADMIN_TOKEN?.trim();
  if (!expected) return false;
  const authorization = request.headers.get("authorization") ?? "";
  return authorization === `Bearer ${expected}`;
}
