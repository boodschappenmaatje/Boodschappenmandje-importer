import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isPlannerCacheAdminRequest } from "@/server/planner-cache-auth";
import { refreshPlannerReadiness, PLANNER_MAINTENANCE_PEOPLE_COUNTS } from "@/server/planner-cache-service";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!isPlannerCacheAdminRequest(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  let recipeIds: string[];
  try {
    const body = await request.json();
    if (!Array.isArray(body.recipeIds) || body.recipeIds.length < 1 || body.recipeIds.length > 5 ||
      body.recipeIds.some((id: unknown) => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id))) throw Error();
    recipeIds = [...new Set(body.recipeIds)] as string[];
  } catch { return Response.json({ error: "invalid-request" }, { status: 400 }); }
  const client = getSupabaseServerClient();
  if (!client) return Response.json({ error: "cache-unavailable" }, { status: 503 });
  try {
    const profiles = await client.from("meal_mix_profiles").select("recipe_id")
      .in("recipe_id", recipeIds).eq("status", "verified");
    if (profiles.error || profiles.data.length !== recipeIds.length) return Response.json({ error: "profile-not-verified" }, { status: 409 });
    for (const numberOfPeople of PLANNER_MAINTENANCE_PEOPLE_COUNTS) await refreshPlannerReadiness(client, { recipeIds, numberOfPeople });
    return Response.json({ refreshedRecipeIds: recipeIds });
  } catch { return Response.json({ error: "cache-refresh-failed" }, { status: 503 }); }
}
