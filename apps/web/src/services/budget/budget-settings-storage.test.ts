import { describe, expect, it } from "vitest";

import {
  BUDGET_SETTINGS_STORAGE_KEY,
  decodeBudgetSettings,
  loadBudgetSettings,
  saveBudgetSettings,
  type KeyValueStorage,
} from "@/services/budget/budget-settings-storage";
import type { BudgetSettings } from "@/types/budget";

class MemoryStorage implements KeyValueStorage {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const settings: BudgetSettings = {
  schemaVersion: 1,
  budgetCents: 10_000,
  people: 4,
  days: 7,
};

describe("lokale budgetpersistentie", () => {
  it("bewaart en herstelt budget, personen en dagen", () => {
    const storage = new MemoryStorage();
    saveBudgetSettings(storage, settings);
    expect(loadBudgetSettings(storage)).toEqual(settings);
  });

  it("migreert veilige ongeversioneerde gegevens naar schema v1", () => {
    expect(
      decodeBudgetSettings(
        JSON.stringify({ budgetCents: 7_550, people: 4, days: 6 }),
      ),
    ).toEqual({
      schemaVersion: 1,
      budgetCents: 7_550,
      people: 4,
      days: 6,
    });
  });

  it("herstelt veilig bij ongeldige data en ranges", () => {
    expect(decodeBudgetSettings("{kapot")).toMatchObject({
      schemaVersion: 1,
      budgetCents: null,
      people: null,
      days: null,
    });
    expect(
      decodeBudgetSettings(
        JSON.stringify({ budgetCents: -1, people: 13, days: 8 }),
      ),
    ).toMatchObject({
      budgetCents: null,
      people: null,
      days: null,
    });
    expect(
      decodeBudgetSettings(
        JSON.stringify({ schemaVersion: 99, budgetCents: 10_000 }),
      ),
    ).toMatchObject({ budgetCents: null });
  });

  it("laat de bestaande boodschappenlijstopslag intact", () => {
    const storage = new MemoryStorage();
    const existingList = "{\"key\":\"active\",\"list\":\"blijft-bestaan\"}";
    storage.values.set("shopping-lists:active", existingList);
    saveBudgetSettings(storage, settings);
    expect(storage.values.get("shopping-lists:active")).toBe(existingList);
    expect(storage.values.has(BUDGET_SETTINGS_STORAGE_KEY)).toBe(true);
  });

  it("reset alleen budget en behoudt lijst en huishoudinstellingen", () => {
    const storage = new MemoryStorage();
    storage.values.set("shopping-lists:active", "bestaande-lijst");
    saveBudgetSettings(storage, { ...settings, budgetCents: null });
    expect(loadBudgetSettings(storage)).toMatchObject({
      budgetCents: null,
      people: 4,
      days: 7,
    });
    expect(storage.values.get("shopping-lists:active")).toBe("bestaande-lijst");
  });
});
