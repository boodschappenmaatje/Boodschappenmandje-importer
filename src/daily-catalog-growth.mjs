import { appendFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

import { loadConfig } from "./config.mjs";
import { runResumableCatalogGrowth } from "./resumable-catalog-growth.mjs";
import { inspectAcceptanceSnapshot, verifyDailyAcceptance } from "./daily-acceptance-gate.mjs";
import { sourceChallengeRetryAt, challengeRecoveryDecision } from './source-challenge-policy.mjs';
import { verifyNormalSourceAccess } from './hoogvliet.mjs';
import {
  claimCatalogDailyAttempt,
  fetchCatalogDailyJob,
  finishCatalogDailyAttempt,
  hasProductTypeColumn,
  fetchCatalogAcceptanceSnapshot,
  fetchCatalogDailyAttempts,
  recoverCatalogDailyAttempt,
  requeueSourceChallenge,
} from "./supabase.mjs";

export const DAILY_IMPORT_TIMEZONE = "Europe/Amsterdam";
export const DAILY_IMPORT_START_HOUR = 6;
export const DAILY_IMPORT_END_HOUR = 23;

const RETRYABLE_CODES = new Set([
  "source_challenge",
  "source_unavailable",
  "parser_structure_changed",
  "navigation_error",
  "ETIMEDOUT",
  "ECONNRESET",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ENOTFOUND",
]);

function integer(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function amsterdamParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: DAILY_IMPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  return Object.fromEntries(parts.map(({ type, value }) => [type, value]));
}

export function amsterdamDateKey(now = new Date()) {
  const parts = amsterdamParts(now);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function amsterdamHour(now = new Date()) {
  return Number.parseInt(amsterdamParts(now).hour, 10);
}

export function isDailyImportWindowOpen(now = new Date(), {
  startHour = DAILY_IMPORT_START_HOUR,
  endHour = DAILY_IMPORT_END_HOUR,
} = {}) {
  const hour = amsterdamHour(now);
  return hour >= startHour && hour < endHour;
}

export function dailyRetryDelayMinutes(attemptNumber) {
  const attempt = Math.max(1, Math.trunc(Number(attemptNumber) || 1));
  if (attempt === 1) return 120;
  if (attempt === 2) return 180;
  return 240;
}

export function dailyRetryAt(attemptNumber, now = new Date()) {
  return new Date(now.getTime() + dailyRetryDelayMinutes(attemptNumber) * 60_000);
}

export function classifyDailyImportError(error) {
  const code = typeof error?.code === "string" ? error.code : null;
  const status = Number(error?.status);
  const message = `${error?.name ?? ""} ${error?.message ?? ""}`.toUpperCase();
  const retryable = error?.retryable === true
    || RETRYABLE_CODES.has(code)
    || [408, 425, 429, 500, 502, 503, 504].includes(status)
    || /TIMEOUT|TIMEDOUT|ERR_ABORTED|NAVIGATION.*FAILED|FRAME.*DETACHED|CONNECTION.*RESET/.test(message);
  return {
    retryable,
    code: code ?? (retryable ? "transient_import_error" : "non_retryable_import_error"),
    summary: error instanceof Error ? error.message : "Onbekende importfout",
  };
}

export function shouldRunDailyImport(job, now = new Date(), options = {}) {
  if (!isDailyImportWindowOpen(now, options)) return { run: false, reason: "outside_daily_window" };
  if (!job) return { run: true, reason: "daily_job_missing" };
  if (job.newProductsCollected >= job.targetNewProducts || job.status === "target_reached") {
    return { run: false, reason: "target_reached" };
  }
  if (["daily_target_partial", "failed_requires_attention"].includes(job.status)) {
    return { run: false, reason: job.status };
  }
  if (job.status === "running") return { run: false, reason: "attempt_running" };
  if (job.status === "retry_scheduled" && job.nextRetryAt) {
    const retryAt = Date.parse(job.nextRetryAt);
    if (Number.isFinite(retryAt) && retryAt > now.getTime()) {
      return { run: false, reason: "retry_not_due" };
    }
  }
  return { run: true, reason: "attempt_due" };
}

export function failedDailyRecoveryDecision(job, attempts = []) {
  if (!job) return { allowed: false, reason: "failed_daily_recovery_requires_existing_day" };
  if (job.status !== "failed_requires_attention") {
    return { allowed: false, reason: "failed_daily_recovery_status_not_eligible" };
  }
  if (Number(job.recoveryCount ?? 0) !== 0) {
    return { allowed: false, reason: "failed_daily_recovery_already_used" };
  }
  if (job.targetNewProducts !== 400 || job.newProductsCollected >= job.targetNewProducts
      || job.remainingTarget <= 0) {
    return { allowed: false, reason: "failed_daily_recovery_target_not_remaining" };
  }
  if (job.lockExpiresAt != null) {
    return { allowed: false, reason: "failed_daily_recovery_lock_present" };
  }
  if (attempts.some(attempt => attempt.status === "running")) {
    return { allowed: false, reason: "failed_daily_recovery_attempt_running" };
  }
  const previous = attempts.at(-1);
  if (!previous || previous.status !== "non_retryable_failure" || !previous.completed_at) {
    return { allowed: false, reason: "failed_daily_recovery_previous_attempt_open" };
  }
  return { allowed: true, reason: "failed_daily_recovery_eligible" };
}

function resultCounts(result = {}) {
  return {
    accounting: result.accounting ?? null, segments: result.segments ?? [],
    stalledTerms: result.stalledTerms ?? [], plannerMaintenance: result.plannerMaintenance ?? null,
    irrelevant: integer(result.irrelevantCount),
    candidates: integer(result.candidatesViewed),
    new: integer(result.actualGrowth),
    updated: integer(result.updatedCount),
    unchanged: integer(result.unchangedCount),
    skipped: integer(result.skippedCount),
    invalid: integer(result.invalidCount ?? result.skippedCount),
    sourceErrors: integer(result.searchErrors) + integer(result.errorCount),
    existing: integer(result.existingCount), duplicates: integer(result.duplicateCount),
    uniqueCandidates: integer(result.uniqueCandidateCount ?? result.accounting?.uniqueRelevantSKUs),
    validNewCandidates: integer(result.validNewCandidateCount),
    total: result.totalUniqueProductsAfter ?? null, stopReason: result.stopReason ?? null,
  };
}

function errorCounts(error) {
  const metrics = error?.catalogAttemptMetrics ?? {};
  return {
    accounting: metrics.accounting ?? null, stalledTerms: metrics.stalledTerms ?? [], plannerMaintenance: metrics.plannerMaintenance ?? null,
    irrelevant: integer(metrics.irrelevantCount), total: metrics.totalUniqueProductsAfter ?? null,
    candidates: integer(metrics.candidatesViewed),
    new: integer(error?.actualGrowth),
    updated: integer(metrics.updatedCount),
    unchanged: integer(metrics.unchangedCount),
    skipped: integer(metrics.skippedCount),
    invalid: integer(metrics.invalidCount),
    sourceErrors: integer(metrics.sourceErrors || 1),
    existing: integer(metrics.existingCount), duplicates: integer(metrics.duplicateCount),
    uniqueCandidates: integer(metrics.uniqueCandidateCount ?? metrics.accounting?.uniqueRelevantSKUs),
    validNewCandidates: integer(metrics.validNewCandidateCount),
    stopReason: error?.code ?? "technical_failure",
  };
}

function publicPauseMessage() {
  return "Catalogusupdate tijdelijk gepauzeerd. De bestaande catalogus blijft beschikbaar.";
}

function publicAttentionMessage() {
  return "Catalogusupdate heeft aandacht nodig. De bestaande catalogus blijft beschikbaar.";
}

export function formatDailyAttemptSummary({
  job,
  counts,
  completedAt = null,
  nextRetryAt,
  retryReason = null,
}) {
  return [
    "Dagelijkse catalogusgroei",
    `dailyImportId=${job.id}`,
    `datum=${job.jobDate}`,
    `poging=${job.attemptCount}`,
    job.lastAttemptAt ? `gestart=${job.lastAttemptAt}` : null,
    completedAt ? `afgerond=${completedAt.toISOString()}` : null,
    `doel_nieuw=${job.targetNewProducts}`,
    `raw_paginahits=${counts.candidates}`,
    `unieke_kandidaten=${counts.uniqueCandidates}`,
    `discovery_segmenten=${counts.segments?.length ?? 0}`,
    counts.accounting ? `kandidaatboekhouding=${JSON.stringify(counts.accounting)}` : null,
    counts.stalledTerms?.length ? `gestalde_termen=${JSON.stringify(counts.stalledTerms)}` : null,
    counts.plannerMaintenance ? `planner_onderhoud=${JSON.stringify(counts.plannerMaintenance)}` : null,
    `bestaand=${counts.existing ?? 0}`,
    `duplicaten=${counts.duplicates ?? 0}`,
    `nieuwe_geldige_kandidaten=${counts.validNewCandidates}`,
    `stopreden=${counts.stopReason ?? retryReason ?? job.status}`,
    counts.total == null ? null : `totaal_na=${counts.total}`,
    `nieuw=${counts.new}`,
    `bijgewerkt=${counts.updated}`,
    `ongewijzigd=${counts.unchanged}`,
    `overgeslagen=${counts.skipped}`,
    `ongeldig=${counts.invalid}`,
    `bronfouten=${counts.sourceErrors}`,
    `cumulatief_nieuw=${job.newProductsCollected}/${job.targetNewProducts}`,
    `resterend=${job.remainingTarget}`,
    `status=${job.status}`,
    retryReason ? `retryreden=${retryReason}` : null,
    nextRetryAt ? `volgende_poging=${nextRetryAt.toISOString()}` : null,
  ].filter(Boolean).join(" | ");
}

function safeLogger(secret) {
  const redact = (value) => secret
    ? String(value).split(secret).join("[REDACTED]")
    : String(value);
  return {
    info: (value) => {
      const safe = redact(value); console.log(safe);
      if (process.env.GITHUB_STEP_SUMMARY && safe.startsWith("Dagelijkse catalogusgroei")) {
        appendFileSync(process.env.GITHUB_STEP_SUMMARY, `\n### Importresultaat\n\n${safe.split(" | ").join("\n\n")}\n`);
      }
    },
    error: (value) => console.error(redact(value)),
  };
}

export async function inspectDailyCatalogAttempt(config, now = new Date(), dependencies = {}) {
  const fetchJob = dependencies.fetchJob ?? fetchCatalogDailyJob;
  const jobDate = amsterdamDateKey(now);
  const job = await fetchJob(config, {
    stateKey: config.dailyImportStateKey,
    jobDate,
  });
  return {
    job,
    jobDate,
    ...shouldRunDailyImport(job, now, { endHour: config.dailyEndHour }),
  };
}

export async function runDailyCatalogAttempt(config, logger = console, dependencies = {}) {
  const now = dependencies.now?.() ?? new Date();
  const jobDate = amsterdamDateKey(now);
  if (!isDailyImportWindowOpen(now, { endHour: config.dailyEndHour })) {
    return { attempted: false, reason: "outside_daily_window", job: null };
  }

  const claim = dependencies.preclaimedClaim ?? await (dependencies.claim ?? claimCatalogDailyAttempt)(config, {
    stateKey: config.dailyImportStateKey,
    jobDate,
    targetNewProducts: config.dailyTargetNewProducts,
    now,
    lockTTLMinutes: 130,
  });
  if (!claim.claimed) {
    logger.info(`Dagelijkse catalogusgroei overgeslagen: ${claim.reason}.`);
    return { attempted: false, reason: claim.reason, job: claim.job };
  }

  if (!claim.attemptId || !claim.lockToken || claim.job.remainingTarget < 1) {
    throw new Error("Daily-attemptclaim mist een lock of resterend groeidoel.");
  }

  const finish = dependencies.finish ?? finishCatalogDailyAttempt;
  logger.info(
    `Daily import gestart: dailyImportId=${claim.job.id}, poging=${claim.job.attemptCount}, `
      + `voortgang=${claim.job.newProductsCollected}/${claim.job.targetNewProducts}, `
      + `resterend=${claim.job.remainingTarget}.`,
  );

  let result;
  let priorChallenges = null;
  let acceptanceEvidence = null;
  const acceptance = config.dailyAcceptanceGate === true;
  const acceptancePhase = config.dailyAcceptancePhase ?? "A";
  const attemptLimit = acceptance && acceptancePhase === "A"
    ? Math.min(100, claim.job.remainingTarget) : claim.job.remainingTarget;
  try {
    const history = await (dependencies.fetchAttempts ?? fetchCatalogDailyAttempts)(config, claim.job.id);
    priorChallenges = history.filter(row => row.error_code === 'source_challenge').length;
    if (priorChallenges > 3) throw Object.assign(new Error('Source challenge retrygrens bereikt.'), { code: 'source_challenge_retry_limit' });
    const snapshot = dependencies.acceptanceSnapshot ?? fetchCatalogAcceptanceSnapshot;
    const before = acceptance ? await snapshot(config) : null;
    if (acceptance) {
      const evidence = inspectAcceptanceSnapshot(before, jobDate);
      if (claim.job.targetNewProducts !== 400 || evidence.today !== claim.job.newProductsCollected
          || (config.acceptanceExpectedJobID && (claim.job.id !== config.acceptanceExpectedJobID
            || claim.job.newProductsCollected !== config.acceptanceExpectedCollected))
          || (acceptancePhase === "A" && attemptLimit !== 100)) {
        throw Object.assign(new Error("Acceptance dagaccounting of resterend budget ongeldig"), { code: "acceptance_day_accounting_before" });
      }
      logger.info(`Acceptance fase ${acceptancePhase}: maximaal ${attemptLimit} nieuw; dagdoel blijft 400.`);
    }
    const runGrowth = dependencies.runGrowth ?? (await import("./catalog-growth.mjs")).runCatalogGrowth;
    const supportsProductType = dependencies.hasProductTypeColumn ?? hasProductTypeColumn;
    const growthConfig = {
      ...config,
      maxNewProducts: attemptLimit,
      maxProducts: Math.min(500, Math.max(config.maxProducts, claim.job.remainingTarget)),
      importTrigger: "schedule",
      discoveryScanDate: jobDate,
    };
    growthConfig.productTypeSupported = growthConfig.dryRun
      ? true
      : await supportsProductType(growthConfig);
    result = await runResumableCatalogGrowth(growthConfig, logger, runGrowth);
    if (acceptance) {
      try {
        acceptanceEvidence = verifyDailyAcceptance({ before, after: await snapshot(config),
          job: claim.job, result, limit: attemptLimit });
        logger.info(`Acceptance fase ${acceptancePhase} integriteit: ${JSON.stringify(acceptanceEvidence)}`);
      } catch (error) {
        // Preserve every confirmed insert if the read-only gate fails after writes.
        error.actualGrowth = result.actualGrowth;
        error.catalogAttemptMetrics = { ...result, sourceErrors: result.searchErrors + result.errorCount };
        throw error;
      }
    }
  } catch (error) {
    const completedAt = dependencies.now?.() ?? new Date();
    const failure = classifyDailyImportError(error);
    const counts = errorCounts(error);
    const cumulative = Math.min(
      claim.job.targetNewProducts,
      claim.job.newProductsCollected + counts.new,
    );
    const targetReached = cumulative >= claim.job.targetNewProducts;
    const windowOpen = isDailyImportWindowOpen(completedAt, { endHour: config.dailyEndHour });
    const challengeRetry = failure.code === 'source_challenge' && priorChallenges !== null
      ? sourceChallengeRetryAt(priorChallenges + 1, completedAt.toISOString()) : null;
    const challengeCanRetry = challengeRetry && isDailyImportWindowOpen(challengeRetry, { endHour: config.dailyEndHour })
      && amsterdamDateKey(challengeRetry) === jobDate;
    const retryable = failure.retryable && windowOpen && !targetReached
      && (failure.code === 'source_challenge' ? Boolean(challengeCanRetry) : !config.dailySingleAttempt);
    const outcome = targetReached
      ? "succeeded"
      : (retryable
        ? "retryable_failure"
        : (failure.retryable ? "daily_target_partial" : "non_retryable_failure"));
    const nextRetryAt = retryable
      ? (challengeRetry ?? dailyRetryAt(claim.job.attemptCount, completedAt))
      : null;
    const job = await finish(config, {
      jobID: claim.job.id,
      attemptID: claim.attemptId,
      lockToken: claim.lockToken,
      outcome,
      counts,
      retryReason: retryable ? failure.code : null,
      nextRetryAt,
      errorCode: failure.code,
      errorSummary: failure.summary,
      publicMessage: retryable
        ? publicPauseMessage()
        : (failure.retryable
          ? (config.dailySingleAttempt ? "Eenmalige poging afgerond; verdere imports wachten op beoordeling." : "Dagupdate gedeeltelijk voltooid. De bestaande catalogus blijft beschikbaar.")
          : publicAttentionMessage()),
      now: completedAt,
    });
    logger.info(formatDailyAttemptSummary({
      job,
      counts,
      completedAt,
      nextRetryAt: job.nextRetryAt ? new Date(job.nextRetryAt) : null,
      retryReason: retryable ? failure.code : null,
    }));
    // De dagstate is al veilig vastgelegd, zodat de volgende retry kan
    // doorgaan. Een echte bron-/importfout blijft een zichtbare Actions-fout.
    throw error;
  }

  const completedAt = dependencies.now?.() ?? new Date();
  const counts = resultCounts(result);
  const cumulative = Math.min(
    claim.job.targetNewProducts,
    claim.job.newProductsCollected + counts.new,
  );
  const targetReached = cumulative >= claim.job.targetNewProducts;
  const windowOpen = isDailyImportWindowOpen(completedAt, { endHour: config.dailyEndHour });
  const sourceExhausted = result.sourceExhausted === true && counts.sourceErrors === 0;
  const stalledCoverage = ["discovery_incomplete_stalled_terms", "discovery_resume_stalled"].includes(result.stopReason);
  // Only a fully verified 100-product phase can be followed by phase B. The
  // enclosing workflow retains shared concurrency; B must acquire a normal DB
  // claim on this same persisted dayjob. No target reset or claim override.
  const acceptanceContinue = acceptance && acceptancePhase === "A"
    && acceptanceEvidence?.confirmedNew === 100 && windowOpen && !targetReached;
  const nextRetryAt = !targetReached && !sourceExhausted && !stalledCoverage && windowOpen && !config.dailySingleAttempt
    ? dailyRetryAt(claim.job.attemptCount, completedAt)
    : null;
  const outcome = targetReached
    ? "succeeded"
    : (acceptanceContinue ? "succeeded" : stalledCoverage ? "non_retryable_failure"
      : (windowOpen && !sourceExhausted && !config.dailySingleAttempt ? "succeeded" : "daily_target_partial"));
  const job = await finish(config, {
    jobID: claim.job.id,
    attemptID: claim.attemptId,
    lockToken: claim.lockToken,
    outcome,
    counts,
    retryReason: targetReached ? null : (sourceExhausted ? "discovery_exhausted" : result.stopReason ?? "daily_target_not_reached"),
    nextRetryAt,
    errorCode: stalledCoverage ? result.stopReason : null,
    publicMessage: stalledCoverage && !targetReached ? publicAttentionMessage() : targetReached
      ? "Dagdoel behaald."
      : (sourceExhausted ? "Beschikbare zoekroutes uitgeput; geen verdere nieuwe geldige kandidaten gevonden."
        : (config.dailySingleAttempt ? "Eenmalige poging afgerond; verdere imports wachten op beoordeling. Bronuitputting niet bewezen."
          : (windowOpen ? publicPauseMessage() : "Dagupdate onvolledig; veiligheidsgrens of dagvenster bereikt, bronuitputting niet bewezen."))),
    now: completedAt,
  });
  logger.info(formatDailyAttemptSummary({
    job,
    counts,
    completedAt,
    nextRetryAt: job.nextRetryAt ? new Date(job.nextRetryAt) : null,
    retryReason: targetReached ? null : (sourceExhausted ? "discovery_exhausted" : result.stopReason ?? "daily_target_not_reached"),
  }));
  return { attempted: true, reason: job.status, job, result, acceptanceEvidence, acceptanceContinue };
}

export async function runDailyAcceptance(config, logger = console, dependencies = {}) {
  const started = Date.now();
  const phaseA = await runDailyCatalogAttempt(config, logger, dependencies);
  if (!phaseA.acceptanceContinue) return { phaseA, phaseB: null };
  const evidence = phaseA.acceptanceEvidence;
  if (phaseA.job.targetNewProducts !== 400 || phaseA.job.newProductsCollected !== evidence.after.today
      || phaseA.job.remainingTarget !== evidence.remaining || phaseA.job.nextRetryAt
      || phaseA.job.status !== "retry_scheduled") {
    throw new Error("Acceptance A dagboekhouding niet bevestigd; fase B niet gestart.");
  }
  logger.info(`FASE_A_GATE_GROEN: nieuw=100; dagstand=${phaseA.job.newProductsCollected}/400; resterend=${evidence.remaining}.`);
  const remainingMs = config.growthMaxRuntimeMs - (Date.now() - started);
  if (remainingMs <= 0) throw new Error("Geen veilig runtimebudget voor fase B.");
  const phaseB = await runDailyCatalogAttempt({ ...config, dailyAcceptancePhase: "B",
    acceptanceExpectedJobID: phaseA.job.id, acceptanceExpectedCollected: phaseA.job.newProductsCollected,
    growthMaxRuntimeMs: remainingMs }, logger, dependencies);
  if (phaseB.job?.id !== phaseA.job.id) throw new Error("Acceptance dagjobidentiteit gewijzigd.");
  return { phaseA, phaseB };
}

export async function runFailedDailyRecovery(config, logger = console, dependencies = {}) {
  const now = dependencies.now?.() ?? new Date();
  const jobDate = amsterdamDateKey(now);
  if (!isDailyImportWindowOpen(now, { endHour: config.dailyEndHour })) {
    return { attempted: false, recovered: false, reason: "outside_daily_window", job: null };
  }
  const job = await (dependencies.fetchJob ?? fetchCatalogDailyJob)(config, {
    stateKey: config.dailyImportStateKey,
    jobDate,
  });
  if (!job) throw new Error("failed_daily_recovery_requires_existing_day");
  const attempts = await (dependencies.fetchAttempts ?? fetchCatalogDailyAttempts)(config, job.id);
  const decision = failedDailyRecoveryDecision(job, attempts);
  if (!decision.allowed) throw new Error(decision.reason);
  const recovered = await (dependencies.recover ?? recoverCatalogDailyAttempt)(config, {
    job,
    recoveryReason: config.dailyRecoveryReason,
    now,
    lockTTLMinutes: 130,
  });
  logger.info(
    `Daily recovery geaccepteerd: recoveryId=${recovered.recoveryId}, `
      + `dailyImportId=${recovered.job.id}, vorige_stand=${job.newProductsCollected}/${job.targetNewProducts}, `
      + `resterend=${job.remainingTarget}, nieuwe_attempt=${recovered.attemptId}.`,
  );
  return runDailyCatalogAttempt(config, logger, {
    ...dependencies,
    now: () => now,
    preclaimedClaim: recovered,
  });
}

export async function mainDailyCatalogGrowth(env = process.env) {
  const config = loadConfig(env);
  if (config.updateMode !== "growth") {
    throw new Error("De dagelijkse catalogusjob vereist UPDATE_MODE=growth.");
  }
  if (config.dryRun) throw new Error("De dagelijkse catalogusjob ondersteunt geen DRY_RUN.");
  const logger = safeLogger(config.supabaseSecret);
  if (config.resumeSourceChallenge) return resumeSourceChallenge(config, logger);
  if (config.recoverFailedDaily) return runFailedDailyRecovery(config, logger);
  return config.dailyAcceptanceGate ? runDailyAcceptance(config, logger) : runDailyCatalogAttempt(config, logger);
}

export async function resumeSourceChallenge(config, logger = console, dependencies = {}) {
  const now = dependencies.now?.() ?? new Date();
  const job = await (dependencies.fetchJob ?? fetchCatalogDailyJob)(config, {
    stateKey: config.dailyImportStateKey, jobDate: amsterdamDateKey(now),
  });
  if (!job) throw new Error('source_challenge_resume_requires_existing_day');
  const attempts = await (dependencies.fetchAttempts ?? fetchCatalogDailyAttempts)(config, job.id);
  if (job.status === 'daily_target_partial') {
    const decision = challengeRecoveryDecision(job, attempts, now);
    if (!decision.allowed) throw new Error(decision.reason);
  } else {
    if (attempts.at(-1)?.error_code !== 'source_challenge'
        || !shouldRunDailyImport(job, now, { endHour: config.dailyEndHour }).run) {
      throw new Error('source_challenge_resume_not_due');
    }
    const retryAt = sourceChallengeRetryAt(attempts.filter(row => row.error_code === 'source_challenge').length,
      attempts.at(-1).completed_at);
    if (!retryAt || now < retryAt) throw new Error('source_challenge_resume_not_due');
  }
  const snapshot = await (dependencies.acceptanceSnapshot ?? fetchCatalogAcceptanceSnapshot)(config);
  const evidence = inspectAcceptanceSnapshot(snapshot, job.jobDate);
  if (job.targetNewProducts !== 400 || evidence.today !== job.newProductsCollected) {
    throw new Error('source_challenge_resume_accounting_mismatch');
  }
  // A single ordinary request, no retries/alternate route or challenge solving.
  await (dependencies.verifySource ?? verifyNormalSourceAccess)(config);
  if (job.status === 'daily_target_partial') {
    await (dependencies.requeue ?? requeueSourceChallenge)(config, job, attempts, dependencies.now?.() ?? new Date());
  }
  return runDailyCatalogAttempt({ ...config, dailyAcceptanceGate: true, dailyAcceptancePhase: 'B',
    acceptanceExpectedJobID: job.id, acceptanceExpectedCollected: job.newProductsCollected }, logger, dependencies);
}

async function cli() {
  const config = loadConfig(process.env);
  if (process.argv.includes("--inspect")) {
    const decision = await inspectDailyCatalogAttempt(config);
    console.log(`run_attempt=${decision.run ? "1" : "0"}`);
    console.log(`reason=${decision.reason}`);
    return;
  }
  await mainDailyCatalogGrowth(process.env);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  cli().catch((error) => {
    console.error(`Dagelijkse catalogusgroei mislukt: ${error instanceof Error ? error.message : "onbekende fout"}`);
    process.exitCode = 1;
  });
}
