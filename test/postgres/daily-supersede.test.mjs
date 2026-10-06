import assert from "node:assert/strict";
import { after, before, beforeEach, test } from "node:test";
import { execFileSync, spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

// Local-only disposable PostgreSQL contract/concurrency test. It never reads
// credentials or addresses Supabase/Production.
const container = "bm-daily-supersede-test-" + process.pid;
const docker = (args, options = {}) => execFileSync("docker", args, { encoding: "utf8", ...options });
const psqlArgs = ["exec", "-i", container, "psql", "-h", "127.0.0.1", "-XqAt",
  "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=verbose", "-U", "postgres"];
const sql = query => docker(psqlArgs, { input: query, stdio: ["pipe", "pipe", "pipe"] }).trim();
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const oldJob = "00000000-0000-4000-8000-000000000001";
const productID = "00000000-0000-4000-8000-000000000101";
const freshNow = "2026-10-05T08:10:00Z";
const oldUpdated = "2026-10-05T08:05:00Z";
const stateKey = "daily-catalog-growth";

function rpcCall({ jobID = oldJob, expectedRecovery = 1, reason = "software_fix_verified" } = {}) {
  return [
    "select public.supersede_failed_catalog_daily_job(",
    quote(jobID), "::uuid, ", quote(stateKey), ", '2026-10-05'::date, ",
    "'failed_requires_attention', ", quote(oldUpdated), "::timestamptz, ",
    "3, 0, 400, ", String(expectedRecovery), ", ", quote(reason), ", ",
    "'github_actions:test:123:abc', ", quote(freshNow), "::timestamptz, 130);",
  ].join("");
}

function seedEligibleJob() {
  sql([
    "set role service_role;",
    "delete from public.catalog_daily_supersedes;",
    "delete from public.catalog_daily_attempts;",
    "delete from public.catalog_daily_jobs;",
    "insert into public.catalog_daily_jobs(",
    "id,state_key,job_date,target_new_products,new_products_collected,status,",
    "attempt_count,started_at,completed_at,recovery_count,created_at,updated_at",
    ") values (",
    quote(oldJob), "::uuid,", quote(stateKey), ",'2026-10-05',400,0,",
    "'failed_requires_attention',3,'2026-10-05T06:00:00Z',", quote(oldUpdated),
    "::timestamptz,1,'2026-10-05T06:00:00Z',", quote(oldUpdated), "::timestamptz);",
    "insert into public.catalog_daily_attempts(",
    "id,daily_job_id,attempt_number,started_at,completed_at,status,",
    "error_code,error_summary,cumulative_new_after,remaining_target_after",
    ") values (",
    "'00000000-0000-4000-8000-000000000011'::uuid,", quote(oldJob), "::uuid,3,",
    "'2026-10-05T06:00:00Z',", quote(oldUpdated), "::timestamptz,",
    "'non_retryable_failure','non_retryable_import_error','verified importer failure',0,400);",
  ].join("\n"));
}

function snapshotCatalog() {
  return sql([
    "select jsonb_build_object(",
    "'products',(select jsonb_agg(to_jsonb(p) order by p.id) from public.products p),",
    "'prices',(select jsonb_agg(to_jsonb(p) order by p.product_id) from public.product_prices p),",
    "'discovery',(select jsonb_agg(to_jsonb(s) order by s.state_key) from public.catalog_discovery_state s)",
    ");",
  ].join("\n"));
}

// Persistent psql sessions let the test hold the first RPC transaction open
// while a second caller tries to acquire the same state-key/day lock.
class Session {
  constructor() {
    this.child = spawn("docker", psqlArgs, { stdio: ["pipe", "pipe", "pipe"] });
    this.output = "";
    this.errors = "";
    this.child.stdout.on("data", data => { this.output += data; this.check?.(); });
    this.child.stderr.on("data", data => { this.errors += data; });
    this.child.on("close", code => {
      this.closed = true;
      this.reject?.(new Error("psql exited " + code + ": " + this.errors));
    });
  }
  query(query) {
    return new Promise((resolve, reject) => {
      const marker = "done_" + Math.random().toString(16).slice(2);
      const timer = setTimeout(() => reject(new Error("transaction barrier timed out")), 10_000);
      this.reject = error => { clearTimeout(timer); reject(error); };
      this.output = "";
      this.check = () => {
        if (!this.output.includes(marker)) return;
        clearTimeout(timer);
        const result = this.output.split(marker)[0].trim();
        this.check = null;
        this.reject = null;
        resolve(result);
      };
      this.child.stdin.write(query + "\n\\echo " + marker + "\n");
    });
  }
  async close() {
    if (!this.closed) {
      try { await this.query("rollback;"); } catch { /* process may already have errored */ }
      this.child.stdin.end();
    }
  }
}

before(async () => {
  docker(["run", "--detach", "--rm", "--name", container, "-e", "POSTGRES_PASSWORD=local-test-only", "postgres:17"]);
  for (let attempt = 0; ; attempt += 1) {
    try {
      docker(["exec", container, "pg_isready", "-h", "127.0.0.1", "-U", "postgres"], { stdio: "ignore" });
      break;
    } catch (error) {
      if (attempt > 60) throw error;
      await delay(200);
    }
  }
  sql(readFileSync(new URL("./catalog-bootstrap.sql", import.meta.url), "utf8"));
  sql("alter table public.products add column if not exists product_type text;");
  sql([
    "create table public.catalog_discovery_state(",
    "state_key text primary key, term_cursor integer not null default 0,",
    "page_cursor integer not null default 0, last_batch text,",
    "updated_at timestamptz not null default now());",
    "insert into public.products(id,supermarket,sku,name) values (",
    quote(productID), "::uuid,'Hoogvliet','unchanged-1','Unchanged product');",
    "insert into public.product_prices(product_id,price,fetched_at) values (",
    quote(productID), "::uuid,2.49,'2026-10-05T06:00:00Z');",
    "insert into public.catalog_discovery_state(state_key,term_cursor,page_cursor,last_batch)",
    "values (", quote(stateKey), ",4,21,'{\"version\":4,\"lastTerm\":\"producten\"}');",
  ].join("\n"));
  sql(readFileSync(new URL("../../supabase/migrations/20260917092809_self_healing_daily_catalog_growth.sql", import.meta.url), "utf8"));
  sql(readFileSync(new URL("../../supabase/migrations/20261005220000_recover_failed_daily_catalog_growth.sql", import.meta.url), "utf8"));
  sql(readFileSync(new URL("../../supabase/migrations/20261005230000_supersede_failed_daily_catalog_job.sql", import.meta.url), "utf8"));
  sql("grant select, insert, update, delete on all tables in schema public to service_role;");
});

after(() => { docker(["rm", "-f", container], { stdio: "ignore" }); });

beforeEach(() => {
  seedEligibleJob();
});

test("one supersede creates a new 400/0 job, closes old history, audits, and leaves catalog state unchanged", () => {
  const before = snapshotCatalog();
  const result = JSON.parse(sql("set role service_role; " + rpcCall()));
  assert.equal(result.claimed, true);
  assert.equal(result.superseded, true);
  assert.notEqual(result.previousDailyImportId, result.job.id);
  assert.equal(result.job.target_new_products, 400);
  assert.equal(result.job.new_products_collected, 0);
  assert.equal(result.job.status, "running");
  assert.equal(result.job.attempt_count, 1);
  assert.equal(result.job.recovery_count, 0);
  assert.equal(snapshotCatalog(), before);

  const rows = JSON.parse(sql([
    "select jsonb_build_object(",
    "'old',(select to_jsonb(j) from public.catalog_daily_jobs j where j.id=", quote(oldJob), "::uuid),",
    "'current_count',(select count(*) from public.catalog_daily_jobs where state_key=", quote(stateKey),
    " and job_date='2026-10-05' and superseded_at is null),",
    "'audit',(select to_jsonb(s) from public.catalog_daily_supersedes s),",
    "'attempts',(select count(*) from public.catalog_daily_attempts where daily_job_id=", quote(result.job.id), "::uuid)",
    ");",
  ].join("")));
  assert.equal(rows.old.status, "failed_requires_attention");
  assert.equal(rows.old.new_products_collected, 0);
  assert.equal(rows.old.superseded_by_job_id, result.job.id);
  assert.ok(rows.old.superseded_at);
  assert.equal(rows.current_count, 1);
  assert.equal(rows.audit.previous_daily_job_id, oldJob);
  assert.equal(rows.audit.new_daily_job_id, result.job.id);
  assert.equal(rows.audit.original_failure_reason, "non_retryable_import_error");
  assert.equal(rows.audit.supersede_reason, "software_fix_verified");
  assert.equal(rows.audit.actor_context, "github_actions:test:123:abc");
  assert.equal(rows.attempts, 1);

  // The new row uses the ordinary attempt lifecycle: finish schedules a
  // normal retry and the standard claim can take it once it is due.
  sql([
    "set role service_role; select public.finish_catalog_daily_attempt(",
    quote(result.job.id), "::uuid,", quote(result.attemptId), "::uuid,", quote(result.lockToken), "::uuid,",
    "'retryable_failure','{\"new\":0}'::jsonb,'temporary',", quote("2026-10-05T12:00:00Z"),
    "::timestamptz,'source_unavailable','temporary source issue','paused',",
    quote("2026-10-05T08:20:00Z"), "::timestamptz);",
  ].join(""));
  const retry = JSON.parse(sql([
    "set role service_role; select public.claim_catalog_daily_attempt(",
    quote(stateKey), ",'2026-10-05',400,", quote("2026-10-05T10:30:00Z"),
    "::timestamptz,130);",
  ].join("")));
  assert.equal(retry.claimed, false);
  assert.equal(retry.reason, "retry_not_due");
  const next = JSON.parse(sql([
    "set role service_role; select public.claim_catalog_daily_attempt(",
    quote(stateKey), ",'2026-10-05',400,", quote("2026-10-05T14:00:00Z"),
    "::timestamptz,130);",
  ].join("")));
  assert.equal(next.claimed, true);
  assert.equal(next.job.id, result.job.id);
  assert.equal(next.job.attempt_count, 2);
});

test("running, retry, active lock, unused recovery, and second successor fail closed", () => {
  sql("update public.catalog_daily_jobs set status='running', lock_token=gen_random_uuid(), lock_expires_at=" +
    quote("2026-10-05T10:00:00Z") + "::timestamptz where id=" + quote(oldJob) + "::uuid;");
  assert.throws(() => sql("set role service_role; " + rpcCall()), /daily supersede status conflict/);

  seedEligibleJob();
  sql("update public.catalog_daily_jobs set status='retry_scheduled', next_retry_at=" +
    quote("2026-10-05T10:00:00Z") + "::timestamptz where id=" + quote(oldJob) + "::uuid;");
  assert.throws(() => sql("set role service_role; " + rpcCall()), /daily supersede status conflict/);

  seedEligibleJob();
  sql("update public.catalog_daily_jobs set next_retry_at=" + quote("2026-10-05T10:00:00Z") +
    "::timestamptz where id=" + quote(oldJob) + "::uuid;");
  assert.throws(() => sql("set role service_role; " + rpcCall()), /daily supersede heeft nog een geplande retry/);

  seedEligibleJob();
  sql("update public.catalog_daily_jobs set recovery_count=0 where id=" + quote(oldJob) + "::uuid;");
  assert.throws(() => sql("set role service_role; " + rpcCall({ expectedRecovery: 0 })), /daily supersede vereist verbruikte recovery/);

  seedEligibleJob();
  const result = JSON.parse(sql("set role service_role; " + rpcCall()));
  assert.throws(() => sql("set role service_role; " + rpcCall()), /current job ontbreekt of is al opgevolgd/);
  assert.equal(sql("select count(*) from public.catalog_daily_supersedes;"), "1");
  assert.equal(sql("select count(*) from public.catalog_daily_jobs where state_key=" + quote(stateKey) +
    " and job_date='2026-10-05' and superseded_at is null;"), "1");
  assert.equal(result.job.target_new_products, 400);
});

test("two concurrent maintenance requests permit exactly one successor", async () => {
  seedEligibleJob();
  const a = new Session();
  const b = new Session();
  try {
    const first = await a.query("begin; set role service_role; " + rpcCall());
    const firstRow = JSON.parse(first);
    const waiting = b.query("set role service_role; " + rpcCall());
    await delay(100);
    await a.query("commit;");
    await assert.rejects(waiting, /current job ontbreekt of is al opgevolgd|duplicate key/);
    assert.equal(firstRow.superseded, true);
    assert.equal(sql("select count(*) from public.catalog_daily_supersedes;"), "1");
    assert.equal(sql("select count(*) from public.catalog_daily_jobs where state_key=" + quote(stateKey) +
      " and job_date='2026-10-05' and superseded_at is null;"), "1");
  } finally {
    await a.close();
    await b.close();
  }
});
