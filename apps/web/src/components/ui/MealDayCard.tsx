import Link from "next/link";

import { DishImage } from "@/components/ui/DishImage";
import { formatCents } from "@/services/budget/budget-engine";
import { recipeImageFor } from "@/services/week-preparation/recipe-images";
import type { MealCategory } from "@/types/week-preparation";

export function MealDayCard({
  day,
  title,
  knownCostCents,
  complete,
  recipeSourceKey,
  category,
  active = false,
}: {
  day: string;
  title: string;
  knownCostCents: number | null;
  complete: boolean;
  recipeSourceKey: string | null;
  category: MealCategory;
  active?: boolean;
}) {
  const image = recipeImageFor(recipeSourceKey, category);

  return (
    <Link
      className="meal-day-card"
      data-active={active}
      href="/week-voorbereiden"
      aria-label={`${day}: ${title}`}
    >
      <strong className="meal-day-label">{day}</strong>
      <DishImage
        asset={image}
        className="meal-day-image"
        priority={active}
        sizes="(max-width: 390px) 105px, 122px"
        title={title}
      />
      <span className="meal-day-name">{title}</span>
      {knownCostCents === null ? (
        <span className="meal-day-price">Nog niet bekend</span>
      ) : (
        <span className="meal-day-price">
          {formatCents(knownCostCents)}{!complete ? " bekend" : ""}
        </span>
      )}
    </Link>
  );
}
