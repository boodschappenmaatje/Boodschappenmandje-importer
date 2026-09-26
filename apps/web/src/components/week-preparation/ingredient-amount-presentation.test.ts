import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DishIngredients } from "./DishIngredients";
import type { WeekIngredientRequirement } from "@/types/week-preparation";

const base: WeekIngredientRequirement = {
  ingredientId: "groente", sourceKey: "groente", name: "Groente", unit: "g", optional: false, servingsBase: 1, kind: "ingredient", brandConstraint: null,
  requiredQuantity: 600, purchaseQuantity: 2, packageCapacity: 400,
  usedIn: [{ recipeId: "a", recipeName: "Dag A", dayIndex: 0, requiredQuantity: 200 }, { recipeId: "b", recipeName: "Dag B", dayIndex: 1, requiredQuantity: 400 }],
  product: { productId: "p", sku: "p", name: "Groente", brand: null, packageText: "400 g", weightGrams: 400, imageUrl: null, supermarket: "Hoogvliet", sourceUrl: "https://example.test/product" },
  price: { amountCents: 179, freshness: "stale", isOffer: false, updatedAt: "2026-09-16T12:00:00Z" },
  productMatchMissing: false, packageCalculationMissing: false,
};
function render(ingredient: WeekIngredientRequirement, dayIndex: number, compact: boolean) {
  return renderToStaticMarkup(createElement(DishIngredients, { ingredients: [ingredient], dayIndex, compact }));
}
describe("one quantity presentation for compact/detail/edit views", () => {
  it.each(["g", "ml", "piece"] as const)("ordinary scaled %s recipes keep day need distinct from purchased packaging", unit => {
    for (const people of [1, 2, 4, 6, 10, 12]) {
      const need = people * (unit === "piece" ? 1 : 50);
      const ingredient = { ...base, unit, requiredQuantity: need + 400, usedIn: [{ ...base.usedIn[0], requiredQuantity: need }, base.usedIn[1]] };
      const label = `${need} ${unit === "piece" ? need === 1 ? "stuk" : "stuks" : unit}`;
      expect(render(ingredient, 0, true)).toContain(`Totaal voor recept: ${label}`);
      expect(render(ingredient, 0, false)).toContain(`${label} nodig`);
      expect(render(ingredient, 1, false)).toContain(`400 ${unit === "piece" ? "stuks" : unit} nodig`);
    }
  });
  it.each(["ingredient", "mealMix"] as const)("%s unknown package contents remain packages, never invented grams or pieces", kind => {
    const ingredient = { ...base, kind, quantityIsPackageCount: true, unit: "piece" as const, packageCapacity: 1, requiredQuantity: 1, usedIn: [{ ...base.usedIn[0], requiredQuantity: 1 }], product: { ...base.product!, packageText: null, weightGrams: null } };
    for (const compact of [true, false]) {
      const html = render(ingredient, 0, compact);
      expect(html).toContain("1 verpakking"); expect(html).not.toContain("1 stuk");
    }
  });
});
