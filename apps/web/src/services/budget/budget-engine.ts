import { isOfferActive } from "@/services/catalog/price";
import type { BudgetResult, BudgetStatus } from "@/types/budget";
import type {
  ActiveShoppingList,
  ShoppingListPriceReference,
} from "@/types/shopping-list";

export function euroAmountToCents(amount: number): number | null {
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function parseDutchEuroInput(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "");
  const match = /^(\d+)(?:,(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const euros = Number(match[1]);
  const decimals = (match[2] ?? "").padEnd(2, "0");
  const cents = euros * 100 + Number(decimals || "0");
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export function parseDutchEuroInputAllowZero(value: string): number | null {
  const normalized = value.trim().replace(/\s/g, "");
  const match = /^(\d+)(?:,(\d{1,2}))?$/.exec(normalized);
  if (!match) return null;
  const euros = Number(match[1]);
  const decimals = (match[2] ?? "").padEnd(2, "0");
  const cents = euros * 100 + Number(decimals || "0");
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
}

export function formatCents(cents: number): string {
  const euros = Math.trunc(cents / 100);
  const remainder = Math.abs(cents % 100).toString().padStart(2, "0");
  return "€\u00a0" + euros.toLocaleString("nl-NL") + "," + remainder;
}

export function centsToDutchInput(cents: number): string {
  return (
    Math.trunc(cents / 100) +
    "," +
    Math.abs(cents % 100).toString().padStart(2, "0")
  );
}

export function shoppingListPriceCents(
  price: ShoppingListPriceReference | null,
  now: Date,
): number | null {
  if (!price) return null;
  if (
    price.isOffer &&
    !isOfferActive(
      {
        productId: price.productId,
        price: price.amount,
        oldPrice: null,
        isOffer: true,
        offerText: null,
        validFrom: price.validFrom ?? null,
        validUntil: price.validUntil ?? null,
        fetchedAt: price.updatedAt,
        updatedAt: price.updatedAt,
      },
      now,
    )
  ) {
    return null;
  }
  return euroAmountToCents(price.amount);
}

function resolveStatus(
  budgetCents: number | null,
  knownSubtotalCents: number,
  unpricedItemCount: number,
): BudgetStatus {
  if (budgetCents === null) return "noBudget";
  if (unpricedItemCount > 0) return "incompletePrices";
  if (knownSubtotalCents < budgetCents) return "underBudget";
  if (knownSubtotalCents === budgetCents) return "exactlyBudget";
  return "overBudget";
}

export function calculateBudget(
  budgetCents: number | null,
  list: ActiveShoppingList,
  now: Date = new Date(),
): BudgetResult {
  let knownSubtotalCents = 0;
  let pricedItemCount = 0;
  let unpricedItemCount = 0;

  for (const item of list.items) {
    const unitPriceCents = shoppingListPriceCents(item.price, now);
    if (unitPriceCents === null) {
      unpricedItemCount += 1;
      continue;
    }
    knownSubtotalCents += unitPriceCents * item.quantity;
    pricedItemCount += 1;
  }

  const isComplete = unpricedItemCount === 0;
  const overBudgetCents =
    budgetCents === null ? 0 : Math.max(0, knownSubtotalCents - budgetCents);
  const remainingCents =
    budgetCents !== null && isComplete
      ? Math.max(0, budgetCents - knownSubtotalCents)
      : null;
  const percentageUsed =
    budgetCents === null
      ? null
      : Math.round((knownSubtotalCents / budgetCents) * 1000) / 10;

  return {
    budgetCents,
    knownSubtotalCents,
    remainingCents,
    overBudgetCents,
    percentageUsed,
    pricedItemCount,
    unpricedItemCount,
    isComplete,
    status: resolveStatus(budgetCents, knownSubtotalCents, unpricedItemCount),
  };
}
