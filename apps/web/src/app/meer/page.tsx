import type { Metadata } from "next";
import Link from "next/link";

import { Icon } from "@/components/Icon";
import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "Meer" };

export default function MorePage() {
  return (
    <>
      <PageIntro eyebrow="BoodschappenMaatje" title="Meer">
        Aanvullende onderdelen krijgen hier een rustige, vaste plek.
      </PageIntro>
      <section className="more-list" aria-label="Jouw instellingen">
        <h2>Jouw instellingen</h2>
        <Link className="more-item more-item-link" href="/week-voorbereiden"><Icon name="settings" /><div><h3>Voorkeuren en week</h3><p>Personen, dagen en maaltijdvoorkeuren.</p></div><span aria-hidden="true">›</span></Link>
        <Link className="more-item more-item-link" href="/producten"><Icon name="products" /><div><h3>Producten zoeken</h3><p>Supermarkt: Hoogvliet</p></div><span aria-hidden="true">›</span></Link>
        <details className="more-item ux-app-info"><summary>App informatie</summary><p>BoodschappenMaatje helpt je week voorbereiden en je budget volgen. Je lijst en week worden op dit apparaat bewaard.</p></details>
      </section>
      <details className="ux-future-options"><summary>Later beschikbaar</summary><div className="more-list">
        {[
          ["history", "Geschiedenis", "Je afgeronde boodschappenrondes."],
          ["pantry", "Voorraad", "Wat je waarschijnlijk nog in huis hebt."],
          ["settings", "Instellingen", "Pas BoodschappenMaatje later aan jouw voorkeuren aan."],
          ["info", "Over BoodschappenMaatje", "Je persoonlijke hulp voor een rustige boodschappenweek."],
        ].map(([icon, title, description]) => (
          <article className="more-item" key={title}>
            <span className="more-icon"><Icon name={icon as "history" | "pantry" | "settings" | "info"} /></span>
            <div>
              <h2>{title}</h2>
              <p>{description}</p>
            </div>
            <span className="future-label">Binnenkort</span>
          </article>
        ))}
      </div></details>
      <section className="more-list" aria-label="Beheer en Data Health"><h2>Beheer / Data Health</h2>
        <Link className="more-item more-item-link" href="/meer/catalogusstatus">
          <span className="more-icon"><Icon name="catalog" /></span>
          <div>
            <h2>Catalogusstatus</h2>
            <p>Bekijk de laatste automatische Hoogvliet-update en catalogusgroei.</p>
          </div>
          <span className="more-arrow" aria-hidden="true">›</span>
        </Link>
        <Link className="more-item more-item-link" href="/meer/data-health">
          <span className="more-icon"><Icon name="info" /></span>
          <div>
            <h2>Data Health</h2>
            <p>Interne controle van recept-, match-, prijs- en verpakkingsdekking.</p>
          </div>
          <span className="future-label">Intern</span>
          <span className="more-arrow" aria-hidden="true">›</span>
        </Link>
      </section>
    </>
  );
}
