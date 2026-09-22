import type { ReactNode } from "react";
import { Icon } from "@/components/Icon";
import { formatCents } from "@/services/budget/budget-engine";
import { safeProductImageUrl } from "@/services/catalog/catalog-presentation";
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
export function DishIngredients({ ingredients, dayIndex, renderAction }: {
  ingredients: WeekIngredientRequirement[];
  dayIndex: number;
  renderAction?: (ingredient: WeekIngredientRequirement) => ReactNode;
}) {
  return (<ul className="recipe-ingredients">
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
      const imageUrl = ingredient.product
        ? safeProductImageUrl(ingredient.product.imageUrl)
        : null;
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
            <div
              className="recipe-product-image"
              data-has-image={Boolean(imageUrl)}
              style={imageUrl ? { backgroundImage: `url(${JSON.stringify(imageUrl)})` } : undefined}
              role="img"
              aria-label={imageUrl ? `Afbeelding van ${ingredient.product.name}` : "Geen productafbeelding"}
            >
              {!imageUrl ? <Icon name="products" size={22} /> : null}
            </div>
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
