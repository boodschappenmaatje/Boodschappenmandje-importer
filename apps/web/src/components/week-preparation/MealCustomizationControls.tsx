"use client";

import { useState } from "react";

import { DishImage } from "@/components/ui/DishImage";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { formatCents } from "@/services/budget/budget-engine";
import type {
  ProductAlternative,
  RecipeAlternative,
} from "@/services/week-preparation/meal-customization";
import { recipeImageFor } from "@/services/week-preparation/recipe-images";

function differenceLabel(cents: number): string {
  if (cents === 0) return "Zelfde prijs";
  return `${formatCents(Math.abs(cents))} ${cents < 0 ? "goedkoper" : "duurder"}`;
}

interface MealReplacementControlProps {
  dayIndex: number;
  currentRecipeName: string;
}

export function MealReplacementControl({
  dayIndex,
  currentRecipeName,
}: MealReplacementControlProps) {
  const week = useWeekPreparation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alternatives, setAlternatives] = useState<RecipeAlternative[]>([]);
  const [pending, setPending] = useState<RecipeAlternative | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      setPending(null);
      return;
    }
    setOpen(true);
    setLoading(true);
    setAlternatives(await week.findRecipeAlternatives(dayIndex));
    setLoading(false);
  }

  async function confirm() {
    if (!pending) return;
    const replaced = await week.replaceRecipe(dayIndex, pending.recipe.id);
    if (replaced) {
      setOpen(false);
      setPending(null);
      setAlternatives([]);
    }
  }

  return (
    <section className="meal-customization" aria-label="Gerecht aanpassen">
      <button
        className="secondary-action compact-action"
        type="button"
        onClick={toggle}
        aria-expanded={open}
        disabled={week.customizationBusy}
      >
        {open ? "Sluit alternatieven" : "Vervang gerecht"}
      </button>
      {open ? (
        <div className="meal-alternatives" role="region" aria-label="Geschikte alternatieven">
          {loading ? (
            <p role="status">Complete alternatieven en actuele prijzen worden gecontroleerd…</p>
          ) : alternatives.length === 0 ? (
            <p role="status">Er zijn nu geen andere complete gerechten in deze categorie.</p>
          ) : (
            <ul>
              {alternatives.map((alternative) => {
                const image = recipeImageFor({
                  recipeSourceKey: alternative.recipe.sourceKey,
                  recipeName: alternative.recipe.name,
                  categories: [alternative.category],
                  ingredients: [],
                });
                return (
                  <li key={alternative.recipe.id}>
                    <button
                      type="button"
                      className="meal-alternative-card"
                      onClick={() => setPending(alternative)}
                      aria-pressed={pending?.recipe.id === alternative.recipe.id}
                    >
                      <DishImage
                        asset={image}
                        className="meal-alternative-image"
                        sizes="64px"
                        title={alternative.recipe.name}
                      />
                      <span>
                        <strong>{alternative.recipe.name}</strong>
                        <small>
                          {formatCents(alternative.alternativeDishCostCents)} · {differenceLabel(alternative.differenceCents)}
                        </small>
                        <small>
                          Nieuwe maaltijdkosten: {formatCents(alternative.nextMealPlanCostCents)}
                          {alternative.mealBudgetCents === null
                            ? ""
                            : ` / ${formatCents(alternative.mealBudgetCents)}`}
                        </small>
                        {alternative.alreadyUsedInWeek ? <small>Staat al een keer in je week</small> : null}
                        {!alternative.withinMealBudget ? (
                          <small className="alternative-budget-warning">
                            Past niet binnen je maaltijd-budget
                          </small>
                        ) : null}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {pending ? (
            <div className="customization-confirm" role="alert">
              <p>
                Vervang <strong>{currentRecipeName}</strong> door <strong>{pending.recipe.name}</strong>?
              </p>
              <p>
                {differenceLabel(pending.differenceCents)} · daarna {formatCents(pending.nextMealPlanCostCents)} aan maaltijden.
              </p>
              {!pending.withinMealBudget && pending.mealBudgetCents !== null ? (
                <p>
                  Met dit gerecht kom je {formatCents(Math.max(0, pending.nextMealPlanCostCents - pending.mealBudgetCents))} boven je maaltijd-budget.
                </p>
              ) : null}
              <div className="customization-confirm-actions">
                <button type="button" onClick={() => setPending(null)} disabled={week.customizationBusy}>
                  Annuleren
                </button>
                <button
                  className="primary-action compact-action"
                  type="button"
                  onClick={confirm}
                  disabled={!pending.withinMealBudget || week.customizationBusy}
                >
                  Bevestig vervanging
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

interface ProductAlternativeControlProps {
  dayIndex: number;
  ingredientId: string;
  currentProductName: string;
}

export function ProductAlternativeControl({
  dayIndex,
  ingredientId,
  currentProductName,
}: ProductAlternativeControlProps) {
  const week = useWeekPreparation();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [alternatives, setAlternatives] = useState<ProductAlternative[]>([]);
  const [pending, setPending] = useState<ProductAlternative | null>(null);

  async function toggle() {
    if (open) {
      setOpen(false);
      setPending(null);
      return;
    }
    setOpen(true);
    setLoading(true);
    setAlternatives(await week.findProductAlternatives(dayIndex, ingredientId));
    setLoading(false);
  }

  async function confirm() {
    if (!pending) return;
    const replaced = await week.replaceProduct(dayIndex, ingredientId, pending.product.id);
    if (replaced) {
      setOpen(false);
      setPending(null);
      setAlternatives([]);
    }
  }

  return (
    <div className="product-alternative-control">
      <button
        className="text-action"
        type="button"
        onClick={toggle}
        aria-expanded={open}
        disabled={week.customizationBusy}
      >
        {open ? "Sluiten" : "Bekijk alternatief"}
      </button>
      {open ? (
        <div className="product-alternatives" role="region" aria-label={`Alternatieven voor ${currentProductName}`}>
          {loading ? (
            <p role="status">Geschikte producten worden gecontroleerd…</p>
          ) : alternatives.length === 0 ? (
            <p role="status">Geen betrouwbaar alternatief beschikbaar.</p>
          ) : (
            <ul>
              {alternatives.map((alternative) => (
                <li key={alternative.product.id}>
                  <button
                    type="button"
                    onClick={() => setPending(alternative)}
                    aria-pressed={pending?.product.id === alternative.product.id}
                  >
                    <strong>{alternative.product.name}</strong>
                    <span>
                      {alternative.product.packageText ?? "Verpakking"} · {alternative.packageCount}× · {formatCents(alternative.totalCostCents)}
                    </span>
                    <small>{differenceLabel(alternative.differenceCents)}</small>
                    {!alternative.withinMealBudget ? <small>Past niet binnen maaltijd-budget</small> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {pending ? (
            <div className="customization-confirm">
              <p>
                Vervang <strong>{currentProductName}</strong> door <strong>{pending.product.name}</strong>?
              </p>
              <div className="customization-confirm-actions">
                <button type="button" onClick={() => setPending(null)}>Annuleren</button>
                <button
                  className="primary-action compact-action"
                  type="button"
                  onClick={confirm}
                  disabled={!pending.withinMealBudget || week.customizationBusy}
                >
                  Bevestigen
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
