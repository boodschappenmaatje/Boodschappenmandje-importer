import { pathToFileURL } from "node:url";

import { loadConfig } from "./config.mjs";
import { fetchCatalogImportRuns } from "./supabase.mjs";

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

export async function monitorDailyCatalog(env = process.env, logger = console) {
  const config = loadConfig(env);
  const runs = await fetchCatalogImportRuns(config, { trigger: "schedule", limit: 3 });
  const result = evaluateCatalogMonitor(runs, {
    maxAgeHours: Number(env.CATALOG_MONITOR_MAX_AGE_HOURS) || DEFAULT_MAX_AGE_HOURS,
    growthTarget: Number(env.CATALOG_MONITOR_GROWTH_TARGET) || DEFAULT_GROWTH_TARGET,
  });
  const run = result.run;
  logger.info([
    `Catalogusbewaking: ${result.message}`,
    run ? `status=${run.status}` : null,
    run ? `gestart=${run.started_at}` : null,
    run?.finished_at ? `afgerond=${run.finished_at}` : null,
    run ? `productfouten=${run.error_count ?? 0}` : null,
    run ? `werkelijke_groei=${Math.max(0, Number(run.total_unique_products_after) - Number(run.total_unique_products_before))}` : null,
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
