import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSameOriginPlannerRequest } from "@/server/planner-cache-auth";
import {
  parsePlannerCacheRefreshInput,
  refreshPlannerReadiness,
} from "@/server/planner-cache-service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!isSameOriginPlannerRequest(request)) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }
  const client = getSupabaseServerClient();
  if (!client) {
    return Response.json({ error: "cache-unavailable" }, { status: 503 });
  }
  let input: ReturnType<typeof parsePlannerCacheRefreshInput>;
  try {
    input = parsePlannerCacheRefreshInput(await request.json());
  } catch {
    input = null;
  }
  if (!input) {
    return Response.json({ error: "invalid-request" }, { status: 400 });
  }
  try {
    const result = await refreshPlannerReadiness(client, input);
    return Response.json(result);
  } catch {
    return Response.json({ error: "refresh-failed" }, { status: 503 });
  }
}
