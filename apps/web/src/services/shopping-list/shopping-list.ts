import { priceTimestamp, resolveCurrentPrice } from "@/services/catalog/price";
import type { Product } from "@/types/catalog";
import type { WeekIngredientRequirement } from "@/types/week-preparation";
import { combinedProductPurchaseQuantity } from "@/services/week-preparation/product-matching";
import {
  SHOPPING_LIST_SCHEMA_VERSION,
  type ActiveShoppingList,
  type RemovedShoppingListItem,
  type ShoppingListItem,
  type ShoppingListMealPlanContribution,
  type PlannedIngredientLink,
  type ShoppingListQuantityContributions,
  type ShoppingListItemSource,
  type ShoppingListPriceReference,
  type ShoppingListTotal,
} from "@/types/shopping-list";

export class ShoppingListIdentityError extends Error {
  constructor() {
    super("conflicting-product-identity");
    this.name = "ShoppingListIdentityError";
  }
}

function nowIso(now: Date | string): string {
  return typeof now === "string" ? now : now.toISOString();
}

function uniqueSources(
  current: ShoppingListItemSource[],
  source: ShoppingListItemSource,
): ShoppingListItemSource[] {
  return current.includes(source) ? current : [...current, source];
}

function uniqueStrings(current: string[], additions: string[]): string[] {
  return [...new Set([...current, ...additions])];
}

function recipeSources(current: ShoppingListItemSource[]): ShoppingListItemSource[] {
  return uniqueSources(uniqueSources(current, "weekPreparation"), "recipe");
}

const MEAL_PLAN_SOURCES = new Set<ShoppingListItemSource>([
  "weekPreparation",
  "recipe",
]);

function persistentSources(
  sources: ShoppingListItemSource[],
): ShoppingListItemSource[] {
  return sources.filter((source) => !MEAL_PLAN_SOURCES.has(source));
}

function mealPlanQuantity(
  contributions: ShoppingListMealPlanContribution[],
): number {
  return contributions.reduce((total, contribution) => total + contribution.quantity, 0);
}

function mealPlanUsedIn(
  contributions: ShoppingListMealPlanContribution[],
): string[] {
  return contributions.reduce<string[]>(
    (current, contribution) => uniqueStrings(current, contribution.usedIn),
    [],
  );
}

function sourcesForContributions(
  current: ShoppingListItemSource[],
  contributions: ShoppingListQuantityContributions,
): ShoppingListItemSource[] {
  const retained =
    contributions.persistentQuantity > 0 ? persistentSources(current) : [];
  return contributions.mealPlans.length > 0 ? recipeSources(retained) : retained;
}

function rebuildContributedItem(
  item: ShoppingListItem,
  contributions: ShoppingListQuantityContributions,
): ShoppingListItem | null {
  const quantity =
    contributions.persistentQuantity + mealPlanQuantity(contributions.mealPlans);
  if (quantity < 1) return null;
  return {
    ...item,
    quantity,
    ...(quantity > item.quantity ? { checked: false } : {}),
    quantityContributions: contributions,
    sources: sourcesForContributions(item.sources, contributions),
    usedIn: mealPlanUsedIn(contributions.mealPlans),
  };
}

function mergeMealPlanContributions(
  current: ShoppingListMealPlanContribution[],
  additions: ShoppingListMealPlanContribution[],
): ShoppingListMealPlanContribution[] {
  const merged = new Map<string, ShoppingListMealPlanContribution>();
  for (const contribution of [...current, ...additions]) {
    const key = contribution.weekPreparationId ?? "legacy";
    const existing = merged.get(key);
    merged.set(key, existing
      ? {
          ...existing,
          quantity: existing.quantity + contribution.quantity,
          usedIn: uniqueStrings(existing.usedIn, contribution.usedIn),
          ingredientLinks: [...new Map([...(existing.ingredientLinks ?? []), ...(contribution.ingredientLinks ?? [])].map(link => [JSON.stringify(link), link])).values()],
        }
      : contribution);
  }
  return [...merged.values()];
}

function priceReference(product: Product): ShoppingListPriceReference | null {
  const catalogPrice = product.currentPrice;
  if (!catalogPrice || catalogPrice.productId !== product.id) {
    return null;
  }

  const resolved = resolveCurrentPrice(catalogPrice);
  if (!resolved) {
    return null;
  }

  return {
    productId: product.id,
    sku: product.sku,
    amount: resolved.amount,
    isOffer: resolved.isOffer,
    updatedAt: resolved.updatedAt,
    freshness: resolved.freshness,
    provider: product.supermarket,
    validFrom: catalogPrice.validFrom,
    validUntil: catalogPrice.validUntil,
  };
}

function exactCatalogIdentity(item: ShoppingListItem, product: Product): boolean {
  if (item.productId !== product.id) {
    return false;
  }
  return item.sku === null || item.sku === product.sku;
}

export function createEmptyActiveShoppingList(
  now: Date | string = new Date(),
): ActiveShoppingList {
  const timestamp = nowIso(now);
  return {
    schemaVersion: SHOPPING_LIST_SCHEMA_VERSION,
    startedAt: timestamp,
    updatedAt: timestamp,
    items: [],
  };
}

export function addCatalogProduct(
  list: ActiveShoppingList,
  product: Product,
  source: ShoppingListItemSource = "catalog",
  now: Date | string = new Date(),
): ActiveShoppingList {
  const timestamp = nowIso(now);
  const existingIndex = list.items.findIndex(
    (item) => item.productId === product.id,
  );

  if (existingIndex >= 0) {
    const existing = list.items[existingIndex];
    if (!exactCatalogIdentity(existing, product)) {
      throw new ShoppingListIdentityError();
    }

    const items = [...list.items];
    items[existingIndex] = {
      ...existing,
      name: product.name,
      brand: product.brand,
      category: product.category,
      packageText: product.packageText,
      imageUrl: product.imageUrl,
      quantity: existing.quantity + 1,
      checked: false,
      quantityContributions: {
        ...existing.quantityContributions,
        persistentQuantity:
          existing.quantityContributions.persistentQuantity + 1,
      },
      price: priceReference(product) ?? existing.price,
      sources: uniqueSources(existing.sources, source),
      updatedAt: timestamp,
    };
    return { ...list, items, updatedAt: timestamp };
  }

  const item: ShoppingListItem = {
    productId: product.id,
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    category: product.category,
    packageText: product.packageText,
    imageUrl: product.imageUrl,
    quantity: 1,
    quantityContributions: { persistentQuantity: 1, mealPlans: [] },
    price: priceReference(product),
    sources: [source],
    usedIn: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  return {
    ...list,
    items: [...list.items, item],
    updatedAt: timestamp,
  };
}

export function ingredientLinksForWeek(requirements: WeekIngredientRequirement[], weekPreparationId: string): PlannedIngredientLink[] {
  const links = requirements.flatMap(ingredient => ingredient.product ? ingredient.usedIn.map(use => ({
    weekPreparationId, dayIndex: use.dayIndex, recipeId: use.recipeId,
    ingredientId: ingredient.ingredientId, productId: ingredient.product!.productId, sku: ingredient.product!.sku,
  })) : []);
  return [...new Map(links.map(link => [JSON.stringify(link), link])).values()];
}

export function completeShoppingListFromWeek(
  list: ActiveShoppingList,
  requirements: WeekIngredientRequirement[],
  weekPreparationId: string,
  now: Date | string = new Date(),
): ActiveShoppingList {
  const timestamp = nowIso(now);
  const grouped = new Map<
    string,
    {
      requirement: WeekIngredientRequirement;
      requirements: WeekIngredientRequirement[];
      usedIn: string[];
    }
  >();

  for (const requirement of requirements) {
    if (
      !requirement.product ||
      requirement.purchaseQuantity === null ||
      (requirement.optional && requirement.price === null)
    ) continue;
    const current = grouped.get(requirement.product.productId);
    const usedIn = requirement.usedIn.map((item) => item.recipeName);
    if (current) {
      current.requirements.push(requirement);
      current.usedIn = uniqueStrings(current.usedIn, usedIn);
    } else {
      grouped.set(requirement.product.productId, {
        requirement,
        requirements: [requirement],
        usedIn,
      });
    }
  }

  let changed = false;
  const remaining = new Map(grouped);
  const items = list.items.flatMap((existing) => {
    const group = remaining.get(existing.productId);
    remaining.delete(existing.productId);
    const retainedMealPlans = existing.quantityContributions.mealPlans.filter(
      (contribution) =>
        contribution.weekPreparationId !== weekPreparationId &&
        contribution.weekPreparationId !== null,
    );
    let contributions: ShoppingListQuantityContributions = {
      ...existing.quantityContributions,
      mealPlans: retainedMealPlans,
    };
    let productUpdate: Partial<ShoppingListItem> = {};

    if (group) {
      const { requirement, requirements: groupedRequirements, usedIn } = group;
      const product = requirement.product;
      if (!product) return [existing];
      if (existing.sku !== null && existing.sku !== product.sku) {
        throw new ShoppingListIdentityError();
      }
      const quantity = combinedProductPurchaseQuantity(groupedRequirements);
      const price: ShoppingListPriceReference | null = requirement.price
        ? {
            productId: product.productId,
            sku: product.sku,
            amount: requirement.price.amountCents / 100,
            isOffer: requirement.price.isOffer,
            updatedAt: requirement.price.updatedAt,
            freshness: requirement.price.freshness,
            provider: product.supermarket,
          }
        : null;
      contributions = {
        ...contributions,
        mealPlans: [
          ...retainedMealPlans,
          { weekPreparationId, quantity, usedIn, ingredientLinks: ingredientLinksForWeek(groupedRequirements, weekPreparationId) },
        ],
      };
      productUpdate = {
        sku: existing.sku ?? product.sku,
        name: product.name,
        brand: product.brand,
        category: product.category ?? existing.category,
        packageText: product.packageText,
        imageUrl: product.imageUrl,
        price: price ?? existing.price,
      };
    }

    const rebuilt = rebuildContributedItem(
      { ...existing, ...productUpdate },
      contributions,
    );
    if (!rebuilt) {
      changed = true;
      return [];
    }
    if (JSON.stringify(rebuilt) === JSON.stringify(existing)) return [existing];
    changed = true;
    return [{ ...rebuilt, updatedAt: timestamp }];
  });

  for (const group of remaining.values()) {
    const { requirement, requirements: groupedRequirements, usedIn } = group;
    const product = requirement.product;
    if (!product) continue;
    const quantity = combinedProductPurchaseQuantity(groupedRequirements);
    const price: ShoppingListPriceReference | null = requirement.price
      ? {
          productId: product.productId,
          sku: product.sku,
          amount: requirement.price.amountCents / 100,
          isOffer: requirement.price.isOffer,
          updatedAt: requirement.price.updatedAt,
          freshness: requirement.price.freshness,
          provider: product.supermarket,
        }
      : null;
    items.push({
      productId: product.productId,
      sku: product.sku,
      category: product.category,
      name: product.name,
      brand: product.brand,
      packageText: product.packageText,
      imageUrl: product.imageUrl,
      quantity,
      quantityContributions: {
        persistentQuantity: 0,
        mealPlans: [{ weekPreparationId, quantity, usedIn, ingredientLinks: ingredientLinksForWeek(groupedRequirements, weekPreparationId) }],
      },
      price,
      sources: ["weekPreparation", "recipe"],
      usedIn,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
    changed = true;
  }

  return changed ? { ...list, items, updatedAt: timestamp } : list;
}

export function removeMealPlanContributionsForWeek(
  list: ActiveShoppingList,
  weekPreparationId: string,
  now: Date | string = new Date(),
): ActiveShoppingList {
  const timestamp = nowIso(now);
  let changed = false;
  const items = list.items.flatMap((item) => {
    const retainedMealPlans = item.quantityContributions.mealPlans.filter(
      (contribution) =>
        contribution.weekPreparationId !== weekPreparationId &&
        contribution.weekPreparationId !== null,
    );
    if (retainedMealPlans.length === item.quantityContributions.mealPlans.length) {
      return [item];
    }
    changed = true;
    const rebuilt = rebuildContributedItem(item, {
      ...item.quantityContributions,
      mealPlans: retainedMealPlans,
    });
    return rebuilt ? [{ ...rebuilt, updatedAt: timestamp }] : [];
  });
  return changed ? { ...list, items, updatedAt: timestamp } : list;
}

export function increaseQuantity(
  list: ActiveShoppingList,
  productId: string,
  now: Date | string = new Date(),
): ActiveShoppingList {
  return updateQuantity(list, productId, 1, now);
}

export function decreaseQuantity(
  list: ActiveShoppingList,
  productId: string,
  now: Date | string = new Date(),
): ActiveShoppingList {
  return updateQuantity(list, productId, -1, now);
}

function updateQuantity(
  list: ActiveShoppingList,
  productId: string,
  delta: number,
  now: Date | string,
): ActiveShoppingList {
  const index = list.items.findIndex((item) => item.productId === productId);
  if (index < 0) {
    return list;
  }

  const current = list.items[index];
  if (current.quantityContributions.mealPlans.length > 0) return list;
  if (delta < 0 && current.quantity <= 1) {
    return list;
  }

  const contributions: ShoppingListQuantityContributions = {
    persistentQuantity: current.quantityContributions.persistentQuantity,
    mealPlans: current.quantityContributions.mealPlans.map((item) => ({ ...item })),
  };
  if (delta > 0) {
    contributions.persistentQuantity += delta;
  } else if (contributions.persistentQuantity > 0) {
    contributions.persistentQuantity = Math.max(
      0,
      contributions.persistentQuantity + delta,
    );
  }

  const timestamp = nowIso(now);
  const items = [...list.items];
  const rebuilt = rebuildContributedItem(current, contributions);
  if (!rebuilt) return list;
  items[index] = { ...rebuilt, updatedAt: timestamp };
  return { ...list, items, updatedAt: timestamp };
}

/** Explicitly changes only the independent part, including removing its final package. */
export function adjustPersistentQuantity(list: ActiveShoppingList, productId: string, delta: -1 | 1, now: Date | string = new Date()): ActiveShoppingList {
  const item = list.items.find(row => row.productId === productId);
  if (!item || (delta < 0 && item.quantityContributions.persistentQuantity === 0)) return list;
  const timestamp = nowIso(now);
  const next = rebuildContributedItem({ ...item, sources: uniqueSources(item.sources, "manual") }, {
    ...item.quantityContributions, persistentQuantity: item.quantityContributions.persistentQuantity + delta,
  });
  return { ...list, updatedAt: timestamp, items: list.items.flatMap(row => row !== item ? [row] : next ? [{ ...next, updatedAt: timestamp }] : []) };
}

export function removeShoppingListItem(
  list: ActiveShoppingList,
  productId: string,
  now: Date | string = new Date(),
): { list: ActiveShoppingList; removed: RemovedShoppingListItem | null } {
  const index = list.items.findIndex((item) => item.productId === productId);
  if (index < 0 || list.items[index].quantityContributions.mealPlans.length > 0) {
    return { list, removed: null };
  }

  const timestamp = nowIso(now);
  return {
    list: {
      ...list,
      items: list.items.filter((item) => item.productId !== productId),
      updatedAt: timestamp,
    },
    removed: { item: list.items[index], index },
  };
}

export function restoreShoppingListItem(
  list: ActiveShoppingList,
  removed: RemovedShoppingListItem,
  now: Date | string = new Date(),
): ActiveShoppingList {
  const timestamp = nowIso(now);
  const existingIndex = list.items.findIndex(
    (item) => item.productId === removed.item.productId,
  );

  if (existingIndex >= 0) {
    const existing = list.items[existingIndex];
    if (
      existing.sku !== null &&
      removed.item.sku !== null &&
      existing.sku !== removed.item.sku
    ) {
      throw new ShoppingListIdentityError();
    }

    const items = [...list.items];
    const contributions: ShoppingListQuantityContributions = {
      persistentQuantity:
        existing.quantityContributions.persistentQuantity +
        removed.item.quantityContributions.persistentQuantity,
      mealPlans: mergeMealPlanContributions(
        existing.quantityContributions.mealPlans,
        removed.item.quantityContributions.mealPlans,
      ),
    };
    const rebuilt = rebuildContributedItem(
      {
        ...existing,
        sources: removed.item.sources.reduce(uniqueSources, existing.sources),
      },
      contributions,
    );
    if (!rebuilt) return list;
    items[existingIndex] = { ...rebuilt, updatedAt: timestamp };
    return { ...list, items, updatedAt: timestamp };
  }

  const items = [...list.items];
  items.splice(Math.min(removed.index, items.length), 0, {
    ...removed.item,
    updatedAt: timestamp,
  });
  return { ...list, items, updatedAt: timestamp };
}

export function refreshShoppingListFromCatalog(
  list: ActiveShoppingList,
  products: Product[],
  now: Date | string = new Date(),
): ActiveShoppingList {
  const catalogById = new Map(products.map((product) => [product.id, product]));
  const timestamp = nowIso(now);
  let changed = false;

  const items = list.items.map((item) => {
    const product = catalogById.get(item.productId);
    if (!product || !exactCatalogIdentity(item, product)) {
      return item;
    }

    const candidatePrice = priceReference(product);
    const refreshedPrice = candidatePrice && priceTimestamp(candidatePrice.updatedAt) >= priceTimestamp(item.price?.updatedAt ?? null) ? candidatePrice : null;
    const next: ShoppingListItem = {
      ...item,
      sku: item.sku ?? product.sku,
      name: product.name,
      brand: product.brand,
      category: product.category,
      packageText: product.packageText,
      imageUrl: product.imageUrl,
      price: refreshedPrice ?? item.price,
    };
    if (JSON.stringify(next) === JSON.stringify(item)) return item;
    changed = true;
    return { ...next, updatedAt: timestamp };
  });

  return changed ? { ...list, items, updatedAt: timestamp } : list;
}

export function calculateShoppingListTotal(
  list: ActiveShoppingList,
): ShoppingListTotal {
  let availableTotal = 0;
  let pricedItemCount = 0;
  let missingPriceItemCount = 0;

  for (const item of list.items) {
    if (item.price && Number.isFinite(item.price.amount) && item.price.amount > 0) {
      availableTotal += item.price.amount * item.quantity;
      pricedItemCount += 1;
    } else {
      missingPriceItemCount += 1;
    }
  }

  return {
    availableTotal: pricedItemCount > 0 ? availableTotal : null,
    pricedItemCount,
    missingPriceItemCount,
    isPartial: pricedItemCount > 0 && missingPriceItemCount > 0,
  };
}

/** Checking an item never changes its price, quantity, or meal-plan ownership. */
export function toggleShoppingListItem(list: ActiveShoppingList, productId: string, now: Date | string = new Date()): ActiveShoppingList {
  if (!list.items.some((item) => item.productId === productId)) return list;
  const timestamp = nowIso(now);
  return { ...list, updatedAt: timestamp, items: list.items.map((item) => item.productId === productId ? { ...item, checked: !item.checked, updatedAt: timestamp } : item) };
}

export type ShoppingListFilter = "all" | "remaining" | "checked";
export function groupShoppingListItems(items: ShoppingListItem[], filter: ShoppingListFilter): [string, ShoppingListItem[]][] {
  const groups = new Map<string, ShoppingListItem[]>();
  for (const item of items) {
    if (filter === "remaining" && item.checked || filter === "checked" && !item.checked) continue;
    const category = item.category?.split("/")[0]?.trim() || "Overige boodschappen";
    groups.set(category, [...(groups.get(category) ?? []), item]);
  }
  return [...groups.entries()];
}
