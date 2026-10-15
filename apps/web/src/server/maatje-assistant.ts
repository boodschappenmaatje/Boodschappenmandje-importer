import type { CatalogRepository } from "@/services/catalog/catalog-repository";
import { resolveCurrentPrice } from "@/services/catalog/price";
import type { Product } from "@/types/catalog";

/**
 * Maatje-assistent (stap 2): je praat of typt tegen Maatje. Gemini begrijpt
 * wat je bedoelt en bedenkt alleen zoektermen; de producten zelf komen altijd
 * uit de echte Hoogvliet-catalogus. Zo kan Maatje nooit een product, prijs of
 * pakgrootte verzinnen.
 */

export const MAX_AUDIO_BYTES = 2_000_000;
export const MAX_TEXT_LENGTH = 400;
export const MAX_ITEMS = 5;
export const MAX_CHOICES = 5;
const MAX_HISTORY = 8;
const MAX_LIST_ITEMS = 80;
const MAX_DAYS = 14;
const AUDIO_TYPES = ["audio/mp4", "audio/aac", "audio/webm", "audio/ogg", "audio/mpeg", "audio/wav", "audio/x-m4a"];

export interface AssistantTurn {
  role: "user" | "maatje";
  text: string;
}

export interface AssistantContext {
  list: { name: string; packageText: string | null; quantity: number; priceCents: number | null }[];
  budget: { budgetCents: number | null; plannedCents: number; remainingCents: number | null; missingPrices: number };
  week: { day: string; dish: string | null }[];
  /** De keuzes die Maatje als laatste liet zien, voor "nee, de halfvolle". */
  lastChoices: { label: string; names: string[] }[];
}

export interface AssistantRequest {
  audio: { data: string; mimeType: string } | null;
  text: string | null;
  history: AssistantTurn[];
  context: AssistantContext;
}

export interface AssistantChoice {
  product: Product;
  priceCents: number | null;
}

export interface AssistantItem {
  label: string;
  quantity: number;
  choices: AssistantChoice[];
}

export interface AssistantResponse {
  heard: string;
  reply: string;
  items: AssistantItem[];
}

interface GeminiPlan {
  heard: string;
  reply: string;
  items: { label: string; quantity: number; terms: string[] }[];
}

export type GeminiCall = (body: unknown) => Promise<unknown>;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cleanText = (value: unknown, max: number): string | null => {
  if (typeof value !== "string") return null;
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

const cents = (value: unknown): number | null =>
  typeof value === "number" && Number.isSafeInteger(value) ? value : null;

function parseContext(value: unknown): AssistantContext {
  const context = isRecord(value) ? value : {};
  const list = Array.isArray(context.list) ? context.list.slice(0, MAX_LIST_ITEMS).flatMap(item => {
    if (!isRecord(item)) return [];
    const name = cleanText(item.name, 120);
    if (!name) return [];
    const quantity = typeof item.quantity === "number" && Number.isFinite(item.quantity) ? Math.max(0, Math.round(item.quantity)) : 1;
    return [{ name, packageText: cleanText(item.packageText, 60), quantity, priceCents: cents(item.priceCents) }];
  }) : [];
  const budget = isRecord(context.budget) ? context.budget : {};
  const week = Array.isArray(context.week) ? context.week.slice(0, MAX_DAYS).flatMap(day => {
    if (!isRecord(day)) return [];
    const label = cleanText(day.day, 20);
    return label ? [{ day: label, dish: cleanText(day.dish, 120) }] : [];
  }) : [];
  const lastChoices = Array.isArray(context.lastChoices) ? context.lastChoices.slice(0, MAX_ITEMS).flatMap(choice => {
    if (!isRecord(choice)) return [];
    const label = cleanText(choice.label, 80);
    const names = Array.isArray(choice.names) ? choice.names.slice(0, MAX_CHOICES).flatMap(name => cleanText(name, 120) ?? []) : [];
    return label ? [{ label, names }] : [];
  }) : [];
  return {
    list,
    budget: {
      budgetCents: cents(budget.budgetCents),
      plannedCents: cents(budget.plannedCents) ?? 0,
      remainingCents: cents(budget.remainingCents),
      missingPrices: cents(budget.missingPrices) ?? 0,
    },
    week,
    lastChoices,
  };
}

/** Controleert wat de app stuurt; alles wat niet klopt valt weg of geeft null. */
export function parseAssistantRequest(value: unknown): AssistantRequest | null {
  if (!isRecord(value)) return null;
  let audio: AssistantRequest["audio"] = null;
  if (isRecord(value.audio)) {
    const data = typeof value.audio.data === "string" ? value.audio.data : "";
    const mimeType = typeof value.audio.mimeType === "string" ? value.audio.mimeType.split(";")[0].trim().toLowerCase() : "";
    if (!data || !/^[A-Za-z0-9+/]+=*$/.test(data) || data.length * 0.75 > MAX_AUDIO_BYTES) return null;
    if (!AUDIO_TYPES.includes(mimeType)) return null;
    audio = { data, mimeType: mimeType === "audio/x-m4a" ? "audio/mp4" : mimeType };
  }
  const text = cleanText(value.text, MAX_TEXT_LENGTH);
  if (!audio && !text) return null;
  const history = Array.isArray(value.history) ? value.history.slice(-MAX_HISTORY).flatMap(turn => {
    if (!isRecord(turn) || (turn.role !== "user" && turn.role !== "maatje")) return [];
    const turnText = cleanText(turn.text, MAX_TEXT_LENGTH);
    return turnText ? [{ role: turn.role, text: turnText } as AssistantTurn] : [];
  }) : [];
  return { audio, text, history, context: parseContext(value.context) };
}

const SYSTEM_PROMPT = `Je bent Maatje, de vrolijke boodschappenmaatje in de app BoodschappenMaatje. Je praat Nederlands, kort en hartelijk (maximaal twee zinnen), zonder emoji.

De gebruiker praat of typt tegen je. Je taken:
1. Schrijf in "heard" precies op wat de gebruiker zei of typte, netjes geschreven.
2. Wil de gebruiker iets kopen of op de lijst zetten, maak dan per product een item: "label" is wat de gebruiker wil (bijv. "halfvolle melk"), "quantity" het aantal (standaard 1), en "terms" één tot drie korte Nederlandse zoektermen voor de Hoogvliet-catalogus, van precies naar algemeen (bijv. ["halfvolle melk", "melk"]). Maximaal vijf items.
3. Verfijnt de gebruiker een eerdere keuze ("nee, de halfvolle", "liever een grotere"), maak dan een nieuw item met verfijnde zoektermen. De vorige keuzes staan in de context onder lastChoices.
4. Stelt de gebruiker een vraag over de boodschappenlijst, het budget of het weekmenu, beantwoord die in "reply" en gebruik daarvoor uitsluitend de context. Bedragen in de context zijn in centen; schrijf ze als euro's, bijvoorbeeld € 12,50. Staat iets niet in de context, zeg dan eerlijk dat je het niet weet.

Strenge regels:
- Noem in "reply" nooit zelf productnamen, merken, pakgroottes of prijzen van producten die niet in de context staan. De app zoekt de echte producten erbij en laat ze als kaartjes zien.
- Bij producten zeg je in "reply" alleen iets als "Ik heb een paar keuzes voor je gevonden, tik aan wat je wilt."
- Zeg nooit dat je iets al op de lijst hebt gezet; de gebruiker kiest dat zelf.
- Verstond je niets bruikbaars, laat "items" leeg en vraag vriendelijk of de gebruiker het nog eens wil zeggen.`;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    heard: { type: "STRING" },
    reply: { type: "STRING" },
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          label: { type: "STRING" },
          quantity: { type: "INTEGER" },
          terms: { type: "ARRAY", items: { type: "STRING" } },
        },
        required: ["label", "quantity", "terms"],
      },
    },
  },
  required: ["heard", "reply", "items"],
};

export function buildGeminiBody(request: AssistantRequest): unknown {
  const contents = request.history.map(turn => ({
    role: turn.role === "user" ? "user" : "model",
    parts: [{ text: turn.text }],
  }));
  const parts: unknown[] = [{ text: `Context (JSON, bedragen in centen):\n${JSON.stringify(request.context)}` }];
  if (request.audio) parts.push({ inlineData: { mimeType: request.audio.mimeType, data: request.audio.data } });
  parts.push({ text: request.text ? `De gebruiker typte: ${request.text}` : "De gebruiker sprak het bericht hierboven in." });
  contents.push({ role: "user", parts: parts as { text: string }[] });
  return {
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents,
    generationConfig: { temperature: 0.3, responseMimeType: "application/json", responseSchema: RESPONSE_SCHEMA },
  };
}

/** Leest het antwoord van Gemini; alles buiten het afgesproken formaat valt weg. */
export function parseGeminiPlan(response: unknown): GeminiPlan | null {
  if (!isRecord(response) || !Array.isArray(response.candidates)) return null;
  const candidate = response.candidates[0];
  const content = isRecord(candidate) && isRecord(candidate.content) ? candidate.content : null;
  const parts = content && Array.isArray(content.parts) ? content.parts : [];
  const raw = parts.map(part => (isRecord(part) && typeof part.text === "string" ? part.text : "")).join("");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(parsed)) return null;
  const items = Array.isArray(parsed.items) ? parsed.items.slice(0, MAX_ITEMS).flatMap(item => {
    if (!isRecord(item)) return [];
    const label = cleanText(item.label, 80);
    const terms = Array.isArray(item.terms) ? item.terms.slice(0, 3).flatMap(term => cleanText(term, 60) ?? []) : [];
    if (!label || !terms.length) return [];
    const quantity = typeof item.quantity === "number" && Number.isFinite(item.quantity) ? Math.min(20, Math.max(1, Math.round(item.quantity))) : 1;
    return [{ label, quantity, terms }];
  }) : [];
  return {
    heard: cleanText(parsed.heard, MAX_TEXT_LENGTH) ?? "",
    reply: cleanText(parsed.reply, 300) ?? "",
    items,
  };
}

async function findChoices(catalog: CatalogRepository, terms: string[], now: Date): Promise<AssistantChoice[]> {
  const seen = new Set<string>();
  const choices: AssistantChoice[] = [];
  for (const term of terms) {
    const result = await catalog.query({ term, page: 1, pageSize: 12 });
    for (const product of result.products) {
      if (product.isAvailable === false || seen.has(product.id)) continue;
      seen.add(product.id);
      const price = resolveCurrentPrice(product.currentPrice, now);
      choices.push({ product, priceCents: price ? Math.round(price.amount * 100) : null });
      if (choices.length >= MAX_CHOICES) return choices;
    }
    // Genoeg keuzes met de preciezere term: niet verbreden.
    if (choices.length >= 2) return choices;
  }
  return choices;
}

export async function runMaatjeAssistant(
  request: AssistantRequest,
  callGemini: GeminiCall,
  catalog: CatalogRepository,
  now = new Date(),
): Promise<AssistantResponse> {
  const plan = parseGeminiPlan(await callGemini(buildGeminiBody(request)));
  if (!plan) throw new Error("gemini-invalid-response");
  const items: AssistantItem[] = [];
  for (const item of plan.items) {
    items.push({ label: item.label, quantity: item.quantity, choices: await findChoices(catalog, item.terms, now) });
  }
  let reply = plan.reply || "Wat kan ik voor je doen?";
  if (items.length) {
    const missing = items.filter(item => !item.choices.length).map(item => item.label);
    const found = items.length - missing.length;
    if (!found) reply = `Ik kon ${missing.join(" en ")} niet vinden bij Hoogvliet. Zeg het eens anders?`;
    else if (missing.length) reply = `Tik aan wat je wilt. ${missing.join(" en ")} kon ik niet vinden bij Hoogvliet.`;
    else reply = items.length === 1 ? "Ik heb een paar keuzes voor je. Tik aan wat je wilt!" : "Hier zijn je keuzes. Tik per product aan wat je wilt!";
  }
  return { heard: plan.heard || request.text || "", reply, items };
}

const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";

/** Een Gemini-model dat het werkt, onthouden zodat we niet steeds hoeven te zoeken. */
let workingModel: string | null = null;

/** Kiest het nieuwste gewone "flash"-model (geen live, spraak, beeld of preview). */
export function pickFlashModel(models: unknown): string | null {
  const list = (models as { models?: { name?: unknown; supportedGenerationMethods?: unknown }[] })?.models;
  if (!Array.isArray(list)) return null;
  const names = list
    .filter(model => Array.isArray(model.supportedGenerationMethods) && model.supportedGenerationMethods.includes("generateContent"))
    .map(model => (typeof model.name === "string" ? model.name.replace(/^models\//, "") : ""))
    .filter(name => /^gemini-[\d.]+-flash$/.test(name) || name === "gemini-flash-latest");
  const version = (name: string) => Number(name.match(/^gemini-([\d.]+)/)?.[1]?.split(".").slice(0, 2).join(".") ?? 0);
  names.sort((a, b) => version(b) - version(a));
  return names[0] ?? null;
}

export function geminiCaller(apiKey: string, model: string, fetchImpl: typeof fetch = fetch): GeminiCall {
  const headers = { "content-type": "application/json", "x-goog-api-key": apiKey };
  const generate = (name: string, body: unknown) => fetchImpl(`${GEMINI_API}/models/${encodeURIComponent(name)}:generateContent`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(25_000),
  });
  return async body => {
    let response = await generate(workingModel ?? model, body);
    if (response.status === 404) {
      // Google hernoemt of stopt modellen; zoek dan zelf het nieuwste flash-model.
      const list = await fetchImpl(`${GEMINI_API}/models?pageSize=200`, { headers, signal: AbortSignal.timeout(10_000) });
      const fallback = list.ok ? pickFlashModel(await list.json()) : null;
      if (!fallback) throw new Error("gemini-model-not-found");
      console.warn("maatje-praten", `model ${workingModel ?? model} niet gevonden, gebruik ${fallback}`);
      workingModel = fallback;
      response = await generate(fallback, body);
    }
    if (!response.ok) throw new Error(`gemini-http-${response.status}`);
    return response.json();
  };
}
