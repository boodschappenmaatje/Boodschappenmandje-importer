import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const dir='apps/web/test-results/mix-completion';
mkdirSync(`${dir}/sql`,{recursive:true});
const all=Array.from({length:10},(_,i)=>JSON.parse(readFileSync(`${dir}/cache-${i+1}.json`)));
const ready=all.flatMap(x=>x.readinessRows);
if(ready.length!==400 || new Set(ready.map(r=>`${r.recipe_id}:${r.people_count}`)).size!==400) throw Error('Incomplete cache inventory');
const queries=[];
function batch(table,rows,keys) {
  const cols=Object.keys(rows[0]);
  if(cols.some(c=>!/^\w+$/.test(c))) throw Error('Invalid column');
  for(let i=0;i<rows.length;i+=2) {
    const data=JSON.stringify(rows.slice(i,i+2)).replaceAll("'","''");
    const changed=cols.filter(c=>!keys.includes(c));
    queries.push(`WITH written AS (INSERT INTO ${table} (${cols.join(',')}) SELECT ${cols.join(',')} FROM jsonb_populate_recordset(NULL::${table}, '${data}'::jsonb) ON CONFLICT (${keys.join(',')}) DO UPDATE SET ${changed.map(c=>`${c}=excluded.${c}`).join(',')} WHERE ROW(${changed.map(c=>`${table}.${c}`).join(',')}) IS DISTINCT FROM ROW(${changed.map(c=>`excluded.${c}`).join(',')}) RETURNING 1) SELECT count(*) AS written FROM written;`);
  }
}
batch('ingredient_product_matches',all[3].matchRows,['match_key']);
batch('recipe_readiness_cache',ready,['recipe_id','people_count']);
queries.forEach((sql,i)=>writeFileSync(`${dir}/sql/${i}.sql`,sql));
writeFileSync(`${dir}/sql/count.json`,JSON.stringify(queries.length));
console.log({queries:queries.length,readiness:ready.length,matches:all[3].matchRows.length});
