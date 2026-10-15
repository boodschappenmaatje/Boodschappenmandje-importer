"use client";
import { useState, type FormEvent } from "react";
import { ProductThumbnail } from "@/components/ui/ProductThumbnail";
import { formatCents } from "@/services/budget/budget-engine";
import { splitChoiceNames } from "./maatje-names";
import type { useMaatjeTalk } from "./useMaatjeTalk";

interface MaatjeTalkPanelProps {
  talk: ReturnType<typeof useMaatjeTalk>;
  /** Waar het paneel begint: net onder Maatje. */
  top: number;
}

/** Onder Maatje: een hint, de productkeuzes en (indien nodig) typen. */
export function MaatjeTalkPanel({ talk, top }: MaatjeTalkPanelProps) {
  const [text, setText] = useState("");
  const submit = (event: FormEvent) => {
    event.preventDefault();
    talk.sendText(text);
    setText("");
  };
  return <div className="maatje-talk" style={{ top }} data-has-items={talk.items.length > 0} data-mood={talk.mood}>
    {talk.items.length ? <div className="maatje-talk-items">
      {talk.items.map((item, itemIndex) => <section key={`${itemIndex}-${item.label}`} className="maatje-talk-item" aria-label={item.label}>
        <h3>{item.quantity > 1 ? `${item.quantity}× ` : ""}{item.label}</h3>
        {item.choices.length ? <ul className="maatje-talk-choices">
          {item.choices.map((choice, choiceIndex) => {
            const name = splitChoiceNames(item.choices.map(option => option.product))[choiceIndex];
            const count = talk.chosen[itemIndex]?.[choice.product.id] ?? 0;
            const picked = count > 0;
            return <li key={choice.product.id}>
              <button
                type="button"
                className="maatje-talk-choice"
                data-picked={picked}
                aria-label={`${choice.product.name}${picked ? `, ${count} op je lijst` : ""}. Tik om toe te voegen.`}
                onClick={() => void talk.choose(itemIndex, choice.product, choice.priceCents)}
              >
                <ProductThumbnail className="maatje-talk-thumb" imageUrl={choice.product.imageUrl} name={choice.product.name} />
                {name.top ? <span className="maatje-talk-brand">{name.top}</span> : null}
                <strong>{name.main}</strong>
                {choice.product.packageText ? <small>{choice.product.packageText}</small> : null}
                <span className="maatje-talk-price">{choice.priceCents === null ? "Prijs onbekend" : formatCents(choice.priceCents)}</span>
                {picked ? <span className="maatje-talk-check">{count}× op je lijst</span> : null}
              </button>
              {picked ? <button
                type="button"
                className="maatje-talk-minus"
                aria-label={`Eén ${choice.product.name} van je lijst halen`}
                onClick={() => void talk.takeBack(itemIndex, choice.product)}
              >−</button> : null}
            </li>;
          })}
        </ul> : <p className="maatje-talk-empty">Niet gevonden bij Hoogvliet.</p>}
      </section>)}
    </div> : null}
    {talk.typing ? <form className="maatje-talk-form" onSubmit={submit}>
      <input
        type="text"
        value={text}
        onChange={event => setText(event.target.value)}
        placeholder="Bijv. melk en brood"
        aria-label="Vraag het Maatje"
        maxLength={400}
        enterKeyHint="send"
        disabled={talk.mood === "thinking"}
      />
      <button type="submit" disabled={!text.trim() || talk.mood === "thinking"}>Vraag</button>
    </form> : <p className="maatje-talk-hint">
      {talk.mood === "listening" ? "Laat los als je klaar bent" : talk.mood === "thinking" ? "Maatje denkt na…" : "Houd Maatje vast om te praten"}
      {talk.mood === "idle" ? <> · <button type="button" className="maatje-talk-link" onClick={() => talk.setTyping(true)}>typen</button></> : null}
    </p>}
  </div>;
}
