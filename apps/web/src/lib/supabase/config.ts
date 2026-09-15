export interface PublicSupabaseConfig {
  url: string;
  publishableKey: string;
}

export type PublicSupabaseConfigResult =
  | { configured: true; value: PublicSupabaseConfig }
  | { configured: false; reason: "missing" | "invalid-url" | "secret-key" };

function hasPrivilegedJwtRole(value: string): boolean {
  const payload = value.split(".")[1];
  if (!payload) {
    return false;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(globalThis.atob(normalized)) as unknown;
    return (
      typeof decoded === "object" &&
      decoded !== null &&
      "role" in decoded &&
      (decoded as { role?: unknown }).role === "service_role"
    );
  } catch {
    return false;
  }
}

export function parsePublicSupabaseConfig(input: {
  url?: string;
  publishableKey?: string;
}): PublicSupabaseConfigResult {
  const url = input.url?.trim();
  const publishableKey = input.publishableKey?.trim();

  if (!url || !publishableKey) {
    return { configured: false, reason: "missing" };
  }

  let normalizedUrl: string;
  try {
    const parsedUrl = new URL(url);
    const normalizedPath = parsedUrl.pathname.replace(/\/+$/, "");
    if (
      parsedUrl.protocol !== "https:" ||
      (normalizedPath && normalizedPath !== "/rest/v1")
    ) {
      return { configured: false, reason: "invalid-url" };
    }
    normalizedUrl = parsedUrl.origin;
  } catch {
    return { configured: false, reason: "invalid-url" };
  }

  const normalizedKey = publishableKey.toLowerCase();
  if (
    normalizedKey.startsWith("sb_secret_") ||
    normalizedKey.includes("service_role") ||
    hasPrivilegedJwtRole(publishableKey)
  ) {
    return { configured: false, reason: "secret-key" };
  }

  return {
    configured: true,
    value: { url: normalizedUrl, publishableKey },
  };
}

export function getPublicSupabaseConfig(): PublicSupabaseConfigResult {
  return parsePublicSupabaseConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });
}
