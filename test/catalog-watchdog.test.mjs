import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { evaluateEveningAlarm, runEveningAlarm } from "../src/catalog-monitor.mjs";
import {
  dailyMaintenanceDecision,
  dailyZyteBudget,
  DAILY_ZYTE_BUDGET,
  ESCALATED_DAILY_ZYTE_BUDGET,
  todaysDailyRuns,
} from "../src/daily-catalog-maintenance.mjs";
import { dailyRunPush, eveningAlarmPush, pushConfig, sendPush } from "../src/notify.mjs";

// 14 Oct 2026, 21:10 Amsterdam (CEST).
const evening = new Date("2026-10-14T19:10:00Z");
const run = (values = {}) => ({
  started_at: "2026-10-14T09:30:00Z",
  status: "failed",
  trigger: "schedule",
  processed_count: 0,
  updated_count: 0,
  error_summary: "Dagelijkse catalogussnapshot is onvolledig; stopreden=category_listing_stagnated",
  ...values,
});
const quietLogger = { info() {}, warn() {}, error() {} };

test("bewaker telt geplande runs en alleen catalogusgrote handmatige runs voor vandaag", () => {
  const runs = [
    run(),
    run({ trigger: "manual", processed_count: 12, status: "success" }), // explicit-SKU catch-up
    run({ trigger: "test", status: "success", processed_count: 8000 }),
    run({ started_at: "2026-10-13T12:00:00Z", status: "success" }), // yesterday
  ];
  assert.equal(todaysDailyRuns(runs, evening).length, 1);
  assert.equal(dailyMaintenanceDecision(runs, evening).runAttempt, true);
  const withManualCatalogRun = [...runs, run({ trigger: "manual", status: "success", processed_count: 6072 })];
  assert.deepEqual(dailyMaintenanceDecision(withManualCatalogRun, evening),
    { runAttempt: false, reason: "daily_maintenance_complete" });
});

test("een geslaagde run vandaag stopt verdere pogingen, ook als er daarna een mislukte is", () => {
  const runs = [run({ started_at: "2026-10-14T12:00:00Z" }), run({ status: "success", processed_count: 6000 })];
  assert.deepEqual(dailyMaintenanceDecision(runs, evening), { runAttempt: false, reason: "daily_maintenance_complete" });
});

test("Zyte-budget schaalt na twee mislukte pogingen vandaag op", () => {
  assert.equal(dailyZyteBudget([], evening), DAILY_ZYTE_BUDGET);
  assert.equal(dailyZyteBudget([run()], evening), DAILY_ZYTE_BUDGET);
  assert.equal(dailyZyteBudget([run(), run({ status: "partial" })], evening), ESCALATED_DAILY_ZYTE_BUDGET);
  assert.equal(dailyZyteBudget([run({ started_at: "2026-10-13T09:00:00Z" }), run({ started_at: "2026-10-13T10:00:00Z" })], evening),
    DAILY_ZYTE_BUDGET);
  assert.equal(ESCALATED_DAILY_ZYTE_BUDGET <= 150, true);
});

test("avondalarm: stil bij succes, alarm met oorzaak en gedeeltelijke prijzen bij geen succes", () => {
  assert.equal(evaluateEveningAlarm([run({ status: "success", processed_count: 6072 })], evening).ok, true);
  const evaluation = evaluateEveningAlarm([
    run({ started_at: "2026-10-14T15:42:00Z" }),
    run({ status: "partial", updated_count: 410 }),
  ], evening);
  assert.equal(evaluation.ok, false);
  assert.equal(evaluation.attemptsToday, 2);
  assert.equal(evaluation.partialPricesToday, 410);
  const push = eveningAlarmPush(evaluation);
  assert.equal(push.priority, "high");
  assert.match(push.message, /2 pogingen vandaag/);
  assert.match(push.message, /410 prijzen bijgewerkt/);
  assert.match(push.message, /category_listing_stagnated/);
});

test("avondalarm verstuurt een push en faalt zichtbaar; bij succes geen push", async () => {
  const sent = [];
  const deps = (runs) => ({
    fetchRuns: async (_config, options) => { assert.equal(options.trigger, null); return runs; },
    sendPush: async message => { sent.push(message); return { sent: true }; },
    now: () => evening,
  });
  const env = { DRY_RUN: "1", UPDATE_MODE: "maintenance", CATALOG_BATCH: "growth" };
  await assert.rejects(runEveningAlarm(env, quietLogger, deps([run()])), /geen complete prijsupdate/);
  assert.equal(sent.length, 1);
  await runEveningAlarm(env, quietLogger, deps([run({ status: "success", processed_count: 6000 })]));
  assert.equal(sent.length, 1);
});

test("succesmelding na een schrijvende run; geen melding bij dry-run of gedeeltelijke run", () => {
  const result = {
    status: "success", dryRun: false, processedCount: 6072, updatedCount: 827, newCount: 6,
    snapshot: { fallbackAccounting: { fallbackProviderRequests: 3 } },
  };
  assert.deepEqual(dailyRunPush(result), {
    title: "Prijzen ververst",
    message: "6.072 producten gecontroleerd, 827 prijzen gewijzigd, 6 nieuwe producten. Zyte-hulp: 3x.",
    priority: "default",
    tags: ["white_check_mark"],
  });
  assert.equal(dailyRunPush({ ...result, status: "dry-run", dryRun: true }), null);
  assert.equal(dailyRunPush({ ...result, status: "partial" }), null);
});

test("push: zonder geldig topic geen netwerkverkeer; met topic exact één JSON-POST naar ntfy", async () => {
  assert.equal(pushConfig({}).enabled, false);
  assert.equal(pushConfig({ NTFY_TOPIC: "kort" }).enabled, false);
  assert.equal(pushConfig({ NTFY_TOPIC: "maatje-abcdef123456", NTFY_SERVER: "http://insecure.example" }).enabled, false);
  let calls = 0;
  const none = await sendPush({ title: "x", message: "y" }, { env: {}, fetchImpl: async () => { calls += 1; }, logger: quietLogger });
  assert.deepEqual(none, { sent: false, reason: "not_configured" });
  assert.equal(calls, 0);

  const requests = [];
  const ok = await sendPush({ title: "Prijzen ververst", message: "6.072 producten", priority: "bogus", tags: ["a"] }, {
    env: { NTFY_TOPIC: "maatje-abcdef123456" },
    fetchImpl: async (url, options) => { requests.push({ url, options }); return new Response("{}", { status: 200 }); },
    logger: quietLogger,
  });
  assert.deepEqual(ok, { sent: true });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].url, "https://ntfy.sh");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    topic: "maatje-abcdef123456", title: "Prijzen ververst", message: "6.072 producten", priority: 3, tags: ["a"],
  });
});

test("push-fouten breken nooit de import en lekken het topic niet in logs", async () => {
  const logs = [];
  const logger = { info: v => logs.push(v), warn: v => logs.push(v) };
  const env = { NTFY_TOPIC: "maatje-geheim-topic-123" };
  assert.deepEqual(await sendPush({ title: "t" }, { env, logger, fetchImpl: async () => new Response("", { status: 500 }) }),
    { sent: false, reason: "http_500" });
  assert.deepEqual(await sendPush({ title: "t" }, { env, logger, fetchImpl: async () => { throw new Error("down"); } }),
    { sent: false, reason: "network" });
  assert.ok(logs.every(line => !line.includes("maatje-geheim-topic-123")));
});

test("avondalarm-workflow: twee avondkansen, testknop en topic alleen als secret", async () => {
  const workflow = await readFile(new URL("../.github/workflows/catalog-evening-alarm.yml", import.meta.url), "utf8");
  assert.deepEqual([...workflow.matchAll(/^\s+- cron: "([^"]+)"$/gm)].map(([, cron]) => cron), ["5 19 * * *", "5 20 * * *"]);
  assert.match(workflow, /NTFY_TOPIC: \$\{\{ secrets\.NTFY_TOPIC \}\}/);
  assert.match(workflow, /--test-push/);
  assert.match(workflow, /--evening-alarm/);
  assert.doesNotMatch(workflow, /ZYTE_API_KEY|import:daily/);
  for (const filename of ["retry-daily-catalog-import.yml", "import-hoogvliet-poc.yml", "manual-daily-catalog-maintenance.yml"]) {
    const source = await readFile(new URL(`../.github/workflows/${filename}`, import.meta.url), "utf8");
    assert.equal((source.match(/NTFY_TOPIC: \$\{\{ secrets\.NTFY_TOPIC \}\}/g) ?? []).length, 1, filename);
  }
});

test("push: prioriteit gaat als getal naar ntfy (JSON-API weigert tekst)", async () => {
  const bodies = [];
  for (const priority of ["high", "min", "urgent"]) {
    await sendPush({ title: "t", priority }, {
      env: { NTFY_TOPIC: "maatje-abcdef123456" },
      fetchImpl: async (_url, options) => { bodies.push(JSON.parse(options.body)); return new Response("{}", { status: 200 }); },
      logger: quietLogger,
    });
  }
  assert.deepEqual(bodies.map(body => body.priority), [4, 1, 5]);
});
