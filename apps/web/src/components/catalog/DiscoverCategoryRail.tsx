import { categoryLabel } from "@/components/catalog/CatalogFilterSheet";
import { Icon } from "@/components/Icon";
import type { CatalogQuery } from "@/types/catalog";

const DISCOVER_CATEGORY_LIMIT = 7;

export function visibleDiscoverCategories(facets: string[]): string[] {
  return facets.slice(0, DISCOVER_CATEGORY_LIMIT);
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
        {categories.map((category) => (
          <button
            className="discover-category-card"
            key={category}
            type="button"
            onClick={() => onApply({ ...query, category })}
            aria-label={`Bekijk categorie ${categoryLabel(category)}`}
          >
            <span className="discover-category-icon"><Icon name="catalog" size={25} /></span>
            <span className="discover-category-name">{categoryLabel(category)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
