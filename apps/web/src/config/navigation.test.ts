import { describe, expect, it } from "vitest";

import { primaryNavigation } from "./navigation";

describe("mobiele hoofdnavigatie", () => {
  it("bevat de vier afgesproken hoofdonderdelen", () => {
    expect(primaryNavigation.map(({ label, href }) => ({ label, href }))).toEqual([
      { label: "Home", href: "/" },
      { label: "Lijst", href: "/lijst" },
      { label: "Producten", href: "/producten" },
      { label: "Meer", href: "/meer" },
    ]);
  });
});
