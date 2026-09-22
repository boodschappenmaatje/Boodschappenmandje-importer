import { readFileSync, writeFileSync } from 'node:fs';
import { parseMealMixSource } from '../apps/web/src/server/meal-mix-source.ts';
import { MEAL_MIX_PROFILES } from '../apps/web/src/services/week-preparation/meal-mix-profiles.ts';
import { mealMixCorroborationFor } from '../src/meal-mix-reviewed-evidence.mjs';
import { profileRecipeRow, MEAL_MIX_PARSER_VERSION } from '../src/meal-mix-profile-maintenance.mjs';

const inventory = JSON.parse(readFileSync('apps/web/test-results/mix-completion/inventory-before.json'));
const sources = JSON.parse(readFileSync('test/fixtures/meal-mix-completion-sources.json'));
sources.push(JSON.parse(readFileSync('test/fixtures/wrap-completion-source.json')));
const plan = sources.map(source => {
  const row = inventory.find(item => item.product_id === source.product.id);
  const result = parseMealMixSource(source, MEAL_MIX_PROFILES, mealMixCorroborationFor(source.product));
  if (!row || result.status !== 'verified') throw Error(`${source.product.sku}: ${result.reason}`);
  const recipe = profileRecipeRow(result.profile, source);
  if (!recipe) throw Error('Missing preparation time');
  return { product_id: row.product_id, expected_updated_at: row.updated_at, recipe,
    profile: result.profile, source_fingerprint: result.fingerprint, source_evidence: result.evidence,
    source_product_updated_at: row.product.updated_at, parser_version: MEAL_MIX_PARSER_VERSION };
});
writeFileSync('apps/web/test-results/mix-completion/profile-plan.json', JSON.stringify(plan, null, 2));
console.log(JSON.stringify(plan.map(row => ({ name: row.profile.productName, servings: row.profile.servingsPerPackage,
  supplementServings: row.profile.supplementServings ?? row.profile.servingsPerPackage, ingredients: row.profile.supplements.length }))));
