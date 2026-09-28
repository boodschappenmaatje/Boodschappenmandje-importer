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
    const retry = vi.fn().mockResolvedValue(result);
    const limit = vi.fn().mockReturnValue({ retry });
    const select = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ select });
    mocked.serverClient.mockReturnValue({ from } as unknown as SupabaseClient);
    return { from, select, limit, retry };
  }

  async function expectProbe(result: unknown, code: string, upstreamStatus: number | null,
    expectedHttp = 502) {
    const { from, select, limit, retry } = readClient(result);
    const response = await POST(request({ databaseReadProbe: "v1" }));
    expect(response.status).toBe(expectedHttp);
    expect(await response.json()).toEqual({ code, upstreamStatus, authenticated: true,
      serverClientAvailable: true, databaseReadSuccess: code === "database-read-ok",
      databaseWrites: 0 });
    expect(from).toHaveBeenCalledExactlyOnceWith("meal_mix_profiles");
    expect(select).toHaveBeenCalledExactlyOnceWith("recipe_id");
    expect(limit).toHaveBeenCalledExactlyOnceWith(1);
    expect(retry).toHaveBeenCalledExactlyOnceWith(false);
    expect(mocked.repair).not.toHaveBeenCalled();
  }

  it.each([
    [{ recipe_id: "never returned" }],
    [],
  ])("reports a successful SELECT without returning rows (%o)", async (...rows) => {
    await expectProbe({ data: rows, error: null, status: 200 }, "database-read-ok", 200, 200);
  });

  it("accepts a valid partial SELECT response", async () => {
    await expectProbe({ data: [], error: null, status: 206 }, "database-read-ok", 206, 200);
  });

  it.each([
    [401, "database-http-auth-failed"],
    [403, "database-http-permission-failed"],
    [404, "database-http-not-found"],
    [503, "database-http-server-error"],
    [500, "database-http-server-error"],
    [429, "database-http-other-failed"],
  ] as const)("classifies HTTP %i using status alone", async (status, code) => {
    await expectProbe({ data: null, error: { message: "sensitive error" }, status }, code, status);
  });

  it.each([
    [{ data: null, error: { message: "TypeError: fetch failed", details: "private" }, status: 0 }, "database-network-failed"],
    [{ data: null, error: { hint: "Request was aborted (timeout or manual cancellation)" }, status: 0 }, "database-network-failed"],
    [{ data: null, error: { message: "internal SDK failure" }, status: 0 }, "database-sdk-query-failed"],
    [{ data: null, error: { code: "PGRST123", message: "sensitive detail" }, status: 400 }, "database-http-other-failed"],
    [{ data: null, error: { message: "malformed JSON" }, status: 200 }, "database-sdk-query-failed"],
    [{ data: null, error: null, status: 200 }, "database-unexpected-response"],
    [{ data: null, error: null, status: 0 }, "database-unexpected-response"],
    [{ data: [], error: null, status: "200" }, "database-unexpected-response"],
    [null, "database-unexpected-response"],
  ] as const)("keeps error bodies private: %o", async (result, code) => {
    await expectProbe(result, code, typeof result?.status === "number" && result.status >= 100
      ? result.status : null);
  });

  it("does not mistake a thrown query for success", async () => {
    const retry = vi.fn().mockRejectedValue(new Error("sensitive database detail"));
    const limit = vi.fn().mockReturnValue({ retry });
    const select = vi.fn().mockReturnValue({ limit });
    mocked.serverClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select }) } as unknown as SupabaseClient);
    const response = await POST(request({ databaseReadProbe: "v1" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code: "database-sdk-query-failed", upstreamStatus: null,
      authenticated: true, serverClientAvailable: true, databaseReadSuccess: false, databaseWrites: 0 });
    expect(mocked.repair).not.toHaveBeenCalled();
  });

  it("classifies a thrown fetch failure without exposing exception contents", async () => {
    const retry = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const limit = vi.fn().mockReturnValue({ retry });
    const select = vi.fn().mockReturnValue({ limit });
    mocked.serverClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select }) } as unknown as SupabaseClient);
    const response = await POST(request({ databaseReadProbe: "v1" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code: "database-network-failed", upstreamStatus: null,
      authenticated: true, serverClientAvailable: true, databaseReadSuccess: false, databaseWrites: 0 });
    expect(retry).toHaveBeenCalledExactlyOnceWith(false);
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
