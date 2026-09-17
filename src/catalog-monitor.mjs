import { pathToFileURL } from "node:url";

import { loadConfig } from "./config.mjs";
import { amsterdamDateKey } from "./daily-catalog-growth.mjs";
import {
  ensureCatalogDailyJob,
  fetchCatalogDailyJob,
} from "./supabase.mjs";

const DEFAULT_MAX_AGE_HOURS = 6;
const DEFAULT_GROWTH_TARGET = 400;

function validDate(value) {
  const parsed = Date.parse(value ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

export function evaluateCatalogMonitor(runs, {
  now = new Date(),
  maxAgeHours = DEFAULT_MAX_AGE_HOURS,
  growthTarget = DEFAULT_GROWTH_TARGET,
} = {}) {
  const latest = Array.isArray(runs) ? runs[0] : null;
  if (!latest) {
    return {
      ok: false,
      state: "missing",
      message: "Geen geplande catalogusrun gevonden.",
      run: null,
    };
  }

  const startedAt = validDate(latest.started_at);
  const ageMs = startedAt === null ? Number.POSITIVE_INFINITY : now.getTime() - startedAt;
  const maxAgeMs = Math.max(1, Number(maxAgeHours) || DEFAULT_MAX_AGE_HOURS) * 60 * 60 * 1000;
  if (ageMs < 0 || ageMs > maxAgeMs) {
    return {
      ok: false,
      state: "overdue",
      message: `Laatste geplande catalogusrun is ouder dan ${maxAgeHours} uur.`,
      run: latest,
    };
  }

  const before = Number(latest.total_unique_products_before);
  const after = Number(latest.total_unique_products_after);
  const hasCatalogCounts = latest.total_unique_products_before != null
    && latest.total_unique_products_after != null
    && Number.isFinite(before)
    && Number.isFinite(after);
  const actualGrowth = hasCatalogCounts
    ? Math.max(0, after - before)
    : Math.max(0, Number(latest.new_count) || 0);
  const target = Math.max(1, Number(growthTarget) || DEFAULT_GROWTH_TARGET);

  if (latest.status === "running" || latest.status === "failed") {
    const detail = latest.error_summary ? ` ${latest.error_summary}` : "";
    return {
      ok: false,
      state: latest.status,
      message: `Laatste geplande catalogusrun heeft status '${latest.status}'.${detail}`,
      run: latest,
    };
  }

  if (latest.status !== "success" || actualGrowth < target) {
    const detail = latest.error_summary ? ` ${latest.error_summary}` : "";
    return {
      ok: false,
      state: "partial_growth_target_not_reached",
      message: `Catalogusgroei gedeeltelijk: ${actualGrowth}/${target} nieuwe producten toegevoegd.${detail}`,
      run: latest,
    };
  }

  return {
    ok: true,
    state: "healthy",
    message: `Dagelijkse catalogusgroei geslaagd: ${actualGrowth} nieuwe producten toegevoegd.`,
    run: latest,
  };
}

export function evaluateDailyCatalogMonitor(job, {
  growthTarget = DEFAULT_GROWTH_TARGET,
} = {}) {
  if (!job) {
    return {
      ok: false,
      state: "missing",
      message: "De dagelijkse catalogusjob ontbreekt en moet veilig worden ingepland.",
      job: null,
    };
  }
  const target = Math.max(1, Number(job.targetNewProducts) || Number(growthTarget) || DEFAULT_GROWTH_TARGET);
  const collected = Math.max(0, Number(job.newProductsCollected) || 0);
  if (job.status === "target_reached" || collected >= target) {
    return {
      ok: true,
      state: "healthy",
      message: `Dagdoel behaald: ${collected}/${target} nieuwe producten toegevoegd.`,
      job,
    };
  }
  if (job.status === "failed_requires_attention") {
    return {
      ok: false,
      state: "failed_requires_attention",
      message: `Catalogusupdate heeft aandacht nodig; voortgang ${collected}/${target}.`,
      job,
    };
  }
  if (job.status === "daily_target_partial") {
    return {
      ok: true,
      state: "daily_target_partial",
      message: `Dagupdate gedeeltelijk voltooid: ${collected}/${target} nieuwe producten toegevoegd.`,
      job,
    };
  }
  if (job.status === "running") {
    return {
      ok: true,
      state: "running",
      message: `Catalogusupdate is bezig; voortgang ${collected}/${target}.`,
      job,
    };
  }
  if (job.status === "retry_scheduled") {
    return {
      ok: true,
      state: "retry_scheduled",
      message: `Normaal herstelproces actief; voortgang ${collected}/${target}.`,
      job,
    };
  }
  return {
    ok: true,
    state: "retry_scheduled",
    message: `Dagjob staat klaar voor de volgende veilige poging; voortgang ${collected}/${target}.`,
    job,
  };
}

export async function monitorDailyCatalog(env = process.env, logger = console) {
  const config = loadConfig(env);
  const now = new Date();
  const jobDate = amsterdamDateKey(now);
  let job = await fetchCatalogDailyJob(config, {
    stateKey: config.dailyImportStateKey,
    jobDate,
  });
  if (!job) {
    job = await ensureCatalogDailyJob(config, {
      stateKey: config.dailyImportStateKey,
      jobDate,
      targetNewProducts: config.dailyTargetNewProducts,
      now,
    });
    logger.info("Catalogusbewaking heeft de ontbrekende dagjob veilig klaargezet; de retry-workflow neemt deze over.");
  }
  const result = evaluateDailyCatalogMonitor(job, {
    growthTarget: Number(env.CATALOG_MONITOR_GROWTH_TARGET) || DEFAULT_GROWTH_TARGET,
  });
  logger.info([
    `Catalogusbewaking: ${result.message}`,
    `dailyImportId=${job.id}`,
    `status=${job.status}`,
    `pogingen=${job.attemptCount}`,
    `cumulatief_nieuw=${job.newProductsCollected}`,
    `resterend=${job.remainingTarget}`,
    job.nextRetryAt ? `volgende_poging=${job.nextRetryAt}` : null,
  ].filter(Boolean).join(" | "));
  if (!result.ok) throw new Error(result.message);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  monitorDailyCatalog().catch((error) => {
    console.error(`Catalogusbewaking mislukt: ${error instanceof Error ? error.message : "onbekende fout"}`);
    process.exitCode = 1;
  });
}
