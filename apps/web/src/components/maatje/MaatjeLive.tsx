"use client";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { MaatjeSceneController } from "./maatje-scene";
import "./maatje-live.css";

const GREETING = "Hoi! Ik ben wakker! Tik op me of draai me rond.";
const TAP_LINES = [
  "Hihi, dat kietelt!",
  "Samen slim boodschappen doen?",
  "Wiehoe! Nog een keer?",
  "Binnenkort kun je met me praten.",
  "Ik hou je budget goed in de gaten!",
];

/** Waar Maatje naartoe komt: midden in beeld, flink groter. */
function targetRect(): DOMRect {
  const width = Math.min(window.innerWidth * 0.84, 400);
  const centerY = window.innerHeight * 0.5;
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
}

/**
 * Maatje ligt al in 3D op Home te slapen. Tik je op hem, dan wordt hij op
 * dezelfde plek wakker, stapt naar voren en wordt groter. Er komt geen laag
 * of waas over de app. Tik naast hem en hij gaat terug en dommelt weer in.
 */
export function MaatjeLive({ anchor, awake, onReady, onAsleep }: MaatjeLiveProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MaatjeSceneController | null>(null);
  const closingRef = useRef(false);
  const [loaded, setLoaded] = useState(false);
  const [greeted, setGreeted] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [speech, setSpeech] = useState({ line: GREETING, shown: 0 });
  const [target, setTarget] = useState(targetRect);
  const { line } = speech;
  const bubbleVisible = awake && greeted && !leaving;

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setLeaving(true);
    const finish = () => {
      closingRef.current = false;
      setLeaving(false);
      setGreeted(false);
      onAsleep();
    };
    const controller = controllerRef.current;
    if (controller) void controller.close().then(finish);
    else finish();
  }, [onAsleep]);

  // De scène wordt één keer opgebouwd, rustig nadat Home getekend is.
  useEffect(() => {
    const element = stageRef.current;
    if (!element || !supportsWebGl()) return;
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
          setSpeech({ line: TAP_LINES[next], shown: 0 });
        },
        onTapOutside: () => close(),
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
    const idle = window.requestIdleCallback?.(start, { timeout: 1200 });
    const timer = idle === undefined ? window.setTimeout(start, 300) : undefined;
    return () => {
      cancelled = true;
      if (idle !== undefined) window.cancelIdleCallback(idle);
      if (timer !== undefined) window.clearTimeout(timer);
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Wakker worden: hij komt naar voren, daarna verschijnt zijn groet.
  useEffect(() => {
    if (!awake || !loaded) return;
    controllerRef.current?.wake();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(() => {
      setSpeech({ line: GREETING, shown: 0 });
      setGreeted(true);
    }, reducedMotion ? 200 : 1700);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onResize = () => setTarget(targetRect());
    // Safari schuift anders de adresbalk en de pagina mee als je Maatje ronddraait.
    const stage = stageRef.current?.parentElement;
    const onTouchMove = (event: TouchEvent) => event.preventDefault();
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
  }, [awake, loaded, close]);

  // Tekst verschijnt letter voor letter terwijl Maatje "praat".
  useEffect(() => {
    if (!bubbleVisible) return;
    let index = 0;
    controllerRef.current?.setTalking(true);
    const timer = window.setInterval(() => {
      index += 1;
      setSpeech(current => current.line === line ? { line, shown: index } : current);
      if (index >= line.length) {
        window.clearInterval(timer);
        controllerRef.current?.setTalking(false);
      }
    }, 38);
    return () => {
      window.clearInterval(timer);
      controllerRef.current?.setTalking(false);
    };
  }, [line, bubbleVisible]);

  const bubbleBottom = typeof window === "undefined" ? 0 : window.innerHeight - (target.top + target.width * 0.06);
  return <div className="maatje-live" role={awake ? "dialog" : undefined} aria-modal={awake || undefined} aria-label={awake ? "Maatje" : undefined} aria-hidden={!awake || undefined} data-awake={awake} data-leaving={leaving}>
    <div ref={stageRef} className="maatje-live-stage" />
    <p className="maatje-live-bubble" aria-live="polite" data-visible={bubbleVisible} style={{ bottom: bubbleBottom }}>
      <span aria-hidden="true">{line.slice(0, speech.shown) || " "}</span>
      <span className="maatje-live-sr-only">{bubbleVisible ? line : ""}</span>
    </p>
    {/* Alleen voor toetsenbord en VoiceOver; op het scherm tik je naast Maatje. */}
    {awake ? <button type="button" className="maatje-live-close" onClick={close}>Laat Maatje teruggaan</button> : null}
  </div>;
}
