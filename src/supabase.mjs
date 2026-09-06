import { setDefaultResultOrder } from "node:dns";

const REQUEST_TIMEOUT_MS = 25_000;
const MAX_ATTEMPTS = 3;
const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

setDefaultResultOrder("ipv4first");

export class SupabaseRequestError extends Error {
  constructor(message, { retryable = false, status = null, code = null } = {}) {
    super(message);
    this.name = "SupabaseRequestError";
    this.retryable = retryable;
    this.status = status;
    this.code = code;
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
      message: [object.message, object.details, object.hint]
        .filter((part) => typeof part === "string" && part.trim())
        .join(" | ")
        .slice(0, 600),
    };
  } catch {
    return { code: null, message: safeBody.slice(0, 600) };
  }
}

function networkError(error, table, secret) {
  const cause = error?.cause;
  const code = cause?.code ?? cause?.errno ?? error?.code ?? error?.name ?? "NETWORK_ERROR";
  const reason = redact(cause?.message ?? error?.message ?? "onbekende netwerkfout", secret);
  const timedOut = error?.name === "AbortError" || code === "ABORT_ERR";
  return new SupabaseRequestError(
    `Supabase ${table}: ${timedOut ? `timeout na ${REQUEST_TIMEOUT_MS / 1000}s` : `netwerkfout ${code}`} (${reason.slice(0, 300)}).`,
    { retryable: true, code: String(code) },
  );
}

async function waitBeforeRetry(attempt) {
  await new Promise((resolve) => setTimeout(resolve, 700 * attempt));
}

async function postJSON(baseValue, table, secret, payload, prefer, query) {
  const url = restURL(baseValue, table);
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
      const safeError = networkError(error, table, secret);
      if (attempt < MAX_ATTEMPTS) {
        await waitBeforeRetry(attempt);
        continue;
      }
      throw new SupabaseRequestError(
        `${safeError.message} Pogingen: ${MAX_ATTEMPTS}.`,
        { retryable: true, code: safeError.code },
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      const detail = responseError(responseBody, secret);
      const suffix = detail.message ? `: ${detail.message}` : "";
      const safeError = new SupabaseRequestError(
        `Supabase ${table}: HTTP ${response.status}${detail.code ? ` (${detail.code})` : ""}${suffix}`,
        { retryable: RETRYABLE_STATUS.has(response.status), status: response.status, code: detail.code },
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
      throw new SupabaseRequestError(`Supabase ${table}: succesvolle reactie bevatte ongeldige JSON.`);
    }
  }
  throw new SupabaseRequestError(`Supabase ${table}: onverwacht einde van request.`);
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

  for (const product of products) {
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
  }

  return imported;
}
