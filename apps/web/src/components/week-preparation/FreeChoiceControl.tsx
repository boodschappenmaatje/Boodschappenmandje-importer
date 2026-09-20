"use client";

import { useEffect, useRef, useState } from "react";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { DishImage } from "@/components/ui/DishImage";
import { recipeImageFor } from "@/services/week-preparation/recipe-images";
import { formatCents, euroAmountToCents } from "@/services/budget/budget-engine";
import { resolveCurrentPrice } from "@/services/catalog/price";
import type { FreeChoiceResult } from "@/services/week-preparation/free-choice";
import type { RecipeAlternative } from "@/services/week-preparation/meal-customization";
import type { CustomDish, CustomDishIngredient, WeekIngredientUnit } from "@/types/week-preparation";
import type { Product } from "@/types/catalog";

function IngredientEditor({ row, onChange, onRemove }: { row: CustomDishIngredient; onChange: (row: CustomDishIngredient) => void; onRemove: () => void }) {
  const { matchCustomIngredient, searchCatalogProducts } = useWeekPreparation();
  const [match, setMatch] = useState<Product | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<Product[]>([]);
  useEffect(() => {
    if (row.name.trim().length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      setStatus("Passend product zoeken…");
      void matchCustomIngredient(row.name, row.unit, row.productId).then((found) => {
        if (!active) return;
        setMatch(found);
        setStatus(found ? "" : "Geen betrouwbare match. Zoek en kies zelf een product.");
      }).catch(() => { if (active) setStatus("Zoeken lukt nu niet. Probeer opnieuw."); });
    }, 325);
    return () => { active = false; clearTimeout(timer); };
  }, [matchCustomIngredient, row.name, row.unit, row.productId]);
  useEffect(() => {
    if (!search || query.trim().length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void searchCatalogProducts(query, controller.signal).then((found) => {
        if (!controller.signal.aborted) setProducts(found);
      }).catch(() => { if (!controller.signal.aborted) setStatus("Zoeken lukt nu niet."); });
    }, 325);
    return () => { controller.abort(); clearTimeout(timer); };
  }, [query, search, searchCatalogProducts]);
  return <fieldset className="custom-ingredient-editor">
    <legend>Ingrediënt</legend>
    <label>Naam<input value={row.name} maxLength={100} placeholder="Bijvoorbeeld paprika" onChange={(event) => { setMatch(null); onChange({ ...row, name: event.target.value, productId: null }); }} /></label>
    <div className="custom-ingredient-amount">
      <label>Hoeveelheid<input type="number" inputMode="decimal" min="0.001" max="100000" step="any" value={row.quantity || ""} onChange={(event) => onChange({ ...row, quantity: Number(event.target.value) })} /></label>
      <label>Eenheid<select aria-label="Eenheid" value={row.unit} onChange={(event) => onChange({ ...row, unit: event.target.value as WeekIngredientUnit, productId: null })}>
        {[["g", "gram"], ["kg", "kilo"], ["ml", "milliliter"], ["l", "liter"], ["piece", "stuks"], ["loaf", "broden"]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}
      </select></label>
    </div>
    {match ? <p><strong>{match.name}</strong> · {match.packageText ?? "Verpakking onbekend"}{resolveCurrentPrice(match.currentPrice) ? ` · ${formatCents(euroAmountToCents(resolveCurrentPrice(match.currentPrice)!.amount) ?? 0)}` : " · Prijs onbekend"}</p> : null}
    {row.productId && !match ? <p>Je gekozen product wordt bij de prijscontrole opnieuw opgehaald.</p> : null}
    <p role="status">{status}</p>
    <button type="button" onClick={() => { setSearch(!search); setQuery(row.name); }}>Zelf product kiezen</button>
    {search ? <div>
      <label>Zoek product<input value={query} onChange={(event) => { setQuery(event.target.value); setProducts([]); }} /></label>
      <ul className="custom-product-options">{products.map((product) => <li key={product.id}><button type="button" onClick={() => { setMatch(product); onChange({ ...row, productId: product.id }); setSearch(false); setStatus(""); }}>{product.name} · {product.packageText}</button></li>)}</ul>
      {query.length >= 2 && products.length === 0 ? <p>Geen resultaten beschikbaar.</p> : null}
    </div> : null}
    <button type="button" className="text-action" onClick={onRemove}>Ingrediënt verwijderen</button>
  </fieldset>;
}

export function FreeChoiceControl({ dayIndex, initialDish }: { dayIndex: number; initialDish?: CustomDish }) {
  const week = useWeekPreparation();
  const [mode, setMode] = useState<"search" | "custom" | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FreeChoiceResult[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dish, setDish] = useState<CustomDish>(initialDish ?? { name: "", servings: week.preparation?.numberOfPeople ?? 4, ingredients: [] });
  const [preview, setPreview] = useState<RecipeAlternative | null>(null);
  const revision = useRef(0);
  const { searchDishes } = week;
  useEffect(() => {
    if (mode !== "search" || query.trim().length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      setBusy(true); setMessage("Gerechten en actuele prijzen zoeken…");
      void searchDishes(dayIndex, query).then((found) => {
        if (!active) return;
        setResults(found); setMessage(found.length ? "" : "Geen compleet gerecht gevonden voor deze zoekterm. Probeer een andere naam of maak zelf een gerecht.");
      }).catch(() => { if (active) setMessage("Zoeken lukt nu niet. Probeer opnieuw."); })
        .finally(() => { if (active) setBusy(false); });
    }, 325);
    return () => { active = false; clearTimeout(timer); };
  }, [dayIndex, mode, query, searchDishes]);

  function updateDish(next: CustomDish) { revision.current++; setDish(next); setPreview(null); setMessage(""); }
  async function checkDish() {
    const version = revision.current;
    setBusy(true); setMessage("Ingrediënten, verpakkingen en prijzen controleren…");
    try {
      const found = await week.previewCustomDish(dayIndex, dish);
      if (version !== revision.current) return;
      setPreview(found); setMessage(found ? "" : "Controleer de naam, hoeveelheden en producten. Nog niet alle ingrediënten hebben een passende verpakking en actuele prijs.");
    } catch { setMessage("Controleren lukt nu niet. Je invoer blijft bewaard zolang je deze pagina openhoudt."); }
    finally { setBusy(false); }
  }
  async function apply() {
    if (!preview) return;
    const result = await week.applyExplicitRecipe(dayIndex, preview, preview.impact.requiresBudgetOverride);
    if (result.applied) { setPreview(null); setMode(null); setMessage("Gerecht opgeslagen en boodschappenlijst bijgewerkt."); }
    else if (result.revalidatedPreview) setPreview(result.revalidatedPreview.alternative);
  }
  return <section className="free-choice-control" aria-label={`Vrije keuze dag ${dayIndex + 1}`}>
    <div className="free-choice-routes">
      <button type="button" disabled={week.customizationBusy} onClick={() => { setMode("search"); setPreview(null); setMessage(""); }}>Zoek gerecht of maaltijdmix</button>
      <button type="button" disabled={week.customizationBusy} onClick={() => { setMode("custom"); setPreview(null); setMessage(""); }}>{initialDish ? "Eigen gerecht bewerken" : "Maak zelf een gerecht"}</button>
    </div>
    {mode ? <button type="button" className="text-action" onClick={() => { revision.current++; setMode(null); setPreview(null); setBusy(false); }}>Sluiten</button> : null}
    {mode === "search" ? <>
      <label>Zoek gerecht of maaltijdmix<input type="search" value={query} placeholder="Bijvoorbeeld Honig spaghetti" onChange={(event) => { setQuery(event.target.value); setResults([]); setPreview(null); setBusy(false); }} /></label>
      <ul className="free-choice-results">{results.map((result) => <li key={result.recipe.id}>
        <DishImage asset={recipeImageFor({ recipeSourceKey: result.recipe.sourceKey, recipeName: result.recipe.name, categories: [], ingredients: [] })} className="recipe-summary-image" sizes="58px" title={result.recipe.name} />
        <div><strong>{result.recipe.name}</strong>{result.brand ? <p>{result.brand}</p> : null}<p>{week.preparation?.numberOfPeople} personen · schaalbaar</p>
          <p>{result.alternative ? `± ${formatCents(result.alternative.alternativeDishCostCents)}` : "Deze variant is nog niet compleet beschikbaar"}</p>
          <button type="button" disabled={!result.alternative || busy || week.customizationBusy} onClick={() => setPreview(result.alternative)}>Gebruik dit gerecht</button>
        </div>
      </li>)}</ul>
    </> : null}
    {mode === "custom" ? <>
      <label>Naam van je gerecht<input value={dish.name} maxLength={100} placeholder="Bijvoorbeeld pasta met kip" onChange={(event) => updateDish({ ...dish, name: event.target.value })} /></label>
      <p>Geef de totale hoeveelheden voor {dish.servings} personen op. Een pot of pak? Vul de inhoud in gram, milliliter of stuks in.</p>
      {dish.ingredients.map((row) => <IngredientEditor key={row.id} row={row} onChange={(changed) => updateDish({ ...dish, ingredients: dish.ingredients.map((item) => item.id === row.id ? changed : item) })} onRemove={() => updateDish({ ...dish, ingredients: dish.ingredients.filter((item) => item.id !== row.id) })} />)}
      <button type="button" disabled={dish.ingredients.length >= 40} onClick={() => updateDish({ ...dish, ingredients: [...dish.ingredients, { id: crypto.randomUUID(), name: "", quantity: 1, unit: "piece", productId: null }] })}>Ingrediënt toevoegen</button>
      <button type="button" disabled={busy || week.customizationBusy || !dish.name.trim() || !dish.ingredients.length} onClick={checkDish}>Controleer producten en prijs</button>
    </> : null}
    {message ? <p role="status">{message}</p> : null}
    {preview ? <div className="customization-confirm" role="status">
      <strong>{preview.recipe.name} · ± {formatCents(preview.alternativeDishCostCents)}</strong>
      <ul>{preview.preparation.ingredients.filter((item) => item.usedIn.some((use) => use.dayIndex === dayIndex)).map((item) => <li key={item.ingredientId}>{item.name}: {item.product?.name} · {item.purchaseQuantity} verpakking(en)</li>)}</ul>
      <p>Maaltijden deze week: {formatCents(preview.impact.nextMealPlanCostCents)}</p>
      <p>Totaal deze week: {formatCents(preview.impact.nextTotalWeekCostCents)}</p>
      {preview.impact.weekBudgetRemainingCents !== null ? <p>Resterend weekbudget: {formatCents(preview.impact.weekBudgetRemainingCents)}</p> : null}
      {preview.impact.requiresBudgetOverride ? <p>Je overschrijdt het maaltijdbudget met {formatCents(preview.impact.mealBudgetOverageCents)} en het weekbudget met {formatCents(preview.impact.weekBudgetOverageCents)}.</p> : null}
      <button type="button" className="primary-action compact-action" disabled={week.customizationBusy || busy} onClick={apply}>{week.customizationBusy ? "Opslaan…" : preview.impact.requiresBudgetOverride ? "Toch gebruiken en opslaan" : "Gerecht opslaan voor deze dag"}</button>
    </div> : null}
  </section>;
}
