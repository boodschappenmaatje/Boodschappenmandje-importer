import { appendFileSync } from "node:fs";
const originalFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async function guardedFetch(input, init = {}) {
  const requestMethod = input && typeof input === "object" && input.method ? input.method : "GET";
  const method = String(init.method || requestMethod).toUpperCase();
  if (method !== "GET" && method !== "HEAD") {
    const rawUrl = typeof input === "string" ? input : (input && input.url) || String(input);
    try { appendFileSync("/tmp/pr55-blocked-write-attempts.log", method + " " + rawUrl + "\n"); } catch {}
    throw new Error("PR55_READ_ONLY_GUARD blocked non-GET request: " + method);
  }
  return originalFetch(input, init);
};