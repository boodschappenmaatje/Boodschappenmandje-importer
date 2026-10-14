import { categoryLabel } from "@/components/catalog/CatalogFilterSheet";
import Image from "next/image";
import type { CatalogQuery } from "@/types/catalog";

const DISCOVER_CATEGORY_LIMIT = 7;

type CategoryArt = { src: string; width: number; height: number };

const FALLBACK_CATEGORY_ART: CategoryArt = { src: "/branding/discover/alle-categorieen.webp", width: 347, height: 300 };

// Volgorde telt: de eerste groep met een trefwoord aan het begin of eind van een woord in het categoriepad wint.
const CATEGORY_ART_GROUPS: { keywords: string[]; art: CategoryArt }[] = [
  { keywords: ["baby", "luier", "kind"], art: { src: "/branding/categories/baby.webp", width: 152, height: 200 } },
  { keywords: ["huishoud", "afwas", "wasmiddel", "schoonmaak", "verzorging", "douche", "badschuim", "shampoo", "tandpasta", "zeep", "toilet"], art: { src: "/branding/categories/huishouden.webp", width: 172, height: 200 } },
  { keywords: ["drank", "frisdrank", "wijn", "bier", "sap", "koffie", "thee", "water", "siroop", "limonade"], art: { src: "/branding/categories/dranken.webp", width: 143, height: 200 } },
  { keywords: ["zuivel", "melk", "kaas", "yoghurt", "kwark", "boter", "room", "eieren", "vla"], art: { src: "/branding/categories/zuivel.webp", width: 150, height: 200 } },
  { keywords: ["brood", "ontbijt", "beschuit", "croissant", "bakkerij"], art: { src: "/branding/categories/brood.webp", width: 200, height: 169 } },
  { keywords: ["vlees", "vis", "kip", "gehakt", "biefstuk", "beenham", "worst", "vega", "schnitzel", "falafel", "balletjes"], art: { src: "/branding/categories/vlees-vis.webp", width: 200, height: 184 } },
  { keywords: ["snack", "chips", "snoep", "chocola", "koek", "pizza"], art: { src: "/branding/categories/snacks.webp", width: 162, height: 200 } },
  { keywords: ["groente", "fruit", "aardappel", "appel", "sla", "tomaat", "paprika", "uien", "wortel", "kruiden", "ananas", "mango", "sinaasappel", "citrus", "banaan", "bananen", "druiven", "peren"], art: { src: "/branding/categories/groente-fruit.webp", width: 184, height: 200 } },
];

// Nederlandse samenstellingen: "kaas" in "kaasplakken" (begin) en "boter" in "bakboter" (eind).
function matchesWord(word: string, keyword: string): boolean {
  if (word.startsWith(keyword)) return true;
  return [keyword, `${keyword}en`, `${keyword}s`, `${keyword}e`].some((form) => word.endsWith(form));
}

export function discoverCategoryArt(category: string): CategoryArt {
  const words = category.toLocaleLowerCase("nl-NL").split(/[^\p{L}]+/u).filter(Boolean);
  return CATEGORY_ART_GROUPS.find((group) => group.keywords.some((keyword) => words.some((word) => matchesWord(word, keyword))))?.art
    ?? FALLBACK_CATEGORY_ART;
}


// Toont echte facetwaarden in de bestaande volgorde, maar eerst één per illustratiegroep,
// zodat de rij afwisselend blijft in plaats van zeven keer dezelfde soort categorie.
export function visibleDiscoverCategories(facets: string[]): string[] {
  const seenArt = new Set<string>();
  const varied: string[] = [];
  for (const facet of facets) {
    const art = discoverCategoryArt(facet).src;
    if (seenArt.has(art)) continue;
    seenArt.add(art);
    varied.push(facet);
  }
  const rest = facets.filter((facet) => !varied.includes(facet));
  return [...varied, ...rest].slice(0, DISCOVER_CATEGORY_LIMIT);
}

export function DiscoverCategoryRail({
  facets,
  query,
  onApply,
  onViewAll,
}: {
  facets: string[];
  query: CatalogQuery;
  onApply: (query: CatalogQuery) => void;
  onViewAll: () => void;
}) {
  const categories = visibleDiscoverCategories(facets);
  if (categories.length === 0) return null;

  return (
    <section className="discover-category-section" aria-labelledby="discover-category-heading">
      <div className="discover-category-heading">
        <h2 id="discover-category-heading">Categorieën</h2>
        <button type="button" onClick={onViewAll}>Bekijk alles <span aria-hidden="true">›</span></button>
      </div>
      <div className="discover-category-rail" aria-label="Categorieën om te ontdekken">
        {categories.map((category) => {
          const art = discoverCategoryArt(category);
          return (
          <button
            className="discover-category-card"
            key={category}
            type="button"
            onClick={() => onApply({ ...query, category })}
            aria-label={`Bekijk categorie ${categoryLabel(category)}`}
          >
            <span className="discover-category-art" aria-hidden="true"><Image src={art.src} alt="" width={art.width} height={art.height} sizes="56px" /></span>
            <span className="discover-category-name">{categoryLabel(category)}</span>
          </button>
          );
        })}
      </div>
    </section>
  );
}
