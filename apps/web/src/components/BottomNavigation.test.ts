import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { BottomNavigation } from "./BottomNavigation";
let pathname = "/vrije-keuze";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
describe("Menu context in the recipe flow", () => {
  it.each(["/vrije-keuze", "/week-voorbereiden"])("keeps Menu active on %s", path => {
    pathname = path;
    const html = renderToStaticMarkup(createElement(BottomNavigation));
    expect(html).toMatch(/data-active="true"[^>]*href="\/week-voorbereiden"/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
  });
  it("keeps the five destinations and Home active for option C", () => {
    pathname = "/";
    const html = renderToStaticMarkup(createElement(BottomNavigation));
    expect(html.match(/class="navigation-item"/g)).toHaveLength(5);
    expect(html).toMatch(/data-active="true"[^>]*href="\/"/);
    for (const title of ["Home", "Menu", "Lijst", "Budget", "Meer"]) expect(html).toContain(title);
  });
  it("keeps the shopping list as its own active destination", () => {
    pathname = "/lijst";
    const html = renderToStaticMarkup(createElement(BottomNavigation));
    expect(html).toMatch(/data-active="true"[^>]*href="\/lijst"/);
  });
});
