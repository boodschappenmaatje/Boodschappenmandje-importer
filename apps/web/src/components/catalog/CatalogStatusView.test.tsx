import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CatalogStatusContent,
  formatCatalogUpdateTime,
} from "@/components/catalog/CatalogStatusView";
import {
  catalogProgressPercent,
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
  });
});
