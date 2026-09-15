"use client";

import { useEffect, useState } from "react";

import {
  CatalogStatusReadError,
  createCatalogStatusRepository,
} from "@/services/catalog/catalog-status-repository";
import type { CatalogImportStatus, CatalogStatus } from "@/types/catalog-status";

interface CatalogStatusViewProps {
  initialStatus?: CatalogStatus | null;
}

const statusLabels: Record<CatalogImportStatus, string> = {
  running: "Catalogus wordt bijgewerkt",
  success: "Import geslaagd",
  partial: "Import gedeeltelijk voltooid",
  failed: "Laatste import mislukt",
};

export function formatCatalogUpdateTime(value: string, now = new Date()): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Onbekend";
  const day = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const time = new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
  const today = day.format(now);
  const dateDay = day.format(date);
  const yesterday = day.format(new Date(now.getTime() - 24 * 60 * 60 * 1000));
  if (dateDay === today) return `vandaag ${time}`;
  if (dateDay === yesterday) return `gisteren ${time}`;
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function CatalogStatusContent({ status }: { status: CatalogStatus }) {
  const run = status.latestRun;
  return (
    <section className="catalog-status-card" aria-labelledby="catalog-status-title">
      <div className="catalog-status-heading">
        <div>
          <p className="card-eyebrow">Hoogvliet catalogus</p>
          <h2 id="catalog-status-title">
            {status.totalUniqueProducts.toLocaleString("nl-NL")} / {status.targetLabel} producten
          </h2>
        </div>
        <strong>{status.progressPercent}%</strong>
      </div>
      <div className="catalog-progress" aria-label={`Ongeveer ${status.progressPercent}% van het richtgetal verzameld`}>
        <span style={{ width: `${status.progressPercent}%` }} />
      </div>
      <p className="catalog-progress-caption">±{status.progressPercent}% van het richtgetal verzameld</p>

      {run ? (
        <>
          <div className="catalog-run-status" data-status={run.status}>
            <span aria-hidden="true" />
            <strong>{statusLabels[run.status]}</strong>
          </div>
          <dl className="catalog-run-grid">
            <div><dt>Verwerkt</dt><dd>{run.processedCount}</dd></div>
            <div><dt>Nieuw</dt><dd>+{run.newCount}</dd></div>
            <div><dt>Bijgewerkt</dt><dd>{run.updatedCount}</dd></div>
            <div><dt>Ongewijzigd</dt><dd>{run.unchangedCount}</dd></div>
            <div><dt>Overgeslagen</dt><dd>{run.skippedCount}</dd></div>
            <div><dt>Fouten</dt><dd>{run.errorCount}</dd></div>
          </dl>
          <p className="catalog-last-update">
            Laatste update: {formatCatalogUpdateTime(run.finishedAt ?? run.startedAt)}
          </p>
        </>
      ) : (
        <div className="catalog-status-empty">
          <h3>Nog geen importhistorie</h3>
          <p>De catalogus is beschikbaar. Na de eerste groeirun verschijnt hier de actuele importstatus.</p>
        </div>
      )}
      <p className="catalog-storage-note">
        Opslaggebruik wordt alleen getoond wanneer dit veilig server-side beschikbaar is. Er worden geen beheercredentials naar deze app gestuurd.
      </p>
    </section>
  );
}

export function CatalogStatusView({ initialStatus = null }: CatalogStatusViewProps) {
  const [status, setStatus] = useState<CatalogStatus | null>(initialStatus);
  const [loading, setLoading] = useState(initialStatus === null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.resolve()
      .then(() => createCatalogStatusRepository().getStatus(controller.signal))
      .then((nextStatus) => {
        if (!active) return;
        setStatus(nextStatus);
        setFailed(false);
      })
      .catch((error: unknown) => {
        if (!active || controller.signal.aborted) return;
        setFailed(error instanceof CatalogStatusReadError || error instanceof Error);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  if (loading && !status) {
    return <div className="catalog-status-loading" role="status">Catalogusstatus laden…</div>;
  }
  if (failed && !status) {
    return (
      <div className="catalog-status-error" role="alert">
        <h2>Catalogusstatus tijdelijk niet beschikbaar</h2>
        <p>Je kunt Producten en je boodschappenlijst gewoon blijven gebruiken.</p>
      </div>
    );
  }
  return status ? <CatalogStatusContent status={status} /> : null;
}
