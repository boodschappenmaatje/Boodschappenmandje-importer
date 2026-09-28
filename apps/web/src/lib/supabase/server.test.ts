import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseServerClientForReadProbe } from "./server";

describe("isolated read-only Production client instrumentation", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses the same server-only URL/key resolution and only the injected fetch", async () => {
    vi.stubEnv("SUPABASE_URL", "https://canonical.local.invalid/path");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://ignored.local.invalid");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_local_only");
    const probeFetch = vi.fn(async () => new Response("[]", { status: 200 }));
    const client = getSupabaseServerClientForReadProbe(probeFetch);
    expect(client).not.toBeNull();
    const result = await client!.from("meal_mix_profiles").select("recipe_id").limit(1).retry(false);
    expect(result.status).toBe(200);
    expect(probeFetch).toHaveBeenCalledTimes(1);
    const [input, init] = probeFetch.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    const url = new URL(String(input));
    expect(url.origin).toBe("https://canonical.local.invalid");
    expect(url.pathname).toBe("/rest/v1/meal_mix_profiles");
    expect(url.searchParams.get("select")).toBe("recipe_id");
    expect(url.searchParams.get("limit")).toBe("1");
    expect(init.method).toBe("GET");
  });

  it("returns no client when the server-only configuration is absent", () => {
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "");
    expect(getSupabaseServerClientForReadProbe(vi.fn())).toBeNull();
  });
});
