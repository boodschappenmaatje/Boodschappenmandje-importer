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

import { subscribeCatalogRefresh } from "@/services/catalog/auto-refresh";
import { createCatalogRepository } from "@/services/catalog/catalog-repository";
import {
  activeSupermarketFromStorage,
  browserSupermarketPreferenceStorage,
  persistActiveSupermarket,
} from "@/services/supermarket/active-supermarket";
import {
  createIndexedDbShoppingListStorage,
  type ShoppingListStorage,
} from "@/services/shopping-list/indexeddb-storage";
import {
  addCatalogProduct,
  adjustPersistentQuantity,
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
import {
  DEFAULT_SUPERMARKET_ID,
  isSupermarketId,
  productBelongsToSupermarket,
  type SupermarketId,
} from "@/types/supermarket";

type ShoppingListStatus = "loading" | "ready" | "error";

interface ActiveShoppingListContextValue {
  status: ShoppingListStatus;
  supermarketId: SupermarketId;
  setActiveSupermarket: (supermarketId: SupermarketId) => Promise<boolean>;
  list: ActiveShoppingList | null;
  total: ShoppingListTotal;
  persistenceWarning: string | null;
  lastRemoved: RemovedShoppingListItem | null;
  addProduct: (product: Product) => Promise<void>;
  refreshFromProducts: (products: Product[]) => Promise<void>;
  completeFromWeek: (
    requirements: WeekIngredientRequirement[],
    weekPreparationId: string,
  ) => Promise<void>;
  removeMealPlanForWeek: (
    weekPreparationId: string,
  ) => Promise<ActiveShoppingList | null>;
  toggleChecked: (productId: string) => Promise<void>;
  adjustIndependent: (productId: string, delta: -1 | 1) => Promise<void>;
  increase: (productId: string) => Promise<void>;
  decrease: (productId: string) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  undoRemove: () => Promise<void>;
  dismissUndo: () => void;
  getCurrentList: () => ActiveShoppingList | null;
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
  const [supermarketId, setSupermarketId] = useState<SupermarketId>(DEFAULT_SUPERMARKET_ID);
  const [list, setList] = useState<ActiveShoppingList | null>(initialList ?? null);
  const [persistenceWarning, setPersistenceWarning] = useState<string | null>(null);
  const [lastRemoved, setLastRemoved] =
    useState<RemovedShoppingListItem | null>(null);
  const listRef = useRef<ActiveShoppingList | null>(initialList ?? null);
  const supermarketIdRef = useRef<SupermarketId>(DEFAULT_SUPERMARKET_ID);
  const switchingSupermarketRef = useRef(false);
  const switchSequenceRef = useRef(0);
  const lastPersistFailedRef = useRef(false);
  const storageRef = useRef<ShoppingListStorage | null>(suppliedStorage ?? null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());

  const persist = useCallback((
    next: ActiveShoppingList,
    providerId: SupermarketId = supermarketIdRef.current,
  ): Promise<void> => {
    const storage = storageRef.current;
    if (!storage) {
      lastPersistFailedRef.current = true;
      setPersistenceWarning("Je lijst kon niet veilig op dit apparaat worden opgeslagen.");
      return Promise.resolve();
    }

    saveQueueRef.current = saveQueueRef.current
      .catch(() => undefined)
      .then(() => storage.save(next, providerId))
      .then(() => {
        lastPersistFailedRef.current = false;
        setPersistenceWarning(null);
      })
      .catch(() => {
        lastPersistFailedRef.current = true;
        setPersistenceWarning("Je wijziging is zichtbaar, maar lokaal opslaan lukte niet.");
      });
    return saveQueueRef.current;
  }, []);

  const commit = useCallback(
    (update: (current: ActiveShoppingList) => ActiveShoppingList) => {
      if (switchingSupermarketRef.current) return Promise.resolve();
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
      const result = await createCatalogRepository(supermarketIdRef.current).getByIds(
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
        const preferenceStorage = browserSupermarketPreferenceStorage();
        const selectedSupermarket = preferenceStorage
          ? activeSupermarketFromStorage(preferenceStorage)
          : DEFAULT_SUPERMARKET_ID;
        supermarketIdRef.current = selectedSupermarket;
        setSupermarketId(selectedSupermarket);
        const stored = await storage.load(selectedSupermarket);
        if (!active) return;
        const restored = stored ?? createEmptyActiveShoppingList();
        listRef.current = restored;
        setList(restored);
        setStatus("ready");
        if (!stored) {
          await persist(restored, selectedSupermarket);
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

  useEffect(() => subscribeCatalogRefresh(() => { void refreshPrices(); }), [refreshPrices]);

  const setActiveSupermarket = useCallback(async (nextSupermarketId: SupermarketId) => {
    if (!isSupermarketId(nextSupermarketId)) return false;
    if (nextSupermarketId === supermarketIdRef.current) {
      const preferenceStorage = browserSupermarketPreferenceStorage();
      if (!preferenceStorage) return false;
      try {
        persistActiveSupermarket(preferenceStorage, nextSupermarketId);
        return true;
      } catch {
        setPersistenceWarning("Je supermarktkeuze kon niet worden onthouden.");
        return false;
      }
    }

    const sequence = ++switchSequenceRef.current;
    switchingSupermarketRef.current = true;
    setStatus("loading");
    setLastRemoved(null);
    try {
      saveQueueRef.current = saveQueueRef.current.catch(() => undefined);
      await saveQueueRef.current;
      if (sequence !== switchSequenceRef.current) return false;
      if (lastPersistFailedRef.current) {
        throw new Error("active-list-has-unsaved-changes");
      }
      const storage = storageRef.current ?? suppliedStorage ?? createIndexedDbShoppingListStorage();
      storageRef.current = storage;
      const stored = await storage.load(nextSupermarketId);
      if (sequence !== switchSequenceRef.current) return false;
      const nextList = stored ?? createEmptyActiveShoppingList();
      if (!stored) {
        await storage.save(nextList, nextSupermarketId);
      }
      const preferenceStorage = browserSupermarketPreferenceStorage();
      if (!preferenceStorage) throw new Error("supermarket-preference-storage-unavailable");
      persistActiveSupermarket(preferenceStorage, nextSupermarketId);
      supermarketIdRef.current = nextSupermarketId;
      listRef.current = nextList;
      setSupermarketId(nextSupermarketId);
      setList(nextList);
      setStatus("ready");
      setPersistenceWarning(null);
      switchingSupermarketRef.current = false;
      void refreshPrices();
      return true;
    } catch {
      if (sequence === switchSequenceRef.current) {
        switchingSupermarketRef.current = false;
        setStatus("ready");
        setPersistenceWarning("Winkelen bij deze supermarkt kon niet veilig worden geopend.");
      }
      return false;
    }
  }, [refreshPrices, suppliedStorage]);

  const refreshFromProducts = useCallback((products: Product[]) => {
    const scopedProducts = products.filter((product) =>
      productBelongsToSupermarket(product.supermarket, supermarketIdRef.current),
    );
    return commit(current => refreshShoppingListFromCatalog(current, scopedProducts));
  }, [commit]);

  const addProduct = useCallback(
    async (product: Product) => {
      if (!productBelongsToSupermarket(product.supermarket, supermarketIdRef.current)) {
        setPersistenceWarning("Dit product hoort niet bij de actieve supermarkt en is niet toegevoegd.");
        return;
      }
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
      if (supermarketIdRef.current !== DEFAULT_SUPERMARKET_ID) return;
      setLastRemoved(null);
      await commit((current) =>
        completeShoppingListFromWeek(current, requirements, weekPreparationId),
      );
    },
    [commit],
  );

  const removeMealPlanForWeek = useCallback(
    async (weekPreparationId: string): Promise<ActiveShoppingList | null> => {
      if (switchingSupermarketRef.current) return null;
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

  const adjustIndependent = useCallback((productId: string, delta: -1 | 1) => commit(current => adjustPersistentQuantity(current, productId, delta)), [commit]);

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
      if (switchingSupermarketRef.current) return;
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

  const getCurrentList = useCallback(() => listRef.current, []);

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
      supermarketId,
      setActiveSupermarket,
      list,
      total,
      persistenceWarning,
      lastRemoved,
      addProduct,
      refreshFromProducts,
      completeFromWeek,
      removeMealPlanForWeek,
      toggleChecked,
      increase,
      adjustIndependent,
      decrease,
      remove,
      undoRemove,
      dismissUndo,
      quantityFor,
      getCurrentList,
    }),
    [
      addProduct,
      setActiveSupermarket,
      refreshFromProducts,
      completeFromWeek,
      decrease,
      dismissUndo,
      toggleChecked,
      increase,
      adjustIndependent,
      lastRemoved,
      list,
      persistenceWarning,
      quantityFor,
      getCurrentList,
      removeMealPlanForWeek,
      remove,
      status,
      supermarketId,
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
