import type {
  CatalogProductsResult,
  Product,
  ProductPrice,
} from "@/types/catalog";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(row: UnknownRecord, field: string): string | null {
  const value = row[field];
  return typeof value === "string" && value.trim() ? value : null;
}

function optionalString(row: UnknownRecord, field: string): string | null {
  const value = row[field];
  return typeof value === "string" && value.trim() ? value : null;
}

function positiveNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function mapPrice(value: unknown): ProductPrice | null {
  if (!isRecord(value)) {
    return null;
  }

  const productId = requiredString(value, "product_id");
  const price = positiveNumber(value.price);
  if (!productId || price === null) {
    return null;
  }

  return {
    productId,
    price,
    oldPrice: positiveNumber(value.old_price),
    isOffer: value.is_offer === true,
    offerText: optionalString(value, "offer_text"),
    validFrom: optionalString(value, "valid_from"),
    validUntil: optionalString(value, "valid_until"),
    fetchedAt: optionalString(value, "fetched_at"),
    updatedAt: optionalString(value, "updated_at"),
  };
}

function newestPriceForProduct(value: unknown, productId: string): ProductPrice | null {
  const candidates = Array.isArray(value) ? value : [value];
  const matching = candidates
    .map(mapPrice)
    .filter(
      (price): price is ProductPrice =>
        price !== null && price.productId === productId,
    );

  return matching.sort((left, right) => {
    const leftDate = Date.parse(left.fetchedAt ?? left.updatedAt ?? "");
    const rightDate = Date.parse(right.fetchedAt ?? right.updatedAt ?? "");
    return (Number.isFinite(rightDate) ? rightDate : 0) -
      (Number.isFinite(leftDate) ? leftDate : 0);
  })[0] ?? null;
}

function mapProduct(value: unknown): Omit<Product, "currentPrice"> | null {
  if (!isRecord(value)) {
    return null;
  }

  const id = requiredString(value, "id");
  const supermarket = requiredString(value, "supermarket");
  const sku = requiredString(value, "sku");
  const name = requiredString(value, "name");
  const sourceUrl = requiredString(value, "source_url");
  const updatedAt = requiredString(value, "updated_at");

  if (!id || !supermarket || !sku || !name || !sourceUrl || !updatedAt) {
    return null;
  }

  return {
    id,
    supermarket,
    sku,
    name,
    brand: optionalString(value, "brand"),
    category: optionalString(value, "category"),
    productType: optionalString(value, "product_type"),
    packageText: optionalString(value, "package_text"),
    weightGrams: positiveNumber(value.weight_grams),
    imageUrl: optionalString(value, "image_url"),
    sourceUrl,
    isAvailable:
      typeof value.is_available === "boolean" ? value.is_available : null,
    updatedAt,
  };
}

export function mapCatalogRows(
  productRows: unknown,
  priceRows: unknown,
  priceStatus: CatalogProductsResult["priceStatus"] = "complete",
): CatalogProductsResult {
  const prices = new Map<string, ProductPrice>();
  if (Array.isArray(priceRows)) {
    for (const value of priceRows) {
      const price = mapPrice(value);
      if (price) {
        prices.set(price.productId, price);
      }
    }
  }

  const products: Product[] = [];
  if (Array.isArray(productRows)) {
    for (const value of productRows) {
      const product = mapProduct(value);
      if (!product) {
        continue;
      }

      // Alleen de exacte product-FK mag een prijs aan een product koppelen.
      // SKU- of naammatching is hier bewust niet toegestaan.
      products.push({
        ...product,
        currentPrice: prices.get(product.id) ?? null,
      });
    }
  }

  return { products, priceStatus };
}

export function mapJoinedCatalogRows(
  productRows: unknown,
  priceStatus: CatalogProductsResult["priceStatus"] = "complete",
): CatalogProductsResult {
  const products: Product[] = [];
  if (!Array.isArray(productRows)) {
    return { products, priceStatus };
  }

  for (const value of productRows) {
    const product = mapProduct(value);
    if (!product || !isRecord(value)) {
      continue;
    }

    // Ook bij een relationele PostgREST-query blijft de exacte product-FK
    // leidend. Een prijs van een andere SKU/productnaam wordt nooit hergebruikt.
    products.push({
      ...product,
      currentPrice: newestPriceForProduct(value.current_price, product.id),
    });
  }

  return { products, priceStatus };
}
