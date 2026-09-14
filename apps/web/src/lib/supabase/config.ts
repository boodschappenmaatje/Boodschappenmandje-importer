export interface PublicSupabaseConfig {
  url: string;
  publishableKey: string;
}

export type PublicSupabaseConfigResult =
  | { configured: true; value: PublicSupabaseConfig }
  | { configured: false; reason: "missing" | "invalid-url" | "secret-key" };

export function parsePublicSupabaseConfig(input: {
  url?: string;
  publishableKey?: string;
}): PublicSupabaseConfigResult {
  const url = input.url?.trim();
  const publishableKey = input.publishableKey?.trim();

  if (!url || !publishableKey) {
    return { configured: false, reason: "missing" };
  }

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== "https:") {
      return { configured: false, reason: "invalid-url" };
    }
  } catch {
    return { configured: false, reason: "invalid-url" };
  }

  const normalizedKey = publishableKey.toLowerCase();
  if (
    normalizedKey.startsWith("sb_secret_") ||
    normalizedKey.includes("service_role")
  ) {
    return { configured: false, reason: "secret-key" };
  }

  return {
    configured: true,
    value: { url, publishableKey },
  };
}

export function getPublicSupabaseConfig(): PublicSupabaseConfigResult {
  return parsePublicSupabaseConfig({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
}
