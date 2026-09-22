import type { ReactNode } from "react";
import { DishImage } from "@/components/ui/DishImage";
import { DishIngredients } from "./DishIngredients";
import { formatCents } from "@/services/budget/budget-engine";
import { calculateDishCostSummary } from "@/services/week-preparation/week-generation";
import { recipeImageFor } from "@/services/week-preparation/recipe-images";
import { mealMixProfileForRecipe } from "@/services/week-preparation/meal-mix-profiles";
import type { WeekPreparation } from "@/types/week-preparation";

/** One read-only detail for generated dishes, meal mixes and private recipes. */
export function CompactRecipeDetail({ preparation, dayIndex, children }: {
  preparation: WeekPreparation; dayIndex: number; children?: ReactNode;
}) {
  const day = preparation.days.find(item => item.dayIndex === dayIndex);
  if (!day?.recipe) return null;
  const ingredients = preparation.ingredients.filter(item => item.usedIn.some(use => use.dayIndex === dayIndex));
  const cost = calculateDishCostSummary(dayIndex, preparation.ingredients);
  const people = day.customDish?.targetServings ?? preparation.numberOfPeople;
  const title = mealMixProfileForRecipe(day.recipe.sourceKey)?.dishName ?? day.recipe.name;
  const image = recipeImageFor({ recipeSourceKey: day.recipe.sourceKey, recipeName: title, categories: day.category === "freeChoice" ? [] : [day.category], ingredients });
  const remaining = preparation.generation?.mealBudgetRemainingCents;
  return <section className="compact-recipe-detail" aria-label={`Recept: ${title}`}>
    <header className="compact-recipe-heading">
      <DishImage asset={image} title={title} className="recipe-summary-image" sizes="64px" />
      <div><h3>{title}</h3><p>{people} personen · <strong>{cost.complete ? formatCents(cost.knownCostCents) : "Prijs onvolledig"}</strong></p>
        {cost.complete && people ? <small>{formatCents(Math.round(cost.knownCostCents / people))} per persoon</small> : null}</div>
    </header>
    {remaining !== null && remaining !== undefined ? <p className="compact-budget-status">Maaltijdbudget: {formatCents(Math.abs(remaining))} {remaining < 0 ? "boven budget" : "over"}{!preparation.generation?.isMealBudgetComplete ? " · voorlopig" : ""}</p> : null}
    <DishIngredients ingredients={ingredients.slice(0, 5)} dayIndex={dayIndex} compact />
    {ingredients.length > 5 ? <details className="compact-more-ingredients"><summary>Toon alle ingrediënten ({ingredients.length})</summary><DishIngredients ingredients={ingredients.slice(5)} dayIndex={dayIndex} compact /></details> : null}
    {children}
  </section>;
}
