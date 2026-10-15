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
export function useMaatjeTalk(budget: MaatjeBudget, say: (line: string) => void) {
  const shoppingList = useActiveShoppingList();
  const week = useWeekPreparation();
  const [mood, setMood] = useState<TalkMood>("idle");
  const [heard, setHeard] = useState<string | null>(null);
  const [items, setItems] = useState<AssistantItem[]>([]);
  const [chosen, setChosen] = useState<Record<number, string>>({});
  const [typing, setTyping] = useState(false);
  const historyRef = useRef<AssistantTurn[]>([]);
  const recordingRef = useRef<Promise<VoiceRecording> | null>(null);
  const holdTimerRef = useRef<number | undefined>(undefined);
  const requestRef = useRef<AbortController | null>(null);
  const latest = useRef({ shoppingList, week, budget, items, say, mood });
  useLayoutEffect(() => {
    latest.current = { shoppingList, week, budget, items, say, mood };
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
    latest.current.say("Even denken…");
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
        setItems(response.items);
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
    latest.current.say("Ik luister…");
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

  const choose = useCallback(async (itemIndex: number, product: Product, priceCents: number | null) => {
    const { shoppingList: list, budget: money, items: shown } = latest.current;
    const item = shown[itemIndex];
    if (!item || list.status !== "ready") return;
    setChosen(current => ({ ...current, [itemIndex]: product.id }));
    try {
      for (let count = 0; count < item.quantity; count += 1) await list.addProduct(product);
    } catch {
      setChosen(current => {
        const next = { ...current };
        delete next[itemIndex];
        return next;
      });
      latest.current.say("Dat lukte niet. Probeer het nog eens?");
      return;
    }
    const plannedAfter = money.plannedCents + (priceCents ?? 0) * item.quantity;
    latest.current.say(priceCents === null
      ? `${item.quantity > 1 ? `${item.quantity}× ` : ""}${product.name} staat op je lijst!`
      : addedMessage(product.name, item.quantity, money.budgetCents, plannedAfter));
  }, []);

  return { mood, heard, items, chosen, typing, setTyping, holdStart, holdEnd, sendText, choose, reset };
}
