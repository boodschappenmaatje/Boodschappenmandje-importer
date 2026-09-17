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
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { calculateBudget } from "@/services/budget/budget-engine";
import {
  createCatalogRepository,
  type CatalogRepository,
} from "@/services/catalog/catalog-repository";
import {
  createIndexedDbWeekPreparationStorage,
  type WeekPreparationStorage,
} from "@/services/week-preparation/indexeddb-storage";
import {
  createRecipeRepository,
  type RecipeRepository,
} from "@/services/week-preparation/recipe-repository";
import {
  calculateWeekBudgetSummary,
  generatePreparedWeek,
  markWeekGenerating,
  markWeekGenerationFailed,
  recalculateMealBudgetSummary,
  refreshGeneratedWeek,
  revalidatePreparedWeek,
} from "@/services/week-preparation/week-generation";
import {
  changePreparedDayCategory,
  createWeekPreparation,
  prepareWeek,
  setMealBudgetCents as updateMealBudgetCents,
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
  actionMessage: string | null;
  startPreparation: () => void;
  startNewPreparation: () => Promise<void>;
  setNumberOfPeople: (value: number | null) => void;
  setNumberOfDays: (value: number | null) => void;
  setBudgetCents: (value: number) => void;
  setMealBudgetCents: (value: number) => void;
  adjustCategory: (category: MealCategory, change: -1 | 1) => void;
  setPreference: (preference: keyof WeekPreferences, value: boolean) => void;
  confirmPreparation: () => void;
  retryGeneration: () => void;
  completeShoppingList: () => void;
  changeDayCategory: (dayIndex: number, category: MealCategory) => void;
}

const WeekPreparationContext =
  createContext<WeekPreparationContextValue | null>(null);

interface WeekPreparationProviderProps {
  children?: ReactNode;
  initialPreparation?: WeekPreparation | null;
  storage?: WeekPreparationStorage;
  recipeRepository?: RecipeRepository;
  catalogRepository?: CatalogRepository;
}

export function WeekPreparationProvider({
  children,
  initialPreparation,
  storage: suppliedStorage,
  recipeRepository: suppliedRecipeRepository,
  catalogRepository: suppliedCatalogRepository,
}: WeekPreparationProviderProps) {
  const {
    status: budgetStatus,
    settings: budgetSettings,
    result: budgetResult,
    setPeople: setBudgetPeople,
    setDays: setBudgetDays,
    setBudgetCents: updateBudgetCents,
  } = useBudget();
  const shoppingList = useActiveShoppingList();
  const [status, setStatus] = useState<WeekPreparationProviderStatus>(
    initialPreparation !== undefined ? "ready" : "loading",
  );
  const [preparation, setPreparation] = useState<WeekPreparation | null>(
    initialPreparation ?? null,
  );
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const preparationRef = useRef<WeekPreparation | null>(initialPreparation ?? null);
  const storageRef = useRef<WeekPreparationStorage | null>(suppliedStorage ?? null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const generationRunRef = useRef(0);
  const refreshedWeekRef = useRef<string | null>(null);

  const recipeRepository = useCallback(
    () => suppliedRecipeRepository ?? createRecipeRepository(),
    [suppliedRecipeRepository],
  );
  const catalogRepository = useCallback(
    () => suppliedCatalogRepository ?? createCatalogRepository(),
    [suppliedCatalogRepository],
  );

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

  const runGeneration = useCallback(
    async (base: WeekPreparation) => {
      const run = generationRunRef.current + 1;
      generationRunRef.current = run;
      setActionMessage(null);
      replace(markWeekGenerating(base));
      try {
        const generated = await generatePreparedWeek(
          { ...base, status: "readyForGeneration" },
          recipeRepository(),
          catalogRepository(),
          new Date(),
          shoppingList.list ?? undefined,
        );
        if (generationRunRef.current !== run) return;
        refreshedWeekRef.current = generated.id;
        replace(generated);
      } catch {
        if (generationRunRef.current !== run) return;
        replace(markWeekGenerationFailed(base));
      }
    },
    [catalogRepository, recipeRepository, replace, shoppingList.list],
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
        const recovered =
          stored?.status === "generating"
            ? { ...stored, status: "readyForGeneration" as const }
            : stored;
        preparationRef.current = recovered;
        setPreparation(recovered);
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
    if (
      status !== "ready" ||
      !current ||
      refreshedWeekRef.current === current.id ||
      !["generated", "generationPartial"].includes(current.status)
    ) {
      return;
    }
    refreshedWeekRef.current = current.id;
    let active = true;
    void refreshGeneratedWeek(
      current,
      recipeRepository(),
      catalogRepository(),
      new Date(),
      shoppingList.list ?? undefined,
    )
      .then((refreshed) => {
        if (active && preparationRef.current?.id === refreshed.id) {
          replace(refreshed);
        }
      })
      .catch(() => {
        // De opgeslagen selectie en laatst bekende echte productinformatie
        // blijven bruikbaar wanneer Supabase tijdelijk niet bereikbaar is.
      });
    return () => {
      active = false;
    };
  }, [catalogRepository, recipeRepository, replace, shoppingList.list, status]);

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
    commit((latest) => {
      const updated = updateWeekSettings(latest, budgetSettings);
      return shoppingList.list
        ? recalculateMealBudgetSummary(updated, shoppingList.list)
        : updated;
    });
  }, [budgetSettings, budgetStatus, commit, shoppingList.list, status]);

  const currentListContext = useCallback(
    () => ({
      knownSubtotalCents: budgetResult.knownSubtotalCents,
      unpricedItemCount: budgetResult.unpricedItemCount,
    }),
    [budgetResult.knownSubtotalCents, budgetResult.unpricedItemCount],
  );

  const createFreshPreparation = useCallback(() => {
    generationRunRef.current += 1;
    refreshedWeekRef.current = null;
    setActionMessage(null);
    const previousMealBudget = preparationRef.current?.mealBudgetCents ?? null;
    const fresh = createWeekPreparation(budgetSettings, currentListContext());
    replace(updateMealBudgetCents(fresh, previousMealBudget));
  }, [budgetSettings, currentListContext, replace]);

  const startNewPreparation = useCallback(async () => {
    generationRunRef.current += 1;
    refreshedWeekRef.current = null;
    setActionMessage(null);
    const current = preparationRef.current;
    const previousMealBudget = current?.mealBudgetCents ?? null;
    const cleanedList = current
      ? await shoppingList.removeMealPlanForWeek(current.id)
      : shoppingList.list;
    const cleanedBudget = cleanedList
      ? calculateBudget(null, cleanedList)
      : null;
    const fresh = createWeekPreparation(
      budgetSettings,
      cleanedBudget
        ? {
            knownSubtotalCents: cleanedBudget.knownSubtotalCents,
            unpricedItemCount: cleanedBudget.unpricedItemCount,
          }
        : currentListContext(),
    );
    replace(updateMealBudgetCents(fresh, previousMealBudget));
  }, [budgetSettings, currentListContext, replace, shoppingList]);

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
      commit((current) => {
        const updated = updateWeekSettings(current, {
          ...budgetSettings,
          budgetCents: value,
        });
        return shoppingList.list
          ? recalculateMealBudgetSummary(updated, shoppingList.list)
          : updated;
      });
    },
    [budgetSettings, commit, shoppingList.list, updateBudgetCents],
  );

  const setMealBudgetCents = useCallback(
    (value: number) => {
      const current = preparationRef.current;
      if (
        current &&
        current.generation?.mealBudgetStatus === "noValidMealPlanWithinBudget" &&
        current.days.every((day) => day.freeChoice || day.recipeId === null)
      ) {
        const updated = updateMealBudgetCents(current, value);
        void runGeneration({ ...updated, status: "readyForGeneration" });
        return;
      }
      commit((current) => {
        const updated = updateMealBudgetCents(current, value);
        return shoppingList.list
          ? recalculateMealBudgetSummary(updated, shoppingList.list)
          : updated;
      });
    },
    [commit, runGeneration, shoppingList.list],
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
    const current = preparationRef.current;
    if (!current) return;
    const prepared = prepareWeek(current, currentListContext());
    if (prepared.status !== "readyForGeneration") return;
    void runGeneration(prepared);
  }, [currentListContext, runGeneration]);

  const retryGeneration = useCallback(() => {
    const current = preparationRef.current;
    if (!current) return;
    if (
      current.status === "generationError" ||
      current.status === "readyForGeneration"
    ) {
      void runGeneration(current);
      return;
    }
    if (
      current.generation?.mealBudgetStatus === "noValidMealPlanWithinBudget" &&
      current.days.every((day) => day.freeChoice || day.recipeId === null)
    ) {
      void runGeneration({ ...current, status: "readyForGeneration" });
      return;
    }
    if (["generated", "generationPartial"].includes(current.status)) {
      refreshedWeekRef.current = null;
      void refreshGeneratedWeek(
        current,
        recipeRepository(),
        catalogRepository(),
        new Date(),
        shoppingList.list ?? undefined,
      )
        .then(replace)
        .catch(() => setActionMessage("Opnieuw controleren lukte nu niet."));
    }
  }, [catalogRepository, recipeRepository, replace, runGeneration, shoppingList.list]);

  const completeShoppingList = useCallback(() => {
    const current = preparationRef.current;
    const list = shoppingList.list;
    if (
      !current ||
      !list ||
      !["generated", "generationPartial"].includes(current.status)
    ) {
      return;
    }
    setActionMessage("Je gerechten worden nog één keer gecontroleerd…");
    void revalidatePreparedWeek(
      current,
      recipeRepository(),
      catalogRepository(),
      new Date(),
      list,
    )
      .then(async (validation) => {
        if (preparationRef.current?.id !== validation.preparation.id) return;
        replace(validation.preparation);
        if (!validation.ready) {
          setActionMessage(
            "Je lijst is niet aangepast. Eén of meer gerechten moeten eerst opnieuw worden gecontroleerd.",
          );
          return;
        }
        const before = calculateWeekBudgetSummary(validation.preparation, list);
        await shoppingList.completeFromWeek(
          validation.preparation.ingredients,
          validation.preparation.id,
        );
        setActionMessage(
          before.newPackageCount > 0
            ? `${before.newPackageCount} ${before.newPackageCount === 1 ? "verpakking is" : "verpakkingen zijn"} aan je lijst toegevoegd.`
            : "Je lijst bevatte deze boodschappen al.",
        );
      })
      .catch(() => setActionMessage("Je lijst aanvullen lukte nu niet."));
  }, [catalogRepository, recipeRepository, replace, shoppingList]);

  const changeDayCategory = useCallback(
    (dayIndex: number, category: MealCategory) => {
      const current = preparationRef.current;
      if (!current) return;
      const changed = changePreparedDayCategory(current, dayIndex, category);
      if (changed === current) return;
      void runGeneration(changed);
    },
    [runGeneration],
  );

  const value = useMemo<WeekPreparationContextValue>(
    () => ({
      status,
      preparation,
      persistenceWarning,
      actionMessage,
      startPreparation: createFreshPreparation,
      startNewPreparation,
      setNumberOfPeople,
      setNumberOfDays,
      setBudgetCents,
      setMealBudgetCents,
      adjustCategory,
      setPreference,
      confirmPreparation,
      retryGeneration,
      completeShoppingList,
      changeDayCategory,
    }),
    [
      actionMessage,
      adjustCategory,
      changeDayCategory,
      completeShoppingList,
      confirmPreparation,
      createFreshPreparation,
      persistenceWarning,
      preparation,
      retryGeneration,
      setBudgetCents,
      setMealBudgetCents,
      setNumberOfDays,
      setNumberOfPeople,
      setPreference,
      startNewPreparation,
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
