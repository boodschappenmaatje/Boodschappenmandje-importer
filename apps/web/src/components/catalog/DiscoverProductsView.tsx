"use client";

import Link from "next/link";
import Image from "next/image";
import { Suspense } from "react";

import { CatalogSearchView } from "@/components/catalog/CatalogSearchView";
import { Icon } from "@/components/Icon";
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
        <Link href="/" className="discover-back" aria-label="Terug naar Home"><Icon name="back" size={23} /><span>Home</span></Link>
        <div className="discover-header-copy"><h1>Ontdek &amp; bespaar</h1><p>Bekijk producten, aanbiedingen en categorieën</p></div>
        <Link className="discover-list-link" href="/lijst" aria-label="Naar je boodschappenlijst">Lijst</Link>
        <Image className="discover-header-mascot" src="/branding/maatje-home-c.webp" alt="" width={180} height={180} priority />
        <div className="discover-store-row"><span>Jouw supermarkt</span><SupermarketSelector /></div>
      </header>
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
