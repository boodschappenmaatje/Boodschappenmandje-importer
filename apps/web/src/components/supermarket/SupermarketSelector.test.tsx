// @vitest-environment happy-dom
import { act, createElement as h } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

import { SupermarketSelector } from "@/components/supermarket/SupermarketSelector";
import { ActiveShoppingListProvider } from "@/features/shopping-list/ActiveShoppingListProvider";
import { createEmptyActiveShoppingList } from "@/services/shopping-list/shopping-list";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(async () => {
  if (root) await act(async () => root?.unmount());
  root = null;
  container?.remove();
  container = null;
  localStorage.clear();
});

it("first choice offers only Hoogvliet and labels future stores without opening their catalog", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => root!.render(h(ActiveShoppingListProvider, { initialList: createEmptyActiveShoppingList() }, h(SupermarketSelector))));

  await vi.waitFor(() => expect(container?.querySelector('[role="dialog"]')).not.toBeNull());
  const dialog = container!.querySelector('[role="dialog"]')!;
  expect(dialog.textContent).toContain("Waar doe je je boodschappen?");
  for (const market of ["Albert Heijn", "Jumbo", "Lidl", "Dirk"]) {
    const option = [...dialog.querySelectorAll("button")].find(button => button.textContent?.includes(market));
    expect(option?.disabled).toBe(true);
    expect(option?.textContent).toContain("Binnenkort");
  }
  const hoogvliet = [...dialog.querySelectorAll("button")].find(button => button.textContent?.includes("Hoogvliet"));
  expect(hoogvliet?.disabled).toBe(false);
  await act(async () => hoogvliet?.click());
  expect(localStorage.getItem("boodschappenmaatje:active-supermarket")).toBe("hoogvliet");
  expect(container?.querySelector('[role="dialog"]')).toBeNull();
});
