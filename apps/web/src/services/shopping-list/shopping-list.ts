import { resolveCurrentPrice } from "@/services/catalog/price";
import type { Product } from "@/types/catalog";
import {
  SHOPPING_LIST_SCHEMA_VERSION,
  type ActiveShoppingList,
  type RemovedShoppingListItem,
  type ShoppingListItem,
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
      packageText: product.packageText,
      imageUrl: product.imageUrl,
      quantity: existing.quantity + 1,
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
    packageText: product.packageText,
    imageUrl: product.imageUrl,
    quantity: 1,
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
  const quantity = Math.max(1, current.quantity + delta);
  if (quantity === current.quantity) {
    return list;
  }

  const timestamp = nowIso(now);
  const items = [...list.items];
  items[index] = { ...current, quantity, updatedAt: timestamp };
  return { ...list, items, updatedAt: timestamp };
}

export function removeShoppingListItem(
  list: ActiveShoppingList,
  productId: string,
  now: Date | string = new Date(),
): { list: ActiveShoppingList; removed: RemovedShoppingListItem | null } {
  const index = list.items.findIndex((item) => item.productId === productId);
  if (index < 0) {
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
    items[existingIndex] = {
      ...existing,
      quantity: existing.quantity + removed.item.quantity,
      sources: removed.item.sources.reduce(uniqueSources, existing.sources),
      updatedAt: timestamp,
    };
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

    const refreshedPrice = priceReference(product);
    const next: ShoppingListItem = {
      ...item,
      sku: item.sku ?? product.sku,
      name: product.name,
      brand: product.brand,
      packageText: product.packageText,
      imageUrl: product.imageUrl,
      price: refreshedPrice ?? item.price,
      updatedAt: timestamp,
    };
    changed = changed || JSON.stringify(next) !== JSON.stringify(item);
    return next;
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
