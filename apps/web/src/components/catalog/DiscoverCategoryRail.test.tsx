// @vitest-environment happy-dom
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { DiscoverCategoryRail } from "./DiscoverCategoryRail";
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
