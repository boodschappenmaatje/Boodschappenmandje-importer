import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { maintenanceDiagnostic, maintenanceError, maintenanceRequest, mealMixRefreshSettings, refreshMealMixRecipes } from '../src/maintenance-http.mjs';
const env = { SUPABASE_URL: 'https://fixture.supabase.co', SUPABASE_SECRET_KEY: 'secret-db',
  PLANNER_CACHE_BASE_URL: 'https://boodschappenmaatje-pwa.vercel.app', PLANNER_CACHE_ADMIN_TOKEN: 'secret-admin',
  VERCEL_AUTOMATION_BYPASS_SECRET: 'secret-bypass' };
const json = (data, status = 200) => new Response(JSON.stringify(data), { status });
test('scheduled meal profiles and importer target stable production; stale preview is rejected', () => {
  const settings = mealMixRefreshSettings(env);
  assert.equal(settings.url.href, env.PLANNER_CACHE_BASE_URL + '/api/internal/planner-readiness/mix-refresh');
  assert.throws(() => mealMixRefreshSettings({ ...env, PLANNER_CACHE_BASE_URL: 'https://old-preview.vercel.app/' }), /production/);
  assert.throws(() => mealMixRefreshSettings({ ...env, PLANNER_CACHE_ADMIN_TOKEN: '' }), /missing/);
  for (const filename of ['meal-mix-profiles.yml', 'retry-daily-catalog-import.yml', 'import-hoogvliet-poc.yml']) {
    const yaml = readFileSync(new URL('../.github/workflows/' + filename, import.meta.url), 'utf8');
    assert.ok(yaml.includes('PLANNER_CACHE_BASE_URL: ' + env.PLANNER_CACHE_BASE_URL));
  }
});
test('refresh acknowledges exact recipe IDs and preserves both auth headers across bounded retries', async () => {
  const settings = mealMixRefreshSettings(env), waits = [], calls = [];
  await refreshMealMixRecipes(settings, ['recipe-one'], { wait: async ms => waits.push(ms), fetcher: async (url, options) => {
    calls.push(options); assert.equal(url.href, settings.url.href);
    assert.equal(options.redirect, 'manual'); assert.deepEqual(options.headers, settings.headers);
    return calls.length < 3 ? json({ error: 'cache-unavailable' }, 503) : json({ refreshedRecipeIds: ['recipe-one'] });
  } });
  assert.deepEqual(waits, [1000, 2000]); assert.equal(calls.length, 3);
});
test('a refused cache refresh (cache-refresh-failed) is final: no retry of the same write', async () => {
  const settings = mealMixRefreshSettings(env), waits = []; let calls = 0;
  await assert.rejects(refreshMealMixRecipes(settings, ['recipe-one'], { wait: async ms => waits.push(ms),
    fetcher: async () => { calls += 1; return json({ error: 'cache-refresh-failed' }, 503); } }),
    error => error.stage === 'meal-mix-cache-refresh' && error.code === 'cache-refresh-failed' && error.status === 503);
  assert.equal(calls, 1); assert.deepEqual(waits, []);
});
test('auth, missing endpoint and redirect errors never retry and report actual HTTP status safely', async () => {
  for (const status of [301, 401, 403, 404]) {
    let calls = 0;
    await assert.rejects(refreshMealMixRecipes(mealMixRefreshSettings(env), ['recipe-one'], { fetcher: async () => {
      calls++; return json({ error: 'secret-admin secret-bypass secret-db' }, status);
    } }), error => {
      const diagnostic = maintenanceDiagnostic(error);
      assert.equal(JSON.parse(diagnostic).status, status);
      for (const secret of ['secret-admin', 'secret-bypass', 'secret-db']) assert.ok(!diagnostic.includes(secret));
      return true;
    }); assert.equal(calls, 1);
  }
});
test('database diagnostics retain PostgREST code; unexpected exception text never leaks', async () => {
  await assert.rejects(maintenanceRequest(new URL(env.SUPABASE_URL), {}, { stage: 'meal-mix-database',
    fetcher: async () => json({ code: 'PGRST204', message: 'secret-db' }, 400) }), error => {
      assert.deepEqual(JSON.parse(maintenanceDiagnostic(error)), { stage: 'meal-mix-database', status: 400, code: 'PGRST204', timeout: false }); return true;
    });
  assert.ok(!maintenanceDiagnostic(new Error('secret-admin')).includes('secret-admin'));
  assert.equal(JSON.parse(maintenanceDiagnostic(maintenanceError('network', { cause: { code: 'ECONNRESET' } }))).cause, 'ECONNRESET');
});
test('200 HTML or wrong acknowledgement never marks caches current', async () => {
  for (const response of [new Response('<html>Login</html>'), json({ refreshedRecipeIds: [] })]) {
    await assert.rejects(refreshMealMixRecipes(mealMixRefreshSettings(env), ['recipe-one'], { fetcher: async () => response }), /invalid-cache-refresh-response/);
  }
});
test('native fetch nested network causes survive bounded retries without exposing messages', async () => {
  const waits = []; let calls = 0;
  await assert.rejects(maintenanceRequest(new URL(env.PLANNER_CACHE_BASE_URL), {}, {
    stage: 'meal-mix-cache-refresh', wait: async ms => waits.push(ms),
    fetcher: async () => { calls++; throw new TypeError('secret-admin', { cause: Object.assign(new Error('secret-db'), { code: 'ECONNRESET' }) }); },
  }), error => {
    const diagnostic = maintenanceDiagnostic(error);
    assert.equal(JSON.parse(diagnostic).cause, 'ECONNRESET');
    assert.ok(!diagnostic.includes('secret-')); return true;
  });
  assert.equal(calls, 3); assert.deepEqual(waits, [1000, 2000]);
});
