import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import type { ActiveShoppingListSummary } from "@/features/dashboard/dashboard-state";

export function ShoppingListCard({
  shoppingList,
}: {
  shoppingList: ActiveShoppingListSummary | null;
}) {
  return (
    <section className="dashboard-card shopping-list-card" aria-labelledby="shopping-title">
      <div className="dashboard-card-heading">
        <div>
          <p className="card-eyebrow">Jouw lijst</p>
          <h2 id="shopping-title">Mijn boodschappen</h2>
        </div>
      </div>

      {shoppingList ? (
        <p className="shopping-list-count">
          <strong>{shoppingList.itemCount}</strong>{" "}
          {shoppingList.itemCount === 1 ? "product" : "producten"} op je lijst
        </p>
      ) : (
        <EmptyState icon="list" title="Nog geen actieve boodschappenlijst">
          Zodra je een week start, verschijnt je lijst hier.
        </EmptyState>
      )}

      <Link className="text-action" href="/lijst">
        Open mijn boodschappen
      </Link>
    </section>
  );
}
