import { readFile, writeFile } from "node:fs/promises";
import { parseMealMixSource, matchingExistingMixProfile } from "../apps/web/src/server/meal-mix-source.ts";
import { MEAL_MIX_PROFILES } from "../apps/web/src/services/week-preparation/meal-mix-profiles.ts";
import { profileRecipeRow } from "../src/meal-mix-profile-maintenance.mjs";

const directory = "apps/web/test-results/pwa13";
const inventory = JSON.parse(await readFile(`${directory}/mix-sources/inventory.json`, "utf8"));
const audit = [];
for (const product of inventory) {
  const source = JSON.parse(await readFile(`${directory}/mix-sources/${product.sku}.json`, "utf8"));
  let result = source.text ? parseMealMixSource(source, MEAL_MIX_PROFILES) : { status: "needs_review", reason: "source_unavailable" };
  const recipe = result.status === "verified" ? profileRecipeRow(result.profile, source) : null;
  if (result.status === "verified" && !recipe) result = { ...result, status: "needs_review", reason: "preparation_time_missing" };
  audit.push({ product, alreadyComplete: Boolean(matchingExistingMixProfile(product, MEAL_MIX_PROFILES)), ...result, recipe });
}
await writeFile(`${directory}/mix-profile-audit.json`, JSON.stringify(audit, null, 2));
console.log(JSON.stringify(Object.fromEntries(Object.entries(Object.groupBy(audit, row => `${row.product.brand}:${row.status}`)).map(([key, rows]) => [key, rows.length]))));
