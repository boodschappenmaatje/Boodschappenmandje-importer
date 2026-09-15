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

export interface CatalogStatus {
  totalUniqueProducts: number;
  targetLabel: "10.000+";
  progressPercent: number;
  latestRun: CatalogImportRun | null;
}
