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

import { createCatalogRepository } from "@/services/catalog/catalog-repository";
import {
  createIndexedDbShoppingListStorage,
  type ShoppingListStorage,
} from "@/services/shopping-list/indexeddb-storage";
import {
  addCatalogProduct,
  calculateShoppingListTotal,
  completeShoppingListFromWeek,
  createEmptyActiveShoppingList,
  decreaseQuantity,
  increaseQuantity,
  refreshShoppingListFromCatalog,
  removeMealPlanContributionsForWeek,
  removeShoppingListItem,
  restoreShoppingListItem,
  toggleShoppingListItem,
} from "@/services/shopping-list/shopping-list";
import type { Product } from "@/types/catalog";
import type { WeekIngredientRequirement } from "@/types/week-preparation";
import type {
  ActiveShoppingList,
  RemovedShoppingListItem,
  ShoppingListTotal,
} from "@/types/shopping-list";

type ShoppingListStatus = "loading" | "ready" | "error";

interface ActiveShoppingListContextValue {
  status: ShoppingListStatus;
  list: ActiveShoppingList | null;
  total: ShoppingListTotal;
  persistenceWarning: string | null;
  lastRemoved: RemovedShoppingListItem | null;
  addProduct: (product: Product) => Promise<void>;
  completeFromWeek: (
    requirements: WeekIngredientRequirement[],
    weekPreparationId: string,
  ) => Promise<void>;
  removeMealPlanForWeek: (
    weekPreparationId: string,
  ) => Promise<ActiveShoppingList | null>;
  toggleChecked: (productId: string) => Promise<void>;
  increase: (productId: string) => Promise<void>;
  decrease: (productId: string) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  undoRemove: () => Promise<void>;
  dismissUndo: () => void;
  quantityFor: (productId: string) => number;
}

const EMPTY_TOTAL: ShoppingListTotal = {
  availableTotal: null,
  pricedItemCount: 0,
  missingPriceItemCount: 0,
  isPartial: false,
};

const ActiveShoppingListContext =
  createContext<ActiveShoppingListContextValue | null>(null);

interface ActiveShoppingListProviderProps {
  children?: ReactNode;
  initialList?: ActiveShoppingList;
  storage?: ShoppingListStorage;
}

export function ActiveShoppingListProvider({
  children,
  initialList,
  storage: suppliedStorage,
}: ActiveShoppingListProviderProps) {
  const [status, setStatus] = useState<ShoppingListStatus>(
    initialList ? "ready" : "loading",
  );
  const [list, setList] = useState<ActiveShoppingList | null>(initialList ?? null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const [lastRemoved, setLastRemoved] =
    useState<RemovedShoppingListItem | null>(null);
  const listRef = useRef<ActiveShoppingList | null>(initialList ?? null);
  const storageRef = useRef<ShoppingListStorage | null>(suppliedStorage ?? null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const persist = useCallback((next: ActiveShoppingList): Promise<void> => {
    const storage = storageRef.current;
    if (!storage) {
      setPersistenceWarning("Je lijst kon niet veilig op dit apparaat worden opgeslagen.");
      return Promise.resolve();
    }

    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => storage.save(next))
      .then(() => setPersistenceWarning(null))
      .catch(() => {
        setPersistenceWarning("Je wijziging is zichtbaar, maar lokaal opslaan lukte niet.");
      });
    return saveQueueRef.current;
  }, []);

  const commit = useCallback(
    (update: (current: ActiveShoppingList) => ActiveShoppingList) => {
      const current = listRef.current;
      if (!current) return Promise.resolve();
      const next = update(current);
      if (next === current) return Promise.resolve();
      listRef.current = next;
      setList(next);
      return persist(next);
    },
    [persist],
  );

  const refreshPrices = useCallback(async () => {
    const current = listRef.current;
    if (!current || current.items.length === 0) return;

    try {
      const result = await createCatalogRepository().getByIds(
        current.items.map((item) => item.productId),
      );
      await commit((latest) =>
        refreshShoppingListFromCatalog(latest, result.products),
      );
    } catch {
      // De laatst bekende lokale informatie blijft bruikbaar wanneer de
      // catalogus of het netwerk tijdelijk niet beschikbaar is.
    }
  }, [commit]);

  useEffect(() => {
    if (initialList) return;

    let active = true;

    async function initialize() {
      try {
        const storage = suppliedStorage ?? createIndexedDbShoppingListStorage();
        storageRef.current = storage;
        const stored = await storage.load();
        if (!active) return;
        const restored = stored ?? createEmptyActiveShoppingList();
        listRef.current = restored;
        setList(restored);
        setStatus("ready");
        if (!stored) {
          await persist(restored);
        }
        void refreshPrices();
      } catch {
        if (!active) return;
        setStatus("error");
        setPersistenceWarning(
          "Je opgeslagen boodschappenlijst kon niet worden geopend.",
        );
      }
    }

    void initialize();

    return () => {
      active = false;
    };
  }, [initialList, persist, refreshPrices, suppliedStorage]);

  useEffect(() => {
    const refreshWhenVisible = () => {
      if (document.visibilityState === "visible") {
        void refreshPrices();
      }
    };
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => document.removeEventListener("visibilitychange", refreshWhenVisible);
  }, [refreshPrices]);

  const addProduct = useCallback(
    async (product: Product) => {
      setLastRemoved(null);
      await commit((current) => addCatalogProduct(current, product, "catalog"));
    },
    [commit],
  );

  const completeFromWeek = useCallback(
    async (
      requirements: WeekIngredientRequirement[],
      weekPreparationId: string,
    ) => {
      setLastRemoved(null);
      await commit((current) =>
        completeShoppingListFromWeek(current, requirements, weekPreparationId),
      );
    },
    [commit],
  );

  const removeMealPlanForWeek = useCallback(
    async (weekPreparationId: string): Promise<ActiveShoppingList | null> => {
      const current = listRef.current;
      if (!current) return null;
      setLastRemoved(null);
      const next = removeMealPlanContributionsForWeek(
        current,
        weekPreparationId,
      );
      if (next === current) return current;
      listRef.current = next;
      setList(next);
      await persist(next);
      return next;
    },
    [persist],
  );

  const toggleChecked = useCallback(async (productId: string) => {
    await commit((current) => toggleShoppingListItem(current, productId));
  }, [commit]);

  const increase = useCallback(
    async (productId: string) => {
      setLastRemoved(null);
      await commit((current) => increaseQuantity(current, productId));
    },
    [commit],
  );

  const decrease = useCallback(
    async (productId: string) => {
      setLastRemoved(null);
      await commit((current) => decreaseQuantity(current, productId));
    },
    [commit],
  );

  const remove = useCallback(
    async (productId: string) => {
      const current = listRef.current;
      if (!current) return;
      const result = removeShoppingListItem(current, productId);
      if (!result.removed) return;
      listRef.current = result.list;
      setList(result.list);
      setLastRemoved(result.removed);
      await persist(result.list);
    },
    [persist],
  );

  const undoRemove = useCallback(async () => {
    const removed = lastRemoved;
    if (!removed) return;
    await commit((current) => restoreShoppingListItem(current, removed));
    setLastRemoved(null);
  }, [commit, lastRemoved]);

  const dismissUndo = useCallback(() => setLastRemoved(null), []);

  const quantityFor = useCallback(
    (productId: string) =>
      list?.items.find((item) => item.productId === productId)?.quantity ?? 0,
    [list],
  );

  const total = useMemo(
    () => (list ? calculateShoppingListTotal(list) : EMPTY_TOTAL),
    [list],
  );

  const value = useMemo<ActiveShoppingListContextValue>(
    () => ({
      status,
      list,
      total,
      persistenceWarning,
      lastRemoved,
      addProduct,
      completeFromWeek,
      removeMealPlanForWeek,
      toggleChecked,
      increase,
      decrease,
      remove,
      undoRemove,
      dismissUndo,
      quantityFor,
    }),
    [
      addProduct,
      completeFromWeek,
      decrease,
      dismissUndo,
      toggleChecked,
      increase,
      lastRemoved,
      list,
      persistenceWarning,
      quantityFor,
      removeMealPlanForWeek,
      remove,
      status,
      total,
      undoRemove,
    ],
  );

  return (
    <ActiveShoppingListContext.Provider value={value}>
      {children}
    </ActiveShoppingListContext.Provider>
  );
}

export function useActiveShoppingList(): ActiveShoppingListContextValue {
  const context = useContext(ActiveShoppingListContext);
  if (!context) {
    throw new Error("ActiveShoppingListProvider ontbreekt.");
  }
  return context;
}
