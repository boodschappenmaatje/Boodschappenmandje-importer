import { setDefaultResultOrder } from "node:dns";
import { UNKNOWN_PRODUCT_TYPE } from "./product-type.mjs";

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

async function postJSON(baseValue, table, secret, payload, prefer, query) {
  const url = restURL(baseValue, table);
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
        method: "POST",
        headers: requestHeaders(secret, prefer),
        body,
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
        `Supabase write mislukt | fase=${table} | host=${host} | soort=http | HTTP ${response.status}`
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

    if (!responseBody) return [];
    try {
      return JSON.parse(responseBody);
    } catch {
      throw new SupabaseRequestError(
        `Supabase write mislukt | fase=${table} | host=${host} | soort=response | succesvolle reactie bevatte ongeldige JSON.`,
        { phase: table, host, kind: "response" },
      );
    }
  }
  throw new SupabaseRequestError(`Supabase ${table}: onverwacht einde van request.`);
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
  return row ? {
    stateKey: row.state_key,
    termCursor: boundedCount(row.term_cursor),
    pageCursor: boundedCount(row.page_cursor),
    lastBatch: row.last_batch ?? null,
    updatedAt: row.updated_at ?? null,
  } : {
    stateKey,
    termCursor: 0,
    pageCursor: 0,
    lastBatch: null,
    updatedAt: null,
  };
}

export async function saveCatalogDiscoveryState(config, state) {
  const payload = {
    state_key: state.stateKey,
    term_cursor: boundedCount(state.termCursor),
    page_cursor: boundedCount(state.pageCursor),
    last_batch: state.lastBatch ?? null,
    updated_at: state.updatedAt ?? new Date().toISOString(),
  };
  const rows = await postJSON(
    config.supabaseURL,
    "catalog_discovery_state",
    config.supabaseSecret,
    [payload],
    "resolution=merge-duplicates,return=representation",
    { on_conflict: "state_key", select: "state_key,term_cursor,page_cursor,last_batch,updated_at" },
  );
  if (!Array.isArray(rows) || rows[0]?.state_key !== state.stateKey) {
    throw new Error("Supabase bevestigde de discovery-state niet.");
  }
  return rows[0];
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

export async function upsertProducts(config, products) {
  const imported = [];
  const errors = [];
  const seenSKUs = new Set();
  const uniqueProducts = products.filter((product) => {
    if (seenSKUs.has(product.sku)) return false;
    seenSKUs.add(product.sku);
    return true;
  });

  for (const product of uniqueProducts) {
    if (!(Number.isFinite(product?.price) && product.price > 0)) {
      errors.push({ sku: product?.sku ?? "-", message: "Ongeldige prijs; bestaande Supabase-prijs blijft ongewijzigd." });
      continue;
    }
    try {
      const rows = await postJSON(
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
      imported.push({ sku: product.sku, name: product.name, price: product.price });
    } catch (error) {
      const structural = error instanceof SupabaseRequestError
        && (error.kind === "network" || error.kind === "dns" || error.kind === "tls"
          || error.kind === "timeout" || error.kind === "connection-reset"
          || error.kind === "connection-refused" || error.kind === "response"
          || error.status === 401 || error.status === 403 || error.status === 404
          || error.status === 408 || error.status === 425 || error.status === 429
          || (error.status ?? 0) >= 500);
      if (structural) throw error;
      errors.push({ sku: product.sku, message: error instanceof Error ? error.message : "onbekende fout" });
    }
  }

  if (imported.length === 0 && uniqueProducts.length > 0) {
    throw new Error(`Geen enkel product kon naar Supabase worden geschreven. Eerste fout: ${errors[0]?.message ?? "onbekend"}`);
  }
  return { imported, errors, duplicateSKUsSkipped: products.length - uniqueProducts.length };
}
