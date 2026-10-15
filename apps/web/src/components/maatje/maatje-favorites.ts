import type { AssistantItem } from "@/server/maatje-assistant";

const KEY = "maatje-gekozen-v1";
const MAX_REMEMBERED = 300;

type Counts = Record<string, number>;

function read(): Counts {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" ? parsed as Counts : {};
  } catch {
    return {};
  }
}

/** Onthoudt op dit toestel welk product je via Maatje koos. */
export function rememberChoice(productId: string): void {
  try {
    const counts = read();
    counts[productId] = (counts[productId] ?? 0) + 1;
    const kept = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, MAX_REMEMBERED);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(kept)));
  } catch {
    // Opslaan lukt niet (privévenster): dan gewoon niet onthouden.
  }
}

/**
 * Wat je eerder koos (of al op je lijst hebt) komt vooraan; de rest houdt de
 * volgorde van Maatje.
 */
export function sortByFavorites(items: AssistantItem[], onList: Iterable<string> = [], counts: Counts = read()): AssistantItem[] {
  const listed = new Set(onList);
  const score = (id: string) => (counts[id] ?? 0) + (listed.has(id) ? 0.5 : 0);
  return items.map(item => ({
    ...item,
    choices: item.choices
      .map((choice, index) => ({ choice, index, score: score(choice.product.id) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)
      .map(entry => entry.choice),
  }));
}
