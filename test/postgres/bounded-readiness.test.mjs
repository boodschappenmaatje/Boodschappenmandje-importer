import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

// No DATABASE_URL / Supabase secret / host port. Always create and remove our
// own disposable PostgreSQL instance; this test cannot address a live DB.
const container = `bm-bounded-test-${process.pid}`;
const docker = (args, options = {}) => execFileSync("docker", args, { encoding: "utf8", ...options });
const args = ["exec", "-i", container, "psql", "-h", "127.0.0.1", "-XqAt", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-U", "postgres"];
const sql = (query) => docker(args, { input: query, stdio: ["pipe", "pipe", "pipe"] }).trim();
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
const json = (value) => `${quote(JSON.stringify(value))}::jsonb`;
const array = (values, type = "text") => `array[${values.map(quote).join(",")}]::${type}[]`;
const ids = [1, 2, 3, 4].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
const keys = ["a", "b", "c", "d"].map(k => `${k}:g:ingredient:generic`);
const product = "10000000-0000-4000-8000-000000000001";
let preservedExistingData = false;

function matchRow(key) {
  return { match_key: key, ingredient_id: null, ingredient_source_key: key[0], requirement_unit: "g",
    requirement_kind: "ingredient", brand_constraint: "", product_id: product, candidate_product_ids: [product],
    match_status: "valid", failure_reason: null, matcher_version: 5, refresh_status: "current",
    invalidated_at: null, invalidation_reason: null, product_updated_at: null, price_updated_at: null,
    matched_at: "2026-10-02T12:00:00Z", checked_at: "2026-10-02T12:00:00Z" };
}
function readinessRow(id, key, people = 1) {
  return { recipe_id: id, people_count: people, readiness_status: "READY", required_ingredient_count: 1,
    ready_required_ingredient_count: 1, problem_count: 0, readiness_payload: { recipeId: id, ready: true },
    dependency_match_keys: [key], evaluator_version: 5, refresh_status: "current", invalidated_at: null,
    invalidation_reason: null, evaluated_at: "2026-10-02T12:00:00Z", expires_at: "2026-10-03T12:00:00Z" };
}
function plan(indices = [0], dependencyKeys = indices.map(i => keys[i])) {
  const recipeIds = indices.map(i => ids[i]);
  const matchKeys = indices.map(i => keys[i]);
  const result = JSON.parse(sql(`set role service_role; select public.bounded_readiness_plan(${array(recipeIds, "uuid")}, ${array(matchKeys)}, ${array(dependencyKeys)});`));
  return { recipeIds, matchKeys, dependencyKeys, token: result.planToken,
    matches: matchKeys.map(matchRow), rows: indices.flatMap(i => Array.from({ length: 10 }, (_, n) => readinessRow(ids[i], keys[i], n + 1))) };
}
function call(p) {
  return `select public.commit_bounded_readiness(${array(p.recipeIds, "uuid")},${array(p.matchKeys)},${array(p.dependencyKeys)},${quote(p.token)},${json(p.matches)},${json(p.rows)});`;
}
function insertReadiness(row) {
  const columns = Object.keys(row).join(",");
  return `insert into public.recipe_readiness_cache(${columns}) select ${columns} from jsonb_populate_record(null::public.recipe_readiness_cache, ${json(row)});`;
}
const commit = p => JSON.parse(sql(`set role service_role; ${call(p)}`));
const state = () => JSON.parse(sql(`select jsonb_build_object(
  'matches', (select jsonb_agg(to_jsonb(m) order by match_key) from ingredient_product_matches m),
  'readiness', (select jsonb_agg(to_jsonb(r) order by recipe_id, people_count) from recipe_readiness_cache r),
  'revisions', (select jsonb_agg(to_jsonb(v) order by resource) from planner_write_revisions v));`));
function rejectsUnchanged(p, reason) {
  const before = state();
  assert.throws(() => commit(p), reason);
  assert.deepEqual(state(), before, "entire cache, invalidations, CAS counters and protection flags roll back");
}

// Persistent psql sessions provide a real transaction barrier. Resolving query()
// confirms SQL finished but BEGIN keeps its changes and locks uncommitted.
class Session {
  constructor() {
    this.child = spawn("docker", args, { stdio: ["pipe", "pipe", "pipe"] });
    this.output = "";
    this.errors = "";
    this.child.stdout.on("data", data => { this.output += data; this.check?.(); });
    this.child.stderr.on("data", data => { this.errors += data; });
    this.child.on("close", code => { this.closed = true; this.reject?.(new Error(`psql exited ${code}: ${this.errors}`)); });
  }
  query(query) {
    return new Promise((resolve, reject) => {
      const marker = `done_${Math.random().toString(16).slice(2)}`;
      const timer = setTimeout(() => reject(new Error("transaction barrier timed out")), 10000);
      this.reject = error => { clearTimeout(timer); reject(error); };
      this.output = "";
      this.check = () => {
        if (!this.output.includes(marker)) return;
        clearTimeout(timer);
        const result = this.output.split(marker)[0].trim();
        this.check = null; this.reject = null;
        resolve(result);
      };
      this.child.stdin.write(`${query}\n\\echo ${marker}\n`);
    });
  }
  async close() {
    if (!this.closed) { await this.query("rollback;"); this.child.stdin.end(); }
  }
}

before(async () => {
  docker(["run", "--detach", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=local-test-only", "postgres:17"]);
  for (let attempt = 0; ; attempt++) {
    try { docker(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], { stdio: "ignore" }); break; }
    catch (error) { if (attempt > 60) throw error; await delay(200); }
  }
  sql(readFileSync(new URL("./catalog-bootstrap.sql", import.meta.url), "utf8"));
  for (const name of ["20260908121109_create_recipes.sql", "20260908110213_create_ingredients.sql",
    "20260908222836_create_recipe_ingredients.sql", "20260914193340_secure_catalog_browser_read.sql",
    "20260919154657_persistent_planner_readiness_cache.sql", "20260920213421_meal_mix_profiles_and_candidate_cache.sql",
    "20260920220220_invalidate_readiness_on_candidate_change.sql", "20260921104333_meal_mix_verified_water_only.sql"]) {
    sql(readFileSync(new URL(`../../supabase/migrations/${name}`, import.meta.url), "utf8"));
  }
  sql("grant select, insert, update, delete on all tables in schema public to service_role;");
  sql(`insert into recipes(id,source_key,name,normalized_name,symbol,preparation_minutes) values (${quote(ids[3])},'existing','Existing','existing','test',10);
    ${insertReadiness(readinessRow(ids[3], keys[3]))}`);
  const existing = sql("select to_jsonb(r) from public.recipe_readiness_cache r;");
  sql(readFileSync(new URL("../../supabase/migrations/20261002220202_transactional_bounded_readiness.sql", import.meta.url), "utf8"));
  assert.equal(sql("select to_jsonb(r) from public.recipe_readiness_cache r;"), existing);
  preservedExistingData = true;
});
after(() => { docker(["rm", "-f", container], { stdio: "ignore" }); });
beforeEach(() => {
  sql(`drop trigger if exists zz_test_injection on ingredient_product_matches;
    drop function if exists test_injection();
    truncate recipe_readiness_cache, ingredient_product_matches, meal_mix_profiles, recipe_ingredients, ingredient_aliases, ingredients, recipes, product_prices, products cascade;
    truncate planner_write_revisions;
    insert into planner_write_revisions(resource) values ('catalog');
    insert into products(id,supermarket,sku,name) values (${quote(product)},'Hoogvliet','test','Test product');
    insert into recipes(id,source_key,name,normalized_name,symbol,preparation_minutes)
      values ${ids.map((id, i) => `(${quote(id)},'test-${i}','Test ${i}','test ${i}','test',10)`).join(",")};
    insert into ingredient_product_matches(match_key,ingredient_source_key,requirement_unit,requirement_kind,match_status,failure_reason,matcher_version)
      values ${keys.map(k => `(${quote(k)},${quote(k[0])},'g','ingredient','invalid','no_catalog_product',4)`).join(",")};
    insert into recipe_readiness_cache(recipe_id,people_count,readiness_status,required_ingredient_count,ready_required_ingredient_count,problem_count,readiness_payload,dependency_match_keys,evaluator_version,expires_at)
    select id,n,'NOT_READY',1,0,1,'{}',array[k],4,now()+interval '1 day'
    from (values ${ids.map((id, i) => `(${quote(id)}::uuid,${quote(keys[i])})`).join(",")}) v(id,k) cross join generate_series(1,10) n;`);
});

test("additive migration preserves existing readiness rows byte-for-byte", () => {
  assert.equal(preservedExistingData, true);
});
test("legacy writes remain current on keys not yet transactionally maintained", () => {
  sql(`set role service_role; update recipe_readiness_cache set refresh_status='current' where recipe_id=${quote(ids[0])};`);
  assert.equal(state().readiness.filter(r => r.recipe_id === ids[0] && r.refresh_status === "current").length, 10);
});
test("match constraint failure rolls back all cache writes and revisions", () => {
  const p = plan(); p.matches[0].requirement_unit = "invalid";
  rejectsUnchanged(p, /23514/);
});
test("readiness constraint failure rolls back successful match phase and trigger invalidations", () => {
  const p = plan(); p.rows[9].ready_required_ingredient_count = 2;
  rejectsUnchanged(p, /23514/);
});
test("trigger attempting an outside-scope effect rolls back the whole transaction", () => {
  const p = plan();
  sql(`create function test_injection() returns trigger language plpgsql as $$ begin
    update public.recipe_readiness_cache set refresh_status='pending' where recipe_id=${quote(ids[3])}; return new; end $$;
    create trigger zz_test_injection after update on ingredient_product_matches for each row execute function test_injection();`);
  rejectsUnchanged(p, /bounded_outside_readiness_scope/);
});
test("new subscriber between dry-run and RPC conflicts without writes", () => {
  const p = plan();
  sql(`update recipe_readiness_cache set dependency_match_keys=${array([keys[0]])} where recipe_id=${quote(ids[3])};`);
  rejectsUnchanged(p, /bounded_outside_subscriber/);
});
test("inserted subscriber phantom between dry-run and RPC conflicts without writes", () => {
  const p = plan(); sql(insertReadiness(readinessRow(ids[3], keys[0], 11)));
  rejectsUnchanged(p, /bounded_outside_subscriber/);
});
test("changed match before RPC invalidates CAS", () => {
  const p = plan(); sql(`update ingredient_product_matches set checked_at=now() where match_key=${quote(keys[0])};`);
  rejectsUnchanged(p, /bounded_stale_plan/);
});
test("two concurrent requests for the same key permit at most one commit", async () => {
  const p = plan(); const a = new Session();
  try {
    await a.query(`begin; set role service_role; ${call(p)}`);
    rejectsUnchanged(p, /bounded_scope_busy/);
    await a.query("commit;");
    assert.equal(state().readiness.filter(r => r.recipe_id === ids[0] && r.refresh_status === "current" && r.readiness_status === "READY").length, 10);
    rejectsUnchanged(p, /bounded_stale_plan/);
  } finally { await a.close(); }
});
test("partially overlapping scopes cannot cross-write", async () => {
  const p = plan(); const overlap = plan([0, 1]); const a = new Session(); const before = state();
  try {
    await a.query(`begin; set role service_role; ${call(p)}`);
    rejectsUnchanged(overlap, /bounded_scope_busy/);
    await a.query("commit;");
    assert.deepEqual(state().readiness.filter(r => r.recipe_id !== ids[0]), before.readiness.filter(r => r.recipe_id !== ids[0]));
  } finally { await a.close(); }
});
test("non-overlapping scopes commit in parallel while the first transaction remains open", async () => {
  const p = plan(); const other = plan([1]); const a = new Session();
  try {
    await a.query(`begin; set role service_role; ${call(p)}`);
    assert.equal(commit(other).readinessWrites, 10);
    // A is uncommitted: an independent connection still sees its old data.
    assert.equal(state().readiness.find(r => r.recipe_id === ids[0]).readiness_status, "NOT_READY");
    await a.query("commit;");
    assert.equal(state().readiness.filter(r => r.readiness_status === "READY").length, 20);
  } finally { await a.close(); }
});
test("injected infrastructure error after match phase rolls back everything", () => {
  const p = plan();
  sql(`create function test_injection() returns trigger language plpgsql as $$ begin
    raise exception using errcode='XX000', message='injected_after_match'; end $$;
    create trigger zz_test_injection after update on ingredient_product_matches for each row execute function test_injection();`);
  rejectsUnchanged(p, /XX000.*injected_after_match/);
});
test("replaying the exact plan is explicitly stale; a fresh bounded recovery succeeds", () => {
  const p = plan(); const result = commit(p);
  assert.equal(result.matchWrites, 1); assert.equal(result.readinessWrites, 10);
  assert.equal(result.outsideScopeEffects, 0); assert.notEqual(result.finalPlanToken, p.token);
  rejectsUnchanged(p, /bounded_stale_plan/);
  sql(`update recipe_readiness_cache set refresh_status='pending' where recipe_id=${quote(ids[0])};`);
  const fresh = plan(); commit(fresh);
  assert.equal(state().readiness.filter(r => r.recipe_id === ids[0] && r.refresh_status === "current").length, 10);
});
test("concurrent legacy subscriber cannot sneak in during RPC; after commit it stays pending", async () => {
  const p = plan(); const a = new Session();
  const write = `update recipe_readiness_cache set dependency_match_keys=${array([keys[0]])}, refresh_status='current' where recipe_id=${quote(ids[3])};`;
  try {
    await a.query(`begin; set role service_role; ${call(p)}`);
    assert.throws(() => sql(`set role service_role; ${write}`), /bounded_scope_busy/);
    await a.query("commit;"); sql(`set role service_role; ${write}`);
    assert.equal(state().readiness.filter(r => r.recipe_id === ids[3] && r.refresh_status === "pending").length, 10);
  } finally { await a.close(); }
});
test("concurrent INSERT subscriber phantom is rejected while the bounded key is locked", async () => {
  const p = plan(); const a = new Session();
  const write = insertReadiness(readinessRow(ids[3], keys[0], 11));
  try {
    await a.query(`begin; set role service_role; ${call(p)}`);
    assert.throws(() => sql(`set role service_role; ${write}`), /bounded_scope_busy/);
    await a.query("commit;");
    assert.equal(state().readiness.filter(r => r.people_count === 11).length, 0);
  } finally { await a.close(); }
});
test("concurrent legacy match mutation cannot pass a bounded commit", async () => {
  const p = plan(); const a = new Session();
  try {
    // Acquire the real RPC key locks before staging any row writes. This
    // exercises legacy BEFORE-row guard conflicts without tuple-lock waiting.
    await a.query(`begin; select public.planner_lock_resources(${array([`k:${keys[0]}`, `r:${ids[0]}`])});`);
    assert.throws(() => sql(`set role service_role; update ingredient_product_matches set matcher_version=99 where match_key=${quote(keys[0])};`), /bounded_scope_busy/);
    await a.query(`set role service_role; ${call(p)} commit;`);
    assert.equal(state().matches.find(r => r.match_key === keys[0]).matcher_version, 5);
  } finally { await a.close(); }
});
test("missing match row is safely inserted and shares the same key guard", () => {
  sql(`delete from ingredient_product_matches where match_key=${quote(keys[0])};`);
  const p = plan(); assert.equal(commit(p).matchWrites, 1);
  assert.equal(state().matches.find(r => r.match_key === keys[0]).matcher_version, 5);
});
test("late legacy READY cannot overwrite transactional state as current", () => {
  commit(plan());
  sql(`set role service_role; update recipe_readiness_cache set refresh_status='current', readiness_payload='{"stale":true}' where recipe_id=${quote(ids[0])};`);
  assert.equal(state().readiness.filter(r => r.recipe_id === ids[0] && r.invalidation_reason === "transactional_refresh_required" && r.refresh_status === "pending").length, 10);
});
test("legacy delete/reinsert cannot evade protection with an old dependency set", () => {
  commit(plan());
  sql(`set role service_role; delete from recipe_readiness_cache where recipe_id=${quote(ids[0])} and people_count=1;
    ${insertReadiness(readinessRow(ids[0], keys[1]))}`);
  assert.equal(state().readiness.find(r => r.recipe_id === ids[0] && r.people_count === 1).refresh_status, "pending");
});
test("catalog phantom revision invalidates a pre-evaluated plan", () => {
  const p = plan(); sql("insert into products(supermarket,sku,name) values ('Hoogvliet','new','New candidate');");
  rejectsUnchanged(p, /bounded_stale_plan/);
});
test("catalog writer blocks behind shared fence then invalidates after bounded commit", async () => {
  const p = plan(); const a = new Session(); const b = new Session();
  try {
    await a.query(`begin; set role service_role; ${call(p)}`);
    const changing = b.query(`begin; update products set name='Changed' where id=${quote(product)}; commit;`);
    let waiting = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      waiting = Number(sql("select count(*) from pg_locks where locktype='advisory' and not granted;")) > 0;
      if (waiting) break;
      await delay(50);
    }
    assert.equal(waiting, true, "real PostgreSQL advisory-lock wait, not timing-only evidence");
    assert.equal(sql(`select name from products where id=${quote(product)};`), "Test product");
    await a.query("commit;");
    await changing;
    assert.equal(sql(`select name from products where id=${quote(product)};`), "Changed");
    assert.equal(state().readiness.filter(r => r.recipe_id === ids[0] && r.refresh_status === "pending").length, 10);
  } finally { await a.close(); await b.close(); }
});
test("in-flight catalog mutation fails bounded commit closed", async () => {
  const p = plan(); const a = new Session();
  try {
    await a.query(`begin; update products set name='Changed' where id=${quote(product)};`);
    rejectsUnchanged(p, /bounded_catalog_busy/);
    await a.query("rollback;"); assert.equal(commit(p).readinessWrites, 10);
  } finally { await a.close(); }
});
test("read-only dependency match changes also invalidate CAS", () => {
  const p = plan([0], [keys[0], keys[1]]);
  sql(`update ingredient_product_matches set checked_at=now() where match_key=${quote(keys[1])};`);
  rejectsUnchanged(p, /bounded_stale_plan/);
});
test("payload scope and duplicate variants fail closed", () => {
  const p = plan(); p.rows[9] = p.rows[0]; rejectsUnchanged(p, /bounded_payload_scope_mismatch/);
  const outside = plan(); outside.matches[0].match_key = keys[1]; rejectsUnchanged(outside, /bounded_payload_scope_mismatch/);
});
test("RPC execute and revision writes are denied to public/browser roles", () => {
  const p = plan(); const before = state();
  for (const role of ["anon", "authenticated"]) {
    assert.throws(() => sql(`set role ${role}; ${call(p)}`), /42501/);
    assert.throws(() => sql(`set role ${role}; select bounded_readiness_source_revision();`), /42501/);
  }
  assert.throws(() => sql("set role service_role; update planner_write_revisions set revision=0;"), /42501/);
  assert.deepEqual(state(), before);
});
