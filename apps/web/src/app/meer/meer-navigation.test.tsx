import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import MorePage from "./page";

describe("Meer", () => {
  it("biedt Catalogusstatus als echte ingang en houdt toekomstige onderdelen apart", () => {
    const html = renderToStaticMarkup(createElement(MorePage));
    expect(html).toContain('href="/meer/catalogusstatus"');
    expect(html).toContain("Catalogusstatus");
    expect(html).toContain('href="/meer/data-health"');
    expect(html).toContain("Data Health");
    expect(html).toContain("Binnenkort");
  });
});
