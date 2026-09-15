export type UUID = string;

export interface ProductPrice {
  productId: UUID;
  price: number;
  oldPrice: number | null;
  isOffer: boolean;
  offerText: string | null;
  validFrom: string | null;
  validUntil: string | null;
  fetchedAt: string | null;
  updatedAt: string | null;
}

export type PriceFreshness = "fresh" | "stale" | "unknown";

export interface ResolvedProductPrice {
  amount: number;
  comparisonPrice: number | null;
  isOffer: boolean;
  offerText: string | null;
  updatedAt: string | null;
  freshness: PriceFreshness;
}

export interface Product {
  id: UUID;
  supermarket: string;
  sku: string;
  name: string;
  brand: string | null;
  category: string | null;
  productType: string | null;
  packageText: string | null;
  weightGrams: number | null;
  imageUrl: string | null;
  sourceUrl: string;
  isAvailable: boolean | null;
  updatedAt: string;
  currentPrice: ProductPrice | null;
}

export interface Category {
  name: string;
  productType: string | null;
}

export interface Ingredient {
  id: UUID;
  sourceKey: string;
  name: string;
  normalizedName: string;
  defaultUnit: string;
  category: string;
}

export interface IngredientAlias {
  id: UUID;
  ingredientId: UUID;
  alias: string;
  normalizedAlias: string;
}

export interface Recipe {
  id: UUID;
  sourceKey: string;
  name: string;
  normalizedName: string;
  symbol: string;
  preparationMinutes: number;
  vegetarian: boolean;
  containsPork: boolean;
  kidFriendly: boolean;
  healthy: boolean;
  budgetTier: "economical" | "standard" | "premium";
}

export interface RecipeIngredient {
  id: UUID;
  recipeId: UUID;
  ingredientId: UUID;
  amountPerPerson: number;
  unit: "g" | "kg" | "ml" | "l" | "piece" | "loaf";
  position: number;
}

export interface CatalogProductsResult {
  products: Product[];
  priceStatus: "complete" | "unavailable";
}

export interface CatalogPageResult extends CatalogProductsResult {
  page: number;
  pageSize: number;
  hasMore: boolean;
}

export type CatalogSort =
  | "relevance"
  | "price-asc"
  | "price-desc"
  | "name-asc";

export interface CatalogQuery {
  term: string;
  category: string | null;
  brand: string | null;
  offersOnly: boolean;
  maxPrice: number | null;
  sort: CatalogSort;
}

export interface CatalogQueryPageResult extends CatalogPageResult {
  query: CatalogQuery;
}

export interface CatalogFilterOptions {
  categories: string[];
  brands: string[];
}

// Behouden voor compatibiliteit met de PWA 4-mappertests en eventuele
// vervolgstappen die alleen het gemapte productresultaat nodig hebben.
export type CatalogPreviewResult = CatalogProductsResult;
