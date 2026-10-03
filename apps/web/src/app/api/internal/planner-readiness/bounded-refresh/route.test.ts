import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "./route";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { BoundedReadinessConflict, writeBoundedReadiness } from "@/server/bounded-readiness-maintenance";

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn() }));
vi.mock("@/server/bounded-readiness-maintenance", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/server/bounded-readiness-maintenance")>(), writeBoundedReadiness: vi.fn(),
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
});
