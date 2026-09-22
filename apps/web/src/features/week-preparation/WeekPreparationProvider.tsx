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
import { previewFreeChoice, searchFreeChoice, type FreeChoiceResult } from "@/services/week-preparation/free-choice";
import { customIngredientDefinition } from "@/services/week-preparation/custom-dish";
import { searchIngredientProduct } from "@/services/week-preparation/product-matching";
import type { CustomDish, WeekIngredientUnit } from "@/types/week-preparation";
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
  commitManualProductChoice,
  commitExplicitRecipeAlternative,
  findProductAlternatives as loadProductAlternatives,
  findRecipeAlternatives as loadRecipeAlternatives,
  listWithoutCurrentWeekMealPlan,
  previewManualProductChoice,
  replaceWeekProduct,
  replaceWeekRecipe,
  type ManualProductChoice,
  type ManualProductBudgetImpact,
  type ManualProductChoicePreview,
  type ManualProductPreviewResult,
  type ProductAlternative,
  type RecipeAlternative,
  type ExplicitRecipeChoicePreview,
} from "@/services/week-preparation/meal-customization";
import {
  createCachedCatalogRepository,
  createCachedRecipeRepository,
  createWeekPlanningSnapshotCache,
} from "@/services/week-preparation/planning-cache";
import { createPersistentRecipeReadinessRepository } from "@/services/week-preparation/persistent-readiness-cache";
import type { Product } from "@/types/catalog";
import {
  calculateWeekBudgetSummary,
  budgetOverrideReapprovalPreview,
  generatePreparedWeek,
  markWeekGenerating,
  markWeekGenerationFailed,
  recalculateMealBudgetSummary,
  refreshGeneratedWeek,
  revalidatePreparedWeek,
  reapproveCurrentBudgetOverride,
  type BudgetOverrideReapprovalPreview,
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
  searchDishes: (dayIndex: number, query: string, route?: "recipe" | "mix") => Promise<FreeChoiceResult[]>;
  previewCustomDish: (dayIndex: number, dish: CustomDish) => Promise<RecipeAlternative | null>;
  matchCustomIngredient: (name: string, unit: WeekIngredientUnit, productId?: string | null) => Promise<Product | null>;
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
  pendingBudgetReapproval: BudgetOverrideReapprovalPreview | null;
  approvePendingBudgetReapproval: () => void;
  cancelPendingBudgetReapproval: () => void;
  changeDayCategory: (dayIndex: number, category: MealCategory) => void;
  customizationBusy: boolean;
  findRecipeAlternatives: (dayIndex: number) => Promise<RecipeAlternative[]>;
  replaceRecipe: (dayIndex: number, recipeId: string) => Promise<boolean>;
  applyExplicitRecipe: (
    dayIndex: number,
    alternative: RecipeAlternative,
    approveBudgetOverride: boolean,
  ) => Promise<ExplicitRecipeApplyResult>;
  findProductAlternatives: (
    dayIndex: number,
    ingredientId: string,
  ) => Promise<ProductAlternative[]>;
  replaceProduct: (
    dayIndex: number,
    ingredientId: string,
    productId: string,
  ) => Promise<boolean>;
  searchCatalogProducts: (term: string, signal?: AbortSignal) => Promise<Product[]>;
  previewManualProduct: (
    choice: ManualProductChoice,
    product: Product,
  ) => ManualProductPreviewResult;
  applyManualProduct: (
    choice: ManualProductChoice,
    expectedImpact: ManualProductBudgetImpact,
    approveBudgetOverride: boolean,
  ) => Promise<ManualProductApplyResult>;
}

export type ManualProductApplyResult =
  | { applied: true }
  | {
      applied: false;
      revalidatedPreview?: ManualProductChoicePreview;
    };

export type ExplicitRecipeApplyResult =
  | { applied: true }
  | {
      applied: false;
      revalidatedPreview?: ExplicitRecipeChoicePreview;
    };

interface PendingBudgetReapproval {
  preparation: WeekPreparation;
  preview: BudgetOverrideReapprovalPreview;
}

function sameBudgetImpact(
  left: ManualProductBudgetImpact,
  right: ManualProductBudgetImpact,
): boolean {
  return (
    left.currentMealPlanCostCents === right.currentMealPlanCostCents &&
    left.nextMealPlanCostCents === right.nextMealPlanCostCents &&
    left.mealPlanDifferenceCents === right.mealPlanDifferenceCents &&
    left.mealBudgetCents === right.mealBudgetCents &&
    left.mealBudgetOverageCents === right.mealBudgetOverageCents &&
    left.currentTotalWeekCostCents === right.currentTotalWeekCostCents &&
    left.nextTotalWeekCostCents === right.nextTotalWeekCostCents &&
    left.totalWeekDifferenceCents === right.totalWeekDifferenceCents &&
    left.weekBudgetCents === right.weekBudgetCents &&
    left.weekBudgetOverageCents === right.weekBudgetOverageCents &&
    left.weekBudgetRemainingCents === right.weekBudgetRemainingCents &&
    left.requiresBudgetOverride === right.requiresBudgetOverride
  );
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
  const [customizationBusy, setCustomizationBusy] = useState(false);
  const [pendingBudgetReapproval, setPendingBudgetReapproval] =
    useState<PendingBudgetReapproval | null>(null);
  const preparationRef = useRef<WeekPreparation | null>(initialPreparation ?? null);
  const storageRef = useRef<WeekPreparationStorage | null>(suppliedStorage ?? null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const generationRunRef = useRef(0);
  const generationInFlightRef = useRef(false);
  const refreshedWeekRef = useRef<string | null>(null);
  const customizationRunRef = useRef(false);
  const recipeRepositoryCacheRef = useRef<{
    source: RecipeRepository | undefined;
    repository: RecipeRepository | null;
  }>({ source: undefined, repository: null });
  const catalogRepositoryCacheRef = useRef<{
    source: CatalogRepository | undefined;
    repository: CatalogRepository | null;
  }>({ source: undefined, repository: null });
  const planningSnapshotCacheRef = useRef(
    createWeekPlanningSnapshotCache({
      persistentRepository: createPersistentRecipeReadinessRepository(),
    }),
  );

  const recipeRepository = useCallback(
    () => {
      const cached = recipeRepositoryCacheRef.current;
      if (!cached.repository || cached.source !== suppliedRecipeRepository) {
        cached.source = suppliedRecipeRepository;
        cached.repository = createCachedRecipeRepository(
          suppliedRecipeRepository ?? createRecipeRepository(),
        );
      }
      return cached.repository;
    },
    [suppliedRecipeRepository],
  );
  const catalogRepository = useCallback(
    () => {
      const cached = catalogRepositoryCacheRef.current;
      if (!cached.repository || cached.source !== suppliedCatalogRepository) {
        cached.source = suppliedCatalogRepository;
        cached.repository = createCachedCatalogRepository(
          suppliedCatalogRepository ?? createCatalogRepository(),
        );
      }
      return cached.repository;
    },
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
      if (generationInFlightRef.current) return;
      generationInFlightRef.current = true;
      const run = generationRunRef.current + 1;
      generationRunRef.current = run;
      setPendingBudgetReapproval(null);
      setActionMessage(null);
      replace(markWeekGenerating(base));
      try {
        const generated = await generatePreparedWeek(
          { ...base, status: "readyForGeneration" },
          recipeRepository(),
          catalogRepository(),
          new Date(),
          shoppingList.list ?? undefined,
          { cache: planningSnapshotCacheRef.current },
        );
        if (generationRunRef.current !== run) return;
        refreshedWeekRef.current = generated.id;
        replace(generated);
      } catch {
        if (generationRunRef.current !== run) return;
        replace(markWeekGenerationFailed(base));
      } finally {
        generationInFlightRef.current = false;
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
          const reapproval = budgetOverrideReapprovalPreview(refreshed);
          if (reapproval) {
            setPendingBudgetReapproval({
              preparation: refreshed,
              preview: reapproval,
            });
            setActionMessage(
              "De actuele prijs of hoeveelheid is gewijzigd. Controleer de bedragen en bevestig opnieuw.",
            );
            return;
          }
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
    setPendingBudgetReapproval(null);
    setActionMessage(null);
    const previousMealBudget = preparationRef.current?.mealBudgetCents ?? null;
    const fresh = createWeekPreparation(budgetSettings, currentListContext());
    replace(updateMealBudgetCents(fresh, previousMealBudget));
  }, [budgetSettings, currentListContext, replace]);

  const startNewPreparation = useCallback(async () => {
    generationRunRef.current += 1;
    refreshedWeekRef.current = null;
    setPendingBudgetReapproval(null);
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
    setPendingBudgetReapproval(null);
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
        if (!validation.ready) {
          const reapproval = budgetOverrideReapprovalPreview(
            validation.preparation,
          );
          if (reapproval) {
            setPendingBudgetReapproval({
              preparation: validation.preparation,
              preview: reapproval,
            });
            setActionMessage(
              "De prijs of hoeveelheid is gewijzigd. Controleer de actuele bedragen en bevestig opnieuw.",
            );
            return;
          }
          replace(validation.preparation);
          setActionMessage(
            "Je lijst is niet aangepast. Eén of meer gerechten moeten eerst opnieuw worden gecontroleerd.",
          );
          return;
        }
        replace(validation.preparation);
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

  const cancelPendingBudgetReapproval = useCallback(() => {
    setPendingBudgetReapproval(null);
    setActionMessage("Er is niets gewijzigd.");
  }, []);

  const approvePendingBudgetReapproval = useCallback(() => {
    const pending = pendingBudgetReapproval;
    const list = shoppingList.list;
    if (
      !pending ||
      !list ||
      customizationRunRef.current ||
      preparationRef.current?.id !== pending.preparation.id
    ) {
      return;
    }
    const approved = reapproveCurrentBudgetOverride(
      pending.preparation,
      pending.preview,
    );
    if (!approved) {
      setPendingBudgetReapproval(null);
      setActionMessage(
        "De keuze is opnieuw gewijzigd. Open het gerecht en controleer de actuele bedragen.",
      );
      return;
    }
    customizationRunRef.current = true;
    setCustomizationBusy(true);
    setActionMessage("Actuele prijzen, gerecht en lijst worden opnieuw gecontroleerd…");
    void revalidatePreparedWeek(
      approved,
      recipeRepository(),
      catalogRepository(),
      new Date(),
      list,
    )
      .then(async (validation) => {
        if (preparationRef.current?.id !== validation.preparation.id) return;
        if (!validation.ready) {
          const nextReapproval = budgetOverrideReapprovalPreview(
            validation.preparation,
          );
          if (nextReapproval) {
            setPendingBudgetReapproval({
              preparation: validation.preparation,
              preview: nextReapproval,
            });
            setActionMessage(
              "De prijs is opnieuw gewijzigd. Controleer het nieuwe bedrag en bevestig opnieuw.",
            );
            return;
          }
          setPendingBudgetReapproval(null);
          setActionMessage(
            "De lijst is niet aangepast: het product of gerecht is niet meer compleet beschikbaar.",
          );
          return;
        }
        const before = calculateWeekBudgetSummary(validation.preparation, list);
        await shoppingList.completeFromWeek(
          validation.preparation.ingredients,
          validation.preparation.id,
        );
        replace(validation.preparation);
        setPendingBudgetReapproval(null);
        setActionMessage(
          before.newPackageCount > 0
            ? `${before.newPackageCount} ${before.newPackageCount === 1 ? "verpakking is" : "verpakkingen zijn"} aan je lijst toegevoegd.`
            : "Je lijst bevatte deze boodschappen al.",
        );
      })
      .catch(() =>
        setActionMessage(
          "Opnieuw bevestigen lukte nu niet. Je lijst is niet aangepast.",
        ),
      )
      .finally(() => {
        customizationRunRef.current = false;
        setCustomizationBusy(false);
      });
  }, [
    catalogRepository,
    pendingBudgetReapproval,
    recipeRepository,
    replace,
    shoppingList,
  ]);

  const currentList = useCallback(
    () => shoppingList.list ?? undefined,
    [shoppingList.list],
  );

  const syncValidatedCustomization = useCallback(
    async (next: WeekPreparation): Promise<boolean> => {
      const list = shoppingList.list;
      const alreadyCompleted = Boolean(
        list?.items.some((item) =>
          item.quantityContributions.mealPlans.some(
            (contribution) => contribution.weekPreparationId === next.id,
          ),
        ),
      );
      try {
        // Synchroniseer eerst de lijst. Bij een opslagfout blijft de zichtbare
        // week daardoor volledig ongewijzigd in plaats van half aangepast.
        if (alreadyCompleted || next.days.some((day) => day.category === "freeChoice" && day.recipe)) {
          await shoppingList.completeFromWeek(next.ingredients, next.id);
        }
        setPendingBudgetReapproval(null);
        replace(next);
        setActionMessage(
          alreadyCompleted
            ? "Gerecht en boodschappenlijst zijn bijgewerkt."
            : "Je gerecht is aangepast.",
        );
        return true;
      } catch (error) {
        console.error("[week-preparation] customization sync failed", {
          weekPreparationId: next.id,
          error,
        });
        setActionMessage(
          "Aanpassen lukte nu niet. Je huidige gerecht en lijst zijn behouden.",
        );
        return false;
      }
    },
    [replace, shoppingList],
  );

  const changeDayCategory = useCallback(
    (dayIndex: number, category: MealCategory) => {
      const current = preparationRef.current;
      if (!current || customizationRunRef.current || generationInFlightRef.current) return;
      const changed = changePreparedDayCategory(current, dayIndex, category);
      if (changed === current) return;
      customizationRunRef.current = true;
      setCustomizationBusy(true);
      const selectChangedDay = async () => {
        if (category === "freeChoice") return changed;
        const selected = await generatePreparedWeek({ ...changed, days: changed.days.filter((day) => day.dayIndex === dayIndex), customizations: [] }, recipeRepository(), catalogRepository());
        return { ...changed, days: changed.days.map((day) => day.dayIndex === dayIndex ? selected.days[0] : day) };
      };
      void selectChangedDay().then((next) => revalidatePreparedWeek(next, recipeRepository(), catalogRepository(), new Date(), listWithoutCurrentWeekMealPlan(currentList(), current.id)))
        .then((result) => syncValidatedCustomization(result.preparation))
        .catch(() => setActionMessage("Wijzigen lukt nu niet. Je huidige week is behouden."))
        .finally(() => { customizationRunRef.current = false; setCustomizationBusy(false); });
    }, [catalogRepository, currentList, recipeRepository, syncValidatedCustomization],
  );

  const searchDishes = useCallback(async (dayIndex: number, query: string, route?: "recipe" | "mix") => {
    const current = preparationRef.current;
    return current ? searchFreeChoice(current, dayIndex, query, recipeRepository(), catalogRepository(), currentList(), planningSnapshotCacheRef.current, route) : [];
  }, [catalogRepository, currentList, recipeRepository]);
  const previewCustomDish = useCallback(async (dayIndex: number, customDish: CustomDish) => {
    const current = preparationRef.current;
    return current ? previewFreeChoice(current, dayIndex, { customDish }, recipeRepository(), catalogRepository(), currentList()) : null;
  }, [catalogRepository, currentList, recipeRepository]);
  const matchCustomIngredient = useCallback(async (name: string, unit: WeekIngredientUnit, productId?: string | null) => {
    if (productId) return (await catalogRepository().getByIds([productId])).products.find((product) => product.id === productId) ?? null;
    const catalog = await recipeRepository().loadCatalog();
    return (await searchIngredientProduct(catalogRepository(), customIngredientDefinition(name, "custom-preview", catalog), null, unit)).product;
  }, [catalogRepository, recipeRepository]);

  const findRecipeAlternatives = useCallback(
    async (dayIndex: number): Promise<RecipeAlternative[]> => {
      const current = preparationRef.current;
      if (!current) return [];
      setActionMessage(null);
      try {
        return await loadRecipeAlternatives(
          current,
          dayIndex,
          recipeRepository(),
          catalogRepository(),
          listWithoutCurrentWeekMealPlan(
            currentList(),
            current.id,
          ),
        );
      } catch {
        setActionMessage(
          "Alternatieven laden lukt nu niet. Je huidige gerecht blijft staan.",
        );
        return [];
      }
    },
    [catalogRepository, currentList, recipeRepository],
  );

  const replaceRecipe = useCallback(
    async (dayIndex: number, recipeId: string): Promise<boolean> => {
      if (customizationRunRef.current) return false;
      const current = preparationRef.current;
      if (!current) return false;
      customizationRunRef.current = true;
      setCustomizationBusy(true);
      setActionMessage("Gerecht en actuele prijzen worden gecontroleerd…");
      try {
        const result = await replaceWeekRecipe(
          current,
          dayIndex,
          recipeId,
          recipeRepository(),
          catalogRepository(),
          currentList(),
        );
        if (!result.ok) {
          setActionMessage(
            result.reason === "over_meal_budget"
              ? "Dit gerecht past niet binnen je maaltijd-budget. Kies een ander gerecht."
              : "Dit gerecht is niet meer compleet beschikbaar. Er is niets gewijzigd.",
          );
          return false;
        }
        return await syncValidatedCustomization(result.preparation);
      } catch {
        setActionMessage(
          "Aanpassen lukt nu niet. Je huidige gerecht en lijst zijn behouden.",
        );
        return false;
      } finally {
        customizationRunRef.current = false;
        setCustomizationBusy(false);
      }
    },
    [catalogRepository, currentList, recipeRepository, syncValidatedCustomization],
  );

  const applyExplicitRecipe = useCallback(
    async (
      dayIndex: number,
      alternative: RecipeAlternative,
      approveBudgetOverride: boolean,
    ): Promise<ExplicitRecipeApplyResult> => {
      if (customizationRunRef.current) return { applied: false };
      const current = preparationRef.current;
      if (!current) return { applied: false };
      customizationRunRef.current = true;
      setCustomizationBusy(true);
      setActionMessage("Gerecht, actuele prijzen en budget worden opnieuw gecontroleerd…");
      try {
        const validationNow = new Date();
        const validationList = listWithoutCurrentWeekMealPlan(
          currentList(),
          current.id,
          validationNow,
        );
        const committed = await commitExplicitRecipeAlternative(
          current,
          dayIndex,
          alternative,
          approveBudgetOverride,
          recipeRepository(),
          catalogRepository(),
          validationList,
          validationNow,
        );
        if (!committed.ok) {
          setActionMessage(
            committed.reason === "budget_impact_changed"
              ? "De prijs of je budget is gewijzigd. Controleer de nieuwe bedragen en bevestig opnieuw."
              : committed.reason === "budget_override_required"
              ? "Bevestig eerst bewust dat je deze budgetoverschrijding accepteert."
              : "Dit gerecht is niet meer compleet beschikbaar. Er is niets gewijzigd.",
          );
          return committed.preview
            ? { applied: false, revalidatedPreview: committed.preview }
            : { applied: false };
        }
        if (preparationRef.current !== current) {
          setActionMessage("Je week is ondertussen gewijzigd. Controleer je gerecht opnieuw voordat je opslaat.");
          return { applied: false };
        }
        return await syncValidatedCustomization(committed.preparation)
          ? { applied: true }
          : { applied: false };
      } catch (error) {
        console.error("[week-preparation] explicit recipe replacement failed", {
          dayIndex,
          recipeId: alternative.recipe.id,
          error,
        });
        setActionMessage(
          "Aanpassen lukt nu niet. Je huidige gerecht en lijst zijn behouden.",
        );
        return { applied: false };
      } finally {
        customizationRunRef.current = false;
        setCustomizationBusy(false);
      }
    },
    [catalogRepository, currentList, recipeRepository, syncValidatedCustomization],
  );

  const findProductAlternatives = useCallback(
    async (
      dayIndex: number,
      ingredientId: string,
    ): Promise<ProductAlternative[]> => {
      const current = preparationRef.current;
      if (!current) return [];
      setActionMessage(null);
      try {
        return await loadProductAlternatives(
          current,
          dayIndex,
          ingredientId,
          recipeRepository(),
          catalogRepository(),
          currentList(),
        );
      } catch {
        setActionMessage(
          "Productalternatieven laden lukt nu niet. Je huidige keuze blijft staan.",
        );
        return [];
      }
    },
    [catalogRepository, currentList, recipeRepository],
  );

  const replaceProduct = useCallback(
    async (
      dayIndex: number,
      ingredientId: string,
      productId: string,
    ): Promise<boolean> => {
      if (customizationRunRef.current) return false;
      const current = preparationRef.current;
      if (!current) return false;
      customizationRunRef.current = true;
      setCustomizationBusy(true);
      setActionMessage("Product en budget worden gecontroleerd…");
      try {
        const result = await replaceWeekProduct(
          current,
          dayIndex,
          ingredientId,
          productId,
          recipeRepository(),
          catalogRepository(),
          currentList(),
        );
        if (!result.ok) {
          setActionMessage(
            result.reason === "over_meal_budget"
              ? "Dit product past niet binnen je maaltijd-budget."
              : "Dit is geen betrouwbaar alternatief voor dit ingrediënt.",
          );
          return false;
        }
        return await syncValidatedCustomization(result.preparation);
      } catch {
        setActionMessage(
          "Aanpassen lukt nu niet. Je huidige product en lijst zijn behouden.",
        );
        return false;
      } finally {
        customizationRunRef.current = false;
        setCustomizationBusy(false);
      }
    },
    [catalogRepository, currentList, recipeRepository, syncValidatedCustomization],
  );

  const searchCatalogProducts = useCallback(
    async (term: string, signal?: AbortSignal): Promise<Product[]> => {
      const result = await catalogRepository().query({
        term,
        page: 1,
        pageSize: 12,
        sort: "relevance",
        signal,
      });
      return result.products;
    },
    [catalogRepository],
  );

  const previewManualProduct = useCallback(
    (
      choice: ManualProductChoice,
      product: Product,
    ): ManualProductPreviewResult => {
      const current = preparationRef.current;
      if (!current) return { ok: false, reason: "day_not_found" };
      return previewManualProductChoice(
        current,
        choice,
        product,
        currentList(),
      );
    },
    [currentList],
  );

  const applyManualProduct = useCallback(
    async (
      choice: ManualProductChoice,
      expectedImpact: ManualProductBudgetImpact,
      approveBudgetOverride: boolean,
    ): Promise<ManualProductApplyResult> => {
      if (customizationRunRef.current) return { applied: false };
      const current = preparationRef.current;
      if (!current) return { applied: false };
      customizationRunRef.current = true;
      setCustomizationBusy(true);
      setActionMessage("Product, recept en budget worden opnieuw gecontroleerd…");
      try {
        const currentProduct = await catalogRepository().getByIds([
          choice.productId,
        ]);
        const product = currentProduct.products.find(
          (item) => item.id === choice.productId && item.isAvailable !== false,
        );
        if (!product) {
          setActionMessage(
            "Dit product is niet meer actueel beschikbaar. Er is niets gewijzigd.",
          );
          return { applied: false };
        }
        const livePreview = previewManualProductChoice(
          current,
          choice,
          product,
          currentList(),
        );
        if (!livePreview.ok) {
          setActionMessage("Deze productkeuze kon niet veilig worden toegepast.");
          return { applied: false };
        }
        if (!sameBudgetImpact(expectedImpact, livePreview.preview.impact)) {
          setActionMessage(
            "De prijs of je budget is gewijzigd. Controleer de nieuwe bedragen en bevestig opnieuw.",
          );
          return {
            applied: false,
            revalidatedPreview: livePreview.preview,
          };
        }
        const committed = commitManualProductChoice(
          current,
          choice,
          product,
          approveBudgetOverride,
          currentList(),
        );
        if (!committed.ok) {
          setActionMessage(
            committed.reason === "budget_override_required"
              ? "Bevestig eerst bewust dat je deze budgetoverschrijding accepteert."
              : "Deze productkeuze kon niet veilig worden toegepast.",
          );
          return committed.preview
            ? { applied: false, revalidatedPreview: committed.preview }
            : { applied: false };
        }
        const validation = await revalidatePreparedWeek(
          committed.preparation,
          recipeRepository(),
          catalogRepository(),
          new Date(),
          currentList(),
        );
        if (!validation.ready) {
          setActionMessage(
            "Het gerecht of product is intussen gewijzigd. Er is niets aangepast.",
          );
          return { applied: false };
        }
        return await syncValidatedCustomization(validation.preparation)
          ? { applied: true }
          : { applied: false };
      } catch {
        setActionMessage(
          "Aanpassen lukt nu niet. Je huidige gerecht en lijst zijn behouden.",
        );
        return { applied: false };
      } finally {
        customizationRunRef.current = false;
        setCustomizationBusy(false);
      }
    },
    [
      catalogRepository,
      currentList,
      recipeRepository,
      syncValidatedCustomization,
    ],
  );

  const value = useMemo<WeekPreparationContextValue>(
    () => ({
      searchDishes,
      previewCustomDish,
      matchCustomIngredient,
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
      pendingBudgetReapproval: pendingBudgetReapproval?.preview ?? null,
      approvePendingBudgetReapproval,
      cancelPendingBudgetReapproval,
      changeDayCategory,
      customizationBusy,
      findRecipeAlternatives,
      replaceRecipe,
      applyExplicitRecipe,
      findProductAlternatives,
      replaceProduct,
      searchCatalogProducts,
      previewManualProduct,
      applyManualProduct,
    }),
    [
      actionMessage,
      searchDishes,
      previewCustomDish,
      matchCustomIngredient,
      adjustCategory,
      changeDayCategory,
      customizationBusy,
      completeShoppingList,
      pendingBudgetReapproval,
      approvePendingBudgetReapproval,
      cancelPendingBudgetReapproval,
      confirmPreparation,
      createFreshPreparation,
      persistenceWarning,
      preparation,
      retryGeneration,
      findProductAlternatives,
      findRecipeAlternatives,
      replaceProduct,
      replaceRecipe,
      applyExplicitRecipe,
      searchCatalogProducts,
      previewManualProduct,
      applyManualProduct,
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
