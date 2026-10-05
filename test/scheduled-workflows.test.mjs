import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DAILY_SCHEDULE_OFFSETS, evaluateDailySchedule } from '../src/daily-schedule-gate.mjs';
import { nextEmptySourceSearchCount } from '../src/hoogvliet.mjs';

const primary = readFileSync(new URL('../.github/workflows/import-hoogvliet-poc.yml', import.meta.url), 'utf8');
const monitor = readFileSync(new URL('../.github/workflows/monitor-catalog-import.yml', import.meta.url), 'utf8');
const retry = readFileSync(new URL('../.github/workflows/retry-daily-catalog-import.yml', import.meta.url), 'utf8');

function cronEntries(workflow) {
  return [...workflow.matchAll(/^\s+- cron: "([^"]+)"$/gm)].map(([, cron]) => cron);
}

test('primary workflow uses valid UTC cron entries and keeps the existing jobs', () => {
  assert.deepEqual(cronEntries(primary), ['0 4 * * *', '0 5 * * *', '17 2 * * *', '43 3 * * 0']);
  assert.doesNotMatch(primary, /^\s+timezone:/m);
  assert.match(primary, /SCHEDULE_CRON: \$\{\{ github\.event\.schedule \}\}/);
  assert.match(primary, /src\/daily-schedule-gate\.mjs/);
  assert.match(primary, /DAILY_IMPORT_STATE_KEY=daily-catalog-growth/);
  assert.match(primary, /DAILY_NEW_PRODUCT_TARGET=\$max_products/);
  assert.match(primary, /DAILY_IMPORT_END_HOUR=23/);
  assert.match(primary, /group: hoogvliet-supabase-update/);
  assert.match(primary, /daily_import:\n        description: Start exact de persistente dagelijkse 400-job/);
  assert.match(primary, /recover_failed_daily:\n        description: Herstel exact één aantoonbaar opgeloste/);
  assert.match(primary, /RECOVER_FAILED_DAILY=\$recover_failed_daily/);
  assert.match(primary, /DAILY_RECOVERY_REASON=\$\{\{ inputs\.recovery_reason \}\}/);
  assert.match(primary, /recover_failed_daily.*daily_import/s);
  assert.match(primary, /inputs\.daily_import.*true/);
  assert.match(primary, /update_mode="growth"/);
  assert.match(primary, /catalog_batch="growth"/);
  assert.match(primary, /max_products="400"/);
  assert.match(primary, /daily_import_job="1"/);
  assert.match(primary, /DAILY_IMPORT_JOB=\$daily_import_job/);
  assert.match(primary, /DAILY_NEW_PRODUCT_TARGET=\$max_products/);
  assert.match(primary, /npm run import:daily/);
  assert.match(primary, /update_mode="\$\{\{ inputs\.update_mode \}\}"/);
});

test('04:00 UTC is the 06:00 Dutch trigger during CEST', () => {
  const instant = '2026-10-05T04:00:00Z';
  assert.deepEqual(DAILY_SCHEDULE_OFFSETS, { '0 4 * * *': 120, '0 5 * * *': 60 });
  assert.deepEqual(evaluateDailySchedule({ schedule: '0 4 * * *', instant }), {
    isDailyTrigger: true,
    shouldRun: true,
    reason: 'correct-dst-trigger',
    localHour: '06',
    localMinute: '00',
    localOffsetMinutes: 120,
    expectedOffsetMinutes: 120,
  });
  assert.equal(evaluateDailySchedule({ schedule: '0 5 * * *', instant }).shouldRun, false);
});

test('05:00 UTC is the 06:00 Dutch trigger during CET', () => {
  const instant = '2026-01-05T05:00:00Z';
  assert.equal(evaluateDailySchedule({ schedule: '0 4 * * *', instant }).shouldRun, false);
  assert.deepEqual(evaluateDailySchedule({ schedule: '0 5 * * *', instant }), {
    isDailyTrigger: true,
    shouldRun: true,
    reason: 'correct-dst-trigger',
    localHour: '06',
    localMinute: '00',
    localOffsetMinutes: 60,
    expectedOffsetMinutes: 60,
  });
});

test('the other daily UTC candidate is safely skipped and delayed valid events remain valid', () => {
  assert.equal(evaluateDailySchedule({ schedule: '0 5 * * *', instant: '2026-07-05T05:00:00Z' }).shouldRun, false);
  // GitHub may start a scheduled run late; do not gate the valid event on the
  // runner wall-clock hour after its DST offset has been identified.
  assert.equal(evaluateDailySchedule({ schedule: '0 4 * * *', instant: '2026-07-05T06:00:00Z' }).shouldRun, true);
  assert.equal(evaluateDailySchedule({ schedule: '17 2 * * *', instant: '2026-07-05T02:17:00Z' }).shouldRun, false);
});

test('three valid empty searches do not become a global source failure', () => {
  let consecutive = 0;
  for (const term of ['gehakt', 'rundergehakt', 'kip']) {
    assert.ok(term);
    consecutive = nextEmptySourceSearchCount(consecutive, 0, 'valid_empty_search');
  }
  assert.equal(consecutive, 0);
});

test('daily cap, persistent day state, retries, price and weekly schedules stay intact', () => {
  assert.match(primary, /daily_import_job="1"/);
  assert.match(primary, /MAX_NEW_PRODUCTS=.*max_products/);
  assert.match(primary, /DAILY_IMPORT_STATE_KEY=daily-catalog-growth/);
  assert.match(primary, /DAILY_NEW_PRODUCT_TARGET=\$max_products/);
  assert.match(primary, /npm run import:daily/);

  assert.deepEqual(cronEntries(retry), ['17 8,13,18 * * *']);
  assert.match(retry, /npm run --silent inspect:daily/);
  assert.match(retry, /npm run import:daily/);
  assert.match(retry, /DAILY_NEW_PRODUCT_TARGET: "400"/);
  assert.match(retry, /group: hoogvliet-supabase-update/);

  assert.match(primary, /- cron: "17 2 \* \* \*"/);
  assert.match(primary, /- cron: "43 3 \* \* 0"/);
  assert.match(monitor, /npm run monitor:catalog/);
  assert.match(monitor, /group: hoogvliet-catalog-monitor/);
});
