import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { BoundedReadinessConflict, verifyBoundedReadiness, writeBoundedReadiness } from "@/server/bounded-readiness-maintenance";

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn() }));
vi.mock("@/server/bounded-readiness-maintenance", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/server/bounded-readiness-maintenance")>(), writeBoundedReadiness: vi.fn(),
  verifyBoundedReadiness: vi.fn(),
}));

afterEach(() => vi.unstubAllEnvs());

describe("bounded readiness route", () => {
  const body = {
    recipeIds: ["00000000-0000-4000-8000-000000000001"],
    matchKeys: ["meal-mix-ingredient:mix-supplement-tomaten:piece:ingredient:generic"],
    expectedPlanToken: "a".repeat(64),
    mode: "write",
  };
  const request = (authorization?: string) => new Request("https://example.test/api/internal/planner-readiness/bounded-refresh", {
    method: "POST",
    headers: { "content-type": "application/json", ...(authorization ? { authorization } : {}) },
    body: JSON.stringify(body),
  });

  it("weigert ongeautoriseerde requests zonder databaseactie", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "secret");
    expect((await POST(request())).status).toBe(401);
  });

  it("weigert iedere Preview-write vóór het ophalen van een databaseclient", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "secret");
    vi.stubEnv("VERCEL_ENV", "preview");
    const response = await POST(request("Bearer secret"));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "preview-read-only" });
  });

  it("biedt de publieke dry-run uitsluitend achter de Preview-deployment aan", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const response = await GET(new Request("https://example.test/api/internal/planner-readiness/bounded-refresh"));
    expect(response.status).toBe(404);
    vi.stubEnv("VERCEL_ENV", "preview");
    const invalid = await GET(new Request("https://example.test/api/internal/planner-readiness/bounded-refresh"));
    expect(invalid.status).toBe(400);
  });

  it("maps atomic scope/stale conflicts to 409 and database failures to 503", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "secret");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.mocked(getSupabaseServerClient).mockReturnValue({} as NonNullable<ReturnType<typeof getSupabaseServerClient>>);
    vi.mocked(writeBoundedReadiness).mockRejectedValueOnce(new BoundedReadinessConflict("bounded_stale_plan"));
    const conflict = await POST(request("Bearer secret"));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ blocked: true, matchWrites: 0, readinessWrites: 0 });
    vi.mocked(writeBoundedReadiness).mockRejectedValueOnce(new Error("bounded_database_unavailable"));
    expect((await POST(request("Bearer secret"))).status).toBe(503);
  });

  it("routes an authenticated Production verify mode to the read-only verifier", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "secret");
    vi.stubEnv("VERCEL_ENV", "production");
    const exactInput = {
      recipeIds: [
        "4e60b9b6-abd3-46e7-b6a1-b10f73ccbec3", "baf31144-bb45-4c2b-aa2f-2f9be588b01c",
        "3bbe1561-d757-422e-aded-3d802310805c", "5726609e-82a3-4fa7-b5b0-dab78b2b59f1",
        "4f871e07-a684-4014-843a-f72a11b4c01d", "2825125a-4ec4-4fae-a5f3-b44be2afb0aa",
        "6a85d19f-5654-440b-b296-325c8f9fbd30",
      ],
      matchKeys: [
        "meal-mix-ingredient:mix-supplement-hacheevlees:g:ingredient:generic",
        "meal-mix-ingredient:mix-supplement-pitabroodjes:g:ingredient:generic",
        "meal-mix-ingredient:mix-supplement-tomaten:piece:ingredient:generic",
      ],
    };
    vi.mocked(getSupabaseServerClient).mockReturnValue({} as NonNullable<ReturnType<typeof getSupabaseServerClient>>);
    vi.mocked(verifyBoundedReadiness).mockResolvedValue({ blocked: false, currentReadinessRows: 70 } as never);
    const verifyRequest = new Request("https://example.test/api/internal/planner-readiness/bounded-refresh", {
      method: "POST", headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({ ...exactInput, mode: "verify" }),
    });
    const response = await POST(verifyRequest);
    expect(response.status).toBe(200);
    expect(verifyBoundedReadiness).toHaveBeenCalledWith(expect.anything(), {
      recipeIds: [...exactInput.recipeIds].sort(), matchKeys: [...exactInput.matchKeys].sort(), expectedPlanToken: undefined,
    });
    const preview = new Request("https://example.test/api/internal/planner-readiness/bounded-refresh", {
      method: "POST", headers: { authorization: "Bearer secret", "content-type": "application/json" },
      body: JSON.stringify({ ...exactInput, mode: "verify" }),
    });
    vi.stubEnv("VERCEL_ENV", "preview");
    expect((await POST(preview)).status).toBe(503);
  });
});
