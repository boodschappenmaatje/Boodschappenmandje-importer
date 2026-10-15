"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { MaatjeTalkPanel } from "./MaatjeTalkPanel";
import type { MaatjeSceneController } from "./maatje-scene";
import { hapticTick } from "./maatje-haptic";
import { useMaatjeTalk, type MaatjeBudget } from "./useMaatjeTalk";
import "./maatje-live.css";

const GREETING = "Hoi! Houd me vast en vertel wat je nodig hebt.";
const TAP_LINES = [
  "Hihi, dat kietelt!",
  "Houd me vast en zeg wat je nodig hebt!",
  "Wiehoe! Nog een keer?",
  "Vraag me maar iets over je lijst of je budget.",
  "Ik hou je budget goed in de gaten!",
];

/** Waar Maatje naartoe komt: boven in beeld, met onder hem ruimte voor keuzes. */
function targetRect(): DOMRect {
  const width = Math.min(window.innerWidth * 0.62, window.innerHeight * 0.34, 320);
  const centerY = window.innerHeight * 0.36;
  return new DOMRect(window.innerWidth / 2 - width / 2, centerY - width / 2, width, width);
}

function supportsWebGl(): boolean {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
  } catch {
    return false;
  }
}

interface MaatjeLiveProps {
  /** Het Home-plaatje; daar slaapt Maatje en daar gaat hij weer naartoe. */
  anchor: RefObject<HTMLElement | null>;
  /** Wordt Maatje nu wakker gemaakt (tik op Home)? */
  awake: boolean;
  /** De 3D-Maatje ligt precies over het plaatje; het platte plaatje mag weg. */
  onReady: () => void;
  /** Maatje is terug op zijn plek en slaapt weer. */
  onAsleep: () => void;
  /** Dit toestel kan geen 3D tonen; Maatje blijft een plaatje. */
  onUnsupported?: () => void;
  /** Budget zoals Home het toont, voor vragen en de budgetcheck. */
  budget: MaatjeBudget;
}

/**
 * Maatje ligt al in 3D op Home te slapen. Tik je op hem, dan wordt hij op
 * dezelfde plek wakker, stapt naar voren en wordt groter. Er komt geen laag
 * of waas over de app. Tik naast hem en hij gaat terug en dommelt weer in.
 */
export function MaatjeLive({ anchor, awake, onReady, onAsleep, onUnsupported, budget }: MaatjeLiveProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MaatjeSceneController | null>(null);
  const closingRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [speech, setSpeech] = useState({ line: GREETING, shown: 0, key: 0 });
  const [target, setTarget] = useState(targetRect);
  const { line, key: speechKey } = speech;
  const instantLine = speech.shown >= line.length;
  const bubbleVisible = awake && greeted && !leaving;
  // Korte statusregels ("Ik luister…") staan er meteen. Zo is het wolkje nooit
  // even leeg terwijl de telefoon de microfoon opstart.
  const say = useCallback((next: string, instant = false) => {
    setGreeted(true);
    setSpeech(current => ({ line: next, shown: instant ? next.length : 0, key: current.key + 1 }));
  }, []);
  const talk = useMaatjeTalk(budget, say);
  const talkRef = useRef(talk);
  useLayoutEffect(() => {
    talkRef.current = talk;
  });

  const onAsleepRef = useRef(onAsleep);
  useLayoutEffect(() => {
    onAsleepRef.current = onAsleep;
  });

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setLeaving(true);
    talkRef.current.reset();
    const finish = () => {
      closingRef.current = false;
      setLeaving(false);
      setGreeted(false);
      onAsleepRef.current();
    };
    const controller = controllerRef.current;
    if (controller) void controller.close().then(finish);
    else finish();
  }, []);

  // De scène wordt één keer opgebouwd, rustig nadat Home getekend is.
  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    if (!supportsWebGl()) {
      onUnsupported?.();
      return;
    }
    let cancelled = false;
    let lastLine = -1;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = () => import("./maatje-scene")
      .then(({ createMaatjeScene }) => createMaatjeScene(element, {
        reducedMotion,
        anchor: () => anchor.current?.getBoundingClientRect() ?? targetRect(),
        target: targetRect,
        onReady: () => !cancelled && onReady(),
        onTap: () => {
          let next = Math.floor(Math.random() * TAP_LINES.length);
          if (next === lastLine) next = (next + 1) % TAP_LINES.length;
          lastLine = next;
          say(TAP_LINES[next]);
        },
        onTapOutside: () => close(),
        onRelease: hapticTick,
        onHoldStart: () => talkRef.current.holdStart(),
        onHoldEnd: cancelled => void talkRef.current.holdEnd(cancelled),
      }))
      .then(controller => {
        if (cancelled) {
          controller.dispose();
          return;
        }
        controllerRef.current = controller;
        setLoaded(true);
      })
      .catch(() => undefined);
    let idle: number | undefined;
    let timer: number | undefined;
    const schedule = () => {
      if (cancelled || idle !== undefined || timer !== undefined) return;
      idle = window.requestIdleCallback?.(start, { timeout: 1200 });
      if (idle === undefined) timer = window.setTimeout(start, 300);
    };
    // Het opbouwen van de scène houdt de telefoon even bezig. Tijdens de
    // opstartintro zou die daardoor haperen, dus we wachten tot die klaar is.
    const root = document.documentElement;
    const introDone = () => root.dataset.maatjeIntro === "done";
    const observer = new MutationObserver(() => {
      if (!introDone()) return;
      observer.disconnect();
      schedule();
    });
    let fallback: number | undefined;
    if (introDone()) schedule();
    else {
      observer.observe(root, { attributes: true, attributeFilter: ["data-maatje-intro"] });
      fallback = window.setTimeout(schedule, 8000);
    }
    return () => {
      cancelled = true;
      observer.disconnect();
      if (fallback !== undefined) window.clearTimeout(fallback);
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Slapend scrollt het canvas met de pagina mee; wakker staat het vast in
  // beeld. Direct na die wissel tekenen we opnieuw, vóór het scherm ververst,
  // zodat Maatje geen beeldje verspringt.
  useLayoutEffect(() => {
    controllerRef.current?.redraw();
  }, [awake]);

  // Wakker worden: hij komt naar voren, daarna verschijnt zijn groet.
  useEffect(() => {
    if (!awake || !loaded) return;
    controllerRef.current?.wake();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      say(GREETING);
    }, reducedMotion ? 200 : 2800);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onResize = () => setTarget(targetRect());
    // Safari schuift anders de adresbalk en de pagina mee als je Maatje vasthoudt.
    // De keuzes eronder mogen wel scrollen.
    const stage = stageRef.current?.parentElement;
    const onTouchMove = (event: TouchEvent) => {
      if (!(event.target instanceof Element && event.target.closest(".maatje-talk"))) event.preventDefault();
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    stage?.addEventListener("touchmove", onTouchMove, { passive: false });
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      stage?.removeEventListener("touchmove", onTouchMove);
      document.body.style.overflow = overflow;
    };
  }, [awake, loaded, close, say]);

  useEffect(() => {
    controllerRef.current?.setMood(talk.mood);
  }, [talk.mood]);

  // Tekst verschijnt letter voor letter terwijl Maatje "praat".
  useEffect(() => {
    if (!bubbleVisible || instantLine) return;
    let index = 0;
    controllerRef.current?.setTalking(true);
    const timer = window.setInterval(() => {
      index += 1;
      setSpeech(current => current.key === speechKey ? { ...current, shown: index } : current);
      if (index >= line.length) {
        window.clearInterval(timer);
        controllerRef.current?.setTalking(false);
      }
    }, 38);
    return () => {
      window.clearInterval(timer);
      controllerRef.current?.setTalking(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- alleen bij een nieuwe regel
  }, [line, speechKey, bubbleVisible]);

  const bubbleTop = target.top + target.width * 0.06;
  return createPortal(<div className="maatje-live" role={awake ? "dialog" : undefined} aria-modal={awake || undefined} aria-label={awake ? "Maatje" : undefined} aria-hidden={!awake || undefined} data-awake={awake} data-leaving={leaving}>
    <div ref={stageRef} className="maatje-live-stage" />
    <p className="maatje-live-bubble" aria-live="polite" data-visible={bubbleVisible} data-mood={talk.mood} style={{ top: bubbleTop }}>
      {talk.heard ? <span className="maatje-live-heard">Jij: “{talk.heard}”</span> : null}
      {/* De hele zin staat er onzichtbaar onder, zodat het wolkje meteen de
          goede maat heeft en niet krimpt of groeit tijdens het typen. */}
      <span className="maatje-live-line" aria-hidden="true">
        <span className="maatje-live-line-full">{line || " "}</span>
        <span>{line.slice(0, speech.shown)}</span>
      </span>
      <span className="maatje-live-sr-only">{bubbleVisible ? line : ""}</span>
    </p>
    {awake && greeted && !leaving ? <MaatjeTalkPanel talk={talk} top={target.top + target.height + 8} /> : null}
    {/* Alleen voor toetsenbord en VoiceOver; op het scherm tik je naast Maatje. */}
    {awake ? <button type="button" className="maatje-live-close" onClick={close}>Laat Maatje teruggaan</button> : null}
  </div>, document.body);
}
