import type { Metadata } from "next";

import { ActiveShoppingListView } from "@/components/shopping-list/ActiveShoppingListView";

export const metadata: Metadata = { title: "Lijst" };

export default function ListPage() {
  return (
    <div className="shopping-list-page">
      <header className="shopping-list-title"><h1>Mijn boodschappen</h1></header>
      <ActiveShoppingListView />
    </div>
  );
}
