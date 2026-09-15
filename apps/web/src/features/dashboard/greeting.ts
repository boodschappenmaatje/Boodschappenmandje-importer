export type Greeting = "Goedemorgen" | "Goedemiddag" | "Goedenavond";

export function greetingForHour(hour: number): Greeting {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new RangeError("Het uur moet tussen 0 en 23 liggen.");
  }

  if (hour < 12) {
    return "Goedemorgen";
  }

  if (hour < 18) {
    return "Goedemiddag";
  }

  return "Goedenavond";
}
