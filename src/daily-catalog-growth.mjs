import { pathToFileURL } from "node:url";

import { loadConfig } from "./config.mjs";
import {
  claimCatalogDailyAttempt,
  fetchCatalogDailyJob,
  finishCatalogDailyAttempt,
  hasProductTypeColumn,
} from "./supabase.mjs";

export const DAILY_IMPORT_TIMEZONE = "Europe/Amsterdam";
export const DAILY_IMPORT_START_HOUR = 6;
export const DAILY_IMPORT_END_HOUR = 23;

const RETRYABLE_CODES = new Set([
  "source_challenge",
  "source_unavailable",
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
  if (attempt === 1) return 10;
  if (attempt === 2) return 20;
  if (attempt === 3) return 40;
  return 60;
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

function resultCounts(result = {}) {
  return {
    candidates: integer(result.candidatesViewed),
    new: integer(result.actualGrowth),
    updated: integer(result.updatedCount),
    unchanged: integer(result.unchangedCount),
    skipped: integer(result.skippedCount),
    invalid: integer(result.invalidCount ?? result.skippedCount),
    sourceErrors: integer(result.searchErrors),
  };
}

function errorCounts(error) {
  const metrics = error?.catalogAttemptMetrics ?? {};
  return {
    candidates: integer(metrics.candidatesViewed),
    new: integer(error?.actualGrowth),
    updated: integer(metrics.updatedCount),
    unchanged: integer(metrics.unchangedCount),
    skipped: integer(metrics.skippedCount),
    invalid: integer(metrics.invalidCount),
    sourceErrors: integer(metrics.sourceErrors || 1),
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
    `kandidaten_bekeken=${counts.candidates}`,
    `nieuw=${counts.new}`,
    `bijgewerkt=${counts.updated}`,
    `ongewijzigd=${counts.unchanged}`,
    `overgeslagen=${counts.skipped}`,
    `ongeldig=${counts.invalid}`,
    `bronfouten=${counts.sourceErrors}`,
    `cumulatief_nieuw=${job.newProductsCollected}`,
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
    info: (value) => console.log(redact(value)),
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

  const claim = await (dependencies.claim ?? claimCatalogDailyAttempt)(config, {
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
  try {
    const runGrowth = dependencies.runGrowth ?? (await import("./catalog-growth.mjs")).runCatalogGrowth;
    const supportsProductType = dependencies.hasProductTypeColumn ?? hasProductTypeColumn;
    const growthConfig = {
      ...config,
      maxNewProducts: claim.job.remainingTarget,
      maxProducts: Math.min(500, Math.max(config.maxProducts, claim.job.remainingTarget)),
      importTrigger: "schedule",
    };
    growthConfig.productTypeSupported = growthConfig.dryRun
      ? true
      : await supportsProductType(growthConfig);
    result = await runGrowth(growthConfig, logger);
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
    const retryable = failure.retryable && windowOpen && !targetReached;
    const outcome = targetReached
      ? "succeeded"
      : (retryable
        ? "retryable_failure"
        : (failure.retryable ? "daily_target_partial" : "non_retryable_failure"));
    const nextRetryAt = retryable
      ? dailyRetryAt(claim.job.attemptCount, completedAt)
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
          ? "Dagupdate gedeeltelijk voltooid. De bestaande catalogus blijft beschikbaar."
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
    if (!failure.retryable) throw error;
    return { attempted: true, reason: job.status, job, error };
  }

  const completedAt = dependencies.now?.() ?? new Date();
  const counts = resultCounts(result);
  const cumulative = Math.min(
    claim.job.targetNewProducts,
    claim.job.newProductsCollected + counts.new,
  );
  const targetReached = cumulative >= claim.job.targetNewProducts;
  const windowOpen = isDailyImportWindowOpen(completedAt, { endHour: config.dailyEndHour });
  const nextRetryAt = !targetReached && windowOpen
    ? dailyRetryAt(claim.job.attemptCount, completedAt)
    : null;
  const outcome = targetReached
    ? "succeeded"
    : (windowOpen ? "succeeded" : "daily_target_partial");
  const job = await finish(config, {
    jobID: claim.job.id,
    attemptID: claim.attemptId,
    lockToken: claim.lockToken,
    outcome,
    counts,
    retryReason: targetReached ? null : "daily_target_not_reached",
    nextRetryAt,
    publicMessage: targetReached
      ? "Dagdoel behaald."
      : (windowOpen ? publicPauseMessage() : "Dagupdate gedeeltelijk voltooid. De bestaande catalogus blijft beschikbaar."),
    now: completedAt,
  });
  logger.info(formatDailyAttemptSummary({
    job,
    counts,
    completedAt,
    nextRetryAt: job.nextRetryAt ? new Date(job.nextRetryAt) : null,
    retryReason: targetReached ? null : "daily_target_not_reached",
  }));
  return { attempted: true, reason: job.status, job, result };
}

export async function mainDailyCatalogGrowth(env = process.env) {
  const config = loadConfig(env);
  if (config.updateMode !== "growth") {
    throw new Error("De dagelijkse catalogusjob vereist UPDATE_MODE=growth.");
  }
  if (config.dryRun) throw new Error("De dagelijkse catalogusjob ondersteunt geen DRY_RUN.");
  const logger = safeLogger(config.supabaseSecret);
  return runDailyCatalogAttempt(config, logger);
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
