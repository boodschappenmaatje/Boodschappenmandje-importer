import type { Metadata } from "next";

import { EmptyState } from "@/components/EmptyState";
import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "Budget" };

export default function BudgetPage() {
  return (
    <>
      <PageIntro eyebrow="Overzicht" title="Budget">
        Houd straks tijdens je boodschappenweek zicht op wat je wilt besteden.
      </PageIntro>
      <section className="dashboard-card route-empty-card">
        <EmptyState icon="budget" title="Nog geen weekbudget ingesteld">
          Je stelt je budget in wanneer je een boodschappenweek start. We tonen geen bedragen totdat jij ze hebt gekozen.
        </EmptyState>
      </section>
    </>
  );
}
