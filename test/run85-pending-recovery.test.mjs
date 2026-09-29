import { readFileSync } from "node:fs";
import { test } from "node:test";
import assert from "node:assert/strict";

test("run-85 historical recovery record is exact, separate, and never executable", () => {
  const record = JSON.parse(readFileSync(new URL("../data/run85-pending-recovery-20260928.json", import.meta.url)));
  assert.equal(record.source.workflowRunId, 36411776257);
  assert.equal(record.source.jobId, 108893427110);
  assert.equal(record.source.independentMatchingSummaries, 2);
  assert.equal(record.statusAtCheckpoint, "pending_requires_attention");
  assert.equal(record.notifiedProductsAtCheckpoint, 0);
  assert.equal(record.productIds.length, 290);
  assert.equal(new Set(record.productIds).size, 290);
  assert.ok(record.productIds.every(id =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)));
  assert.match(record.note, /Historical evidence only/);
});
