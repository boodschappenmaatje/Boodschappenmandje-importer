import { CatalogReadError } from "@/services/catalog/catalog-repository";
import type { Product, ResolvedProductPrice } from "@/types/catalog";
import { resolveCurrentPrice } from "@/services/catalog/price";

const updateDateFormatter = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "short",
});

export function catalogReadErrorMessage(error: unknown): string {
  if (error instanceof CatalogReadError && error.code === "not-configured") {
    return "De productcatalogus is nog niet gekoppeld aan deze omgeving.";
  }
  if (error instanceof CatalogReadError && error.code === "unsupported-provider") {
    return "Producten zoeken bij deze supermarkt is nog niet beschikbaar.";
  }

  return "De producten konden nu niet worden geladen. Probeer het later opnieuw.";
}

export function safeProductImageUrl(value: string | null): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function mergeCatalogProducts(
  current: Product[],
  incoming: Product[],
): Product[] {
  const seen = new Set(current.map((product) => product.id));
  return [
    ...current,
    ...incoming.filter((product) => {
      if (seen.has(product.id)) {
        return false;
      }
      seen.add(product.id);
      return true;
    }),
  ];
}

export function productsWithPositivePrices(products: Product[]): Product[] {
  return products.filter((product) => (resolveCurrentPrice(product.currentPrice)?.amount ?? 0) > 0);
}

export function priceUpdatedLabel(
  price: ResolvedProductPrice,
): string | null {
  if (!price.updatedAt) {
    return price.freshness === "stale" ? "Laatste bekende prijs" : null;
  }

  const updatedAt = new Date(price.updatedAt);
  if (Number.isNaN(updatedAt.getTime())) {
    return price.freshness === "stale" ? "Laatste bekende prijs" : null;
  }

  const date = updateDateFormatter.format(updatedAt);
  return price.freshness === "stale"
    ? `Laatste bekende prijs · ${date}`
    : `Bijgewerkt ${date}`;
}
