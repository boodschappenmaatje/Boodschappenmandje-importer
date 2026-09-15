import {
  BUDGET_SETTINGS_SCHEMA_VERSION,
  type BudgetSettings,
} from "@/types/budget";

export const BUDGET_SETTINGS_STORAGE_KEY =
  "boodschappenmaatje:budget-settings";

export const DEFAULT_BUDGET_SETTINGS: BudgetSettings = {
  schemaVersion: BUDGET_SETTINGS_SCHEMA_VERSION,
  budgetCents: null,
  people: null,
  days: null,
};

export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function integerInRange(value: unknown, min: number, max: number): number | null {
  return Number.isInteger(value) && Number(value) >= min && Number(value) <= max
    ? Number(value)
    : null;
}

export function decodeBudgetSettings(value: string | null): BudgetSettings {
  if (!value) return DEFAULT_BUDGET_SETTINGS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return DEFAULT_BUDGET_SETTINGS;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return DEFAULT_BUDGET_SETTINGS;
  }
  const record = parsed as Record<string, unknown>;
  if (
    record.schemaVersion !== undefined &&
    record.schemaVersion !== BUDGET_SETTINGS_SCHEMA_VERSION
  ) {
    return DEFAULT_BUDGET_SETTINGS;
  }
  const budgetCents =
    Number.isSafeInteger(record.budgetCents) && Number(record.budgetCents) > 0
      ? Number(record.budgetCents)
      : null;

  // Ongeversioneerde proefdata wordt veilig naar v1 gemigreerd. Onbekende
  // velden worden niet meegenomen en de bestaande IndexedDB-lijst blijft los.
  return {
    schemaVersion: BUDGET_SETTINGS_SCHEMA_VERSION,
    budgetCents,
    people: integerInRange(record.people, 1, 12),
    days: integerInRange(record.days, 1, 7),
  };
}

export function loadBudgetSettings(storage: KeyValueStorage): BudgetSettings {
  return decodeBudgetSettings(storage.getItem(BUDGET_SETTINGS_STORAGE_KEY));
}

export function saveBudgetSettings(
  storage: KeyValueStorage,
  settings: BudgetSettings,
): void {
  storage.setItem(BUDGET_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}
