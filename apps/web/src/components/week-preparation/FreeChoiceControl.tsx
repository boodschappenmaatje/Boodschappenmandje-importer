"use client";

import { useEffect, useRef, useState } from "react";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { CompactRecipeDetail } from "./CompactRecipeDetail";
import { CustomDishEditor } from "./CustomDishEditor";
import { DishImage } from "@/components/ui/DishImage";
import { recipeImageFor } from "@/services/week-preparation/recipe-images";
import { formatCents } from "@/services/budget/budget-engine";
import type { FreeChoiceResult } from "@/services/week-preparation/free-choice";
import type { RecipeAlternative } from "@/services/week-preparation/meal-customization";
import type { CustomDish } from "@/types/week-preparation";

export function FreeChoiceControl({ dayIndex, initialDish }: { dayIndex: number; initialDish?: CustomDish }) {
  const week = useWeekPreparation();
  const [selectedResult, setSelectedResult] = useState<FreeChoiceResult | null>(null);
  const [mode, setMode] = useState<"recipe" | "mix" | "custom" | "library" | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<FreeChoiceResult[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<RecipeAlternative | null>(null);
  const revision = useRef(0);
  const confirmation = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (preview) { confirmation.current?.focus({ preventScroll: true }); confirmation.current?.scrollIntoView({ block: "start" }); }
  }, [preview]);
  const { searchDishes } = week;
  useEffect(() => {
    if ((mode !== "recipe" && mode !== "mix") || query.trim().length < 2) return;
    let active = true;
    const timer = setTimeout(() => {
      setBusy(true); setMessage("Gerechten en actuele prijzen zoeken…");
      void searchDishes(dayIndex, query, mode).then((found) => {
        if (!active) return;
        setResults(found); setMessage(found.length ? "" : "Geen compleet gerecht gevonden voor deze zoekterm. Probeer een andere naam of maak zelf een gerecht.");
      }).catch(() => { if (active) setMessage("Zoeken lukt nu niet. Probeer opnieuw."); })
        .finally(() => { if (active) setBusy(false); });
    }, 325);
    return () => { active = false; clearTimeout(timer); };
  }, [dayIndex, mode, query, searchDishes]);

  async function apply() {
    if (!preview) return;
    const result = await week.applyExplicitRecipe(dayIndex, preview, preview.impact.requiresBudgetOverride);
    if (result.applied) { setPreview(null); setMode(null); setMessage("Gerecht opgeslagen en boodschappenlijst bijgewerkt."); }
    else if (result.revalidatedPreview) setPreview(result.revalidatedPreview.alternative);
  }
  if (mode === "custom" || mode === "library") return <CustomDishEditor key={`${week.preparation?.id}:${dayIndex}:${mode}`} dayIndex={dayIndex} initialDish={initialDish} initialView={mode === "library" ? "library" : "editor"} onClose={() => setMode(null)} />;
  return <section className="free-choice-control" aria-label={`Vrije keuze dag ${dayIndex + 1}`}>
    {!mode ? <div className="free-choice-routes" aria-label="Wat wil je toevoegen?">
      <button type="button" aria-label="Gerecht kiezen" disabled={week.customizationBusy} onClick={() => { setMode("recipe"); setQuery(""); setResults([]); setMessage(""); }}><span>Gerecht</span><span>kiezen</span></button>
      <button type="button" aria-label="Maaltijdmix kiezen" disabled={week.customizationBusy} onClick={() => { setMode("mix"); setQuery(""); setResults([]); setMessage(""); }}><span>Maaltijdmix</span><span>kiezen</span></button>
      <button type="button" aria-label="Zelf maken" disabled={week.customizationBusy} onClick={() => { setMode("custom"); setSelectedResult(null); setMessage(""); }}><span>Zelf</span><span>maken</span></button>
      <button type="button" onClick={() => setMode("library")}>Mijn recepten</button>
    </div> : <button type="button" className="text-action" disabled={week.customizationBusy} onClick={() => { revision.current++; if (preview) setPreview(null); else setMode(null); setMessage(""); setBusy(false); }}>{preview ? "Terug naar je keuze" : "Andere route kiezen"}</button>}
    {preview ? <div className="customization-confirm" ref={confirmation} tabIndex={-1}>
      <CompactRecipeDetail preparation={preview.preparation} dayIndex={dayIndex} />
      {selectedResult?.brand ? <small>{selectedResult.brand}</small> : null}
      <details className="ux-budget-breakdown"><summary>Budget na toevoegen</summary>
      <p>Maaltijden deze week: {formatCents(preview.impact.nextMealPlanCostCents)}</p>
      <p>Totaal deze week: {formatCents(preview.impact.nextTotalWeekCostCents)}</p>
      {preview.impact.weekBudgetRemainingCents !== null ? <p>Resterend weekbudget: {formatCents(preview.impact.weekBudgetRemainingCents)}</p> : null}
      </details>
      {preview.impact.requiresBudgetOverride ? <p>Je overschrijdt het maaltijdbudget met {formatCents(preview.impact.mealBudgetOverageCents)} en het weekbudget met {formatCents(preview.impact.weekBudgetOverageCents)}.</p> : null}
      <button type="button" className="primary-action compact-action" disabled={week.customizationBusy || busy} onClick={apply}>{week.customizationBusy ? "Opslaan…" : preview.impact.requiresBudgetOverride ? "Toch toevoegen aan lijst" : "Voeg toe aan lijst"}</button>
    </div> : null}
    {(mode === "recipe" || mode === "mix") && !preview ? <>
      <label>{mode === "mix" ? "Zoek maaltijdmix" : "Zoek gerecht"}<input type="search" value={query} placeholder={mode === "mix" ? "Bijvoorbeeld Honig spaghetti of Knorr" : "Bijvoorbeeld spaghetti carbonara"} onChange={(event) => { setQuery(event.target.value); setResults([]); setPreview(null); setBusy(false); }} /></label>
      <ul className="free-choice-results">{results.map((result) => <li key={result.recipe.id}><button className="ux-dish-result" type="button" disabled={!result.alternative || busy || week.customizationBusy} onClick={() => { setSelectedResult(result); setPreview(result.alternative); }}>
        <DishImage asset={recipeImageFor({ recipeSourceKey: result.recipe.sourceKey, recipeName: result.recipe.name, categories: [], ingredients: result.alternative?.preparation.ingredients.filter((item) => item.usedIn.some((use) => use.dayIndex === dayIndex)).map((item) => ({ sourceKey: item.sourceKey, name: item.name, optional: item.optional })) ?? [] })} className="recipe-summary-image" sizes="58px" title={result.recipe.name} />
        <div><strong>{result.recipe.name}</strong>{result.brand ? <p>{result.brand}</p> : null}<p>{week.preparation?.numberOfPeople} personen · schaalbaar</p>
          <p>{result.alternative ? `± ${formatCents(result.alternative.alternativeDishCostCents)}` : "Deze variant is nog niet compleet beschikbaar"}</p>
          {result.recipe.preparationMinutes ? <p>{result.recipe.preparationMinutes} minuten</p> : null}
        </div>
      </button></li>)}</ul>
    </> : null}
    {message ? <p role="status">{message}</p> : null}
  </section>;
}
