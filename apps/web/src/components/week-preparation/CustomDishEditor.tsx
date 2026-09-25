"use client";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { subscribeCatalogRefresh } from "@/services/catalog/auto-refresh";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { CustomIngredientEditor } from "./CustomIngredientEditor";
import { CompactRecipeDetail } from "./CompactRecipeDetail";
import { DishImage } from "@/components/ui/DishImage";
import { formatCents } from "@/services/budget/budget-engine";
import { customDishWithIngredientPackages } from "@/services/week-preparation/ingredient-quantity";
import { validCustomDish } from "@/services/week-preparation/custom-dish";
import { customDraftHasChanges, customDraftKey, loadCustomDraft, loadMyRecipes, saveCustomDraft, saveMyRecipe, type SavedCustomRecipe } from "@/services/week-preparation/my-recipes-storage";
import type { RecipeAlternative } from "@/services/week-preparation/meal-customization";
import type { CustomDish } from "@/types/week-preparation";

/** An explicitly opened detail wins over an older editor draft for the same recipe. */
export function customDishForOpening(initialDish: CustomDish | undefined, initialView: "editor" | "library" | "detail", stored: CustomDish | null, recipes: SavedCustomRecipe[]): CustomDish | undefined {
  if (initialView === "detail" && initialDish) return initialDish;
  const sameRecipe = !initialDish || (stored?.savedRecipeId && stored.savedRecipeId === initialDish.savedRecipeId);
  return stored && sameRecipe && customDraftHasChanges(stored, recipes) ? stored : initialDish;
}

export function CustomDishEditor({ dayIndex, initialDish, initialView = "editor", onClose, onChooseSlot }: {
  dayIndex: number; initialDish?: CustomDish; initialView?: "editor" | "library" | "detail"; onClose?: () => void; onChooseSlot?: (dish: CustomDish) => void;
}) {
  const week = useWeekPreparation();
  const [view, setView] = useState<"editor" | "library" | "detail">(initialView);
  const draftKey = customDraftKey(week.preparation?.id ?? "unprepared", dayIndex);
  const initial = useRef(initialDish);
  const openingView = useRef(initialView);
  const people = week.preparation?.numberOfPeople ?? 4;
  const [dish, setDish] = useState<CustomDish | null>(initialDish ?? null);
  const [recipes, setRecipes] = useState<SavedCustomRecipe[]>([]);
  const [preview, setPreview] = useState<RecipeAlternative | null>(null);
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [pendingOpen, setPendingOpen] = useState<SavedCustomRecipe | "new" | null>(null);
  const screen = useRef<HTMLDivElement>(null);
  useEffect(() => { screen.current?.focus({ preventScroll: true }); screen.current?.scrollIntoView({ block: "start" }); }, [view]);
  const dirty = useRef(false);
  const revision = useRef(0);
  const { previewCustomDish } = week;
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      const fallback = initial.current ?? { name: "", servings: people, targetServings: people, ingredients: [] };
      let loadedRecipes: SavedCustomRecipe[] = [];
      try { loadedRecipes = loadMyRecipes(window.localStorage); setRecipes(loadedRecipes); }
      catch { setStorageError("Mijn recepten kan niet worden gelezen. Bestaande opslag is behouden; opslaan is nu niet mogelijk."); }
      try {
        const stored = loadCustomDraft(window.localStorage, draftKey);
        const saved = customDishForOpening(initial.current, openingView.current, stored, loadedRecipes);
        setDish(saved ?? fallback);
        dirty.current = customDraftHasChanges(saved ?? fallback, loadedRecipes);
      } catch { setDish(fallback); setStorageError("Je concept kon niet worden gelezen. Je opgeslagen recepten blijven behouden."); }
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
  const refreshVisibleRecipe = useEffectEvent(() => {
    if (!busy && dish) setRefresh(value => value + 1);
  });
  useEffect(() => subscribeCatalogRefresh(() => refreshVisibleRecipe()), []);
  function update(next: CustomDish, edited = true) {
    revision.current++; dirty.current = edited && customDraftHasChanges(next, recipes);
    setDish(next); setPreview(null); setBusy(false); setMessage("");
    try { saveCustomDraft(window.localStorage, draftKey, next); setStorageError(""); }
    catch { setStorageError("Je wijzigingen zijn nog niet op dit apparaat bewaard. Houd dit scherm open en probeer opnieuw op te slaan."); }
  }
  function open(entry: SavedCustomRecipe | "new") {
    setPendingOpen(null);
    setView(entry === "new" ? "editor" : "detail");
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
      setView("detail");
      setMessage("Je recept staat in Mijn recepten op dit apparaat.");
    } catch { setStorageError("Bewaren is niet gelukt. Controleer of alle ingrediënten een product hebben en opslag beschikbaar is. Je invoer blijft op dit scherm staan."); }
  }
  function changeQuantity(ingredientId: string, quantity: number) {
    if (!dish || !preview || busy || week.customizationBusy) return;
    const ingredient = preview.preparation.ingredients.find(row => row.ingredientId === ingredientId);
    if (!ingredient) return;
    const next = customDishWithIngredientPackages(dish, dayIndex, ingredient, quantity);
    if (!next) return;
    try {
      if (next.savedRecipeId) {
        const saved = saveMyRecipe(window.localStorage, next, next.savedRecipeId);
        update(saved.dish, false); setRecipes(loadMyRecipes(window.localStorage));
      } else update(next);
      setBusy(true);
    } catch { setStorageError("Je hoeveelheid kon niet worden bewaard. Je vorige recept blijft staan."); }
  }

  async function apply() {
    if (dayIndex < 0 || !preview || busy || week.customizationBusy) return;
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
  return <div className="custom-dish-editor" data-view={view} ref={screen} tabIndex={-1}>
    <header className="recipe-screen-navigation">
      <button type="button" disabled={week.customizationBusy} onClick={() => { if (view === "editor" && dish.savedRecipeId) setView("detail"); else if (view === "detail") setView("library"); else onClose?.(); }}>← Terug</button>
      <h2>{view === "editor" ? dish.savedRecipeId ? "Bewerk recept" : "Nieuw recept" : view === "library" ? "Mijn recepten" : dish.name}</h2>
    </header>
    {view === "library" ? <>
    <section aria-label="Mijn recepten" className="my-recipes">
      <p>Opgeslagen op dit apparaat. Bij openen controleren we de actuele prijzen.</p>
      {recipes.length ? <ul className="free-choice-results">{recipes.map(entry => <li key={entry.id}>
        <button type="button" className="ux-dish-result" disabled={week.customizationBusy} onClick={() => requestOpen(entry)}>
          <DishImage asset={null} title={entry.dish.name} className="recipe-summary-image" sizes="58px" />
          <span><strong>{entry.dish.name}</strong><span>{entry.dish.targetServings ?? entry.dish.servings} personen · {entry.dish.ingredients.length} {entry.dish.ingredients.length === 1 ? "ingrediënt" : "ingrediënten"}</span></span>
        </button>
      </li>)}</ul> : <p>Je hebt nog geen eigen recepten bewaard.</p>}
      <button type="button" className="text-action" disabled={week.customizationBusy} onClick={() => requestOpen("new")}>Nieuw recept</button>
    </section>
    {customDraftHasChanges(dish, recipes) ? <button type="button" onClick={() => setView("editor")}>Verder met mijn concept</button> : null}
    </> : null}
    {pendingOpen ? <div className="customization-confirm" role="alert">
      <p>Je hebt onbewaarde wijzigingen. Wil je die eerst bewaren of een ander recept openen?</p>
      <button type="button" onClick={() => setPendingOpen(null)}>Verder bewerken</button>
      <button type="button" onClick={() => open(pendingOpen)}>Wijzigingen verlaten</button>
    </div> : null}
    {view === "editor" ? <fieldset className="custom-dish-fields" disabled={week.customizationBusy}>
      <legend className="visually-hidden">Zelf maken</legend>
      <label>Naam van je gerecht<input value={dish.name} maxLength={100} placeholder="Bijvoorbeeld mijn pasta pesto" onChange={event => update({ ...dish, name: event.target.value })} /></label>
      <label>Aantal personen<select value={dish.targetServings ?? dish.servings} onChange={event => update({ ...dish, targetServings: Number(event.target.value) })}>
        {Array.from({ length: 12 }, (_, index) => index + 1).map(count => <option key={count} value={count}>{count} {count === 1 ? "persoon" : "personen"}</option>)}
      </select></label>
      <div className="custom-ingredients-heading"><h3>Ingrediënten</h3><details><summary>Hoe werkt het?</summary><p>Vul in hoeveel je nodig hebt voor {dish.targetServings ?? dish.servings} personen. We rekenen de verpakkingen en actuele prijzen automatisch uit. Bij een ander aantal personen schalen de hoeveelheden mee.</p></details></div>
      {dish.ingredients.map(row => <CustomIngredientEditor key={`${dish.savedRecipeId ?? "draft"}:${row.id}`} row={row} dish={dish} refresh={refresh}
        onChange={changed => update({ ...dish, ingredients: dish.ingredients.map(item => item.id === row.id ? changed : item) })}
        onRemove={() => update({ ...dish, ingredients: dish.ingredients.filter(item => item.id !== row.id) })} />)}
      <button type="button" disabled={dish.ingredients.length >= 40} onClick={() => update({ ...dish, ingredients: [...dish.ingredients, { id: crypto.randomUUID(), name: "", quantity: 0, unit: "piece", productId: null }] })}>Ingrediënt toevoegen</button>
      {preview ? <p className="custom-editor-total">Totaal gerecht <strong>{formatCents(preview.alternativeDishCostCents)}</strong></p> : null}
      <div className="recipe-screen-actions"><button type="button" className="primary-action" disabled={!completeInput} onClick={save}>Bewaar mijn recept</button></div>
    </fieldset> : null}
    {busy ? <p role="status">Actuele producten, verpakkingen en budget controleren…</p> : null}
    {view === "detail" ? <>
      {preview ? <CompactRecipeDetail preparation={preview.preparation} dayIndex={dayIndex} showBudget={dayIndex >= 0} presentation="screen" onQuantityChange={changeQuantity} quantityBusy={busy || week.customizationBusy} /> : <p>{dish.name} · {dish.targetServings ?? dish.servings} personen · {dish.ingredients.length} ingrediënten. Actuele producten worden gecontroleerd. Gebruik Bewerk recept als een ingrediënt aandacht nodig heeft.</p>}
      {preview && dayIndex >= 0 ? <details className="ux-budget-breakdown"><summary>Budget na toevoegen</summary>
        <p>Maaltijden deze week: {formatCents(preview.impact.nextMealPlanCostCents)}</p>
        <p>Totaal deze week: {formatCents(preview.impact.nextTotalWeekCostCents)}</p>
        {preview.impact.weekBudgetRemainingCents !== null ? <p>Resterend weekbudget: {formatCents(preview.impact.weekBudgetRemainingCents)}</p> : null}
      </details> : null}
      {preview && dayIndex >= 0 && preview.impact.requiresBudgetOverride ? <p role="alert">Je overschrijdt het maaltijdbudget met {formatCents(preview.impact.mealBudgetOverageCents)} en het weekbudget met {formatCents(preview.impact.weekBudgetOverageCents)}. Bevestig alleen als je deze overschrijding accepteert.</p> : null}
      {dayIndex < 0 ? <p>Kies een vrije-keuzeplek om dit recept aan je week toe te voegen.</p> : null}
      <div className="recipe-screen-actions recipe-detail-actions">
        <button type="button" disabled={week.customizationBusy} onClick={() => setView("editor")}>Bewerk recept</button>
        <button type="button" className="primary-action" disabled={busy || week.customizationBusy || !preview || (dayIndex < 0 && !onChooseSlot)} onClick={() => { if (dayIndex < 0) onChooseSlot?.(dish); else void apply(); }}>{week.customizationBusy ? "Toevoegen…" : preview?.impact.requiresBudgetOverride && dayIndex >= 0 ? "Toch toevoegen aan lijst" : "Voeg toe aan lijst"}</button>
      </div>
    </> : null}
    {view !== "library" && completeInput && !busy && !preview ? <button type="button" className="text-action" onClick={() => { revision.current++; setRefresh(value => value + 1); }}>Controleer producten en prijs</button> : null}
    {storageError ? <p role="alert">{storageError}</p> : <p className="custom-draft-status">Je concept blijft op dit apparaat bewaard als je teruggaat.</p>}
    {message ? <p role="status">{message}</p> : null}
  </div>;
}
