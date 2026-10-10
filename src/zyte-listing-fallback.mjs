export const ZYTE_API_URL = "https://api.zyte.com/v1/extract";
export const ZYTE_DEFAULT_TIMEOUT_MS = 45_000;
export const ZYTE_MAX_TIMEOUT_MS = 60_000;
export const ZYTE_MAX_BROWSER_HTML_BYTES = 2 * 1024 * 1024;
const ZYTE_MAX_RESPONSE_BYTES = ZYTE_MAX_BROWSER_HTML_BYTES + (512 * 1024);

async function readTextBounded(response, maxBytes) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) return { ok: false, reason: "response_too_large" };
  if (!response.body?.getReader) {
    const text = await response.text();
    return Buffer.byteLength(text, "utf8") <= maxBytes
      ? { ok: true, text }
      : { ok: false, reason: "response_too_large" };
  }
  const reader = response.body.getReader();
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, reason: "response_too_large" };
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const combined = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { ok: true, text: new TextDecoder().decode(combined) };
}

function failure(reason, fields = {}) {
  return {
    ok: false,
    provider: "zyte",
    reason,
    apiStatus: fields.apiStatus ?? null,
    sourceStatus: fields.sourceStatus ?? null,
    finalResponseURL: fields.finalResponseURL ?? null,
    latencyMs: fields.latencyMs ?? 0,
    htmlBytes: 0,
    html: null,
  };
}

export async function fetchZyteListingHTML({
  targetURL,
  apiKey,
  timeoutMs = ZYTE_DEFAULT_TIMEOUT_MS,
  normalizeListingURL,
  listingIdentity,
  fetchImpl = globalThis.fetch,
  now = Date.now,
} = {}) {
  if (typeof normalizeListingURL !== "function" || typeof listingIdentity !== "function") {
    return failure("adapter_configuration_invalid");
  }
  const normalizedTargetURL = normalizeListingURL(targetURL);
  if (!normalizedTargetURL) return failure("invalid_listing_url");
  if (typeof apiKey !== "string" || !apiKey.trim()) return failure("api_key_missing");
  if (typeof fetchImpl !== "function") return failure("fetch_unavailable");

  const boundedTimeoutMs = Math.min(
    ZYTE_MAX_TIMEOUT_MS,
    Math.max(1, Number.parseInt(timeoutMs, 10) || ZYTE_DEFAULT_TIMEOUT_MS),
  );
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), boundedTimeoutMs);
  const startedAt = now();
  try {
    const response = await fetchImpl(ZYTE_API_URL, {
      method: "POST",
      headers: {
        authorization: `Basic ${Buffer.from(`${apiKey.trim()}:`).toString("base64")}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ url: normalizedTargetURL, browserHtml: true }),
      redirect: "error",
      signal: controller.signal,
    });
    const apiStatus = response.status;
    if (!response.ok) {
      return failure("api_error", { apiStatus, latencyMs: Math.max(0, now() - startedAt) });
    }
    const encoded = await readTextBounded(response, ZYTE_MAX_RESPONSE_BYTES);
    if (!encoded.ok) {
      return failure(encoded.reason, { apiStatus, latencyMs: Math.max(0, now() - startedAt) });
    }
    let body;
    try {
      body = JSON.parse(encoded.text);
    } catch {
      return failure("invalid_json", { apiStatus, latencyMs: Math.max(0, now() - startedAt) });
    }
    const sourceStatus = Number.isInteger(body?.statusCode) ? body.statusCode : null;
    if (sourceStatus === null || sourceStatus < 200 || sourceStatus >= 300) {
      return failure("source_status_unusable", {
        apiStatus, sourceStatus, latencyMs: Math.max(0, now() - startedAt),
      });
    }
    const finalResponseURL = normalizeListingURL(body?.url);
    if (!finalResponseURL) {
      return failure("invalid_final_response_url", {
        apiStatus,
        sourceStatus,
        latencyMs: Math.max(0, now() - startedAt),
      });
    }
    if (listingIdentity(finalResponseURL) !== listingIdentity(normalizedTargetURL)) {
      return failure("listing_identity_mismatch", {
        apiStatus,
        sourceStatus,
        finalResponseURL,
        latencyMs: Math.max(0, now() - startedAt),
      });
    }
    const html = typeof body?.browserHtml === "string" ? body.browserHtml : null;
    const htmlBytes = html ? Buffer.byteLength(html, "utf8") : 0;
    if (!html) {
      return failure("browser_html_missing", {
        apiStatus, sourceStatus, finalResponseURL,
        latencyMs: Math.max(0, now() - startedAt),
      });
    }
    if (htmlBytes > ZYTE_MAX_BROWSER_HTML_BYTES) {
      return failure("browser_html_too_large", {
        apiStatus, sourceStatus, finalResponseURL,
        latencyMs: Math.max(0, now() - startedAt),
      });
    }
    return {
      ok: true,
      provider: "zyte",
      reason: null,
      apiStatus,
      sourceStatus,
      finalResponseURL,
      latencyMs: Math.max(0, now() - startedAt),
      htmlBytes,
      html,
    };
  } catch (error) {
    return failure(error?.name === "AbortError" ? "timeout" : "network_error", {
      latencyMs: Math.max(0, now() - startedAt),
    });
  } finally {
    clearTimeout(timer);
  }
}
