import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isPlannerCacheAdminRequest } from "@/server/planner-cache-auth";
import { parseExplicitRecipeLinkInput, refreshExplicitRecipeReadiness } from "@/server/explicit-recipe-readiness";

export const runtime = "nodejs";

function inputFromSearchParams(params: URLSearchParams) {
  return parseExplicitRecipeLinkInput({ sku: params.get("sku"), recipeId: params.get("recipeId") });
}

// Preview is a read-only evaluation of the same bounded link contract.
export async function GET(request: Request): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") return Response.json({ error: "not-found" }, { status: 404 });
  const input = inputFromSearchParams(new URL(request.url).searchParams);
  if (!input) return Response.json({ error: "invalid-request" }, { status: 400 });
  const config = getPublicSupabaseConfig();
  if (!config.configured) return Response.json({ error: "cache-unavailable" }, { status: 503 });
  const client = createClient(config.value.url, config.value.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  try {
    return Response.json(await refreshExplicitRecipeReadiness(client, input, { persist: false }));
  } catch {
    return Response.json({ error: "explicit-refresh-blocked" }, { status: 409 });
  }
}

// The only authorized write from this route is readiness cache for one
// allowlisted recipe link. Preview deployments stay read-only.
export async function POST(request: Request): Promise<Response> {
  if (!isPlannerCacheAdminRequest(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (process.env.VERCEL_ENV !== "production") return Response.json({ error: "write-environment-unavailable" }, { status: 503 });
  let input;
  try { input = parseExplicitRecipeLinkInput(await request.json()); }
  catch { input = null; }
  if (!input) return Response.json({ error: "invalid-request" }, { status: 400 });
  const client = getSupabaseServerClient();
  if (!client) return Response.json({ error: "cache-unavailable" }, { status: 503 });
  try {
    return Response.json(await refreshExplicitRecipeReadiness(client, input));
  } catch {
    return Response.json({ error: "explicit-refresh-blocked" }, { status: 409 });
  }
}
