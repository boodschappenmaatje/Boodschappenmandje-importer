import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const mocked = vi.hoisted(() => ({
  serverClient: vi.fn<() => SupabaseClient | null>(),
  repair: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: mocked.serverClient }));
vi.mock("@/server/planner-cache-service", () => ({ repairIngredientProductMatch: mocked.repair }));

import { POST } from "./route";

const endpoint = "https://boodschappenmaatje-pwa.vercel.app/api/internal/planner-readiness/repair";
function request(body: unknown, authorized = true): Request {
  return new Request(endpoint, {
    method: "POST",
    headers: authorized ? { authorization: "Bearer local-test-token" } : {},
    body: JSON.stringify(body),
  });
}

describe("authenticated, write-free Production database probe", () => {
  beforeEach(() => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "local-test-token");
    mocked.serverClient.mockReset();
    mocked.repair.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  function readClient(result: unknown) {
    const limit = vi.fn().mockResolvedValue(result);
    const select = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ select });
    mocked.serverClient.mockReturnValue({ from } as unknown as SupabaseClient);
    return { from, select, limit };
  }

  it("reports success only after a valid small SELECT; never invokes repair or a write", async () => {
    const { from, select, limit } = readClient({ data: [], error: null, status: 200 });
    const response = await POST(request({ databaseReadProbe: "v1" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ code: "database-read-ok", authenticated: true,
      serverClientAvailable: true, databaseReadSuccess: true, databaseWrites: 0 });
    expect(from).toHaveBeenCalledExactlyOnceWith("meal_mix_profiles");
    expect(select).toHaveBeenCalledExactlyOnceWith("recipe_id");
    expect(limit).toHaveBeenCalledExactlyOnceWith(1);
    expect(mocked.repair).not.toHaveBeenCalled();
  });

  it.each([
    { data: null, error: { code: "unauthorized" }, status: 401 },
    { data: null, error: null, status: 200 },
    { data: [], error: null, status: 500 },
  ])("reports an error for a failed or invalid query response: %o", async (result) => {
    const { from } = readClient(result);
    const response = await POST(request({ databaseReadProbe: "v1" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code: "database-read-failed", authenticated: true,
      serverClientAvailable: true, databaseReadSuccess: false, databaseWrites: 0 });
    expect(from).toHaveBeenCalledTimes(1);
    expect(mocked.repair).not.toHaveBeenCalled();
  });

  it("does not mistake a thrown query for success", async () => {
    const limit = vi.fn().mockRejectedValue(new Error("sensitive database detail"));
    const select = vi.fn().mockReturnValue({ limit });
    mocked.serverClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select }) } as unknown as SupabaseClient);
    const response = await POST(request({ databaseReadProbe: "v1" }));
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("sensitive database detail");
    expect(mocked.repair).not.toHaveBeenCalled();
  });

  it("reports missing configuration separately without querying or changing a queue", async () => {
    mocked.serverClient.mockReturnValue(null);
    const response = await POST(request({ databaseReadProbe: "v1" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "database-client-unavailable", authenticated: true,
      serverClientAvailable: false, databaseReadSuccess: false, databaseWrites: 0 });
    expect(mocked.repair).not.toHaveBeenCalled();
  });

  it("requires the admin token and an exact probe sentinel", async () => {
    const unauthorized = await POST(request({ databaseReadProbe: "v1" }, false));
    expect(unauthorized.status).toBe(401);
    expect(mocked.serverClient).not.toHaveBeenCalled();
    readClient({ data: [], error: null, status: 200 });
    const malformed = await POST(request({ databaseReadProbe: "v1", productId: "extra" }));
    expect(malformed.status).toBe(400);
    expect(mocked.repair).not.toHaveBeenCalled();
  });
});
