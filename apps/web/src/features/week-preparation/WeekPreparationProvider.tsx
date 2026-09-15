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

import { useBudget } from "@/features/budget/BudgetProvider";
import {
  createIndexedDbWeekPreparationStorage,
  type WeekPreparationStorage,
} from "@/services/week-preparation/indexeddb-storage";
import {
  changePreparedDayCategory,
  createWeekPreparation,
  prepareWeek,
  setCategoryCount,
  setWeekPreference,
  updateWeekSettings,
} from "@/services/week-preparation/week-preparation";
import type {
  MealCategory,
  WeekPreparation,
  WeekPreferences,
} from "@/types/week-preparation";

type WeekPreparationProviderStatus = "loading" | "ready" | "error";

interface WeekPreparationContextValue {
  status: WeekPreparationProviderStatus;
  preparation: WeekPreparation | null;
  persistenceWarning: string | null;
  startPreparation: () => void;
  startNewPreparation: () => void;
  setNumberOfPeople: (value: number | null) => void;
  setNumberOfDays: (value: number | null) => void;
  setBudgetCents: (value: number) => void;
  adjustCategory: (category: MealCategory, change: -1 | 1) => void;
  setPreference: (preference: keyof WeekPreferences, value: boolean) => void;
  confirmPreparation: () => void;
  changeDayCategory: (dayIndex: number, category: MealCategory) => void;
}

const WeekPreparationContext =
  createContext<WeekPreparationContextValue | null>(null);

interface WeekPreparationProviderProps {
  children?: ReactNode;
  initialPreparation?: WeekPreparation | null;
  storage?: WeekPreparationStorage;
}

export function WeekPreparationProvider({
  children,
  initialPreparation,
  storage: suppliedStorage,
}: WeekPreparationProviderProps) {
  const {
    status: budgetStatus,
    settings: budgetSettings,
    result: budgetResult,
    setPeople: setBudgetPeople,
    setDays: setBudgetDays,
    setBudgetCents: updateBudgetCents,
  } = useBudget();
  const [status, setStatus] = useState<WeekPreparationProviderStatus>(
    initialPreparation !== undefined ? "ready" : "loading",
  );
  const [preparation, setPreparation] = useState<WeekPreparation | null>(
    initialPreparation ?? null,
  );
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const preparationRef = useRef<WeekPreparation | null>(initialPreparation ?? null);
  const storageRef = useRef<WeekPreparationStorage | null>(suppliedStorage ?? null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const persist = useCallback((next: WeekPreparation): Promise<void> => {
    const storage = storageRef.current;
    if (!storage) {
      setPersistenceWarning(
        "Je weekvoorbereiding kon niet veilig op dit apparaat worden opgeslagen.",
      );
      return Promise.resolve();
    }
    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => storage.save(next))
      .then(() => setPersistenceWarning(null))
      .catch(() => {
        setPersistenceWarning(
          "Je wijziging is zichtbaar, maar lokaal opslaan lukte niet.",
        );
      });
    return saveQueueRef.current;
  }, []);

  const replace = useCallback(
    (next: WeekPreparation) => {
      preparationRef.current = next;
      setPreparation(next);
      void persist(next);
    },
    [persist],
  );

  const commit = useCallback(
    (update: (current: WeekPreparation) => WeekPreparation) => {
      const current = preparationRef.current;
      if (!current) return;
      const next = update(current);
      if (next === current) return;
      replace(next);
    },
    [replace],
  );

  useEffect(() => {
    if (initialPreparation !== undefined) return;
    let active = true;

    async function initialize() {
      try {
        const storage = suppliedStorage ?? createIndexedDbWeekPreparationStorage();
        storageRef.current = storage;
        const stored = await storage.load();
        if (!active) return;
        preparationRef.current = stored;
        setPreparation(stored);
        setPersistenceWarning(null);
        setStatus("ready");
      } catch {
        if (!active) return;
        setStatus("error");
        setPersistenceWarning(
          "Je opgeslagen weekvoorbereiding kon niet worden geopend. Je boodschappenlijst is niet gewijzigd.",
        );
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, [initialPreparation, suppliedStorage]);

  useEffect(() => {
    const current = preparationRef.current;
    if (status !== "ready" || budgetStatus !== "ready" || !current) return;
    if (
      current.numberOfPeople === budgetSettings.people &&
      current.numberOfDays === budgetSettings.days &&
      current.budgetCents === budgetSettings.budgetCents
    ) {
      return;
    }
    commit((latest) => updateWeekSettings(latest, budgetSettings));
  }, [budgetSettings, budgetStatus, commit, status]);

  const currentListContext = useCallback(
    () => ({
      knownSubtotalCents: budgetResult.knownSubtotalCents,
      unpricedItemCount: budgetResult.unpricedItemCount,
    }),
    [budgetResult.knownSubtotalCents, budgetResult.unpricedItemCount],
  );

  const createFreshPreparation = useCallback(() => {
    replace(createWeekPreparation(budgetSettings, currentListContext()));
  }, [budgetSettings, currentListContext, replace]);

  const setNumberOfPeople = useCallback(
    (value: number | null) => {
      setBudgetPeople(value);
      commit((current) =>
        updateWeekSettings(current, { ...budgetSettings, people: value }),
      );
    },
    [budgetSettings, commit, setBudgetPeople],
  );

  const setNumberOfDays = useCallback(
    (value: number | null) => {
      setBudgetDays(value);
      commit((current) =>
        updateWeekSettings(current, { ...budgetSettings, days: value }),
      );
    },
    [budgetSettings, commit, setBudgetDays],
  );

  const setBudgetCents = useCallback(
    (value: number) => {
      updateBudgetCents(value);
      commit((current) =>
        updateWeekSettings(current, { ...budgetSettings, budgetCents: value }),
      );
    },
    [budgetSettings, commit, updateBudgetCents],
  );

  const adjustCategory = useCallback(
    (category: MealCategory, change: -1 | 1) => {
      commit((current) =>
        setCategoryCount(
          current,
          category,
          current.categoryDistribution[category] + change,
        ),
      );
    },
    [commit],
  );

  const setPreference = useCallback(
    (preference: keyof WeekPreferences, value: boolean) => {
      commit((current) => setWeekPreference(current, preference, value));
    },
    [commit],
  );

  const confirmPreparation = useCallback(() => {
    commit((current) => prepareWeek(current, currentListContext()));
  }, [commit, currentListContext]);

  const changeDayCategory = useCallback(
    (dayIndex: number, category: MealCategory) => {
      commit((current) =>
        changePreparedDayCategory(current, dayIndex, category),
      );
    },
    [commit],
  );

  const value = useMemo<WeekPreparationContextValue>(
    () => ({
      status,
      preparation,
      persistenceWarning,
      startPreparation: createFreshPreparation,
      startNewPreparation: createFreshPreparation,
      setNumberOfPeople,
      setNumberOfDays,
      setBudgetCents,
      adjustCategory,
      setPreference,
      confirmPreparation,
      changeDayCategory,
    }),
    [
      adjustCategory,
      changeDayCategory,
      confirmPreparation,
      createFreshPreparation,
      persistenceWarning,
      preparation,
      setBudgetCents,
      setNumberOfDays,
      setNumberOfPeople,
      setPreference,
      status,
    ],
  );

  return (
    <WeekPreparationContext.Provider value={value}>
      {children}
    </WeekPreparationContext.Provider>
  );
}

export function useWeekPreparation(): WeekPreparationContextValue {
  const context = useContext(WeekPreparationContext);
  if (!context) throw new Error("WeekPreparationProvider ontbreekt.");
  return context;
}
