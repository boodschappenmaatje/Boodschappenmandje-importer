import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isPlannerCacheAdminRequest } from "@/server/planner-cache-auth";
import { repairIngredientProductMatch } from "@/server/planner-cache-service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!isPlannerCacheAdminRequest(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const client = getSupabaseServerClient();
  if (!client) {
    return Response.json({ error: "cache-unavailable" }, { status: 503 });
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
