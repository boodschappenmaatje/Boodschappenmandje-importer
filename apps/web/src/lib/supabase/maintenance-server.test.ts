import { afterEach, describe, expect, it, vi } from "vitest";
import { createClient } from "@supabase/supabase-js";

const endpoint = "https://local-only.invalid";
const key = "sb_secret_local_fixture";

async function clientWith(fetchStub: typeof fetch, credential = key) {
  vi.stubEnv("SUPABASE_URL", endpoint);
  vi.stubEnv("SUPABASE_SECRET_KEY", credential);
  vi.stubGlobal("fetch", fetchStub);
  vi.resetModules();
  const { getSupabaseServerClient } = await import("./server");
  return getSupabaseServerClient();
}

describe("server-only maintenance Supabase client", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  it("reproduces the old session failure before fetch in the pinned SDK", async () => {
    const fetchStub = vi.fn(async () => new Response("[]", { status: 200 }));
    const oldClient = createClient(endpoint, key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: fetchStub },
    });
    vi.spyOn(oldClient.auth, "getSession").mockRejectedValue(new Error("fixture session failure"));
    const result = await oldClient.from("meal_mix_profiles").select("recipe_id").limit(1).retry(false);
    expect(result.status).toBe(0);
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("reaches one read-only fetch without a user session or Bearer secret", async () => {
    const fetchStub = vi.fn(async () => new Response("[]", { status: 200 }));
    const client = await clientWith(fetchStub);
    expect(client).not.toBeNull();
    expect(() => client!.auth.getSession).toThrow();
    const result = await client!.from("meal_mix_profiles").select("recipe_id").limit(1).retry(false);
    expect(result).toMatchObject({ status: 200, error: null, data: [] });
    expect(fetchStub).toHaveBeenCalledTimes(1);
    const [input, init] = fetchStub.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    expect(new URL(String(input)).pathname).toBe("/rest/v1/meal_mix_profiles");
    expect(init.method).toBe("GET");
    expect(new Headers(init.headers).get("apikey")).toBe(key);
    expect(new Headers(init.headers).has("Authorization")).toBe(false);
    const { getSupabaseServerClient } = await import("./server");
    expect(getSupabaseServerClient()).toBe(client);
  });

  it("preserves legacy service-role JWT Bearer fallback", async () => {
    const fetchStub = vi.fn(async () => new Response("[]", { status: 200 }));
    const client = await clientWith(fetchStub, "eyJ.legacy.fixture");
    expect((await client!.from("meal_mix_profiles").select("recipe_id").limit(1).retry(false)).status).toBe(200);
    const [, init] = fetchStub.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit];
    expect(new Headers(init.headers).get("Authorization")).toBe("Bearer eyJ.legacy.fixture");
  });

  it("fails closed for an invalid credential before starting maintenance", async () => {
    const fetchStub = vi.fn();
    expect(await clientWith(fetchStub, "sb_secret_local\ninvalid")).toBeNull();
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("returns an actual HTTP error without retrying or leaking rows", async () => {
    const fetchStub = vi.fn(async () => new Response('{"code":"fixture-denied"}', {
      status: 403, headers: { "content-type": "application/json" },
    }));
    const client = await clientWith(fetchStub);
    const result = await client!.from("meal_mix_profiles").select("recipe_id").limit(1).retry(false);
    expect(result.status).toBe(403);
    expect(fetchStub).toHaveBeenCalledTimes(1);
  });
});
