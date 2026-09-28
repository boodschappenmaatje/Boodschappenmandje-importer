import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isPlannerCacheAdminRequest } from "@/server/planner-cache-auth";
import { repairIngredientProductMatch } from "@/server/planner-cache-service";

export const runtime = "nodejs";

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
      const result = await client.from("meal_mix_profiles").select("recipe_id").limit(1);
      if (result.error || !Array.isArray(result.data) || ![200, 206].includes(result.status)) {
        throw new Error("database-read-failed");
      }
      return Response.json({ code: "database-read-ok", authenticated: true,
        serverClientAvailable: true, databaseReadSuccess: true, databaseWrites: 0 });
    } catch {
      return Response.json({ code: "database-read-failed", authenticated: true,
        serverClientAvailable: true, databaseReadSuccess: false, databaseWrites: 0 }, { status: 502 });
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
