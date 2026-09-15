import { describe, expect, it } from "vitest";

import { greetingForHour } from "./greeting";

describe("lokale begroeting", () => {
  it("kiest ochtend, middag en avond op de juiste grenzen", () => {
    expect(greetingForHour(0)).toBe("Goedemorgen");
    expect(greetingForHour(11)).toBe("Goedemorgen");
    expect(greetingForHour(12)).toBe("Goedemiddag");
    expect(greetingForHour(17)).toBe("Goedemiddag");
    expect(greetingForHour(18)).toBe("Goedenavond");
    expect(greetingForHour(23)).toBe("Goedenavond");
  });

  it("weigert een ongeldige lokale tijd", () => {
    expect(() => greetingForHour(-1)).toThrow(RangeError);
    expect(() => greetingForHour(24)).toThrow(RangeError);
  });
});
