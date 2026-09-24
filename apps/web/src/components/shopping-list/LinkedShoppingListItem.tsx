"use client";
import Link from "next/link";
import { useState } from "react";
import { ShoppingListItemCard } from "./ShoppingListItemCard";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { PackageMutationFeedback, usePackageMutation } from "@/features/week-preparation/usePackageMutation";
import { recipeContributionTargets, type RecipeContributionTarget } from "@/services/shopping-list/recipe-contributions";
import { MAX_INGREDIENT_PACKAGES, packageCountLabel } from "@/services/week-preparation/ingredient-packages";
import type { ShoppingListItem } from "@/types/shopping-list";

export function LinkedShoppingListItem({ item }: { item: ShoppingListItem }) {
  const list = useActiveShoppingList();
  const week = useWeekPreparation();
  const mutation = usePackageMutation();
  const [expanded, setExpanded] = useState(false);
  const [removeNotice, setRemoveNotice] = useState(false);
  const hasMeals = item.quantityContributions.mealPlans.length > 0;
  const { targets, unresolved } = recipeContributionTargets(item, week.preparation);
  const independent = item.quantityContributions.persistentQuantity;
  const direct = targets.length === 1 && independent === 0 && !unresolved ? targets[0] : null;
  const blocked = mutation.blocked || week.status !== "ready" || week.preparation?.status === "generating";
  function change(target: RecipeContributionTarget, direction: -1 | 1) {
    void mutation.change(target.link.dayIndex, target.link.ingredientId, target.packages + direction, target.link);
  }
  function step(direction: -1 | 1) {
    if (!hasMeals) { void (direction === 1 ? list.increase(item.productId) : list.decrease(item.productId)); return; }
    if (direct) change(direct, direction);
    else setExpanded(true);
  }
  return <ShoppingListItemCard item={item}
    onToggleChecked={() => void list.toggleChecked(item.productId)}
    onIncrease={() => step(1)} onDecrease={() => step(-1)}
    onRemove={() => { if (hasMeals) { setRemoveNotice(true); setExpanded(true); } else void list.remove(item.productId); }}
    quantityControls={hasMeals ? <div className="linked-list-quantities">
      <div className="quantity-control" aria-label={`Aantal ${item.name}`}>
        <button type="button" aria-label={`Verlaag aantal ${item.name}`} disabled={blocked || Boolean(direct && (!direct.adjustable || direct.packages <= 1))} onClick={() => step(-1)}>−</button>
        <output aria-live="polite" aria-label={`${item.quantity} stuks`}>{item.quantity}</output>
        <button type="button" aria-label={`Verhoog aantal ${item.name}`} disabled={blocked || Boolean(direct && (!direct.adjustable || direct.packages >= MAX_INGREDIENT_PACKAGES))} onClick={() => step(1)}>+</button>
      </div>
      {direct ? <small>Voor {direct.recipeName}</small> : <button className="secondary-text-link" type="button" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>Kies recept of losse hoeveelheid</button>}
      {direct && !direct.adjustable ? <small>Hoeveelheid niet betrouwbaar aanpasbaar. Bekijk het gerecht in Menu.</small> : null}
      {expanded ? <div className="linked-list-origins" role="group" aria-label={`Herkomst ${item.name}`}>
        {targets.map(target => <div className="linked-list-origin" key={`${target.link.dayIndex}:${target.link.recipeId}:${target.link.ingredientId}`}>
          <span>{target.recipeName} · dag {target.link.dayIndex + 1}<small>{target.ingredient.name}</small></span>
          <div className="quantity-control">
            <button type="button" aria-label={`Minder ${item.name} voor ${target.recipeName} dag ${target.link.dayIndex + 1}`} disabled={blocked || !target.adjustable || target.packages <= 1} onClick={() => change(target, -1)}>−</button>
            <output aria-live="polite">{packageCountLabel(target.packages)}</output>
            <button type="button" aria-label={`Meer ${item.name} voor ${target.recipeName} dag ${target.link.dayIndex + 1}`} disabled={blocked || !target.adjustable || target.packages >= MAX_INGREDIENT_PACKAGES} onClick={() => change(target, 1)}>+</button>
          </div>
          {!target.adjustable ? <small>Hoeveelheid niet betrouwbaar aanpasbaar. Bekijk het gerecht in Menu.</small> : null}
        </div>)}
        {targets.length > 1 && targets.reduce((sum, target) => sum + target.packages, 0) > item.quantity - independent ? <small>Deze recepten delen verpakkingen. Het lijsttotaal telt wat je samen moet kopen.</small> : null}
        {independent > 0 ? <div className="linked-list-origin"><span>Los van recepten</span><div className="quantity-control">
          <button type="button" aria-label={`Minder losse ${item.name}`} disabled={blocked} onClick={() => void list.adjustIndependent(item.productId, -1)}>−</button>
          <output aria-live="polite">{packageCountLabel(independent)}</output>
          <button type="button" aria-label={`Meer losse ${item.name}`} disabled={blocked} onClick={() => void list.adjustIndependent(item.productId, 1)}>+</button>
        </div></div> : null}
        {unresolved ? <p>Een receptkoppeling is nog niet beschikbaar. <Link href="/week-voorbereiden">Open Menu om die te controleren.</Link></p> : null}
      </div> : null}
      <button className="secondary-text-link" type="button" disabled={blocked} onClick={() => { setExpanded(true); void list.adjustIndependent(item.productId, 1); }}>Losse verpakking toevoegen</button>
      {removeNotice ? <p role="status">Dit product hoort bij je menu. Houd minimaal één verpakking per ingrediënt. Je kunt losse verpakkingen hierboven weghalen, of het gerecht in <Link href="/week-voorbereiden">Menu</Link> aanpassen.</p> : null}
      <PackageMutationFeedback mutation={mutation} />
    </div> : undefined} />;
}
