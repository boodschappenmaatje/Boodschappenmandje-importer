import { Icon } from "@/components/Icon";
import type { RecipeContributionTarget } from "@/services/shopping-list/recipe-contributions";
import type { ShoppingListItem } from "@/types/shopping-list";
import type { WeekPreparation } from "@/types/week-preparation";

export type ListOriginFilter = "all" | "meals" | "other";
export function matchesListOrigin(item: ShoppingListItem, filter: ListOriginFilter): boolean {
  if (filter === "meals") return item.quantityContributions.mealPlans.length > 0;
  if (filter === "other") return item.quantityContributions.persistentQuantity > 0;
  return true;
}

export function isOwnRecipe(target: RecipeContributionTarget, week: WeekPreparation | null): boolean {
  return week?.id === target.link.weekPreparationId && Boolean(week.days.find(day => day.dayIndex === target.link.dayIndex && day.recipeId === target.link.recipeId)?.customDish);
}

export function independentOriginLabel(item: ShoppingListItem): string {
  const labels = [
    item.sources.some(source => source === "manual" || source === "catalog") ? "Los" : null,
    item.sources.includes("suggestion") ? "Suggestie" : null,
    item.sources.includes("recurring") ? "Terugkerend" : null,
  ].filter(Boolean);
  return labels.join(" · ") || "Los";
}

export function ShoppingListOrigins({ item, targets, week, unresolved }: {
  item: ShoppingListItem; targets: RecipeContributionTarget[]; week: WeekPreparation | null; unresolved: boolean;
}) {
  const meals = [...new Map(targets.map(target => [`${target.link.weekPreparationId}:${target.link.dayIndex}:${target.link.recipeId}`, target])).values()];
  const own = meals.filter(target => isOwnRecipe(target, week));
  const label = unresolved ? "Maaltijden" : meals.length > 1 ? `${meals.length} maaltijden` : own.length ? "Eigen recept" : meals[0]?.recipeName ?? "Maaltijden";
  return <span className="shopping-origin-summary" aria-label={`Herkomst ${item.name}`}>
    {item.quantityContributions.mealPlans.length > 0 ? <span className="shopping-origin-chip" title={meals.map(target => target.recipeName).join(" · ") || "Gepland menu"}>
      <Icon name={own.length === meals.length && own.length > 0 ? "chef" : "bowl"} size={15} />
      {own.length > 0 && own.length < meals.length ? <Icon name="chef" size={15} /> : null}
      <span>{label}</span>
    </span> : null}
    {item.quantityContributions.persistentQuantity > 0 ? <span className="shopping-origin-chip" data-kind="loose" title={independentOriginLabel(item)}>
      <Icon name={item.sources.includes("recurring") ? "history" : item.sources.includes("suggestion") ? "lightbulb" : "plus"} size={14} />
      <span>{independentOriginLabel(item)}</span>
    </span> : null}
  </span>;
}
