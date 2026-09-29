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
  const separate = JSON.parse(readFileSync(new URL("../data/separate-pending-recovery-20260929.json", import.meta.url), "utf8"));
  if (separate.length !== 2 || separate[0].productIds.length !== 10 || separate[1].productIds.length !== 4) {
    throw Object.assign(new Error("separate-queue-invalid"), { stage: "separate-queue-invalid" });
  }
  const result = await replayPendingMaintenance(settings, {
    expectedPendingCount, allowedProductCohorts: [
      { productIds: historical.productIds, minimumAcknowledged: 0 },
      { productIds: separate[0].productIds, minimumAcknowledged: 290 },
      { productIds: separate[1].productIds, minimumAcknowledged: 300 },
    ],
  });
  console.log(JSON.stringify(result));
  if (!["confirmed", "nothing_pending"].includes(result.status)) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ status: "replay-blocked", stage: error?.stage ?? "unexpected-replay-failure",
    httpStatus: Number.isInteger(error?.status) ? error.status : null }));
  process.exitCode = 1;
}
