export type CatalogImportStatus = "running" | "success" | "partial" | "failed";

export interface CatalogImportRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  status: CatalogImportStatus;
  trigger: "schedule" | "manual" | "test";
  processedCount: number;
  newCount: number;
  updatedCount: number;
  unchangedCount: number;
  skippedCount: number;
  errorCount: number;
  errorSummary: string | null;
  totalUniqueProductsBefore: number;
  totalUniqueProductsAfter: number | null;
  durationSeconds: number | null;
}

export type CatalogDailyJobStatus =
  | "pending"
  | "running"
  | "retry_scheduled"
  | "target_reached"
  | "daily_target_partial"
  | "failed_requires_attention";

export interface CatalogDailyJob {
  id: string;
  jobDate: string;
  targetNewProducts: number;
  newProductsCollected: number;
  remainingTarget: number;
  status: CatalogDailyJobStatus;
  attemptCount: number;
  startedAt: string;
  lastAttemptAt: string | null;
  nextRetryAt: string | null;
  completedAt: string | null;
  lastPublicMessage: string | null;
}

export interface CatalogStatus {
  totalUniqueProducts: number;
  targetLabel: "10.000+";
  progressPercent: number;
  latestRun: CatalogImportRun | null;
  dailyJob: CatalogDailyJob | null;
}
