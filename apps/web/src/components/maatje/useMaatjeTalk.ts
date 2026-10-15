"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { useWeekPreparation } from "@/features/week-preparation/WeekPreparationProvider";
import type { AssistantItem } from "@/server/maatje-assistant";
import type { Product } from "@/types/catalog";
import {
  addedMessage,
  AssistantError,
  assistantErrorMessage,
  askMaatje,
  buildAssistantContext,
  type AssistantTurn,
} from "./maatje-assistant-client";
import { rememberChoice, sortByFavorites } from "./maatje-favorites";
import { blobToBase64, startVoiceRecording, VoiceError, voiceSupported, type VoiceRecording } from "./maatje-voice";

export type TalkMood = "idle" | "listening" | "thinking";

export interface MaatjeBudget {
  budgetCents: number | null;
  plannedCents: number;
  missingPrices: number;
}

const MIN_RECORDING_MS = 450;
const MAX_RECORDING_MS = 30_000;

/**
 * Praten met Maatje: vasthouden is opnemen, loslaten is versturen. Zonder
 * microfoon kun je typen. Producten komen pas op je lijst als je ze aantikt.
 */
export function useMaatjeTalk(budget: MaatjeBudget, say: (line: string, instant?: boolean) => void) {
  const shoppingList = useActiveShoppingList();
  const week = useWeekPreparation();
  const [mood, setMood] = useState<TalkMood>("idle");
  const [heard, setHeard] = useState<string | null>(null);
  const [items, setItems] = useState<AssistantItem[]>([]);
  /** Per productregel: hoe vaak elk product al op de lijst is gezet. */
  const [chosen, setChosen] = useState<Record<number, Record<string, number>>>({});
  const [typing, setTyping] = useState(false);
  const historyRef = useRef<AssistantTurn[]>([]);
  const recordingRef = useRef<Promise<VoiceRecording> | null>(null);
  const holdTimerRef = useRef<number | undefined>(undefined);
  const requestRef = useRef<AbortController | null>(null);
  const latest = useRef({ shoppingList, week, budget, items, say, mood, chosen });
  useLayoutEffect(() => {
    latest.current = { shoppingList, week, budget, items, say, mood, chosen };
  });

  const stopEverything = useCallback(() => {
    requestRef.current?.abort();
    recordingRef.current?.then(recording => recording.cancel(), () => undefined);
    recordingRef.current = null;
    window.clearTimeout(holdTimerRef.current);
    historyRef.current = [];
  }, []);

  /** Maatje gaat weer slapen: gesprek en keuzes verdwijnen. */
  const reset = useCallback(() => {
    stopEverything();
    setMood("idle");
    setHeard(null);
    setItems([]);
    setChosen({});
    setTyping(false);
  }, [stopEverything]);

  useEffect(() => stopEverything, [stopEverything]);

  const send = useCallback(async (message: { audio?: { data: string; mimeType: string }; text?: string }) => {
    const { shoppingList: list, week: weekState, budget: money, items: shown } = latest.current;
    requestRef.current?.abort();
    const controller = new AbortController();
    requestRef.current = controller;
    setMood("thinking");
    if (message.text) setHeard(message.text);
    latest.current.say("Even denken", true);
    const context = buildAssistantContext({
      list: list.list,
      preparation: weekState.preparation,
      budgetCents: money.budgetCents,
      plannedCents: money.plannedCents,
      missingPrices: money.missingPrices,
      lastChoices: shown.map(item => ({ label: item.label, names: item.choices.map(choice => choice.product.name) })),
    });
    try {
      const response = await askMaatje({ ...message, history: historyRef.current, context }, controller.signal);
      if (controller.signal.aborted) return;
      const userText = response.heard || message.text || "";
      historyRef.current = [...historyRef.current, ...(userText ? [{ role: "user" as const, text: userText }] : []), { role: "maatje" as const, text: response.reply }].slice(-8);
      setHeard(userText || null);
      if (response.items.length) {
        setItems(sortByFavorites(response.items, list.list?.items.map(item => item.productId) ?? []));
        setChosen({});
      }
      setMood("idle");
      latest.current.say(response.reply);
    } catch (error) {
      if (controller.signal.aborted) return;
      setMood("idle");
      latest.current.say(assistantErrorMessage(error instanceof AssistantError ? error.code : "failed"));
    }
  }, []);

  const holdEnd = useCallback(async (cancelled: boolean) => {
    window.clearTimeout(holdTimerRef.current);
    const pending = recordingRef.current;
    recordingRef.current = null;
    if (!pending) return;
    let recording: VoiceRecording;
    try {
      recording = await pending;
    } catch {
      return;
    }
    if (cancelled) {
      recording.cancel();
      setMood("idle");
      latest.current.say("Oké, laat maar.");
      return;
    }
    const result = await recording.stop();
    if (!result || result.durationMs < MIN_RECORDING_MS) {
      setMood("idle");
      latest.current.say("Houd me vast terwijl je praat, en laat los als je klaar bent.");
      return;
    }
    await send({ audio: { data: await blobToBase64(result.blob), mimeType: result.blob.type || "audio/mp4" } });
  }, [send]);

  const holdStart = useCallback(() => {
    if (latest.current.mood === "thinking") return;
    if (!voiceSupported()) {
      setTyping(true);
      latest.current.say("Praten lukt niet op dit toestel. Typ maar wat je wilt!");
      return;
    }
    requestRef.current?.abort();
    setMood("listening");
    latest.current.say("Ik luister…", true);
    const recording = startVoiceRecording();
    recordingRef.current = recording;
    recording.catch((error: unknown) => {
      if (recordingRef.current !== recording) return;
      recordingRef.current = null;
      setMood("idle");
      if (error instanceof VoiceError && error.code === "denied") {
        setTyping(true);
        latest.current.say("Ik mag je microfoon niet gebruiken. Typ maar wat je wilt!");
      } else latest.current.say("Ik kon je niet horen. Houd me nog eens vast?");
    });
    // Veiligheidsrem: na 30 seconden stopt hij vanzelf met luisteren.
    window.clearTimeout(holdTimerRef.current);
    holdTimerRef.current = window.setTimeout(() => void holdEnd(false), MAX_RECORDING_MS);
  }, [holdEnd]);


  const sendText = useCallback((text: string) => {
    const trimmed = text.trim();
    if (trimmed) void send({ text: trimmed });
  }, [send]);

  /**
   * Elke tik zet het product (nog eens) op je lijst. De eerste tik neemt het
   * aantal dat je noemde ("twee broden"), daarna telt elke tik er één bij.
   * Je kunt per regel ook meerdere verschillende producten kiezen.
   */
  const choose = useCallback(async (itemIndex: number, product: Product, priceCents: number | null) => {
    const { shoppingList: list, budget: money, items: shown, chosen: picked } = latest.current;
    const item = shown[itemIndex];
    if (!item || list.status !== "ready") return;
    const before = picked[itemIndex]?.[product.id] ?? 0;
    const adding = before === 0 ? item.quantity : 1;
    const count = (delta: number) => setChosen(current => {
      const row = { ...current[itemIndex] };
      const next = (row[product.id] ?? 0) + delta;
      if (next > 0) row[product.id] = next;
      else delete row[product.id];
      return { ...current, [itemIndex]: row };
    });
    count(adding);
    try {
      for (let index = 0; index < adding; index += 1) await list.addProduct(product);
    } catch {
      count(-adding);
      latest.current.say("Dat lukte niet. Probeer het nog eens?");
      return;
    }
    rememberChoice(product.id);
    const total = before + adding;
    // De lijst in latest is nog van vóór deze tik: tel het nieuwe er zelf bij.
    const plannedAfter = money.plannedCents + (priceCents ?? 0) * adding;
    latest.current.say(priceCents === null
      ? `${total > 1 ? `${total}× ` : ""}${product.name} staat op je lijst!`
      : addedMessage(product.name, total, money.budgetCents, plannedAfter));
  }, []);

  /** Het min-knopje: haalt er één af van wat je via Maatje op je lijst zette. */
  const takeBack = useCallback(async (itemIndex: number, product: Product) => {
    const { shoppingList: list, chosen: picked } = latest.current;
    const before = picked[itemIndex]?.[product.id] ?? 0;
    if (!before || list.status !== "ready") return;
    setChosen(current => {
      const row = { ...current[itemIndex] };
      if (before > 1) row[product.id] = before - 1;
      else delete row[product.id];
      return { ...current, [itemIndex]: row };
    });
    try {
      await list.adjustIndependent(product.id, -1);
    } catch {
      setChosen(current => ({ ...current, [itemIndex]: { ...current[itemIndex], [product.id]: before } }));
      latest.current.say("Dat lukte niet. Probeer het nog eens?");
      return;
    }
    latest.current.say(before > 1 ? `Eentje eraf. Nog ${before - 1}× ${product.name} op je lijst.` : `${product.name} staat niet meer op je lijst.`);
  }, []);

  return { mood, heard, items, chosen, typing, setTyping, holdStart, holdEnd, sendText, choose, takeBack, reset };
}
