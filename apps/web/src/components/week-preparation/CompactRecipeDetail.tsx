import type { ReactNode } from "react";
import { DishImage } from "@/components/ui/DishImage";
import { DishIngredients } from "./DishIngredients";
import { formatCents } from "@/services/budget/budget-engine";
import { calculateDishCostSummary } from "@/services/week-preparation/week-generation";
import { recipeImageFor } from "@/services/week-preparation/recipe-images";
import { mealMixProfileForRecipe } from "@/services/week-preparation/meal-mix-profiles";
import type { WeekPreparation } from "@/types/week-preparation";

/** One compact detail for generated dishes, meal mixes and private recipes. */
export function CompactRecipeDetail({ preparation, dayIndex, children, showBudget = true, presentation = "inline", onQuantityChange, quantityBusy = false }: {
  preparation: WeekPreparation; dayIndex: number; children?: ReactNode; showBudget?: boolean; presentation?: "inline" | "screen";
  onQuantityChange?: (ingredientId: string, quantity: number) => void; quantityBusy?: boolean;
}) {
  const day = preparation.days.find(item => item.dayIndex === dayIndex);
  if (!day?.recipe) return null;
  const ingredients = preparation.ingredients.filter(item => item.usedIn.some(use => use.dayIndex === dayIndex));
  const excluded = preparation.customizations.find(item => item.dayIndex === dayIndex)?.excludedIngredients?.filter(item => item.recipeId === day.recipeId) ?? [];
  const cost = calculateDishCostSummary(dayIndex, preparation.ingredients);
  const people = day.customDish?.targetServings ?? preparation.numberOfPeople;
  const title = mealMixProfileForRecipe(day.recipe.sourceKey)?.dishName ?? day.recipe.name;
  const image = recipeImageFor({ recipeSourceKey: day.recipe.sourceKey, recipeName: title, categories: day.category === "freeChoice" ? [] : [day.category], ingredients });
  const remaining = preparation.mealBudgetCents !== null && preparation.generation
    ? preparation.mealBudgetCents - preparation.generation.mealPlanKnownCostCents
    : null;
  return <section className="compact-recipe-detail" data-presentation={presentation} aria-label={`Recept: ${title}`}>
    <header className="compact-recipe-heading">
      <DishImage asset={image} title={title} className="recipe-summary-image" sizes={presentation === "screen" ? "(max-width: 600px) 38vw, 160px" : "64px"} />
      <div><h3>{title}</h3><p>{people} personen</p><p><strong>{cost.complete ? formatCents(cost.knownCostCents) : "Prijs onvolledig"}</strong> totaal</p>
        {cost.complete && people ? <small>{formatCents(Math.round(cost.knownCostCents / people))} per persoon</small> : null}
    {showBudget && remaining !== null && remaining !== undefined ? <p className="compact-budget-status" data-status={remaining < 0 ? "over" : "within"}>Maaltijdbudget: {formatCents(Math.abs(remaining))} {remaining < 0 ? "boven budget" : "over"}{!preparation.generation?.isMealBudgetComplete ? " · voorlopig" : ""}</p> : null}
    </div></header>
    <h4 className="compact-ingredients-title">Ingrediënten ({Math.min(5, ingredients.length)} van {ingredients.length})</h4>
    {excluded.length ? <p>Door jou verwijderd uit dit gerecht: {excluded.map(item => item.name).join(", ")}.</p> : null}
    {!ingredients.length && excluded.length ? <p>Dit gerecht heeft geen te kopen ingrediënten meer. Pas het gerecht aan om weer ingrediënten toe te voegen.</p> : null}
    <DishIngredients ingredients={ingredients.slice(0, 5)} dayIndex={dayIndex} compact onQuantityChange={onQuantityChange} quantityBusy={quantityBusy} />
    {ingredients.length > 5 ? <details className="compact-more-ingredients"><summary>Toon alle ingrediënten ({ingredients.length})</summary><DishIngredients ingredients={ingredients.slice(5)} dayIndex={dayIndex} compact onQuantityChange={onQuantityChange} quantityBusy={quantityBusy} /></details> : null}
    {children}
  </section>;
}
