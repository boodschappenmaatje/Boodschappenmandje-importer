import { createHash } from "node:crypto";
import type { MealMixProfile, MealMixSupplement } from "@/services/week-preparation/meal-mix-profiles";

export interface MealMixSourceProduct {
  id: string; sku: string; name: string; brand: string | null;
  package_text: string | null; source_url: string; category: string | null;
}
export interface MealMixSource {
  product: MealMixSourceProduct;
  title: string;
  text: string;
  sourceUrl: string;
  fetchedAt: string;
}
export type MealMixSourceResult =
  | { status: "verified"; profile: MealMixProfile; fingerprint: string; evidence: string }
  | { status: "needs_review"; reason: string; fingerprint: string };

export function isMealMixProduct(product: MealMixSourceProduct): boolean {
  return /^(honig|knorr)\b/i.test(product.name) &&
    (/maaltijdmixen|maaltijdpakketten/i.test(product.category ?? "") ||
      /\b(bakplaat mix|basis voor|mix voor|maaltijdmix|wereldgerecht|wereldgerechten|familiegerecht|maaltijdsoep|risotto|spaghetteria)\b/i.test(product.name)) &&
    !/\b(kippensoep|tomatensoep)\b/i.test(product.name);
}

const normalize = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const number = (text: string) => Number(text.replace(",", "."));

function ingredientCategory(name: string): string {
  if (/kip|gehakt|runder|varken|spek|worst|hacheevlees/.test(name)) return "Vlees";
  if (/melk|kaas|kwark|yoghurt|room|eieren|creme fraiche/.test(name)) return "Zuivel & eieren";
  if (/rijst|pasta|spaghetti|macaroni|lasagne|tagliatelle|mie|noedel/.test(name)) return "Pasta, rijst & granen";
  if (/olie|saus|gezeefde|puree/.test(name)) return "Sauzen & smaakmakers";
  if (/aardappel|krieltjes/.test(name)) return "Aardappel & zetmeel";
  if (/ananas|appel/.test(name)) return "Fruit";
  if (/brood|wrap/.test(name)) return "Brood";
  return "Groente";
}

/** Only parses the manufacturer's explicitly labelled shopping list. Never the
 * packaged mix's ingredient declaration, nutrition facts or a similar recipe. */
export function matchingExistingMixProfile(product: MealMixSourceProduct, profiles: readonly MealMixProfile[]): MealMixProfile | null {
  const identity = (name: string) => normalize(name.replace(/['’`]s\b/gi, "s"))
    .split(" ").filter((word) => !["honig", "knorr", "wereldgerechten", "wereldgerecht", "maaltijdpakket", "maaltijdpakketten", "maaltijdmix", "basis", "mix", "voor"].includes(word)).join(" ");
  const matches = profiles.filter((profile) =>
    /^knorr/i.test(product.name) === (profile.brand === "Knorr") &&
    /wereldgerecht/i.test(profile.productName) === /wereldgerecht/i.test(product.name) &&
    [profile.productName, ...profile.productAliases].some((name) => identity(name) === identity(product.name)));
  return matches.length === 1 ? matches[0] : null;
}

export function parseMealMixSource(source: MealMixSource, existingProfiles: readonly MealMixProfile[] = []): MealMixSourceResult {
  const text = source.text.replace(/\r/g, "");
  const fingerprint = createHash("sha256").update(JSON.stringify([source.product.name, source.product.package_text, source.sourceUrl, text])).digest("hex");
  const fail = (reason: string): MealMixSourceResult => ({ status: "needs_review", reason, fingerprint });
  let url: URL;
  try { url = new URL(source.sourceUrl); } catch { return fail("source_url_invalid"); }
  if (url.origin !== "https://www.hoogvliet.com" || url.pathname !== new URL(source.product.source_url).pathname ||
    normalize(source.title) !== normalize(source.product.name)) return fail("source_identity_mismatch");
  if (!isMealMixProduct(source.product)) return fail("not_a_supported_meal_mix");
  const brand = /^honig\b/i.test(source.product.name) ? "Honig" : "Knorr";
  const servingMatches = [...text.matchAll(/(?:voor|geschikt voor)\s+(?:(\d+)\s*(?:tot|à|a|[-–])\s*)?(\d+)\s*(?:personen|porties)\b/gi)];
  const existing = matchingExistingMixProfile(source.product, existingProfiles);
  const servings = [...new Set(servingMatches.map((match) => number(match[2])))];
  if (!servings.length && existing?.verificationStatus === "verified") servings.push(existing.servingsPerPackage);
  if (servings.length !== 1 || servings[0] < 1 || servings[0] > 12) return fail(servings.length > 1 ? "servings_conflict" : "package_servings_missing");
  const start = /(?:Zelf toevoegen|Boodschappenlijstje)\s*:?\s*/i.exec(text);
  if (!start) return fail("supplement_list_missing");
  const after = text.slice(start.index + start[0].length);
  const end = /(?:Variatie\s*tip|Dagje zonder|Algemene bereidingswijze|Voorbereiding|Zo maak|Netto-inhoud|\n1[. )]\s*(?:Kook|Verwarm|Verhit|Snij|Breng|Strooi)\b)/i.exec(after);
  if (!end) return fail("supplement_list_boundary_missing");
  const list = after.slice(0, end.index).trim();
  const rows = list.replace(/([a-z])Olie\b/g, "$1\nOlie")
    .split(/\n|\s+[?•]\s*|\.\s+(?=\d)|\.(?=[A-Z])|(?<=[\p{L})])\s+(?![^()]*\))(?=\d+(?:[.,]\d+)?\s+(?:g\b|kg\b|ml\b|el\b|bosui\b))/iu)
    .map((row) => row.replace(/^\s*[-?•]\s*/, "").trim()).filter(Boolean);
  const supplements: MealMixSupplement[] = [];
  for (const original of rows) {
    let row = original.replace(/\s*\((?:blokjes|reepjes)\)/gi, "").replace(/\((basmati|kastanje)\)\s*/gi, "$1").replace(/\b(?:Honig|Heinz)\s+/gi, "");
    if (/water\s*$/i.test(row)) continue;
    if (/^olie$/i.test(row)) {
      const declaredOil = /(\d+(?:[.,]\d+)?)\s*(?:el|eetl\.?|eetlepels?)\s+(?:olijf)?olie/i.exec(after.slice(end.index));
      if (!declaredOil) return fail(`supplement_quantity_missing:${normalize(original)}`);
      row = `${number(declaredOil[1]) * 15} ml olie`;
    }
    const namedWeight = /^(.+?)\s*\((\d+(?:[.,]\d+)?)\s*(g|gram|ml)\)\.?$/i.exec(row);
    if (namedWeight) row = `${namedWeight[2]} ${namedWeight[3]} ${namedWeight[1]}`;
    const canned = /^\d+\s+(?:blik|blikje)\s+(.+?)\s*\(à?\s*(\d+)\s*g\)/i.exec(row);
    if (canned) row = `${canned[2]} g ${canned[1]}`;
    const match = /^(\d+(?:[.,]\d+)?)\s+(?:(g|gram|kg|ml|l|el|eetlepels?)\s+)?(.+?)\.?$/i.exec(row);
    if (!match) return fail(`supplement_quantity_missing:${normalize(original)}`);
    let quantity = number(match[1]);
    let unit: MealMixSupplement["unit"] = "piece";
    const rawUnit = match[2]?.toLowerCase();
    if (rawUnit === "g" || rawUnit === "gram") unit = "g";
    if (rawUnit === "kg") { unit = "g"; quantity *= 1000; }
    if (rawUnit === "ml") unit = "ml";
    if (rawUnit === "l") { unit = "ml"; quantity *= 1000; }
    if (rawUnit && /^el|eetlepel/.test(rawUnit)) { unit = "ml"; quantity *= 15; }
    let name = match[3].replace(/\b(?:middelgrote|grote|kleine)\s+/gi, "").replace(/\s*\(1\/2 pak\)/i, "")
      // A declared storage form is part of the ingredient identity, not missing
      // package contents. Preserve it; do not silently substitute fresh spinach.
      .replace(/\(diepvries\)/gi, "diepvries").trim();
    // Manufacturer explicitly permits either option; select the first, without inventing a substitute.
    name = name.split(/\s+of\s+/i)[0];
    if (/\b(?:blikje?|pak|zak|bosje)\b|[()]/i.test(name)) return fail(`supplement_content_missing:${normalize(original)}`);
    if (/\d+\s+(?:g|gram|ml|kg|bosui)\b/i.test(name)) return fail(`supplement_ambiguous:${normalize(original)}`);
    if (!quantity || !name) return fail("supplement_invalid");
    const normalized = normalize(name);
    const aliases = [name];
    if (/\bui\b/.test(normalized)) aliases.push(name.replace(/ui\b/i, "uien"));
    if (/\bbosui\b/.test(normalized)) aliases.push("bosuien", "bosui");
    if (/paprika/.test(normalized)) aliases.push(name.replace(/['’]s\b/, ""));
    if (/mager rundergehakt/.test(normalized)) aliases.push("rundergehakt mager");
    if (/geraspte.*kaas/.test(normalized)) aliases.push("geraspte kaas");
    if (/italiaans[e]? (?:groentepakket|groentemix|roerbakmix|wokgroenten)/.test(normalized)) aliases.push("Italiaanse groentemix", "Italiaanse roerbakgroenten", "Italiaanse wokgroenten", "Italiaanse groente");
    if (normalized === "cherrytomaatjes") aliases.push("cherrytomaten", "cherry tomaten");
    if (normalized === "kastanjechampignons") aliases.push("kastanje champignons");
    if (/^nasi bami groenten$|^bami groentepakket$/.test(normalized)) aliases.push("nasi bami groente", "nasi bami groenten", "bamigroenten");
    if (normalized === "olie") aliases.push("zonnebloemolie", "arachideolie", "rijstolie");
    if (normalized === "bosui" || normalized === "lente ui") aliases.push("bosuien", "lente ui", "lente-uien", "bosuitjes");
    supplements.push({ sourceKey: `mix-supplement-${normalized.replaceAll(" ", "-")}`, name, aliases, category: ingredientCategory(normalized), quantity, unit });
  }
  if (!supplements.length) return fail("supplement_list_empty");
  return { status: "verified", fingerprint, evidence: list, profile: {
    recipeSourceKey: existing?.recipeSourceKey ?? `catalog-mix-${source.product.sku}`, dishName: source.product.name, brand,
    productIngredientSourceKey: `catalog-mix-product-${source.product.sku}`,
    productId: source.product.id, productName: source.product.name, productAliases: [source.product.name],
    servingsPerPackage: servings[0], supplements, sourceUrl: source.sourceUrl, verificationStatus: "verified",
  } };
}
