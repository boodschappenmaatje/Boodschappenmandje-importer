import { describe, expect, it } from "vitest";
import PrepareWeekPage from "./page";

describe("Menu dagroute", () => {
  it.each(["0", "2", "6"])("geeft geldige dag %s aan de bestaande Menu-weergave", async day => {
    const page = await PrepareWeekPage({ searchParams: Promise.resolve({ day }) });
    expect(page.props.children[1].props.initialDay).toBe(Number(day));
  });
  it.each([undefined, "-1", "7", "2x", "", ["1", "2"]])("negeert ongeldige dag %j zonder de planner te wijzigen", async day => {
    const page = await PrepareWeekPage({ searchParams: Promise.resolve({ day }) });
    expect(page.props.children[1].props.initialDay).toBeNull();
  });
});
