"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { EmptyState } from "@/components/EmptyState";
import { Icon } from "@/components/Icon";
import { ListBudgetSummary } from "@/components/budget/ListBudgetSummary";
import { LinkedShoppingListItem } from "@/components/shopping-list/LinkedShoppingListItem";
import { ShoppingListProductSearch } from "@/components/shopping-list/ShoppingListProductSearch";
import { ShoppingListTotalCard } from "@/components/shopping-list/ShoppingListTotalCard";
import { groupShoppingListItems, type ShoppingListFilter } from "@/services/shopping-list/shopping-list";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";

export function ActiveShoppingListView() {
  const [filter, setFilter] = useState<ShoppingListFilter>("all");
  const [searchOpen, setSearchOpen] = useState(false);
  const {
    status,
    list,
    total,
    persistenceWarning,
    lastRemoved,
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

      <ShoppingListTotalCard total={total} />
      <ListBudgetSummary />
      <div className="ux-list-filters" role="group" aria-label="Boodschappen filteren">
        {([["all", "Alles"], ["remaining", "Nog te halen"], ["checked", "Afgevinkt"]] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label} ({value === "all" ? list.items.length : list.items.filter((item) => value === "checked" ? item.checked : !item.checked).length})</button>)}
      </div>

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

          {groupShoppingListItems(list.items, filter).map(([category, items]) => <section className="ux-shopping-category" key={category} aria-label={category}>
            <h3>{category}</h3>
            <ul className="shopping-items">{items.map((item) => <LinkedShoppingListItem key={item.productId} item={item} />)}</ul>
          </section>)}
          {groupShoppingListItems(list.items, filter).length === 0 ? <p role="status">{filter === "checked" ? "Nog niets afgevinkt." : "Alles is afgevinkt. Klaar voor deze ronde!"}</p> : null}
          <Link className="secondary-text-link" href="/producten">Producten zoeken</Link>

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
