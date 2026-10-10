import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { refreshExplicitRecipeReadiness } from "@/server/explicit-recipe-readiness";

vi.mock("@/lib/supabase/config", () => ({ getPublicSupabaseConfig: () => ({ configured: true, value: { url: "https://db.example.test", publishableKey: "public" } }) }));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn() }));
vi.mock("@/server/explicit-recipe-readiness", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/server/explicit-recipe-readiness")>(),
  refreshExplicitRecipeReadiness: vi.fn(),
}));

afterEach(() => vi.unstubAllEnvs());
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(refreshExplicitRecipeReadiness).mockResolvedValue({
    sku: "686060000", recipeId: "6593543a-5c8d-409d-8c9e-145632c43f0b", readiness: [],
    readinessWrites: 0, profileStatus: "needs_review", profilePromoted: false, matchCacheWrites: 0,
    evaluationMode: "full",
  });
});

const recipeId = "6593543a-5c8d-409d-8c9e-145632c43f0b";
const body = { sku: "686060000", recipeId };
const preflightBody = { ...body, preflight: true };
const request = (authorization?: string) => new Request("https://preview.example.test/api/internal/planner-readiness/explicit-recipe-refresh", {
  method: "POST", headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) }, body: JSON.stringify(body),
});

describe("explicit recipe readiness route", () => {
  it("keeps every non-Production POST read-only even for an admin token", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "secret");
    vi.stubEnv("VERCEL_ENV", "preview");
    const response = await POST(request("Bearer secret"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "write-environment-unavailable" });
    vi.stubEnv("VERCEL_ENV", "development");
    expect((await POST(request("Bearer secret"))).status).toBe(503);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
    expect(refreshExplicitRecipeReadiness).not.toHaveBeenCalled();
  });

  it("only exposes read-only GET evaluation on Preview", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await GET(new Request(`https://app.test/?sku=${body.sku}&recipeId=${recipeId}`))).status).toBe(404);
    vi.stubEnv("VERCEL_ENV", "preview");
    const response = await GET(new Request(`https://app.test/?sku=${body.sku}&recipeId=${recipeId}`));
    expect(response.status).toBe(200);
    expect(refreshExplicitRecipeReadiness).toHaveBeenCalledWith(expect.anything(), body, { persist: false });
  });

  it("requires authorization and a valid explicit link before the write client is accessed", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "secret");
    vi.stubEnv("VERCEL_ENV", "production");
    expect((await POST(request())).status).toBe(401);
    const invalid = new Request("https://app.test", { method: "POST", headers: { authorization: "Bearer secret", "content-type": "application/json" }, body: JSON.stringify({ sku: body.sku, recipeId: "00000000-0000-4000-8000-000000000001" }) });
    expect((await POST(invalid)).status).toBe(400);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });

  it("accepts the authenticated Production preflight through the existing evaluator with persistence disabled", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "secret");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.mocked(getSupabaseServerClient).mockReturnValue({} as NonNullable<ReturnType<typeof getSupabaseServerClient>>);
    const response = await POST(new Request("https://app.test", {
      method: "POST", headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify(preflightBody),
    }));
    expect(response.status).toBe(200);
    expect(refreshExplicitRecipeReadiness).toHaveBeenCalledExactlyOnceWith(expect.anything(), body, {
      persist: false,
      evaluationMode: "preflight",
    });
  });
});
