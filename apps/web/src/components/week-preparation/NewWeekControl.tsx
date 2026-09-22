"use client";

import { useState } from "react";

interface NewWeekControlProps {
  onStartNew: () => Promise<void>;
  initiallyConfirming?: boolean;
}

export function NewWeekControl({
  onStartNew,
  initiallyConfirming = false,
}: NewWeekControlProps) {
  const [confirming, setConfirming] = useState(initiallyConfirming);
  const [starting, setStarting] = useState(false);

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
            Je huidige week wordt vervangen. Handmatige boodschappen blijven staan;
            boodschappen die alleen voor deze maaltijdweek nodig waren worden opgeruimd.
          </p>
          <div>
            <button
              type="button"
              disabled={starting}
              onClick={async () => {
                setStarting(true);
                try {
                  await onStartNew();
                  setConfirming(false);
                } finally {
                  setStarting(false);
                }
              }}
            >
              {starting ? "Nieuwe week starten…" : "Ja, start nieuwe week"}
            </button>
            <button
              type="button"
              disabled={starting}
              onClick={() => setConfirming(false)}
            >
              Annuleren
            </button>
          </div>
        </div>
      ) : (
        <button
          className="secondary-action week-reset-button"
          type="button"
          onClick={() => setConfirming(true)}
        >
          Nieuwe week
        </button>
      )}
    </section>
  );
}
