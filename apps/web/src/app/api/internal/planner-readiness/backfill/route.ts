import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isPlannerCacheAdminRequest } from "@/server/planner-cache-auth";
import { backfillPlannerReadinessBatch } from "@/server/planner-cache-service";

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
  const numberOfPeople = Number(body.numberOfPeople);
  const afterSourceKey = typeof body.afterSourceKey === "string"
    ? body.afterSourceKey.slice(0, 160)
    : null;
  const batchSize = Number(body.batchSize ?? 10);
  try {
    const result = await backfillPlannerReadinessBatch(client, {
      numberOfPeople,
      afterSourceKey,
      batchSize,
    });
    return Response.json(result);
  } catch {
    return Response.json({ error: "backfill-failed" }, { status: 503 });
  }
}
