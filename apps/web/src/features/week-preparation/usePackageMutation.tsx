"use client";
import { useRef, useState } from "react";
import { useWeekPreparation } from "./WeekPreparationProvider";
import { formatCents } from "@/services/budget/budget-engine";
import type { RecipeAlternative } from "@/services/week-preparation/meal-customization";
import type { PlannedIngredientLink } from "@/types/shopping-list";

/** Both recipe and list submit the same canonical package command and budget gate. */
export function usePackageMutation() {
  const week = useWeekPreparation();
  const [pending, setPending] = useState<{ dayIndex: number; alternative: RecipeAlternative } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  async function commit(dayIndex: number, next: RecipeAlternative, approve: boolean) {
    const result = await week.applyExplicitRecipe(dayIndex, next, approve);
    if (result.applied) { setPending(null); setMessage("Hoeveelheid, verpakkingen en budget zijn bijgewerkt."); }
    else if (result.revalidatedPreview) { setPending({ dayIndex, alternative: result.revalidatedPreview.alternative }); setMessage("De bedragen zijn veranderd. Controleer en bevestig opnieuw."); }
    else { setPending(null); setMessage("Aanpassen is niet gelukt. Je vorige hoeveelheid blijft staan."); }
  }
  async function change(dayIndex: number, ingredientId: string, quantity: number, link?: PlannedIngredientLink) {
    if (inFlight.current || week.customizationBusy || pending) return;
    inFlight.current = true; setBusy(true); setMessage("");
    try {
      const next = link ? await week.previewLinkedIngredientPackages(link, quantity) : await week.previewIngredientPackages(dayIndex, ingredientId, quantity);
      if (!next) { setMessage("Deze hoeveelheid kon niet worden berekend. Controleer het product en probeer opnieuw."); return; }
      if (next.impact.requiresBudgetOverride) setPending({ dayIndex, alternative: next });
      else await commit(dayIndex, next, false);
    } catch { setMessage("Berekenen lukt nu niet. Je vorige hoeveelheid blijft staan."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  async function confirm() {
    if (!pending || inFlight.current) return;
    if (pending.alternative.basePreparationUpdatedAt !== week.preparation?.updatedAt) {
      setPending(null); setMessage("Het gerecht of de week is gewijzigd. Kies de hoeveelheid opnieuw."); return;
    }
    inFlight.current = true; setBusy(true);
    try { await commit(pending.dayIndex, pending.alternative, pending.alternative.impact.requiresBudgetOverride); }
    catch { setMessage("Opslaan lukt nu niet. Probeer opnieuw."); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return { change, confirm, cancel: () => { setPending(null); setMessage(""); }, pending: pending?.alternative ?? null,
    busy: busy || week.customizationBusy, blocked: busy || week.customizationBusy || Boolean(pending), message };
}

export function PackageMutationFeedback({ mutation }: { mutation: ReturnType<typeof usePackageMutation> }) {
  const { busy, pending, message } = mutation;
  return <>
    {busy ? <p role="status">Hoeveelheid en prijs worden bijgewerkt…</p> : null}
    {pending ? <div className="customization-confirm" role="alert">
      <p>Na aanpassen: {formatCents(pending.impact.nextMealPlanCostCents)} voor maaltijden en {formatCents(pending.impact.nextTotalWeekCostCents)} voor de week.</p>
      {pending.impact.requiresBudgetOverride ? <p>Boven budget: maaltijden {formatCents(pending.impact.mealBudgetOverageCents)}, week {formatCents(pending.impact.weekBudgetOverageCents)}.</p> : null}
      <div className="customization-confirm-actions"><button type="button" disabled={busy} onClick={mutation.cancel}>Annuleren</button><button type="button" className="primary-action compact-action" disabled={busy} onClick={mutation.confirm}>{pending.impact.requiresBudgetOverride ? "Toch gebruiken" : "Bevestig hoeveelheid"}</button></div>
    </div> : null}
    {message ? <p role="status">{message}</p> : null}
  </>;
}
