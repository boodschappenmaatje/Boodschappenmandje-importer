import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CatalogStatusContent,
  formatCatalogUpdateTime,
  formatNextCatalogAttempt,
} from "@/components/catalog/CatalogStatusView";
import {
  catalogProgressPercent,
  mapCatalogDailyJob,
  mapCatalogImportRun,
} from "@/services/catalog/catalog-status-repository";
import type { CatalogStatus } from "@/types/catalog-status";

const status: CatalogStatus = {
  totalUniqueProducts: 6_842,
  targetLabel: "10.000+",
  progressPercent: 68,
  latestRun: {
    id: "run-1",
    startedAt: "2026-09-15T04:00:00Z",
    finishedAt: "2026-09-15T04:16:00Z",
    status: "success",
    trigger: "schedule",
    processedCount: 400,
    newCount: 286,
    updatedCount: 108,
    unchangedCount: 6,
    skippedCount: 0,
    errorCount: 0,
    errorSummary: null,
    totalUniqueProductsBefore: 6_556,
    totalUniqueProductsAfter: 6_842,
    durationSeconds: 960,
  },
  dailyJob: null,
};

describe("catalogusstatus", () => {
  it("toont echte runwaarden en een indicatief 10.000+-richtgetal", () => {
    const html = renderToStaticMarkup(createElement(CatalogStatusContent, { status }));
    expect(html).toContain("6.842 / 10.000+ producten");
    expect(html).toContain("±68% van het richtgetal verzameld");
    expect(html).toContain("Import geslaagd");
    expect(html).toContain("+286");
    expect(html).not.toContain("74 MB");
  });

  it("ondersteunt running, partial en failed zonder een groene succesclaim", () => {
    for (const runStatus of ["running", "partial", "failed"] as const) {
      const html = renderToStaticMarkup(createElement(CatalogStatusContent, {
        status: { ...status, latestRun: { ...status.latestRun!, status: runStatus } },
      }));
      expect(html).toContain(`data-status="${runStatus}"`);
      expect(html).not.toContain("Import geslaagd");
    }
  });

  it("maakt bij partial onderscheid tussen bronproblemen en productfouten", () => {
    const html = renderToStaticMarkup(createElement(CatalogStatusContent, {
      status: {
        ...status,
        latestRun: {
          ...status.latestRun!,
          status: "partial",
          errorCount: 0,
          errorSummary: "2 zoektermfout(en)",
        },
      },
    }));
    expect(html).toContain("Productfouten");
    expect(html).toContain("2 zoektermfout(en)");
    expect(html).toContain("Alle verwerkte producten waren geldig");
    expect(html).not.toContain("Import geslaagd");
  });

  it("toont een nette eerste-runstatus zonder null of undefined", () => {
    const html = renderToStaticMarkup(createElement(CatalogStatusContent, {
      status: { ...status, latestRun: null },
    }));
    expect(html).toContain("Nog geen importhistorie");
    expect(html).not.toContain("undefined");
    expect(html).not.toContain("null");
  });

  it("mapt alleen geldige typed runvelden", () => {
    expect(mapCatalogImportRun({
      id: "run-1", started_at: "2026-09-15T04:00:00Z", finished_at: null,
      status: "running", trigger: "test", processed_count: 10, new_count: 4,
      updated_count: 3, unchanged_count: 2, skipped_count: 1, error_count: 0,
      error_summary: "1 zoektermfout(en)",
      total_unique_products_before: 100, total_unique_products_after: null,
      duration_seconds: null,
    })).toMatchObject({
      status: "running", processedCount: 10, newCount: 4,
      errorSummary: "1 zoektermfout(en)",
    });
    expect(mapCatalogImportRun({ status: "unknown" })).toBeNull();
  });

  it("begrensd voortgangspercentage gebruikt 10.000 als indicatief richtgetal", () => {
    expect(catalogProgressPercent(0)).toBe(0);
    expect(catalogProgressPercent(5_000)).toBe(50);
    expect(catalogProgressPercent(9_500)).toBe(95);
    expect(catalogProgressPercent(10_500)).toBe(100);
  });

  it("formatteert laatste update in Nederlandse lokale tijd", () => {
    expect(formatCatalogUpdateTime(
      "2026-09-15T04:16:00Z",
      new Date("2026-09-15T08:00:00Z"),
    )).toBe("vandaag 06:16");
    expect(formatNextCatalogAttempt("2026-09-15T07:20:00Z")).toBe("09:20");
  });

  it("toont cumulatieve dagvoortgang en een consumentvriendelijke retrytijd", () => {
    const html = renderToStaticMarkup(createElement(CatalogStatusContent, {
      status: {
        ...status,
        dailyJob: {
          id: "daily-1",
          jobDate: "2026-09-15",
          targetNewProducts: 400,
          newProductsCollected: 228,
          remainingTarget: 172,
          status: "retry_scheduled",
          attemptCount: 2,
          startedAt: "2026-09-15T04:00:00Z",
          lastAttemptAt: "2026-09-15T06:55:00Z",
          nextRetryAt: "2026-09-15T07:20:00Z",
          completedAt: null,
          lastPublicMessage: "Catalogusupdate tijdelijk gepauzeerd.",
        },
      },
    }));
    expect(html).toContain("Vandaag nieuw");
    expect(html).toContain("228 / 400");
    expect(html).toContain("Tijdelijk gepauzeerd");
    expect(html).toContain("Volgende poging rond 09:20");
    expect(html).not.toContain("source_challenge");
  });

  it("mapt alle publieke dagjobstatussen typed", () => {
    for (const dailyStatus of [
      "pending", "running", "retry_scheduled", "target_reached",
      "daily_target_partial", "failed_requires_attention",
    ] as const) {
      expect(mapCatalogDailyJob({
        id: "daily-1",
        job_date: "2026-09-15",
        target_new_products: 400,
        new_products_collected: 137,
        status: dailyStatus,
        attempt_count: 1,
        started_at: "2026-09-15T04:00:00Z",
      })).toMatchObject({ status: dailyStatus, newProductsCollected: 137, remainingTarget: 263 });
    }
  });

  it("toont alle dagjobstatussen zonder technische foutcodes", () => {
    const labels = new Map([
      ["pending", "Nieuwe poging wordt voorbereid"],
      ["running", "Bezig met bijwerken"],
      ["retry_scheduled", "Tijdelijk gepauzeerd"],
      ["target_reached", "Dagdoel behaald"],
      ["daily_target_partial", "Dagdoel gedeeltelijk behaald"],
      ["failed_requires_attention", "Update heeft aandacht nodig"],
    ] as const);
    for (const [dailyStatus, label] of labels) {
      const html = renderToStaticMarkup(createElement(CatalogStatusContent, {
        status: {
          ...status,
          dailyJob: {
            id: "daily-1", jobDate: "2026-09-15", targetNewProducts: 400,
            newProductsCollected: dailyStatus === "target_reached" ? 400 : 137,
            remainingTarget: dailyStatus === "target_reached" ? 0 : 263,
            status: dailyStatus, attemptCount: 2,
            startedAt: "2026-09-15T04:00:00Z", lastAttemptAt: null,
            nextRetryAt: null, completedAt: null, lastPublicMessage: null,
          },
        },
      }));
      expect(html).toContain(label);
      expect(html).not.toContain("source_unavailable");
    }
  });
});
