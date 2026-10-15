import { DAY_LABELS } from "@/components/week-preparation/day-labels";
import type { AssistantContext, AssistantResponse, AssistantTurn } from "@/server/maatje-assistant";
import { formatCents } from "@/services/budget/budget-engine";
import type { ActiveShoppingList } from "@/types/shopping-list";
import type { WeekPreparation } from "@/types/week-preparation";

export type { AssistantResponse, AssistantTurn };

/** Wat Maatje over je lijst, budget en week mag weten; alleen van dit toestel. */
export function buildAssistantContext(input: {
  list: ActiveShoppingList | null;
  preparation: WeekPreparation | null;
  budgetCents: number | null;
  plannedCents: number;
  missingPrices: number;
  lastChoices: AssistantContext["lastChoices"];
}): AssistantContext {
  const list = (input.list?.items ?? []).map(item => ({
    name: item.name,
    packageText: item.packageText,
    quantity: item.quantity,
    priceCents: item.price ? Math.round(item.price.amount * 100) : null,
  }));
  const week = (input.preparation?.days ?? []).map(day => ({
    day: DAY_LABELS[day.dayIndex] ?? `Dag ${day.dayIndex + 1}`,
    dish: day.customDish?.name ?? day.recipe?.name ?? (day.freeChoice ? "vrije keuze" : null),
  }));
  return {
    list,
    budget: {
      budgetCents: input.budgetCents,
      plannedCents: input.plannedCents,
      remainingCents: input.budgetCents === null ? null : input.budgetCents - input.plannedCents,
      missingPrices: input.missingPrices,
    },
    week,
    lastChoices: input.lastChoices,
  };
}

/** Wat Maatje zegt nadat je een product hebt gekozen, met een budgetcheck. */
export function addedMessage(name: string, quantity: number, budgetCents: number | null, plannedAfterCents: number): string {
  const what = quantity > 1 ? `${quantity}× ${name}` : name;
  if (budgetCents === null) return `${what} staat op je lijst!`;
  const left = budgetCents - plannedAfterCents;
  if (left >= 0) return `${what} staat op je lijst. Dit past nog, je hebt nog ${formatCents(left)} over.`;
  return `${what} staat op je lijst. Let op: je zit nu ${formatCents(-left)} boven je budget.`;
}

export type AssistantErrorCode = "not-configured" | "too-many-requests" | "failed" | "offline";

export class AssistantError extends Error {
  constructor(readonly code: AssistantErrorCode) {
    super(code);
    this.name = "AssistantError";
  }
}

export async function askMaatje(body: {
  audio?: { data: string; mimeType: string };
  text?: string;
  history: AssistantTurn[];
  context: AssistantContext;
}, signal?: AbortSignal): Promise<AssistantResponse> {
  let response: Response;
  try {
    response = await fetch("/api/maatje/praten", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new AssistantError("offline");
  }
  if (response.status === 503) throw new AssistantError("not-configured");
  if (response.status === 429) throw new AssistantError("too-many-requests");
  if (!response.ok) throw new AssistantError("failed");
  return response.json() as Promise<AssistantResponse>;
}

export function assistantErrorMessage(code: AssistantErrorCode): string {
  switch (code) {
    case "not-configured": return "Praten werkt hier nog niet. Mijn sleutel ontbreekt nog.";
    case "too-many-requests": return "Even rustig aan, ik moet op adem komen. Probeer het zo nog eens.";
    case "offline": return "Ik kan nu even niemand bereiken. Ben je online?";
    default: return "Oeps, dat ging mis. Wil je het nog eens proberen?";
  }
}
