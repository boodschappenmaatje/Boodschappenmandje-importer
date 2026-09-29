import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/internal/planner-readiness/new-products/route";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { maintainPlannerForNewProducts } from "@/server/planner-new-products";

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn() }));
vi.mock("@/server/planner-new-products", async (original) => ({
  ...await original<typeof import("@/server/planner-new-products")>(), maintainPlannerForNewProducts: vi.fn(),
}));
afterEach(() => { vi.unstubAllEnvs(); vi.clearAllMocks(); });
const id = "00000000-0000-4000-8000-000000000001";
function request(body: unknown, token = "fixture-token") {
  return new Request("https://preview.example/api/internal/planner-readiness/new-products", {
    method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}
describe("new-products admin route", () => {
  it("requires server-side admin auth before reads/writes", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "fixture-token");
    expect((await POST(request({ productIds: [id] }, "wrong"))).status).toBe(401);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
    expect(maintainPlannerForNewProducts).not.toHaveBeenCalled();
  });
  it("fails closed without a configured admin token", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "");
    expect((await POST(request({ productIds: [id] }))).status).toBe(401);
  });
  it("rejects unbounded inputs before constructing a database client", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "fixture-token");
    expect((await POST(request({ productIds: Array(21).fill(id) }))).status).toBe(400);
    expect(getSupabaseServerClient).not.toHaveBeenCalled();
  });
  it("reports missing server credential without exposing configuration", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "fixture-token");
    vi.mocked(getSupabaseServerClient).mockReturnValue(null);
    const response = await POST(request({ productIds: [id] }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "cache-unavailable" });
    expect(maintainPlannerForNewProducts).not.toHaveBeenCalled();
  });
  it("returns only a safe maintenance failure code for an internal exception", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "fixture-token");
    vi.mocked(getSupabaseServerClient).mockReturnValue({} as NonNullable<ReturnType<typeof getSupabaseServerClient>>);
    vi.mocked(maintainPlannerForNewProducts).mockRejectedValue(new Error("private fixture with key material"));
    const response = await POST(request({ productIds: [id] }));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "new-product-maintenance-failed", retryable: true });
    expect(maintainPlannerForNewProducts).toHaveBeenCalledTimes(1);
  });
  it("passes an authenticated valid batch to the existing maintenance flow", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "fixture-token");
    const client = {} as NonNullable<ReturnType<typeof getSupabaseServerClient>>;
    vi.mocked(getSupabaseServerClient).mockReturnValue(client);
    vi.mocked(maintainPlannerForNewProducts).mockResolvedValue({
      productCount: 1, changedMatchKeys: [], refreshedReadinessCount: 0, affectedRecipeIds: [],
    });
    const response = await POST(request({ productIds: [id, id] }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ productCount: 1 });
    expect(maintainPlannerForNewProducts).toHaveBeenCalledExactlyOnceWith(client, [id]);
  });
});
