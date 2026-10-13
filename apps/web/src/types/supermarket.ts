export const SUPERMARKETS = {
  hoogvliet: { id: "hoogvliet", name: "Hoogvliet", catalogSupported: true },
  ah: { id: "ah", name: "Albert Heijn", catalogSupported: false },
  jumbo: { id: "jumbo", name: "Jumbo", catalogSupported: false },
  lidl: { id: "lidl", name: "Lidl", catalogSupported: false },
  dirk: { id: "dirk", name: "Dirk", catalogSupported: false },
} as const;

export type SupermarketId = keyof typeof SUPERMARKETS;

export const DEFAULT_SUPERMARKET_ID: SupermarketId = "hoogvliet";

export function isSupermarketId(value: unknown): value is SupermarketId {
  return typeof value === "string" && Object.hasOwn(SUPERMARKETS, value);
}

export function catalogNameForSupermarket(id: SupermarketId): string {
  if (!SUPERMARKETS[id].catalogSupported) {
    throw new Error(`Catalogus voor ${SUPERMARKETS[id].name} wordt nog niet ondersteund.`);
  }
  return SUPERMARKETS[id].name;
}

export function productBelongsToSupermarket(
  productSupermarket: string,
  id: SupermarketId,
): boolean {
  return SUPERMARKETS[id].catalogSupported && productSupermarket === SUPERMARKETS[id].name;
}
