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
    expect((await POST(request({ productIds: [id] }))).status).toBe(503);
    expect(maintainPlannerForNewProducts).not.toHaveBeenCalled();
  });
});
