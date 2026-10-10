import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { refreshPlannerReadiness } from "@/server/planner-cache-service";

vi.mock("@/lib/supabase/server", () => ({ getSupabaseServerClient: vi.fn() }));
vi.mock("@/server/planner-cache-service", () => ({
  PLANNER_MAINTENANCE_PEOPLE_COUNTS: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
  refreshPlannerReadiness: vi.fn(),
}));

afterEach(() => vi.unstubAllEnvs());

const recipeIds = ["6593543a-5c8d-409d-8c9e-145632c43f0b"];
const request = () => new Request("https://app.test", {
  method: "POST", headers: { authorization: "Bearer secret", "content-type": "application/json" },
  body: JSON.stringify({ recipeIds }),
});

function client(profileCount: number) {
  const query = {
    select: vi.fn(() => query),
    in: vi.fn(() => query),
    eq: vi.fn(async () => ({ data: Array.from({ length: profileCount }, () => ({ recipe_id: recipeIds[0] })), error: null })),
  };
  vi.mocked(getSupabaseServerClient).mockReturnValue({ from: vi.fn(() => query) } as never);
}

describe("verified meal-mix refresh remains unchanged", () => {
  it("keeps the verified gate and normal readiness refresh", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "secret");
    client(1);
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(refreshPlannerReadiness).toHaveBeenCalledTimes(10);
    expect(refreshPlannerReadiness).toHaveBeenCalledWith(expect.anything(), { recipeIds, numberOfPeople: 1 });
  });

  it("continues to reject non-verified profiles in the original route", async () => {
    vi.stubEnv("PLANNER_CACHE_ADMIN_TOKEN", "secret");
    client(0);
    const response = await POST(request());
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "profile-not-verified" });
    expect(refreshPlannerReadiness).not.toHaveBeenCalled();
  });
});
