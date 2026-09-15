import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { ShoppingListItem } from "@/types/shopping-list";

import {
  ShoppingListItemCard,
  shoppingListItemDescription,
  shoppingListUsedInLabel,
} from "./ShoppingListItemCard";

const baseItem: ShoppingListItem = {
  productId: "product-1",
  sku: "sku-1",
  name: "Een bijzonder lange maar volledig begrijpelijke productnaam voor thuis",
  brand: "Maatje",
  packageText: "500 gram",
  imageUrl: null,
  quantity: 10,
  price: {
    productId: "product-1",
    sku: "sku-1",
    amount: 2.49,
    isOffer: true,
    updatedAt: "2026-09-15T10:00:00Z",
    freshness: "fresh",
    provider: "Hoogvliet",
  },
  sources: ["catalog"],
  usedIn: [],
  createdAt: "2026-09-15T10:00:00Z",
  updatedAt: "2026-09-15T10:00:00Z",
};

function renderItem(item: ShoppingListItem): string {
  return renderToStaticMarkup(
    createElement(ShoppingListItemCard, {
      item,
      onIncrease: () => undefined,
      onDecrease: () => undefined,
      onRemove: () => undefined,
    }),
  );
}

describe("compact boodschappenlijstitem", () => {
  it("houdt een lange productnaam leesbaar en aantallen stabiel bedienbaar", () => {
    const html = renderItem(baseItem);
    expect(html).toContain(baseItem.name);
    expect(html).toContain('aria-label="Verlaag aantal');
    expect(html).toContain('aria-label="10 stuks"');
    expect(html).toContain('aria-label="Verhoog aantal');
    expect(html).toContain('aria-label="Verwijder');
  });

  it("toont hoofdprijs en echte actie compact", () => {
    const html = renderItem(baseItem);
    expect(html).toContain("2,49");
    expect(html).toContain("Actie");
    expect(html).not.toContain("Bijgewerkt");
  });

  it("verzint geen prijs of afbeelding wanneer die ontbreken", () => {
    const html = renderItem({ ...baseItem, imageUrl: null, price: null });
    expect(html).toContain("Prijs tijdelijk niet beschikbaar");
    expect(html).toContain("Geen productafbeelding");
    expect(html).not.toContain("0,00");
  });

  it("vermijdt verpakkingstekst die al in de productnaam staat", () => {
    expect(
      shoppingListItemDescription({
        ...baseItem,
        name: "Maatje Melk 1 liter",
        brand: "Maatje",
        packageText: "1 liter",
      }),
    ).toBe("");
  });

  it("toont usedIn alleen wanneer echte koppelingen aanwezig zijn", () => {
    expect(shoppingListUsedInLabel([])).toBeNull();
    expect(shoppingListUsedInLabel(["Maandag – Macaroni"])).toBe(
      "Voor: Maandag – Macaroni",
    );
    expect(
      shoppingListUsedInLabel(["Maandag – Macaroni", "Vrijdag – Lasagne"]),
    ).toBe("Voor 2 maaltijden");
  });
});
