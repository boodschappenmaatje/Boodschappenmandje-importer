import { describe, expect, it } from "vitest";
import { splitChoiceNames } from "./maatje-names";

describe("splitChoiceNames", () => {
  it("zet het gedeelde begin klein en het verschil groot", () => {
    expect(splitChoiceNames([
      { name: "Dr. Oetker Ristorante pizza funghi" },
      { name: "Dr. Oetker Ristorante pizza hawaii" },
      { name: "Dr. Oetker Ristorante pizza margherita" },
    ])).toEqual([
      { top: "Dr. Oetker Ristorante pizza", main: "Funghi" },
      { top: "Dr. Oetker Ristorante pizza", main: "Hawaii" },
      { top: "Dr. Oetker Ristorante pizza", main: "Margherita" },
    ]);
  });

  it("houdt altijd minstens één woord als verschil over", () => {
    expect(splitChoiceNames([{ name: "Hoogvliet melk" }, { name: "Hoogvliet melk halfvol" }])).toEqual([
      { top: "Hoogvliet", main: "Melk" },
      { top: "Hoogvliet", main: "Melk halfvol" },
    ]);
  });

  it("valt terug op het merk als de namen niets delen", () => {
    expect(splitChoiceNames([
      { name: "Campina halfvolle melk", brand: "Campina" },
      { name: "Hoogvliet volle melk", brand: null },
    ])).toEqual([
      { top: "Campina", main: "Halfvolle melk" },
      { top: "", main: "Hoogvliet volle melk" },
    ]);
  });

  it("laat één keuze zonder merk heel", () => {
    expect(splitChoiceNames([{ name: "Volkoren brood" }])).toEqual([{ top: "", main: "Volkoren brood" }]);
  });
});
