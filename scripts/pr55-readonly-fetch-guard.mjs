// Temporary PR #55 proof guard: deny every non-GET Node fetch.
const originalFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const method = String(init.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET") throw new Error("PR55_READ_ONLY_GUARD_BLOCKED_NON_GET");
  return originalFetch(input, { ...init, method: "GET", redirect: "error" });
};
console.log("PR55_READ_ONLY_FETCH_GUARD=enabled; allowed_methods=GET");
