"use client";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/Icon";
import { ShoppingListItemCard } from "./ShoppingListItemCard";
import { ShoppingListDetails } from "./ShoppingListDetails";
import { ShoppingListQuantity } from "./ShoppingListQuantity";
import { independentOriginLabel, isOwnRecipe, ShoppingListOrigins } from "./ShoppingListOrigins";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { useIndependentPackageMutation } from "@/features/shopping-list/useIndependentPackageMutation";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { PackageMutationFeedback, usePackageMutation } from "@/features/week-preparation/usePackageMutation";
import { recipeContributionTargets, type RecipeContributionTarget } from "@/services/shopping-list/recipe-contributions";
import { MAX_INGREDIENT_PACKAGES, ingredientRecipeAmount, packageCountLabel } from "@/services/week-preparation/ingredient-packages";
import type { ShoppingListItem } from "@/types/shopping-list";

export function LinkedShoppingListItem({ item }: { item: ShoppingListItem }) {
  const list = useActiveShoppingList();
  const week = useWeekPreparation();
  const mutation = usePackageMutation();
  const independentMutation = useIndependentPackageMutation(item.productId);
  const [expanded, setExpanded] = useState(false);
  const hasMeals = item.quantityContributions.mealPlans.length > 0;
  const { targets, unresolved } = recipeContributionTargets(item, week.preparation);
  const independent = item.quantityContributions.persistentQuantity;
  const direct = targets.length === 1 && independent === 0 && !unresolved ? targets[0] : null;
  const blocked = mutation.blocked || independentMutation.blocked || week.status !== "ready" || week.preparation?.status === "generating";
  const open = expanded || Boolean(mutation.pending) || Boolean(independentMutation.pending);
  function change(target: RecipeContributionTarget, direction: -1 | 1) {
    void mutation.change(target.link.dayIndex, target.link.ingredientId, target.packages + direction, target.link);
  }
  function step(direction: -1 | 1) {
    if (!hasMeals) { void independentMutation.change(direction); return; }
    if (direct) change(direct, direction);
    else setExpanded(true);
  }
  function close() { setExpanded(false); if (mutation.pending) mutation.cancel(); independentMutation.cancel(); }
  function remove() {
    if (direct) void mutation.remove(direct.link);
    else if (hasMeals) setExpanded(true);
    else void list.remove(item.productId);
  }
  const totalControls = (details = false) => <ShoppingListQuantity quantity={item.quantity}
    label={`Aantal ${item.name}${details ? " in details" : ""}`}
    decreaseLabel={`Verlaag aantal ${item.name}${details ? " in details" : ""}`}
    increaseLabel={`Verhoog aantal ${item.name}${details ? " in details" : ""}`}
    decreaseDisabled={independentMutation.blocked || (hasMeals && (blocked || (item.quantity > 1 && Boolean(direct && (!direct.adjustable || direct.packages <= 1)))))}
    increaseDisabled={independentMutation.blocked || (hasMeals && (blocked || Boolean(direct && (!direct.adjustable || direct.packages >= MAX_INGREDIENT_PACKAGES))))}
    onRemove={!hasMeals || direct ? remove : undefined} removeLabel={`Verwijderactie ${item.name}${details ? " in details" : ""}`}
    onDecrease={() => step(-1)} onIncrease={() => step(1)} />;
  return <ShoppingListItemCard item={item}
    onToggleChecked={() => void list.toggleChecked(item.productId)} onOpenDetails={() => setExpanded(true)}
    originSummary={<ShoppingListOrigins item={item} targets={targets} week={week.preparation} unresolved={unresolved} />}
    quantityControls={totalControls()}>
    {!open && hasMeals ? <div className={mutation.busy || (mutation.message && !mutation.message.startsWith("Hoeveelheid, verpakkingen")) ? "shopping-row-feedback" : "visually-hidden"}><PackageMutationFeedback mutation={mutation} /></div> : null}
    {open ? <ShoppingListDetails item={item} onClose={close}>
      <section className="linked-list-quantities" aria-label={`Herkomstverdeling ${item.name}`}>
        <h3>{hasMeals ? "Herkomst" : "Hoeveelheid"}</h3>
        {!hasMeals ? <><p className="shopping-independent-label"><Icon name="plus" size={16} />{independentOriginLabel(item)}</p>{totalControls(true)}</> : <div className="linked-list-origins" role="group" aria-label={`Herkomst ${item.name}`}>
          {targets.map(target => {
            const amount = ingredientRecipeAmount(target.ingredient, target.link.dayIndex);
            const own = isOwnRecipe(target, week.preparation);
            return <div className="linked-list-origin" key={`${target.link.dayIndex}:${target.link.recipeId}:${target.link.ingredientId}`}>
              <span className="linked-list-origin-title"><Icon name={own ? "chef" : "bowl"} size={18} /><span>{target.recipeName}<small>{own ? "Eigen recept" : "Menu"} · dag {target.link.dayIndex + 1}</small></span></span>
              <small>{target.ingredient.name} · {amount.quantity.toLocaleString("nl-NL")} {amount.unit === "piece" ? "stuks" : amount.unit}</small>
              <ShoppingListQuantity quantity={target.packages} output={packageCountLabel(target.packages)} label={`${target.recipeName} dag ${target.link.dayIndex + 1}`}
                decreaseLabel={`Minder ${item.name} voor ${target.recipeName} dag ${target.link.dayIndex + 1}`}
                increaseLabel={`Meer ${item.name} voor ${target.recipeName} dag ${target.link.dayIndex + 1}`}
                decreaseDisabled={blocked || (target.packages > 1 && !target.adjustable)}
                increaseDisabled={blocked || !target.adjustable || target.packages >= MAX_INGREDIENT_PACKAGES}
                onRemove={() => void mutation.remove(target.link)} removeLabel={`Verwijderactie ${item.name} voor ${target.recipeName} dag ${target.link.dayIndex + 1}`}
                onDecrease={() => change(target, -1)} onIncrease={() => change(target, 1)} />
              {!target.adjustable ? <small>Hoeveelheid niet betrouwbaar aanpasbaar. Bekijk het gerecht in Menu.</small> : null}
            </div>;
          })}
          {targets.length > 1 && targets.reduce((sum, target) => sum + target.packages, 0) > item.quantity - independent ? <small>Deze recepten delen verpakkingen. Het lijsttotaal telt wat je samen moet kopen.</small> : null}
          {independent > 0 ? <div className="linked-list-origin"><span className="linked-list-origin-title"><Icon name="plus" size={18} /><span>Los van recepten<small>{independentOriginLabel(item)}</small></span></span>
            <ShoppingListQuantity quantity={independent} output={packageCountLabel(independent)} label={`Losse ${item.name}`}
              decreaseLabel={`Minder losse ${item.name}`} increaseLabel={`Meer losse ${item.name}`} decreaseDisabled={blocked} increaseDisabled={blocked}
              onRemove={() => void independentMutation.change(-1)} removeLabel={`Verwijder losse ${item.name}`}
              onDecrease={() => void independentMutation.change(-1)} onIncrease={() => void independentMutation.change(1)} />
          </div> : null}
          {unresolved ? <div><p>Een receptkoppeling is nog niet beschikbaar. <Link href="/week-voorbereiden">Open Menu om die te controleren.</Link></p>
            {item.quantityContributions.mealPlans.map((contribution, index) => <p key={index}>{contribution.usedIn.join(" · ") || "Gepland menu"}: {packageCountLabel(contribution.quantity)} gezamenlijk</p>)}
          </div> : null}
        </div>}
        <button className="shopping-add-loose" type="button" disabled={independentMutation.blocked || (hasMeals && blocked)} onClick={() => void independentMutation.change(1)}><Icon name="plus" size={18} />Losse verpakking toevoegen</button>
        <PackageMutationFeedback mutation={independentMutation} />
        {hasMeals ? <PackageMutationFeedback mutation={mutation} /> : null}
        {!hasMeals || direct ? <button className="shopping-detail-remove" type="button" disabled={blocked} aria-label={`Verwijder ${item.name}`} onClick={remove}><Icon name="trash" size={18} />Verwijderen</button> : <p>Kies hierboven de bijdrage die je wilt aanpassen of verwijderen.</p>}
      </section>
    </ShoppingListDetails> : null}
  </ShoppingListItemCard>;
}
