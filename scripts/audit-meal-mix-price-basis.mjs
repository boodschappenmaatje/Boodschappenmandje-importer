import {readFileSync,writeFileSync} from 'node:fs';
import {getPriceFreshness} from '../apps/web/src/services/catalog/price.ts';
const dir='apps/web/test-results/mix-completion';
const rows=JSON.parse(readFileSync(`${dir}/readiness.json`));
const matches=new Map(JSON.parse(readFileSync(`${dir}/matches.json`)));
const stale=[];
for(const row of rows.filter(r=>r.ready)) for(const item of row.ingredients.filter(i=>i.required)) {
 const product=matches.get(item.requirementKey);
 if(product?.currentPrice && getPriceFreshness(product.currentPrice)!=='fresh') stale.push({recipe:row.recipeSourceKey,sku:product.sku,name:product.name,url:product.sourceUrl,price:product.currentPrice.price,date:product.currentPrice.fetchedAt});
}
writeFileSync(`${dir}/price-blockers.json`,JSON.stringify(stale,null,2));
console.log(JSON.stringify([...new Map(stale.map(p=>[p.sku,p])).values()],null,2));
