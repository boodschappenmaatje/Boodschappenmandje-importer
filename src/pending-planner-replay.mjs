// Standalone maintenance-only replay. This module never imports the catalog importer.
const STATE_KEY = "daily-catalog-growth";
const PRODUCTION_ORIGIN = "https://boodschappenmaatje-pwa.vercel.app";
const DATABASE_ORIGIN = "https://pjcqxufvbkkjehituzxz.supabase.co";
export const REPLAY_BATCH_LIMIT = 20;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TRANSIENT = new Set([408, 425, 429, 500, 502, 503, 504]);

function failure(stage, status = null) {
  return Object.assign(new Error(stage), { stage, status });
}

export function replaySettings(env) {
  const raw = env.SUPABASE_URL?.trim();
  const secret = env.SUPABASE_SECRET_KEY?.trim();
  const token = env.PLANNER_CACHE_ADMIN_TOKEN?.trim();
  if (!raw || !secret || !token || secret.startsWith("sb_publishable_")) throw failure("missing-server-configuration");
  let database;
  try {
    database = new URL(raw);
    new Headers({ apikey: secret, authorization: "Bearer " + token });
  } catch {
    throw failure("invalid-server-configuration");
  }
  if (database.origin !== DATABASE_ORIGIN || database.username || database.password ||
      database.search || database.hash || !["/", "/rest/v1"].includes(database.pathname.replace(/\/+$/, "") || "/")) {
    throw failure("invalid-server-configuration");
  }
  return {
    database: database.origin,
    secret,
    token,
    origin: PRODUCTION_ORIGIN,
    bypass: env.VERCEL_AUTOMATION_BYPASS_SECRET?.trim() || null,
  };
}

function dbURL(settings) {
  const url = new URL("/rest/v1/catalog_discovery_state", settings.database);
  url.searchParams.set("state_key", "eq." + STATE_KEY);
  url.searchParams.set("select", "state_key,last_batch,updated_at");
  return url;
}

function dbHeaders(settings, prefer) {
  const headers = { apikey: settings.secret, accept: "application/json", "content-type": "application/json" };
  if (settings.secret.startsWith("eyJ")) headers.authorization = "Bearer " + settings.secret;
  if (prefer) headers.prefer = prefer;
  return headers;
}

async function jsonResponse(fetcher, url, init, stage) {
  let response;
  try {
    response = await fetcher(url, { ...init, redirect: "manual", signal: AbortSignal.timeout(25_000) });
  } catch {
    throw failure(stage);
  }
  if (!response || !response.ok) throw failure(stage, response?.status ?? null);
  try {
    return await response.json();
  } catch {
    throw failure(stage);
  }
}

export async function readPendingSnapshot(settings, fetcher = fetch) {
  const rows = await jsonResponse(fetcher, dbURL(settings), { method: "GET", headers: dbHeaders(settings) }, "pending-read-failed");
  if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.state_key !== STATE_KEY ||
      typeof rows[0].last_batch !== "string" || typeof rows[0].updated_at !== "string") {
    throw failure("pending-state-invalid");
  }
  let metadata;
  try { metadata = JSON.parse(rows[0].last_batch); } catch { throw failure("pending-state-invalid"); }
  const maintenance = metadata?.plannerMaintenance;
  const ids = maintenance?.pendingProductIds;
  if (metadata?.version !== 4 || !Array.isArray(ids) || ids.length > 400 ||
      ids.some(id => typeof id !== "string" || !UUID.test(id)) ||
      new Set(ids).size !== ids.length ||
      !Number.isSafeInteger(maintenance?.notifiedProducts) || maintenance.notifiedProducts < 0 ||
      !["pending_requires_attention", "confirmed"].includes(maintenance?.status) ||
      (ids.length > 0) !== (maintenance.status === "pending_requires_attention")) {
    throw failure("pending-state-invalid");
  }
  return { metadata, ids, updatedAt: rows[0].updated_at };
}

function maintenanceURL(settings) {
  return new URL("/api/internal/planner-readiness/new-products", settings.origin);
}

async function offerBatch(settings, ids, { fetcher, wait }) {
  let retries = 0;
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetcher(maintenanceURL(settings), {
        method: "POST", redirect: "manual", signal: AbortSignal.timeout(65_000),
        headers: {
          authorization: "Bearer " + settings.token, "content-type": "application/json",
          ...(settings.bypass ? { "x-vercel-protection-bypass": settings.bypass } : {}),
        },
        body: JSON.stringify({ productIds: ids }),
      });
    } catch {
      if (attempt === 2) throw Object.assign(failure("maintenance-network-failed"), { retries });
      retries++;
      await wait(1000 * 2 ** attempt);
      continue;
    }
    if (response?.ok) {
      let data;
      try { data = await response.json(); } catch { throw failure("maintenance-response-invalid"); }
      if (data?.productCount !== ids.length || !Array.isArray(data.changedMatchKeys) ||
          !Array.isArray(data.affectedRecipeIds) || !Number.isSafeInteger(data.refreshedReadinessCount) ||
          data.refreshedReadinessCount < 0) throw failure("maintenance-response-invalid");
      return { data, retries };
    }
    const status = response?.status ?? null;
    if (!TRANSIENT.has(status) || attempt === 2) {
      throw Object.assign(failure("maintenance-http-failed", status), { retries });
    }
    retries++;
    await wait(1000 * 2 ** attempt);
  }
  throw failure("maintenance-unexpected");
}

async function acknowledgeBatch(settings, selected, initial, fetcher, now) {
  let current = initial;
  for (let attempt = 0; attempt < 3; attempt++) {
    const remaining = selected.filter(id => current.ids.includes(id));
    if (!remaining.length) return { acknowledged: 0, stillPending: current.ids.length, stateWrites: 0 };
    const nextIds = current.ids.filter(id => !remaining.includes(id));
    const old = current.metadata.plannerMaintenance;
    const maintenance = { ...old, pendingProductIds: nextIds,
      status: nextIds.length ? "pending_requires_attention" : "confirmed",
      notifiedProducts: old.notifiedProducts + remaining.length };
    const metadata = { ...current.metadata, plannerMaintenance: maintenance };
    const updatedAt = new Date(Math.max(now().getTime(), new Date(current.updatedAt).getTime() + 1)).toISOString();
    const url = dbURL(settings);
    url.searchParams.set("updated_at", "eq." + current.updatedAt);
    const rows = await jsonResponse(fetcher, url, {
      method: "PATCH", headers: dbHeaders(settings, "return=representation"),
      body: JSON.stringify({ last_batch: JSON.stringify(metadata), updated_at: updatedAt }),
    }, "acknowledgement-write-failed");
    if (!Array.isArray(rows) || rows.length > 1) throw failure("acknowledgement-response-invalid");
    if (rows.length === 1) {
      if (rows[0]?.state_key !== STATE_KEY || rows[0]?.last_batch !== JSON.stringify(metadata)) {
        throw failure("acknowledgement-response-invalid");
      }
      return { acknowledged: remaining.length, stillPending: nextIds.length, stateWrites: 1 };
    }
    // A concurrent state update won the compare-and-set. Re-read and preserve it.
    current = await readPendingSnapshot(settings, fetcher);
  }
  throw failure("acknowledgement-conflict");
}

export async function replayPendingMaintenance(settings, {
  fetcher = fetch, wait = ms => new Promise(resolve => setTimeout(resolve, ms)), now = () => new Date(),
} = {}) {
  const snapshot = await readPendingSnapshot(settings, fetcher);
  const selected = snapshot.ids.slice(0, REPLAY_BATCH_LIMIT);
  const report = { selected: selected.length, offered: 0, successful: 0, acknowledged: 0,
    pendingBefore: snapshot.ids.length, pendingAfter: snapshot.ids.length, retries: 0,
    changedMatches: 0, refreshedReadiness: 0, catalogStateUpdates: 0,
    productInserts: 0, priceInserts: 0, dailyJobWrites: 0, importStarted: false,
    discoveryStarted: false, error: null, status: "nothing_pending" };
  if (!selected.length) return report;
  report.offered = selected.length;
  try {
    const result = await offerBatch(settings, selected, { fetcher, wait });
    report.retries = result.retries;
    report.successful = selected.length;
    report.changedMatches = result.data.changedMatchKeys.length;
    report.refreshedReadiness = result.data.refreshedReadinessCount;
    const ack = await acknowledgeBatch(settings, selected, snapshot, fetcher, now);
    report.acknowledged = ack.acknowledged;
    report.pendingAfter = ack.stillPending;
    report.catalogStateUpdates = ack.stateWrites;
    report.status = "confirmed";
  } catch (error) {
    if (Number.isSafeInteger(error?.retries)) report.retries = error.retries;
    report.status = report.successful ? "acknowledgement_requires_attention" : "maintenance_requires_attention";
    report.error = { stage: error?.stage ?? "unexpected-maintenance-failure",
      status: Number.isInteger(error?.status) ? error.status : null };
  }
  return report;
}

/** Read-only inventory for separately evidenced earlier IDs. Never called by the replay workflow. */
export async function inspectEarlierProducts(settings, productIds, fetcher = fetch) {
  if (!Array.isArray(productIds) || productIds.length < 1 || productIds.length > 10 ||
      productIds.some(id => typeof id !== "string" || !UUID.test(id)) ||
      new Set(productIds).size !== productIds.length) throw failure("earlier-ids-invalid");
  const snapshot = await readPendingSnapshot(settings, fetcher);
  if (productIds.some(id => snapshot.ids.includes(id))) throw failure("earlier-ids-overlap-pending");
  const url = new URL("/rest/v1/products", settings.database);
  url.searchParams.set("select", "id");
  url.searchParams.set("id", "in.(" + productIds.join(",") + ")");
  url.searchParams.set("supermarket", "eq.Hoogvliet");
  const rows = await jsonResponse(fetcher, url, { method: "GET", headers: dbHeaders(settings) }, "earlier-product-read-failed");
  if (!Array.isArray(rows) || rows.some(row => !productIds.includes(row?.id))) throw failure("earlier-product-response-invalid");
  return { requested: productIds.length, catalogPresent: rows.length,
    pendingOverlap: 0, maintenanceConfirmed: false, needsFurtherReadinessReview: true, databaseWrites: 0 };
}
