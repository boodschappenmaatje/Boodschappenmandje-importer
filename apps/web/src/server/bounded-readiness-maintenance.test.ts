import { describe, expect, it } from "vitest";
import {
  boundedVerificationScope,
  boundedWriteBlockReason,
  buildBoundedRefreshPlan,
  parseBoundedRefreshInput,
} from "@/server/bounded-readiness-maintenance";

const recipeIds = Array.from({ length: 7 }, (_, index) =>
  `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const approvedLegacyRecipeIds = [
  "4e60b9b6-abd3-46e7-b6a1-b10f73ccbec3", "baf31144-bb45-4c2b-aa2f-2f9be588b01c",
  "3bbe1561-d757-422e-aded-3d802310805c", "5726609e-82a3-4fa7-b5b0-dab78b2b59f1",
  "4f871e07-a684-4014-843a-f72a11b4c01d", "2825125a-4ec4-4fae-a5f3-b44be2afb0aa",
  "6a85d19f-5654-440b-b296-325c8f9fbd30",
];
const matchKeys = [
  "meal-mix-ingredient:mix-supplement-hacheevlees:g:ingredient:generic",
  "meal-mix-ingredient:mix-supplement-tomaten:piece:ingredient:generic",
  "meal-mix-ingredient:mix-supplement-pitabroodjes:g:ingredient:generic",
];
const unrelated = "meal-mix-ingredient:mix-supplement-broccoli:g:ingredient:generic";
const input = { recipeIds, matchKeys };
const sharedRecipeIds = Array.from({ length: 20 }, (_, index) =>
  `10000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`);
const sharedMatchKeys = [
  "meal-mix-ingredient:mix-supplement-olie:ml:ingredient:generic",
  "meal-mix-ingredient:mix-supplement-ui:piece:ingredient:generic",
];
const shanghaiRecipeIds = [
  "0dd9fbc7-6fa9-4b50-ab47-b1fa1e4cca8d", "17966cab-93ca-4364-b99c-c6fe7aff36ac",
  "189d9b3c-073a-43c7-8930-8191b22421bb", "2825125a-4ec4-4fae-a5f3-b44be2afb0aa",
  "39189d5d-21c6-4d57-a462-f95b63c0dda5", "3bbe1561-d757-422e-aded-3d802310805c",
  "4f871e07-a684-4014-843a-f72a11b4c01d", "5c655d2e-97f1-4d8c-8b97-10881e5589b0",
  "672ea259-71bc-446f-881c-8e59cf675fe2", "6a85d19f-5654-440b-b296-325c8f9fbd30",
  "6bb5396c-ee59-46bd-bb75-12f68c142fc2", "7ba39ebe-a057-4044-a47b-f9e79e2ef52f",
  "8f8c6883-2a58-4671-b5c4-13cd588d72ba", "ac562f36-fa92-4540-9e2d-4e073ca6b989",
  "af9c3407-a24d-4142-b8b6-cc18bc63defd", "bd423b61-4eb8-458e-8d32-bb64a9b38bda",
  "c4ace2a9-237b-4884-93d4-12fdc066274b", "c6903433-cfd0-4c97-ae1f-350f1625636b",
  "de621d70-dab9-4ad0-9747-43605a34af2a", "e33fcd95-34c9-471d-befe-76095b9d96e9",
];
const sharedAssignments = sharedRecipeIds.map((_, index) =>
  index < 11 ? [sharedMatchKeys[0]] : index < 16 ? sharedMatchKeys : [sharedMatchKeys[1]],
);
const sharedUnrelated = "meal-mix-ingredient:mix-supplement-zout:g:ingredient:generic";
const sharedKeysByPeople = (indices: number[]) => new Map(Array.from({ length: 10 }, (_, index) =>
  [index + 1, new Map(indices.map((recipeIndex) => [
    sharedRecipeIds[recipeIndex], [...sharedAssignments[recipeIndex], sharedUnrelated],
  ]))],
));
const sharedSubscribers = (indices: number[]) => Array.from({ length: 10 }, (_, index) =>
  indices.map((recipeIndex) => ({
    recipe_id: sharedRecipeIds[recipeIndex],
    people_count: index + 1,
    updated_at: "2026-10-02T10:00:00.000Z",
    dependency_match_keys: [...sharedAssignments[recipeIndex], sharedUnrelated],
  })),
).flat();
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
  it("allows post-commit verification only for either exact fixed one-time scope", () => {
    expect(boundedVerificationScope({ recipeIds: approvedLegacyRecipeIds, matchKeys }))
      .toEqual({ recipeIds: [...approvedLegacyRecipeIds].sort(), matchKeys: [...matchKeys].sort() });
    expect(boundedVerificationScope({ recipeIds: shanghaiRecipeIds, matchKeys: sharedMatchKeys }))
      .toEqual({ recipeIds: [...shanghaiRecipeIds].sort(), matchKeys: [...sharedMatchKeys].sort() });
    expect(boundedVerificationScope({ recipeIds: [...shanghaiRecipeIds, recipeIds[0]], matchKeys: sharedMatchKeys })).toBeNull();
    expect(boundedVerificationScope({ recipeIds: shanghaiRecipeIds, matchKeys: [...sharedMatchKeys, matchKeys[0]] })).toBeNull();
  });

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
    expect(parseBoundedRefreshInput({ recipeIds: Array.from({ length: 21 }, (_, i) => `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`), matchKeys })).toBeNull();
    expect(parseBoundedRefreshInput({ recipeIds: sharedRecipeIds, matchKeys: sharedMatchKeys })?.recipeIds).toEqual([...sharedRecipeIds].sort());
    expect(parseBoundedRefreshInput({ recipeIds, matchKeys, expectedPlanToken: "bad" })).toBeNull();
    expect(parseBoundedRefreshInput(input)).toEqual({ recipeIds: [...recipeIds].sort(), matchKeys: [...matchKeys].sort(), expectedPlanToken: undefined });
  });

  it("normaliseert UUID-casing vóór DB-scopevergelijking en weigert dubbele UUID's met andere casing", () => {
    const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
    expect(parseBoundedRefreshInput({ recipeIds: [id.toUpperCase()], matchKeys })?.recipeIds).toEqual([id]);
    expect(parseBoundedRefreshInput({ recipeIds: [id, id.toUpperCase()], matchKeys })).toBeNull();
  });

  it("houdt één matchkey met acht subscribers binnen de volledige 1–10 scope", () => {
    const indices = Array.from({ length: 8 }, (_, index) => index);
    const plan = buildBoundedRefreshPlan({
      recipeIds: indices.map((index) => sharedRecipeIds[index]), matchKeys: [sharedMatchKeys[0]],
    }, sharedKeysByPeople(indices), sharedSubscribers(indices), indices.map((index) => sharedRecipeIds[index]));
    expect(plan).toMatchObject({ blocked: false, plannedMatchWrites: 1, plannedReadinessWrites: 80 });
  });

  it("plant één gedeelde matchkey voor alle zestien subscribers boven de oude limiet", () => {
    const indices = Array.from({ length: 16 }, (_, index) => index);
    const rows = sharedSubscribers(indices).filter((row) =>
      row.dependency_match_keys.includes(sharedMatchKeys[0]),
    );
    const plan = buildBoundedRefreshPlan({
      recipeIds: indices.map((index) => sharedRecipeIds[index]), matchKeys: [sharedMatchKeys[0]],
    }, sharedKeysByPeople(indices), rows, indices.map((index) => sharedRecipeIds[index]));
    expect(plan).toMatchObject({ blocked: false, plannedMatchWrites: 1, plannedReadinessWrites: 160 });
  });

  it("dedupliceert 16 olie- plus 9 ui-recepten met vijf overlaps tot exact twintig", () => {
    const indices = Array.from({ length: 20 }, (_, index) => index);
    const plan = buildBoundedRefreshPlan({
      recipeIds: sharedRecipeIds, matchKeys: sharedMatchKeys,
    }, sharedKeysByPeople(indices), sharedSubscribers(indices), sharedRecipeIds);
    expect(plan).toMatchObject({
      blocked: false, requestedRecipeIds: sharedRecipeIds, resolvedRecipeIds: sharedRecipeIds,
      requestedMatchKeys: [...sharedMatchKeys].sort(), plannedMatchWrites: 2,
      plannedReadinessWrites: 200, unexpectedDependencies: [],
    });
    expect(plan).toHaveProperty("planToken", expect.stringMatching(/^[a-f0-9]{64}$/));
  });

  it("faalt gesloten bij een ontbrekende subscriber, een extra recipe_id en een gewijzigde subscriberset", () => {
    const indices = Array.from({ length: 16 }, (_, index) => index);
    const requestedIds = indices.map((index) => sharedRecipeIds[index]);
    const matchKey = sharedMatchKeys[0];
    const completeRows = sharedSubscribers(indices).filter((row) => row.dependency_match_keys.includes(matchKey));
    const missingRows = completeRows.filter((row) => row.recipe_id !== requestedIds[15]);
    const missing = buildBoundedRefreshPlan({ recipeIds: requestedIds, matchKeys: [matchKey] },
      sharedKeysByPeople(indices), missingRows, requestedIds);
    expect(missing).toMatchObject({ blocked: true, reason: "subscriber_scope_mismatch", plannedMatchWrites: 0, plannedReadinessWrites: 0 });

    const extraId = "10000000-0000-4000-8000-000000000021";
    const extraRequestIds = [...requestedIds, extraId];
    const extraMaps = sharedKeysByPeople(indices);
    for (const people of Array.from({ length: 10 }, (_, index) => index + 1)) {
      extraMaps.get(people)?.set(extraId, [matchKey, sharedUnrelated]);
    }
    const extra = buildBoundedRefreshPlan({ recipeIds: extraRequestIds, matchKeys: [matchKey] },
      extraMaps, completeRows, extraRequestIds);
    expect(extra).toMatchObject({ blocked: true, reason: "subscriber_scope_mismatch", plannedMatchWrites: 0, plannedReadinessWrites: 0 });

    const changedRows = [...completeRows, {
      ...completeRows[0], recipe_id: sharedRecipeIds[16], dependency_match_keys: [matchKey],
    }];
    const changed = buildBoundedRefreshPlan({ recipeIds: requestedIds, matchKeys: [matchKey] },
      sharedKeysByPeople(indices), changedRows, requestedIds);
    expect(changed).toMatchObject({ blocked: true, reason: "dependency_outside_allowlist", plannedMatchWrites: 0, plannedReadinessWrites: 0 });
  });
});
