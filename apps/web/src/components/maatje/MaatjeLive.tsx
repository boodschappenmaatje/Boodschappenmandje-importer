"use client";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { MaatjeSceneController } from "./maatje-scene";
import "./maatje-live.css";

const GREETING = "Hoi! Tik op me of draai me rond!";
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
  /** Het Home-plaatje; Maatje komt daar vandaan en gaat daar weer naartoe. */
  anchor: RefObject<HTMLElement | null>;
  /** Verbergt het platte plaatje zodra de 3D-Maatje er precies overheen ligt. */
  onAnchorHidden: (hidden: boolean) => void;
  onClose: () => void;
}

/**
 * Maatje komt op Home zelf tot leven: hij stapt naar voren en wordt groter.
 * Er komt geen laag of waas over de app; alleen Maatje beweegt. Tik naast
 * hem en hij gaat terug naar zijn plek.
 */
export function MaatjeLive({ anchor, onAnchorHidden, onClose }: MaatjeLiveProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MaatjeSceneController | null>(null);
  const closingRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [speech, setSpeech] = useState({ line: GREETING, shown: 0 });
  const [target, setTarget] = useState(targetRect);
  const { line } = speech;

  const finish = useCallback(() => {
    onAnchorHidden(false);
    onClose();
  }, [onAnchorHidden, onClose]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setLeaving(true);
    const controller = controllerRef.current;
    if (controller) void controller.close().then(finish);
    else finish();
  }, [finish]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    const onResize = () => setTarget(targetRect());
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      document.body.style.overflow = overflow;
    };
  }, [close]);

  useEffect(() => {
    const element = stageRef.current;
    if (!element) return;
    if (!supportsWebGl()) {
      onClose();
      return;
    }
    let cancelled = false;
    let lastLine = -1;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    import("./maatje-scene")
      .then(({ createMaatjeScene }) => createMaatjeScene(element, {
        reducedMotion,
        anchor: () => anchor.current?.getBoundingClientRect() ?? targetRect(),
        target: targetRect,
        onReady: () => onAnchorHidden(true),
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
        window.setTimeout(() => !cancelled && setReady(true), reducedMotion ? 200 : 850);
      })
      .catch(() => {
        if (!cancelled) finish();
      });
    return () => {
      cancelled = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
    // De scène wordt één keer opgebouwd bij het openen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tekst verschijnt letter voor letter terwijl Maatje "praat".
  useEffect(() => {
    if (!ready || leaving) return;
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
  }, [line, ready, leaving]);

  const bubbleBottom = window.innerHeight - (target.top + target.width * 0.06);
  return <div className="maatje-live" role="dialog" aria-modal="true" aria-label="Maatje" data-leaving={leaving}>
    <div ref={stageRef} className="maatje-live-stage" />
    <p className="maatje-live-bubble" aria-live="polite" data-visible={ready && !leaving} style={{ bottom: bubbleBottom }}>
      <span aria-hidden="true">{line.slice(0, speech.shown) || " "}</span>
      <span className="maatje-live-sr-only">{line}</span>
    </p>
    {/* Alleen voor toetsenbord en VoiceOver; op het scherm tik je naast Maatje. */}
    <button type="button" className="maatje-live-close" onClick={close}>Laat Maatje teruggaan</button>
  </div>;
}
