import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const mocked = vi.hoisted(() => ({
  serverClient: vi.fn<() => SupabaseClient | null>(),
  probeClient: vi.fn<(probeFetch: typeof fetch) => SupabaseClient | null>(),
  repair: vi.fn(),
}));
vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: mocked.serverClient,
  getSupabaseServerClientForReadProbe: mocked.probeClient,
}));
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
    mocked.probeClient.mockReset();
    mocked.repair.mockReset();
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  function readClient(result: unknown) {
    const retry = vi.fn().mockResolvedValue(result);
    const limit = vi.fn().mockReturnValue({ retry });
    const select = vi.fn().mockReturnValue({ limit });
    const from = vi.fn().mockReturnValue({ select });
    mocked.probeClient.mockReturnValue({ from } as unknown as SupabaseClient);
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
      databaseWrites: 0, fetchCalled: false, responseReceived: false, responseStatus: null });
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
    [{ data: null, error: { message: "TypeError: fetch failed", details: "private" }, status: 0 }, "database-sdk-status-zero"],
    [{ data: null, error: { hint: "Request was aborted (timeout or manual cancellation)" }, status: 0 }, "database-sdk-status-zero"],
    [{ data: null, error: { message: "internal SDK failure" }, status: 0 }, "database-sdk-status-zero"],
    [{ data: null, error: { code: "PGRST123", message: "sensitive detail" }, status: 400 }, "database-http-other-failed"],
    [{ data: null, error: { message: "malformed JSON" }, status: 200 }, "database-sdk-query-failed"],
    [{ data: null, error: { message: "SDK response without status" } }, "database-sdk-query-failed"],
    [{ data: null, error: null, status: 200 }, "database-unexpected-response"],
    [{ data: null, error: null, status: 0 }, "database-unexpected-response"],
    [{ data: [], error: null, status: "200" }, "database-unexpected-response"],
    [null, "database-unexpected-response"],
  ] as const)("keeps error bodies private: %o", async (result, code) => {
    await expectProbe(result, code, result && "status" in result &&
      typeof result.status === "number" && result.status >= 100
      ? result.status : null);
  });

  it("does not mistake a thrown query for success", async () => {
    const retry = vi.fn().mockRejectedValue(new Error("sensitive database detail"));
    const limit = vi.fn().mockReturnValue({ retry });
    const select = vi.fn().mockReturnValue({ limit });
    mocked.probeClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select }) } as unknown as SupabaseClient);
    const response = await POST(request({ databaseReadProbe: "v1" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code: "database-query-exception", upstreamStatus: null,
      authenticated: true, serverClientAvailable: true, databaseReadSuccess: false, databaseWrites: 0,
      fetchCalled: false, responseReceived: false, responseStatus: null });
    expect(mocked.repair).not.toHaveBeenCalled();
  });

  it("classifies a thrown fetch failure without exposing exception contents", async () => {
    const retry = vi.fn().mockRejectedValue(new TypeError("fetch failed"));
    const limit = vi.fn().mockReturnValue({ retry });
    const select = vi.fn().mockReturnValue({ limit });
    mocked.probeClient.mockReturnValue({ from: vi.fn().mockReturnValue({ select }) } as unknown as SupabaseClient);
    const response = await POST(request({ databaseReadProbe: "v1" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code: "database-query-exception", upstreamStatus: null,
      authenticated: true, serverClientAvailable: true, databaseReadSuccess: false, databaseWrites: 0,
      fetchCalled: false, responseReceived: false, responseStatus: null });
    expect(retry).toHaveBeenCalledExactlyOnceWith(false);
    expect(mocked.repair).not.toHaveBeenCalled();
  });

  it("classifies a synchronous query-builder exception separately from SDK status 0", async () => {
    mocked.probeClient.mockReturnValue({ from: vi.fn(() => {
      throw new Error("private query detail");
    }) } as unknown as SupabaseClient);
    const response = await POST(request({ databaseReadProbe: "v1" }));
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ code: "database-query-exception", upstreamStatus: null,
      authenticated: true, serverClientAvailable: true, databaseReadSuccess: false, databaseWrites: 0,
      fetchCalled: false, responseReceived: false, responseStatus: null });
    expect(mocked.repair).not.toHaveBeenCalled();
  });

  it("reports missing configuration separately without querying or changing a queue", async () => {
    mocked.probeClient.mockReturnValue(null);
    const response = await POST(request({ databaseReadProbe: "v1" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "database-client-unavailable", authenticated: true,
      serverClientAvailable: false, databaseReadSuccess: false, databaseWrites: 0,
      fetchCalled: false, responseReceived: false, responseStatus: null });
    expect(mocked.repair).not.toHaveBeenCalled();
  });

  it("reports a client construction failure without invoking fetch or maintenance", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    mocked.probeClient.mockImplementation(() => { throw new Error("private configuration detail"); });
    const response = await POST(request({ databaseReadProbe: "v1" }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ code: "database-client-unavailable",
      authenticated: true, serverClientAvailable: false, databaseReadSuccess: false,
      databaseWrites: 0, fetchCalled: false, responseReceived: false, responseStatus: null });
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(mocked.repair).not.toHaveBeenCalled();
  });

  describe("pinned supabase-js 2.116.0 with a local-only fetch", () => {
    async function throughSdk(fetcher: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>,
      code: string, upstreamStatus: number | null, httpStatus = 502,
      observedStatus: number | null = upstreamStatus) {
      const fetchSpy = vi.fn(fetcher);
      vi.stubGlobal("fetch", fetchSpy);
      mocked.probeClient.mockImplementation((observedFetch) => createClient(
        "https://local-sdk-test.invalid", "sb_secret_local_test_only", {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
          global: { fetch: observedFetch },
        }));
      const response = await POST(request({ databaseReadProbe: "v1" }));
      expect(response.status).toBe(httpStatus);
      expect(await response.json()).toEqual({ code, upstreamStatus, authenticated: true,
        serverClientAvailable: true, databaseReadSuccess: code === "database-read-ok",
        databaseWrites: 0, fetchCalled: true,
        responseReceived: observedStatus !== null,
        responseStatus: observedStatus });
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      const [url, options] = fetchSpy.mock.calls[0];
      expect(new URL(String(url)).pathname).toBe("/rest/v1/meal_mix_profiles");
      expect(options?.method).toBe("GET");
      expect(new URL(String(url)).searchParams.get("select")).toBe("recipe_id");
      expect(new URL(String(url)).searchParams.get("limit")).toBe("1");
      expect(mocked.repair).not.toHaveBeenCalled();
    }

    it.each([
      [200, "[]", "database-read-ok", 200],
      [200, '[{"recipe_id":"private"}]', "database-read-ok", 200],
      [401, '{"message":"private"}', "database-http-auth-failed", 502],
      [403, '{"message":"private"}', "database-http-permission-failed", 502],
      [404, '{"message":"private"}', "database-http-not-found", 502],
      [500, '{"message":"private"}', "database-http-server-error", 502],
      [503, '{"message":"private"}', "database-http-server-error", 502],
      [200, "not-json", "database-sdk-query-failed", 502],
      [200, "{}", "database-unexpected-response", 502],
    ] as const)("classifies simulated HTTP %i with actual SDK (%s)",
      async (status, body, code, httpStatus) => {
        await throughSdk(async () => new Response(body, { status }), code, status, httpStatus);
      });

    it.each([
      ["fetch rejected", new TypeError("fetch failed")],
      ["DNS failed", Object.assign(new TypeError("fetch failed"), { cause: { code: "ENOTFOUND" } })],
      ["abort", Object.assign(new Error("aborted"), { name: "AbortError" })],
      ["non-fetch exception", new Error("internal processing failure")],
    ])("SDK converts %s to a status-0 result", async (_name, failure) => {
      await throughSdk(async () => { throw failure; }, "database-sdk-status-zero", null);
    });

    it("SDK converts a body-reading exception after HTTP 200 to status 0", async () => {
      const unreadable = new Response("[]", { status: 200 });
      unreadable.text = async () => { throw new Error("body unreadable"); };
      await throughSdk(async () => unreadable, "database-sdk-status-zero", null, 502, 200);
    });

    it("does not mark fetch called when SDK preparation fails before the network call", async () => {
      const fetchSpy = vi.fn(async () => new Response("[]"));
      vi.stubGlobal("fetch", fetchSpy);
      mocked.probeClient.mockReturnValue({ from: vi.fn(() => {
        throw new Error("private preparation failure");
      }) } as unknown as SupabaseClient);
      const response = await POST(request({ databaseReadProbe: "v1" }));
      expect(await response.json()).toMatchObject({ code: "database-query-exception",
        fetchCalled: false, responseReceived: false, responseStatus: null, databaseWrites: 0 });
      expect(fetchSpy).not.toHaveBeenCalled();
      expect(mocked.repair).not.toHaveBeenCalled();
    });
  });

  it("requires the admin token and an exact probe sentinel", async () => {
    const unauthorized = await POST(request({ databaseReadProbe: "v1" }, false));
    expect(unauthorized.status).toBe(401);
    expect(mocked.probeClient).not.toHaveBeenCalled();
    readClient({ data: [], error: null, status: 200 });
    const malformed = await POST(request({ databaseReadProbe: "v1", productId: "extra" }));
    expect(malformed.status).toBe(400);
    expect(mocked.repair).not.toHaveBeenCalled();
  });
});
