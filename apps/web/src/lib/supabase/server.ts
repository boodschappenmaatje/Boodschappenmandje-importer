import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let serverClient: SupabaseClient | null | undefined;

function serverSupabaseConfig(): { url: string; secret: string } | null {
  const rawUrl = (
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  )?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl || !secret || secret.startsWith("sb_publishable_")) return null;

  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return null;
    return { url: parsed.origin, secret };
  } catch {
    return null;
  }
}

/** Server-only by placement: this module is imported exclusively by Route Handlers. */
export function getSupabaseServerClient(): SupabaseClient | null {
  if (serverClient !== undefined) return serverClient;
  const config = serverSupabaseConfig();
  if (!config) {
    serverClient = null;
    return serverClient;
  }
  serverClient = createClient(config.url, config.secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return serverClient;
}
