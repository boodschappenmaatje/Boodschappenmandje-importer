"use client";

import Link from "next/link";
import { Suspense } from "react";

import { CatalogSearchView } from "@/components/catalog/CatalogSearchView";
import { SupermarketSelector } from "@/components/supermarket/SupermarketSelector";
import { useActiveShoppingList } from "@/features/shopping-list/ActiveShoppingListProvider";
import { SUPERMARKETS } from "@/types/supermarket";

function SearchLoading() {
  return <div className="catalog-state" role="status" aria-busy="true"><span className="catalog-spinner" /><div><h2>Producten laden</h2><p>Even geduld…</p></div></div>;
}

export function DiscoverProductsView() {
  const shoppingList = useActiveShoppingList();
  const supported = shoppingList.supermarketId === "hoogvliet";
  return (
    <main className="discover-page">
      <header className="discover-header">
        <Link href="/" className="discover-back">← <span>Home</span></Link>
        <div><h1>Ontdek &amp; bespaar</h1><p>Slim boodschappen doen</p></div>
        <Link className="discover-list-link" href="/lijst" aria-label="Naar je boodschappenlijst">Lijst</Link>
      </header>
      <div className="discover-store-row"><span>Jouw supermarkt</span><SupermarketSelector /></div>
      {supported ? <Suspense fallback={<SearchLoading />}><CatalogSearchView discovery /></Suspense> : (
        <section className="catalog-state" role="status">
          <h2>Producten bij {SUPERMARKETS[shoppingList.supermarketId].name} zijn binnenkort beschikbaar</h2>
          <p>Kies Hoogvliet om nu met echte producten en prijzen te zoeken. Je lijsten blijven apart bewaard.</p>
          <SupermarketSelector />
        </section>
      )}
    </main>
  );
}
