import type { Metadata } from "next";

import { BudgetDetailView } from "@/components/budget/BudgetDetailView";
import { PageIntro } from "@/components/PageIntro";

export const metadata: Metadata = { title: "Budget" };

export default function BudgetPage() {
  return (
    <>
      <PageIntro eyebrow="Overzicht" title="Budget">
        Houd tijdens je boodschappenweek zicht op wat je wilt besteden.
      </PageIntro>
      <BudgetDetailView />
    </>
  );
}
