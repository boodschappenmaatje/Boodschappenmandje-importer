"use client";

import { useState } from "react";

interface NewWeekControlProps {
  onStartNew: () => void;
  initiallyConfirming?: boolean;
}

export function NewWeekControl({
  onStartNew,
  initiallyConfirming = false,
}: NewWeekControlProps) {
  const [confirming, setConfirming] = useState(initiallyConfirming);

  return (
    <section className="dashboard-card new-week-card" aria-labelledby="new-week-title">
      <h2 id="new-week-title">Nieuwe week</h2>
      {confirming ? (
        <div
          className="new-week-confirm"
          role="group"
          aria-label="Nieuwe week starten bevestigen"
        >
          <p>
            Je huidige weekvoorbereiding wordt vervangen. Je actieve boodschappenlijst blijft staan.
          </p>
          <div>
            <button
              type="button"
              onClick={() => {
                onStartNew();
                setConfirming(false);
              }}
            >
              Ja, start nieuwe week
            </button>
            <button type="button" onClick={() => setConfirming(false)}>
              Annuleren
            </button>
          </div>
        </div>
      ) : (
        <button
          className="week-reset-button"
          type="button"
          onClick={() => setConfirming(true)}
        >
          Nieuwe week starten
        </button>
      )}
    </section>
  );
}

