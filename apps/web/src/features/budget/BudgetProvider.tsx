"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { calculateBudget } from "@/services/budget/budget-engine";
import {
  DEFAULT_BUDGET_SETTINGS,
  loadBudgetSettings,
  saveBudgetSettings,
  type KeyValueStorage,
} from "@/services/budget/budget-settings-storage";
import type { BudgetResult, BudgetSettings } from "@/types/budget";
import {
  SHOPPING_LIST_SCHEMA_VERSION,
  type ActiveShoppingList,
} from "@/types/shopping-list";

type BudgetSettingsStatus = "loading" | "ready";

interface BudgetContextValue {
  status: BudgetSettingsStatus;
  settings: BudgetSettings;
  result: BudgetResult;
  persistenceWarning: string | null;
  setBudgetCents: (value: number) => void;
  resetBudget: () => void;
  setPeople: (value: number | null) => void;
  setDays: (value: number | null) => void;
}

const EMPTY_LIST: ActiveShoppingList = {
  schemaVersion: SHOPPING_LIST_SCHEMA_VERSION,
  startedAt: "",
  updatedAt: "",
  items: [],
};

const BudgetContext = createContext<BudgetContextValue | null>(null);

interface BudgetProviderProps {
  children?: ReactNode;
  initialSettings?: BudgetSettings;
  storage?: KeyValueStorage;
}

export function BudgetProvider({
  children,
  initialSettings,
  storage: suppliedStorage,
}: BudgetProviderProps) {
  const { list } = useActiveShoppingList();
  const [status, setStatus] = useState<BudgetSettingsStatus>(
    initialSettings ? "ready" : "loading",
  );
  const [settings, setSettings] = useState<BudgetSettings>(
    initialSettings ?? DEFAULT_BUDGET_SETTINGS,
  );
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(
    null,
  );
  const storageRef = useRef<KeyValueStorage | null>(suppliedStorage ?? null);

  useEffect(() => {
    if (initialSettings) return;
    let active = true;

    async function initialize() {
      await Promise.resolve();
      if (!active) return;
      try {
        const storage = suppliedStorage ?? window.localStorage;
        storageRef.current = storage;
        setSettings(loadBudgetSettings(storage));
        setPersistenceWarning(null);
      } catch {
        setSettings(DEFAULT_BUDGET_SETTINGS);
        setPersistenceWarning(
          "Je budget kon niet lokaal worden geopend. Je lijst is niet gewijzigd.",
        );
      } finally {
        setStatus("ready");
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, [initialSettings, suppliedStorage]);

  const updateSettings = useCallback(
    (update: (current: BudgetSettings) => BudgetSettings) => {
      setSettings((current) => {
        const next = update(current);
        try {
          const storage = storageRef.current;
          if (!storage) throw new Error("storage-unavailable");
          saveBudgetSettings(storage, next);
          setPersistenceWarning(null);
        } catch {
          setPersistenceWarning(
            "Je wijziging is zichtbaar, maar lokaal opslaan lukte niet.",
          );
        }
        return next;
      });
    },
    [],
  );

  const setBudgetCents = useCallback(
    (budgetCents: number) => {
      if (!Number.isSafeInteger(budgetCents) || budgetCents <= 0) return;
      updateSettings((current) => ({ ...current, budgetCents }));
    },
    [updateSettings],
  );

  const resetBudget = useCallback(
    () => updateSettings((current) => ({ ...current, budgetCents: null })),
    [updateSettings],
  );

  const setPeople = useCallback(
    (people: number | null) => {
      if (people !== null && (!Number.isInteger(people) || people < 1 || people > 12)) {
        return;
      }
      updateSettings((current) => ({ ...current, people }));
    },
    [updateSettings],
  );

  const setDays = useCallback(
    (days: number | null) => {
      if (days !== null && (!Number.isInteger(days) || days < 1 || days > 7)) {
        return;
      }
      updateSettings((current) => ({ ...current, days }));
    },
    [updateSettings],
  );

  const result = useMemo(
    () => calculateBudget(settings.budgetCents, list ?? EMPTY_LIST),
    [list, settings.budgetCents],
  );

  const value = useMemo<BudgetContextValue>(
    () => ({
      status,
      settings,
      result,
      persistenceWarning,
      setBudgetCents,
      resetBudget,
      setPeople,
      setDays,
    }),
    [
      persistenceWarning,
      resetBudget,
      result,
      setBudgetCents,
      setDays,
      setPeople,
      settings,
      status,
    ],
  );

  return <BudgetContext.Provider value={value}>{children}</BudgetContext.Provider>;
}

export function useBudget(): BudgetContextValue {
  const context = useContext(BudgetContext);
  if (!context) throw new Error("BudgetProvider ontbreekt.");
  return context;
}
