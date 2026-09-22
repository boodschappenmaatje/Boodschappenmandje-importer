import { describe, expect, it } from "vitest";
import { createWeekPreparation, distributeCategories, freeChoiceProgress, prepareWeek, setCategoryCount, updateWeekSettings } from "./week-preparation";
import { loadMyRecipes, saveMyRecipe } from "./my-recipes-storage";
import type { WeekPreparation } from "@/types/week-preparation";
const now = new Date("2026-09-22T12:00:00Z");
const context = { knownSubtotalCents: 0, unpricedItemCount: 0 };
function week(total: number, chosen = 0): WeekPreparation {
  const base = createWeekPreparation({ schemaVersion: 1, people: 4, days: total, budgetCents: 10000 }, context, now, "capacity");
  const distribution = { ...base.categoryDistribution, freeChoice: total };
  return { ...base, mealBudgetCents: 5000, categoryDistribution: distribution, status: "generated", days: distributeCategories(distribution, total).map((day, index) => index >= chosen ? day : ({ ...day, freeChoice: false, status: "recipeSelected", recipeId: `r${index}`, recipe: { id: `r${index}`, sourceKey: ["pasta", "catalog-mix-honig", "custom-dish"][index % 3], name: `Gerecht ${index}` } })) };
}
describe("PWA 14 Fix 1 dynamic free-choice capacity", () => {
  it.each([1, 2, 4, 6, 7])("derives %i slots from this week's distribution", total => {
    for (let chosen = 0; chosen <= total; chosen++) {
      const progress = freeChoiceProgress(week(total, chosen));
      expect(progress).toMatchObject({ total, chosen, remaining: total - chosen, needsRetention: false });
    }
  });
  it("counts mixed normal, mix and custom recipes equally", () => {
    expect(freeChoiceProgress(week(6, 6))).toMatchObject({ chosen: 6, total: 6, remaining: 0 });
  });
  it("preserves chosen meals while increasing days and free slots from 2 to 6", () => {
    const original = week(2, 2);
    const settings = updateWeekSettings(original, { people: 4, days: 6, budgetCents: 10000 }, now);
    const changed = setCategoryCount(settings, "freeChoice", 6, now);
    expect(changed.days).toEqual(original.days);
    expect(freeChoiceProgress(changed)).toMatchObject({ chosen: 2, total: 6 });
    const confirmed = prepareWeek(changed, context, now);
    expect(confirmed.days).toHaveLength(6);
    expect(freeChoiceProgress(confirmed)).toMatchObject({ chosen: 2, total: 6, remaining: 4 });
    expect(confirmed.days.slice(0, 2)).toEqual(original.days);
  });
  it("does not remove meals when reducing a category or day count", () => {
    const original = week(6, 6);
    const changed = setCategoryCount(updateWeekSettings(original, { people: 4, days: 2, budgetCents: 10000 }, now), "freeChoice", 2, now);
    expect(changed.days).toEqual(original.days);
    expect(freeChoiceProgress(changed)).toMatchObject({ chosen: 6, total: 2, needsRetention: true });
    expect(prepareWeek(changed, context, now)).toBe(changed);
    expect(prepareWeek(changed, context, now, [0])).toBe(changed);
    expect(prepareWeek(changed, context, now, [0, 0])).toBe(changed);
    expect(prepareWeek(changed, context, now, [0, 99])).toBe(changed);
    const confirmed = prepareWeek(changed, context, now, [2, 5]);
    expect(confirmed.days.map(day => day.recipeId)).toEqual(["r2", "r5"]);
    expect(original.days).toHaveLength(6);
  });
  it("retains selected dish product customizations when its day moves", () => {
    const original = week(6, 6);
    original.customizations = [{ dayIndex: 5, baseRecipe: original.days[5].recipe!, replacementRecipe: null, recipeBudgetDecision: { mode: "userConfirmedManualChoice" }, productOverrides: [], ingredientOverrides: [], manualProductAdditions: [], updatedAt: now.toISOString() }];
    const changed = setCategoryCount(updateWeekSettings(original, { people: 4, days: 1, budgetCents: 10000 }, now), "freeChoice", 1, now);
    expect(prepareWeek(changed, context, now, [5]).customizations[0]).toEqual({ ...original.customizations[0], dayIndex: 0 });
  });
  it("does not limit the private collection to week slots or 200 recipes", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); } };
    for (let i = 0; i < 205; i++) saveMyRecipe(storage, { name: `Recept ${i}`, servings: 4, ingredients: [{ id: "row", name: "pasta", quantity: 400, unit: "g", productId: "sku" }] }, `recipe-${i}`, now);
    expect(loadMyRecipes(storage)).toHaveLength(205);
  });
});
