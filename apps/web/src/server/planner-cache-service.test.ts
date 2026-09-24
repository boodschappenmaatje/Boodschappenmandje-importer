import { PLANNER_READINESS_EVALUATOR_VERSION } from "@/services/week-preparation/persistent-readiness-cache";
import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SupabaseRecipeRepository } from "@/services/week-preparation/recipe-repository";
import { MEAL_MIX_PROFILES, enrichIngredientsForMealMixes } from "@/services/week-preparation/meal-mix-profiles";

import {
  PLANNER_MAINTENANCE_PEOPLE_COUNTS,
  loadCatalog,
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
    evaluator_version: PLANNER_READINESS_EVALUATOR_VERSION,
    refresh_status: "current",
    invalidated_at: null,
    expires_at: "2026-09-20T12:00:00.000Z",
  };
}

describe("planner-cache automatisch onderhoud", () => {
  it("behoudt de exacte geverifieerde catalogusvariant bij serveronderhoud", async () => {
    const profile = { ...MEAL_MIX_PROFILES[0], productId: "exact-catalog-product", servingsPerPackage: 3 };
    const ingredients = enrichIngredientsForMealMixes([], [profile]);
    const read = vi.spyOn(SupabaseRecipeRepository.prototype, "loadCatalog").mockResolvedValue({
      recipes: [], relations: [], ingredients, mealMixProfiles: [profile],
    });
    try {
      const loaded = await loadCatalog({} as SupabaseClient);
      expect(loaded.ingredients.find(item => item.sourceKey === profile.productIngredientSourceKey)?.productId).toBe(profile.productId);
    } finally { read.mockRestore(); }
  });
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
