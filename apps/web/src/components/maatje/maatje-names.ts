/**
 * Keuzes van hetzelfde merk lijken op een klein kaartje allemaal op elkaar
 * ("Dr. Oetker Ristorante…"). Daarom zetten we het gedeelde begin klein
 * bovenaan en het verschil (bijv. "Funghi") groot eronder.
 */
export interface SplitName {
  /** Het gedeelde begin of het merk, klein getoond (kan leeg zijn). */
  top: string;
  /** Het deel dat de keuze onderscheidt, groot getoond. */
  main: string;
}

const words = (name: string) => name.trim().split(/\s+/).filter(Boolean);
const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase("nl-NL") + text.slice(1);

export function splitChoiceNames(choices: { name: string; brand?: string | null }[]): SplitName[] {
  const lists = choices.map(choice => words(choice.name));
  let shared = 0;
  if (lists.length > 1) {
    const shortest = Math.min(...lists.map(list => list.length));
    // Er moet altijd minstens één woord overblijven als verschil.
    while (shared < shortest - 1 && lists.every(list => list[shared].toLocaleLowerCase("nl-NL") === lists[0][shared].toLocaleLowerCase("nl-NL"))) shared += 1;
  }
  return choices.map((choice, index) => {
    const list = lists[index];
    if (shared > 0) return { top: list.slice(0, shared).join(" "), main: capitalize(list.slice(shared).join(" ")) };
    const brand = choice.brand?.trim();
    if (brand && list.length > words(brand).length && choice.name.toLocaleLowerCase("nl-NL").startsWith(`${brand.toLocaleLowerCase("nl-NL")} `)) {
      return { top: brand, main: capitalize(list.slice(words(brand).length).join(" ")) };
    }
    return { top: "", main: choice.name.trim() };
  });
}
