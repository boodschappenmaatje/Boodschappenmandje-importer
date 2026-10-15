"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { MaatjeSceneController } from "./maatje-scene";
import "./maatje-stage.css";

const GREETING = "Hoi! Ik ben Maatje. Tik op me of draai me rond!";
const TAP_LINES = [
  "Hihi, dat kietelt!",
  "Samen slim boodschappen doen?",
  "Wiehoe! Nog een keer?",
  "Binnenkort kun je met me praten.",
  "Ik hou je budget goed in de gaten!",
];

function supportsWebGl(): boolean {
  try {
    const probe = document.createElement("canvas");
    return Boolean(probe.getContext("webgl2") ?? probe.getContext("webgl"));
  } catch {
    return false;
  }
}

interface MaatjeStageProps {
  onClose: () => void;
}

/** Schermvullende 3D-Maatje die verschijnt als je op de mascotte tikt. */
export function MaatjeStage({ onClose }: MaatjeStageProps) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<MaatjeSceneController | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "unsupported">(() => supportsWebGl() ? "loading" : "unsupported");
  const [speech, setSpeech] = useState({ line: GREETING, shown: 0 });
  const { line } = speech;
  const typed = line.slice(0, speech.shown);
  const [leaving, setLeaving] = useState(false);

  const close = useCallback(() => {
    setLeaving(true);
    window.setTimeout(onClose, 220);
  }, [onClose]);

  const say = useCallback((text: string) => {
    setSpeech({ line: text, shown: 0 });
  }, []);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [close]);

  useEffect(() => {
    let cancelled = false;
    const element = sceneRef.current;
    if (!element || status === "unsupported") return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let lastLine = -1;
    import("./maatje-scene").then(({ createMaatjeScene }) => {
      if (cancelled) return;
      controllerRef.current = createMaatjeScene(element, {
        reducedMotion,
        onTap: () => {
          let next = Math.floor(Math.random() * TAP_LINES.length);
          if (next === lastLine) next = (next + 1) % TAP_LINES.length;
          lastLine = next;
          say(TAP_LINES[next]);
        },
      });
      setStatus("ready");
    }).catch(() => {
      if (!cancelled) setStatus("unsupported");
    });
    return () => {
      cancelled = true;
      controllerRef.current?.dispose();
      controllerRef.current = null;
    };
    // De scène wordt één keer opgebouwd; status wijzigt alleen daarna.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [say]);

  // Tekst verschijnt letter voor letter terwijl Maatje "praat".
  useEffect(() => {
    if (status !== "ready") return;
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
  }, [line, status]);

  return <div className="maatje-stage" role="dialog" aria-modal="true" aria-label="Maatje in 3D" data-leaving={leaving}>
    <button ref={closeRef} type="button" className="maatje-stage-close" onClick={close} aria-label="Sluit Maatje">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
    </button>
    <p className="maatje-stage-bubble" aria-live="polite" data-visible={status === "ready"}>
      <span aria-hidden="true">{typed || " "}</span>
      <span className="maatje-stage-sr-only">{line}</span>
    </p>
    <div ref={sceneRef} className="maatje-stage-scene" data-status={status}>
      {status === "unsupported" ? <p className="maatje-stage-fallback">Dit toestel kan Maatje helaas niet in 3D tonen.</p> : null}
    </div>
    <p className="maatje-stage-hint">Tik op Maatje of veeg om hem rond te draaien</p>
  </div>;
}
