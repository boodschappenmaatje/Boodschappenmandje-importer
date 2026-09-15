import { describe, expect, it } from "vitest";

import { emptyDashboardState } from "./dashboard-state";

describe("dashboard beginstatus", () => {
  it("bevat geen verzonnen week-, lijst- of suggestiedata", () => {
    expect(emptyDashboardState).toEqual({
      week: null,
      suggestions: [],
    });
  });
});
