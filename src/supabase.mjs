import { setDefaultResultOrder } from "node:dns";

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

function productPayload(product) {
  const payload = {
    supermarket: product.supermarket,
    sku: product.sku,
    name: product.name,
    package_text: product.packageText,
    source_url: product.sourceURL,
    updated_at: product.fetchedAt,
  };
  if (product.brand != null) payload.brand = product.brand;
  if (product.category != null) payload.category = product.category;
  if (product.weightGrams != null) payload.weight_grams = product.weightGrams;
  if (product.imageURL != null) payload.image_url = product.imageURL;
  if (product.isAvailable != null) payload.is_available = product.isAvailable;
  return payload;
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
    try {
      const rows = await postJSON(
        config.supabaseURL,
        "products",
        config.supabaseSecret,
        [productPayload(product)],
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
