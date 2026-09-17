import type { SupabaseClient } from "@supabase/supabase-js";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  CatalogDailyJob,
  CatalogDailyJobStatus,
  CatalogImportRun,
  CatalogImportStatus,
  CatalogStatus,
} from "@/types/catalog-status";

const CATALOG_TARGET = 10_000;
const VALID_STATUSES = new Set<CatalogImportStatus>([
  "running",
  "success",
  "partial",
  "failed",
]);
const VALID_DAILY_STATUSES = new Set<CatalogDailyJobStatus>([
  "pending",
  "running",
  "retry_scheduled",
  "target_reached",
  "daily_target_partial",
  "failed_requires_attention",
]);

function count(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0;
}

function nullableCount(value: unknown): number | null {
  return value === null || value === undefined ? null : count(value);
}

function dateValue(value: unknown): string | null {
  return typeof value === "string" && Number.isFinite(Date.parse(value)) ? value : null;
}

function optionalText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function catalogProgressPercent(totalUniqueProducts: number): number {
  return Math.min(100, Math.max(0, Math.round((totalUniqueProducts / CATALOG_TARGET) * 100)));
}

export function mapCatalogImportRun(row: unknown): CatalogImportRun | null {
  if (typeof row !== "object" || row === null) return null;
  const value = row as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id : null;
  const startedAt = dateValue(value.started_at);
  const status = typeof value.status === "string" && VALID_STATUSES.has(value.status as CatalogImportStatus)
    ? value.status as CatalogImportStatus
    : null;
  const trigger = value.trigger === "schedule" || value.trigger === "manual" || value.trigger === "test"
    ? value.trigger
    : null;
  if (!id || !startedAt || !status || !trigger) return null;
  return {
    id,
    startedAt,
    finishedAt: dateValue(value.finished_at),
    status,
    trigger,
    processedCount: count(value.processed_count),
    newCount: count(value.new_count),
    updatedCount: count(value.updated_count),
    unchangedCount: count(value.unchanged_count),
    skippedCount: count(value.skipped_count),
    errorCount: count(value.error_count),
    errorSummary: optionalText(value.error_summary),
    totalUniqueProductsBefore: count(value.total_unique_products_before),
    totalUniqueProductsAfter: nullableCount(value.total_unique_products_after),
    durationSeconds: nullableCount(value.duration_seconds),
  };
}

export function mapCatalogDailyJob(row: unknown): CatalogDailyJob | null {
  if (typeof row !== "object" || row === null) return null;
  const value = row as Record<string, unknown>;
  const id = typeof value.id === "string" ? value.id : null;
  const jobDate = typeof value.job_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value.job_date)
    ? value.job_date
    : null;
  const startedAt = dateValue(value.started_at);
  const status = typeof value.status === "string"
    && VALID_DAILY_STATUSES.has(value.status as CatalogDailyJobStatus)
    ? value.status as CatalogDailyJobStatus
    : null;
  if (!id || !jobDate || !startedAt || !status) return null;
  const targetNewProducts = Math.max(1, count(value.target_new_products));
  const newProductsCollected = Math.min(targetNewProducts, count(value.new_products_collected));
  return {
    id,
    jobDate,
    targetNewProducts,
    newProductsCollected,
    remainingTarget: Math.max(0, targetNewProducts - newProductsCollected),
    status,
    attemptCount: count(value.attempt_count),
    startedAt,
    lastAttemptAt: dateValue(value.last_attempt_at),
    nextRetryAt: dateValue(value.next_retry_at),
    completedAt: dateValue(value.completed_at),
    lastPublicMessage: optionalText(value.last_public_message),
  };
}

function amsterdamDateKey(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export class CatalogStatusReadError extends Error {
  constructor() {
    super("catalog-status-unavailable");
    this.name = "CatalogStatusReadError";
  }
}

export class CatalogStatusRepository {
  constructor(private readonly client: SupabaseClient) {}

  async getStatus(signal?: AbortSignal): Promise<CatalogStatus> {
    let totalQuery = this.client
      .from("products")
      .select("id", { count: "exact", head: true })
      .eq("supermarket", "Hoogvliet");
    let runQuery = this.client
      .from("catalog_import_runs")
      .select("id,started_at,finished_at,status,trigger,processed_count,new_count,updated_count,unchanged_count,skipped_count,error_count,error_summary,total_unique_products_before,total_unique_products_after,duration_seconds")
      .order("started_at", { ascending: false })
      .limit(1);
    let dailyQuery = this.client
      .from("catalog_daily_jobs")
      .select("id,job_date,target_new_products,new_products_collected,status,attempt_count,started_at,last_attempt_at,next_retry_at,completed_at,last_public_message")
      .eq("state_key", "daily-catalog-growth")
      .eq("job_date", amsterdamDateKey())
      .limit(1);
    if (signal) {
      totalQuery = totalQuery.abortSignal(signal);
      runQuery = runQuery.abortSignal(signal);
      dailyQuery = dailyQuery.abortSignal(signal);
    }
    const [totalResult, runResult, dailyResult] = await Promise.all([
      totalQuery,
      runQuery,
      dailyQuery,
    ]);
    if (totalResult.error || runResult.error || totalResult.count === null) {
      throw new CatalogStatusReadError();
    }
    const totalUniqueProducts = count(totalResult.count);
    return {
      totalUniqueProducts,
      targetLabel: "10.000+",
      progressPercent: catalogProgressPercent(totalUniqueProducts),
      latestRun: Array.isArray(runResult.data)
        ? mapCatalogImportRun(runResult.data[0])
        : null,
      // De migratie wordt vóór activatie van de scheduler uitgerold. Tijdens
      // een Preview vóór die database-uitrol blijft de bestaande statuskaart
      // bewust bruikbaar in plaats van de hele PWA te blokkeren.
      dailyJob: dailyResult.error === null && Array.isArray(dailyResult.data)
        ? mapCatalogDailyJob(dailyResult.data[0])
        : null,
    };
  }
}

export function createCatalogStatusRepository(): CatalogStatusRepository {
  const client = getSupabaseBrowserClient();
  if (!client) throw new CatalogStatusReadError();
  return new CatalogStatusRepository(client);
}
