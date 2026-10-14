import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { DAILY_SCHEDULE_OFFSETS, evaluateDailySchedule } from '../src/daily-schedule-gate.mjs';
import { nextEmptySourceSearchCount } from '../src/hoogvliet.mjs';

const primary = readFileSync(new URL('../.github/workflows/import-hoogvliet-poc.yml', import.meta.url), 'utf8');
const monitor = readFileSync(new URL('../.github/workflows/monitor-catalog-import.yml', import.meta.url), 'utf8');
const retry = readFileSync(new URL('../.github/workflows/retry-daily-catalog-import.yml', import.meta.url), 'utf8');
const manual = readFileSync(new URL('../.github/workflows/manual-daily-catalog-maintenance.yml', import.meta.url), 'utf8');

function cronEntries(workflow) {
  return [...workflow.matchAll(/^\s+- cron: "([^"]+)"$/gm)].map(([, cron]) => cron);
}

test('primary workflow uses valid UTC cron entries and keeps the existing jobs', () => {
  assert.deepEqual(cronEntries(primary), ['0 4 * * *', '0 5 * * *']);
  assert.doesNotMatch(primary, /^\s+timezone:/m);
  assert.match(primary, /SCHEDULE_CRON: \$\{\{ github\.event\.schedule \}\}/);
  assert.match(primary, /src\/daily-schedule-gate\.mjs/);
  assert.match(primary, /DAILY_IMPORT_STATE_KEY=daily-catalog-growth/);
  assert.match(primary, /DAILY_IMPORT_END_HOUR=23/);
  assert.match(primary, /group: hoogvliet-supabase-update/);
  assert.match(primary, /daily_import:\n        description: Start alleen handmatig de legacy 400-growthjob/);
  assert.match(primary, /recover_failed_daily:\n        description: Herstel exact één aantoonbaar opgeloste/);
  assert.match(primary, /RECOVER_FAILED_DAILY=\$recover_failed_daily/);
  assert.match(primary, /DAILY_RECOVERY_REASON=\$\{\{ inputs\.recovery_reason \}\}/);
  assert.match(primary, /recover_failed_daily.*daily_import/s);
  assert.match(primary, /supersede_failed_daily.*daily_import/s);
  assert.match(primary, /SUPERSEDE_FAILED_DAILY=\$supersede_failed_daily/);
  assert.match(primary, /DAILY_SUPERSEDE_REASON=\$\{\{ inputs\.supersede_reason \}\}/);
  assert.match(primary, /DAILY_SUPERSEDE_ACTOR_CONTEXT=github_actions/);
  assert.match(primary, /inputs\.daily_import.*true/);
  assert.match(primary, /update_mode="maintenance"/);
  assert.match(primary, /catalog_batch="growth"/);
  // De 400-state-machine blijft uitsluitend in het expliciete handmatige legacypad.
  assert.match(primary, /max_products="400"/);
  assert.match(primary, /daily_import_job="1"/);
  assert.match(primary, /DAILY_IMPORT_JOB=\$daily_import_job/);
  assert.match(primary, /DAILY_NEW_PRODUCT_TARGET=\$max_products/);
  assert.match(primary, /npm run import:daily/);
  assert.match(primary, /npm run import:daily-growth/);
  assert.match(primary, /update_mode="\$\{\{ inputs\.update_mode \}\}"/);
  assert.match(primary, /workflow_dispatch:/);
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

test('normale daily maintenance heeft volledige dekking; legacy cap blijft alleen handmatig', () => {
  const scheduled = primary.slice(primary.indexOf('if [[ "${{ github.event_name }}" == "schedule" ]]'),
    primary.indexOf('else\n            if [[ ("${{ inputs.recover_failed_daily }}"'));
  assert.match(scheduled, /update_mode="maintenance"/);
  assert.doesNotMatch(scheduled, /max_products="400"|DAILY_NEW_PRODUCT_TARGET|PRICE_SHARD_COUNT/);
  assert.match(primary, /npm run import:daily-growth/);

  assert.deepEqual(cronEntries(retry), ['17 4-20 * * *']);
  assert.match(retry, /Vaste UTC-watchdogkandidaten/);
  assert.match(retry, /npm run --silent inspect:daily/);
  assert.match(retry, /npm run import:daily/);
  assert.match(retry, /UPDATE_MODE: maintenance/);
  assert.doesNotMatch(retry, /DAILY_NEW_PRODUCT_TARGET|MAX_NEW_PRODUCTS|PRICE_SHARD_COUNT|PRICE_SHARD_INDEX/);
  assert.match(retry, /group: hoogvliet-supabase-update/);
  assert.match(primary, /command -v google-chrome/);
  assert.match(retry, /command -v google-chrome/);
  assert.doesNotMatch(primary, /playwright install --with-deps chromium/);
  assert.doesNotMatch(retry, /playwright install --with-deps chromium/);

  assert.doesNotMatch(primary, /- cron: "17 2 \* \* \*"|- cron: "43 3 \* \* 0"/);
  assert.match(monitor, /npm run monitor:catalog/);
  assert.match(monitor, /UPDATE_MODE: maintenance/);
  assert.doesNotMatch(monitor, /CATALOG_MONITOR_GROWTH_TARGET|DAILY_NEW_PRODUCT_TARGET/);
  assert.match(monitor, /group: hoogvliet-catalog-monitor/);
});

test('handmatige full maintenance gebruikt dezelfde orchestrator en is fail-closed voor writes', () => {
  assert.match(manual, /^on:\n  workflow_dispatch:/m);
  assert.match(manual, /mode:[\s\S]*?- dry-run[\s\S]*?- write/);
  assert.match(manual, /DRY_RUN: \$\{\{ inputs\.mode == 'dry-run' && '1' \|\| '0' \}\}/);
  assert.match(manual, /UPDATE_MODE: maintenance/);
  assert.match(manual, /CATALOG_BATCH: growth/);
  assert.match(manual, /IMPORT_TRIGGER: manual/);
  assert.match(manual, /RUN_DAILY_MAINTENANCE_WRITE/);
  assert.match(manual, /GITHUB_REF.*refs\/heads\/main/);
  assert.match(manual, /group: hoogvliet-supabase-update/);
  assert.match(manual, /cancel-in-progress: false/);
  assert.match(manual, /npm run import:daily/);
  assert.match(manual, /command -v google-chrome/);
  assert.doesNotMatch(manual, /import:daily-growth|DAILY_NEW_PRODUCT_TARGET|MAX_NEW_PRODUCTS|playwright install/);
  assert.doesNotMatch(manual, /^\s*(schedule|push|pull_request):/m);
});
