import { IngredientQuantityControl, ingredientQuantityLabel } from "./IngredientQuantityControl";
import { ingredientPackageContents, ingredientPackagesForDay, ingredientRecipeAmount, packageCountLabel } from "@/services/week-preparation/ingredient-packages";
import { ProductThumbnail } from "@/components/ui/ProductThumbnail";

import type { ReactNode } from "react";
import { formatCents } from "@/services/budget/budget-engine";
import type { WeekIngredientRequirement } from "@/types/week-preparation";

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
      const packages = ingredientPackagesForDay(
        ingredient,
        dayIndex,
      );
      const recipeAmount = ingredientRecipeAmount(ingredient, dayIndex);
      // Explicit product choices count packages, not edible pieces. Both views
      // render the same day contribution; unknown contents stay packages.
      const amountLabel = (ingredient.kind === "mealMix" || ingredient.quantityIsPackageCount) && !ingredientPackageContents(ingredient)
        ? packageCountLabel(requiredQuantity)
        : ingredientQuantityLabel(recipeAmount.quantity, recipeAmount.unit);
      if (compact) return <li key={ingredient.ingredientId} data-adjustable={Boolean(onQuantityChange)}>
        <ProductThumbnail className="compact-ingredient-image" imageUrl={ingredient.product?.imageUrl ?? null} name={ingredient.product?.name ?? ingredient.name} />
        <div><strong>{ingredient.name}</strong>{ingredient.product?.name === ingredient.name ? null : <span>{ingredient.product?.name ?? "Kies opnieuw een product"}</span>}
          <small aria-label={`Benodigd ${ingredient.name}`}>Totaal voor recept: {amountLabel}</small>
          {ingredient.price && ingredient.price.freshness !== "fresh" ? <small>Laatste bekende prijs</small> : null}
          <small>{packages === null ? "Verpakkingsinhoud nodig" : `${packages} × ${ingredient.product?.packageText ?? "verpakking"}`}</small></div>
        {onQuantityChange ? <IngredientQuantityControl ingredient={ingredient} dayIndex={dayIndex} busy={quantityBusy} onChange={onQuantityChange} /> : <span className="compact-ingredient-quantity">{amountLabel}</span>}
        <strong className="compact-ingredient-cost">{ingredient.price && packages !== null ? formatCents(ingredient.price.amountCents * packages) : "Prijs ontbreekt"}</strong>
      </li>;
      return (
      <li key={ingredient.ingredientId}>
        <div>
          <strong>{ingredient.kind === "mealMix" ? "Maaltijdmix" : ingredient.name}</strong>
          <span aria-label={`Benodigd ${ingredient.name} (bewerken)`}>
            {amountLabel} nodig
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
