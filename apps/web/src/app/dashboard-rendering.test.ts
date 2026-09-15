import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "./page";
import ListPage from "./lijst/page";

describe("dashboard rendering", () => {
  it("toont echte productnavigatie en lege kernstates zonder technische migratietekst", () => {
    const html = renderToStaticMarkup(createElement(HomePage));

    expect(html).toContain("Deze week");
    expect(html).toContain("Je hebt nog geen boodschappenweek gestart");
    expect(html).toContain("Mijn boodschappen");
    expect(html).toContain("Nog geen actieve boodschappenlijst");
    expect(html).toContain('href="/producten"');
    expect(html).not.toContain("PWA-fundament");
    expect(html).not.toContain("mobiele testbasis");
    expect(html).not.toContain("€");
  });

  it("geeft de lege lijst een veilige ingang naar weekvoorbereiding", () => {
    const html = renderToStaticMarkup(createElement(ListPage));

    expect(html).toContain("Nog geen actieve boodschappenlijst");
    expect(html).toContain('href="/week-voorbereiden"');
  });
});
