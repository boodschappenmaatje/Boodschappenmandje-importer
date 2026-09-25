import type {
  Product,
  ProductPrice,
  ResolvedProductPrice,
} from "@/types/catalog";

// De importer ververst dagelijks één van zeven vaste prijsdeelbatches. Acht
// dagen geeft die cyclus één dag speling voordat we data als mogelijk oud
// labelen. Een stale prijs blijft zichtbaar als 'laatst bekend', nooit als vers.
export const PRICE_STALE_AFTER_DAYS = 8;
const PRICE_STALE_AFTER_MS = PRICE_STALE_AFTER_DAYS * 24 * 60 * 60 * 1000;

/** Freshness labels age; it never disqualifies a reliable positive catalog price. */
export function reliablePriceCents(price: { amountCents: number } | null | undefined): boolean {
  return Boolean(price && Number.isSafeInteger(price.amountCents) && price.amountCents > 0);
}

/** Exact product identity and newest valid observation win, independent of row order. */
export function newestReliablePrice(prices: (ProductPrice | null)[], productId: string): ProductPrice | null {
  return prices.filter((price): price is ProductPrice => Boolean(
    price && price.productId === productId && resolveCurrentPrice(price),
  )).sort((a, b) => priceTimestamp(getPriceUpdatedAt(b)) - priceTimestamp(getPriceUpdatedAt(a)))[0] ?? null;
}

export function priceTimestamp(value: string | null): number {
  const time = Date.parse(value ?? "");
  return Number.isFinite(time) ? time : 0;
}

function validDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = validDate(`${value.slice(0, 10)}T00:00:00`);
  return date;
}

function endOfDate(value: string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = validDate(`${value.slice(0, 10)}T23:59:59.999`);
  return date;
}

export function getPriceUpdatedAt(price: ProductPrice): string | null {
  return price.fetchedAt ?? price.updatedAt;
}

export function getPriceFreshness(
  price: ProductPrice,
  now: Date = new Date(),
): ResolvedProductPrice["freshness"] {
  const updatedAt = validDate(getPriceUpdatedAt(price));
  if (!updatedAt || updatedAt.getTime() > now.getTime()) {
    return "unknown";
  }

  return now.getTime() - updatedAt.getTime() <= PRICE_STALE_AFTER_MS
    ? "fresh"
    : "stale";
}

export function isOfferActive(
  price: ProductPrice,
  now: Date = new Date(),
): boolean {
  if (!price.isOffer) {
    return false;
  }

  const startsAt = startOfDate(price.validFrom);
  const endsAt = endOfDate(price.validUntil);

  // Een aanwezige maar onleesbare actiegrens is onvoldoende bewijs voor een
  // geldige actie. Ontbrekende grenzen laten het door de importer gevalideerde
  // is_offer-signaal leidend.
  if ((price.validFrom && !startsAt) || (price.validUntil && !endsAt)) {
    return false;
  }
  if (startsAt && now.getTime() < startsAt.getTime()) {
    return false;
  }
  if (endsAt && now.getTime() > endsAt.getTime()) {
    return false;
  }

  return true;
}

export function resolveCurrentPrice(
  price: ProductPrice | null,
  now: Date = new Date(),
): ResolvedProductPrice | null {
  if (!price || !Number.isFinite(price.price) || !Number.isSafeInteger(Math.round(price.price * 100)) || Math.round(price.price * 100) <= 0) {
    return null;
  }

  const isOffer = isOfferActive(price, now);
  return {
    amount: price.price,
    comparisonPrice:
      isOffer && price.oldPrice && price.oldPrice > price.price
        ? price.oldPrice
        : null,
    isOffer,
    offerText: isOffer ? price.offerText : null,
    updatedAt: getPriceUpdatedAt(price),
    freshness: getPriceFreshness(price, now),
  };
}

export function getPricePerKilogram(
  product: Product,
  resolvedPrice: ResolvedProductPrice,
): number | null {
  if (!product.weightGrams || product.weightGrams <= 0) {
    return null;
  }

  return (resolvedPrice.amount * 1000) / product.weightGrams;
}
