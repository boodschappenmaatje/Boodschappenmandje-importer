import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const primary = readFileSync(new URL('../.github/workflows/import-hoogvliet-poc.yml', import.meta.url), 'utf8');
const monitor = readFileSync(new URL('../.github/workflows/monitor-catalog-import.yml', import.meta.url), 'utf8');

test('daily growth keeps a primary Dutch-time trigger plus a guarded recovery trigger', () => {
  assert.ok(primary.includes('- cron: "7 6 * * *"\n      timezone: "Europe/Amsterdam"'));
  assert.ok(primary.includes('- cron: "23 7 * * *"\n      timezone: "Europe/Amsterdam"'));
  assert.equal(primary.split('- cron: "7 6 * * *"').length - 1, 1);
  assert.equal(primary.split('- cron: "23 7 * * *"').length - 1, 1);
  assert.ok(!primary.includes('- cron: "0 4 * * *"'));
  assert.ok(!primary.includes('- cron: "0 5 * * *"'));
  assert.ok(!primary.includes('local_hour='));
  assert.ok(primary.includes('github.event.schedule }}" == "7 6 * * *" || "${{ github.event.schedule }}" == "23 7 * * *"'));
  assert.ok(primary.includes('daily_import_job="1"'));
  assert.ok(primary.includes('DAILY_IMPORT_END_HOUR=23'));
  assert.ok(primary.includes('group: hoogvliet-supabase-update'));
  assert.ok(primary.includes('- cron: "17 2 * * *"'));
  assert.ok(primary.includes('- cron: "43 3 * * 0"'));
});

test('monitor runs its check after a delayed Dutch-time trigger', () => {
  assert.ok(monitor.includes('- cron: "30 8 * * *"\n      timezone: "Europe/Amsterdam"'));
  assert.ok(!monitor.includes('- cron: "30 6 * * *"'));
  assert.ok(!monitor.includes('- cron: "30 7 * * *"'));
  assert.ok(!monitor.includes('RUN_MONITOR'));
  assert.ok(!monitor.includes('local_hour='));
  assert.ok(monitor.includes('- name: Dagelijkse import controleren\n        run: npm run monitor:catalog'));
  assert.ok(monitor.includes('group: hoogvliet-catalog-monitor'));
});
