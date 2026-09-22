import { readFileSync } from 'node:fs';
const people=Number(process.argv[2]??4);
const rows=JSON.parse(readFileSync(`apps/web/test-results/pwa13-cache/rows-${people}.json`));
if(process.argv[3]==='summary'){
  const plan=JSON.parse(readFileSync('apps/web/test-results/pwa13-cache/profile-backfill-plan.json'));
  const profiles=new Set(plan.filter(r=>r.status==='verified').map(r=>r.profile.recipeSourceKey));
  console.log(JSON.stringify({matchRows:rows.matchRows.length,readinessRows:rows.readinessRows.length,firstMatch:rows.matchRows[0],firstReadinessKeys:Object.keys(rows.readinessRows[0]),mixes:rows.readinessRows.filter(r=>profiles.has(r.readiness_payload.recipeSourceKey)).map(r=>({name:r.readiness_payload.recipeName,ready:r.readiness_status,issues:r.readiness_payload.ingredients.filter(i=>!i.ready).map(i=>({name:i.name,reason:i.reason,origin:i.origin}))}))},null,2));
}else{
  const kind=process.argv[3]??'readinessRows';
  const offset=Number(process.argv[4]??0);
  const count=Number(process.argv[5]??20);
  const prefix=process.argv[6];
  const selected=prefix ? rows[kind].filter(row=>row.dependency_match_keys?.some(key=>key.startsWith(prefix))) : rows[kind];
  console.log(JSON.stringify(selected.slice(offset,offset+count)));
}
