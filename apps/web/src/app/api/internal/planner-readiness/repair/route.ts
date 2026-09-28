import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isPlannerCacheAdminRequest } from "@/server/planner-cache-auth";
import { repairIngredientProductMatch } from "@/server/planner-cache-service";

export const runtime = "nodejs";

type DatabaseReadCode =
  | "database-read-ok"
  | "database-http-auth-failed"
  | "database-http-permission-failed"
  | "database-http-not-found"
  | "database-http-server-error"
  | "database-http-other-failed"
  | "database-network-failed"
  | "database-sdk-query-failed"
  | "database-unexpected-response";

/** The SDK folds transport and response-processing exceptions into status 0.
 * Only its known fetch/abort signatures justify calling that case a network failure.
 */
function databaseReadOutcome(result: unknown): { code: DatabaseReadCode; upstreamStatus: number | null } {
  if (!result || typeof result !== "object") {
    return { code: "database-unexpected-response", upstreamStatus: null };
  }
  const value = result as Record<string, unknown>;
  const status = typeof value.status === "number" && Number.isInteger(value.status) &&
    value.status >= 0 && value.status <= 599 ? value.status : null;
  const upstreamStatus = status !== null && status >= 100 ? status : null;
  if (status === 401) return { code: "database-http-auth-failed", upstreamStatus };
  if (status === 403) return { code: "database-http-permission-failed", upstreamStatus };
  if (status === 404) return { code: "database-http-not-found", upstreamStatus };
  if (status !== null && status >= 500) return { code: "database-http-server-error", upstreamStatus };
  if (status === 0) {
    const error = value.error;
    if (!error) return { code: "database-unexpected-response", upstreamStatus: null };
    const message = error && typeof error === "object" ? (error as Record<string, unknown>).message : null;
    const hint = error && typeof error === "object" ? (error as Record<string, unknown>).hint : null;
    return {
      code: message === "TypeError: fetch failed" ||
        hint === "Request was aborted (timeout or manual cancellation)"
        ? "database-network-failed" : "database-sdk-query-failed",
      upstreamStatus: null,
    };
  }
  if (status !== null && status >= 400) return { code: "database-http-other-failed", upstreamStatus };
  if (value.error) return { code: "database-sdk-query-failed", upstreamStatus };
  if ((status === 200 || status === 206) && Array.isArray(value.data)) {
    return { code: "database-read-ok", upstreamStatus };
  }
  return { code: "database-unexpected-response", upstreamStatus };
}

export async function POST(request: Request): Promise<Response> {
  if (!isPlannerCacheAdminRequest(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: Record<string, unknown>;
  try {
    const value = await request.json();
    body = typeof value === "object" && value !== null
      ? value as Record<string, unknown>
      : {};
  } catch {
    return Response.json({ error: "invalid-request" }, { status: 400 });
  }
  // The exact sentinel is admin-only. It cannot enter the match repair path.
  const databaseReadProbe = Object.keys(body).length === 1 && body.databaseReadProbe === "v1";
  const client = getSupabaseServerClient();
  if (!client) {
    return databaseReadProbe
      ? Response.json({ code: "database-client-unavailable", authenticated: true,
        serverClientAvailable: false, databaseReadSuccess: false, databaseWrites: 0 }, { status: 503 })
      : Response.json({ error: "cache-unavailable" }, { status: 503 });
  }
  if (databaseReadProbe) {
    try {
      const result = await client.from("meal_mix_profiles").select("recipe_id").limit(1).retry(false);
      const outcome = databaseReadOutcome(result);
      return Response.json({ ...outcome, authenticated: true,
        serverClientAvailable: true, databaseReadSuccess: outcome.code === "database-read-ok",
        databaseWrites: 0 }, { status: outcome.code === "database-read-ok" ? 200 : 502 });
    } catch (error) {
      const code = error instanceof Error &&
        ((error instanceof TypeError && error.message === "fetch failed") || error.name === "AbortError")
        ? "database-network-failed" : "database-sdk-query-failed";
      return Response.json({ code, upstreamStatus: null,
        authenticated: true, serverClientAvailable: true, databaseReadSuccess: false,
        databaseWrites: 0 }, { status: 502 });
    }
  }
  const matchKey = typeof body.matchKey === "string" ? body.matchKey.trim() : "";
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  if (!matchKey || !productId || matchKey.length > 300 || productId.length > 80) {
    return Response.json({ error: "invalid-request" }, { status: 400 });
  }
  try {
    const result = await repairIngredientProductMatch(client, { matchKey, productId });
    return Response.json(result);
  } catch {
    return Response.json({ error: "repair-failed" }, { status: 422 });
  }
}
