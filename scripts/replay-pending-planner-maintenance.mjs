import { replayPendingMaintenance, replaySettings } from "../src/pending-planner-replay.mjs";
import { readFileSync } from "node:fs";

try {
  const settings = replaySettings(process.env);
  const expectedPendingCount = Number(process.env.REPLAY_EXPECTED_PENDING_COUNT);
  if (!Number.isSafeInteger(expectedPendingCount) || expectedPendingCount < 1 || expectedPendingCount > 290) {
    throw Object.assign(new Error("pending-count-invalid"), { stage: "pending-count-invalid" });
  }
  const historical = JSON.parse(readFileSync(new URL("../data/run85-pending-recovery-20260928.json", import.meta.url), "utf8"));
  if (!Array.isArray(historical.productIds) || historical.productIds.length !== 290) {
    throw Object.assign(new Error("historical-queue-invalid"), { stage: "historical-queue-invalid" });
  }
  const result = await replayPendingMaintenance(settings, {
    expectedPendingCount, allowedProductIds: historical.productIds,
  });
  console.log(JSON.stringify(result));
  if (!["confirmed", "nothing_pending"].includes(result.status)) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ status: "replay-blocked", stage: error?.stage ?? "unexpected-replay-failure",
    httpStatus: Number.isInteger(error?.status) ? error.status : null }));
  process.exitCode = 1;
}
