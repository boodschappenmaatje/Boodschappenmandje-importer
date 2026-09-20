import { describe, expect, it } from "vitest";

import {
  PLANNER_MAINTENANCE_PEOPLE_COUNTS,
  planPlannerReadinessMaintenance,
  type PlannerReadinessStateRow,
} from "@/server/planner-cache-service";

const NOW = new Date("2026-09-19T12:00:00.000Z");

function currentRow(
  recipeId: string,
  peopleCount: number,
): PlannerReadinessStateRow {
  return {
    recipe_id: recipeId,
    people_count: peopleCount,
    evaluator_version: 2,
    refresh_status: "current",
    invalidated_at: null,
    expires_at: "2026-09-20T12:00:00.000Z",
  };
}

describe("planner-cache automatisch onderhoud", () => {
  it("bouwt voor één nieuw recept alleen dat recept voor 1–10 op", () => {
    const existing = PLANNER_MAINTENANCE_PEOPLE_COUNTS.map((people) =>
      currentRow("existing", people),
    );
    const targets = planPlannerReadinessMaintenance(
      ["existing", "new"],
      existing,
      PLANNER_MAINTENANCE_PEOPLE_COUNTS,
      NOW,
    );

    expect(targets).toHaveLength(10);
    expect(targets.map((target) => target.numberOfPeople)).toEqual(
      PLANNER_MAINTENANCE_PEOPLE_COUNTS,
    );
    expect(targets.every((target) =>
      target.recipeIds.length === 1 && target.recipeIds[0] === "new"
    )).toBe(true);
  });

  it("herbouwt voor één gewijzigd recept alleen de eigen stale varianten", () => {
    const rows = PLANNER_MAINTENANCE_PEOPLE_COUNTS.flatMap((people) => [
      currentRow("untouched", people),
      {
        ...currentRow("changed", people),
        refresh_status: "pending",
        invalidated_at: NOW.toISOString(),
      },
    ]);
    const targets = planPlannerReadinessMaintenance(
      ["changed", "untouched"],
      rows,
      PLANNER_MAINTENANCE_PEOPLE_COUNTS,
      NOW,
    );

    expect(targets).toHaveLength(10);
    expect(targets.every((target) =>
      target.recipeIds.length === 1 && target.recipeIds[0] === "changed"
    )).toBe(true);
  });

  it("houdt personenaantallen strikt gescheiden en slaat actuele p4 over", () => {
    const rows = [currentRow("recipe", 4)];
    const targets = planPlannerReadinessMaintenance(
      ["recipe"],
      rows,
      [1, 4, 10],
      NOW,
    );

    expect(targets).toEqual([
      { numberOfPeople: 1, recipeIds: ["recipe"] },
      { numberOfPeople: 10, recipeIds: ["recipe"] },
    ]);
  });

  it("behandelt verlopen of evaluator-stale rijen als onderhoudsdoel", () => {
    const targets = planPlannerReadinessMaintenance(
      ["expired", "old-evaluator"],
      [
        {
          ...currentRow("expired", 5),
          expires_at: "2026-09-19T11:59:59.000Z",
        },
        {
          ...currentRow("old-evaluator", 5),
          evaluator_version: 0,
        },
      ],
      [5],
      NOW,
    );

    expect(targets).toEqual([{
      numberOfPeople: 5,
      recipeIds: ["expired", "old-evaluator"],
    }]);
  });
});
