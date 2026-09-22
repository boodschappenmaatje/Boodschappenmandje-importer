"use client";
import { useEffect, useRef, useState } from "react";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { CustomIngredientEditor } from "./CustomIngredientEditor";
import { DishBudgetSummary } from "./DishBudgetSummary";
import { DishImage } from "@/components/ui/DishImage";
import { formatCents } from "@/services/budget/budget-engine";
import { validCustomDish } from "@/services/week-preparation/custom-dish";
import { customDraftKey, loadCustomDraft, loadMyRecipes, saveCustomDraft, saveMyRecipe, type SavedCustomRecipe } from "@/services/week-preparation/my-recipes-storage";
import type { RecipeAlternative } from "@/services/week-preparation/meal-customization";
import type { CustomDish } from "@/types/week-preparation";

export function CustomDishEditor({ dayIndex, initialDish }: { dayIndex: number; initialDish?: CustomDish }) {
  const week = useWeekPreparation();
  const draftKey = customDraftKey(week.preparation?.id ?? "unprepared", dayIndex);
  const initial = useRef(initialDish);
  const people = week.preparation?.numberOfPeople ?? 4;
  const [dish, setDish] = useState<CustomDish | null>(null);
  const [recipes, setRecipes] = useState<SavedCustomRecipe[]>([]);
  const [preview, setPreview] = useState<RecipeAlternative | null>(null);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [pendingOpen, setPendingOpen] = useState<SavedCustomRecipe | "new" | null>(null);
  const dirty = useRef(false);
  const revision = useRef(0);
  const { previewCustomDish } = week;
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const fallback = initial.current ?? { name: "", servings: people, targetServings: people, ingredients: [] };
      try { const saved = loadCustomDraft(window.localStorage, draftKey); setDish(saved ?? fallback); dirty.current = !!saved; }
      catch { setDish(fallback); setStorageError("Je concept kon niet worden gelezen. Je opgeslagen recepten blijven behouden."); }
      try { setRecipes(loadMyRecipes(window.localStorage)); }
      catch { setStorageError("Mijn recepten kan niet worden gelezen. Bestaande opslag is behouden; opslaan is nu niet mogelijk."); }
    });
    return () => { active = false; };
  }, [draftKey, people]);
  useEffect(() => {
    if (!dish || !validCustomDish(dish) || dish.ingredients.some(row => !row.productId)) return;
    let active = true;
    const version = revision.current;
    const timer = setTimeout(() => {
      setBusy(true);
      void previewCustomDish(dayIndex, dish).then(next => {
        if (!active || version !== revision.current) return;
        setPreview(next);
        setMessage(next ? "" : "Dit gerecht is nog niet compleet. Controleer de producten, hoeveelheden en verpakkingen hieronder.");
      }).catch(() => {
        if (active && version === revision.current) setMessage("Prijscontrole lukt nu niet. Je recept blijft bewaard; probeer opnieuw.");
      }).finally(() => { if (active && version === revision.current) setBusy(false); });
    }, 450);
    return () => { active = false; clearTimeout(timer); };
  }, [dish, dayIndex, refresh, previewCustomDish]);
  function update(next: CustomDish, edited = true) {
    revision.current++; dirty.current = edited;
    setDish(next); setPreview(null); setBusy(false); setMessage("");
    try { saveCustomDraft(window.localStorage, draftKey, next); setStorageError(""); }
    catch { setStorageError("Je wijzigingen zijn nog niet op dit apparaat bewaard. Houd dit scherm open en probeer opnieuw op te slaan."); }
  }
  function open(entry: SavedCustomRecipe | "new") {
    setPendingOpen(null);
    const next = entry === "new" ? { name: "", servings: people, targetServings: people, ingredients: [] } : structuredClone(entry.dish);
    update({ ...next, targetServings: next.targetServings ?? next.servings }, false);
    setRefresh(value => value + 1);
  }
  function requestOpen(entry: SavedCustomRecipe | "new") {
    if (dish && (dish.name || dish.ingredients.length) && dirty.current) setPendingOpen(entry);
    else open(entry);
  }
  function save() {
    if (!dish) return;
    try {
      const record = saveMyRecipe(window.localStorage, dish, dish.savedRecipeId ?? crypto.randomUUID());
      update(record.dish, false); setRecipes(loadMyRecipes(window.localStorage));
      setMessage("Je recept staat in Mijn recepten op dit apparaat.");
    } catch { setStorageError("Bewaren is niet gelukt. Controleer of alle ingrediënten een product hebben en opslag beschikbaar is. Je invoer blijft op dit scherm staan."); }
  }
  async function apply() {
    if (!preview || busy || week.customizationBusy) return;
    const version = revision.current; setBusy(true);
    try {
      const result = await week.applyExplicitRecipe(dayIndex, preview, preview.impact.requiresBudgetOverride);
      if (version !== revision.current) return;
      if (result.applied) setMessage("Gerecht toegevoegd en boodschappenlijst bijgewerkt.");
      else if (result.revalidatedPreview) { setPreview(result.revalidatedPreview.alternative); setMessage("De prijs of het budget is gewijzigd. Controleer het nieuwe totaal en bevestig opnieuw."); }
      else { setPreview(null); setMessage("Toevoegen is niet gelukt. Controleer de actuele producten en probeer opnieuw. Je bestaande lijst is behouden."); }
    } catch { setMessage("Toevoegen lukt nu niet. Je recept blijft bewaard; probeer opnieuw."); }
    finally { setBusy(false); }
  }
  if (!dish) return <p role="status">Je recepten laden…</p>;
  const completeInput = validCustomDish(dish) && dish.ingredients.every(row => !!row.productId);
  return <div className="custom-dish-editor">
    <section aria-label="Mijn recepten" className="my-recipes">
      <h3>Mijn recepten</h3><p>Opgeslagen op dit apparaat. Bij openen controleren we de actuele prijzen.</p>
      {recipes.length ? <ul className="free-choice-results">{recipes.map(entry => <li key={entry.id}>
        <button type="button" className="ux-dish-result" disabled={week.customizationBusy} onClick={() => requestOpen(entry)}>
          <DishImage asset={null} title={entry.dish.name} className="recipe-summary-image" sizes="58px" />
          <span><strong>{entry.dish.name}</strong><span>{entry.dish.servings} personen · {entry.dish.ingredients.length} ingrediënten</span></span>
        </button>
      </li>)}</ul> : <p>Je hebt nog geen eigen recepten bewaard.</p>}
      <button type="button" className="text-action" disabled={week.customizationBusy} onClick={() => requestOpen("new")}>Nieuw recept</button>
    </section>
    {pendingOpen ? <div className="customization-confirm" role="alert">
      <p>Je hebt onbewaarde wijzigingen. Wil je die eerst bewaren of een ander recept openen?</p>
      <button type="button" onClick={() => setPendingOpen(null)}>Verder bewerken</button>
      <button type="button" onClick={() => open(pendingOpen)}>Wijzigingen verlaten</button>
    </div> : null}
    <fieldset className="custom-dish-fields" disabled={week.customizationBusy}>
      <legend>Zelf maken</legend>
      <label>Naam van je gerecht<input value={dish.name} maxLength={100} placeholder="Bijvoorbeeld mijn pasta pesto" onChange={event => update({ ...dish, name: event.target.value })} /></label>
      <label>Aantal personen<select value={dish.targetServings ?? dish.servings} onChange={event => update({ ...dish, targetServings: Number(event.target.value) })}>
        {Array.from({ length: 12 }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count} {count === 1 ? "persoon" : "personen"}</option>)}
      </select></label>
      <p>Hoeveelheden voor {dish.targetServings ?? dish.servings} personen. Verpakkingen en prijzen worden automatisch opnieuw berekend.</p>
      <div className="custom-recipe-photo"><DishImage asset={null} title={dish.name || "Eigen recept"} className="recipe-summary-image" sizes="58px" /><span>Je eigen recept</span></div>
      {dish.ingredients.map(row => <CustomIngredientEditor key={`${dish.savedRecipeId ?? "draft"}:${row.id}`} row={row} dish={dish} refresh={refresh}
        onChange={changed => update({ ...dish, ingredients: dish.ingredients.map(item => item.id === row.id ? changed : item) })}
        onRemove={() => update({ ...dish, ingredients: dish.ingredients.filter(item => item.id !== row.id) })} />)}
      <button type="button" disabled={dish.ingredients.length >= 40} onClick={() => update({ ...dish, ingredients: [...dish.ingredients, { id: crypto.randomUUID(), name: "", quantity: 0, unit: "piece", productId: null }] })}>Ingrediënt toevoegen</button>
      <button type="button" className="text-action" disabled={!completeInput} onClick={save}>Bewaar mijn recept</button>
      <button type="button" className="text-action" disabled={!completeInput || busy} onClick={() => { revision.current++; setPreview(null); setRefresh(value => value + 1); }}>Controleer producten en prijs</button>
    </fieldset>
    {busy ? <p role="status">Actuele producten, verpakkingen en budget controleren…</p> : null}
    {preview ? <div className="customization-confirm">
      <h3>{dish.name}</h3><DishBudgetSummary preparation={preview.preparation} dayIndex={dayIndex} expandable />
      <details className="ux-budget-breakdown"><summary>Budget na toevoegen</summary>
        <p>Maaltijden deze week: {formatCents(preview.impact.nextMealPlanCostCents)}</p>
        <p>Totaal deze week: {formatCents(preview.impact.nextTotalWeekCostCents)}</p>
        {preview.impact.weekBudgetRemainingCents !== null ? <p>Resterend weekbudget: {formatCents(preview.impact.weekBudgetRemainingCents)}</p> : null}
      </details>
      {preview.impact.requiresBudgetOverride ? <p role="alert">Je overschrijdt het maaltijdbudget met {formatCents(preview.impact.mealBudgetOverageCents)} en het weekbudget met {formatCents(preview.impact.weekBudgetOverageCents)}. Bevestig alleen als je deze overschrijding accepteert.</p> : null}
      <button type="button" className="primary-action compact-action" disabled={busy || week.customizationBusy} onClick={apply}>{week.customizationBusy ? "Toevoegen…" : preview.impact.requiresBudgetOverride ? "Toch toevoegen aan lijst" : "Voeg toe aan lijst"}</button>
    </div> : null}
    {storageError ? <p role="alert">{storageError}</p> : <p className="custom-draft-status">Je concept blijft op dit apparaat bewaard als je teruggaat.</p>}
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
