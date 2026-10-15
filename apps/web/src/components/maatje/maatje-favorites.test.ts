import { describe, expect, it } from "vitest";
import type { AssistantItem } from "@/server/maatje-assistant";
import { sortByFavorites } from "./maatje-favorites";

const choice = (id: string) => ({ product: { id, name: id } as never, priceCents: 100 });
const items: AssistantItem[] = [{ label: "melk", quantity: 1, choices: [choice("a"), choice("b"), choice("c"), choice("d")] }];

describe("sortByFavorites", () => {
  it("puts earlier choices first, then what is on the list, keeping Maatje's order otherwise", () => {
    const sorted = sortByFavorites(items, ["d"], { c: 3, b: 1 });
    expect(sorted[0].choices.map(entry => entry.product.id)).toEqual(["c", "b", "d", "a"]);
  });

  it("keeps the order without history", () => {
    expect(sortByFavorites(items, [], {})[0].choices.map(entry => entry.product.id)).toEqual(["a", "b", "c", "d"]);
  });
});
