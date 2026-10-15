import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { getPublicSupabaseConfig } from "@/lib/supabase/config";

export type SupabaseServerFailureReason =
  | "supabase-url-missing"
  | "supabase-secret-missing"
  | "supabase-secret-publishable"
  | "supabase-url-invalid"
  | "supabase-secret-header-invalid"
  | "client-construction-failed";

type ServerClientResult =
  | { client: SupabaseClient; reason: null }
  | { client: null; reason: SupabaseServerFailureReason };
type ConfigResult =
  | { config: { url: string; secret: string }; reason: null }
  | { config: null; reason: SupabaseServerFailureReason };

let serverClientResult: ServerClientResult | undefined;

function serverSupabaseConfig(): ConfigResult {
  const rawUrl = (
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
  )?.trim();
  const secret = process.env.SUPABASE_SECRET_KEY?.trim();
  if (!rawUrl) return { config: null, reason: "supabase-url-missing" };
  if (!secret) return { config: null, reason: "supabase-secret-missing" };
  if (secret.startsWith("sb_publishable_")) return { config: null, reason: "supabase-secret-publishable" };

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return { config: null, reason: "supabase-url-invalid" };
  } catch {
    return { config: null, reason: "supabase-url-invalid" };
  }
  try {
    // Headers rejects embedded control characters only when a request starts.
    // Fail closed while configuring the client, before any maintenance begins.
    new Headers({ apikey: secret });
  } catch {
    return { config: null, reason: "supabase-secret-header-invalid" };
  }
  return { config: { url: parsed.origin, secret }, reason: null };
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
  return getSupabaseServerClientResult().client;
}

/** Safe diagnostic for authenticated server routes; never includes config or exceptions. */
export function getSupabaseServerClientResult(): ServerClientResult {
  if (serverClientResult !== undefined) return serverClientResult;
  const { config, reason } = serverSupabaseConfig();
  if (!config) {
    serverClientResult = { client: null, reason };
  } else {
    try {
      serverClientResult = { client: createServerClient(config, globalThis.fetch), reason: null };
    } catch {
      serverClientResult = { client: null, reason: "client-construction-failed" };
    }
  }
  return serverClientResult;
}

let publicServerClient: SupabaseClient | null | undefined;

/**
 * Leest openbare data (de catalogus) met de publishable sleutel, net als de app
 * zelf. Heeft geen geheime sleutel nodig, dus werkt ook op elke Preview.
 */
export function getSupabasePublicServerClient(): SupabaseClient | null {
  if (publicServerClient !== undefined) return publicServerClient;
  const config = getPublicSupabaseConfig();
  publicServerClient = config.configured
    ? createClient(config.value.url, config.value.publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    })
    : null;
  return publicServerClient;
}
