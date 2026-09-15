import { describe, expect, it } from "vitest";

import { homeSections } from "./home-sections";

describe("dashboard snelkoppelingen", () => {
  it("leidt Producten naar de bestaande catalogus", () => {
    expect(homeSections.find((section) => section.title === "Producten")?.href).toBe(
      "/producten",
    );
  });

  it("geeft iedere onboardingactie een eigen route", () => {
    expect(homeSections.map((section) => section.href)).toEqual([
      "/producten",
      "/budget",
      "/week-voorbereiden",
    ]);
  });
});
