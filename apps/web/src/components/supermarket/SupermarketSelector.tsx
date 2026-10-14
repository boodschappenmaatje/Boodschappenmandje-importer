"use client";

import { useState, useSyncExternalStore } from "react";
import Image from "next/image";

import { Icon } from "@/components/Icon";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { ACTIVE_SUPERMARKET_STORAGE_KEY } from "@/services/supermarket/active-supermarket";
import { SUPERMARKETS, type SupermarketId } from "@/types/supermarket";

const SUPERMARKET_LOGOS: Record<SupermarketId, string> = {
  hoogvliet: "/branding/supermarkets/hoogvliet.png",
  ah: "/branding/supermarkets/ah.png",
  jumbo: "/branding/supermarkets/jumbo.svg",
  lidl: "/branding/supermarkets/lidl.png",
  dirk: "/branding/supermarkets/dirk.png",
};

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
  const activeId = shoppingList.supermarketId;
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
        {hasChoice ? <Image src={SUPERMARKET_LOGOS[activeId]} alt="" width={28} height={28} className="supermarket-selector-logo" /> : null}
        <span>{hasChoice ? activeName : "Kies je supermarkt"}</span><span className="supermarket-selector-chevron" aria-hidden="true">▾</span>
      </button>
      {open || !hasChoice ? (
        <div className="supermarket-dialog-backdrop" role="presentation">
          <section className="supermarket-dialog" role="dialog" aria-modal="true" aria-labelledby="supermarket-dialog-title">
            {hasChoice ? <button className="supermarket-dialog-close" type="button" aria-label="Sluiten" onClick={() => setOpen(false)}>×</button> : null}
            <span className="supermarket-dialog-handle" aria-hidden="true" />
            <p className="eyebrow">{hasChoice ? "Je lijsten blijven apart" : "Welkom bij BoodschappenMaatje"}</p>
            <h2 id="supermarket-dialog-title">{hasChoice ? "Wissel van supermarkt" : "Kies je supermarkt"}</h2>
            <p className="supermarket-dialog-description">{hasChoice ? "Kies een winkel om je producten en boodschappenlijst te bekijken." : "Zoek producten, bekijk aanbiedingen en maak je boodschappenlijst."}</p>
            {Object.values(SUPERMARKETS).map((market) => (
              <button
                className={`supermarket-choice${market.catalogSupported ? " is-supported" : " is-future"}`}
                key={market.id}
                type="button"
                disabled={!market.catalogSupported || changing}
                aria-pressed={shoppingList.supermarketId === market.id && hasChoice}
                onClick={() => void choose(market.id)}
              >
                <span className="supermarket-choice-logo"><Image src={SUPERMARKET_LOGOS[market.id]} alt="" width={64} height={64} /></span>
                <span className="supermarket-choice-copy"><strong>{market.name}</strong><small>{market.catalogSupported ? "Producten en prijzen beschikbaar" : "Binnenkort beschikbaar"}</small></span>
                {shoppingList.supermarketId === market.id && hasChoice ? <span className="supermarket-choice-selected"><Icon name="check" size={14} />Gekozen</span> : market.catalogSupported ? <span className="supermarket-choice-chevron" aria-hidden="true">›</span> : <span className="supermarket-choice-coming-soon">Binnenkort</span>}
              </button>
            ))}
            {shoppingList.persistenceWarning ? <p role="alert">{shoppingList.persistenceWarning}</p> : null}
          </section>
        </div>
      ) : null}
    </>
  );
}
