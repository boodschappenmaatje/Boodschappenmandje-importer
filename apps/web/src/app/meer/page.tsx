import type { Metadata } from "next";

import { PageIntro } from "@/components/PageIntro";
import { SupabaseStatus } from "@/components/SupabaseStatus";

export const metadata: Metadata = { title: "Meer" };

export default function MorePage() {
  return (
    <>
      <PageIntro eyebrow="Technische test" title="Meer">
        Instellingen en aanvullende functies krijgen hier later een vaste plek.
      </PageIntro>
      <SupabaseStatus />
    </>
  );
}
