const baseURL = process.env.PLANNER_CACHE_BASE_URL?.trim()?.replace(/\/+$/, "");
const token = process.env.PLANNER_CACHE_ADMIN_TOKEN?.trim();
const people = Number(process.env.PLANNER_CACHE_PEOPLE ?? "4");
const batchSize = Number(process.env.PLANNER_CACHE_BATCH_SIZE ?? "10");
let cursor = process.env.PLANNER_CACHE_CURSOR?.trim() || null;

if (!baseURL || !/^https:\/\//.test(baseURL)) {
  throw new Error("PLANNER_CACHE_BASE_URL moet een HTTPS Preview-URL zijn.");
}
if (!token) throw new Error("PLANNER_CACHE_ADMIN_TOKEN ontbreekt.");
if (!Number.isInteger(people) || people < 1 || people > 12) {
  throw new Error("PLANNER_CACHE_PEOPLE moet tussen 1 en 12 liggen.");
}
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 20) {
  throw new Error("PLANNER_CACHE_BATCH_SIZE moet tussen 1 en 20 liggen.");
}

let processed = 0;
while (true) {
  const response = await fetch(`${baseURL}/api/internal/planner-readiness/backfill`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      numberOfPeople: people,
      batchSize,
      afterSourceKey: cursor,
    }),
  });
  if (!response.ok) {
    throw new Error(`Backfill stopte met HTTP ${response.status}; hervat vanaf cursor ${cursor ?? "START"}.`);
  }
  const result = await response.json();
  processed += Number(result.refreshed ?? 0);
  cursor = typeof result.nextCursor === "string" ? result.nextCursor : cursor;
  process.stdout.write(
    `${JSON.stringify({ people, processed, cursor, complete: result.complete === true })}\n`,
  );
  if (result.complete === true) break;
}
