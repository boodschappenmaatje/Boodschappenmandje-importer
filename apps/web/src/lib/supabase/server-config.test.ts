import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as sdk from "@supabase/supabase-js";

// Call the real SDK by default; only the construction-exception case overrides it.
vi.mock("@supabase/supabase-js", async (original) => {
  const actual = await original<typeof import("@supabase/supabase-js")>();
  return { ...actual, createClient: vi.fn(actual.createClient) };
});
vi.mock("@/server/planner-new-products", async (original) => ({
  ...await original<typeof import("@/server/planner-new-products")>(),
  maintainPlannerForNewProducts: vi.fn(async () => ({ productCount: 1 })),
}));

const endpoint = "https://fixture-only.invalid";
const key = "sb_secret_fixture_only";
const fetchStub = vi.fn();
beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchStub);
  vi.stubEnv("SUPABASE_URL", endpoint);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://fallback.invalid");
  vi.stubEnv("SUPABASE_SECRET_KEY", key);
  vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "fixture-admin");
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const cases = [
  { name: "both URLs absent", env: { SUPABASE_URL: undefined, NEXT_PUBLIC_SUPABASE_URL: undefined }, reason: "supabase-url-missing" },
  { name: "empty explicit URL blocks fallback", env: { SUPABASE_URL: "" }, reason: "supabase-url-missing" },
  { name: "whitespace explicit URL blocks fallback", env: { SUPABASE_URL: " \t " }, reason: "supabase-url-missing" },
  { name: "malformed URL", env: { SUPABASE_URL: "not-a-url" }, reason: "supabase-url-invalid" },
  { name: "non-HTTPS URL", env: { SUPABASE_URL: "http://fixture.invalid" }, reason: "supabase-url-invalid" },
  { name: "missing secret", env: { SUPABASE_SECRET_KEY: undefined }, reason: "supabase-secret-missing" },
  { name: "blank secret", env: { SUPABASE_SECRET_KEY: " \n " }, reason: "supabase-secret-missing" },
  { name: "publishable key", env: { SUPABASE_SECRET_KEY: "sb_publishable_fixture" }, reason: "supabase-secret-publishable" },
  { name: "embedded newline", env: { SUPABASE_SECRET_KEY: "sb_secret_fixture\ninvalid" }, reason: "supabase-secret-header-invalid" },
  { name: "embedded carriage return", env: { SUPABASE_SECRET_KEY: "sb_secret_fixture\rinvalid" }, reason: "supabase-secret-header-invalid" },
  { name: "non-ByteString header", env: { SUPABASE_SECRET_KEY: "sb_secret_fixture\u0100" }, reason: "supabase-secret-header-invalid" },
] as const;

function request(token = "fixture-admin") {
  return new Request("https://fixture.invalid/api/internal/planner-readiness/new-products", {
    method: "POST", headers: { authorization: `Bearer ${token}` },
    body: JSON.stringify({ productIds: ["00000000-0000-4000-8000-000000000001"] }),
  });
}

describe("real server config to authenticated maintenance route", () => {
  it.each(cases)("$name gives exactly one safe reason before maintenance", async ({ env, reason }) => {
    for (const [name, value] of Object.entries(env)) vi.stubEnv(name, value);
    const server = await import("./server");
    expect(server.getSupabaseServerClient()).toBeNull();
    const result = server.getSupabaseServerClientResult();
    expect(result).toEqual({ client: null, reason });
    expect(server.getSupabaseServerClientResult()).toBe(result);
    const { POST } = await import("@/app/api/internal/planner-readiness/new-products/route");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "cache-unavailable", reason });
    const { maintainPlannerForNewProducts } = await import("@/server/planner-new-products");
    expect(maintainPlannerForNewProducts).not.toHaveBeenCalled();
    expect(sdk.createClient).not.toHaveBeenCalled();
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it.each([key, "eyJ.legacy.fixture"])("valid server key constructs and reaches maintenance (%s)", async (secret) => {
    vi.stubEnv("SUPABASE_SECRET_KEY", `  ${secret}\n`);
    vi.stubEnv("SUPABASE_URL", ` ${endpoint}/path?ignored=true `);
    const { getSupabaseServerClientResult } = await import("./server");
    const result = getSupabaseServerClientResult();
    expect(result.client).not.toBeNull();
    expect(result.reason).toBeNull();
    expect(getSupabaseServerClientResult()).toBe(result);
    expect(sdk.createClient).toHaveBeenCalledExactlyOnceWith(endpoint, secret, expect.objectContaining({
      accessToken: expect.any(Function),
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: expect.any(Function) },
    }));
    const { POST } = await import("@/app/api/internal/planner-readiness/new-products/route");
    expect((await POST(request())).status).toBe(200);
    const { maintainPlannerForNewProducts } = await import("@/server/planner-new-products");
    expect(maintainPlannerForNewProducts).toHaveBeenCalledExactlyOnceWith(result.client, expect.any(Array));
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("uses the public URL only when the server URL is absent", async () => {
    vi.stubEnv("SUPABASE_URL", undefined);
    const { getSupabaseServerClientResult } = await import("./server");
    expect(getSupabaseServerClientResult().reason).toBeNull();
    expect(sdk.createClient).toHaveBeenCalledWith("https://fallback.invalid", key, expect.any(Object));
  });

  it("redacts construction exceptions and memoizes the safe failure", async () => {
    vi.mocked(sdk.createClient).mockImplementationOnce(() => { throw new Error("private raw exception"); });
    const { POST } = await import("@/app/api/internal/planner-readiness/new-products/route");
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "cache-unavailable", reason: "client-construction-failed" });
    const { getSupabaseServerClientResult } = await import("./server");
    expect(getSupabaseServerClientResult()).toEqual({ client: null, reason: "client-construction-failed" });
    expect(sdk.createClient).toHaveBeenCalledTimes(1);
    expect(fetchStub).not.toHaveBeenCalled();
  });

  it("does not reveal configuration reasons before authorization", async () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", undefined);
    const { POST } = await import("@/app/api/internal/planner-readiness/new-products/route");
    const response = await POST(request("wrong"));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized" });
    expect(sdk.createClient).not.toHaveBeenCalled();
  });
});
