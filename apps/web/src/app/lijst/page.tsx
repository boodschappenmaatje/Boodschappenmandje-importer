import type { Metadata } from "next";
import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "Lijst" };

export default function ListPage() {
  return (
    <>
      <PageIntro eyebrow="Jouw lijst" title="Mijn boodschappen">
        Hier vind je straks één actieve lijst die steeds beter weet wat je nodig hebt.
      </PageIntro>
      <section className="dashboard-card route-empty-card">
        <EmptyState icon="list" title="Nog geen actieve boodschappenlijst">
          Start eerst je boodschappenweek. Je lijst blijft leeg totdat jij die stap zet.
        </EmptyState>
        <Link className="primary-action" href="/week-voorbereiden">
          Start mijn week
        </Link>
      </section>
    </>
  );
}
