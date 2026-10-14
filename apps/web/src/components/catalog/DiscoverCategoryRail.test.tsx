// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { discoverCategoryArt, DiscoverCategoryRail, visibleDiscoverCategories } from "./DiscoverCategoryRail";
import type { CatalogQuery } from "@/types/catalog";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
  container?.remove();
  container = null;
});

it("shows a bounded, neutral rail from real facets and applies the exact facet query", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const onApply = vi.fn();
  const query: CatalogQuery = {
    term: "cola",
    category: null,
    brand: "Huismerk",
    offersOnly: false,
    maxPrice: 250,
    sort: "price-asc",
  };
  const facets = [
    "Dranken/Frisdrank",
    "Zuivel",
    "Brood",
    "Pasta",
    "Groente",
    "Fruit",
    "Snacks",
    "Huishouden",
  ];

  await act(async () => root!.render(createElement(DiscoverCategoryRail, {
    facets,
    query,
    onApply,
    onViewAll: vi.fn(),
  })));

  expect(container.querySelector("h2")?.textContent).toBe("Categorieën");
  expect(container.querySelectorAll(".discover-category-card")).toHaveLength(7);
  expect(container.textContent).toContain("Frisdrank");
  expect(container.textContent).not.toContain("Populaire categorieën");
  await act(async () => container!.querySelector<HTMLButtonElement>(".discover-category-card")!.click());
  expect(onApply).toHaveBeenCalledWith({ ...query, category: "Dranken/Frisdrank" });
});

it("opens the existing all-category action and renders no invented categories for empty facets", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  const onViewAll = vi.fn();
  const onApply = vi.fn();

  await act(async () => root!.render(createElement(DiscoverCategoryRail, {
    facets: ["Dranken"],
    query: { term: "", category: null, brand: null, offersOnly: false, maxPrice: null, sort: "relevance" },
    onApply,
    onViewAll,
  })));
  await act(async () => [...container!.querySelectorAll("button")].find(button => button.textContent?.includes("Bekijk alles"))!.click());
  expect(onViewAll).toHaveBeenCalledOnce();

  await act(async () => root!.render(createElement(DiscoverCategoryRail, {
    facets: [],
    query: { term: "", category: null, brand: null, offersOnly: false, maxPrice: null, sort: "relevance" },
    onApply,
    onViewAll,
  })));
  expect(container.querySelector(".discover-category-section")).toBeNull();
});

it("kiest per categoriepad een passende illustratie en valt anders terug op de mand", () => {
  expect(discoverCategoryArt("Aardappelen, groente, fruit/Groente/Champignons, paddenstoelen").src).toContain("groente-fruit");
  expect(discoverCategoryArt("Baby, kind/Fruithapjes").src).toContain("baby");
  expect(discoverCategoryArt("Alles voor de barbecue/Bier, wijn en mixdranken/Bier").src).toContain("dranken");
  expect(discoverCategoryArt("Bakboter").src).toContain("zuivel");
  expect(discoverCategoryArt("Badschuim, douchegel").src).toContain("huishouden");
  expect(discoverCategoryArt("Azijn, balsamico").src).toBe("/branding/discover/alle-categorieen.webp");
});

it("toont eerst afwisselende categorieën in de bestaande facetvolgorde", () => {
  expect(visibleDiscoverCategories([
    "Groente/Friet",
    "Groente/Kookaardappelen",
    "Groente/Partjes",
    "Baby, kind/Luiers",
    "Bier",
    "Zuivel/Kaas",
  ])).toEqual(["Groente/Friet", "Baby, kind/Luiers", "Bier", "Zuivel/Kaas", "Groente/Kookaardappelen", "Groente/Partjes"]);
});

it("koppelt alleen op woordbegin, zodat sinaasappel geen drank wordt", () => {
  expect(discoverCategoryArt("Aardappelen, groente, fruit/Fruit/Sinaasappel, mandarijn, overig citrusfruit").src).toContain("groente-fruit");
  expect(discoverCategoryArt("Ananas, mango, kiwi, meloen").src).toContain("groente-fruit");
  expect(discoverCategoryArt("Alles voor de barbecue/Groente, fruit en aardappel/Groente en fruit").src).toContain("groente-fruit");
  expect(discoverCategoryArt("Alles voor de barbecue/Vlees, Vis, en Vega").src).toContain("vlees-vis");
  expect(discoverCategoryArt("Frisdrank").src).toContain("dranken");
});
