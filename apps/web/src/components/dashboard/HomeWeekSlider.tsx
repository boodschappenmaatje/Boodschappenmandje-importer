import Link from "next/link";
import { DishImage } from "@/components/ui/DishImage";
import { DAY_LABELS } from "@/components/week-preparation/day-labels";
import { formatCents } from "@/services/budget/budget-engine";
import { calculateDishCostSummary } from "@/services/week-preparation/week-generation";
import { mealMixProfileForRecipe } from "@/services/week-preparation/meal-mix-profiles";
import { recipeImageFor } from "@/services/week-preparation/recipe-images";
import type { WeekPreparation } from "@/types/week-preparation";

function Chevron() {
  return <svg width="16" height="24" viewBox="0 0 20 24" fill="none" aria-hidden="true"><path d="m7 5 7 7-7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}

export function HomeWeekSlider({ preparation, loading }: { preparation: WeekPreparation | null; loading: boolean }) {
  const heading = <div className="home-c-section-heading"><h2>Jouw week</h2><Link href="/week-voorbereiden">Bekijk alles <Chevron /></Link></div>;
  if (!preparation?.days.length) return <section className="home-c-week-slider" aria-label="Je weekgerechten">{heading}<Link className="home-c-meal home-c-meal-empty" href="/week-voorbereiden">
    <DishImage asset={null} className="home-c-meal-image" sizes="72px" title="Gerecht kiezen" />
    <span className="home-c-meal-copy"><strong>{loading ? "Je week wordt geopend…" : "Nog geen gerechten gekozen"}</strong><span>Kies wat je deze week wilt eten</span></span><Chevron />
  </Link></section>;

  // No global selected day or calendar dates exist in the planner. Start at its first stored day.
  return <section className="home-c-week-slider" aria-label="Je weekgerechten">
    {heading}
    <ol className="home-c-slides" aria-label="Gekozen dagen" key={preparation.id}>
      {preparation.days.map(day => {
        const recipe = day.freeChoice ? null : day.recipe;
        const title = recipe ? mealMixProfileForRecipe(recipe.sourceKey)?.dishName ?? recipe.name : day.freeChoice ? "Vrije keuze" : "Nog geen maaltijd";
        const cost = recipe ? calculateDishCostSummary(day.dayIndex, preparation.ingredients) : null;
        const people = day.customDish?.targetServings ?? preparation.numberOfPeople;
        const image = recipe ? recipeImageFor({ recipeSourceKey: recipe.sourceKey, recipeName: title,
          categories: day.category === "freeChoice" ? [] : [day.category],
          ingredients: preparation.ingredients.filter(ingredient => ingredient.usedIn.some(use => use.dayIndex === day.dayIndex)),
        }) : null;
        return <li className="home-c-slide" key={day.dayIndex}>
          <Link className="home-c-day-card" href={day.freeChoice ? `/vrije-keuze?day=${day.dayIndex}` : `/week-voorbereiden?day=${day.dayIndex}`}>
            <strong className="home-c-day-label"><span aria-hidden="true">{DAY_LABELS[day.dayIndex].slice(0, 2)}</span><span className="home-c-sr-only">{DAY_LABELS[day.dayIndex]}</span></strong>
            <span className="home-c-meal">
              <DishImage asset={image} className="home-c-meal-image" sizes="110px" title={title} />
              <span className="home-c-meal-copy"><strong>{title}</strong><span>{recipe
                ? <>{people ?? "–"} {people === 1 ? "persoon" : "personen"} · {cost && cost.knownCostCents > 0 ? `${formatCents(cost.knownCostCents)}${cost.complete ? "" : " bekend"}` : "Prijs nog onbekend"}</>
                : "Kies een maaltijd"}</span></span>
            </span>
            <span className="home-c-day-status" data-planned={Boolean(recipe)} aria-label={recipe ? "Maaltijd gepland" : "Nog in te vullen"}>{recipe ? <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true"><path d="m5 10 3 3 7-7" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg> : null}</span>
          </Link>
        </li>;
      })}
    </ol>
  </section>;
}
