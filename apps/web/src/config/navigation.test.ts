import { describe, expect, it } from "vitest";

import { primaryNavigation } from "./navigation";

describe("mobiele hoofdnavigatie", () => {
  it("bevat de vijf onderdelen uit de UI-mockup", () => {
    expect(primaryNavigation.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "Home", href: "/" },
      { label: "Menu", href: "/week-voorbereiden" },
      { label: "Lijst", href: "/lijst" },
      { label: "Producten", href: "/producten" },
      { label: "Meer", href: "/meer" },
    ]);
  });
});
