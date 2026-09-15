"use client";

import Link from "next/link";

import { EmptyState } from "@/components/EmptyState";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";

const euroFormatter = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

export function ShoppingListCard() {
  const { status, list, total } = useActiveShoppingList();
  const itemCount = list?.items.length ?? 0;
  const hasItems = status === "ready" && itemCount > 0;

  return (
    <section className="dashboard-card shopping-list-card" aria-labelledby="shopping-title">
      <div className="dashboard-card-heading">
        <div>
          <p className="card-eyebrow">Jouw lijst</p>
          <h2 id="shopping-title">Mijn boodschappen</h2>
        </div>
      </div>

      {status === "loading" ? (
        <p className="shopping-list-loading" role="status">
          Je lijst wordt geopend…
        </p>
      ) : hasItems ? (
        <div className="shopping-list-dashboard-summary">
          <p className="shopping-list-count">
            <strong>{itemCount}</strong>{" "}
            {itemCount === 1 ? "product" : "producten"} op je lijst
          </p>
          {total.availableTotal === null ? null : (
            <p>
              {total.isPartial ? "Voorlopig " : ""}
              {euroFormatter.format(total.availableTotal)}
            </p>
          )}
        </div>
      ) : (
        <EmptyState
          icon="list"
          title={
            status === "error"
              ? "Je boodschappenlijst is nu niet beschikbaar"
              : "Nog geen actieve boodschappenlijst"
          }
        >
          {status === "error"
            ? "Open Lijst om de lokale opslag opnieuw te controleren."
            : "Voeg een product uit de catalogus toe om je lijst te beginnen."}
        </EmptyState>
      )}

      <Link className="text-action" href="/lijst">
        {hasItems ? "Verder met mijn lijst" : "Open mijn boodschappen"}
      </Link>
    </section>
  );
}
