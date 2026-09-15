"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { ShoppingListItemCard } from "@/components/shopping-list/ShoppingListItemCard";
import { ShoppingListProductSearch } from "@/components/shopping-list/ShoppingListProductSearch";
import { ShoppingListTotalCard } from "@/components/shopping-list/ShoppingListTotalCard";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";

export function ActiveShoppingListView() {
  const [searchOpen, setSearchOpen] = useState(false);
  const {
    status,
    list,
    total,
    persistenceWarning,
    lastRemoved,
    increase,
    decrease,
    remove,
    undoRemove,
    dismissUndo,
  } = useActiveShoppingList();

  useEffect(() => {
    if (!lastRemoved) return;
    const timeout = window.setTimeout(dismissUndo, 6000);
    return () => window.clearTimeout(timeout);
  }, [dismissUndo, lastRemoved]);

  if (status === "loading") {
    return (
      <section className="catalog-state" aria-live="polite" aria-busy="true">
        <span className="catalog-spinner" aria-hidden="true" />
        <div>
          <h2>Je lijst openen</h2>
          <p>Je opgeslagen boodschappen worden geladen.</p>
        </div>
      </section>
    );
  }

  if (status === "error" || !list) {
    return (
      <section className="catalog-state" data-kind="error" role="status">
        <span className="status-icon"><Icon name="list" /></span>
        <div>
          <h2>Je lijst kan niet worden geopend</h2>
          <p>{persistenceWarning ?? "Probeer de app opnieuw te openen."}</p>
        </div>
      </section>
    );
  }

  return (
    <>
      {persistenceWarning ? (
        <p className="catalog-notice" role="status">{persistenceWarning}</p>
      ) : null}

      {list.items.length === 0 ? (
        <section className="dashboard-card route-empty-card">
          <EmptyState icon="list" title="Je boodschappenlijst is nog leeg">
            Kies een product uit de catalogus om je lijst te beginnen.
          </EmptyState>
          <button
            className="primary-action"
            type="button"
            onClick={() => setSearchOpen(true)}
          >
            Zoek en voeg product toe
          </button>
          <Link className="secondary-text-link" href="/producten">
            Bekijk de volledige productcatalogus
          </Link>
        </section>
      ) : (
        <section className="active-shopping-list" aria-labelledby="active-list-heading">
          <div className="section-heading shopping-list-heading">
            <h2 id="active-list-heading">
              {list.items.length}{" "}
              {list.items.length === 1 ? "product" : "producten"}
            </h2>
            <button
              className="shopping-list-search-action"
              type="button"
              onClick={() => setSearchOpen(true)}
            >
              <Icon name="plus" size={17} />
              Zoek en voeg product toe
            </button>
          </div>

          <ul className="shopping-items">
            {list.items.map((item) => (
              <ShoppingListItemCard
                key={item.productId}
                item={item}
                onIncrease={() => void increase(item.productId)}
                onDecrease={() => void decrease(item.productId)}
                onRemove={() => void remove(item.productId)}
              />
            ))}
          </ul>

          <ShoppingListTotalCard total={total} />
        </section>
      )}

      {lastRemoved ? (
        <div className="undo-snackbar" role="status" aria-live="polite">
          <span>{lastRemoved.item.name} verwijderd</span>
          <button type="button" onClick={() => void undoRemove()}>
            Ongedaan maken
          </button>
        </div>
      ) : null}

      <ShoppingListProductSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
}
