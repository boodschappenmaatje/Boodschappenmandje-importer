import { describe, expect, it } from "vitest";
import { addedMessage, buildAssistantContext } from "./maatje-assistant-client";

describe("addedMessage", () => {
  it("tells how much budget is left", () => {
    expect(addedMessage("Halfvolle melk", 1, 5000, 3800)).toBe("Halfvolle melk staat op je lijst. Dit past nog, je hebt nog € 12,00 over.");
  });

  it("warns when the budget is exceeded", () => {
    expect(addedMessage("Kaas", 2, 1000, 1350)).toBe("2× Kaas staat op je lijst. Let op: je zit nu € 3,50 boven je budget.");
  });

  it("skips the budget check without a budget", () => {
    expect(addedMessage("Brood", 1, null, 500)).toBe("Brood staat op je lijst!");
  });
});

describe("buildAssistantContext", () => {
  it("summarises the list, budget and week", () => {
    const context = buildAssistantContext({
      list: { schemaVersion: 1, startedAt: "", updatedAt: "", items: [{ name: "Brood", packageText: "800 g", quantity: 1, price: { amount: 2.49 } }] } as never,
      preparation: { days: [{ dayIndex: 2, recipe: { name: "Macaroni" }, freeChoice: false }, { dayIndex: 4, recipe: null, freeChoice: true }] } as never,
      budgetCents: 5000,
      plannedCents: 1200,
      missingPrices: 0,
      lastChoices: [],
    });
    expect(context.list).toEqual([{ name: "Brood", packageText: "800 g", quantity: 1, priceCents: 249 }]);
    expect(context.week).toEqual([{ day: "Woensdag", dish: "Macaroni" }, { day: "Vrijdag", dish: "vrije keuze" }]);
    expect(context.budget.remainingCents).toBe(3800);
  });
});
