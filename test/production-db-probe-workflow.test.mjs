import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const workflow = readFileSync(new URL('../.github/workflows/import-hoogvliet-poc.yml', import.meta.url), 'utf8');
const job = workflow.match(/^  server-client-probe:\n[\s\S]*?(?=^  preflight:)/m)?.[0];
const script = job?.match(/node --input-type=module <<'NODE'\n([\s\S]*?)^          NODE/m)?.[1]
  .replace(/^          /gm, '');

test('database probe is isolated from importer and does not load Supabase credentials', () => {
  assert.ok(job && script);
  assert.match(job, /permissions: \{\}/);
  assert.match(job, /github.ref == 'refs\/heads\/fix\/daily-catalog-retry-schedule'/);
  assert.doesNotMatch(job, /SUPABASE_SECRET_KEY|SUPABASE_URL|uses:|npm |src\/importer/);
  const expression = workflow.match(/^  import:\n[^\n]*\n    if: \$\{\{ (.*) \}\}/m)?.[1];
  assert.ok(expression);
  assert.equal(vm.runInNewContext(expression, {
    inputs: { server_client_probe_only: true },
    github: { event: { inputs: { server_client_probe_only: 'true' } } },
  }), false);
});

test('one authenticated Production POST, safe logging, no product or maintenance request', async () => {
  for (const [status, data, expected] of [
    [200, { code: 'database-read-ok', authenticated: true, serverClientAvailable: true,
      databaseReadSuccess: true, databaseWrites: 0 }, true],
    [502, { code: 'database-read-failed', authenticated: true, serverClientAvailable: true,
      databaseReadSuccess: false, databaseWrites: 0, detail: 'hidden-secret' }, false],
    [503, { code: 'database-client-unavailable', authenticated: true, serverClientAvailable: false,
      databaseReadSuccess: false, databaseWrites: 0 }, false],
  ]) {
    const calls = [], logs = [], process = { env: {
      PLANNER_CACHE_ADMIN_TOKEN: 'secret-fixture', VERCEL_AUTOMATION_BYPASS_SECRET: 'bypass-fixture',
    } };
    await vm.runInNewContext(`(async () => {${script}})()`, { process, AbortSignal,
      console: { log: line => logs.push(line) }, fetch: async (url, options) => {
        calls.push({ url, options });
        return new Response(JSON.stringify(data), { status });
      },
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://boodschappenmaatje-pwa.vercel.app/api/internal/planner-readiness/repair');
    assert.equal(calls[0].options.method, 'POST');
    assert.deepEqual(JSON.parse(calls[0].options.body), { databaseReadProbe: 'v1' });
    assert.equal(calls[0].options.redirect, 'manual');
    assert.equal(process.exitCode, expected ? undefined : 1);
    assert.equal(logs.length, 1);
    assert.equal(logs[0].includes('secret-fixture'), false);
    assert.equal(logs[0].includes('bypass-fixture'), false);
    assert.equal(logs[0].includes('hidden-secret'), false);
  }
});
