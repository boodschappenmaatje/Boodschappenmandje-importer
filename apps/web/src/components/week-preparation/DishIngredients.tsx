import { IngredientQuantityControl, ingredientQuantityLabel } from "./IngredientQuantityControl";
import { ingredientRecipeAmount } from "@/services/week-preparation/ingredient-packages";
import { ProductThumbnail } from "@/components/ui/ProductThumbnail";

import type { ReactNode } from "react";
import { formatCents } from "@/services/budget/budget-engine";
import type { WeekIngredientRequirement } from "@/types/week-preparation";

function quantityLabel(
  quantity: number,
  unit: WeekIngredientRequirement["unit"],
): string {
  const amount = quantity.toLocaleString("nl-NL", { maximumFractionDigits: 2 });
  if (unit === "piece") return `${amount} ${quantity === 1 ? "stuk" : "stuks"}`;
  if (unit === "loaf") return `${amount} ${quantity === 1 ? "brood" : "broden"}`;
  return `${amount} ${unit}`;
}

function packagesForDay(
  ingredient: WeekIngredientRequirement,
  dayIndex: number,
): number | null {
  const use = ingredient.usedIn.find((item) => item.dayIndex === dayIndex);
  if (!use) return null;
  if (ingredient.kind === "mealMix") return Math.ceil(use.requiredQuantity);
  if (!ingredient.packageCapacity) return null;
  return Math.max(1, Math.ceil(use.requiredQuantity / ingredient.packageCapacity));
}


/** Shared cards for the active planner dish and a proposed free-choice dish. */
export function DishIngredients({ ingredients, dayIndex, renderAction, compact = false, onQuantityChange, quantityBusy = false }: {
  ingredients: WeekIngredientRequirement[];
  dayIndex: number;
  compact?: boolean;
  onQuantityChange?: (ingredientId: string, quantity: number) => void;
  quantityBusy?: boolean;
  renderAction?: (ingredient: WeekIngredientRequirement) => ReactNode;
}) {
  return (<ul className={compact ? "compact-recipe-ingredients" : "recipe-ingredients"}>
    {ingredients.map((ingredient) => {
      const use = ingredient.usedIn.find(
        (item) => item.dayIndex === dayIndex,
      );
      const requiredQuantity =
        use?.requiredQuantity ?? ingredient.requiredQuantity;
      const packages = packagesForDay(
        ingredient,
        dayIndex,
      );
      const recipeAmount = ingredientRecipeAmount(ingredient, dayIndex);
      if (compact) return <li key={ingredient.ingredientId} data-adjustable={Boolean(onQuantityChange)}>
        <ProductThumbnail className="compact-ingredient-image" imageUrl={ingredient.product?.imageUrl ?? null} name={ingredient.product?.name ?? ingredient.name} />
        <div><strong>{ingredient.name}</strong>{ingredient.product?.name === ingredient.name ? null : <span>{ingredient.product?.name ?? "Kies opnieuw een product"}</span>}
          <small aria-label={`Benodigd ${ingredient.name}`}>Totaal voor recept: {ingredientQuantityLabel(recipeAmount.quantity, recipeAmount.unit)}</small>
          <small>{packages === null ? "Verpakkingsinhoud nodig" : `${packages} × ${ingredient.product?.packageText ?? "verpakking"}`}</small></div>
        {onQuantityChange ? <IngredientQuantityControl ingredient={ingredient} dayIndex={dayIndex} busy={quantityBusy} onChange={onQuantityChange} /> : <span className="compact-ingredient-quantity">{quantityLabel(requiredQuantity, ingredient.unit)}</span>}
        <strong className="compact-ingredient-cost">{ingredient.price && packages !== null ? formatCents(ingredient.price.amountCents * packages) : "Prijs ontbreekt"}</strong>
      </li>;
      return (
      <li key={ingredient.ingredientId}>
        <div>
          <strong>{ingredient.kind === "mealMix" ? "Maaltijdmix" : ingredient.name}</strong>
          <span>
            {ingredient.kind === "mealMix"
              ? `${requiredQuantity} ${requiredQuantity === 1 ? "verpakking" : "verpakkingen"} nodig`
              : `${quantityLabel(requiredQuantity, ingredient.unit)} nodig`}
          </span>
        </div>
        {ingredient.product ? (
          <div className="recipe-product-match">
            <ProductThumbnail className="recipe-product-image" imageUrl={ingredient.product.imageUrl} name={ingredient.product.name} />
            <div className="recipe-product-details">
              <strong>{ingredient.product.name}</strong>
              {[ingredient.product.brand, ingredient.product.packageText]
                .filter(Boolean).length ? (
                  <span>
                    {[ingredient.product.brand, ingredient.product.packageText]
                      .filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              {packages !== null ? (
                <span className="recipe-product-price">
                  {packages} {packages === 1 ? "verpakking" : "verpakkingen"}
                  {ingredient.price
                    ? ` · ${formatCents(ingredient.price.amountCents * packages)}`
                    : " · prijs nog niet beschikbaar"}
                </span>
              ) : (
                <span>Aantal nog niet zeker</span>
              )}
              {renderAction?.(ingredient)}
            </div>
          </div>
        ) : (
          <span className="shopping-item-price-missing">
            Product nog niet gevonden
          </span>
        )}
      </li>
      );
    })}
  </ul>);
}
