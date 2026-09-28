import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";

const workflowWithProbe = readFileSync(new URL("../.github/workflows/import-hoogvliet-poc.yml", import.meta.url), "utf8").replace(/\r\n/g, "\n");
// Remove only the separately tested read-only probe additions for the historical fingerprint.
const workflow = workflowWithProbe.replace(/^      maintenance_probe_only:\n[\s\S]*?(?=^      daily_attempt_only:)/m, '')
  .replace(/^  maintenance-probe:\n[\s\S]*?(?=^  preflight:)/m, '')
  .replace("inputs.maintenance_probe_only != true && github.event.inputs.maintenance_probe_only != 'true' && ", '')
  .replace("inputs.server_client_probe_only != true && github.event.inputs.server_client_probe_only != 'true' && ", '');
const standalone = readFileSync(new URL("../.github/workflows/planner-cache-preflight.yml", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const job = workflow.match(/^  preflight:\n[\s\S]*?(?=^  import:)/m)?.[0];
const input = "      preflight_only:\n" +
  "        description: Alleen planner-auth en Supabase read-only controleren; geen import\n" +
  "        type: boolean\n        default: false\n";
const guard = "    # Fail closed for both typed boolean and raw workflow_dispatch input.\n" +
  "    if: ${{ inputs.preflight_only != true && github.event.inputs.preflight_only != 'true' && inputs.falafel_e2e_only != true && github.event.inputs.falafel_e2e_only != 'true' && inputs.e2e_test_sku == '' && (github.event.inputs.e2e_test_sku == '' || github.event.inputs.e2e_test_sku == null) }}\n";
const scriptFrom = (text) => text.match(/node --input-type=module <<'NODE'\n([\s\S]*?)^          NODE/m)?.[1]
  .replace(/^          /gm, "");
const script = scriptFrom(job ?? "");

test("historical importer guards remain intact with explicit daily validation additions", () => {
  assert.ok(job);
  assert.ok(workflow.includes(input));
  assert.ok(workflow.includes(guard));
  const bypassEnv = "      VERCEL_AUTOMATION_BYPASS_SECRET: ${{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET }}\n";
  const e2eInputs = workflow.match(/^      falafel_e2e_only:\n[\s\S]*?(?=^      preflight_only:)/m)?.[0];
  const e2eJob = workflow.match(/\n  falafel-e2e:\n[\s\S]*$/)?.[0];
  assert.ok(e2eInputs && e2eJob);
  const withoutPreflight = workflow.replace(e2eInputs, "").replace(e2eJob, "")
    .replace(input, "").replace(job, "").replace(guard, "");
  assert.equal(withoutPreflight.split(bypassEnv).length - 1, 1);
  assert.match(withoutPreflight, /^  import:\n[\s\S]*?    env:\n[\s\S]*?      VERCEL_AUTOMATION_BYPASS_SECRET: \$\{\{ secrets.VERCEL_AUTOMATION_BYPASS_SECRET \}\}/m);
  const onceInput = "      daily_attempt_only:\n        description: Eén goedgekeurde dagpoging; maximaal resterend dagdoel 400, daarna geen retry\n        type: boolean\n        default: false\n";
  const oncePlan = '\n          # Explicit one-shot validation uses the existing daily claim and closes today\'s job.\n'
    + '          if [[ "${{ github.event_name }}" == "workflow_dispatch" && "${{ inputs.daily_attempt_only }}" == "true" ]]; then\n'
    + '            update_mode="growth"\n            catalog_batch="growth"\n            max_products="400"\n'
    + '            daily_import_job="1"\n            import_trigger="schedule"\n            advance_discovery_state="1"\n'
    + '            echo "DAILY_SINGLE_ATTEMPT=1" >> "$GITHUB_ENV"\n          fi\n';
  assert.ok(workflow.includes(onceInput)); assert.ok(workflow.includes(oncePlan));
  const original = withoutPreflight.replace(bypassEnv, "").replace(onceInput, "").replace(oncePlan, "")
    .replace("Alleen bevestigde nieuwe inserts met bevestigde geldige prijs tellen mee.", "De importer valideert dit met het verschil tussen de Supabase-aantallen vóór en na de run.")
    .replace("PLANNER_CACHE_BASE_URL: https://boodschappenmaatje-pwa.vercel.app", "PLANNER_CACHE_BASE_URL: ${{ vars.PLANNER_CACHE_BASE_URL }}");
  // Approved workflow at 8dd0d4a / db0b8d2, before the isolated preflight additions.
  assert.equal(createHash("sha256").update(original).digest("hex"),
    "3a5a837a0c4de6681c02e6794b720db2711b0cb7de91f4f4409c5870d98eec94");
});

test("job-level guard excludes the entire importer for typed or raw true", () => {
  const expression = workflow.match(/^  import:\n[^\n]*\n    if: \$\{\{ (.*) \}\}/m)?.[1];
  assert.equal(`    if: \${{ ${expression} }}\n`, guard.split("\n").slice(1).join("\n"));
  // These are the boolean/raw-string representations supplied by workflow_dispatch.
  const allow = (typed, raw) => vm.runInNewContext(expression, {
    inputs: { preflight_only: typed, falafel_e2e_only: false, e2e_test_sku: "" },
    github: { event: { inputs: { preflight_only: raw, falafel_e2e_only: "false", e2e_test_sku: "" } } },
  });
  for (const [typed, raw] of [[true, "true"], [true, undefined], [undefined, "true"], [false, "true"]]) {
    assert.equal(allow(typed, raw), false);
  }
  for (const [typed, raw] of [[false, "false"], [false, undefined], [undefined, undefined]]) {
    assert.equal(allow(typed, raw), true);
  }
});

test("preflight is manual, explicit, branch scoped, permissionless and has no checkout/import", () => {
  assert.match(job, /permissions: \{\}/);
  assert.match(job, /if: github.event_name == 'workflow_dispatch' && inputs.preflight_only == true && github.repository == 'boodschappenmaatje\/Boodschappenmandje-importer' && github.ref == 'refs\/heads\/fix\/planner-new-product-maintenance'/);
  assert.match(job, /timeout-minutes: 3/);
  assert.equal((job.match(/^      - name:/gm) ?? []).length, 1);
  assert.doesNotMatch(job, /uses:|npm |npx |import:daily|src\/importer|workflow_run/);
  assert.equal(script, scriptFrom(standalone));
  for (const key of ["PLANNER_CACHE_ADMIN_TOKEN", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "VERCEL_AUTOMATION_BYPASS_SECRET"]) {
    assert.ok(job.includes(`${key}: \${{ secrets.${key} }}`));
  }
  assert.ok(job.includes("PLANNER_CACHE_BASE_URL: ${{ vars.PLANNER_CACHE_BASE_URL }}"));
});

const base = {
  GITHUB_EVENT_NAME: "workflow_dispatch",
  GITHUB_REPOSITORY: "boodschappenmaatje/Boodschappenmandje-importer",
  GITHUB_REF: "refs/heads/fix/planner-new-product-maintenance",
  PLANNER_CACHE_BASE_URL: "https://boodschappenmaatje-pwa-git-fix-planne-a4a7f3-dennisverkaik-4661.vercel.app",
  PLANNER_CACHE_ADMIN_TOKEN: "fixture-token-not-a-real-secret",
  VERCEL_AUTOMATION_BYPASS_SECRET: "fixture-bypass-not-a-real-secret",
  SUPABASE_URL: "https://pjcqxufvbkkjehituzxz.supabase.co",
  SUPABASE_SECRET_KEY: "sb_secret_fixture_not_real",
};
const response = (status, data, type = "application/json") => ({
  status, headers: new Headers({ "content-type": type }), json: async () => data,
});
async function run(options = {}) {
  const env = { ...base, ...options.env }, calls = [], logs = [];
  const process = { env, exitCode: undefined };
  const fetch = async (url, request) => {
    calls.push({ url: String(url), request });
    assert.equal(request.redirect, "manual");
    assert.ok(request.signal);
    if (calls.length === 1) {
      assert.equal(String(url), base.PLANNER_CACHE_BASE_URL + "/api/internal/planner-readiness/new-products");
      assert.equal(request.method, "POST");
      assert.equal(request.body, '{"productIds":[]}');
      assert.equal(request.headers.authorization, `Bearer ${env.PLANNER_CACHE_ADMIN_TOKEN}`);
      assert.equal(request.headers['x-vercel-protection-bypass'], env.VERCEL_AUTOMATION_BYPASS_SECRET);
      assert.ok(!String(url).includes(env.VERCEL_AUTOMATION_BYPASS_SECRET));
      if (options.networkError) throw new Error(env.PLANNER_CACHE_ADMIN_TOKEN);
      return options.auth ?? response(400, { error: "invalid-request" });
    }
    assert.equal(calls.length, 2);
    assert.equal(String(url), base.SUPABASE_URL + "/rest/v1/recipes?select=id&limit=1");
    assert.equal(request.method, "GET");
    assert.equal(request.body, undefined);
    assert.equal(request.headers.apikey, env.SUPABASE_SECRET_KEY);
    assert.equal(request.headers['x-vercel-protection-bypass'], undefined);
    return options.read ?? response(200, [{ id: "fixture-recipe-id" }]);
  };
  const context = vm.createContext({ process, fetch, Buffer, URL, AbortSignal,
    console: { log: (value) => logs.push(value), error: (value) => logs.push(value) } });
  await new vm.Script(`(async () => {${script}})()`).runInContext(context);
  for (const key of ["PLANNER_CACHE_ADMIN_TOKEN", "SUPABASE_SECRET_KEY", "VERCEL_AUTOMATION_BYPASS_SECRET"]) {
    if (env[key]) assert.ok(!logs.join("\n").includes(env[key]), "must not log secrets");
  }
  return { code: process.exitCode ?? 0, calls, logs };
}

test("happy preflight performs exactly one empty-list POST then one GET", async () => {
  const result = await run();
  assert.equal(result.code, 0);
  assert.equal(result.calls.length, 2);
});

for (const key of ["PLANNER_CACHE_BASE_URL", "PLANNER_CACHE_ADMIN_TOKEN", "SUPABASE_URL", "SUPABASE_SECRET_KEY", "VERCEL_AUTOMATION_BYPASS_SECRET"]) {
  test(`missing ${key} stops before network access`, async () => {
    const result = await run({ env: { [key]: "" } });
    assert.equal(result.code, 1); assert.equal(result.calls.length, 0);
  });
}
for (const status of [200, 301, 307, 401, 403, 500]) {
  test(`auth HTTP ${status} stops before Supabase`, async () => {
    const result = await run({ auth: response(status, { error: "invalid-request" }) });
    assert.equal(result.code, 1); assert.equal(result.calls.length, 1);
  });
}
test("a 400 must contain the exact application error, not HTML or unrelated data", async () => {
  for (const auth of [response(400, { error: base.PLANNER_CACHE_ADMIN_TOKEN }),
    response(400, { error: "invalid-request" }, "text/html")]) {
    const result = await run({ auth });
    assert.equal(result.code, 1); assert.equal(result.calls.length, 1);
  }
});
test("network failures never print credential-bearing exceptions", async () => {
  assert.equal((await run({ networkError: true })).code, 1);
});
test("unexpected Preview/project and public key are rejected before network access", async () => {
  for (const env of [{ PLANNER_CACHE_BASE_URL: "https://boodschappenmaatje-pwa.vercel.app" },
    { SUPABASE_URL: "https://other.supabase.co" }, { SUPABASE_SECRET_KEY: "sb_publishable_fixture" }]) {
    const result = await run({ env });
    assert.equal(result.code, 1); assert.equal(result.calls.length, 0);
  }
});
test("failed or malformed Supabase reads cannot report success", async () => {
  for (const read of [response(401, {}), response(403, {}), response(500, {}), response(200, [])]) {
    const result = await run({ read });
    assert.equal(result.code, 1); assert.equal(result.calls.length, 2);
  }
});
