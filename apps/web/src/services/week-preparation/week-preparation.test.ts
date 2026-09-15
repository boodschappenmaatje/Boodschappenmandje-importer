import { describe, expect, it } from "vitest";

import type { BudgetSettings } from "@/types/budget";
import type { MealCategory } from "@/types/week-preparation";

import {
  DEFAULT_WEEK_PREFERENCES,
  canPrepareWeek,
  changePreparedDayCategory,
  createWeekPreparation,
  distributeCategories,
  distributionProgress,
  prepareWeek,
  setCategoryCount,
  setWeekPreference,
  updateListSnapshot,
  updateWeekSettings,
} from "./week-preparation";

const NOW = new Date("2026-09-15T12:00:00Z");
const SETTINGS: BudgetSettings = {
  schemaVersion: 1,
  budgetCents: 10_000,
  people: 4,
  days: 6,
};

function preparation() {
  return createWeekPreparation(
    SETTINGS,
    { knownSubtotalCents: 2_463, unpricedItemCount: 0 },
    NOW,
    "week-test",
  );
}

function withDistribution(entries: Partial<Record<MealCategory, number>>) {
  let current = preparation();
  for (const [category, count] of Object.entries(entries)) {
    current = setCategoryCount(current, category as MealCategory, count ?? 0, NOW);
  }
  return current;
}

describe("PWA 10 weekvoorbereidingsmodel", () => {
  it("ondersteunt één persoon, één dag, PWA 9-budget en een lege lijst", () => {
    const result = createWeekPreparation(
      { ...SETTINGS, people: 1, days: 1 },
      { knownSubtotalCents: 0, unpricedItemCount: 0 },
      NOW,
      "week-one",
    );
    expect(result).toMatchObject({
      id: "week-one",
      numberOfPeople: 1,
      numberOfDays: 1,
      budgetCents: 10_000,
      existingListKnownSubtotalCents: 0,
      existingListUnpricedCount: 0,
      status: "draft",
      listStrategy: "preserveAndComplete",
      schemaVersion: 1,
    });
  });

  it("bewaart meerdere personen, zeven dagen en ontbrekende prijzen als context", () => {
    expect(
      createWeekPreparation(
        { ...SETTINGS, people: 12, days: 7 },
        { knownSubtotalCents: 7_218, unpricedItemCount: 2 },
        NOW,
        "week-seven",
      ),
    ).toMatchObject({
      numberOfPeople: 12,
      numberOfDays: 7,
      existingListKnownSubtotalCents: 7_218,
      existingListUnpricedCount: 2,
    });
  });

  it("onderscheidt een te lage, exacte en te hoge categorie-verdeling", () => {
    const base = preparation().categoryDistribution;
    expect(distributionProgress({ ...base, dutch: 4 }, 6)).toMatchObject({
      assignedDays: 4,
      difference: 2,
      state: "under",
    });
    expect(distributionProgress({ ...base, dutch: 6 }, 6).state).toBe("exact");
    expect(distributionProgress({ ...base, dutch: 7 }, 6)).toMatchObject({
      difference: -1,
      state: "over",
    });
  });

  it("blijft draft totdat alle instellingen en exact alle dagen zijn ingevuld", () => {
    const incomplete = withDistribution({ dutch: 2, pasta: 2 });
    expect(canPrepareWeek(incomplete)).toBe(false);
    expect(
      prepareWeek(incomplete, { knownSubtotalCents: 2_463, unpricedItemCount: 0 }, NOW)
        .status,
    ).toBe("draft");

    const exact = setCategoryCount(incomplete, "rice", 2, NOW);
    expect(canPrepareWeek(exact)).toBe(true);
    expect(
      prepareWeek(exact, { knownSubtotalCents: 2_463, unpricedItemCount: 0 }, NOW)
        .status,
    ).toBe("readyForGeneration");
  });

  it("maakt exact het gekozen aantal dagen zonder ontbrekende of extra dagen", () => {
    const distribution = withDistribution({
      dutch: 2,
      pasta: 1,
      rice: 1,
      quick: 1,
      comfort: 1,
    }).categoryDistribution;
    const days = distributeCategories(distribution, 6);
    expect(days).toHaveLength(6);
    expect(days.map((day) => day.dayIndex)).toEqual([0, 1, 2, 3, 4, 5]);
    expect(days.every((day) => day.recipeId === null)).toBe(true);
    expect(days.filter((day) => day.category === "dutch")).toHaveLength(2);
  });

  it("spreidt een herhaalde categorie wanneer een alternatief beschikbaar is", () => {
    const distribution = withDistribution({ dutch: 3, pasta: 2, rice: 1 })
      .categoryDistribution;
    const categories = distributeCategories(distribution, 6).map(
      (day) => day.category,
    );
    expect(categories.some((category, index) => category === categories[index - 1])).toBe(
      false,
    );
  });

  it("modelleert vrije keuze zonder recept", () => {
    const distribution = withDistribution({ freeChoice: 1, dutch: 5 })
      .categoryDistribution;
    const freeDay = distributeCategories(distribution, 6).find(
      (day) => day.category === "freeChoice",
    );
    expect(freeDay).toMatchObject({ freeChoice: true, recipeId: null });
  });

  it("bewaart uitbreidbare basisvoorkeuren zonder automatische keuzes", () => {
    let current = preparation();
    expect(current.preferences).toEqual(DEFAULT_WEEK_PREFERENCES);
    current = setWeekPreference(current, "noVegetarian", true, NOW);
    current = setWeekPreference(current, "healthyImportant", true, NOW);
    expect(current.preferences).toMatchObject({
      noVegetarian: true,
      healthyImportant: true,
    });
    expect(current.categoryDistribution.vegetarian).toBe(0);
  });

  it("houdt de verdeling geldig na een handmatige dagwijziging", () => {
    const ready = prepareWeek(
      withDistribution({ dutch: 3, pasta: 3 }),
      { knownSubtotalCents: 2_463, unpricedItemCount: 0 },
      NOW,
    );
    const changed = changePreparedDayCategory(ready, 0, "freeChoice", NOW);
    expect(changed.days).toHaveLength(6);
    expect(changed.days[0]).toMatchObject({
      category: "freeChoice",
      freeChoice: true,
    });
    expect(
      distributionProgress(changed.categoryDistribution, changed.numberOfDays).state,
    ).toBe("exact");
    expect(changed.status).toBe("readyForGeneration");
  });

  it("maakt na een gewijzigd aantal dagen weer een draft zonder categorieën stil te wissen", () => {
    const ready = prepareWeek(
      withDistribution({ dutch: 3, pasta: 3 }),
      { knownSubtotalCents: 2_463, unpricedItemCount: 0 },
      NOW,
    );
    const changed = updateWeekSettings(ready, { ...SETTINGS, days: 7 }, NOW);
    expect(changed.status).toBe("draft");
    expect(changed.days).toEqual([]);
    expect(changed.categoryDistribution).toEqual(ready.categoryDistribution);
    expect(distributionProgress(changed.categoryDistribution, 7).state).toBe("under");
  });

  it("ververst alleen de lijstsnapshot voor audit en houdt de live berekening extern", () => {
    const updated = updateListSnapshot(
      preparation(),
      { knownSubtotalCents: 5_000, unpricedItemCount: 1 },
      NOW,
    );
    expect(updated).toMatchObject({
      existingListKnownSubtotalCents: 5_000,
      existingListUnpricedCount: 1,
    });
  });
});

