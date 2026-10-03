import { describe, expect, it } from "vitest";
import {
  boundedWriteBlockReason,
  buildBoundedRefreshPlan,
  parseBoundedRefreshInput,
} from "@/server/bounded-readiness-maintenance";

const recipeIds = Array.from({ length: 7 }, (_, index) =>
  `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const matchKeys = [
  "meal-mix-ingredient:mix-supplement-hacheevlees:g:ingredient:generic",
  "meal-mix-ingredient:mix-supplement-tomaten:piece:ingredient:generic",
  "meal-mix-ingredient:mix-supplement-pitabroodjes:g:ingredient:generic",
];
const unrelated = "meal-mix-ingredient:mix-supplement-broccoli:g:ingredient:generic";
const input = { recipeIds, matchKeys };
const keysByPeople = () => new Map(Array.from({ length: 10 }, (_, index) =>
  [index + 1, new Map(recipeIds.map((id, recipeIndex) =>
    [id, [matchKeys[recipeIndex % 3], unrelated]],
  ))],
));
const subscribers = () => Array.from({ length: 10 }, (_, index) =>
  recipeIds.map((recipeId, recipeIndex) => ({
    recipe_id: recipeId,
    people_count: index + 1,
    updated_at: "2026-10-02T10:00:00.000Z",
    dependency_match_keys: [matchKeys[recipeIndex % 3], unrelated],
  })),
).flat();

describe("begrensde readiness maintenance", () => {
  it("plant precies 3 matchwrites en 70 readinesswrites zonder gelezen gedeelde keys te schrijven", () => {
    const plan = buildBoundedRefreshPlan(input, keysByPeople(), subscribers(), recipeIds);
    expect(plan).toMatchObject({
      blocked: false,
      requestedMatchKeys: [...matchKeys].sort(),
      resolvedRecipeIds: [...recipeIds].sort(),
      plannedMatchWrites: 3,
      plannedReadinessWrites: 70,
      unexpectedDependencies: [],
    });
    expect(plan.planToken).toMatch(/^[a-f0-9]{64}$/);
  });

  it("blokkeert triggeruitbreiding naar een READY-recept buiten de allowlist en plant nul writes", () => {
    const extra = { ...subscribers()[0], recipe_id: "00000000-0000-4000-8000-000000000026" };
    const plan = buildBoundedRefreshPlan(input, keysByPeople(), [...subscribers(), extra], recipeIds);
    expect(plan).toMatchObject({ blocked: true, reason: "dependency_outside_allowlist", plannedMatchWrites: 0, plannedReadinessWrites: 0 });
    expect(plan.unexpectedDependencies).toEqual([`${extra.recipe_id}:1`]);
  });

  it("weigert onbekende recepten, onbekende matchkeys en varianten buiten personen 1–10", () => {
    expect(buildBoundedRefreshPlan(input, keysByPeople(), subscribers(), recipeIds.slice(1)).reason).toBe("unknown_recipe_id");
    expect(buildBoundedRefreshPlan({ ...input, matchKeys: [...matchKeys, "unknown:g:ingredient:generic"] }, keysByPeople(), subscribers(), recipeIds).reason).toBe("unknown_match_key");
    const p11 = { ...subscribers()[0], people_count: 11 };
    expect(buildBoundedRefreshPlan(input, keysByPeople(), [...subscribers(), p11], recipeIds).reason).toBe("dependency_outside_allowlist");
  });

  it("wijzigt het plan-token bij gewijzigde target-dependency of subscriber-snapshot", () => {
    const before = buildBoundedRefreshPlan(input, keysByPeople(), subscribers(), recipeIds);
    const changedKeys = keysByPeople();
    changedKeys.get(4)?.get(recipeIds[0])?.push("another:g:ingredient:generic");
    const changedDependency = buildBoundedRefreshPlan(input, changedKeys, subscribers(), recipeIds);
    const changedSubscribers = subscribers();
    changedSubscribers[0].updated_at = "2026-10-02T10:01:00.000Z";
    const changedSnapshot = buildBoundedRefreshPlan(input, keysByPeople(), changedSubscribers, recipeIds);
    expect(changedDependency.planToken).not.toBe(before.planToken);
    expect(changedSnapshot.planToken).not.toBe(before.planToken);
    expect(boundedWriteBlockReason(before)).toBe("plan_token_required");
    expect(boundedWriteBlockReason(changedDependency, before.planToken ?? undefined)).toBe("plan_changed");
    expect(boundedWriteBlockReason(changedSnapshot, before.planToken ?? undefined)).toBe("plan_changed");
    expect(boundedWriteBlockReason(before, before.planToken ?? undefined)).toBeNull();
  });

  it("weigert lege, dubbele en onbegrensde requests voordat de database wordt benaderd", () => {
    expect(parseBoundedRefreshInput({ recipeIds: [], matchKeys })).toBeNull();
    expect(parseBoundedRefreshInput({ recipeIds, matchKeys: [] })).toBeNull();
    expect(parseBoundedRefreshInput({ recipeIds: [...recipeIds, recipeIds[0]], matchKeys })).toBeNull();
    expect(parseBoundedRefreshInput({ recipeIds: Array.from({ length: 11 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`), matchKeys })).toBeNull();
    expect(parseBoundedRefreshInput({ recipeIds, matchKeys, expectedPlanToken: "bad" })).toBeNull();
    expect(parseBoundedRefreshInput(input)).toEqual({ recipeIds: [...recipeIds].sort(), matchKeys: [...matchKeys].sort(), expectedPlanToken: undefined });
  });

  it("normaliseert UUID-casing vóór DB-scopevergelijking en weigert dubbele UUID's met andere casing", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(parseBoundedRefreshInput({ recipeIds: [id.toUpperCase()], matchKeys })?.recipeIds).toEqual([id]);
    expect(parseBoundedRefreshInput({ recipeIds: [id, id.toUpperCase()], matchKeys })).toBeNull();
  });
});
