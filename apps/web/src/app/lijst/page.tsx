import type { Metadata } from "next";

import { PageIntro } from "@/components/PageIntro";
import { ActiveShoppingListView } from "@/components/shopping-list/ActiveShoppingListView";

export const metadata: Metadata = { title: "Lijst" };

export default function ListPage() {
  return (
    <>
      <PageIntro eyebrow="Jouw lijst" title="Mijn boodschappen">
        Je actieve lijst blijft op dit apparaat bewaard, zodat je altijd verder kunt.
      </PageIntro>
      <ActiveShoppingListView />
    </>
  );
}
