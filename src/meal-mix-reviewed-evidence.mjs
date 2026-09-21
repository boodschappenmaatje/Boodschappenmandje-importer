import previous from './meal-mix-corroboration.json' with { type: 'json' };
import completion from './meal-mix-completion-evidence.json' with { type: 'json' };
import wraps from './wrap-completion-evidence.json' with { type: 'json' };

/** Reviewed facts apply only to the exact catalog identity and preparation hash. */
export function mealMixCorroborationFor(product) {
  const fact = [...completion, wraps].find(item => item.sku === product.sku);
  if (!fact) return previous[product.sku];
  if (fact.productId !== product.id || fact.productName !== product.name || fact.packageText !== product.package_text) return undefined;
  return {
    preparationFingerprint: fact.preparationFingerprint,
    sourceUrl: fact.url,
    evidence: fact.evidence,
    servings: fact.servings,
    supplementServings: fact.supplementServings,
    preparationMinutes: fact.preparationMinutes,
    supplementList: fact.items.map(([quantity, unit, name]) => `${quantity} ${unit === 'piece' ? '' : `${unit} `}${name}`).join('\n'),
  };
}
