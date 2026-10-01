// Public Producten menu, observed 2026-09-30. These are category identities,
// not search keywords; every returned SKU still needs normal detail validation.
export const HOOGVLIET_CATEGORIES = Object.freeze([
  ["100", "Aardappelen, groente, fruit"],
  ["200", "Vlees, vis, vegetarisch"],
  ["300", "Kaas, vleeswaren, tapas"],
  ["400", "Verse maaltijden, salades"],
  ["500", "Zuivel, plantaardig, eieren"],
  ["600", "Diepvries"],
  ["700", "Brood"],
  ["800", "Ontbijtgranen, broodbeleg, tussendoor"],
  ["900", "Frisdrank, sappen"],
  ["1900", "Koffie, thee"],
  ["1000", "Bier, wijn, alcoholvrij"],
  ["1100", "Chips, zoutjes, noten"],
  ["1200", "Koek, chocolade, snoep, zelf bakken"],
  ["1300", "Internationale keuken, pasta, rijst"],
  ["1400", "Soepen, conserven, sauzen, kruiden"],
  ["1500", "Huishoud, non-food"],
  ["1800", "Huisdier"],
  ["1600", "Gezondheid, cosmetica"],
  ["2000", "Baby, kind"],
  ["1700", "Bewuste voeding"],
].map(([id, title]) => Object.freeze({ key: `category:999999-${id}`, id: `999999-${id}`, title })));

export function categoryDiscoveryRoute(key) {
  return HOOGVLIET_CATEGORIES.find(route => route.key === key) ?? null;
}
