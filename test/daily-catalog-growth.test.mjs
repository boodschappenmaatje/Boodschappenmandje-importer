import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  amsterdamDateKey,
  classifyDailyImportError,
  dailyRetryAt,
  dailyRetryDelayMinutes,
  failedDailyRecoveryDecision,
  failedDailySupersedeDecision,
  inspectDailyCatalogAttempt,
  isDailyImportWindowOpen,
  formatDailyAttemptSummary,
  runFailedDailyRecovery,
  runFreshDailySupersede,
  runDailyCatalogAttempt,
  shouldRunDailyImport,
} from "../src/daily-catalog-growth.mjs";
import { evaluateDailyCatalogMonitor } from "../src/catalog-monitor.mjs";
import {
  claimCatalogDailyAttempt,
  finishCatalogDailyAttempt,
  recoverCatalogDailyAttempt,
  supersedeFailedCatalogDailyJob,
  rpcURL,
} from "../src/supabase.mjs";

const logger = { info() {}, error() {} };
const config = {
  dryRun: false,
  maxProducts: 400,
  maxNewProducts: 400,
  dailyImportStateKey: "daily-catalog-growth-test",
  dailyTargetNewProducts: 400,
  dailyEndHour: 23,
  growthMaxRuntimeMs: 105 * 60_000,
};

test('daily summary exposes the funnel and cumulative 400 target', () => {
  const summary = formatDailyAttemptSummary({
    job: { id: 'daily-1', jobDate: '2026-10-05', attemptCount: 2, targetNewProducts: 400,
      newProductsCollected: 137, remainingTarget: 263, status: 'retry_scheduled' },
    counts: { candidates: 8550, uniqueCandidates: 4100, existing: 3800, duplicates: 240,
      validNewCandidates: 60, new: 55, updated: 12, unchanged: 4, skipped: 5, invalid: 5,
      sourceErrors: 0, segments: [], accounting: { rawPageHits: 8550, uniqueRelevantSKUs: 4100 } },
  });
  assert.match(summary, /raw_paginahits=8550/);
  assert.match(summary, /unieke_kandidaten=4100/);
  assert.match(summary, /bestaand=3800/);
  assert.match(summary, /duplicaten=240/);
  assert.match(summary, /nieuwe_geldige_kandidaten=60/);
  assert.match(summary, /cumulatief_nieuw=137\/400/);
});

function failedRecoveryJob(overrides = {}) {
  const job = {
    id: 'daily-recovery-1', stateKey: config.dailyImportStateKey, jobDate: '2026-09-17',
    targetNewProducts: 400, newProductsCollected: 0, remainingTarget: 400,
    status: 'failed_requires_attention', attemptCount: 1, recoveryCount: 0,
    lockExpiresAt: null, updatedAt: '2026-09-17T08:05:00.000Z',
    ...overrides,
  };
  return job;
}

function failedSupersedeJob(overrides = {}) {
  return failedRecoveryJob({
    recoveryCount: 1,
    updatedAt: '2026-10-05T08:05:00.000Z',
    jobDate: '2026-10-05',
    ...overrides,
  });
}

const endedFailureAttempt = [{
  attempt_number: 1, status: 'non_retryable_failure',
  error_code: 'non_retryable_import_error', completed_at: '2026-09-17T08:05:00.000Z',
}];

test('failed_requires_attention 0/400 zonder lock is alleen expliciet recovery-eligible', () => {
  const decision = failedDailyRecoveryDecision(failedRecoveryJob(), endedFailureAttempt);
  assert.deepEqual(decision, { allowed: true, reason: 'failed_daily_recovery_eligible' });
});

test('recovery behoudt gedeeltelijke 137/400-voortgang en resterend 263', () => {
  const job = failedRecoveryJob({ newProductsCollected: 137, remainingTarget: 263 });
  const decision = failedDailyRecoveryDecision(job, endedFailureAttempt);
  assert.equal(decision.allowed, true);
  assert.equal(job.newProductsCollected, 137);
  assert.equal(job.remainingTarget, 263);
  assert.equal(job.targetNewProducts, 400);
});

test('failed daily recovery wijst status-, target-, lock- en attemptguards af', () => {
  const cases = [
    [{ status: 'running' }, 'failed_daily_recovery_status_not_eligible'],
    [{ newProductsCollected: 400, remainingTarget: 0, status: 'target_reached' }, 'failed_daily_recovery_status_not_eligible'],
    [{ lockExpiresAt: '2026-09-17T10:00:00.000Z' }, 'failed_daily_recovery_lock_present'],
    [{}, 'failed_daily_recovery_attempt_running'],
  ];
  for (const [overrides, reason] of cases) {
    const attempts = reason === 'failed_daily_recovery_attempt_running'
      ? [{ status: 'running', completed_at: null }]
      : endedFailureAttempt;
    assert.equal(failedDailyRecoveryDecision(failedRecoveryJob(overrides), attempts).reason, reason);
  }
  assert.equal(
    failedDailyRecoveryDecision(failedRecoveryJob({ recoveryCount: 1 }), endedFailureAttempt).reason,
    'failed_daily_recovery_already_used',
  );
});

test('definitief failed job met verbruikte recovery is exact één keer supersede-eligible', () => {
  assert.deepEqual(
    failedDailySupersedeDecision(failedSupersedeJob(), endedFailureAttempt),
    { allowed: true, reason: 'failed_daily_supersede_eligible' },
  );
});

test('verse supersede weigert running, retry, lock, ongebruikte recovery en bestaande opvolger', () => {
  const cases = [
    [{ status: 'running' }, 'failed_daily_supersede_status_not_eligible'],
    [{ status: 'retry_scheduled' }, 'failed_daily_supersede_status_not_eligible'],
    [{ lockExpiresAt: '2026-10-05T10:00:00.000Z' }, 'failed_daily_supersede_lock_present'],
    [{ recoveryCount: 0 }, 'failed_daily_supersede_recovery_not_consumed'],
    [{ supersededByJobId: 'daily-successor-1' }, 'failed_daily_supersede_successor_exists'],
    [{ nextRetryAt: '2026-10-05T12:00:00.000Z' }, 'failed_daily_supersede_retry_scheduled'],
  ];
  for (const [overrides, reason] of cases) {
    assert.equal(failedDailySupersedeDecision(failedSupersedeJob(overrides), endedFailureAttempt).reason, reason);
  }
  assert.equal(
    failedDailySupersedeDecision(failedSupersedeJob(), [{
      status: 'running', completed_at: null,
    }]).reason,
    'failed_daily_supersede_attempt_running',
  );
  assert.equal(
    failedDailySupersedeDecision(failedSupersedeJob(), [{
      status: 'retryable_failure', completed_at: '2026-10-05T08:05:00.000Z',
    }]).reason,
    'failed_daily_supersede_previous_attempt_open',
  );
});

test('failed daily recovery claim is explicit, single-use and does not reset state', async () => {
  const harness = createHarness([{ new: 400 }]);
  harness.state.status = 'failed_requires_attention';
  harness.state.updatedAt = '2026-09-17T08:05:00.000Z';
  harness.state.recoveryCount = 0;
  harness.dependencies.fetchJob = async () => ({ ...harness.state, recoveryCount: harness.state.recoveryCount });
  harness.dependencies.fetchAttempts = async () => endedFailureAttempt;
  let recoveryCalls = 0;
  harness.dependencies.recover = async (_config, input) => {
    recoveryCalls += 1;
    assert.equal(input.job.newProductsCollected, 0);
    assert.equal(input.job.remainingTarget, 400);
    harness.state.recoveryCount = 1;
    harness.state.status = 'running';
    harness.state.attemptCount = 2;
    return {
      claimed: true, recovered: true, recoveryId: 'recovery-1',
      attemptId: 'attempt-2', lockToken: 'lock-2', job: { ...harness.state },
    };
  };
  const result = await runFailedDailyRecovery({ ...config, dailyRecoveryReason: 'software_fix_verified' }, logger, harness.dependencies);
  assert.equal(result.job.newProductsCollected, 400);
  assert.equal(result.job.targetNewProducts, 400);
  assert.equal(recoveryCalls, 1);

  harness.state.status = 'failed_requires_attention';
  await assert.rejects(
    runFailedDailyRecovery({ ...config, dailyRecoveryReason: 'software_fix_verified' }, logger, harness.dependencies),
    /failed_daily_recovery_already_used/,
  );
  assert.equal(recoveryCalls, 1);
});

test('maintenance supersede krijgt een nieuwe dailyImportId en start normale attempt #1', async () => {
  const h = createHarness([{ new: 400 }]);
  h.state.status = 'failed_requires_attention';
  h.state.recoveryCount = 1;
  h.state.updatedAt = '2026-09-17T08:05:00.000Z';
  h.dependencies.fetchJob = async () => ({ ...h.state, recoveryCount: 1 });
  h.dependencies.fetchAttempts = async () => endedFailureAttempt;
  let supersedeCalls = 0;
  h.dependencies.supersede = async (_config, input) => {
    supersedeCalls += 1;
    assert.equal(input.job.id, 'daily-job-1');
    assert.equal(input.job.status, 'failed_requires_attention');
    assert.equal(input.job.recoveryCount, 1);
    assert.equal(input.supersedeReason, 'software_fix_verified');
    assert.equal(input.actorContext, 'github_actions:test:123:abc');
    h.state.id = 'daily-job-2';
    h.state.status = 'running';
    h.state.attemptCount = 1;
    h.state.recoveryCount = 0;
    return {
      claimed: true, superseded: true, supersedeId: 'supersede-1',
      previousDailyImportId: 'daily-job-1', attemptId: 'attempt-1',
      lockToken: 'lock-1', job: { ...h.state },
    };
  };
  const result = await runFreshDailySupersede({
    ...config,
    dailySupersedeReason: 'software_fix_verified',
    dailySupersedeActorContext: 'github_actions:test:123:abc',
  }, logger, h.dependencies);
  assert.equal(result.job.id, 'daily-job-2');
  assert.equal(result.job.targetNewProducts, 400);
  assert.equal(result.job.newProductsCollected, 400);
  assert.equal(result.job.remainingTarget, 0);
  assert.equal(supersedeCalls, 1);
});

test('challenge after 100 preserves remaining, releases via finish and schedules bounded 15/30/60 cooldowns', async () => {
  for (const [previous, minutes] of [[0,15], [1,30], [2,60], [3,null]]) {
    const error = Object.assign(new Error('source challenge'), { code: 'source_challenge', actualGrowth: 0 });
    const h = createHarness([error], { initialNew: 100 });
    h.dependencies.fetchAttempts = async () => Array.from({ length: previous }, () => ({ error_code: 'source_challenge' }));
    await assert.rejects(runDailyCatalogAttempt({ ...config, dailySingleAttempt: true }, logger, h.dependencies), error);
    assert.equal(h.state.newProductsCollected, 100); assert.equal(h.state.remainingTarget, 300);
    assert.equal(h.attempts.length, 1); assert.ok(h.attempts[0].lockToken);
    assert.equal(h.state.status, minutes ? 'retry_scheduled' : 'daily_target_partial');
    assert.equal(h.state.nextRetryAt, minutes ? new Date(Date.parse('2026-09-17T08:00Z') + minutes * 60000).toISOString() : null);
  }
});

test('challenge recovery attempt receives only remaining 300 and cannot budget an additional 400', async () => {
  const h = createHarness([{ new: 300 }], { initialNew: 100 });
  const run = h.dependencies.runGrowth;
  h.dependencies.runGrowth = async c => { assert.equal(c.maxNewProducts, 300); return run(c); };
  const result = await runDailyCatalogAttempt(config, logger, h.dependencies);
  assert.equal(result.job.newProductsCollected, 400); assert.equal(result.job.remainingTarget, 0);
});

function createHarness(growthSequence, {
  initialNew = 0,
  target = 400,
  date = "2026-09-17",
  times = [],
} = {}) {
  const state = {
    id: "daily-job-1",
    stateKey: config.dailyImportStateKey,
    jobDate: date,
    timezone: "Europe/Amsterdam",
    targetNewProducts: target,
    newProductsCollected: initialNew,
    remainingTarget: target - initialNew,
    status: "pending",
    attemptCount: 0,
    startedAt: "2026-09-17T04:00:00.000Z",
    lastAttemptAt: null,
    nextRetryAt: null,
    completedAt: null,
    lastPublicMessage: null,
  };
  const attempts = [];
  let growthIndex = 0;
  let timeIndex = 0;
  return {
    state,
    attempts,
    dependencies: {
      now: () => times[timeIndex++] ?? new Date("2026-09-17T08:00:00.000Z"),
      hasProductTypeColumn: async () => true,
      fetchAttempts: async () => [],
      claim: async () => {
        if (state.status === "running") {
          return { claimed: false, reason: "attempt_running", job: { ...state } };
        }
        state.status = "running";
        state.attemptCount += 1;
        state.nextRetryAt = null;
        return {
          claimed: true,
          reason: "claimed",
          attemptId: `attempt-${state.attemptCount}`,
          lockToken: `lock-${state.attemptCount}`,
          job: { ...state },
        };
      },
      runGrowth: async () => {
        const entry = growthSequence[growthIndex++];
        if (entry instanceof Error) throw entry;
        return {
          actualGrowth: entry.new ?? 0,
          candidatesViewed: entry.candidates ?? 0,
          updatedCount: entry.updated ?? 0,
          unchangedCount: entry.unchanged ?? 0,
          skippedCount: entry.skipped ?? 0,
          searchErrors: entry.sourceErrors ?? 0,
          sourceExhausted: entry.sourceExhausted ?? false,
          stopReason: entry.stopReason,
          resumeCheckpoint: entry.resumeCheckpoint,
        };
      },
      finish: async (_config, input) => {
        state.newProductsCollected = Math.min(
          state.targetNewProducts,
          state.newProductsCollected + input.counts.new,
        );
        state.remainingTarget = state.targetNewProducts - state.newProductsCollected;
        state.nextRetryAt = input.nextRetryAt?.toISOString?.() ?? input.nextRetryAt ?? null;
        if (state.remainingTarget === 0) state.status = "target_reached";
        else if (input.outcome === "non_retryable_failure") state.status = "failed_requires_attention";
        else if (input.outcome === "daily_target_partial") state.status = "daily_target_partial";
        else state.status = "retry_scheduled";
        attempts.push({ ...input, resultingStatus: state.status });
        return { ...state };
      },
    },
  };
}

test("400 nieuwe producten in de eerste poging stopt de dagjob", async () => {
  const harness = createHarness([{ new: 400, candidates: 800 }]);
  const result = await runDailyCatalogAttempt(config, logger, harness.dependencies);
  assert.equal(result.job.newProductsCollected, 400);
  assert.equal(result.job.remainingTarget, 0);
  assert.equal(result.job.status, "target_reached");
  assert.equal(result.job.nextRetryAt, null);
});

test("137 nieuwe producten blijven bewaard en een retry vervolgt het resterende doel", async () => {
  const harness = createHarness([{ new: 137 }, { new: 263 }]);
  const first = await runDailyCatalogAttempt(config, logger, harness.dependencies);
  assert.equal(first.job.newProductsCollected, 137);
  assert.equal(first.job.remainingTarget, 263);
  assert.equal(first.job.status, "retry_scheduled");
  const second = await runDailyCatalogAttempt(config, logger, harness.dependencies);
  assert.equal(second.job.newProductsCollected, 400);
  assert.equal(second.job.status, "target_reached");
});

test("kleine gecontroleerde target-10 test hervat 4 + 6 zonder opnieuw te beginnen", async () => {
  const harness = createHarness([{ new: 4 }, { new: 6 }], { target: 10 });
  const testConfig = { ...config, dailyTargetNewProducts: 10, maxProducts: 10 };
  const first = await runDailyCatalogAttempt(testConfig, logger, harness.dependencies);
  const second = await runDailyCatalogAttempt(testConfig, logger, harness.dependencies);
  assert.deepEqual(
    [first.job.newProductsCollected, second.job.newProductsCollected],
    [4, 10],
  );
  assert.equal(second.job.status, "target_reached");
  assert.equal(harness.attempts.length, 2);
});

test("meerdere attempts tellen alleen werkelijke databasegroei en eindigen exact op 400", async () => {
  const harness = createHarness([
    { new: 137, updated: 80, unchanged: 120 },
    { new: 91, updated: 50, unchanged: 200 },
    { new: 172, updated: 30, unchanged: 300 },
  ]);
  await runDailyCatalogAttempt(config, logger, harness.dependencies);
  await runDailyCatalogAttempt(config, logger, harness.dependencies);
  const result = await runDailyCatalogAttempt(config, logger, harness.dependencies);
  assert.equal(result.job.newProductsCollected, 400);
  assert.deepEqual(harness.attempts.map((attempt) => attempt.counts.new), [137, 91, 172]);
});

test("bekend, duplicate, updated, unchanged en invalid tellen niet als nieuw", async () => {
  const harness = createHarness([{
    new: 0, candidates: 900, updated: 300, unchanged: 400, skipped: 200,
  }]);
  const result = await runDailyCatalogAttempt(config, logger, harness.dependencies);
  assert.equal(result.job.newProductsCollected, 0);
  assert.equal(harness.attempts[0].counts.updated, 300);
  assert.equal(harness.attempts[0].counts.unchanged, 400);
  assert.equal(harness.attempts[0].counts.skipped, 200);
});

test("tijdelijke bronuitval bewaart gedeeltelijke groei en plant een retry", async () => {
  const sourceError = Object.assign(new Error("Bron tijdelijk zonder productdata"), {
    code: "source_unavailable",
    actualGrowth: 137,
    catalogAttemptMetrics: { candidatesViewed: 240, sourceErrors: 3 },
  });
  const harness = createHarness([sourceError]);
  await assert.rejects(runDailyCatalogAttempt(config, logger, harness.dependencies), /Bron tijdelijk/);
  assert.equal(harness.state.newProductsCollected, 137);
  assert.equal(harness.state.status, "retry_scheduled");
  assert.equal(harness.attempts[0].outcome, "retryable_failure");
  assert.equal(harness.attempts[0].retryReason, "source_unavailable");
});

test("een inspectiefout is geen normale skip", async () => {
  await assert.rejects(
    inspectDailyCatalogAttempt(config, new Date("2026-09-17T13:17:00Z"), {
      fetchJob: async () => { throw new Error("Dagstatus onbereikbaar"); },
    }),
    /Dagstatus onbereikbaar/,
  );
});

test("back-off wacht minstens twee uur en groeit gecontroleerd tot vier uur", () => {
  assert.deepEqual([1, 2, 3, 4, 9].map(dailyRetryDelayMinutes), [120, 180, 240, 240, 240]);
  assert.equal(
    dailyRetryAt(2, new Date("2026-09-17T08:00:00Z")).toISOString(),
    "2026-09-17T11:00:00.000Z",
  );
});

test("inspecteren houdt target, cooldown en actieve lange poging als normale skips", async () => {
  const now = new Date("2026-09-17T13:17:00Z");
  const base = { newProductsCollected: 61, targetNewProducts: 400, status: "retry_scheduled" };
  async function decision(job) {
    return inspectDailyCatalogAttempt(config, now, { fetchJob: async () => job });
  }
  assert.equal((await decision({ ...base, newProductsCollected: 400 })).reason, "target_reached");
  assert.equal((await decision({ ...base, nextRetryAt: "2026-09-17T14:00:00Z" })).reason, "retry_not_due");
  assert.equal((await decision({ ...base, status: "running" })).reason, "attempt_running");
  assert.deepEqual(
    { run: (await decision({ ...base, nextRetryAt: "2026-09-17T13:00:00Z" })).run },
    { run: true },
  );
});

test("nieuwe Amsterdamse dag start eigen job, oude onvolledige dag blokkeert niet", async () => {
  const now = new Date("2026-09-18T07:17:00Z");
  const requested = [];
  const result = await inspectDailyCatalogAttempt(config, now, {
    fetchJob: async (_config, query) => {
      requested.push(query.jobDate);
      return null;
    },
  });
  assert.deepEqual(requested, ["2026-09-18"]);
  assert.equal(result.reason, "daily_job_missing");
  assert.equal(result.run, true);
});

test("watchdog maakt ontbrekende dagjob via normale claim aan en tweede trigger is een no-op", async () => {
  let currentJob = null;
  let attempts = 0;
  const result = await runDailyCatalogAttempt({ ...config, dailyEndHour: 23 }, logger, {
    now: () => new Date("2026-10-06T04:17:00Z"),
    fetchAttempts: async () => [],
    hasProductTypeColumn: async () => true,
    claim: async (_config, input) => {
      attempts += 1;
      if (currentJob) return { claimed: false, reason: "target_reached", job: currentJob };
      currentJob = {
        id: "watchdog-daily-job", stateKey: input.stateKey, jobDate: input.jobDate,
        targetNewProducts: 400, newProductsCollected: 0, remainingTarget: 400,
        status: "running", attemptCount: 1, nextRetryAt: null,
      };
      return { claimed: true, reason: "claimed", attemptId: "watchdog-attempt-1", lockToken: "watchdog-lock-1", job: currentJob };
    },
    runGrowth: async () => ({ actualGrowth: 400, candidatesViewed: 400, sourceExhausted: false }),
    finish: async (_config, input) => ({ ...currentJob, newProductsCollected: 400, remainingTarget: 0, status: "target_reached", attemptCount: 1, nextRetryAt: null }),
  });
  assert.equal(result.attempted, true);
  assert.equal(result.job.targetNewProducts, 400);
  assert.equal(result.job.newProductsCollected, 400);
  assert.equal(result.job.status, "target_reached");
  const second = await runDailyCatalogAttempt({ ...config, dailyEndHour: 23 }, logger, {
    now: () => new Date("2026-10-06T05:17:00Z"),
    fetchJob: async () => currentJob,
    claim: async () => ({ claimed: false, reason: "target_reached", job: currentJob }),
  });
  assert.equal(second.attempted, false);
  assert.equal(second.reason, "target_reached");
  assert.equal(attempts, 1);
});

test("een lopende attempt en een dubbele retrytrigger worden geweigerd", () => {
  const running = {
    status: "running", newProductsCollected: 137, targetNewProducts: 400,
  };
  assert.deepEqual(
    shouldRunDailyImport(running, new Date("2026-09-17T08:00:00Z")),
    { run: false, reason: "attempt_running" },
  );
  const futureRetry = {
    ...running, status: "retry_scheduled", nextRetryAt: "2026-09-17T08:10:00Z",
  };
  assert.deepEqual(
    shouldRunDailyImport(futureRetry, new Date("2026-09-17T08:00:00Z")),
    { run: false, reason: "retry_not_due" },
  );
});

test("non-retryable configuratiefout stopt automatische retries en vraagt aandacht", async () => {
  const harness = createHarness([new Error("SUPABASE_SECRET_KEY ontbreekt.")]);
  await assert.rejects(
    runDailyCatalogAttempt(config, logger, harness.dependencies),
    /SUPABASE_SECRET_KEY ontbreekt/,
  );
  assert.equal(harness.state.status, "failed_requires_attention");
  assert.equal(harness.attempts[0].nextRetryAt, null);
  assert.equal(classifyDailyImportError(new Error("schema ontbreekt")).retryable, false);
});

test("root- en categoriebronfouten blijven expliciete retrybare bronstatussen", () => {
  for (const code of ["root_category_discovery_failed", "category_structure_changed"]) {
    assert.equal(classifyDailyImportError({ code }).retryable, true, code);
    assert.equal(classifyDailyImportError({ code }).code, code);
  }
});

test("23:00 Europe/Amsterdam sluit veilig af als partial zonder rollback", async () => {
  const harness = createHarness([{ new: 327 }], {
    times: [
      new Date("2026-09-17T20:50:00Z"), // 22:50 CEST
      new Date("2026-09-17T21:05:00Z"), // 23:05 CEST
    ],
  });
  const result = await runDailyCatalogAttempt(config, logger, harness.dependencies);
  assert.equal(result.job.newProductsCollected, 327);
  assert.equal(result.job.status, "daily_target_partial");
  assert.equal(result.job.nextRetryAt, null);
});

test("een nieuwe Amsterdamse kalenderdag krijgt een nieuw dagdoel zonder DST-fout", () => {
  assert.equal(amsterdamDateKey(new Date("2026-03-28T23:30:00Z")), "2026-03-29");
  assert.equal(amsterdamDateKey(new Date("2026-10-24T22:30:00Z")), "2026-10-25");
  assert.equal(isDailyImportWindowOpen(new Date("2026-03-29T04:00:00Z")), true);
  assert.equal(isDailyImportWindowOpen(new Date("2026-10-25T05:00:00Z")), true);
});

test("08:30-bewaking accepteert running, paused, success en partial maar niet attention", () => {
  const base = {
    id: "daily-1", targetNewProducts: 400, newProductsCollected: 228,
  };
  assert.equal(evaluateDailyCatalogMonitor({ ...base, status: "running" }).state, "running");
  assert.equal(evaluateDailyCatalogMonitor({ ...base, status: "retry_scheduled" }).state, "retry_scheduled");
  assert.equal(evaluateDailyCatalogMonitor({ ...base, status: "target_reached", newProductsCollected: 400 }).state, "healthy");
  assert.equal(evaluateDailyCatalogMonitor({ ...base, status: "daily_target_partial" }).state, "daily_target_partial");
  assert.equal(evaluateDailyCatalogMonitor({ ...base, status: "failed_requires_attention" }).ok, false);
  assert.equal(evaluateDailyCatalogMonitor(null).state, "missing");
});

test("dagjobmigratie is additief, server-locked en browser read-only", async () => {
  const migration = await readFile(
    new URL("../supabase/migrations/20260917092809_self_healing_daily_catalog_growth.sql", import.meta.url),
    "utf8",
  );
  const recoveryMigration = await readFile(
    new URL("../supabase/migrations/20261005220000_recover_failed_daily_catalog_growth.sql", import.meta.url),
    "utf8",
  );
  const supersedeMigration = await readFile(
    new URL("../supabase/migrations/20261005230000_supersede_failed_daily_catalog_job.sql", import.meta.url),
    "utf8",
  );
  const allMigrations = `${migration}\n${recoveryMigration}\n${supersedeMigration}`;
  assert.match(migration, /create table if not exists public\.catalog_daily_jobs/i);
  assert.match(migration, /create table if not exists public\.catalog_daily_attempts/i);
  assert.match(migration, /claim_catalog_daily_attempt/i);
  assert.match(allMigrations, /recover_catalog_daily_attempt/i);
  assert.match(allMigrations, /catalog_daily_recoveries/i);
  assert.match(allMigrations, /recovery_count between 0 and 1/i);
  assert.match(allMigrations, /p_expected_updated_at/i);
  assert.match(allMigrations, /original_failure_reason/i);
  assert.match(allMigrations, /new_attempt_id/i);
  assert.match(supersedeMigration, /supersede_failed_catalog_daily_job/i);
  assert.match(supersedeMigration, /catalog_daily_supersedes_day_once_idx/i);
  assert.match(supersedeMigration, /catalog_daily_jobs_current_day_idx/i);
  assert.match(supersedeMigration, /supersede_reason in \('software_fix_verified', 'importer_updated'\)/i);
  assert.match(supersedeMigration, /superseded_at/i);
  assert.match(supersedeMigration, /p_expected_recovery_count/i);
  assert.match(supersedeMigration, /p_actor_context/i);
  assert.match(migration, /for update/i);
  assert.match(migration, /catalog_daily_jobs_single_running_idx/i);
  assert.match(migration, /grant select on public\.catalog_daily_jobs to anon, authenticated/i);
  assert.match(migration, /revoke all on public\.catalog_daily_attempts from anon, authenticated/i);
  assert.doesNotMatch(migration, /drop\s+(table|column)|delete\s+from|truncate/i);
  assert.doesNotMatch(supersedeMigration, /delete\s+from|truncate/i);
  assert.doesNotMatch(supersedeMigration, /public\.(products|product_prices|catalog_discovery_state)\b/i);
});

test("daily job-RPC's gebruiken typed claims en locktokens", async () => {
  assert.equal(
    rpcURL("https://voorbeeld.supabase.co", "claim_catalog_daily_attempt").href,
    "https://voorbeeld.supabase.co/rest/v1/rpc/claim_catalog_daily_attempt",
  );
  const originalFetch = globalThis.fetch;
  const requests = [];
  globalThis.fetch = async (url, options) => {
    requests.push({ url: String(url), body: JSON.parse(options.body) });
    if (String(url).endsWith("claim_catalog_daily_attempt")) {
      return new Response(JSON.stringify({
        claimed: true,
        reason: "claimed",
        attemptId: "attempt-1",
        lockToken: "lock-1",
        job: {
          id: "daily-1", state_key: "test", job_date: "2026-09-17",
          timezone: "Europe/Amsterdam", target_new_products: 10,
          new_products_collected: 4, status: "running", attempt_count: 2,
          started_at: "2026-09-17T04:00:00Z",
        },
      }), { status: 200 });
    }
    return new Response(JSON.stringify({
      id: "daily-1", state_key: "test", job_date: "2026-09-17",
      timezone: "Europe/Amsterdam", target_new_products: 10,
      new_products_collected: 10, status: "target_reached", attempt_count: 2,
      started_at: "2026-09-17T04:00:00Z",
    }), { status: 200 });
  };
  const dbConfig = {
    supabaseURL: "https://voorbeeld.supabase.co",
    supabaseSecret: "secret",
  };
  try {
    const claim = await claimCatalogDailyAttempt(dbConfig, {
      stateKey: "test", jobDate: "2026-09-17", targetNewProducts: 10,
      now: new Date("2026-09-17T04:00:00Z"),
    });
    assert.equal(claim.claimed, true);
    assert.equal(claim.job.remainingTarget, 6);
    const finished = await finishCatalogDailyAttempt(dbConfig, {
      jobID: claim.job.id, attemptID: claim.attemptId, lockToken: claim.lockToken,
      outcome: "succeeded",
      counts: { candidates: 12, new: 6, updated: 0, unchanged: 0, skipped: 0, invalid: 0, sourceErrors: 0 },
      now: new Date("2026-09-17T04:05:00Z"),
    });
    assert.equal(finished.status, "target_reached");
    assert.equal(finished.newProductsCollected, 10);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(requests.length, 2);
  assert.equal(requests[0].body.p_target_new_products, 10);
  assert.equal(requests[1].body.p_lock_token, "lock-1");
});

test('daily recovery RPC krijgt expected state/CAS en maakt geen directe status-edit', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      claimed: true, recovered: true, reason: 'recovered_and_claimed',
      recoveryId: 'recovery-1', attemptId: 'attempt-2', lockToken: 'lock-2',
      job: {
        id: 'daily-recovery-1', state_key: 'daily-catalog-growth-test', job_date: '2026-09-17',
        timezone: 'Europe/Amsterdam', target_new_products: 400,
        new_products_collected: 137, status: 'running', attempt_count: 2,
        recovery_count: 1, updated_at: '2026-09-17T08:10:00.000Z',
      },
    }), { status: 200 });
  };
  try {
    const result = await recoverCatalogDailyAttempt({
      supabaseURL: 'https://voorbeeld.supabase.co', supabaseSecret: 'secret',
    }, {
      job: failedRecoveryJob({
        id: 'daily-recovery-1', newProductsCollected: 137, remainingTarget: 263,
        updatedAt: '2026-09-17T08:05:00.000Z',
      }),
      recoveryReason: 'software_fix_verified',
      now: new Date('2026-09-17T08:10:00.000Z'),
    });
    assert.equal(result.recovered, true);
    assert.equal(result.job.newProductsCollected, 137);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(request.url, 'https://voorbeeld.supabase.co/rest/v1/rpc/recover_catalog_daily_attempt');
  assert.equal(request.body.p_expected_status, 'failed_requires_attention');
  assert.equal(request.body.p_expected_updated_at, '2026-09-17T08:05:00.000Z');
  assert.equal(request.body.p_expected_attempt_count, 1);
  assert.equal(request.body.p_expected_new_products_collected, 137);
  assert.equal(request.body.p_expected_remaining_target, 263);
  assert.equal(request.body.p_recovery_reason, 'software_fix_verified');
});

test('daily supersede RPC krijgt volledige expected state en actorcontext', async () => {
  const originalFetch = globalThis.fetch;
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: String(url), body: JSON.parse(options.body) };
    return new Response(JSON.stringify({
      claimed: true, superseded: true, reason: 'superseded_and_claimed',
      supersedeId: 'supersede-1', previousDailyImportId: 'daily-recovery-1',
      attemptId: 'attempt-1', lockToken: 'lock-1',
      job: {
        id: 'daily-fresh-1', state_key: 'daily-catalog-growth-test', job_date: '2026-09-17',
        timezone: 'Europe/Amsterdam', target_new_products: 400,
        new_products_collected: 0, status: 'running', attempt_count: 1,
        recovery_count: 0, updated_at: '2026-09-17T08:10:00.000Z',
      },
    }), { status: 200 });
  };
  try {
    const result = await supersedeFailedCatalogDailyJob({
      supabaseURL: 'https://voorbeeld.supabase.co', supabaseSecret: 'secret',
    }, {
      job: failedSupersedeJob({ id: 'daily-recovery-1', updatedAt: '2026-09-17T08:05:00.000Z' }),
      supersedeReason: 'software_fix_verified',
      actorContext: 'github_actions:test:123:abc',
      now: new Date('2026-09-17T08:10:00.000Z'),
    });
    assert.equal(result.superseded, true);
    assert.equal(result.job.id, 'daily-fresh-1');
    assert.equal(result.job.targetNewProducts, 400);
    assert.equal(result.job.newProductsCollected, 0);
    assert.equal(result.job.remainingTarget, 400);
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(request.url, 'https://voorbeeld.supabase.co/rest/v1/rpc/supersede_failed_catalog_daily_job');
  assert.equal(request.body.p_expected_status, 'failed_requires_attention');
  assert.equal(request.body.p_expected_attempt_count, 1);
  assert.equal(request.body.p_expected_new_products_collected, 0);
  assert.equal(request.body.p_expected_remaining_target, 400);
  assert.equal(request.body.p_expected_recovery_count, 1);
  assert.equal(request.body.p_supersede_reason, 'software_fix_verified');
  assert.equal(request.body.p_actor_context, 'github_actions:test:123:abc');
});

test("Actions heeft uurlijkse retryvensters, één lockgroep en geen urenlange sleep", async () => {
  const [initial, retry, monitor] = await Promise.all([
    readFile(new URL("../.github/workflows/import-hoogvliet-poc.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/retry-daily-catalog-import.yml", import.meta.url), "utf8"),
    readFile(new URL("../.github/workflows/monitor-catalog-import.yml", import.meta.url), "utf8"),
  ]);
  assert.match(initial, /npm run import:daily/);
  assert.match(initial, /group: hoogvliet-supabase-update/);
  assert.match(retry, /cron: "17 4-20 \* \* \*"/);
  assert.doesNotMatch(retry, /\*\/10/);
  assert.match(retry, /npm run --silent inspect:daily/);
  assert.match(retry, /group: hoogvliet-supabase-update/);
  assert.match(retry, /cancel-in-progress: false/);
  assert.match(retry, /if: steps\.due\.outputs\.run_attempt == '1'/);
  assert.doesNotMatch(retry, /continue-on-error: true/);
  assert.doesNotMatch(retry, /\bsleep\s+[1-9]\d{2,}/i);
  assert.match(monitor, /ontbrekende, partiële of mislukte run blijft zichtbaar/i);
});


test("bewezen zoekroute-uitputting onder 400 sluit de dag zonder verdere retries", async () => {
  const h = createHarness([{ new: 327, sourceExhausted: true, stopReason: "discovery_exhausted" }]);
  const result = await runDailyCatalogAttempt(config, logger, h.dependencies);
  assert.equal(result.job.newProductsCollected, 327);
  assert.equal(result.job.status, "daily_target_partial");
  assert.equal(result.job.nextRetryAt, null);
  assert.equal(h.attempts[0].retryReason, "discovery_exhausted");
  assert.equal(shouldRunDailyImport(result.job, new Date("2026-09-17T15:00:00Z")).run, false);
});

test("paginaveiligheidsgrens is geen bronuitputting: bewaar expliciete vervolgreden", async () => {
  const h = createHarness(Array.from({ length: 8 }, (_, i) => ({ new: 10, stopReason: "page_safety_limit", resumeCheckpoint: { term: "rijst", page: (i + 1) * 800 } })));
  const result = await runDailyCatalogAttempt(config, logger, h.dependencies);
  assert.equal(result.job.status, "retry_scheduled");
  assert.equal(h.attempts[0].retryReason, "attempt_safety_limit");
  assert.equal(result.job.nextRetryAt, "2026-09-17T10:00:00.000Z");
});

test("twee gelijktijdige dagtriggers starten maar één collector", async () => {
  const h = createHarness([{ new: 400 }]);
  const results = await Promise.all([runDailyCatalogAttempt(config, logger, h.dependencies), runDailyCatalogAttempt(config, logger, h.dependencies)]);
  assert.equal(results.filter(x => x.attempted).length, 1);
  assert.equal(h.attempts.length, 1);
});

test('eenmalige dagpoging respecteert restant en sluit zonder vervolgretry', async () => {
  const h = createHarness([{ new: 7, stopReason: 'runtime_safety_limit' }], { initialNew: 390 });
  const run = h.dependencies.runGrowth;
  h.dependencies.runGrowth = async c => { assert.equal(c.maxNewProducts, 10); return run(c); };
  const result = await runDailyCatalogAttempt({ ...config, dailySingleAttempt: true }, logger, h.dependencies);
  assert.equal(result.job.newProductsCollected, 397);
  assert.equal(result.job.status, 'daily_target_partial');
  assert.equal(result.job.nextRetryAt, null);
  assert.equal(h.attempts.length, 1);
  assert.equal(shouldRunDailyImport(result.job, new Date('2026-09-17T10:00:00Z')).run, false);
});

test('eenmalige dagpoging plant ook na tijdelijke storing geen vervolgrun', async () => {
  const error = Object.assign(new Error('tijdelijke bronuitval'), { code: 'source_unavailable' });
  const h = createHarness([error]);
  await assert.rejects(runDailyCatalogAttempt({ ...config, dailySingleAttempt: true }, logger, h.dependencies), error);
  assert.equal(h.state.status, 'daily_target_partial');
  assert.equal(h.state.nextRetryAt, null);
  assert.equal(h.attempts.length, 1);
});

test('all usable routes visited with a stalled term ends in attention without an automatic retry', async () => {
  const h = createHarness([{ new: 10, sourceErrors: 1, sourceExhausted: false,
    stopReason: 'discovery_incomplete_stalled_terms' }]);
  const result = await runDailyCatalogAttempt(config, logger, h.dependencies);
  assert.equal(result.job.status, 'failed_requires_attention');
  assert.equal(result.job.nextRetryAt, null);
  assert.equal(result.job.remainingTarget, 390);
  assert.equal(h.attempts[0].errorCode, 'discovery_incomplete_stalled_terms');
});
