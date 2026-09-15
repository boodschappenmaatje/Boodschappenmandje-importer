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
      <section className="more-list" aria-label="Meer onderdelen">
        <Link className="more-item more-item-link" href="/meer/catalogusstatus">
          <span className="more-icon"><Icon name="catalog" /></span>
          <div>
            <h2>Catalogusstatus</h2>
            <p>Bekijk de laatste automatische Hoogvliet-update en catalogusgroei.</p>
          </div>
          <span className="more-arrow" aria-hidden="true">›</span>
        </Link>
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
      </section>
    </>
  );
}
