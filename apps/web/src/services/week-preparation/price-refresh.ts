import { priceTimestamp, resolveCurrentPrice } from "@/services/catalog/price";
import { refreshShoppingListFromCatalog } from "@/services/shopping-list/shopping-list";
import { rebuildPreparedWeekSelection } from "./week-generation";
import type { Product } from "@/types/catalog";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type { WeekPreparation } from "@/types/week-preparation";

/** Refresh prices, never choices, package counts, matching or recipe quantities. */
export function refreshPreparedWeekPrices(preparation: WeekPreparation, products: Product[], list: ActiveShoppingList, now = new Date()) {
  const byId = new Map(products.map(product => [product.id, product]));
  const changedIds = new Set<string>();
  const ingredients = preparation.ingredients.map(ingredient => {
    const product = ingredient.product && byId.get(ingredient.product.productId);
    if (!product || product.sku !== ingredient.product?.sku || product.supermarket !== ingredient.product.supermarket) return ingredient;
    const resolved = product.currentPrice?.productId === product.id ? resolveCurrentPrice(product.currentPrice, now) : null;
    if (!resolved || priceTimestamp(resolved.updatedAt) < priceTimestamp(ingredient.price?.updatedAt ?? null)) return ingredient;
    const price = { amountCents: Math.round(resolved.amount * 100), isOffer: resolved.isOffer, updatedAt: resolved.updatedAt, freshness: resolved.freshness };
    if (JSON.stringify(price) === JSON.stringify(ingredient.price)) return ingredient;
    changedIds.add(product.id);
    return { ...ingredient, price };
  });
  const refreshedList = refreshShoppingListFromCatalog(list, products, now);
  const next = changedIds.size
    ? rebuildPreparedWeekSelection(preparation, preparation.days, ingredients, refreshedList, now)
    : preparation;
  return { preparation: next, products, changedIds: [...changedIds] };
}
