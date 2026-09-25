import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { CustomIngredientEditor, customProductPrice } from "./CustomIngredientEditor";
import { DishImage } from "@/components/ui/DishImage";
import type { Product } from "@/types/catalog";
vi.mock("@/features/week-preparation/WeekPreparationProvider", () => ({ useWeekPreparation: () => ({ matchCustomIngredient: vi.fn(), searchCatalogProducts: vi.fn() }) }));
const now = new Date().toISOString();
const product: Product = { id: "pasta", sku: "123", name: "Spaghetti", supermarket: "Hoogvliet", brand: null, category: null, productType: null, packageText: "500 g", weightGrams: null, imageUrl: null, sourceUrl: "https://example.test/pasta", isAvailable: true, updatedAt: now, currentPrice: { productId: "pasta", price: 1.99, oldPrice: null, isOffer: false, offerText: null, validFrom: null, validUntil: null, fetchedAt: now, updatedAt: now } };
describe("PWA 14 ingredient and photo presentation", () => {
  it("opens a labelled product search for a new ingredient", () => {
    const row = { id: "row", name: "", quantity: 0, unit: "piece" as const, productId: null };
    const html = renderToStaticMarkup(createElement(CustomIngredientEditor, { row, dish: { name: "Pasta", servings: 4, ingredients: [row] }, refresh: 0, onChange: vi.fn(), onRemove: vi.fn() }));
    expect(html).toContain("Zoek product"); expect(html).toContain('type="search"'); expect(html).toContain("Ingrediënt verwijderen");
    expect(html).not.toContain("€");
  });
  it("keeps selected ingredient identity and displays missing-photo fallback during fresh lookup", () => {
    const row = { id: "row", name: "Spaghetti", quantity: 400, unit: "g" as const, productId: "pasta" };
    const html = renderToStaticMarkup(createElement(CustomIngredientEditor, { row, dish: { name: "Pasta", servings: 4, targetServings: 6, ingredients: [row] }, refresh: 0, onChange: vi.fn(), onRemove: vi.fn() }));
    expect(html).toContain("Geen productafbeelding: Spaghetti"); expect(html).toContain('value="600"');
    expect(html).toContain("Ingrediënt vervangen"); expect(html).toContain("Actueel product ophalen");
    expect(html).not.toContain("€");
  });
  it("uses an honest recipe fallback without inventing a matching food photo", () => {
    const html = renderToStaticMarkup(createElement(DishImage, { asset: null, title: "Eigen pasta", className: "recipe-summary-image", sizes: "58px" }));
    expect(html).toContain('data-image-source="placeholder"'); expect(html).not.toContain("<img");
  });
  it("only shows reliable positive prices including last-known fallback belonging to available exact products", () => {
    expect(customProductPrice(product)).toBe(199);
    expect(customProductPrice({ ...product, currentPrice: null })).toBeNull();
    expect(customProductPrice({ ...product, isAvailable: false })).toBeNull();
    expect(customProductPrice({ ...product, currentPrice: { ...product.currentPrice!, productId: "other" } })).toBeNull();
    expect(customProductPrice({ ...product, currentPrice: { ...product.currentPrice!, fetchedAt: new Date(0).toISOString() } })).toBe(199);
  });
});
