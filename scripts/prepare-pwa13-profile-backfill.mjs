import { readFileSync, writeFileSync } from 'node:fs';
import { parseMealMixSource } from '../apps/web/src/server/meal-mix-source.ts';
import { MEAL_MIX_PROFILES } from '../apps/web/src/services/week-preparation/meal-mix-profiles.ts';
import { profileRecipeRow, MEAL_MIX_PARSER_VERSION } from '../src/meal-mix-profile-maintenance.mjs';
import corroborations from '../src/meal-mix-corroboration.json' with {type:'json'};
const inventory=JSON.parse(readFileSync('apps/web/test-results/pwa13-cache/inventory-before.json'));
const rows=inventory.map(queue=>{
  const source=JSON.parse(readFileSync(`apps/web/test-results/pwa13/mix-sources/${queue.products.sku}.json`));
  let result=parseMealMixSource(source,MEAL_MIX_PROFILES,corroborations[queue.products.sku]);
  const recipe=result.status==='verified'?profileRecipeRow(result.profile,source):null;
  if(result.status==='verified'&&!recipe) result={...result,status:'needs_review',reason:'preparation_time_missing'};
  const verified=result.status==='verified';
  return {product_id:queue.product_id,expected_updated_at:queue.updated_at,recipe,
    status:result.status,reason:result.reason??null,profile:verified?result.profile:null,
    source_url:source.sourceUrl,source_fingerprint:result.fingerprint,source_evidence:result.evidence,
    source_product_updated_at:queue.products.updated_at,parser_version:MEAL_MIX_PARSER_VERSION};
});
writeFileSync('apps/web/test-results/pwa13-cache/profile-backfill-plan.json',JSON.stringify(rows,null,2));
console.log(JSON.stringify({profiles:rows.length,verified:rows.filter(r=>r.status==='verified').length,review:rows.filter(r=>r.status!=='verified').map(r=>({id:r.product_id,reason:r.reason})),derivedRecipesRequired:rows.filter(r=>r.recipe&&!inventory.find(q=>q.product_id===r.product_id).recipe_id).length}));
