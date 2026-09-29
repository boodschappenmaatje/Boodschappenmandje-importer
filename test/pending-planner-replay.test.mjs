import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  inspectEarlierProducts, readPendingSnapshot, replayPendingMaintenance, replaySettings, REPLAY_BATCH_LIMIT,
} from "../src/pending-planner-replay.mjs";

const id = index => `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const config = replaySettings({ SUPABASE_URL: "https://pjcqxufvbkkjehituzxz.supabase.co", SUPABASE_SECRET_KEY: "sb_secret_fixture",
  PLANNER_CACHE_ADMIN_TOKEN: "fixture-admin" });
const success = count => ({ productCount: count, changedMatchKeys: [], affectedRecipeIds: [], refreshedReadinessCount: 0 });
const response = (body, status = 200) => new Response(JSON.stringify(body), { status,
  headers: { "content-type": "application/json" } });

function fixture(count, options = {}) {
  let pending = Array.from({ length: count }, (_, i) => id(i + 1));
  let notifiedProducts = 0;
  let timestamp = "2026-09-28T20:00:00.000Z";
  let posts = 0;
  let patches = 0;
  let reads = 0;
  let sleeps = [];
  const requests = [];
  const fetcher = async (url, init) => {
    const pathname = new URL(url).pathname;
    requests.push({ pathname, method: init.method, body: init.body });
    if (pathname === "/rest/v1/catalog_discovery_state" && init.method === "GET") {
      reads++;
      const metadata = { version: 4, termCursor: 7, plannerMaintenance: {
        status: pending.length ? "pending_requires_attention" : "confirmed", pendingProductIds: pending,
        notifiedProducts, failures: [] }, otherData: "preserved" };
      return response([{ state_key: "daily-catalog-growth", last_batch: JSON.stringify(metadata), updated_at: timestamp }]);
    }
    if (pathname === "/api/internal/planner-readiness/new-products" && init.method === "POST") {
      posts++;
      const offered = JSON.parse(init.body).productIds;
      if (options.post) return options.post(posts, offered);
      return response(success(offered.length));
    }
    if (pathname === "/rest/v1/catalog_discovery_state" && init.method === "PATCH") {
      patches++;
      if (options.patch) return options.patch(patches, init);
      const urlObject = new URL(url);
      assert.equal(urlObject.searchParams.get("state_key"), "eq.daily-catalog-growth");
      assert.equal(urlObject.searchParams.get("updated_at"), `eq.${timestamp}`);
      const body = JSON.parse(init.body);
      const metadata = JSON.parse(body.last_batch);
      assert.equal(metadata.otherData, "preserved");
      assert.equal(metadata.termCursor, 7);
      assert.equal(new Headers(init.headers).get("prefer"), "return=representation");
      pending = metadata.plannerMaintenance.pendingProductIds;
      notifiedProducts = metadata.plannerMaintenance.notifiedProducts;
      timestamp = body.updated_at;
      return response([{ state_key: "daily-catalog-growth", last_batch: body.last_batch, updated_at: timestamp }]);
    }
    if (pathname === "/rest/v1/products" && init.method === "GET") return response([]);
    if (pathname === "/rest/v1/ingredient_product_matches" && init.method === "GET") return response([]);
    throw new Error(`Forbidden request ${init.method} ${pathname}`);
  };
  return { fetcher, requests, get pending() { return pending; }, get notifiedProducts() { return notifiedProducts; },
    get posts() { return posts; }, get patches() { return patches; }, get reads() { return reads; },
    waits: sleeps, wait: async ms => { sleeps.push(ms); } };
}

function assertNoCatalogWrites(f) {
  assert.ok(f.requests.every(request =>
    request.pathname === "/api/internal/planner-readiness/new-products" ? request.method === "POST" :
      request.pathname === "/rest/v1/catalog_discovery_state" ? ["GET", "PATCH"].includes(request.method) :
        ["/rest/v1/products", "/rest/v1/ingredient_product_matches"].includes(request.pathname) &&
          request.method === "GET"));
  assert.ok(f.requests.filter(request => request.method === "PATCH").every(request => {
    const keys = Object.keys(JSON.parse(request.body));
    return keys.length === 2 && keys.includes("last_batch") && keys.includes("updated_at");
  }));
}

test("limits a single run to 20 proven pending IDs and accounts for acknowledgement", async () => {
  const f = fixture(290);
  const r = await replayPendingMaintenance(config, { fetcher: f.fetcher });
  assert.equal(REPLAY_BATCH_LIMIT, 20);
  assert.deepEqual({ selected: r.selected, offered: r.offered, successful: r.successful,
    acknowledged: r.acknowledged, pendingBefore: r.pendingBefore, pendingAfter: r.pendingAfter,
    catalogStateUpdates: r.catalogStateUpdates, status: r.status },
  { selected: 20, offered: 20, successful: 20, acknowledged: 20, pendingBefore: 290,
    pendingAfter: 270, catalogStateUpdates: 1, status: "confirmed" });
  assert.equal(f.posts, 1);
  assert.equal(f.patches, 1);
  assert.equal(f.notifiedProducts, 20);
  assert.deepEqual(JSON.parse(f.requests.find(x => x.method === "POST").body).productIds,
    Array.from({ length: 20 }, (_, i) => id(i + 1)));
  assert.deepEqual([r.productInserts, r.priceInserts, r.dailyJobWrites, r.importStarted, r.discoveryStarted],
    [0, 0, 0, false, false]);
  assertNoCatalogWrites(f);
});

test("an acknowledged batch is skipped on a second replay, and an empty queue does nothing", async () => {
  const f = fixture(3);
  const first = await replayPendingMaintenance(config, { fetcher: f.fetcher });
  const second = await replayPendingMaintenance(config, { fetcher: f.fetcher });
  assert.equal(first.acknowledged, 3);
  assert.equal(second.status, "nothing_pending");
  assert.equal(f.posts, 1);
  assert.equal(f.patches, 1);
  assert.equal(f.notifiedProducts, 3);
  assertNoCatalogWrites(f);
});

test("the second batch skips previously acknowledged IDs", async () => {
  const f = fixture(21);
  const first = await replayPendingMaintenance(config, { fetcher: f.fetcher });
  const second = await replayPendingMaintenance(config, { fetcher: f.fetcher });
  assert.equal(first.acknowledged, 20);
  assert.equal(second.acknowledged, 1);
  assert.equal(f.notifiedProducts, 21);
  assert.deepEqual(f.requests.filter(x => x.method === "POST").map(x => JSON.parse(x.body).productIds),
    [Array.from({ length: 20 }, (_, i) => id(i + 1)), [id(21)]]);
  assertNoCatalogWrites(f);
});

test("a partial or malformed maintenance response leaves every ID pending", async () => {
  const f = fixture(4, { post: () => response(success(2)) });
  const r = await replayPendingMaintenance(config, { fetcher: f.fetcher });
  assert.equal(r.status, "maintenance_requires_attention");
  assert.equal(r.error.stage, "maintenance-response-invalid");
  assert.equal(r.acknowledged, 0);
  assert.equal(r.pendingAfter, 4);
  assert.equal(f.posts, 1);
  assert.equal(f.patches, 0);
  assertNoCatalogWrites(f);
});

test("a permanent auth error fails closed, without retry or acknowledgement", async () => {
  const f = fixture(1, { post: () => response({ error: "unauthorized" }, 401) });
  const r = await replayPendingMaintenance(config, { fetcher: f.fetcher });
  assert.deepEqual(r.error, { stage: "maintenance-http-failed", status: 401 });
  assert.equal(r.retries, 0);
  assert.equal(f.posts, 1);
  assert.equal(f.patches, 0);
  assertNoCatalogWrites(f);
});

test("transient failure uses bounded backoff and still acknowledges only full success", async () => {
  const f = fixture(1, { post: n => n < 3 ? response({ error: "retry" }, 503) : response(success(1)) });
  const r = await replayPendingMaintenance(config, { fetcher: f.fetcher, wait: f.wait });
  assert.equal(r.status, "confirmed");
  assert.equal(r.retries, 2);
  assert.deepEqual(f.waits, [1000, 2000]);
  assert.equal(f.posts, 3);
  assert.equal(r.acknowledged, 1);
  assertNoCatalogWrites(f);
});

test("transient failure exhausts within the same run, preserving pending IDs", async () => {
  const f = fixture(2, { post: () => response({ error: "retry" }, 503) });
  const r = await replayPendingMaintenance(config, { fetcher: f.fetcher, wait: f.wait });
  assert.equal(r.status, "maintenance_requires_attention");
  assert.equal(r.retries, 2);
  assert.deepEqual(f.waits, [1000, 2000]);
  assert.equal(r.pendingAfter, 2);
  assert.equal(f.patches, 0);
  assertNoCatalogWrites(f);
});

test("the real 503 paths retain only allowlisted route codes and never acknowledge", async () => {
  for (const code of ["cache-unavailable", "new-product-maintenance-failed"]) {
    const f = fixture(21, { post: () => response({ error: code, secret: "fixture-must-not-leak",
      exception: "private database details" }, 503) });
    const r = await replayPendingMaintenance(config, { fetcher: f.fetcher, wait: f.wait });
    assert.deepEqual(r.error, { stage: "maintenance-http-failed", status: 503, code });
    assert.equal(r.selected, 20);
    assert.equal(r.offered, 20);
    assert.equal(r.retries, 2);
    assert.equal(r.successful, 0);
    assert.equal(r.acknowledged, 0);
    assert.equal(r.pendingAfter, 21);
    assert.equal(f.notifiedProducts, 0);
    assert.equal(f.patches, 0);
    assert.equal(f.posts, 3);
    assert.doesNotMatch(JSON.stringify(r), /fixture-must-not-leak|private database details/);
    assertNoCatalogWrites(f);
  }
});

test("an unknown or malformed 503 body cannot enter the maintenance log", async () => {
  for (const body of [{ error: "secret-value", authorization: "fixture-private" }, "not-json"]) {
    const f = fixture(1, { post: () => body === "not-json"
      ? new Response(body, { status: 503 }) : response(body, 503) });
    const r = await replayPendingMaintenance(config, { fetcher: f.fetcher, wait: f.wait });
    assert.deepEqual(r.error, { stage: "maintenance-http-failed", status: 503 });
    assert.equal(r.acknowledged, 0);
    assert.equal(f.patches, 0);
    assert.doesNotMatch(JSON.stringify(r), /secret-value|fixture-private|not-json/);
    assertNoCatalogWrites(f);
  }
});

test("an acknowledgement failure is explicit; idempotent re-offer can recover later", async () => {
  const f = fixture(2, { patch: n => n === 1 ? response({}, 503) : undefined });
  const first = await replayPendingMaintenance(config, { fetcher: f.fetcher });
  assert.equal(first.status, "acknowledgement_requires_attention");
  assert.equal(first.successful, 2);
  assert.equal(first.acknowledged, 0);
  assert.equal(first.pendingAfter, 2);
  // The source remains pending and the next invocation may safely re-offer the same IDs.
  assert.equal(f.posts, 1);
  assertNoCatalogWrites(f);
});

test("a lost acknowledgement compare-and-set retries without re-offering maintenance", async () => {
  const f = fixture(2);
  let firstPatch = true;
  const fetcher = async (url, init) => {
    if (init.method === "PATCH" && firstPatch) {
      firstPatch = false;
      return response([]);
    }
    return f.fetcher(url, init);
  };
  const r = await replayPendingMaintenance(config, { fetcher });
  assert.equal(r.status, "confirmed");
  assert.equal(r.acknowledged, 2);
  assert.equal(f.posts, 1);
  assert.equal(f.patches, 1);
  assert.ok(f.reads >= 2);
  assertNoCatalogWrites(f);
});

test("a transport error is retried at most three times with one pending batch", async () => {
  const f = fixture(2, { post: n => n === 1 ? Promise.reject(new Error("local fixture")) : response(success(2)) });
  const r = await replayPendingMaintenance(config, { fetcher: f.fetcher, wait: f.wait });
  assert.equal(r.retries, 1);
  assert.equal(f.posts, 2);
  assert.equal(f.patches, 1);
  assert.deepEqual(f.waits, [1000]);
  assertNoCatalogWrites(f);
});

test("config refuses a different project and unsafe credentials before a request", () => {
  assert.throws(() => replaySettings({ SUPABASE_URL: "https://other.supabase.co",
    SUPABASE_SECRET_KEY: "sb_secret_fixture", PLANNER_CACHE_ADMIN_TOKEN: "fixture" }),
  { stage: "invalid-server-configuration" });
  assert.throws(() => replaySettings({ SUPABASE_URL: "https://pjcqxufvbkkjehituzxz.supabase.co",
    SUPABASE_SECRET_KEY: "sb_publishable_fixture", PLANNER_CACHE_ADMIN_TOKEN: "fixture" }),
  { stage: "missing-server-configuration" });
});

test("read-only inventory of the earlier 10 stays separate and never posts", async () => {
  const f = fixture(2);
  const result = await inspectEarlierProducts(config, [id(11), id(12)], f.fetcher);
  assert.deepEqual(result, { requested: 2, catalogPresent: 0, linkedMatchCount: 0, pendingOverlap: 0,
    maintenanceConfirmed: false, needsFurtherReadinessReview: true, databaseWrites: 0 });
  await assert.rejects(() => inspectEarlierProducts(config, [id(1)], f.fetcher), { stage: "earlier-ids-overlap-pending" });
  assert.equal(f.posts, 0);
  assert.equal(f.patches, 0);
  assertNoCatalogWrites(f);
});

test("invalid or duplicate pending metadata fails before maintenance", async () => {
  const f = fixture(2, { patch: () => response([]) });
  const s = await readPendingSnapshot(config, f.fetcher);
  assert.equal(s.ids.length, 2);
  const corrupt = async (url, init) => {
    const original = await f.fetcher(url, init);
    const rows = await original.json();
    rows[0].last_batch = JSON.stringify({ version: 4, plannerMaintenance: {
      status: "pending_requires_attention", pendingProductIds: [id(1), id(1)], notifiedProducts: 0 } });
    return response(rows);
  };
  await assert.rejects(() => replayPendingMaintenance(config, { fetcher: corrupt }), { stage: "pending-state-invalid" });
  assert.equal(f.posts, 0);
  assert.equal(f.patches, 0);
});

test("separate workflow can only call the replay CLI and shares import concurrency", () => {
  const workflow = readFileSync(new URL("../.github/workflows/replay-pending-planner-maintenance.yml", import.meta.url), "utf8");
  const runner = readFileSync(new URL("../scripts/replay-pending-planner-maintenance.mjs", import.meta.url), "utf8");
  const replay = readFileSync(new URL("../src/pending-planner-replay.mjs", import.meta.url), "utf8");
  assert.match(workflow, /push:\s*\n\s*branches:/);
  assert.match(workflow, /maintenance\/replay-schedule\/\*\*/);
  assert.match(workflow, /maintenance\/replay-live\/\*\*/);
  assert.match(workflow, /github\.event_name == 'push'/);
  assert.match(workflow, /github\.run_attempt == 1/);
  assert.match(workflow, /pull_number: 33/);
  assert.match(workflow, /pr\.head\.sha !== sha/);
  assert.match(workflow, /pr\.head\.ref !== 'fix\/isolated-planner-maintenance-replay'/);
  assert.match(workflow, /pr\.head\.repo\.full_name !== context\.repo\.owner/);
  assert.match(workflow, /\(dry \|\| active\)\[1\] !== sha/);
  assert.match(workflow, /jobs:\s*\n\s*replay:[\s\S]*?concurrency:\s*\n\s*group: \$\{\{[^\n]*hoogvliet-maintenance-scheduling[^\n]*hoogvliet-supabase-update[^\n]*\}\}/);
  assert.doesNotMatch(workflow.slice(0, workflow.indexOf("jobs:")), /concurrency:/);
  assert.match(workflow, /cancel-in-progress: false/);
  assert.match(workflow, /node scripts\/replay-pending-planner-maintenance\.mjs/);
  const dryStep = workflow.match(/- name: Scheduling only[^\n]*\n([\s\S]*?)(?=\n\s*- uses: actions\/checkout@v4)/)?.[1];
  assert.ok(dryStep);
  assert.match(dryStep, /mode == 'schedule'/);
  assert.doesNotMatch(dryStep, /secrets\.|node scripts\//);
  const liveSteps = workflow.slice(workflow.indexOf("- uses: actions/checkout@v4"));
  assert.equal((liveSteps.match(/if: steps\.gate\.outputs\.mode == 'live'/g) ?? []).length, 3);
  assert.match(liveSteps, /REPLAY_EXPECTED_PENDING_COUNT: \$\{\{ steps\.gate\.outputs\.expected_pending_count \}\}/);
  assert.match(runner, /run85-pending-recovery-20260928\.json/);
  assert.match(runner, /historical\.productIds\.length !== 290/);
  assert.equal((workflow.match(/hoogvliet-supabase-update/g) ?? []).length, 1);
  assert.equal((workflow.match(/hoogvliet-maintenance-scheduling/g) ?? []).length, 1);
  assert.doesNotMatch(workflow, /schedule:|npm run import|node src\/importer|daily-catalog-growth|catalog-growth/);
  assert.doesNotMatch(runner + replay, /import\s*\([^)]*(?:catalog-growth|importer)|from\s*["'][^"']*(?:catalog-growth|importer)/);
  assert.match(replay, /REPLAY_BATCH_LIMIT = 20/);
});

test("one-time branch start is write-free for scheduling and fails closed for stale heads", () => {
  const workflow = readFileSync(new URL("../.github/workflows/replay-pending-planner-maintenance.yml", import.meta.url), "utf8");
  const ci = readFileSync(new URL("../.github/workflows/core-flows.yml", import.meta.url), "utf8");
  const sha = "a".repeat(40);
  const valid = (ref, actual = sha, pr = 33, branch = "fix/isolated-planner-maintenance-replay") => {
    const dry = ref.match(/^refs\/heads\/maintenance\/replay-schedule\/([0-9a-f]{40})$/);
    const live = ref.match(/^refs\/heads\/maintenance\/replay-live\/([0-9a-f]{40})\/(\d{1,3})$/);
    return !!(dry || live) && (dry || live)[1] === actual && actual === sha &&
      pr === 33 && branch === "fix/isolated-planner-maintenance-replay" &&
      (!live || (+live[2] >= 1 && +live[2] <= 290));
  };
  assert.equal(valid(`refs/heads/maintenance/replay-schedule/${sha}`), true);
  assert.equal(valid(`refs/heads/maintenance/replay-live/${sha}/290`), true);
  assert.equal(valid(`refs/heads/maintenance/replay-live/${sha}/291`), false);
  assert.equal(valid(`refs/heads/maintenance/replay-live/${sha}/290`, "b".repeat(40)), false);
  assert.equal(valid(`refs/heads/maintenance/replay-live/${sha}/290`, sha, 32), false);
  assert.equal(valid(`refs/heads/maintenance/replay-live/${sha}/290`, sha, 33, "main"), false);
  assert.equal(valid(`refs/heads/maintenance/replay-live/${sha}/290-extra`), false);
  assert.equal(valid(`refs/heads/fix/isolated-planner-maintenance-replay`), false);
  assert.match(workflow, /Scheduling only — no checkout, secrets, or maintenance/);
  assert.match(ci, /maintenance\/replay-schedule\/\*\*/);
  assert.doesNotMatch(ci, /maintenance\/replay-live\/\*\*/);
  assert.doesNotMatch(workflow, /pull_request:|workflow_dispatch:|\[pending-replay-acceptance:once\]/);
  assert.doesNotMatch(workflow, /npm run import|node src\/importer|import:daily/);
});

test("expected pending count rejects duplicate or stale live start before offering maintenance", async () => {
  const f = fixture(2);
  await assert.rejects(() => replayPendingMaintenance(config, {
    fetcher: f.fetcher, expectedPendingCount: 3,
  }), { stage: "pending-count-mismatch" });
  assert.equal(f.posts, 0);
  assert.equal(f.patches, 0);
  const first = await replayPendingMaintenance(config, { fetcher: f.fetcher, expectedPendingCount: 2 });
  assert.equal(first.acknowledged, 2);
  await assert.rejects(() => replayPendingMaintenance(config, {
    fetcher: f.fetcher, expectedPendingCount: 2,
  }), { stage: "pending-count-mismatch" });
  assert.equal(f.posts, 1);
  assert.equal(f.patches, 1);
});

test("replay refuses an unproven product even when the pending count is unchanged", async () => {
  const f = fixture(2);
  await assert.rejects(() => replayPendingMaintenance(config, {
    fetcher: f.fetcher, expectedPendingCount: 2, allowedProductIds: [id(1), id(3)],
  }), { stage: "pending-ids-outside-historical-queue" });
  assert.equal(f.posts, 0);
  assert.equal(f.patches, 0);
  const r = await replayPendingMaintenance(config, {
    fetcher: f.fetcher, expectedPendingCount: 2, allowedProductIds: [id(1), id(2)],
  });
  assert.equal(r.acknowledged, 2);
});
