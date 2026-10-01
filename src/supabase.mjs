import { setDefaultResultOrder } from "node:dns";
import { randomUUID } from "node:crypto";
import { UNKNOWN_PRODUCT_TYPE } from "./product-type.mjs";
import { notifyPlannerOfNewProducts, plannerMaintenanceSettings } from "./planner-cache-maintenance.mjs";
import { challengeRecoveryDecision } from './source-challenge-policy.mjs';

const REQUEST_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

setDefaultResultOrder("ipv4first");

export class SupabaseRequestError extends Error {
  constructor(message, {
    retryable = false,
    status = null,
    code = null,
    phase = null,
    host = null,
    kind = null,
  } = {}) {
    super(message);
    this.name = "SupabaseRequestError";
    this.retryable = retryable;
    this.status = status;
    this.code = code;
    this.phase = phase;
    this.host = host;
    this.kind = kind;
  }
}

export function restURL(value, table) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("SUPABASE_URL ontbreekt.");
  }
  if (!/^[a-z_]+$/.test(table)) throw new Error("Ongeldige Supabase-tabelnaam.");

  const url = new URL(value.trim());
  if (url.protocol !== "https:") throw new Error("SUPABASE_URL moet HTTPS gebruiken.");
  url.username = "";
  url.password = "";
  url.search = "";
  url.hash = "";

  const currentPath = url.pathname.replace(/\/+$/, "");
  if (currentPath && currentPath !== "/rest/v1") {
    throw new Error("SUPABASE_URL moet de project-basis-URL zijn, eventueel met /rest/v1.");
  }
  url.pathname = `/rest/v1/${table}`;
  return url;
}

export function rpcURL(value, functionName) {
  if (typeof functionName !== "string" || !/^[a-z_]+$/.test(functionName)) {
    throw new Error("Ongeldige Supabase-RPC-naam.");
  }
  const url = restURL(value, functionName);
  url.pathname = `/rest/v1/rpc/${functionName}`;
  return url;
}

export function requestHeaders(secret, prefer) {
  if (typeof secret !== "string" || !secret.trim()) {
    throw new Error("SUPABASE_SECRET_KEY ontbreekt.");
  }
  const key = secret.trim();
  const result = {
    apikey: key,
    Accept: "application/json",
    "Content-Type": "application/json",
    "Accept-Profile": "public",
    "Content-Profile": "public",
    Prefer: prefer,
  };

  // Moderne sb_secret_-keys zijn API-keys en geen JWT's. Alleen een oudere
  // service-role JWT hoort tevens als Bearer-token in Authorization.
  if (key.startsWith("eyJ")) result.Authorization = `Bearer ${key}`;
  return result;
}

function redact(value, secret) {
  const text = String(value ?? "");
  return secret ? text.split(secret).join("[REDACTED]") : text;
}

function responseError(body, secret) {
  const safeBody = redact(body, secret);
  try {
    const object = JSON.parse(safeBody);
    return {
      code: typeof object.code === "string" ? object.code : null,
      body: JSON.stringify(object).slice(0, 800),
    };
  } catch {
    return { code: null, body: safeBody.slice(0, 800) };
  }
}

function errorCode(error) {
  return error?.code ?? error?.errno ?? null;
}

function networkKind(error, code, message) {
  const value = `${error?.name ?? ""} ${code ?? ""} ${message ?? ""}`.toUpperCase();
  if (/ABORT|TIMEOUT|TIMEDOUT/.test(value)) return "timeout";
  if (/ENOTFOUND|EAI_AGAIN|DNS/.test(value)) return "dns";
  if (/CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY/.test(value)) return "tls";
  if (/ECONNRESET|UND_ERR_SOCKET/.test(value)) return "connection-reset";
  if (/ECONNREFUSED/.test(value)) return "connection-refused";
  return "network";
}

function nestedCauseDetails(error, secret) {
  const cause = error?.cause;
  const nested = Array.isArray(cause?.errors) ? cause.errors.slice(0, 3) : [];
  return nested.map((item) => {
    const code = errorCode(item);
    const message = redact(item?.message ?? "onbekende fout", secret).slice(0, 180);
    return `${item?.name ?? "Error"}${code ? `/${code}` : ""}: ${message}`;
  });
}

function networkError(error, table, host, secret) {
  const cause = error?.cause;
  const code = errorCode(cause) ?? errorCode(error) ?? "NETWORK_ERROR";
  const reason = redact(cause?.message ?? error?.message ?? "onbekende netwerkfout", secret).slice(0, 300);
  const kind = networkKind(error, code, reason);
  const nested = nestedCauseDetails(error, secret);
  const details = [
    `fase=${table}`,
    `host=${host}`,
    `soort=${kind}`,
    `error.name=${error?.name ?? "Error"}`,
    `error.code=${errorCode(error) ?? "-"}`,
    `cause.code=${errorCode(cause) ?? "-"}`,
    `cause.message=${reason}`,
    nested.length ? `nested=${nested.join(" ; ")}` : null,
  ].filter(Boolean).join(" | ");
  return new SupabaseRequestError(
    `Supabase write mislukt | ${details}`,
    { retryable: true, code: String(code), phase: table, host, kind },
  );
}

async function waitBeforeRetry(attempt) {
  await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
}

async function postJSONToURL(url, phase, secret, payload, prefer, query = {}, method = "POST") {
  const host = url.host;
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  const body = JSON.stringify(payload);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    let responseBody;
    try {
      response = await fetch(url, {
        method,
        headers: requestHeaders(secret, prefer),
        body,
        redirect: "manual",
        signal: controller.signal,
      });
      responseBody = await response.text();
    } catch (error) {
      const safeError = networkError(error, phase, host, secret);
      if (attempt < MAX_ATTEMPTS) {
        await waitBeforeRetry(attempt);
        continue;
      }
      throw new SupabaseRequestError(
        `${safeError.message} Pogingen: ${MAX_ATTEMPTS}.`,
        {
          retryable: true,
          code: safeError.code,
          phase,
          host,
          kind: safeError.kind,
        },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const detail = responseError(responseBody, secret);
      const safeError = new SupabaseRequestError(
        `Supabase write mislukt | fase=${phase} | host=${host} | soort=http | HTTP ${response.status}`
          + `${detail.code ? ` | code=${detail.code}` : ""}`
          + `${detail.body ? ` | response=${detail.body}` : ""}`,
        {
          retryable: RETRYABLE_STATUS.has(response.status),
          status: response.status,
          code: detail.code,
          phase,
          host,
          kind: "http",
        },
      );
      if (safeError.retryable && attempt < MAX_ATTEMPTS) {
        await waitBeforeRetry(attempt);
        continue;
      }
      throw safeError;
    }

    if (!responseBody) return [];
    try {
      return JSON.parse(responseBody);
    } catch {
      throw new SupabaseRequestError(
        `Supabase write mislukt | fase=${phase} | host=${host} | soort=response | succesvolle reactie bevatte ongeldige JSON.`,
        { phase, host, kind: "response" },
      );
    }
  }
  throw new SupabaseRequestError(`Supabase ${phase}: onverwacht einde van request.`);
}

async function postJSON(baseValue, table, secret, payload, prefer, query) {
  return postJSONToURL(restURL(baseValue, table), table, secret, payload, prefer, query);
}

async function patchJSON(baseValue, table, secret, payload, prefer, query) {
  return postJSONToURL(restURL(baseValue, table), table, secret, payload, prefer, query, "PATCH");
}

async function postRPC(baseValue, functionName, secret, payload) {
  return postJSONToURL(
    rpcURL(baseValue, functionName),
    `rpc:${functionName}`,
    secret,
    payload,
    "return=representation",
  );
}

async function getJSON(baseValue, table, secret, query, rangeStart, rangeEnd) {
  const url = restURL(baseValue, table);
  const host = url.host;
  for (const [name, value] of Object.entries(query)) url.searchParams.set(name, value);
  const headers = requestHeaders(secret);
  delete headers["Content-Type"];
  delete headers["Content-Profile"];
  delete headers.Prefer;
  headers.Range = `${rangeStart}-${rangeEnd}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    let responseBody;
    try {
      response = await fetch(url, {
        method: "GET",
        headers,
        redirect: "manual",
        signal: controller.signal,
      });
      responseBody = await response.text();
    } catch (error) {
      const safeError = networkError(error, table, host, secret);
      if (attempt < MAX_ATTEMPTS) {
        await waitBeforeRetry(attempt);
        continue;
      }
      throw new SupabaseRequestError(
        `${safeError.message} Pogingen: ${MAX_ATTEMPTS}.`,
        {
          retryable: true,
          code: safeError.code,
          phase: table,
          host,
          kind: safeError.kind,
        },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const detail = responseError(responseBody, secret);
      const safeError = new SupabaseRequestError(
        `Supabase read mislukt | fase=${table} | host=${host} | soort=http | HTTP ${response.status}`
          + `${detail.code ? ` | code=${detail.code}` : ""}`
          + `${detail.body ? ` | response=${detail.body}` : ""}`,
        {
          retryable: RETRYABLE_STATUS.has(response.status),
          status: response.status,
          code: detail.code,
          phase: table,
          host,
          kind: "http",
        },
      );
      if (safeError.retryable && attempt < MAX_ATTEMPTS) {
        await waitBeforeRetry(attempt);
        continue;
      }
      throw safeError;
    }

    try {
      return responseBody ? JSON.parse(responseBody) : [];
    } catch {
      throw new SupabaseRequestError(
        `Supabase read mislukt | fase=${table} | host=${host} | soort=response | succesvolle reactie bevatte ongeldige JSON.`,
        { phase: table, host, kind: "response" },
      );
    }
  }
  throw new SupabaseRequestError(`Supabase ${table}: onverwacht einde van read-request.`);
}

export async function fetchExistingSKUs(config) {
  const pageSize = 1000;
  const existingSKUs = new Set();
  for (let offset = 0; offset < 20_000; offset += pageSize) {
    const rows = await getJSON(
      config.supabaseURL,
      "products",
      config.supabaseSecret,
      { select: "sku", supermarket: "eq.Hoogvliet", order: "sku.asc" },
      offset,
      offset + pageSize - 1,
    );
    if (!Array.isArray(rows)) throw new Error("Supabase gaf geen geldige SKU-lijst terug.");
    for (const row of rows) {
      if (typeof row?.sku === "string" && row.sku) existingSKUs.add(row.sku);
    }
    if (rows.length < pageSize) return existingSKUs;
  }
  throw new Error("Veiligheidsgrens bereikt bij het ophalen van bestaande Supabase-SKU's.");
}

/// Leest alleen de bestaande Hoogvliet-productidentiteit en bronmetadata die
/// nodig zijn om dezelfde productpagina opnieuw betrouwbaar te valideren.
/// Prijzen worden bewust niet uit deze read overgenomen: de actuele prijs moet
/// opnieuw van de bijbehorende Hoogvliet-productpagina komen.
export async function fetchExistingProducts(config) {
  const pageSize = 1000;
  const products = [];
  for (let offset = 0; offset < 20_000; offset += pageSize) {
    const rows = await getJSON(
      config.supabaseURL,
      "products",
      config.supabaseSecret,
      {
        select: "id,sku,name,brand,category,package_text,weight_grams,image_url,source_url,is_available"
          + (config.productTypeSupported ? ",product_type" : ""),
        supermarket: "eq.Hoogvliet",
        order: "sku.asc",
      },
      offset,
      offset + pageSize - 1,
    );
    if (!Array.isArray(rows)) throw new Error("Supabase gaf geen geldige productlijst terug.");
    for (const row of rows) {
      products.push({
        id: row?.id,
        sku: row?.sku,
        name: row?.name,
        brand: row?.brand ?? null,
        category: row?.category ?? null,
        packageText: row?.package_text ?? null,
        weightGrams: row?.weight_grams ?? null,
        imageURL: row?.image_url ?? null,
        sourceURL: row?.source_url,
        available: row?.is_available ?? null,
        productType: row?.product_type ?? null,
      });
    }
    if (rows.length < pageSize) return products;
  }
  throw new Error("Veiligheidsgrens bereikt bij het ophalen van bestaande Supabase-producten.");
}

export async function fetchExistingPriceStates(config) {
  const pageSize = 1000;
  const prices = new Map();
  for (let offset = 0; offset < 20_000; offset += pageSize) {
    const rows = await getJSON(
      config.supabaseURL,
      "product_prices",
      config.supabaseSecret,
      {
        select: "product_id,price,old_price,is_offer,offer_text,valid_from,valid_until,fetched_at,updated_at",
        order: "product_id.asc",
      },
      offset,
      offset + pageSize - 1,
    );
    if (!Array.isArray(rows)) throw new Error("Supabase gaf geen geldige prijsstatuslijst terug.");
    for (const row of rows) {
      if (typeof row?.product_id !== "string" || !row.product_id) continue;
      const price = Number(row.price);
      const oldPrice = row.old_price == null ? null : Number(row.old_price);
      prices.set(row.product_id, {
        productID: row.product_id,
        price: Number.isFinite(price) && price > 0 ? price : null,
        oldPrice: Number.isFinite(oldPrice) && oldPrice > 0 ? oldPrice : null,
        isOffer: row.is_offer === true,
        offerText: row.offer_text ?? null,
        validFrom: row.valid_from ?? null,
        validUntil: row.valid_until ?? null,
        fetchedAt: row.fetched_at ?? null,
        updatedAt: row.updated_at ?? null,
      });
    }
    if (rows.length < pageSize) return prices;
  }
  throw new Error("Veiligheidsgrens bereikt bij het ophalen van bestaande Supabase-prijzen.");
}

// Read-only, bounded evidence for the explicitly requested staged acceptance.
// Read raw rows so duplicate/orphan prices cannot disappear in a Map.
export async function fetchCatalogAcceptanceSnapshot(config) {
  async function allRows(table, select, order) {
    const result = [];
    for (let offset = 0; offset < 20_000; offset += 1000) {
      const rows = await getJSON(config.supabaseURL, table, config.supabaseSecret,
        { select, order }, offset, offset + 999);
      if (!Array.isArray(rows)) throw new Error("Ongeldige acceptance-snapshot.");
      result.push(...rows);
      if (rows.length < 1000) return result;
    }
    throw new Error("Acceptance-snapshot overschrijdt leesbudget.");
  }
  const products = await allRows("products", "id,supermarket,sku,name,source_url,created_at", "id.asc");
  const prices = await allRows("product_prices", "product_id,price,fetched_at", "product_id.asc");
  const state = await fetchCatalogDiscoveryState(config, config.discoveryStateKey);
  return { products, prices, maintenance: state.plannerMaintenance };
}

export async function hasProductTypeColumn(config) {
  try {
    await getJSON(
      config.supabaseURL,
      "products",
      config.supabaseSecret,
      { select: "product_type", limit: "1" },
      0,
      0,
    );
    return true;
  } catch (error) {
    if (error instanceof SupabaseRequestError
      && error.status === 400
      && /product_type|PGRST204/i.test(error.message)) return false;
    throw error;
  }
}

const STALE_IMPORT_RUN_MS = 3 * 60 * 60 * 1000;

function boundedCount(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0;
}

function compactErrorSummary(value) {
  if (typeof value !== "string") return null;
  const compact = value.replace(/\s+/g, " ").trim();
  return compact ? compact.slice(0, 1200) : null;
}

async function upsertImportRun(config, run) {
  const rows = await postJSON(
    config.supabaseURL,
    "catalog_import_runs",
    config.supabaseSecret,
    [run],
    "resolution=merge-duplicates,return=representation",
    { on_conflict: "id", select: "*" },
  );
  if (!Array.isArray(rows) || rows[0]?.id !== run.id) {
    throw new Error("Supabase bevestigde de catalogusrun niet.");
  }
  return rows[0];
}

export async function startCatalogImportRun(config, {
  trigger,
  totalUniqueProductsBefore,
  now = new Date(),
} = {}) {
  const running = await getJSON(
    config.supabaseURL,
    "catalog_import_runs",
    config.supabaseSecret,
    { select: "*", status: "eq.running", order: "started_at.asc" },
    0,
    9,
  );
  for (const row of running) {
    const started = Date.parse(row?.started_at ?? "");
    if (Number.isFinite(started) && now.getTime() - started <= STALE_IMPORT_RUN_MS) {
      throw new Error("Er draait al een catalogusgroeirun; een tweede run is veilig geweigerd.");
    }
    if (row?.id) {
      await upsertImportRun(config, {
        ...row,
        status: "failed",
        finished_at: now.toISOString(),
        duration_seconds: Number.isFinite(started)
          ? Number(((now.getTime() - started) / 1000).toFixed(3))
          : 0,
        error_summary: "Stale running-status gecontroleerd afgesloten vóór een nieuwe run.",
      });
    }
  }

  return upsertImportRun(config, {
    id: crypto.randomUUID(),
    started_at: now.toISOString(),
    finished_at: null,
    status: "running",
    trigger,
    processed_count: 0,
    new_count: 0,
    updated_count: 0,
    unchanged_count: 0,
    skipped_count: 0,
    error_count: 0,
    total_unique_products_before: boundedCount(totalUniqueProductsBefore),
    total_unique_products_after: null,
    duration_seconds: null,
    error_summary: null,
  });
}

export async function finishCatalogImportRun(config, run, result, now = new Date()) {
  const started = Date.parse(run.started_at ?? "");
  return upsertImportRun(config, {
    ...run,
    finished_at: now.toISOString(),
    status: result.status,
    processed_count: boundedCount(result.processedCount),
    new_count: boundedCount(result.newCount),
    updated_count: boundedCount(result.updatedCount),
    unchanged_count: boundedCount(result.unchangedCount),
    skipped_count: boundedCount(result.skippedCount),
    error_count: boundedCount(result.errorCount),
    total_unique_products_after: boundedCount(result.totalUniqueProductsAfter),
    duration_seconds: Number.isFinite(started)
      ? Number(((now.getTime() - started) / 1000).toFixed(3))
      : 0,
    error_summary: compactErrorSummary(result.errorSummary),
  });
}

export async function fetchCatalogImportRuns(config, {
  trigger = "schedule",
  limit = 5,
} = {}) {
  const safeLimit = Math.min(20, Math.max(1, Math.trunc(Number(limit) || 5)));
  const query = {
    select: "id,started_at,finished_at,status,trigger,processed_count,new_count,updated_count,unchanged_count,skipped_count,error_count,total_unique_products_before,total_unique_products_after,duration_seconds,error_summary",
    order: "started_at.desc",
  };
  if (trigger) query.trigger = `eq.${trigger}`;
  return getJSON(
    config.supabaseURL,
    "catalog_import_runs",
    config.supabaseSecret,
    query,
    0,
    safeLimit - 1,
  );
}

function dailyJobFromRow(row) {
  if (!row || typeof row !== "object" || !row.id) return null;
  return {
    id: row.id,
    stateKey: row.state_key,
    jobDate: row.job_date,
    timezone: row.timezone,
    targetNewProducts: boundedCount(row.target_new_products),
    newProductsCollected: boundedCount(row.new_products_collected),
    remainingTarget: Math.max(
      0,
      boundedCount(row.target_new_products) - boundedCount(row.new_products_collected),
    ),
    status: row.status,
    attemptCount: boundedCount(row.attempt_count),
    startedAt: row.started_at ?? null,
    lastAttemptAt: row.last_attempt_at ?? null,
    nextRetryAt: row.next_retry_at ?? null,
    completedAt: row.completed_at ?? null,
    lockExpiresAt: row.lock_expires_at ?? null,
    lastPublicMessage: row.last_public_message ?? null,
    updatedAt: row.updated_at ?? null,
  };
}

function rpcObject(value) {
  if (Array.isArray(value)) return value[0] ?? null;
  return value && typeof value === "object" ? value : null;
}

export async function fetchCatalogDailyJob(config, {
  stateKey,
  jobDate,
} = {}) {
  const rows = await getJSON(
    config.supabaseURL,
    "catalog_daily_jobs",
    config.supabaseSecret,
    {
      select: "id,state_key,job_date,timezone,target_new_products,new_products_collected,status,attempt_count,started_at,last_attempt_at,next_retry_at,completed_at,lock_expires_at,last_public_message,updated_at",
      state_key: `eq.${stateKey}`,
      job_date: `eq.${jobDate}`,
    },
    0,
    0,
  );
  return dailyJobFromRow(rows[0]);
}

export async function fetchCatalogDailyAttempts(config, jobID) {
  const rows = await getJSON(config.supabaseURL, 'catalog_daily_attempts', config.supabaseSecret, {
    select: 'attempt_number,status,error_code,completed_at,cumulative_new_after,remaining_target_after',
    daily_job_id: `eq.${jobID}`, order: 'attempt_number.asc',
  }, 0, 99);
  if (rows.length >= 100) throw new Error('Dagpogingen overschrijden veilige inspectiegrens.');
  return rows;
}

// Repair only a legacy one-shot challenge closure, never reset day accounting.
// The terminal row cannot be claimed by the normal RPC. Compare every relevant
// revision field before reopening it; the subsequent normal RPC still arbitrates
// ownership. A zero-row CAS is a hard conflict, not permission to force a claim.
export async function requeueSourceChallenge(config, job, attempts, now) {
  const decision = challengeRecoveryDecision(job, attempts, now);
  if (!decision.allowed) throw new Error(decision.reason);
  const rows = await patchJSON(config.supabaseURL, 'catalog_daily_jobs', config.supabaseSecret,
    { status: 'retry_scheduled', next_retry_at: decision.retryAt.toISOString(), completed_at: null,
      updated_at: now.toISOString(), last_public_message: 'Bronpauze verstreken; hervatting via normale dagclaim.' },
    'return=representation', {
      id: `eq.${job.id}`, state_key: `eq.${job.stateKey}`, job_date: `eq.${job.jobDate}`,
      status: 'eq.daily_target_partial', attempt_count: `eq.${job.attemptCount}`,
      new_products_collected: `eq.${job.newProductsCollected}`, target_new_products: 'eq.400',
      lock_token: 'is.null', lock_expires_at: 'is.null', next_retry_at: 'is.null',
      updated_at: `eq.${job.updatedAt}`,
    });
  if (rows.length !== 1) throw new Error('source_challenge_recovery_claim_conflict');
  return dailyJobFromRow(rows[0]);
}

export async function ensureCatalogDailyJob(config, {
  stateKey,
  jobDate,
  targetNewProducts,
  now = new Date(),
} = {}) {
  const result = rpcObject(await postRPC(
    config.supabaseURL,
    "ensure_catalog_daily_job",
    config.supabaseSecret,
    {
      p_state_key: stateKey,
      p_job_date: jobDate,
      p_target_new_products: targetNewProducts,
      p_now: now.toISOString(),
    },
  ));
  const job = dailyJobFromRow(result);
  if (!job) throw new Error("Supabase bevestigde de dagelijkse catalogusjob niet.");
  return job;
}

export async function claimCatalogDailyAttempt(config, {
  stateKey,
  jobDate,
  targetNewProducts,
  now = new Date(),
  lockTTLMinutes = 130,
} = {}) {
  const result = rpcObject(await postRPC(
    config.supabaseURL,
    "claim_catalog_daily_attempt",
    config.supabaseSecret,
    {
      p_state_key: stateKey,
      p_job_date: jobDate,
      p_target_new_products: targetNewProducts,
      p_now: now.toISOString(),
      p_lock_ttl_minutes: lockTTLMinutes,
    },
  ));
  const job = dailyJobFromRow(result?.job);
  if (!job || typeof result?.claimed !== "boolean") {
    throw new Error("Supabase gaf geen geldige daily-attemptclaim terug.");
  }
  return {
    claimed: result.claimed,
    reason: typeof result.reason === "string" ? result.reason : "unknown",
    attemptId: typeof result.attemptId === "string" ? result.attemptId : null,
    lockToken: typeof result.lockToken === "string" ? result.lockToken : null,
    job,
  };
}

export async function finishCatalogDailyAttempt(config, {
  jobID,
  attemptID,
  lockToken,
  outcome,
  counts,
  retryReason = null,
  nextRetryAt = null,
  errorCode: code = null,
  errorSummary = null,
  publicMessage = null,
  now = new Date(),
} = {}) {
  const result = rpcObject(await postRPC(
    config.supabaseURL,
    "finish_catalog_daily_attempt",
    config.supabaseSecret,
    {
      p_job_id: jobID,
      p_attempt_id: attemptID,
      p_lock_token: lockToken,
      p_outcome: outcome,
      p_counts: counts,
      p_retry_reason: retryReason,
      p_next_retry_at: nextRetryAt?.toISOString?.() ?? nextRetryAt,
      p_error_code: code,
      p_error_summary: compactErrorSummary(errorSummary),
      p_public_message: compactErrorSummary(publicMessage),
      p_now: now.toISOString(),
    },
  ));
  const job = dailyJobFromRow(result);
  if (!job) throw new Error("Supabase bevestigde de afgesloten daily attempt niet.");
  return job;
}

function parseDiscoveryMetadata(raw) {
  if (typeof raw !== "string" || !raw.startsWith("{")) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      && Number.isSafeInteger(parsed.version) && parsed.version >= 2 ? parsed : {};
  } catch { return {}; }
}

function mergePlannerMaintenance(current, incoming, acknowledgedProductIds = []) {
  if (acknowledgedProductIds.length && (!current || !incoming)) {
    throw new Error("Onderhoudsbevestiging vereist een bestaande pendingstatus.");
  }
  if (incoming == null) return current ?? null;
  if (!current) return incoming;
  const currentIds = current.pendingProductIds;
  const incomingIds = incoming.pendingProductIds;
  if (!Array.isArray(currentIds) || !Array.isArray(incomingIds) ||
      !Number.isSafeInteger(current.notifiedProducts) ||
      !Array.isArray(acknowledgedProductIds) || new Set(acknowledgedProductIds).size !== acknowledgedProductIds.length ||
      acknowledgedProductIds.some(id => !currentIds.includes(id) || incomingIds.includes(id)) ||
      incoming.notifiedProducts !== current.notifiedProducts + acknowledgedProductIds.length) {
    throw new Error("Gelijktijdige planneronderhoudsstatus vereist afzonderlijke beoordeling.");
  }
  const pendingProductIds = [...new Set([...currentIds.filter(id => !acknowledgedProductIds.includes(id)), ...incomingIds])];
  if (pendingProductIds.length > 400) throw new Error("Planneronderhoudswachtrij overschrijdt de veiligheidsgrens.");
  return { ...current, ...incoming, notifiedProducts: incoming.notifiedProducts,
    pendingProductIds, status: pendingProductIds.length ? "pending_requires_attention" : "confirmed" };
}

export async function fetchCatalogDiscoveryState(config, stateKey) {
  const rows = await getJSON(
    config.supabaseURL,
    "catalog_discovery_state",
    config.supabaseSecret,
    { select: "state_key,term_cursor,page_cursor,last_batch,updated_at", state_key: `eq.${stateKey}` },
    0,
    0,
  );
  const row = rows[0];
  const metadata = parseDiscoveryMetadata(row?.last_batch);
  return row ? {
    stateKey: row.state_key,
    termCursor: boundedCount(row.term_cursor),
    pageCursor: boundedCount(row.page_cursor),
    lastBatch: metadata.batch ?? row.last_batch ?? null,
    lastTerm: metadata.lastTerm ?? null,
    lastStopReason: metadata.lastStopReason ?? null,
    termStats: metadata.termStats ?? {},
    scanDate: metadata.scanDate ?? null,
    exhaustedTerms: metadata.exhaustedTerms ?? [],
    stalledTerms: metadata.stalledTerms ?? [],
    lastAttemptReport: metadata.lastAttemptReport ?? null,
    plannerMaintenance: metadata.plannerMaintenance ?? null,
    saturatedUntil: metadata.saturatedUntil ?? {},
    updatedAt: row.updated_at ?? null,
  } : {
    stateKey,
    termCursor: 0,
    pageCursor: 0,
    lastBatch: null,
    lastTerm: null,
    lastStopReason: null,
    termStats: {},
    scanDate: null,
    exhaustedTerms: [],
    stalledTerms: [],
    lastAttemptReport: null,
    plannerMaintenance: null,
    saturatedUntil: {},
    updatedAt: null,
  };
}

export async function saveCatalogDiscoveryState(config, state, { acknowledgedProductIds = [] } = {}) {
  const select = "state_key,term_cursor,page_cursor,last_batch,updated_at";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentRows = await getJSON(config.supabaseURL, "catalog_discovery_state", config.supabaseSecret,
      { select, state_key: `eq.${state.stateKey}` }, 0, 0);
    if (!Array.isArray(currentRows) || currentRows.length > 1) throw new Error("Ongeldige discovery-state-response.");
    const current = currentRows[0];
    const metadata = parseDiscoveryMetadata(current?.last_batch);
    if (current && current.last_batch && !Object.keys(metadata).length) {
      throw new Error("Discovery-state bevat onbekende metadata; overschrijven geweigerd.");
    }
    const plannerMaintenance = mergePlannerMaintenance(metadata.plannerMaintenance, state.plannerMaintenance, acknowledgedProductIds);
    const lastBatch = JSON.stringify({ ...metadata,
      version: Math.max(4, metadata.version ?? 2),
      batch: state.lastBatch ?? metadata.batch ?? null,
      lastTerm: state.lastTerm ?? metadata.lastTerm ?? null,
      lastStopReason: state.lastStopReason ?? metadata.lastStopReason ?? null,
      termStats: state.termStats ?? metadata.termStats ?? {},
      saturatedUntil: state.saturatedUntil ?? metadata.saturatedUntil ?? {},
      scanDate: state.scanDate ?? metadata.scanDate ?? null,
      exhaustedTerms: state.exhaustedTerms ?? metadata.exhaustedTerms ?? [],
      stalledTerms: state.stalledTerms ?? metadata.stalledTerms ?? [],
      lastAttemptReport: state.lastAttemptReport ?? metadata.lastAttemptReport ?? null,
      plannerMaintenance,
    });
    const updatedAt = new Date(Math.max(Date.now(), Date.parse(current?.updated_at ?? "") + 1 || 0)).toISOString();
    const payload = { state_key: state.stateKey, term_cursor: boundedCount(state.termCursor),
      page_cursor: boundedCount(state.pageCursor), last_batch: lastBatch, updated_at: updatedAt };
    const rows = current ? await patchJSON(config.supabaseURL, "catalog_discovery_state", config.supabaseSecret,
      payload, "return=representation",
      { state_key: `eq.${state.stateKey}`, updated_at: `eq.${current.updated_at}`, select })
      : await postJSON(config.supabaseURL, "catalog_discovery_state", config.supabaseSecret,
        [payload], "resolution=ignore-duplicates,return=representation", { on_conflict: "state_key", select });
    if (!Array.isArray(rows) || rows.length > 1) throw new Error("Ongeldige discovery-statebevestiging.");
    if (rows[0]) {
      if (rows[0].state_key !== state.stateKey || rows[0].last_batch !== lastBatch) {
        throw new Error("Supabase bevestigde de discovery-state niet.");
      }
      return rows[0];
    }
    // A concurrent writer won. Re-read its latest metadata, then preserve it.
  }
  throw new Error("Discovery-state is gelijktijdig gewijzigd; geen verouderde overschrijving uitgevoerd.");
}

function productPayload(product, includeProductType = true) {
  const payload = {
    supermarket: product.supermarket ?? "Hoogvliet",
    sku: product.sku,
    name: product.name,
    package_text: product.packageText,
    source_url: product.sourceURL,
    updated_at: product.fetchedAt,
    last_seen_at: product.fetchedAt,
    missing_checks: 0,
  };
  if (product.brand != null) payload.brand = product.brand;
  if (product.category != null) payload.category = product.category;
  if (product.weightGrams != null) payload.weight_grams = product.weightGrams;
  if (product.imageURL != null) payload.image_url = product.imageURL;
  if (product.isAvailable != null) payload.is_available = product.isAvailable;
  if (includeProductType && product.productType != null) payload.product_type = product.productType;
  return payload;
}

function productClassificationPayload(product) {
  return productPayload({
    ...product,
    productType: product.productType ?? UNKNOWN_PRODUCT_TYPE,
  }, true);
}

function groupPayloadsByKeys(payloads) {
  const groups = new Map();
  for (const payload of payloads) {
    const signature = Object.keys(payload).sort().join(",");
    const group = groups.get(signature) ?? [];
    group.push(payload);
    groups.set(signature, group);
  }
  return [...groups.values()];
}

export async function upsertProductClassifications(config, products) {
  if (!config.productTypeSupported) {
    throw new Error("Supabase-kolom products.product_type ontbreekt; voer eerst de meegeleverde migratie uit.");
  }
  const seenSKUs = new Set();
  const uniqueProducts = products.filter((product) => {
    if (!product?.sku || seenSKUs.has(product.sku)) return false;
    seenSKUs.add(product.sku);
    return true;
  });
  let written = 0;
  const batchSize = 100;
  const payloadGroups = groupPayloadsByKeys(
    uniqueProducts.map(productClassificationPayload),
  );
  for (const payloadGroup of payloadGroups) {
    for (let offset = 0; offset < payloadGroup.length; offset += batchSize) {
      const batch = payloadGroup.slice(offset, offset + batchSize);
      const rows = await postJSON(
        config.supabaseURL,
        "products",
        config.supabaseSecret,
        batch,
        "resolution=merge-duplicates,return=representation",
        { on_conflict: "supermarket,sku", select: "id,sku,product_type" },
      );
      if (!Array.isArray(rows) || rows.length !== batch.length) {
        throw new Error("Supabase bevestigde niet alle producttype-updates.");
      }
      written += rows.length;
    }
  }
  return { written, duplicateSKUsSkipped: products.length - uniqueProducts.length };
}

function pricePayload(productID, product) {
  return {
    product_id: productID,
    price: product.price,
    old_price: product.oldPrice,
    is_offer: product.isOffer,
    offer_text: product.offerText,
    valid_from: product.validFrom,
    valid_until: product.validUntil,
    fetched_at: product.fetchedAt,
    updated_at: product.fetchedAt,
  };
}

export async function upsertProducts(config, products, lifecycle = {}) {
  // Explicit configuration keeps the existing importer unchanged until activation.
  // Validate it before any writes; the API token never reaches Supabase/browser code.
  const maintenance = config.updateMode === "prices" || config.updateMode === "classify"
    ? null : plannerMaintenanceSettings(config);
  const newProductIds = [];
  let maintenanceResult;
  const imported = [];
  const errors = [];
  const seenSKUs = new Set();
  const uniqueProducts = products.filter((product) => {
    if (seenSKUs.has(product.sku)) return false;
    seenSKUs.add(product.sku);
    return true;
  });

  try {
    for (const product of uniqueProducts) {
      if (!(Number.isFinite(product?.price) && product.price > 0)) {
        errors.push({ sku: product?.sku ?? "-", message: "Ongeldige prijs; bestaande Supabase-prijs blijft ongewijzigd." });
        continue;
      }
      try {
        const insertionId = maintenance || config.updateMode === "growth" ? randomUUID() : null;
        const inserted = insertionId ? await postJSON(
          config.supabaseURL,
          "products",
          config.supabaseSecret,
          [{ ...productPayload(product, config.productTypeSupported !== false), id: insertionId }],
          "resolution=ignore-duplicates,return=representation",
          { on_conflict: "supermarket,sku", select: "id,sku,name" },
        ) : [];
        // DO NOTHING + returned UUID proves a real insert, including a lost-response
        // retry. A concurrent/existing product retains its own ID and is never new.
        const rows = inserted.length > 0 ? inserted : await postJSON(
          config.supabaseURL,
          "products",
          config.supabaseSecret,
          [productPayload(product, config.productTypeSupported !== false)],
          "resolution=merge-duplicates,return=representation",
          { on_conflict: "supermarket,sku", select: "id,sku,name" },
        );
        const stored = rows[0];
        if (!stored?.id || stored.sku !== product.sku) {
          throw new Error(`Supabase gaf geen veilig gekoppeld product_id terug voor SKU ${product.sku}.`);
        }

        const priceRows = await postJSON(
          config.supabaseURL,
          "product_prices",
          config.supabaseSecret,
          [pricePayload(stored.id, product)],
          "resolution=merge-duplicates,return=representation",
          { on_conflict: "product_id", select: "product_id,price,is_offer,updated_at" },
        );
        const storedPrice = priceRows[0];
        if (storedPrice?.product_id !== stored.id || Number(storedPrice.price) !== product.price) {
          throw new Error(`Prijscontrole mislukte voor SKU ${product.sku}.`);
        }
        imported.push({ sku: product.sku, name: product.name, price: product.price,
          ...(insertionId ? { inserted: stored.id === insertionId } : {}) });
        if (insertionId && stored.id === insertionId) newProductIds.push(stored.id);
      } catch (error) {
        const structural = error instanceof SupabaseRequestError
          && (error.kind === "network" || error.kind === "dns" || error.kind === "tls"
            || error.kind === "timeout" || error.kind === "connection-reset"
            || error.kind === "connection-refused" || error.kind === "response"
            || error.status === 401 || error.status === 403 || error.status === 404
            || error.status === 408 || error.status === 425 || error.status === 429
            || (error.status ?? 0) >= 500);
        if (structural) { error.confirmedImports = [...imported]; throw error; }
        errors.push({ sku: product.sku, message: error instanceof Error ? error.message : "onbekende fout" });
      }
    }
  } finally {
    // A later structural import failure must not lose notifications for earlier
    // successfully confirmed product/price pairs in this batch.
    if (newProductIds.length > 0) {
      try {
        // Persist replay scope before making an external request. A failed acknowledgement
        // save leaves the durable pending scope intact for idempotent recovery.
        await lifecycle.onMaintenancePending?.(newProductIds);
        maintenanceResult = await notifyPlannerOfNewProducts(maintenance, newProductIds);
        await lifecycle.onMaintenanceResult?.(maintenanceResult, newProductIds);
      } catch (error) {
        error.confirmedImports = [...imported];
        throw error;
      }
      if (maintenanceResult.pendingProductIds.length > 0) {
        console.warn(`Planner-cacheonderhoud: ${JSON.stringify(maintenanceResult)}`);
      }
    }
  }
  if (imported.length === 0 && uniqueProducts.length > 0) {
    throw new Error(`Geen enkel product kon naar Supabase worden geschreven. Eerste fout: ${errors[0]?.message ?? "onbekend"}`);
  }
  if (maintenanceResult) return { imported, errors,
    duplicateSKUsSkipped: products.length - uniqueProducts.length, plannerMaintenance: maintenanceResult };
  return { imported, errors, duplicateSKUsSkipped: products.length - uniqueProducts.length };
}
