import type { PriceFreshness, UUID } from "@/types/catalog";

export const SHOPPING_LIST_SCHEMA_VERSION = 2 as const;

export type ShoppingListItemSource =
  | "manual"
  | "catalog"
  | "weekPreparation"
  | "recipe"
  | "suggestion"
  | "recurring";

export interface ShoppingListMealPlanContribution {
  weekPreparationId: string | null;
  quantity: number;
  usedIn: string[];
}

export interface ShoppingListQuantityContributions {
  persistentQuantity: number;
  mealPlans: ShoppingListMealPlanContribution[];
}

export interface ShoppingListPriceReference {
  productId: UUID;
  sku: string;
  amount: number;
  isOffer: boolean;
  updatedAt: string | null;
  freshness: PriceFreshness;
  provider: string;
  validFrom?: string | null;
  validUntil?: string | null;
}

export interface ShoppingListItem {
  checked?: boolean;
  category?: string | null;
  productId: UUID;
  sku: string | null;
  name: string;
  brand: string | null;
  packageText: string | null;
  imageUrl: string | null;
  quantity: number;
  quantityContributions: ShoppingListQuantityContributions;
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
