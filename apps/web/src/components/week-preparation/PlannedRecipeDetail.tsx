"use client";
import { useRef, useState } from "react";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import { formatCents } from "@/services/budget/budget-engine";
import type { RecipeAlternative } from "@/services/week-preparation/meal-customization";
import type { WeekPreparation } from "@/types/week-preparation";
import { CompactRecipeDetail } from "./CompactRecipeDetail";

export function PlannedRecipeDetail({ preparation, dayIndex }: { preparation: WeekPreparation; dayIndex: number }) {
  const week = useWeekPreparation();
  const [pending, setPending] = useState<RecipeAlternative | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  async function commit(next: RecipeAlternative, approve: boolean) {
    const result = await week.applyExplicitRecipe(dayIndex, next, approve);
    if (result.applied) { setPending(null); setMessage("Hoeveelheid, verpakkingen en budget zijn bijgewerkt."); }
    else if (result.revalidatedPreview) { setPending(result.revalidatedPreview.alternative); setMessage("De bedragen zijn veranderd. Controleer en bevestig opnieuw."); }
    else { setPending(null); setMessage("Aanpassen is niet gelukt. Je vorige hoeveelheid blijft staan."); }
  }
  async function change(ingredientId: string, quantity: number) {
    if (inFlight.current || week.customizationBusy) return;
    inFlight.current = true; setBusy(true); setMessage("");
    try {
      const next = await week.previewIngredientQuantity(dayIndex, ingredientId, quantity);
      if (!next) { setMessage("Deze hoeveelheid kon niet worden berekend. Controleer het product en probeer opnieuw."); return; }
      if (next.impact.requiresBudgetOverride) setPending(next);
      else await commit(next, false);
    } catch { setMessage("Berekenen lukt nu niet. Je vorige hoeveelheid blijft staan."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function confirm() {
    if (!pending || inFlight.current) return;
    if (pending.basePreparationUpdatedAt !== preparation.updatedAt) {
      setPending(null); setMessage("Het gerecht of de week is gewijzigd. Kies de hoeveelheid opnieuw."); return;
    }
    inFlight.current = true; setBusy(true);
    try { await commit(pending, pending.impact.requiresBudgetOverride); }
    catch { setMessage("Opslaan lukt nu niet. Probeer opnieuw."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <>
    <CompactRecipeDetail preparation={pending?.preparation ?? preparation} dayIndex={dayIndex} onQuantityChange={change} quantityBusy={busy || week.customizationBusy || Boolean(pending)} />
    {busy ? <p role="status">Hoeveelheid en prijs worden bijgewerkt…</p> : null}
    {pending ? <div className="customization-confirm" role="alert">
      <p>Na aanpassen: {formatCents(pending.impact.nextMealPlanCostCents)} voor maaltijden en {formatCents(pending.impact.nextTotalWeekCostCents)} voor de week.</p>
      {pending.impact.requiresBudgetOverride ? <p>Boven budget: maaltijden {formatCents(pending.impact.mealBudgetOverageCents)}, week {formatCents(pending.impact.weekBudgetOverageCents)}.</p> : null}
      <div className="customization-confirm-actions"><button type="button" disabled={busy || week.customizationBusy} onClick={() => { setPending(null); setMessage(""); }}>Annuleren</button><button type="button" className="primary-action compact-action" disabled={busy || week.customizationBusy} onClick={confirm}>{pending.impact.requiresBudgetOverride ? "Toch gebruiken" : "Bevestig hoeveelheid"}</button></div>
    </div> : null}
    {message ? <p role="status">{message}</p> : null}
  </>;
}
