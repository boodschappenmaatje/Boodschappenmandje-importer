import { getSupabaseServerClientResult } from "@/lib/supabase/server";
import { isPlannerCacheAdminRequest } from "@/server/planner-cache-auth";
import { maintainPlannerForNewProducts, parseNewProductIds } from "@/server/planner-new-products";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  if (!isPlannerCacheAdminRequest(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  let ids: string[] | null;
  try {
    const text = await request.text();
    ids = text.length <= 4096 ? parseNewProductIds(JSON.parse(text)) : null;
  } catch {
    ids = null;
  }
  if (!ids) return Response.json({ error: "invalid-request" }, { status: 400 });
  const { client, reason } = getSupabaseServerClientResult();
  if (!client) return Response.json({ error: "cache-unavailable", reason }, { status: 503 });
  try {
    return Response.json(await maintainPlannerForNewProducts(client, ids));
  } catch {
    return Response.json({ error: "new-product-maintenance-failed", retryable: true }, { status: 503 });
  }
}
