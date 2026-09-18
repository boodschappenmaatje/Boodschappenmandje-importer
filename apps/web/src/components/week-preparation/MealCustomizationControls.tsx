"use client";

import { useEffect, useMemo, useState } from "react";

import { CatalogSearchField } from "@/components/catalog/CatalogSearchField";
import { Icon } from "@/components/Icon";
import { DishImage } from "@/components/ui/DishImage";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { euroAmountToCents, formatCents } from "@/services/budget/budget-engine";
import { safeProductImageUrl } from "@/services/catalog/catalog-presentation";
import { resolveCurrentPrice } from "@/services/catalog/price";
import type {
  ManualProductAction,
  ManualProductChoice,
  ManualProductChoicePreview,
  ProductAlternative,
  RecipeAlternative,
} from "@/services/week-preparation/meal-customization";
import { recipeImageFor } from "@/services/week-preparation/recipe-images";
import type { Product } from "@/types/catalog";

const SEARCH_DELAY_MS = 325;
const INITIAL_ALTERNATIVE_COUNT = 3;

function signedDifference(cents: number): string {
  if (cents === 0) return "Zelfde prijs";
  return `${cents > 0 ? "+ " : "− "}${formatCents(Math.abs(cents))}`;
}

function differenceSentence(cents: number): string {
  if (cents === 0) return "De maaltijdkosten blijven gelijk.";
  return `Met deze keuze worden je maaltijden ${formatCents(Math.abs(cents))} ${cents < 0 ? "goedkoper" : "duurder"}.`;
}

export interface MealIngredientOption {
  ingredientId: string;
  name: string;
  productName: string;
}

function ProductImage({ product }: { product: Product }) {
  const imageUrl = safeProductImageUrl(product.imageUrl);
  return (
    <span
      className="manual-product-image"
      data-has-image={Boolean(imageUrl)}
      style={imageUrl ? { backgroundImage: `url(${JSON.stringify(imageUrl)})` } : undefined}
      role="img"
      aria-label={imageUrl ? `Afbeelding van ${product.name}` : "Geen productafbeelding"}
    >
      {!imageUrl ? <Icon name="products" size={20} /> : null}
    </span>
  );
}

function ManualProductFlow({
  dayIndex,
  ingredients,
  fixedIngredientId = null,
  onClose,
}: {
  dayIndex: number;
  ingredients: MealIngredientOption[];
  fixedIngredientId?: string | null;
  onClose: () => void;
}) {
  const week = useWeekPreparation();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  const [searchState, setSearchState] = useState<"prompt" | "searching" | "loaded" | "error">("prompt");
  const [selected, setSelected] = useState<Product | null>(null);
  const [action, setAction] = useState<ManualProductAction | null>(
    fixedIngredientId ? "replaceIngredient" : null,
  );
  const [ingredientId, setIngredientId] = useState<string | null>(fixedIngredientId);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) return;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => {
      setSearchState("searching");
      void week.searchCatalogProducts(term, controller.signal)
        .then((found) => {
          setProducts(found);
          setSearchState("loaded");
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === "AbortError") return;
          setSearchState("error");
        });
    }, SEARCH_DELAY_MS);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, week]);

  const choice = useMemo<ManualProductChoice | null>(() => {
    if (!selected || !action || (action === "replaceIngredient" && !ingredientId)) return null;
    return {
      action,
      dayIndex,
      ingredientId: action === "replaceIngredient" ? ingredientId : null,
      productId: selected.id,
      quantity,
      selectionSource: "manualSearch",
    };
  }, [action, dayIndex, ingredientId, quantity, selected]);
  const preview = useMemo(
    () => choice && selected ? week.previewManualProduct(choice, selected) : null,
    [choice, selected, week],
  );

  async function confirm() {
    if (!choice || !preview?.ok) return;
    const applied = await week.applyManualProduct(
      choice,
      preview.preview.impact,
      preview.preview.impact.requiresBudgetOverride,
    );
    if (applied.applied) {
      onClose();
    } else if (applied.revalidatedPreview) {
      setSelected(applied.revalidatedPreview.product);
    }
  }

  return (
    <div className="manual-product-flow" role="region" aria-label="Zelf product zoeken">
      <div className="manual-flow-heading">
        <strong>{fixedIngredientId ? "Ingrediënt vervangen" : "Product toevoegen of vervangen"}</strong>
        <button type="button" className="text-action" onClick={onClose}>Annuleren</button>
      </div>
      {!selected ? (
        <>
          <div className="manual-product-search">
            <span>Zoek in de actuele Hoogvliet-catalogus</span>
            <CatalogSearchField
              className="manual-catalog-search-field"
              value={query}
              placeholder="Bijvoorbeeld boomstam"
              ariaLabel="Zoek producten op naam, merk, verpakking of categorie"
              autoFocus
              onChange={(event) => {
                const value = event.target.value;
                setQuery(value);
                if (value.trim().length < 2) {
                  setProducts([]);
                  setSearchState("prompt");
                }
              }}
              onClear={() => {
                setQuery("");
                setProducts([]);
                setSearchState("prompt");
              }}
            />
          </div>
          {searchState === "prompt" ? <p role="status">Typ minimaal 2 tekens.</p> : null}
          {searchState === "searching" ? <p role="status">Actuele producten zoeken…</p> : null}
          {searchState === "error" ? <p role="status">Zoeken lukt nu niet. Probeer het opnieuw.</p> : null}
          {searchState === "loaded" && products.length === 0 ? <p role="status">Geen producten gevonden.</p> : null}
          {products.length > 0 ? (
            <ul className="compact-product-list" aria-label="Zoekresultaten">
              {products.map((product) => {
                const price = resolveCurrentPrice(product.currentPrice);
                return (
                  <li key={product.id}>
                    <button type="button" disabled={!price} onClick={() => setSelected(product)}>
                      <ProductImage product={product} />
                      <span><strong>{product.name}</strong><small>{product.packageText ?? "Verpakking niet vermeld"}</small></span>
                      <strong>{price ? formatCents(euroAmountToCents(price.amount) ?? 0) : "Geen prijs"}</strong>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </>
      ) : (
        <>
          <div className="selected-manual-product">
            <ProductImage product={selected} />
            <span><strong>{selected.name}</strong><small>{selected.packageText ?? "1 verpakking"}</small></span>
            <button type="button" className="text-action" onClick={() => setSelected(null)}>Wijzig</button>
          </div>
          {!fixedIngredientId && !action ? (
            <fieldset className="manual-action-choice">
              <legend>Wat wil je doen met {selected.name}?</legend>
              <button type="button" onClick={() => setAction("replaceIngredient")}>Bestaand ingrediënt vervangen</button>
              <button type="button" onClick={() => setAction("addToMeal")}>Toevoegen aan dit gerecht</button>
            </fieldset>
          ) : null}
          {action === "replaceIngredient" && !ingredientId ? (
            <fieldset className="manual-action-choice">
              <legend>Welk ingrediënt wil je vervangen?</legend>
              {ingredients.map((ingredient) => (
                <button key={ingredient.ingredientId} type="button" onClick={() => setIngredientId(ingredient.ingredientId)}>
                  <strong>{ingredient.name}</strong><small>{ingredient.productName}</small>
                </button>
              ))}
            </fieldset>
          ) : null}
          {action && (action === "addToMeal" || ingredientId) ? (
            <>
              <label className="manual-quantity">
                <span>Hoeveelheid</span>
                <span>
                  <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} aria-label="Eén verpakking minder">−</button>
                  <strong>{quantity} {quantity === 1 ? "verpakking" : "verpakkingen"}</strong>
                  <button type="button" onClick={() => setQuantity((value) => Math.min(99, value + 1))} aria-label="Eén verpakking meer">+</button>
                </span>
              </label>
              {preview?.ok ? (
                <div className="customization-confirm" role={preview.preview.impact.requiresBudgetOverride ? "alert" : "status"}>
                  <strong>{action === "replaceIngredient" ? `${preview.preview.currentIngredientName} → ${selected.name}` : `${selected.name} toevoegen`}</strong>
                  <p>{differenceSentence(preview.preview.impact.mealPlanDifferenceCents)}</p>
                  <p>Nieuwe maaltijdkosten: {formatCents(preview.preview.impact.nextMealPlanCostCents)}{preview.preview.impact.mealBudgetCents === null ? "" : ` / ${formatCents(preview.preview.impact.mealBudgetCents)}`}</p>
                  {preview.preview.impact.mealBudgetOverageCents > 0 ? (
                    <p className="budget-impact-warning"><strong>Let op:</strong> je komt {formatCents(preview.preview.impact.mealBudgetOverageCents)} boven je maaltijd-budget.</p>
                  ) : preview.preview.impact.mealBudgetCents !== null ? <p>Blijft binnen je maaltijd-budget.</p> : null}
                  {preview.preview.impact.weekBudgetOverageCents > 0 ? (
                    <p className="budget-impact-warning">Hierdoor kom je ook {formatCents(preview.preview.impact.weekBudgetOverageCents)} boven je totale weekbudget.</p>
                  ) : preview.preview.impact.weekBudgetRemainingCents !== null ? <p>Je totale weekbudget blijft nog {formatCents(preview.preview.impact.weekBudgetRemainingCents)} onder de grens.</p> : null}
                  <div className="customization-confirm-actions">
                    <button type="button" onClick={onClose} disabled={week.customizationBusy}>Annuleren</button>
                    <button className="primary-action compact-action" type="button" onClick={confirm} disabled={week.customizationBusy}>
                      {week.customizationBusy ? "Controleren…" : preview.preview.impact.requiresBudgetOverride ? "Toch gebruiken" : "Gebruiken"}
                    </button>
                  </div>
                </div>
              ) : preview && !preview.ok ? <p role="status">Deze keuze kan niet met een actuele prijs worden bevestigd.</p> : null}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

interface MealReplacementControlProps {
  dayIndex: number;
  currentRecipeName: string;
  ingredients: MealIngredientOption[];
}

export function MealReplacementControl({ dayIndex, currentRecipeName, ingredients }: MealReplacementControlProps) {
  const week = useWeekPreparation();
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [alternatives, setAlternatives] = useState<RecipeAlternative[]>([]);
  const [pending, setPending] = useState<RecipeAlternative | null>(null);

  async function toggle() {
    if (open) { setOpen(false); setPending(null); return; }
    setManualOpen(false); setOpen(true); setLoading(true);
    setAlternatives(await week.findRecipeAlternatives(dayIndex));
    setLoading(false);
  }
  async function confirm() {
    if (!pending) return;
    const result = await week.applyExplicitRecipe(
      dayIndex,
      pending.recipe.id,
      pending.impact,
      pending.impact.requiresBudgetOverride,
    );
    if (result.applied) {
      setOpen(false); setPending(null); setAlternatives([]);
    } else if (result.revalidatedPreview) {
      setPending(result.revalidatedPreview.alternative);
    }
  }

  return (
    <section className="meal-customization" aria-label="Gerecht aanpassen">
      <div className="meal-customization-actions">
        <button className="secondary-action compact-action" type="button" onClick={toggle} aria-expanded={open} disabled={week.customizationBusy}>Vervang gerecht</button>
        <button className="secondary-action compact-action" type="button" onClick={() => { setOpen(false); setManualOpen((value) => !value); }} aria-expanded={manualOpen} disabled={week.customizationBusy}>+ Voeg toe</button>
      </div>
      {manualOpen ? <ManualProductFlow dayIndex={dayIndex} ingredients={ingredients} onClose={() => setManualOpen(false)} /> : null}
      {open ? (
        <div className="meal-alternatives" role="region" aria-label="Geschikte alternatieven">
          {loading ? <p role="status">Complete alternatieven en actuele prijzen controleren…</p> : alternatives.length === 0 ? <p role="status">Geen ander compleet gerecht in deze categorie.</p> : (
            <>
              <ul>
                {alternatives.slice(0, showAll ? alternatives.length : INITIAL_ALTERNATIVE_COUNT).map((alternative) => {
                  const image = recipeImageFor({ recipeSourceKey: alternative.recipe.sourceKey, recipeName: alternative.recipe.name, categories: [alternative.category], ingredients: [] });
                  return (
                    <li key={alternative.recipe.id}>
                      <button type="button" className="meal-alternative-card" onClick={() => setPending(alternative)} aria-pressed={pending?.recipe.id === alternative.recipe.id}>
                        <DishImage asset={image} className="meal-alternative-image" sizes="52px" title={alternative.recipe.name} />
                        <span><strong>{alternative.recipe.name}</strong><small>{formatCents(alternative.alternativeDishCostCents)} · {signedDifference(alternative.differenceCents)}</small></span>
                        <small>{alternative.withinMealBudget ? "Binnen budget" : "Boven budget"}</small>
                      </button>
                    </li>
                  );
                })}
              </ul>
              {!showAll && alternatives.length > INITIAL_ALTERNATIVE_COUNT ? <button type="button" className="text-action" onClick={() => setShowAll(true)}>Meer alternatieven</button> : null}
            </>
          )}
          {pending ? (
            <div className="customization-confirm" role="alert">
              <strong>{currentRecipeName} → {pending.recipe.name}</strong>
              <p>{differenceSentence(pending.differenceCents)}</p>
              <p>Nieuwe maaltijdkosten: {formatCents(pending.nextMealPlanCostCents)}{pending.mealBudgetCents === null ? "" : ` / ${formatCents(pending.mealBudgetCents)}`}</p>
              {pending.impact.mealBudgetOverageCents > 0 ? <p className="budget-impact-warning"><strong>Let op:</strong> je komt {formatCents(pending.impact.mealBudgetOverageCents)} boven je maaltijd-budget.</p> : null}
              {pending.impact.weekBudgetOverageCents > 0 ? <p className="budget-impact-warning">Hierdoor kom je ook {formatCents(pending.impact.weekBudgetOverageCents)} boven je totale weekbudget.</p> : pending.impact.weekBudgetRemainingCents !== null ? <p>Je totale weekbudget blijft nog {formatCents(pending.impact.weekBudgetRemainingCents)} onder de grens.</p> : null}
              <div className="customization-confirm-actions"><button type="button" onClick={() => setPending(null)} disabled={week.customizationBusy}>Annuleren</button><button className="primary-action compact-action" type="button" onClick={confirm} disabled={week.customizationBusy}>{pending.impact.requiresBudgetOverride ? "Toch gebruiken" : "Bevestig vervanging"}</button></div>
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
  ingredients: MealIngredientOption[];
}

export function ProductAlternativeControl({ dayIndex, ingredientId, currentProductName, ingredients }: ProductAlternativeControlProps) {
  const week = useWeekPreparation();
  const [open, setOpen] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [alternatives, setAlternatives] = useState<ProductAlternative[]>([]);
  const [pending, setPending] = useState<ProductAlternative | null>(null);
  const [revalidatedPreview, setRevalidatedPreview] = useState<ManualProductChoicePreview | null>(null);

  const pendingChoice = useMemo<ManualProductChoice | null>(() => pending ? {
    action: "replaceIngredient",
    dayIndex,
    ingredientId,
    productId: pending.product.id,
    quantity: pending.packageCount,
    selectionSource: "automaticSuggestion",
  } : null, [dayIndex, ingredientId, pending]);
  const pendingPreviewResult = useMemo(
    () => pending && pendingChoice
      ? week.previewManualProduct(pendingChoice, pending.product)
      : null,
    [pending, pendingChoice, week],
  );
  const pendingPreview = revalidatedPreview ??
    (pendingPreviewResult?.ok ? pendingPreviewResult.preview : null);

  async function toggle() {
    if (open) { setOpen(false); setPending(null); setRevalidatedPreview(null); return; }
    setOpen(true); setLoading(true);
    setAlternatives(await week.findProductAlternatives(dayIndex, ingredientId));
    setLoading(false);
  }
  async function confirm() {
    if (!pendingChoice || !pendingPreview) return;
    const result = await week.applyManualProduct(
      pendingChoice,
      pendingPreview.impact,
      pendingPreview.impact.requiresBudgetOverride,
    );
    if (result.applied) {
      setOpen(false); setPending(null); setAlternatives([]);
      setRevalidatedPreview(null);
    } else if (result.revalidatedPreview) {
      setRevalidatedPreview(result.revalidatedPreview);
    }
  }

  return (
    <div className="product-alternative-control">
      <button className="text-action" type="button" onClick={toggle} aria-expanded={open} disabled={week.customizationBusy}>Vervang</button>
      {open ? (
        <div className="product-alternatives" role="region" aria-label={`Alternatieven voor ${currentProductName}`}>
          {loading ? <p role="status">Geschikte producten controleren…</p> : alternatives.length === 0 ? <p role="status">Geen betrouwbaar automatisch alternatief.</p> : (
            <>
              <ul className="compact-product-list">
                {alternatives.slice(0, showAll ? alternatives.length : INITIAL_ALTERNATIVE_COUNT).map((alternative) => (
                  <li key={alternative.product.id}>
                    <button type="button" onClick={() => { setPending(alternative); setRevalidatedPreview(null); }} aria-pressed={pending?.product.id === alternative.product.id}>
                      <ProductImage product={alternative.product} />
                      <span><strong>{alternative.product.name}</strong><small>{alternative.product.packageText ?? "Verpakking"} · {formatCents(alternative.totalCostCents)}</small></span>
                      <span className="compact-budget-status"><strong>{signedDifference(alternative.differenceCents)}</strong><small>{alternative.withinMealBudget ? "Binnen budget" : "Boven budget"}</small></span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="compact-alternative-actions">
                {!showAll && alternatives.length > INITIAL_ALTERNATIVE_COUNT ? <button type="button" className="text-action" onClick={() => setShowAll(true)}>Meer alternatieven</button> : null}
                <button type="button" className="text-action" onClick={() => setManualOpen(true)}>Zelf zoeken</button>
              </div>
            </>
          )}
          {alternatives.length === 0 && !loading ? <button type="button" className="text-action" onClick={() => setManualOpen(true)}>Zelf zoeken</button> : null}
          {pending && pendingPreview ? (
            <div className="customization-confirm" role={pendingPreview.impact.requiresBudgetOverride ? "alert" : "status"}>
              <strong>{currentProductName} → {pending.product.name}</strong>
              <p>{differenceSentence(pendingPreview.impact.mealPlanDifferenceCents)}</p>
              <p>Nieuwe maaltijdkosten: {formatCents(pendingPreview.impact.nextMealPlanCostCents)}{pendingPreview.impact.mealBudgetCents === null ? "" : ` / ${formatCents(pendingPreview.impact.mealBudgetCents)}`}</p>
              {pendingPreview.impact.mealBudgetOverageCents > 0 ? <p className="budget-impact-warning"><strong>Let op:</strong> je komt {formatCents(pendingPreview.impact.mealBudgetOverageCents)} boven je maaltijd-budget.</p> : pendingPreview.impact.mealBudgetCents !== null ? <p>Blijft binnen je maaltijd-budget.</p> : null}
              {pendingPreview.impact.weekBudgetOverageCents > 0 ? <p className="budget-impact-warning">Hierdoor kom je ook {formatCents(pendingPreview.impact.weekBudgetOverageCents)} boven je totale weekbudget.</p> : pendingPreview.impact.weekBudgetRemainingCents !== null ? <p>Je totale weekbudget blijft nog {formatCents(pendingPreview.impact.weekBudgetRemainingCents)} onder de grens.</p> : null}
              <div className="customization-confirm-actions"><button type="button" onClick={() => { setPending(null); setRevalidatedPreview(null); }} disabled={week.customizationBusy}>Annuleren</button><button className="primary-action compact-action" type="button" onClick={confirm} disabled={week.customizationBusy}>{week.customizationBusy ? "Controleren…" : pendingPreview.impact.requiresBudgetOverride ? "Toch gebruiken" : "Bevestigen"}</button></div>
            </div>
          ) : null}
          {manualOpen ? <ManualProductFlow dayIndex={dayIndex} ingredients={ingredients} fixedIngredientId={ingredientId} onClose={() => setManualOpen(false)} /> : null}
        </div>
      ) : null}
    </div>
  );
}
