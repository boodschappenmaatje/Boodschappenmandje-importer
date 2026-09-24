import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { independentOriginLabel, matchesListOrigin, ShoppingListOrigins } from "./ShoppingListOrigins";
import { ShoppingListQuantity } from "./ShoppingListQuantity";
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
  quantityContributions: { persistentQuantity: 10, mealPlans: [] },
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
      onToggleChecked: () => undefined,
      onOpenDetails: () => undefined,
      originSummary: "Los",
      quantityControls: createElement(ShoppingListQuantity, { quantity: item.quantity, label: "Aantal", decreaseLabel: `Verlaag aantal ${item.name}`, increaseLabel: `Verhoog aantal ${item.name}`, onDecrease: () => undefined, onIncrease: () => undefined }),
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
    expect(html).not.toContain('aria-label="Verwijder');
    expect(html).toContain('aria-label="Productdetails');
    expect(html).toContain('type="checkbox"');
  });

  it("toont hoofdprijs en echte actie compact", () => {
    const html = renderItem(baseItem);
    expect(html).toContain("2,49");
    expect(html).toContain("Actie");
    expect(html).not.toContain("Bijgewerkt");
  });

  it("verzint geen prijs of afbeelding wanneer die ontbreken", () => {
    const html = renderItem({ ...baseItem, imageUrl: null, price: null });
    expect(html).toContain("Prijs onbekend");
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


describe("herkomstsamenvatting zonder nieuwe hoeveelheidsbron", () => {
  it("gemengde bijdragen horen bij beide filters; oude source-tags maken geen losse bijdrage", () => {
    const item = { ...baseItem, sources: ["manual" as const, "recipe" as const], quantityContributions: { persistentQuantity: 1, mealPlans: [{ weekPreparationId: "week", quantity: 1, usedIn: ["Hutspot"] }] } };
    expect(matchesListOrigin(item, "meals")).toBe(true);
    expect(matchesListOrigin(item, "other")).toBe(true);
    expect(matchesListOrigin({ ...item, quantityContributions: { ...item.quantityContributions, persistentQuantity: 0 } }, "other")).toBe(false);
    expect(item.quantityContributions.persistentQuantity).toBe(1);
  });
  it("suggesties en recurring behouden hun eigen zichtbare herkomst", () => {
    expect(independentOriginLabel({ ...baseItem, sources: ["suggestion"] })).toBe("Suggestie");
    expect(independentOriginLabel({ ...baseItem, sources: ["recurring"] })).toBe("Terugkerend");
    const html = renderToStaticMarkup(createElement(ShoppingListOrigins, { item: { ...baseItem, sources: ["recurring"] }, targets: [], week: null, unresolved: false }));
    expect(html).toContain("Terugkerend"); expect(html).not.toContain("Eigen recept");
  });
  it("onopgeloste receptadressen krijgen geen verzonnen eigen-receptlabel", () => {
    const item = { ...baseItem, name: "Eigen recept hutspot", quantityContributions: { persistentQuantity: 0, mealPlans: [{ weekPreparationId: "old-week", quantity: 1, usedIn: ["Hutspot"] }] } };
    const html = renderToStaticMarkup(createElement(ShoppingListOrigins, { item, targets: [], week: null, unresolved: true }));
    expect(html).toContain(">Maaltijden<"); expect(html).not.toContain(">Eigen recept<");
  });
});
