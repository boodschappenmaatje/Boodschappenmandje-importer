import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
const workflow = readFileSync(new URL('../.github/workflows/import-hoogvliet-poc.yml', import.meta.url), 'utf8');
const job = workflow.match(/^  maintenance-probe:\n[\s\S]*?(?=^  server-client-probe:)/m)[0];
const script = job.match(/node --input-type=module <<'NODE'\n([\s\S]*?)^          NODE/m)[1].replace(/^          /gm, '');

test('production probe is explicit branch-scoped, has no DB credentials or import and excludes normal importer', () => {
  assert.match(job, /permissions: \{\}/);
  assert.match(job, /inputs.maintenance_probe_only == true/);
  assert.match(job, /github.ref == 'refs\/heads\/fix\/daily-catalog-retry-schedule'/);
  assert.doesNotMatch(job, /SUPABASE|npm|uses:|src\/importer/);
  const expression = workflow.match(/^  import:\n[^\n]*\n    if: \$\{\{ (.*) \}\}/m)[1];
  for (const [typed, raw] of [[true, 'true'], [true, undefined], [undefined, 'true'], [false, 'true']]) {
    assert.equal(vm.runInNewContext(expression, { inputs: { maintenance_probe_only: typed },
      github: { event: { inputs: { maintenance_probe_only: raw } } } }), false);
  }
});

test('production probe makes exactly two empty-list requests, reports auth and redacts failures', async () => {
  for (const status of [400, 401, 503]) {
    const calls = [], logs = [], process = { env: { PLANNER_CACHE_ADMIN_TOKEN: 'secret-fixture', VERCEL_AUTOMATION_BYPASS_SECRET: 'bypass-fixture' } };
    await vm.runInNewContext(`(async () => {${script}})()`, { process, AbortSignal,
      console: { log: value => logs.push(value) }, fetch: async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify({ error: status === 400 ? 'invalid-request' : status === 401 ? 'unauthorized' : 'secret-fixture' }), { status });
      },
    });
    assert.equal(calls.length, 2);
    assert.deepEqual(calls.map(call => JSON.parse(call.options.body)), [{ productIds: [] }, { recipeIds: [] }]);
    for (const call of calls) {
      assert.equal(new URL(call.url).origin, 'https://boodschappenmaatje-pwa.vercel.app');
      assert.equal(call.options.redirect, 'manual');
    }
    assert.equal(process.exitCode, status === 400 ? undefined : 1);
    assert.equal(logs.join('').includes('secret-fixture'), false);
    assert.equal(logs.join('').includes('bypass-fixture'), false);
  }
});
