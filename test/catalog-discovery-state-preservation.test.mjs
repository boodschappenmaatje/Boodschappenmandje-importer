import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { fetchCatalogDiscoveryState, saveCatalogDiscoveryState } from "../src/supabase.mjs";

const config = { supabaseURL: "https://fixture.supabase.co", supabaseSecret: "sb_secret_fixture" };
const id = n => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const pending = ids => ({ status: ids.length ? "pending_requires_attention" : "confirmed",
  pendingProductIds: ids, notifiedProducts: 0, failures: [] });
const base = { state_key: "daily-catalog-growth", term_cursor: 3, page_cursor: 21,
  updated_at: "2026-09-28T11:00:00.000Z" };
const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { "content-type": "application/json" },
});
let originalFetch;

function database(metadata, { conflict } = {}) {
  originalFetch = globalThis.fetch;
  let row = metadata ? { ...base, last_batch: JSON.stringify(metadata) } : null;
  const requests = [];
  let conflicted = false;
  globalThis.fetch = async (url, init) => {
    const parsed = new URL(url);
    assert.equal(parsed.pathname, "/rest/v1/catalog_discovery_state");
    requests.push({ method: init.method, url: parsed, body: init.body });
    if (init.method === "GET") return json(row ? [row] : []);
    if (init.method === "PATCH") {
      if (conflict && !conflicted) {
        conflicted = true;
        row = conflict(row);
        return json([]);
      }
      if (!row || parsed.searchParams.get("updated_at") !== `eq.${row.updated_at}`) return json([]);
      row = JSON.parse(init.body);
      return json([row]);
    }
    if (init.method === "POST") {
      assert.equal(parsed.searchParams.get("on_conflict"), "state_key");
      assert.match(new Headers(init.headers).get("prefer"), /resolution=ignore-duplicates/);
      if (row) return json([]);
      row = JSON.parse(init.body)[0];
      return json([row]);
    }
    throw new Error("Unexpected request");
  };
  return { requests, get row() { return row; }, get metadata() { return JSON.parse(row.last_batch); } };
}

afterEach(() => { if (originalFetch) globalThis.fetch = originalFetch; originalFetch = null; });

test("a version-4 queue and unknown fields survive a normal discovery update", async () => {
  const f = database({ version: 4, batch: 10, plannerMaintenance: pending([id(1), id(2)]),
    scanDate: "2026-09-28", futureField: { safe: true } });
  const state = await fetchCatalogDiscoveryState(config, base.state_key);
  await saveCatalogDiscoveryState(config, { ...state, pageCursor: 22, lastBatch: 11 });
  assert.equal(f.metadata.version, 4);
  assert.deepEqual(f.metadata.plannerMaintenance, pending([id(1), id(2)]));
  assert.deepEqual(f.metadata.futureField, { safe: true });
  assert.equal(f.metadata.batch, 11);
  assert.equal(f.row.page_cursor, 22);
  assert.deepEqual(f.requests.map(x => x.method), ["GET", "GET", "PATCH"]);
});

test("version-2 state is readable and promotes safely without losing cursor context", async () => {
  const f = database({ version: 2, batch: 4, lastTerm: "fruit", termStats: { fruit: 1 } });
  const state = await fetchCatalogDiscoveryState(config, base.state_key);
  assert.equal(state.lastBatch, 4);
  await saveCatalogDiscoveryState(config, { ...state, pageCursor: 23 });
  assert.equal(f.metadata.version, 4);
  assert.equal(f.metadata.lastTerm, "fruit");
  assert.deepEqual(f.metadata.termStats, { fruit: 1 });
  assert.equal(f.row.page_cursor, 23);
});

test("a legacy discovery writer preserves pending and acknowledged counts", async () => {
  const current = { ...pending([id(2)]), notifiedProducts: 20 };
  const f = database({ version: 4, batch: 1, plannerMaintenance: current });
  await saveCatalogDiscoveryState(config, { stateKey: base.state_key, termCursor: 4,
    pageCursor: 24, lastBatch: 5 });
  assert.deepEqual(f.metadata.plannerMaintenance, current);
  assert.equal(f.metadata.version, 4);
});

test("new pending IDs are combined once without resetting acknowledgements", async () => {
  const f = database({ version: 4, plannerMaintenance: pending([id(1)]) });
  await saveCatalogDiscoveryState(config, { stateKey: base.state_key, termCursor: 4,
    pageCursor: 25, plannerMaintenance: pending([id(1), id(2), id(2)]) });
  assert.deepEqual(f.metadata.plannerMaintenance.pendingProductIds, [id(1), id(2)]);
  assert.equal(f.metadata.plannerMaintenance.notifiedProducts, 0);
});

test("a concurrent acknowledgement is re-read and preserved by the legacy writer", async () => {
  const f = database({ version: 4, plannerMaintenance: pending([id(1), id(2)]) }, {
    conflict: row => ({ ...row, updated_at: "2026-09-28T11:00:01.000Z",
      last_batch: JSON.stringify({ version: 4, plannerMaintenance: {
        ...pending([id(2)]), notifiedProducts: 1 } }) }),
  });
  await saveCatalogDiscoveryState(config, { stateKey: base.state_key, termCursor: 4, pageCursor: 26 });
  assert.equal(f.requests.filter(x => x.method === "PATCH").length, 2);
  assert.deepEqual(f.metadata.plannerMaintenance.pendingProductIds, [id(2)]);
  assert.equal(f.metadata.plannerMaintenance.notifiedProducts, 1);
});

test("a stale explicit queue cannot re-add an acknowledged ID after conflict", async () => {
  const f = database({ version: 4, plannerMaintenance: pending([id(1), id(2)]) }, {
    conflict: row => ({ ...row, updated_at: "2026-09-28T11:00:01.000Z",
      last_batch: JSON.stringify({ version: 4, plannerMaintenance: {
        ...pending([id(2)]), notifiedProducts: 1 } }) }),
  });
  await assert.rejects(saveCatalogDiscoveryState(config, { stateKey: base.state_key,
    plannerMaintenance: pending([id(1), id(2)]) }), /Gelijktijdige planneronderhoudsstatus/);
  assert.deepEqual(f.metadata.plannerMaintenance.pendingProductIds, [id(2)]);
  assert.equal(f.metadata.plannerMaintenance.notifiedProducts, 1);
});

test("an absent row uses insert-only creation; malformed metadata fails closed", async () => {
  const f = database(null);
  await saveCatalogDiscoveryState(config, { stateKey: base.state_key, termCursor: 1, pageCursor: 1 });
  assert.equal(f.metadata.version, 4);
  assert.equal(f.requests.filter(x => x.method === "POST").length, 1);
  const bad = database({ version: 4 });
  // Simulate an existing state from another writer that cannot be safely parsed.
  bad.row.last_batch = "not-json";
  await assert.rejects(saveCatalogDiscoveryState(config, { stateKey: base.state_key }),
    /onbekende metadata/);
  assert.equal(bad.requests.filter(x => x.method !== "GET").length, 0);
});

test("explicit successful IDs acknowledge once through CAS while preserving unrelated pending IDs", async () => {
  const f = database({ version: 4, futureField: { safe: true }, plannerMaintenance: pending([id(1), id(2)]) });
  await saveCatalogDiscoveryState(config, { stateKey: base.state_key, plannerMaintenance: {
    ...pending([]), notifiedProducts: 1 } }, { acknowledgedProductIds: [id(1)] });
  assert.deepEqual(f.metadata.plannerMaintenance.pendingProductIds, [id(2)]);
  assert.equal(f.metadata.plannerMaintenance.notifiedProducts, 1);
  assert.deepEqual(f.metadata.futureField, { safe: true });
  await assert.rejects(saveCatalogDiscoveryState(config, { stateKey: base.state_key, plannerMaintenance: {
    ...pending([]), notifiedProducts: 2 } }, { acknowledgedProductIds: [id(1)] }), /Gelijktijdige/);
  assert.equal(f.metadata.plannerMaintenance.notifiedProducts, 1);
});

test("generic writes cannot acknowledge; explicit acknowledgement rejects unknown, duplicate or still-pending IDs", async () => {
  for (const ids of [undefined, [id(3)], [id(1), id(1)]]) {
    const f = database({ version: 4, plannerMaintenance: pending([id(1), id(2)]) });
    await assert.rejects(saveCatalogDiscoveryState(config, { stateKey: base.state_key, plannerMaintenance: {
      ...pending([id(2)]), notifiedProducts: 1 } }, ids ? { acknowledgedProductIds: ids } : {}), /Gelijktijdige/);
    assert.equal(f.requests.filter(x => x.method === "PATCH").length, 0);
    globalThis.fetch = originalFetch; originalFetch = null;
  }
});
