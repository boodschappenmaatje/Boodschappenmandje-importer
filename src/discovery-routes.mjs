// The current public catalog exposes its own category tree below /producten.
// Category URLs are discovered from that tree at runtime; this module only
// identifies the stable catalog root and never carries a stale department list.
export const PUBLIC_CATALOG_ROUTE = Object.freeze({
  key: "catalog:root",
  path: "/producten",
  title: "Producten",
});

// Compatibility export for callers that used the old name. This is deliberately
// not a static list of departments.
export const HOOGVLIET_CATEGORIES = Object.freeze([PUBLIC_CATALOG_ROUTE]);

export function categoryDiscoveryRoute(key) {
  return key === PUBLIC_CATALOG_ROUTE.key ? PUBLIC_CATALOG_ROUTE : null;
}

export function isPublicCatalogDiscoveryTerm(value) {
  return value === PUBLIC_CATALOG_ROUTE.key;
}
