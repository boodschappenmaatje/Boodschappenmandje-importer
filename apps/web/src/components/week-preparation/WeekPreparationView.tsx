"use client";

import { useState, type FormEvent } from "react";

import { Icon } from "@/components/Icon";
import { DishImage } from "@/components/ui/DishImage";
import { NewWeekControl } from "@/components/week-preparation/NewWeekControl";
import {
  MealReplacementControl,
  ProductAlternativeControl,
} from "@/components/week-preparation/MealCustomizationControls";
import { useBudget } from "@/features/budget/BudgetProvider";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import {
  centsToDutchInput,
  formatCents,
  parseDutchEuroInput,
  parseDutchEuroInputAllowZero,
} from "@/services/budget/budget-engine";
import {
  budgetOutcomeLabel,
  missingPriceLabel,
} from "@/services/budget/budget-presentation";
import { safeProductImageUrl } from "@/services/catalog/catalog-presentation";
import { mealMixProfileForRecipe } from "@/services/week-preparation/meal-mix-profiles";
import { recipeImageFor } from "@/services/week-preparation/recipe-images";
import {
  MEAL_CATEGORY_LABELS,
  canPrepareWeek,
  distributionProgress,
} from "@/services/week-preparation/week-preparation";
import {
  calculateDishCostSummary,
  calculateWeekBudgetSummary,
  dayReadinessIssueCount,
} from "@/services/week-preparation/week-generation";
import {
  MEAL_CATEGORIES,
  type MealCategory,
  type WeekIngredientRequirement,
} from "@/types/week-preparation";

const PEOPLE_OPTIONS = Array.from({ length: 12 }, (_, index) => index + 1);
const DAY_OPTIONS = Array.from({ length: 7 }, (_, index) => index + 1);
const DAY_LABELS = [
  "Maandag",
  "Dinsdag",
  "Woensdag",
  "Donderdag",
  "Vrijdag",
  "Zaterdag",
  "Zondag",
] as const;

function listCountLabel(count: number): string {
  return `${count} ${count === 1 ? "product" : "producten"}`;
}

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

export function WeekPreparationView() {
  const budget = useBudget();
  const shoppingList = useActiveShoppingList();
  const week = useWeekPreparation();
  const [budgetDraft, setBudgetDraft] = useState<string | null>(null);
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [mealBudgetDraft, setMealBudgetDraft] = useState<string | null>(null);
  const [mealBudgetError, setMealBudgetError] = useState<string | null>(null);

  if (week.status === "loading" || budget.status === "loading") {
    return (
      <p className="week-preparation-loading" role="status">
        Je weekvoorbereiding wordt geopend…
      </p>
    );
  }

  if (week.status === "error") {
    return (
      <section className="dashboard-card week-storage-error" role="alert">
        <h2>Weekvoorbereiding niet beschikbaar</h2>
        <p>{week.persistenceWarning}</p>
        <p>Je bestaande boodschappenlijst en budget zijn niet gewijzigd.</p>
      </section>
    );
  }

  const itemCount = shoppingList.list?.items.length ?? 0;

  if (!week.preparation) {
    return (
      <section className="dashboard-card week-start-card" aria-labelledby="week-start-title">
        <div>
          <p className="card-eyebrow">Nieuwe voorbereiding</p>
          <h2 id="week-start-title">Bereid je boodschappenweek voor</h2>
        </div>
        <p>
          Je begint met je huishouden, dagen en verdeling. Je huidige lijst met{" "}
          {listCountLabel(itemCount)} blijft volledig staan.
        </p>
        <button className="primary-action" type="button" onClick={week.startPreparation}>
          Start weekvoorbereiding
        </button>
      </section>
    );
  }

  const preparation = week.preparation;
  const progress = distributionProgress(
    preparation.categoryDistribution,
    preparation.numberOfDays,
  );
  const displayedBudget =
    budgetDraft ??
    (budget.settings.budgetCents === null
      ? ""
      : centsToDutchInput(budget.settings.budgetCents));
  const displayedMealBudget =
    mealBudgetDraft ??
    (preparation.mealBudgetCents === null
      ? ""
      : centsToDutchInput(preparation.mealBudgetCents));
  const draftMealBudgetCents = parseDutchEuroInputAllowZero(displayedMealBudget);
  const liveNonMealReservedCents =
    budget.settings.budgetCents !== null &&
    draftMealBudgetCents !== null &&
    draftMealBudgetCents <= budget.settings.budgetCents
      ? budget.settings.budgetCents - draftMealBudgetCents
      : null;
  const ready = canPrepareWeek(preparation);
  const weekBudget = shoppingList.list
    ? calculateWeekBudgetSummary(preparation, shoppingList.list)
    : null;
  const budgetSelectionFailed =
    preparation.generation?.mealBudgetStatus === "noValidMealPlanWithinBudget";
  const categoryReadiness = new Map(
    (preparation.generation?.readinessByCategory ?? []).map((item) => [
      item.category,
      item,
    ]),
  );
  const incompleteDayIndexes = new Set(
    preparation.days
      .filter((day) => {
        if (day.freeChoice) return false;
        if (!day.recipeId) return true;
        const requiredIngredients = preparation.ingredients.filter(
          (ingredient) =>
            !ingredient.optional &&
            ingredient.usedIn.some((use) => use.dayIndex === day.dayIndex),
        );
        return (
          dayReadinessIssueCount(day.dayIndex, preparation.ingredients) > 0 ||
          (preparation.status === "generationPartial" && requiredIngredients.length === 0)
        );
      })
      .map((day) => day.dayIndex),
  );
  const incompleteDishCount = incompleteDayIndexes.size;
  const listCompletionBlocked =
    preparation.status !== "generated" ||
    incompleteDishCount > 0 ||
    !preparation.generation?.isMealBudgetComplete ||
    !["withinMealBudget", "exactlyMealBudget"].includes(
      preparation.generation?.mealBudgetStatus ?? "noMealBudget",
    );

  function saveBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseDutchEuroInput(displayedBudget);
    if (cents === null) {
      setBudgetError("Vul een geldig bedrag in, bijvoorbeeld 100 of 75,50.");
      return;
    }
    week.setBudgetCents(cents);
    setBudgetDraft(centsToDutchInput(cents));
    setBudgetError(null);
  }

  function saveMealBudget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cents = parseDutchEuroInputAllowZero(displayedMealBudget);
    if (cents === null) {
      setMealBudgetError("Vul een geldig bedrag in, bijvoorbeeld 50 of 45,50.");
      return;
    }
    if (budget.settings.budgetCents === null) {
      setMealBudgetError("Stel eerst je totale weekbudget in.");
      return;
    }
    if (cents > budget.settings.budgetCents) {
      setMealBudgetError("Het maaltijd-budget kan niet hoger zijn dan je weekbudget.");
      return;
    }
    week.setMealBudgetCents(cents);
    setMealBudgetDraft(centsToDutchInput(cents));
    setMealBudgetError(null);
  }

  const progressMessage =
    preparation.numberOfDays === null
      ? "Kies eerst het aantal dagen"
      : progress.state === "under"
        ? `Nog ${progress.difference} ${progress.difference === 1 ? "dag" : "dagen"} verdelen`
        : progress.state === "over"
          ? `${Math.abs(progress.difference)} ${Math.abs(progress.difference) === 1 ? "dag" : "dagen"} te veel gekozen`
          : "Alle dagen zijn verdeeld";

  return (
    <div className="week-preparation-flow">
      {week.persistenceWarning ? (
        <p className="catalog-notice" role="status">
          {week.persistenceWarning}
        </p>
      ) : null}

      {preparation.status !== "draft" ? (
        <section className="dashboard-card prepared-week-overview" aria-labelledby="prepared-week-title">
          <div className="dashboard-card-heading">
            <div>
              <p className="card-eyebrow">Deze week</p>
              <h2 id="prepared-week-title">
                {preparation.status === "generating"
                  ? "Je gerechten worden gekozen"
                  : preparation.status === "generationError"
                    ? "Gerechten kiezen lukte niet"
                    : "Je weekgerechten"}
              </h2>
            </div>
            <span className="card-status">
              {preparation.status === "generating"
                ? "Bezig"
                : preparation.status === "generationError"
                  ? "Probeer opnieuw"
                  : preparation.status === "readyForGeneration"
                    ? "Klaar om te kiezen"
                    : "Gerechten gekozen"}
            </span>
          </div>
          <p className="week-facts">
            {preparation.numberOfPeople} personen · {preparation.numberOfDays} dagen ·{" "}
            {budget.settings.budgetCents === null
              ? "geen budget"
              : `${formatCents(budget.settings.budgetCents)} budget`}
            {preparation.mealBudgetCents === null
              ? " · geen maaltijd-budget"
              : ` · max. ${formatCents(preparation.mealBudgetCents)} voor maaltijden`}
          </p>
          {preparation.status === "generating" || preparation.status === "readyForGeneration" ? (
            <p className="prepared-week-lead" role="status">
              Passende gerechten, hoeveelheden en echte Hoogvliet-producten worden klaargezet…
            </p>
          ) : preparation.status === "generationError" ? (
            <div className="week-generation-error" role="alert">
              <p>Je bestaande week, lijst en budget zijn niet gewijzigd.</p>
              <button type="button" onClick={week.retryGeneration}>
                Opnieuw proberen
              </button>
            </div>
          ) : (
            <>
              {preparation.generation?.mealBudgetStatus ===
              "noValidMealPlanWithinBudget" ? (
                <div className="week-generation-warning" role="status">
                  <p>
                    Met {formatCents(preparation.mealBudgetCents ?? 0)} is er op dit
                    moment geen complete maaltijdweek beschikbaar voor deze verdeling.
                  </p>
                  {preparation.generation.lowestCompleteMealPlanCostCents !== null &&
                  preparation.generation.lowestCompleteMealPlanCostCents !== undefined ? (
                    preparation.generation.lowestCompleteMealPlanCostReliable ? (
                      <>
                        <p>
                          Voor deze week is minimaal ongeveer {formatCents(preparation.generation.lowestCompleteMealPlanCostCents)} nodig.
                        </p>
                        <p>
                          Verhoog je maaltijd-budget met {formatCents(Math.max(0, preparation.generation.lowestCompleteMealPlanCostCents - (preparation.mealBudgetCents ?? 0)))} of pas je weekverdeling aan.
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          De goedkoopste complete combinatie die we hebben doorgerekend kost {formatCents(preparation.generation.lowestCompleteMealPlanCostCents)}.
                        </p>
                        <p>
                          Met {formatCents(Math.max(0, preparation.generation.lowestCompleteMealPlanCostCents - (preparation.mealBudgetCents ?? 0)))} meer kan deze combinatie wel worden gepland. Mogelijk is een andere combinatie nog voordeliger.
                        </p>
                      </>
                    )
                  ) : (
                    <p>
                      Verhoog het maaltijd-budget, pas je weekverdeling aan of kies minder dagen.
                    </p>
                  )}
                </div>
              ) : preparation.generation?.mealBudgetStatus === "overMealBudget" ? (
                <div className="week-generation-warning" role="status">
                  <p>Je huidige maaltijden passen niet meer binnen je maaltijd-budget.</p>
                  <p>Je opgeslagen gerechten zijn niet automatisch vervangen.</p>
                </div>
              ) : null}
              {preparation.generation &&
              (preparation.generation.missingProductMatchCount > 0 ||
                preparation.generation.missingPackageCalculationCount > 0 ||
                preparation.generation.missingPriceCount > 0) ? (
                <div className="week-generation-warning" role="status">
                  {preparation.generation.missingProductMatchCount > 0 ? (
                    <p>
                      {preparation.generation.missingProductMatchCount}{" "}
                      {preparation.generation.missingProductMatchCount === 1
                        ? "product konden we"
                        : "producten konden we"}{" "}
                      nog niet vinden.
                    </p>
                  ) : null}
                  {preparation.generation.missingPriceCount > 0 ? (
                    <p>
                      Voor {preparation.generation.missingPriceCount}{" "}
                      {preparation.generation.missingPriceCount === 1
                        ? "product ontbreekt"
                        : "producten ontbreken"}{" "}
                      nog een bruikbare prijs.
                    </p>
                  ) : null}
                  {preparation.generation.missingPackageCalculationCount > 0 ? (
                    <p>
                      Bij {preparation.generation.missingPackageCalculationCount}{" "}
                      {preparation.generation.missingPackageCalculationCount === 1
                        ? "product is het aantal"
                        : "producten is het aantal"}{" "}
                      nog niet zeker.
                    </p>
                  ) : null}
                  <button type="button" onClick={week.retryGeneration}>
                    Nogmaals zoeken
                  </button>
                </div>
              ) : null}

              <ol className="prepared-days recipe-days">
                {preparation.days.map((day) => {
                  const readiness =
                    day.category === "freeChoice"
                      ? undefined
                      : categoryReadiness.get(day.category);
                  const dayIngredients = day.recipeId
                    ? preparation.ingredients.filter((ingredient) =>
                        ingredient.usedIn.some((use) => use.dayIndex === day.dayIndex),
                      )
                    : [];
                  const mealMix = day.recipe
                    ? mealMixProfileForRecipe(day.recipe.sourceKey)
                    : null;
                  const dishCost = calculateDishCostSummary(
                    day.dayIndex,
                    preparation.ingredients,
                  );
                  const dishTitle = mealMix?.dishName ?? day.recipe?.name ?? "Gerecht";
                  const dishImage = recipeImageFor(
                    day.recipe && day.category !== "freeChoice"
                      ? {
                          recipeSourceKey: day.recipe.sourceKey,
                          recipeName: dishTitle,
                          categories: [day.category],
                          ingredients: dayIngredients.map((ingredient) => ({
                            sourceKey: ingredient.sourceKey,
                            name: ingredient.name,
                            optional: ingredient.optional,
                          })),
                        }
                      : null,
                  );
                  const dishNeedsReview = incompleteDayIndexes.has(day.dayIndex);
                  const customization = preparation.customizations.find(
                    (item) => item.dayIndex === day.dayIndex,
                  );
                  const ingredientOptions = dayIngredients.map((ingredient) => ({
                    ingredientId: ingredient.ingredientId,
                    name: ingredient.name,
                    productName: ingredient.product?.name ?? "Nog geen product",
                  }));
                  return (
                    <li key={day.dayIndex}>
                      <label className="prepared-day-category" htmlFor={`prepared-day-${day.dayIndex}`}>
                        <span>{DAY_LABELS[day.dayIndex]}</span>
                        <select
                          id={`prepared-day-${day.dayIndex}`}
                          value={day.category}
                          onChange={(event) =>
                            week.changeDayCategory(
                              day.dayIndex,
                              event.target.value as MealCategory,
                            )
                          }
                        >
                          {MEAL_CATEGORIES.map((category) => (
                            <option key={category} value={category}>
                              {MEAL_CATEGORY_LABELS[category]}
                            </option>
                          ))}
                        </select>
                      </label>
                      {day.freeChoice ? (
                        <p className="free-choice-copy">Vrije keuze — kies later zelf een gerecht</p>
                      ) : day.recipe ? (
                        <div className="recipe-day-entry">
                          {dishNeedsReview ? (
                            <p className="recipe-readiness-notice" role="status">
                              Dit gerecht is niet meer compleet beschikbaar. Controleer het gerecht opnieuw.
                            </p>
                          ) : null}
                          <details className="recipe-detail" data-ready={!dishNeedsReview}>
                            <summary>
                              <span className="recipe-summary-visual">
                                <DishImage
                                  asset={dishImage}
                                  className="recipe-summary-image"
                                  sizes="58px"
                                  title={dishTitle}
                                />
                                <span className="recipe-summary-title">
                                  <strong>{dishTitle}</strong>
                                  {customization ? <small className="customized-badge">Aangepast</small> : null}
                                  {mealMix ? <small>met {mealMix.brand} Wereldgerechten</small> : null}
                                </span>
                              </span>
                              <span className="recipe-summary-action">
                                <strong>
                                  {dishCost.knownCostCents > 0
                                    ? `${formatCents(dishCost.knownCostCents)}${dishCost.complete ? "" : " bekend"}`
                                    : "Nog niet bekend"}
                                </strong>
                                <small>Bekijk gerecht</small>
                              </span>
                            </summary>
                            <div className="recipe-detail-content">
                            <DishImage
                              asset={dishImage}
                              className="recipe-detail-hero"
                              sizes="(max-width: 560px) calc(100vw - 60px), 500px"
                              title={dishTitle}
                            />
                            <p>
                              {MEAL_CATEGORY_LABELS[day.category]} · {preparation.numberOfPeople} personen
                            </p>
                            <p className="recipe-cost-summary" data-complete={dishCost.complete}>
                              {dishCost.complete
                                ? `Geschatte kosten gerecht: ${formatCents(dishCost.knownCostCents)}`
                                : `${formatCents(dishCost.knownCostCents)} bekend · nog ${dishCost.missingProductCount} ${dishCost.missingProductCount === 1 ? "product" : "producten"} niet compleet`}
                            </p>
                            {!dishNeedsReview ? (
                              <MealReplacementControl
                                dayIndex={day.dayIndex}
                                currentRecipeName={dishTitle}
                                ingredients={ingredientOptions}
                              />
                            ) : null}
                            <ul className="recipe-ingredients">
                              {dayIngredients.map((ingredient) => {
                                const use = ingredient.usedIn.find(
                                  (item) => item.dayIndex === day.dayIndex,
                                );
                                const requiredQuantity =
                                  use?.requiredQuantity ?? ingredient.requiredQuantity;
                                const packages = packagesForDay(
                                  ingredient,
                                  day.dayIndex,
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
                                        {ingredient.price && packages !== null ? (
                                          <ProductAlternativeControl
                                            dayIndex={day.dayIndex}
                                            ingredientId={ingredient.ingredientId}
                                            currentProductName={ingredient.product.name}
                                            ingredients={ingredientOptions}
                                          />
                                        ) : null}
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
                            </ul>
                            </div>
                          </details>
                        </div>
                      ) : (
                        <p className="shopping-item-price-missing">
                          {budgetSelectionFailed && (readiness?.readyCount ?? 1) > 0
                            ? "Er zijn complete gerechten beschikbaar, maar deze week past nog niet binnen je maaltijd-budget."
                            : readiness && readiness.readyCount > 0
                              ? "Voor deze categorie zijn complete gerechten beschikbaar. De week is nog niet volledig samengesteld."
                            : "Op dit moment is er geen compleet gerecht beschikbaar voor deze categorie."}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ol>

              {weekBudget ? (
                <div className="week-cost-overview" aria-label="Weekkosten en budget">
                  <div><span>Weekbudget</span><strong>{weekBudget.budgetCents === null ? "Niet ingesteld" : formatCents(weekBudget.budgetCents)}</strong></div>
                  <div><span>Maaltijd-budget</span><strong>{preparation.mealBudgetCents === null ? "Niet ingesteld" : `max. ${formatCents(preparation.mealBudgetCents)}`}</strong></div>
                  <div>
                    <span>Geplande maaltijden</span>
                    <strong>
                      {budgetSelectionFailed
                        ? "Nog niet gepland"
                        : formatCents(preparation.generation?.mealPlanKnownCostCents ?? 0)}
                    </strong>
                  </div>
                  {budgetSelectionFailed &&
                  preparation.generation?.lowestCompleteMealPlanCostCents !== null &&
                  preparation.generation?.lowestCompleteMealPlanCostCents !== undefined ? (
                    <div>
                      <span>
                        {preparation.generation.lowestCompleteMealPlanCostReliable
                          ? "Minimaal nodig"
                          : "Goedkoopste doorgerekend"}
                      </span>
                      <strong>{formatCents(preparation.generation.lowestCompleteMealPlanCostCents)}</strong>
                    </div>
                  ) : null}
                  <div>
                    <span>Over binnen maaltijd-budget</span>
                    <strong>
                      {preparation.generation?.mealBudgetRemainingCents !== null &&
                      preparation.generation?.mealBudgetRemainingCents !== undefined
                        ? formatCents(preparation.generation.mealBudgetRemainingCents)
                        : "Nog niet definitief"}
                    </strong>
                  </div>
                  <div><span>Minimaal voor overige boodschappen</span><strong>{preparation.generation?.nonMealReservedCents === null || preparation.generation?.nonMealReservedCents === undefined ? "Niet ingesteld" : formatCents(preparation.generation.nonMealReservedCents)}</strong></div>
                  <div className="week-cost-total"><span>Bestaande lijst</span><strong>{formatCents(weekBudget.existingListKnownSubtotalCents)}</strong></div>
                  <div><span>Nieuwe boodschappen</span><strong>{formatCents(weekBudget.newKnownCostCents)}</strong></div>
                  <div><span>Bekend totaal</span><strong>{formatCents(weekBudget.knownTotalCents)}</strong></div>
                  <div>
                    <span>Budgetruimte</span>
                    <strong>
                      {weekBudget.overBudgetCents > 0 && weekBudget.isComplete
                        ? `${formatCents(weekBudget.overBudgetCents)} boven budget`
                        : weekBudget.overBudgetCents > 0
                          ? `Minimaal ${formatCents(weekBudget.overBudgetCents)} boven budget`
                        : weekBudget.remainingCents !== null
                          ? `${formatCents(weekBudget.remainingCents)} over`
                          : "Nog niet definitief"}
                    </strong>
                  </div>
                  {!weekBudget.isComplete ? (
                    <p>
                      {weekBudget.overBudgetCents > 0
                        ? "Enkele producten zijn nog niet compleet bekend; het uiteindelijke bedrag kan hoger worden."
                        : "Ontbrekende matches of prijzen worden niet als € 0 meegerekend."}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <button
                className="primary-action"
                type="button"
                onClick={week.completeShoppingList}
                disabled={listCompletionBlocked}
                aria-describedby={listCompletionBlocked ? "list-completion-readiness" : undefined}
              >
                Maak mijn lijst compleet
              </button>
              {listCompletionBlocked ? (
                <p id="list-completion-readiness" className="week-list-readiness" role="status">
                  {preparation.generation?.mealBudgetStatus === "noValidMealPlanWithinBudget"
                    ? "Er is nog geen complete maaltijdweek binnen dit budget."
                    : incompleteDishCount > 0
                      ? `Controleer eerst ${incompleteDishCount} ${incompleteDishCount === 1 ? "onvolledig gerecht" : "onvolledige gerechten"}.`
                      : preparation.generation?.mealBudgetStatus === "overMealBudget"
                      ? "Je huidige maaltijden passen niet binnen je maaltijd-budget."
                      : "Wacht tot alle gerechten en het maaltijd-budget compleet zijn gecontroleerd."}
                </p>
              ) : null}
              {week.actionMessage ? <p className="week-action-message" role="status">{week.actionMessage}</p> : null}
            </>
          )}
        </section>
      ) : null}

      <section className="dashboard-card current-list-context" aria-labelledby="current-list-title">
        <div className="dashboard-card-heading">
          <div>
            <p className="card-eyebrow">Blijft behouden</p>
            <h2 id="current-list-title">Je huidige boodschappenlijst</h2>
          </div>
          <strong>{listCountLabel(itemCount)}</strong>
        </div>
        <div className="current-list-amount">
          <span>Bekend totaal</span>
          <strong>{formatCents(budget.result.knownSubtotalCents)}</strong>
        </div>
        {budget.result.unpricedItemCount > 0 ? (
          <p className="week-budget-warning" role="status">
            {missingPriceLabel(budget.result.unpricedItemCount)}. Beschikbare budgetruimte is daarom nog niet definitief.
          </p>
        ) : budget.result.budgetCents === null ? (
          <p className="week-budget-note">Stel een budget in om je beschikbare ruimte te zien.</p>
        ) : (
          <p className="week-budget-space">
            Nog beschikbaar voor je week: <strong>{budgetOutcomeLabel(budget.result)}</strong>
          </p>
        )}
      </section>

      <section className="dashboard-card week-basics" aria-labelledby="week-basics-title">
        <div>
          <p className="card-eyebrow">Stap 1</p>
          <h2 id="week-basics-title">Huishouden en budget</h2>
        </div>
        <div className="week-basic-fields">
          <label>
            <span>Personen</span>
            <select
              value={budget.settings.people ?? ""}
              onChange={(event) =>
                week.setNumberOfPeople(
                  event.target.value ? Number(event.target.value) : null,
                )
              }
            >
              <option value="">Kies</option>
              {PEOPLE_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label>
            <span>Dagen</span>
            <select
              value={budget.settings.days ?? ""}
              onChange={(event) =>
                week.setNumberOfDays(
                  event.target.value ? Number(event.target.value) : null,
                )
              }
            >
              <option value="">Kies</option>
              {DAY_OPTIONS.map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
        <form className="week-budget-form" onSubmit={saveBudget}>
          <label htmlFor="week-preparation-budget">Weekbudget in euro&apos;s</label>
          <div className="budget-input-row">
            <span aria-hidden="true">€</span>
            <input
              id="week-preparation-budget"
              inputMode="decimal"
              autoComplete="off"
              placeholder="100,00"
              value={displayedBudget}
              onChange={(event) => {
                setBudgetDraft(event.target.value);
                setBudgetError(null);
              }}
              aria-invalid={budgetError ? "true" : "false"}
              aria-describedby={budgetError ? "week-budget-error" : undefined}
            />
            <button type="submit">Bewaren</button>
          </div>
          {budgetError ? (
            <p id="week-budget-error" className="budget-input-error" role="alert">
              {budgetError}
            </p>
          ) : (
            <p className="budget-input-help">Dit is hetzelfde budget als op Budget.</p>
          )}
        </form>
        <form className="week-budget-form meal-budget-form" onSubmit={saveMealBudget}>
          <label htmlFor="week-preparation-meal-budget">
            Maximaal voor avondmaaltijden
          </label>
          <div className="budget-input-row">
            <span aria-hidden="true">€</span>
            <input
              id="week-preparation-meal-budget"
              inputMode="decimal"
              autoComplete="off"
              placeholder="50,00"
              value={displayedMealBudget}
              onChange={(event) => {
                setMealBudgetDraft(event.target.value);
                setMealBudgetError(null);
              }}
              aria-invalid={mealBudgetError ? "true" : "false"}
              aria-describedby={
                mealBudgetError
                  ? "meal-budget-error"
                  : "meal-budget-help"
              }
            />
            <button type="submit">Bewaren</button>
          </div>
          {mealBudgetError ? (
            <p id="meal-budget-error" className="budget-input-error" role="alert">
              {mealBudgetError}
            </p>
          ) : (
            <p id="meal-budget-help" className="budget-input-help">
              Zo houd je ruimte over voor brood, drinken, fruit en andere boodschappen.
              {liveNonMealReservedCents !== null
                ? ` ${formatCents(liveNonMealReservedCents)} blijft minimaal voor overige boodschappen.`
                : ""}
            </p>
          )}
        </form>
      </section>

      <section className="dashboard-card week-preferences" aria-labelledby="week-preferences-title">
        <div>
          <p className="card-eyebrow">Voorkeuren</p>
          <h2 id="week-preferences-title">Wat is belangrijk?</h2>
        </div>
        <div className="preference-list">
          <label>
            <input
              type="checkbox"
              checked={preparation.preferences.noVegetarian}
              onChange={(event) => week.setPreference("noVegetarian", event.target.checked)}
            />
            <span><strong>Geen vegetarische gerechten</strong><small>Vegetarisch wordt niet automatisch voorgesteld; bewust kiezen blijft mogelijk.</small></span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={preparation.preferences.quickImportant}
              onChange={(event) => week.setPreference("quickImportant", event.target.checked)}
            />
            <span><strong>Eenvoudig en snel belangrijk</strong></span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={preparation.preferences.healthyImportant}
              onChange={(event) => week.setPreference("healthyImportant", event.target.checked)}
            />
            <span><strong>Gezond belangrijk</strong></span>
          </label>
          <label>
            <input
              type="checkbox"
              checked={preparation.preferences.budgetImportant}
              onChange={(event) => week.setPreference("budgetImportant", event.target.checked)}
            />
            <span><strong>Budget belangrijk</strong></span>
          </label>
        </div>
      </section>

      <section className="dashboard-card week-distribution" aria-labelledby="week-distribution-title">
        <div className="dashboard-card-heading">
          <div>
            <p className="card-eyebrow">Stap 2</p>
            <h2 id="week-distribution-title">Verdeel je week</h2>
          </div>
          <strong aria-label={`${progress.assignedDays} van ${progress.targetDays} dagen verdeeld`}>
            {progress.assignedDays} / {progress.targetDays}
          </strong>
        </div>
        <div className="category-steppers">
          {MEAL_CATEGORIES.map((category) => {
            const count = preparation.categoryDistribution[category];
            return (
              <div className="category-stepper" key={category}>
                <span>{MEAL_CATEGORY_LABELS[category]}</span>
                <div role="group" aria-label={`${MEAL_CATEGORY_LABELS[category]} dagen`}>
                  <button
                    type="button"
                    aria-label={`${MEAL_CATEGORY_LABELS[category]} verlagen`}
                    disabled={count === 0}
                    onClick={() => week.adjustCategory(category, -1)}
                  >−</button>
                  <output aria-live="polite">{count}</output>
                  <button
                    type="button"
                    aria-label={`${MEAL_CATEGORY_LABELS[category]} verhogen`}
                    disabled={count === 7}
                    onClick={() => week.adjustCategory(category, 1)}
                  >+</button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="distribution-progress" data-state={progress.state} role="status">
          <progress
            aria-label="Voortgang verdeling van je week"
            max={preparation.numberOfDays ?? 1}
            value={Math.min(
              progress.assignedDays,
              preparation.numberOfDays ?? 0,
            )}
          />
          <strong>{progressMessage}</strong>
        </div>
        <button
          className="primary-action"
          type="button"
          disabled={!ready}
          onClick={week.confirmPreparation}
        >
          Week voorbereiden
        </button>
        {!ready && progress.state === "exact" ? (
          <p className="week-required-note" role="status">
            Kies personen, dagen, een weekbudget en een maaltijd-budget om verder te gaan.
          </p>
        ) : null}
      </section>

      <NewWeekControl
        onStartNew={async () => {
          await week.startNewPreparation();
          setBudgetDraft(null);
          setMealBudgetDraft(null);
        }}
      />
    </div>
  );
}
