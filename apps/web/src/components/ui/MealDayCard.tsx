import Link from "next/link";
import type { CSSProperties } from "react";

import { Icon } from "@/components/Icon";
import { safeProductImageUrl } from "@/services/catalog/catalog-presentation";
import { formatCents } from "@/services/budget/budget-engine";

export function MealDayCard({
  day,
  title,
  knownCostCents,
  complete,
  imageUrl,
  active = false,
}: {
  day: string;
  title: string;
  knownCostCents: number | null;
  complete: boolean;
  imageUrl: string | null;
  active?: boolean;
}) {
  const safeImage = safeProductImageUrl(imageUrl);
  const imageStyle: CSSProperties | undefined = safeImage
    ? { backgroundImage: `url(${JSON.stringify(safeImage)})` }
    : undefined;

  return (
    <Link
      className="meal-day-card"
      data-active={active}
      href="/week-voorbereiden"
      aria-label={`${day}: ${title}`}
    >
      <strong className="meal-day-label">{day}</strong>
      <span
        className="meal-day-image"
        data-has-image={Boolean(safeImage)}
        style={imageStyle}
        role="img"
        aria-label={safeImage ? `Afbeelding bij ${title}` : "Geen gerechtfoto beschikbaar"}
      >
        {!safeImage ? <Icon name="prepare" size={25} /> : null}
      </span>
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
