"use client";

import { useState, type AnimationEvent, type CSSProperties } from "react";

import { MAATJE_INTRO_STORAGE_KEY } from "./intro-storage";

import "./maatje-intro.css";

const TITLE_LINES = ["Boodschappen", "Maatje"] as const;

const PAPER_PATH =
  "M112 62Q120.8 42 129.6 62Q138.4 82 147.2 62Q156 42 164.8 62Q173.6 82 182.4 62Q191.2 42 200 62Q208.8 82 217.6 62Q226.4 42 235.2 62Q244 82 252.8 62Q261.6 42 270.4 62Q279.2 82 288 62Q298 212 288 362Q279.2 342 270.4 362Q261.6 382 252.8 362Q244 342 235.2 362Q226.4 382 217.6 362Q208.8 342 200 362Q191.2 382 182.4 362Q173.6 342 164.8 362Q156 382 147.2 362Q138.4 342 129.6 362Q120.8 382 112 362Q122 212 112 62Z";
const MOUTH_PATH = "M168 208Q200 218 234 204C232 236 216 250 200 250C182 250 170 236 168 208Z";

function rememberIntroSeen() {
  try {
    window.sessionStorage.setItem(MAATJE_INTRO_STORAGE_KEY, "1");
  } catch {
    // Private mode or storage disabled: the intro simply plays again next time.
  }
  document.documentElement.dataset.maatjeIntro = "done";
}

function TitleLetters({ word, offset }: { word: string; offset: number }) {
  return Array.from(word).map((letter, index) => (
    <span
      key={index}
      className="mi-letter"
      style={{ "--i": offset + index } as CSSProperties}
    >
      {letter}
    </span>
  ));
}

function ThumbsUpHand({ side, transform }: { side: "left" | "right"; transform: string }) {
  return (
    <g className={`mi-hand-${side}`} transform={transform}>
      <g className="mi-hand-anim">
        <path className="mi-glove" d="M-8 -52C-16 -82 -10 -114 12 -116C34 -118 38 -94 31 -64C29 -56 26 -50 24 -48Z" />
        <rect className="mi-glove" x="-38" y="-62" width="74" height="66" rx="27" />
        <ellipse className="mi-glove-shade" cx="0" cy="-8" rx="26" ry="7" />
        <path className="mi-crease" d="M-36 -40Q-22 -34 -6 -40" />
        <path className="mi-crease" d="M-37 -20Q-22 -14 -5 -20" />
        <path className="mi-crease" d="M-4 -60Q8 -52 24 -60" />
      </g>
    </g>
  );
}

export function MaatjeIntroOverlay() {
  const [finished, setFinished] = useState(false);
  const [skipping, setSkipping] = useState(false);

  if (finished) return null;

  const handleAnimationEnd = (event: AnimationEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget || event.animationName !== "mi-exit") return;
    rememberIntroSeen();
    setFinished(true);
  };

  return (
    <div
      className="mi-overlay"
      aria-hidden="true"
      data-skip={skipping ? "true" : undefined}
      onClick={() => setSkipping(true)}
      onAnimationEnd={handleAnimationEnd}
    >
      <div className="mi-title">
        <span className="mi-line mi-line-1">
          <TitleLetters word={TITLE_LINES[0]} offset={0} />
        </span>
        <span className="mi-line mi-line-2">
          <TitleLetters word={TITLE_LINES[1]} offset={TITLE_LINES[0].length} />
          <svg className="mi-star" viewBox="0 0 24 24">
            <path d="M12 0C13 7 17 11 24 12C17 13 13 17 12 24C11 17 7 13 0 12C7 11 11 7 12 0Z" />
          </svg>
        </span>
      </div>

      <div className="mi-stage">
        <svg className="mi-svg" viewBox="20 36 360 356">
          <defs>
            <linearGradient id="mi-paper-fill" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#FFFFFF" />
              <stop offset="0.6" stopColor="#F7FAFE" />
              <stop offset="1" stopColor="#E3ECF8" />
            </linearGradient>
            <radialGradient id="mi-eye-fill" cx="0.4" cy="0.35" r="0.75">
              <stop offset="0" stopColor="#2B4596" />
              <stop offset="1" stopColor="#0E1B4D" />
            </radialGradient>
            <clipPath id="mi-mouth-clip">
              <path d={MOUTH_PATH} />
            </clipPath>
          </defs>

          <g className="mi-pop">
            <g className="mi-sway">
              <g className="mi-sparks">
                <path className="mi-spark" d="M64 154L79 174" />
                <path className="mi-spark" d="M38 204L60 207" />
              </g>
              <g className="mi-sparks">
                <path className="mi-spark" d="M336 154L321 174" />
                <path className="mi-spark" d="M362 204L340 207" />
              </g>

              <g transform="rotate(-6 200 212)">
                <path className="mi-paper" d={PAPER_PATH} />
                <path className="mi-brow" d="M146 130Q162 115 181 124" />
                <path className="mi-brow mi-brow-wink" d="M220 120Q238 107 255 119" />
                <g>
                  <ellipse cx="166" cy="168" rx="18.5" ry="24" fill="url(#mi-eye-fill)" />
                  <circle className="mi-shine" cx="172" cy="158" r="6.5" />
                  <circle className="mi-shine" cx="160" cy="180" r="2.6" />
                </g>
                <g className="mi-eye-open">
                  <ellipse cx="236" cy="163" rx="18.5" ry="24" fill="url(#mi-eye-fill)" />
                  <circle className="mi-shine" cx="242" cy="153" r="6.5" />
                  <circle className="mi-shine" cx="230" cy="175" r="2.6" />
                </g>
                <path className="mi-wink" d="M218 168Q236 148 254 166" />
                <ellipse className="mi-cheek" cx="141" cy="214" rx="17" ry="10" />
                <ellipse className="mi-cheek" cx="263" cy="206" rx="17" ry="10" />
                <path className="mi-ink" d={MOUTH_PATH} />
                <ellipse className="mi-tongue" cx="203" cy="246" rx="19" ry="11" clipPath="url(#mi-mouth-clip)" />
                <rect className="mi-receipt-line" x="150" y="276" width="104" height="13" rx="6.5" />
                <rect className="mi-receipt-line" x="150" y="302" width="66" height="13" rx="6.5" />
                <rect className="mi-receipt-line" x="228" y="302" width="30" height="13" rx="6.5" />
                <rect className="mi-receipt-line" x="150" y="328" width="76" height="13" rx="6.5" />
              </g>

              <ThumbsUpHand side="left" transform="translate(96 304) scale(0.95)" />
              <ThumbsUpHand side="right" transform="translate(306 297) scale(-0.95 0.95)" />
            </g>
          </g>
        </svg>
      </div>
    </div>
  );
}
