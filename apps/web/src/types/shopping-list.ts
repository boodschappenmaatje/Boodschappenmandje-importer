import type { PriceFreshness, UUID } from "@/types/catalog";

export const SHOPPING_LIST_SCHEMA_VERSION = 1 as const;

export type ShoppingListItemSource =
  | "manual"
  | "catalog"
  | "weekPreparation"
  | "recipe"
  | "suggestion";

export interface ShoppingListPriceReference {
  productId: UUID;
  sku: string;
  amount: number;
  isOffer: boolean;
  updatedAt: string | null;
  freshness: PriceFreshness;
  provider: string;
}

export interface ShoppingListItem {
  productId: UUID;
  sku: string | null;
  name: string;
  brand: string | null;
  packageText: string | null;
  imageUrl: string | null;
  quantity: number;
  price: ShoppingListPriceReference | null;
  sources: ShoppingListItemSource[];
  usedIn: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ActiveShoppingList {
  schemaVersion: typeof SHOPPING_LIST_SCHEMA_VERSION;
  startedAt: string;
  updatedAt: string;
  items: ShoppingListItem[];
}

export interface RemovedShoppingListItem {
  item: ShoppingListItem;
  index: number;
}

export interface ShoppingListTotal {
  availableTotal: number | null;
  pricedItemCount: number;
  missingPriceItemCount: number;
  isPartial: boolean;
}
