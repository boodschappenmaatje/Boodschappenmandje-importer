import { describe, expect, it } from "vitest";

import {
  DATABASE_VERSION,
  SHOPPING_LIST_STORE_NAME,
  WEEK_PREPARATION_STORE_NAME,
  openBoodschappenmaatjeDatabase,
} from "@/services/storage/indexeddb";
import {
  decodeStoredActiveShoppingList,
  encodeStoredActiveShoppingList,
} from "@/services/shopping-list/indexeddb-storage";
import { createEmptyActiveShoppingList } from "@/services/shopping-list/shopping-list";
import { createWeekPreparation, setCategoryCount } from "@/services/week-preparation/week-preparation";
import type { WeekPreparation } from "@/types/week-preparation";

import {
  WeekPreparationStorageError,
  decodeStoredWeekPreparation,
  encodeStoredWeekPreparation,
  type WeekPreparationStorage,
} from "./indexeddb-storage";

class MemoryWeekStorage implements WeekPreparationStorage {
  stored: unknown = null;

  async load() {
    return decodeStoredWeekPreparation(this.stored);
  }

  async save(preparation: WeekPreparation) {
    this.stored = structuredClone(encodeStoredWeekPreparation(preparation));
  }
}

const SETTINGS = {
  schemaVersion: 1 as const,
  budgetCents: 10_000,
  people: 4,
  days: 6,
};
const NOW = new Date("2026-09-15T12:00:00Z");

describe("PWA 10 lokale persistentie", () => {
  it("bewaart en heropent een nieuwe voorbereiding", async () => {
    const storage = new MemoryWeekStorage();
    const preparation = createWeekPreparation(
      SETTINGS,
      { knownSubtotalCents: 2_463, unpricedItemCount: 0 },
      NOW,
      "week-persist",
    );
    await storage.save(preparation);
    await expect(storage.load()).resolves.toEqual(preparation);
  });

  it("bewaart een gedeeltelijke draft voor verdergaan na sluiten", async () => {
    const storage = new MemoryWeekStorage();
    const draft = setCategoryCount(
      createWeekPreparation(
        SETTINGS,
        { knownSubtotalCents: 0, unpricedItemCount: 0 },
        NOW,
        "week-draft",
      ),
      "dutch",
      2,
      NOW,
    );
    await storage.save(draft);
    await expect(storage.load()).resolves.toMatchObject({
      id: "week-draft",
      status: "draft",
      categoryDistribution: { dutch: 2 },
    });
  });

  it("vervangt alleen de voorbereiding bij een nieuwe week", async () => {
    const storage = new MemoryWeekStorage();
    const existingList = createEmptyActiveShoppingList(NOW);
    const encodedList = structuredClone(encodeStoredActiveShoppingList(existingList));
    const first = createWeekPreparation(
      SETTINGS,
      { knownSubtotalCents: 0, unpricedItemCount: 0 },
      NOW,
      "week-old",
    );
    const next = createWeekPreparation(
      SETTINGS,
      { knownSubtotalCents: 0, unpricedItemCount: 0 },
      new Date("2026-09-16T12:00:00Z"),
      "week-new",
    );
    await storage.save(first);
    await storage.save(next);
    await expect(storage.load()).resolves.toMatchObject({ id: "week-new" });
    expect(decodeStoredActiveShoppingList(encodedList)).toEqual(existingList);
  });

  it("breidt IndexedDB versioned uit met een aparte store en behoudt de bestaande lijststore", () => {
    expect(DATABASE_VERSION).toBe(2);
    expect(SHOPPING_LIST_STORE_NAME).toBe("shopping-lists");
    expect(WEEK_PREPARATION_STORE_NAME).toBe("week-preparations");
  });

  it("voegt bij een v1-upgrade alleen de ontbrekende weekstore toe", async () => {
    const createdStores: string[] = [];
    const database = {
      objectStoreNames: {
        contains: (name: string) => name === SHOPPING_LIST_STORE_NAME,
      },
      createObjectStore: (name: string) => {
        createdStores.push(name);
        return {};
      },
    };
    const request: Partial<IDBOpenDBRequest> = {};
    const factory = {
      open: (_name: string, version?: number) => {
        expect(version).toBe(2);
        queueMicrotask(() => {
          Object.defineProperty(request, "result", { value: database });
          const openRequest = request as IDBOpenDBRequest;
          openRequest.onupgradeneeded?.call(
            openRequest,
            new Event("upgradeneeded") as IDBVersionChangeEvent,
          );
          openRequest.onsuccess?.call(openRequest, new Event("success"));
        });
        return request as IDBOpenDBRequest;
      },
    } as IDBFactory;

    await openBoodschappenmaatjeDatabase(factory);
    expect(createdStores).toEqual([WEEK_PREPARATION_STORE_NAME]);
  });

  it("weigert onbekende toekomstige opslagversies zonder te overschrijven", () => {
    expect(() =>
      decodeStoredWeekPreparation({
        key: "active",
        schemaVersion: 99,
        preparation: {},
      }),
    ).toThrowError(
      expect.objectContaining<Partial<WeekPreparationStorageError>>({
        code: "unsupported-version",
      }),
    );
  });
});
