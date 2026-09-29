import { replayPendingMaintenance, replaySettings } from "../src/pending-planner-replay.mjs";

try {
  const settings = replaySettings(process.env);
  const result = await replayPendingMaintenance(settings);
  console.log(JSON.stringify(result));
  if (!["confirmed", "nothing_pending"].includes(result.status)) process.exitCode = 1;
} catch (error) {
  console.error(JSON.stringify({ status: "replay-blocked", stage: error?.stage ?? "unexpected-replay-failure",
    httpStatus: Number.isInteger(error?.status) ? error.status : null }));
  process.exitCode = 1;
}
