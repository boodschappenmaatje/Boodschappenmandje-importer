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
    // Headers rejects embedded control characters only when a request starts.
    // Fail closed while configuring the client, before any maintenance begins.
    new Headers({ apikey: secret });
    return { url: parsed.origin, secret };
  } catch {
    return null;
  }
}

function createServerClient(config: { url: string; secret: string }, requestFetch: typeof fetch): SupabaseClient {
  const modernSecret = config.secret.startsWith("sb_secret_");
  const keyOnlyFetch: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    // A modern secret is an API key, not a user JWT. The pinned SDK otherwise
    // falls back to sending it as a Bearer token on PostgREST requests.
    if (modernSecret && headers.get("Authorization") === `Bearer ${config.secret}`) {
      headers.delete("Authorization");
    }
    return requestFetch(input, { ...init, headers });
  };
  return createClient(config.url, config.secret, {
    // These server-only routes never operate as a signed-in user. Skip the
    // SDK's implicit auth.getSession() before each database fetch.
    accessToken: async () => null,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: { fetch: keyOnlyFetch },
  });
}

/** Server-only by placement: this module is imported exclusively by Route Handlers. */
export function getSupabaseServerClient(): SupabaseClient | null {
  if (serverClient !== undefined) return serverClient;
  const config = serverSupabaseConfig();
  if (!config) {
    serverClient = null;
    return serverClient;
  }
  serverClient = createServerClient(config, globalThis.fetch);
  return serverClient;
}

