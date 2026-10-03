import { createClient } from "@supabase/supabase-js";
import { getPublicSupabaseConfig } from "@/lib/supabase/config";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isPlannerCacheAdminRequest } from "@/server/planner-cache-auth";
import {
  BoundedReadinessConflict,
  dryRunBoundedReadiness,
  parseBoundedRefreshInput,
  writeBoundedReadiness,
} from "@/server/bounded-readiness-maintenance";

export const runtime = "nodejs";

// Preview is Vercel-authenticated and read-only. This permits a real dry-run
// without making the maintenance token available to the browser or tooling.
export async function GET(request: Request): Promise<Response> {
  if (process.env.VERCEL_ENV !== "preview") return Response.json({ error: "not-found" }, { status: 404 });
  const params = new URL(request.url).searchParams;
  const input = parseBoundedRefreshInput({
    recipeIds: params.getAll("recipeId"),
    matchKeys: params.getAll("matchKey"),
  });
  if (!input) return Response.json({ error: "invalid-request" }, { status: 400 });
  const publicConfig = getPublicSupabaseConfig();
  if (!publicConfig.configured) return Response.json({ error: "cache-unavailable" }, { status: 503 });
  const client = createClient(publicConfig.value.url, publicConfig.value.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  try {
    const plan = await dryRunBoundedReadiness(client, input, false);
    return Response.json(plan, { status: plan.blocked ? 409 : 200 });
  } catch (error) {
    if (error instanceof BoundedReadinessConflict) {
      return Response.json({ blocked: true, reason: error.message, matchWrites: 0, readinessWrites: 0 }, { status: 409 });
    }
    return Response.json({ error: "bounded-refresh-failed" }, { status: 503 });
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!isPlannerCacheAdminRequest(request)) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: unknown;
  try { body = await request.json(); }
  catch { return Response.json({ error: "invalid-request" }, { status: 400 }); }
  const input = parseBoundedRefreshInput(body);
  const mode = typeof body === "object" && body !== null ? (body as { mode?: unknown }).mode : null;
  if (!input || (mode !== "dry-run" && mode !== "write")) {
    return Response.json({ error: "invalid-request" }, { status: 400 });
  }
  if (mode === "write" && process.env.VERCEL_ENV !== "production") {
    return Response.json({ error: "preview-read-only" }, { status: 503 });
  }
  const client = getSupabaseServerClient();
  if (!client) return Response.json({ error: "cache-unavailable" }, { status: 503 });
  try {
    const result = mode === "dry-run"
      ? await dryRunBoundedReadiness(client, input)
      : await writeBoundedReadiness(client, input);
    return Response.json(result, { status: result.blocked ? 409 : 200 });
  } catch (error) {
    if (error instanceof BoundedReadinessConflict) {
      return Response.json({ blocked: true, reason: error.message, matchWrites: 0, readinessWrites: 0 }, { status: 409 });
    }
    return Response.json({ error: "bounded-refresh-failed" }, { status: 503 });
  }
}
