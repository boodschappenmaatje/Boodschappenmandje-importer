"use client";

import { useState, useSyncExternalStore } from "react";

import { Icon } from "@/components/Icon";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { ACTIVE_SUPERMARKET_STORAGE_KEY } from "@/services/supermarket/active-supermarket";
import { SUPERMARKETS, type SupermarketId } from "@/types/supermarket";

export function SupermarketSelector() {
  const shoppingList = useActiveShoppingList();
  const [open, setOpen] = useState(false);
  const storedChoice = useSyncExternalStore(
    () => () => undefined,
    () => {
      try { return Boolean(window.localStorage.getItem(ACTIVE_SUPERMARKET_STORAGE_KEY)); }
      catch { return false; }
    },
    () => true,
  );
  const [choiceMade, setChoiceMade] = useState(false);
  const hasChoice = storedChoice || choiceMade;
  const [changing, setChanging] = useState(false);

  async function choose(id: SupermarketId) {
    if (!SUPERMARKETS[id].catalogSupported || changing) return;
    setChanging(true);
    const changed = await shoppingList.setActiveSupermarket(id);
    if (changed) {
      setChoiceMade(true);
      setOpen(false);
    }
    setChanging(false);
  }

  const activeName = SUPERMARKETS[shoppingList.supermarketId].name;
  return (
    <>
      <button
        className="supermarket-selector"
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open || !hasChoice}
        onClick={() => setOpen(true)}
        disabled={shoppingList.status === "loading"}
      >
        <span>{hasChoice ? activeName : "Kies je supermarkt"}</span><span aria-hidden="true">▾</span>
      </button>
      {open || !hasChoice ? (
        <div className="supermarket-dialog-backdrop" role="presentation">
          <section className="supermarket-dialog" role="dialog" aria-modal="true" aria-labelledby="supermarket-dialog-title">
            {hasChoice ? <button className="supermarket-dialog-close" type="button" aria-label="Sluiten" onClick={() => setOpen(false)}>×</button> : null}
            <p className="eyebrow">{hasChoice ? "Je lijsten blijven per winkel apart" : "Kies je winkel"}</p>
            <h2 id="supermarket-dialog-title">{hasChoice ? "Wissel van supermarkt" : "Waar doe je boodschappen?"}</h2>
            <p className="supermarket-dialog-description">Kies een winkel voor je producten en boodschappenlijst.</p>
            {Object.values(SUPERMARKETS).map((market) => (
              <button
                className={`supermarket-choice${market.catalogSupported ? " is-supported" : " is-future"}`}
                key={market.id}
                type="button"
                disabled={!market.catalogSupported || changing}
                aria-pressed={shoppingList.supermarketId === market.id && hasChoice}
                onClick={() => void choose(market.id)}
              >
                <span className="supermarket-choice-mark" aria-hidden="true"><Icon name={market.catalogSupported ? "check" : "store"} size={20} /></span>
                <span className="supermarket-choice-copy"><strong>{market.name}</strong><small>{market.catalogSupported ? "Producten en prijzen beschikbaar" : "Binnenkort"}</small></span>
                {shoppingList.supermarketId === market.id && hasChoice ? <span className="supermarket-choice-selected">Gekozen</span> : null}
              </button>
            ))}
            {shoppingList.persistenceWarning ? <p role="alert">{shoppingList.persistenceWarning}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
